import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { todayStr } from "./sessionHelpers";
import {
  BLOCKS, PRIORITY, aggregateSessions, compareWithStage, fmtMin, hierarchyIssues, marginState, stageContents, stageInfo, stageOfTeamName,
} from "@/lib/sessionPlan";

const ALL = "__all";
const PERIODS = [
  { id: "season", label: "Toda la temporada" },
  { id: "30", label: "Últimos 30 días" },
  { id: "7", label: "Últimos 7 días" },
];

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-xl font-black leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

const sign = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n))}`;

export default function ContentControl({ teams, isCoordinator, defaultTeamId }) {
  const [teamId, setTeamId] = useState(defaultTeamId || "");
  const [coachId, setCoachId] = useState(ALL);
  const [period, setPeriod] = useState("season");
  const [openBlock, setOpenBlock] = useState(null);

  const { data: sessions = [], isLoading } = useQuery({ queryKey: ["coach_sessions"], queryFn: () => base44.entities.CoachSession.list("-date", 1000) });

  // Equipos con sesiones registradas (primero), para no empezar en un equipo vacío
  const withSessions = useMemo(() => new Set(sessions.map((s) => s.team_id)), [sessions]);
  const teamList = useMemo(() => [...teams].sort((a, b) => Number(withSessions.has(b.id)) - Number(withSessions.has(a.id))), [teams, withSessions]);
  const team = teams.find((t) => t.id === teamId) || teamList.find((t) => withSessions.has(t.id)) || teamList[0] || null;

  const coaches = useMemo(() => {
    const m = new Map();
    sessions.filter((s) => s.team_id === team?.id).forEach((s) => s.owner_id && m.set(s.owner_id, s.owner_name || "Entrenador"));
    return [...m.entries()];
  }, [sessions, team?.id]);

  const today = todayStr();
  const counted = useMemo(() => {
    const limit = period === "season" ? "" : (() => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - Number(period)); return d.toISOString().slice(0, 10); })();
    return sessions.filter((s) => s.team_id === team?.id && s.held !== false && s.date <= today && (!limit || s.date >= limit)
      && (!s.season || s.season === CURRENT_SEASON) && (coachId === ALL || s.owner_id === coachId));
  }, [sessions, team?.id, period, coachId, today]);

  const stage = (team && stageOfTeamName(team.name)) || counted.find((s) => s.stage)?.stage || null;
  const agg = useMemo(() => aggregateSessions(counted), [counted]);
  const rows = useMemo(() => compareWithStage(agg, stage), [agg, stage]);
  const issues = useMemo(() => hierarchyIssues(agg, stage), [agg, stage]);
  const contents = useMemo(() => stageContents(stage), [stage]);
  const info = stageInfo(stage);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={team?.id || ""} onValueChange={setTeamId}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Equipo" /></SelectTrigger>
          <SelectContent>{teamList.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{withSessions.has(t.id) ? "" : " (sin sesiones)"}</SelectItem>)}</SelectContent>
        </Select>
        {isCoordinator && coaches.length > 1 && (
          <Select value={coachId} onValueChange={setCoachId}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los entrenadores</SelectItem>
              {coaches.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p> : !team ? null : (
        <>
          <p className="text-[11px] text-gray-500">
            {info ? <>Etapa <b>{info.label}</b> ({info.teams}). </> : <span className="text-amber-600 font-semibold">No se reconoce la etapa de este equipo: elígela en cada sesión. </span>}
            Cuentan las sesiones ya hechas (hasta hoy) y marcadas como realizadas.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label="Sesiones" value={agg.sessions} sub={`${agg.tasks} tareas`} />
            <Tile label="Tiempo registrado" value={fmtMin(agg.total)} />
            <Tile label="Con contenido" value={agg.total ? `${Math.round((agg.withBlock / agg.total) * 100)}%` : "—"} sub={fmtMin(agg.withBlock)} />
            <Tile label="Sin contenido / fuera de currículum" value={fmtMin(agg.unclassified)} sub={`PF y activación: ${fmtMin(agg.noCurriculum)}`} />
          </div>

          {agg.sessions === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No hay sesiones registradas de este equipo en el periodo elegido.</div>
          ) : (
            <>
              {agg.unclassified > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Hay {fmtMin(agg.unclassified)} de tareas sin contenido principal elegido; no entran en ningún porcentaje.
                </div>
              )}

              <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-3 py-2.5 bg-gray-50/70"><h2 className="text-sm font-black uppercase tracking-wide" style={{ fontFamily: "var(--font-display)", color: "var(--granate)" }}>Tiempo por bloque frente a la referencia</h2></div>
                <div className="divide-y divide-gray-100">
                  {rows.map((r) => {
                    const b = BLOCKS.find((x) => x.id === r.block);
                    const st = agg.withBlock ? marginState(r.diff) : null;
                    const list = contents.filter((c) => c.block === r.block);
                    const open = openBlock === r.block;
                    if (!list.length && !r.minutes) return null;
                    return (
                      <div key={r.block}>
                        <button type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 grid grid-cols-[1rem_minmax(7rem,12rem)_1fr_auto] items-center gap-2" onClick={() => setOpenBlock(open ? null : r.block)}>
                          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          <span className="text-xs font-bold truncate" style={{ color: b.color }}>{b.short}</span>
                          <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
                            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, r.pct)}%`, background: b.color }} />
                            <div className="absolute inset-y-0 w-0.5 bg-gray-800/70" style={{ left: `${Math.min(100, r.target)}%` }} title={`Referencia: ${r.target}%`} />
                          </div>
                          <span className="text-xs tabular-nums whitespace-nowrap text-right min-w-[8.5rem]">
                            <b>{Math.round(r.pct)}%</b> <span className="text-gray-400">/ {r.target}%</span> <b style={{ color: st?.color }} title={st?.label}>{agg.withBlock ? sign(r.diff) : ""}</b> <span className="text-gray-400">· {fmtMin(r.minutes)}</span>
                          </span>
                        </button>
                        {open && (
                          <div className="px-3 pb-3 pl-8">
                            {list.length === 0 ? <p className="text-xs text-gray-400">Esta etapa no tiene contenidos en este bloque.</p> : (
                              <div className="rounded-lg border border-gray-100 divide-y divide-gray-100">
                                {list.map((c) => {
                                  const a = agg.contents[c.id] || { principal: 0, secondary: 0, tasks: 0 };
                                  const pr = PRIORITY[c.priority];
                                  const untouched = !a.principal && !a.secondary;
                                  return (
                                    <div key={c.id} className="grid grid-cols-[1.4rem_1fr_auto] items-center gap-2 px-2 py-1.5 text-xs">
                                      <span className="text-[9px] font-black rounded px-1 text-center" style={{ background: pr.bg, color: pr.color }} title={`Prioridad ${pr.label.toLowerCase()}`}>{pr.short}</span>
                                      <span className={untouched ? (c.priority === "A" ? "text-red-600 font-semibold" : "text-gray-400") : "font-semibold"}>{c.name}{untouched && c.priority === "A" ? " · sin trabajar" : ""}</span>
                                      <span className="tabular-nums whitespace-nowrap text-gray-600">
                                        {a.principal > 0 && <b className="text-[var(--granate)]">{fmtMin(a.principal)}</b>}
                                        {a.secondary > 0 && <span className="text-gray-500"> {a.principal > 0 ? "+ " : ""}{fmtMin(a.secondary)} sec.</span>}
                                        {untouched && "—"}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="px-3 py-2 text-[10px] text-gray-400 border-t border-gray-100">
                  Línea oscura = % de referencia de la etapa. Desviación: <b style={{ color: "#16a34a" }}>±5 correcta</b> · <b style={{ color: "#d97706" }}>±5 a ±10 a justificar</b> · <b style={{ color: "#dc2626" }}>más de ±10 revisar</b>. El % se calcula sobre el tiempo que tiene contenido.
                </div>
              </section>

              {issues.length > 0 && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <h3 className="text-xs font-black uppercase tracking-wide text-amber-800 mb-1">Jerarquía de prioridades</h3>
                  <ul className="space-y-1 text-xs text-amber-800 list-disc pl-4">{issues.map((i, k) => <li key={k}>{i.text}</li>)}</ul>
                  <p className="text-[10px] text-amber-700/80 mt-1.5">La prioridad alta debería llevar siempre más tiempo que la media, y esta más que la baja, dentro de cada bloque.</p>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
