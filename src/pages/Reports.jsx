import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Sparkles, Loader2, CalendarDays, Users, BookOpen, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getCategoryLabel } from "@/components/fcfCategories";
import ReportPreview from "@/components/reports/ReportPreview";
import { generatePDF } from "@/components/reports/pdfGenerator";
import MonthlyReportSection from "@/components/reports/MonthlyReportSection";
import PDIReportSection from "@/components/reports/PDIReportSection";
import ProgressionReportSection from "@/components/reports/ProgressionReportSection";

export default function Reports() {
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const [reportData, setReportData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });
  const { data: matchStats = [] } = useQuery({
    queryKey: ["matchStats"],
    queryFn: () => base44.entities.MatchStats.list("-date", 200),
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance"],
    queryFn: () => base44.entities.TrainingAttendance.list("-date", 500),
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    setReportData(null);
    try {
      const filteredTeams = selectedTeamId === "all" ? teams : teams.filter(t => t.id === selectedTeamId);
      const filteredPlayers = selectedTeamId === "all" ? players : players.filter(p => p.team_id === selectedTeamId);
      const playerIds = new Set(filteredPlayers.map(p => p.id));
      const filteredStats = matchStats.filter(s => playerIds.has(s.player_id));
      const filteredAttendance = attendance.filter(a => playerIds.has(a.player_id));

      // Compute team summaries
      const teamSummaries = filteredTeams.map(team => {
        const tp = filteredPlayers.filter(p => p.team_id === team.id);
        const ts = filteredStats.filter(s => tp.some(p => p.id === s.player_id));
        const ta = filteredAttendance.filter(a => tp.some(p => p.id === a.player_id));

        const totalGoals = ts.reduce((acc, s) => acc + (s.goals || 0), 0);
        const totalAssists = ts.reduce((acc, s) => acc + (s.assists || 0), 0);
        const totalYellow = ts.reduce((acc, s) => acc + (s.yellow_cards || 0), 0);
        const totalRed = ts.reduce((acc, s) => acc + (s.red_cards || 0), 0);
        const attendanceRate = ta.length > 0
          ? Math.round((ta.filter(a => a.attended).length / ta.length) * 100)
          : null;
        const avgRating = ts.filter(s => s.rating).length > 0
          ? (ts.filter(s => s.rating).reduce((acc, s) => acc + s.rating, 0) / ts.filter(s => s.rating).length).toFixed(1)
          : null;

        // Top scorers
        const scorerMap = {};
        ts.forEach(s => {
          if (!scorerMap[s.player_id]) scorerMap[s.player_id] = { goals: 0, assists: 0 };
          scorerMap[s.player_id].goals += (s.goals || 0);
          scorerMap[s.player_id].assists += (s.assists || 0);
        });
        const topScorers = Object.entries(scorerMap)
          .map(([pid, stats]) => {
            const p = tp.find(pl => pl.id === pid);
            return p ? { name: `${p.first_name} ${p.last_name}`, ...stats } : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.goals - a.goals)
          .slice(0, 3);

        return {
          id: team.id,
          name: team.name,
          category: getCategoryLabel(team.category),
          coach: team.coach || "—",
          season: team.season || "—",
          fcf_group_url: team.fcf_group_url || null,
          playerCount: tp.length,
          activePlayers: tp.filter(p => p.status === "activo").length,
          injuredPlayers: tp.filter(p => p.status === "lesionado").length,
          matchesPlayed: new Set(ts.map(s => s.date + s.opponent)).size,
          totalGoals,
          totalAssists,
          totalYellow,
          totalRed,
          attendanceRate,
          avgRating,
          topScorers,
        };
      });

      // Generate executive summary via LLM
      const summaryPrompt = `Eres el analista deportivo del club. Genera un resumen ejecutivo profesional en español basado en estos datos de la temporada:

EQUIPOS ANALIZADOS:
${JSON.stringify(teamSummaries, null, 2)}

El resumen debe incluir:
1. Una introducción general del estado del club (2-3 frases)
2. Para cada equipo: rendimiento destacado, puntos fuertes y áreas de mejora
3. Conclusión con recomendaciones generales (2-3 frases)

Tono: profesional pero cercano, propio de un informe deportivo interno.
Longitud: conciso pero completo (máx 400 palabras).`;

      const summary = await base44.integrations.Core.InvokeLLM({ prompt: summaryPrompt });

      setReportData({
        generatedAt: new Date().toISOString(),
        teams: teamSummaries,
        executiveSummary: summary,
        scope: selectedTeamId === "all" ? "Club completo" : filteredTeams[0]?.name,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (reportData) generatePDF(reportData);
  };

  const [activeTab, setActiveTab] = useState("executive");
  
  // Check if tabs have content (using existing queries from above)
  const hasActivePlayers = players.filter(p => p.status !== "baja").length > 0;
  const hasPDIData = matchStats.length > 0 || attendance.length > 0;
  const hasProgressionData = players.length > 0; // Always show if there are players

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>Herramientas</p>
        <h1>Informes</h1>
        <p className="text-gray-400 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-display)" }}>Informes del club y jugadores</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded flex-wrap" style={{ width: "fit-content" }}>
        <button
          onClick={() => setActiveTab("executive")}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors ${activeTab === "executive" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <FileText className="w-4 h-4" /> Informe Ejecutivo
        </button>
        <button
          onClick={() => setActiveTab("monthly")}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors ${activeTab === "monthly" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Users className="w-4 h-4" /> Informes Mensuales
        </button>
        {hasPDIData && hasActivePlayers && (
          <button
            onClick={() => setActiveTab("pdi")}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors ${activeTab === "pdi" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <BookOpen className="w-4 h-4" /> Informes PDI
          </button>
        )}
        {hasProgressionData && hasActivePlayers && (
          <button
            onClick={() => setActiveTab("progression")}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors ${activeTab === "progression" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            <TrendingUp className="w-4 h-4" /> Progresión Individual
          </button>
        )}
      </div>

      {activeTab === "monthly" && <MonthlyReportSection />}
      {activeTab === "pdi" && <PDIReportSection />}
      {activeTab === "progression" && <ProgressionReportSection />}

      {activeTab === "executive" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="mb-4">Configurar informe</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-gray-700">Ámbito del informe</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger className="border-gray-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo el club</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="text-white shrink-0 px-6 py-2.5 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                style={{ background: "var(--granate)" }}
                size="lg"
              >
                {isGenerating ? (
                  <><Loader2 className="w-5 h-5 mr-2.5 animate-spin" /> Generando...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2.5" /> Generar informe con IA</>
                )}
              </Button>
              {reportData && (
                <Button variant="outline" onClick={handleDownloadPDF} className="shrink-0">
                  <Download className="w-4 h-4 mr-2" /> Descargar PDF
                </Button>
              )}
            </div>
          </div>

          {isGenerating && (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "var(--granate)" }} />
              <p className="text-gray-600 font-medium">Analizando datos y generando resumen...</p>
              <p className="text-gray-400 text-sm mt-1">Esto puede tardar unos segundos</p>
            </div>
          )}

          {reportData && !isGenerating && (
            <ReportPreview data={reportData} onDownload={handleDownloadPDF} />
          )}

          {!reportData && !isGenerating && (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Selecciona el ámbito y genera tu informe</p>
              <p className="text-gray-400 text-sm mt-1">El informe incluirá estadísticas de jugadores, partidos y asistencia</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}