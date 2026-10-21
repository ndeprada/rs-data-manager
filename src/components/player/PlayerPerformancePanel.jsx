import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Trophy, Star, AlertTriangle } from "lucide-react";
import { useCountedStats } from "@/lib/matchStatus";
import { usePlayerMode } from "@/lib/playerMode";
import { eventMinutes } from "@/lib/matchDuration";
import { participationOf, minutesAlerts, playerLevel } from "@/lib/participation";
import { useParticipationContext } from "@/lib/useParticipation";
import { ReasonChips, FormatPills, FORMAT_OPTIONS, PctPill, alertText } from "@/components/stats/ParticipationBits";
import { useT, useFormat } from "@/i18n";

function StatBox({ label, value, sub, color = "gray" }) {
  const colors = {
    granate: "bg-red-50 border-red-100 text-red-800",
    green: "bg-green-50 border-green-100 text-green-800",
    blue: "bg-blue-50 border-blue-100 text-blue-800",
    yellow: "bg-yellow-50 border-yellow-100 text-yellow-800",
    orange: "bg-orange-50 border-orange-100 text-orange-800",
    gray: "bg-gray-50 border-gray-200 text-gray-800",
  };
  return (
    <div className={`rounded-2xl border p-4 text-center shadow-sm ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniRow({ title, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <p className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
      <div className="flex-1 flex flex-wrap gap-x-5 gap-y-1.5">{children}</div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-bold text-gray-900 leading-none">{value}</span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

function StarRating({ value }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </span>
  );
}

export default function PlayerPerformancePanel({ playerId }) {
  const t = useT();
  const loc = useFormat();
  const { data: raw_stats = [] } = useQuery({
    queryKey: ["matchstats", playerId],
    queryFn: () => base44.entities.MatchStats.filter({ player_id: playerId }, "date"),
  });
  const stats = useCountedStats(raw_stats);

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", playerId],
    queryFn: () => base44.entities.TrainingAttendance.filter({ player_id: playerId }, "date"),
  });

  const { data: convocatorias = [] } = useQuery({
    queryKey: ["convocatorias"],
    queryFn: () => base44.entities.Convocatoria.list(),
  });

  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });

  const misConvocatorias = convocatorias.filter(
    (c) => Array.isArray(c.player_ids) && c.player_ids.includes(playerId)
  );
  const totalConvocatorias = misConvocatorias.length;

  const playerMode = usePlayerMode();

  // Participación en los partidos cerrados de liga: titular, suplente, no convocado (y por qué), minutos y alertas
  const partCtx = useParticipationContext("liga");
  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });
  const me = allPlayers.find((p) => p.id === playerId);
  const part = useMemo(() => (me ? participationOf(me, partCtx) : null), [me, partCtx]);
  const [fmt, setFmt] = useState("all");
  const hasFmt = (k) => !!part && part[k].conv + part[k].noConv > 0;
  const fmtOptions = FORMAT_OPTIONS.filter((o) => o.value === "all" || hasFmt(o.value));
  const fmtSel = fmtOptions.some((o) => o.value === fmt) ? fmt : "all";
  const pb = part ? part[fmtSel] : null;
  const level = part ? playerLevel(part, fmtSel) : null;
  const alerts = part ? minutesAlerts(part).filter((a) => fmtSel === "all" || a.format === fmtSel) : [];
  const partidos = stats.length;
  const titular = stats.filter((s) => s.starter !== false).length;
  const suplente = stats.filter((s) => s.starter === false).length;
  const totalMins = stats.reduce((s, r) => s + (r.minutes_played || 0), 0);
  // Minutos posibles = suma de la duración de cada partido al que fue convocado (cada categoría juega lo suyo)
  const maxMins = misConvocatorias.reduce((sum, c) => {
    const ev = events.find((e) => e.id === c.event_id);
    return sum + eventMinutes(ev, teams.find((t) => t.id === (ev?.team_id || c.team_id)));
  }, 0);
  const minsPct = maxMins > 0 ? Math.round((totalMins / maxMins) * 100) : 0;
  const totalGoals = stats.reduce((s, r) => s + (r.goals || 0), 0);
  const totalAssists = stats.reduce((s, r) => s + (r.assists || 0), 0);
  const totalYellow = stats.reduce((s, r) => s + (r.yellow_cards || 0), 0);
  const totalDoubleYellow = stats.reduce((s, r) => s + (r.double_yellow_card || 0), 0);
  const totalRed = stats.reduce((s, r) => s + (r.red_cards || 0), 0);
  const ratedStats = stats.filter((r) => r.rating);
  const avgRating = ratedStats.length > 0
    ? (ratedStats.reduce((s, r) => s + r.rating, 0) / ratedStats.length).toFixed(1)
    : null;

  // Build chart data per month
  const monthMap = {};
  stats.forEach((s) => {
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { month: key, ratings: [], partidos: 0 };
    monthMap[key].partidos += 1;
    if (s.rating) monthMap[key].ratings.push(s.rating);
  });

  attendance.forEach((a) => {
    const d = new Date(a.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { month: key, ratings: [], partidos: 0 };
    if (!monthMap[key].attendanceData) monthMap[key].attendanceData = { present: 0, total: 0 };
    monthMap[key].attendanceData.total += 1;
    if (a.status !== "absent") monthMap[key].attendanceData.present += 1;
  });

  const chartData = Object.keys(monthMap).sort().map((key) => {
    const m = monthMap[key];
    const label = new Date(key + "-01").toLocaleDateString(loc.tag, { month: "short", year: "2-digit" });
    const avgR = m.ratings.length > 0
      ? parseFloat((m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length).toFixed(1))
      : null;
    const attPct = m.attendanceData
      ? Math.round((m.attendanceData.present / m.attendanceData.total) * 100)
      : null;
    return { label, rating: avgR, asistencia: attPct };
  }).filter((d) => d.rating !== null || d.asistencia !== null);

  return (
    <div className="space-y-6">
      {/* Resumen compacto de estadísticas */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm divide-y divide-gray-100">
        {!playerMode && pb ? (
          <>
            {fmtOptions.length > 2 && (
              <div className="px-4 py-2"><FormatPills value={fmt} onChange={setFmt} options={fmtOptions} /></div>
            )}
            <MiniRow title={t("Participación")}>
              <Mini label={t("Convoc.")} value={pb.conv} />
              <Mini label={t("Jugó")} value={pb.played} />
              <Mini label={t("Titular")} value={pb.titular} />
              <Mini label={pb.suplenteSin > 0 ? t("Suplente ({n} sin jugar)", { n: pb.suplenteSin }) : t("Suplente")} value={pb.suplente} />
              <Mini label={t("No convocado")} value={pb.noConv} />
            </MiniRow>
            {pb.noConv > 0 && (
              <MiniRow title={t("Ausencias")}><ReasonChips reasons={pb.reasons} /></MiniRow>
            )}
            <MiniRow title={t("Minutos")}>
              <Mini label={t("Totales")} value={`${pb.mins}'`} />
              <Mini label={t("partidos disponibles (de {n})", { n: pb.totalMatches })} value={pb.availMatches} />
            </MiniRow>
            <MiniRow title={t("% y media")}>
              <Mini label={t("de {n}' disponibles", { n: pb.availMin })} value={<PctPill value={pb.pctAvail} level={level} />} />
              <Mini label={t("media/part. disponible")} value={pb.avgAvail != null ? `${pb.avgAvail}'` : "—"} />
              <Mini label={t("de {n}' totales", { n: pb.totalMin })} value={pb.pctTotal != null ? `${pb.pctTotal}%` : "—"} />
              <Mini label={t("media/part. total")} value={pb.avgTotal != null ? `${pb.avgTotal}'` : "—"} />
            </MiniRow>
            {alerts.length > 0 && (
              <div className="px-4 py-2 bg-red-50 text-[11px] text-red-800 flex items-start gap-2 first:rounded-t-2xl last:rounded-b-2xl">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p><b>{t("Por debajo del mínimo de minutos.")}</b> {alerts.map(alertText).join(" · ")}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <MiniRow title={t("Participación")}>
              <Mini label={t("Convoc.")} value={totalConvocatorias} />
              <Mini label={t("Jugados")} value={partidos} />
              <Mini label={t("Titular")} value={titular} />
              <Mini label={t("Suplente")} value={suplente} />
            </MiniRow>
            <MiniRow title={t("Minutos")}>
              <Mini label={t("Totales")} value={`${totalMins}'`} />
              <Mini label={t("de {n}'", { n: maxMins })} value={`${minsPct}%`} />
              <Mini label={t("Media/partido")} value={partidos > 0 ? `${Math.round(totalMins / partidos)}'` : "—"} />
            </MiniRow>
          </>
        )}
        <MiniRow title={t("Ofensiva")}>
          <Mini label={t("Goles")} value={totalGoals} />
          <Mini label={t("Asist.")} value={totalAssists} />
          <Mini label={t("G+A/partido")} value={partidos > 0 ? ((totalGoals + totalAssists) / partidos).toFixed(2) : "—"} />
          {!playerMode && <Mini label={t("Valoración")} value={avgRating ? `${avgRating} ★` : "—"} />}
        </MiniRow>
        <MiniRow title={t("Disciplina")}>
          <Mini label={t("🟨 Amarillas")} value={totalYellow} />
          <Mini label={t("🟨🟨 Doble am.")} value={totalDoubleYellow} />
          <Mini label={t("🟥 Rojas")} value={totalRed} />
        </MiniRow>
      </div>

      {/* Gráfica evolución */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">{t("Evolución a lo largo de la temporada")}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis yAxisId="rating" hide={playerMode} domain={[0, 3]} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis yAxisId="asistencia" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(value, name) => name === t("Valoración (★)") ? [`${value} ★`, name] : [`${value}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {!playerMode && <Line yAxisId="rating" type="monotone" dataKey="rating" name={t("Valoración (★)")} stroke="#FF6E00" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />}
              <Line yAxisId="asistencia" type="monotone" dataKey="asistencia" name={t("Asistencia (%)")} stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm text-gray-400 text-sm flex items-center justify-center gap-2">
          <Trophy className="w-4 h-4 text-gray-300" />
          <p>{t("Registra partidos para ver la evolución del jugador")}</p>
        </div>
      )}
    </div>
  );
}