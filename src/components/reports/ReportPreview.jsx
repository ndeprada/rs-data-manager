import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Trophy, Users, Target, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReportPreview({ data, onDownload }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 flex items-center justify-between" style={{ background: "var(--granate)" }}>
          <div className="flex items-center gap-4">
            <img
              src="https://media.base44.com/images/public/69b72e4f23c3602504953d0d/442c01da9_Escudo_Granate.png"
              alt="Escudo"
              className="w-14 h-14 object-contain"
            />
            <div className="text-white">
              <h2 className="text-xl font-bold">Informe Ejecutivo</h2>
              <p className="text-sm opacity-80">{data.scope} · {format(new Date(data.generatedAt), "d MMMM yyyy", { locale: es })}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onDownload} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>

        {/* Executive Summary */}
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full inline-block" style={{ background: "var(--granate)" }}></span>
            Resumen Ejecutivo
          </h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">{data.executiveSummary}</p>
        </div>
      </div>

      {/* Teams */}
      {data.teams.map((team) => (
        <div key={team.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{team.name}</h3>
              <p className="text-xs text-gray-400">{team.category} · Entrenador: {team.coach} · {team.season}</p>
            </div>
          </div>

          <div className="p-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatBox label="Jugadores" value={team.playerCount} sub={`${team.activePlayers} activos`} color="granate" />
              <StatBox label="Partidos" value={team.matchesPlayed || "—"} sub="jugados" color="naranja" />
              <StatBox label="Goles" value={team.totalGoals} sub={`${team.totalAssists} asist.`} color="blue" />
              <StatBox
                label="Asistencia"
                value={team.attendanceRate != null ? `${team.attendanceRate}%` : "—"}
                sub="entrenamientos"
                color="slate"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Cards/Rating */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Disciplina & Rendimiento</p>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span>
                    <span className="text-gray-700">{team.totalYellow} tarjetas amarillas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                    <span className="text-gray-700">{team.totalRed} rojas</span>
                  </div>
                </div>
                {team.avgRating && (
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">Valoración media: <strong>{team.avgRating}/10</strong></span>
                  </div>
                )}
                {team.injuredPlayers > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    <span className="text-gray-700">{team.injuredPlayers} jugador{team.injuredPlayers !== 1 ? "es" : ""} lesionado{team.injuredPlayers !== 1 ? "s" : ""}</span>
                  </div>
                )}
              </div>

              {/* Top scorers */}
              {team.topScorers?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Máximos Goleadores</p>
                  <div className="space-y-2">
                    {team.topScorers.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: i === 0 ? "var(--granate)" : "#9ca3af" }}>
                          {i + 1}
                        </span>
                        <span className="text-gray-900 flex-1">{s.name}</span>
                        <span className="text-gray-500">{s.goals}G · {s.assists}A</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatBox({ label, value, sub, color }) {
  const colors = {
    granate: { bg: "var(--granate-pale)", text: "var(--granate)" },
    naranja: { bg: "var(--naranja-pale)", text: "var(--naranja)" },
    blue: { bg: "#eff6ff", text: "#2563eb" },
    slate: { bg: "#f8fafc", text: "#475569" },
  };
  const c = colors[color] || colors.slate;
  return (
    <div className="rounded-xl p-4" style={{ background: c.bg }}>
      <p className="text-xs font-medium mb-1" style={{ color: c.text }}>{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}