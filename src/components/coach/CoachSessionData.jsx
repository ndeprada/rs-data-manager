import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/i18n";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { TRAINING_TYPES } from "@/lib/trainingStatus";
import { isCancelled } from "@/lib/eventCancel";
import { stageOfTeamName, stageInfo, blockInfo, fmtMin } from "@/lib/sessionPlan";
import { sinceDate, coachIndicators } from "@/lib/coachMethod";

const FONT = { fontFamily: "var(--font-display)" };
const PERIODS = [
  { id: "season", label: "Toda la temporada" },
  { id: "30", label: "Últimos 30 días" },
  { id: "7", label: "Últimos 7 días" },
];

const dayOf = (v) => String(v || "").slice(0, 10);
const todayStr = () => format(new Date(), "yyyy-MM-dd");
const endedByNow = (ev) => {
  const end = ev.end_date ? new Date(ev.end_date) : new Date(new Date(ev.date).getTime() + 2 * 3600 * 1000);
  return end < new Date();
};

function Tile({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">{label}</p>
      <p className="text-xl font-black leading-tight" style={{ ...FONT, color: color || "var(--granate)" }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 leading-snug">{sub}</p>}
    </div>
  );
}

// Datos de las sesiones que registra el entrenador (indicadores automáticos, solo coordinación/administración). Se muestra dentro del área Metodología de la 360.
export default function SessionData({ ownerUserId, teamIds }) {
  const t = useT();
  const [teamId, setTeamId] = useState("");
  const [period, setPeriod] = useState("season");

  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date") });
  const { data: allSessions = [], isLoading } = useQuery({
    queryKey: ["coach_sessions"], queryFn: () => base44.entities.CoachSession.list("-date", 1000), enabled: !!ownerUserId,
  });

  const today = todayStr();
  const from = sinceDate(period, today);
  const mine = useMemo(
    () => allSessions.filter((s) => s.owner_id === ownerUserId && s.held !== false && s.date <= today && (!s.season || s.season === CURRENT_SEASON)),
    [allSessions, ownerUserId, today]
  );
  const coachTeams = useMemo(() => teams.filter((x) => teamIds.includes(x.id)), [teams, teamIds]);
  const withSessions = useMemo(() => new Set(mine.map((s) => s.team_id)), [mine]);
  const team = coachTeams.find((x) => x.id === teamId) || coachTeams.find((x) => withSessions.has(x.id)) || coachTeams[0] || null;

  const stage = (team && stageOfTeamName(team.name)) || mine.find((s) => s.team_id === team?.id && s.stage)?.stage || null;
  const info = stageInfo(stage);
  const sessions = useMemo(() => mine.filter((s) => s.team_id === team?.id && (!from || s.date >= from)), [mine, team?.id, from]);
  const trainings = useMemo(
    () => events.filter((e) => e.team_id === team?.id && TRAINING_TYPES.includes(e.type) && !isCancelled(e) && e.date
      && dayOf(e.date) <= today && (!from || dayOf(e.date) >= from) && endedByNow(e)),
    [events, team?.id, from, today]
  );
  const ind = useMemo(() => coachIndicators({ sessions, trainings, stage }), [sessions, trainings, stage]);
  const nBlocks = ind.blocks.ok + ind.blocks.revisar + ind.blocks.alerta;
  const worst = ind.blocks.outside.slice(0, 2);
  const pctText = (p) => (p == null ? "—" : `${p} %`);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-black uppercase" style={{ ...FONT, color: "var(--granate)" }}>{t("Datos de sus sesiones")}</h3>
          <p className="text-xs text-gray-400">{t("Lo que el entrenador planifica y registra en la app. La observación recoge lo que hace en el campo.")}</p>
        </div>
        <div className="flex gap-2">
          {coachTeams.length > 1 && (
            <Select value={team?.id || ""} onValueChange={setTeamId}>
              <SelectTrigger className="w-44 h-8 text-xs border-gray-200"><SelectValue /></SelectTrigger>
              <SelectContent>{coachTeams.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44 h-8 text-xs border-gray-200"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map((p) => <SelectItem key={p.id} value={p.id}>{t(p.label)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {!ownerUserId ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">{t("Esta persona aún no tiene acceso a la app, así que no hay sesiones registradas.")}</div>
      ) : isLoading || !team ? (
        <p className="text-sm text-gray-400 py-4 text-center">{isLoading ? t("Cargando…") : t("Este entrenador no tiene equipos asignados.")}</p>
      ) : (
        <>
          <p className="text-[11px] text-gray-500">
            {info ? t("Etapa {stage} ({teams}).", { stage: info.label, teams: info.teams }) : <span className="text-amber-600 font-semibold">{t("No se reconoce la etapa de este equipo: no se compara con la referencia.")}</span>}
            {" "}{t("Cuentan las sesiones ya hechas y marcadas como realizadas.")}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Tile label={t("Sesiones registradas")} value={ind.trainings ? `${ind.withSession}/${ind.trainings}` : String(ind.sessions)}
              sub={ind.trainings ? t("{pct} de los entrenamientos", { pct: pctText(ind.pctSessions) }) : t("No hay entrenamientos celebrados en el periodo")} />
            <Tile label={t("Reparto por bloques")} value={nBlocks ? `${ind.blocks.ok}/${nBlocks}` : "—"}
              color={!nBlocks ? "#9ca3af" : ind.blocks.alerta ? "#dc2626" : ind.blocks.revisar ? "#d97706" : "#16a34a"}
              sub={!nBlocks ? t("Sin tiempo registrado con contenido") : worst.length
                ? worst.map((w) => `${blockInfo(w.block)?.short || w.block} ${w.diff > 0 ? "+" : "−"}${Math.abs(w.diff)}`).join(" · ")
                : t("Dentro del margen de la etapa")} />
            <Tile label={t("Jerarquía alta > media > baja")} value={!ind.hasData || !info ? "—" : ind.hierarchy ? String(ind.hierarchy) : t("Coherente")}
              color={!ind.hasData || !info ? "#9ca3af" : ind.hierarchy ? "#d97706" : "#16a34a"} sub={ind.hierarchy ? t("Avisos. Detalle en Metodología → Control de contenidos") : t("Detalle en Metodología → Control de contenidos")} />
            <Tile label={t("Tiempo registrado")} value={ind.hasData ? fmtMin(ind.minutes) : "—"} sub={t("Sesiones: {n} · Tareas: {m}", { n: ind.sessions, m: ind.tasks })} />
            <Tile label={t("Partido final")} value={ind.finalGame.sessions ? `${ind.finalGame.withFinal}/${ind.finalGame.sessions}` : "—"}
              sub={ind.finalGame.avgMin != null ? t("Media {min} ({pct} % de la sesión)", { min: fmtMin(ind.finalGame.avgMin), pct: ind.finalGame.avgPct }) : t("Sesiones con partido al final")} />
            <Tile label={t("Correcciones escritas")} value={pctText(ind.corrections.pct)}
              sub={ind.corrections.tasks ? t("Tareas: {n} de {m}", { n: ind.corrections.withText, m: ind.corrections.tasks }) : t("Tareas con correcciones")} />
            <Tile label={t("Parte inicial con técnica u hábitos")} value={pctText(ind.initial.pct)}
              sub={ind.initial.sessions ? t("Sesiones: {n} de {m}", { n: ind.initial.withTechHabits, m: ind.initial.sessions }) : t("Sesiones con parte inicial")} />
            <Tile label={t("Contenidos de la etapa")} value={pctText(ind.curriculum.pct)}
              sub={ind.curriculum.tasks ? (ind.curriculum.outside ? t("Tareas con contenido de otra etapa: {n}", { n: ind.curriculum.outside }) : t("Todo dentro del currículo")) : t("Tareas con contenido")} />
          </div>
          {!ind.hasData && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-500">{t("No hay sesiones registradas de este equipo en el periodo elegido.")}</div>
          )}
          <p className="text-[10px] text-gray-400">{t("Partido final = última tarea de la parte principal si es de tipo partido, minipartido o partido reducido.")}</p>
        </>
      )}
    </section>
  );
}
