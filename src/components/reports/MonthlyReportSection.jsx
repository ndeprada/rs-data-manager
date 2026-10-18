import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Download, Mail, AlertCircle, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { downloadPlayerPDF } from "./playerPdfGenerator";
import { playerFullName } from "@/lib/playerName";
import { useCountedStats } from "@/lib/matchStatus";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: format(new Date(2000, i, 1), "MMMM", { locale: es }),
}));

const YEARS = Array.from({ length: new Date().getFullYear() - 2023 }, (_, i) => 2024 + i).map((y) => ({ value: String(y), label: String(y) }));

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

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const { data: raw_matchStats = [] } = useQuery({ queryKey: ["matchStats"], queryFn: () => base44.entities.MatchStats.list("-date", 500) });
  const matchStats = useCountedStats(raw_matchStats);
  const { data: attendance = [] } = useQuery({ queryKey: ["attendance"], queryFn: () => base44.entities.TrainingAttendance.list("-date", 1000) });

  const teamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return players.filter((p) => p.team_id === selectedTeam && p.status !== "baja");
  }, [players, selectedTeam]);

  const team = teams.find((t) => t.id === selectedTeam);

  // Abre el correo del usuario con un resumen del mes (el PDF se descarga aparte y se adjunta a mano):
  // la app no envía emails por sí misma.
  const mailtoFor = (player, stats, att) => {
    const periodLabel = format(new Date(parseInt(year), parseInt(month) - 1, 1), "MMMM yyyy", { locale: es });
    const goals = stats.reduce((a, x) => a + (x.goals || 0), 0);
    const assists = stats.reduce((a, x) => a + (x.assists || 0), 0);
    const present = att.filter((a) => a.status === "present" || a.status === "apart").length;
    const attRate = att.length > 0 ? Math.round((present / att.length) * 100) : null;
    const body = `Estimado/a ${player.guardian_name || "tutor/a"},\n\nLe enviamos el resumen de ${periodLabel} de ${playerFullName(player)} (${team?.name || ""}):\n\n• Partidos jugados: ${stats.length}\n• Goles / asistencias: ${goals} / ${assists}${attRate !== null ? `\n• Asistencia a entrenos: ${attRate}%` : ""}\n\n(Adjuntamos el informe completo en PDF.)\n\nUn saludo,\nRacing Sarrià`;
    return `mailto:${player.guardian_email}?subject=${encodeURIComponent(`Informe mensual de ${playerFullName(player)} — ${periodLabel}`)}&body=${encodeURIComponent(body)}`;
  };

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
        </div>
      </div>

      <p className="text-xs text-gray-400 -mt-3">Descarga el PDF de cada jugador y envíalo a su familia: el botón Email abre tu correo con el resumen preparado (la app no envía emails por sí misma).</p>

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
                      {playerFullName(player)}
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
                      <a
                        href={mailtoFor(player, stats, att)}
                        className="inline-flex items-center gap-1 px-3 h-8 text-xs font-medium rounded border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                        title="Abre tu correo con el resumen preparado; adjunta el PDF descargado"
                      >
                        <Mail className="w-3.5 h-3.5" /> Email
                      </a>
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