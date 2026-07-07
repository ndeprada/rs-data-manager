import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Download, Mail, Send, CheckCircle2, AlertCircle, Loader2, Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, getMonth, getYear, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { downloadPlayerPDF, generatePlayerPDF } from "./playerPdfGenerator";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: format(new Date(2000, i, 1), "MMMM", { locale: es }),
}));

const YEARS = [2024, 2025, 2026].map((y) => ({ value: String(y), label: String(y) }));

function getPlayerStats(player, matchStats, attendance, month, year) {
  const stats = matchStats.filter((s) => {
    if (s.player_id !== player.id) return false;
    const d = new Date(s.date);
    return getMonth(d) + 1 === month && getYear(d) === year;
  });
  const att = attendance.filter((a) => {
    if (a.player_id !== player.id) return false;
    const d = new Date(a.date);
    return getMonth(d) + 1 === month && getYear(d) === year;
  });
  return { stats, att };
}

export default function MonthlyReportSection() {
  const now = new Date();
  const [selectedTeam, setSelectedTeam] = useState("");
  const [month, setMonth] = useState(String(getMonth(now) === 0 ? 12 : getMonth(now)));
  const [year, setYear] = useState(String(getMonth(now) === 0 ? getYear(now) - 1 : getYear(now)));
  const [sendStatus, setSendStatus] = useState({});
  const [isSendingAll, setIsSendingAll] = useState(false);

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 500) });
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list("-date", 1000) });

  const teamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return players.filter((p) => p.team_id === selectedTeam && p.status !== "baja");
  }, [players, selectedTeam]);

  const team = teams.find((t) => t.id === selectedTeam);

  const sendPlayerReport = async (player) => {
    if (!player.guardian_email) return;
    const m = parseInt(month);
    const y = parseInt(year);
    const { stats, att } = getPlayerStats(player, matchStats, attendance, m, y);
    const periodLabel = format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: es });

    setSendStatus((prev) => ({ ...prev, [player.id]: "sending" }));

    // Generate PDF blob and upload
    const doc = generatePlayerPDF(player, team, stats, att, m, y);
    const pdfBlob = doc.output("blob");
    const pdfFile = new File([pdfBlob], `informe_${player.first_name}_${player.last_name}_${y}-${String(m).padStart(2, "0")}.pdf`, { type: "application/pdf" });

    let pdfUrl = null;
    try {
      const uploaded = await base44.integrations.Core.UploadFile({ file: pdfFile });
      pdfUrl = uploaded.file_url;
    } catch (e) {
      // continue without link
    }

    const totalGoals = stats.reduce((a, s) => a + (s.goals || 0), 0);
    const totalAssists = stats.reduce((a, s) => a + (s.assists || 0), 0);
    const present = att.filter((a) => a.status === "present" || a.status === "apart").length;
    const attRate = att.length > 0 ? Math.round((present / att.length) * 100) : null;
    const ratingStats = stats.filter((s) => s.rating);
    const avgRating = ratingStats.length > 0
      ? (ratingStats.reduce((a, s) => a + s.rating, 0) / ratingStats.length).toFixed(1)
      : null;

    const emailBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: #8B1A2B; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Informe Mensual de Rendimiento</h1>
    <p style="color: rgba(255,255,255,0.7); margin: 6px 0 0; font-size: 14px;">${periodLabel} · ${team?.name || ""}</p>
  </div>
  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px 28px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 15px; margin-top: 0;">Estimado/a <strong>${player.guardian_name || "tutor/a"}</strong>,</p>
    <p style="color: #555; font-size: 14px; line-height: 1.6;">
      Le enviamos el informe mensual de rendimiento de <strong>${player.first_name} ${player.last_name}</strong> correspondiente a <strong>${periodLabel}</strong>.
    </p>

    <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 14px; color: #8B1A2B; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Resumen del Mes</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #888;">Partidos jugados</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${stats.length}</td>
        </tr>
        <tr style="background: white;">
          <td style="padding: 6px 8px; color: #888;">Goles / Asistencias</td>
          <td style="padding: 6px 8px; font-weight: 600; text-align: right;">${totalGoals} / ${totalAssists}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #888;">Asistencia a entrenamientos</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${att.length > 0 ? `${attRate}% (${present}/${att.length})` : "Sin datos"}</td>
        </tr>
        ${avgRating ? `<tr style="background: white;"><td style="padding: 6px 8px; color: #888;">Valoración media</td><td style="padding: 6px 8px; font-weight: 600; text-align: right;">${avgRating}/10</td></tr>` : ""}
      </table>
    </div>

    ${pdfUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${pdfUrl}" style="background: #8B1A2B; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
        📄 Descargar Informe PDF
      </a>
    </div>
    ` : ""}

    <p style="color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
      Este informe ha sido generado automáticamente por el sistema RS Data Manager del club.<br>
      Para cualquier consulta, contacte con el entrenador del equipo.
    </p>
  </div>
</div>
    `.trim();

    await base44.integrations.Core.SendEmail({
      to: player.guardian_email,
      subject: `Informe mensual de ${player.first_name} ${player.last_name} — ${periodLabel}`,
      body: emailBody,
    });

    setSendStatus((prev) => ({ ...prev, [player.id]: "sent" }));
  };

  const handleSendAll = async () => {
    setIsSendingAll(true);
    const withEmail = teamPlayers.filter((p) => p.guardian_email);
    for (const player of withEmail) {
      await sendPlayerReport(player);
    }
    setIsSendingAll(false);
  };

  const withEmail = teamPlayers.filter((p) => p.guardian_email);
  const withoutEmail = teamPlayers.filter((p) => !p.guardian_email);

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="bg-white border border-gray-200 shadow-sm p-5" style={{ borderRadius: "4px" }}>
        <h2 className="font-bold text-base uppercase tracking-wide text-gray-800 mb-4" style={{ fontFamily: "var(--font-display)" }}>
          Configurar informe mensual
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">Equipo</Label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-48 border-gray-200 bg-white"><SelectValue placeholder="Seleccionar equipo" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">Mes</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36 border-gray-200 bg-white capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">Año</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24 border-gray-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedTeam && withEmail.length > 0 && (
            <Button
              onClick={handleSendAll}
              disabled={isSendingAll}
              className="text-white ml-auto"
              style={{ background: "var(--granate)" }}
            >
              {isSendingAll
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando todos...</>
                : <><Send className="w-4 h-4 mr-2" /> Enviar a todos ({withEmail.length})</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* Players list */}
      {selectedTeam && teamPlayers.length === 0 && (
        <div className="bg-white border border-gray-200 p-10 text-center text-gray-400 shadow-sm" style={{ borderRadius: "4px" }}>
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No hay jugadores en este equipo</p>
        </div>
      )}

      {selectedTeam && teamPlayers.length > 0 && (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden" style={{ borderRadius: "4px" }}>
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400" style={{ fontFamily: "var(--font-display)" }}>
              {teamPlayers.length} jugadores · {format(new Date(parseInt(year), parseInt(month) - 1, 1), "MMMM yyyy", { locale: es })}
            </p>
            {withoutEmail.length > 0 && (
              <p className="text-xs text-orange-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {withoutEmail.length} sin email de tutor
              </p>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {teamPlayers.map((player) => {
              const m = parseInt(month);
              const y = parseInt(year);
              const { stats, att } = getPlayerStats(player, matchStats, attendance, m, y);
              const present = att.filter((a) => a.status === "present" || a.status === "apart").length;
              const attRate = att.length > 0 ? Math.round((present / att.length) * 100) : null;
              const totalGoals = stats.reduce((a, s) => a + (s.goals || 0), 0);
              const status = sendStatus[player.id];

              return (
                <div key={player.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: "var(--granate)" }}
                  >
                    {player.first_name?.[0]}{player.last_name?.[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {player.first_name} {player.last_name}
                      {player.jersey_number && <span className="text-gray-400 font-normal ml-1">#{player.jersey_number}</span>}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      {player.guardian_name && <span>Tutor: {player.guardian_name}</span>}
                      {player.guardian_email
                        ? <span className="text-green-600">{player.guardian_email}</span>
                        : <span className="text-orange-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Sin email de tutor</span>
                      }
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400 shrink-0">
                    <span>{stats.length} partidos</span>
                    <span>{totalGoals} goles</span>
                    {attRate !== null && <span>{attRate}% asist.</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => downloadPlayerPDF(player, team, stats, att, m, y)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Descargar PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {player.guardian_email && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendPlayerReport(player)}
                        disabled={status === "sending" || status === "sent"}
                        className={`text-xs h-8 ${status === "sent" ? "border-green-300 text-green-600 bg-green-50" : ""}`}
                      >
                        {status === "sending" && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                        {status === "sent" && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                        {!status && <Mail className="w-3.5 h-3.5 mr-1" />}
                        {status === "sent" ? "Enviado" : status === "sending" ? "Enviando..." : "Enviar"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}