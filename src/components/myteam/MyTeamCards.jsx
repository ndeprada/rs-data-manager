// Piezas de la pantalla Mi equipo (rediseño del 13/11/2026, maqueta «Maqueta Mi equipo · RS Manager» aprobada por Nacho).
// Cálculos puros en src/lib/myTeamStats.js; piezas comunes con el Panel en src/components/rs2/dashParts.jsx.
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, Home, Plane, User } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, startOfDay, differenceInCalendarDays } from "date-fns";
import { RS } from "@/components/rs2/kit";
import { Label, Big, Head, MoreLink, FormChips, Countdown, WIN, LOSS, DRAW } from "@/components/rs2/dashParts";
import { isCancelled, cancelText } from "@/lib/eventCancel";
import { playerFullName } from "@/lib/playerName";
import { scoreText, matchResult } from "@/lib/matchScore";
import { squadGroups, sortSquad, standingWindow, leaderGap } from "@/lib/myTeamStats";
import { topBy } from "@/lib/dashboardStats";
import { useT, useDateLocale, msg } from "@/i18n";

export const MATCH_TYPES = ["partido_amistoso", "partido_liga", "torneo"];
export const TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico", "sesion_teorica", "sesion_video"];
const TYPE_LABEL = { partido_liga: msg("Liga"), partido_amistoso: msg("Amistoso"), torneo: msg("Torneo") };
export const POS_LABEL = { portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB", mediocentro: "MC", interior: "INT", mediapunta: "MP", delantero_centro: "DC", extremo: "EXT" };
const LINE_LABEL = { porteros: msg("Porteros"), defensas: msg("Defensas"), medios: msg("Medios"), delanteros: msg("Delanteros"), sin: msg("Sin posición") };
const REASON = { lesion: msg("Lesión"), enfermo: msg("Enfermo"), sancion: msg("Sanción"), viaje: msg("Viaje"), estudios: msg("Estudios") };
export const matchLink = (e, tab) => `/MatchDetail?id=${e.id}&teamId=${e.team_id}${tab ? `&tab=${tab}` : ""}`;

const chipStyle = (bg, fg) => ({ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" });
const Chip = ({ bg, fg, children, title }) => <span style={chipStyle(bg, fg)} title={title}>{children}</span>;

// ── Pasos del partido en la banda (14/11/2026, Nacho: «ok ves con ello»): C · P con lo que llevan; A · V solo la letra hasta jugarse
const STEP_NAME = { convocatoria: ["C", msg("Convocatoria")], tactica: ["P", msg("Preparación")], acta: ["A", msg("Acta")], postpartido: ["V", msg("Postpartido")] };
function BandSteps({ steps, next }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center" style={{ gap: 6, marginTop: 2 }} data-testid="team-next-steps">
      {steps.map((s) => {
        const [letter, name] = STEP_NAME[s.key];
        const sub = s.sub ? t(s.sub.key, s.sub.vars) : "";
        const later = s.state === "todo";
        const sq = s.state === "done" ? { background: WIN, color: "#fff" } : s.state === "now" ? { background: RS.naranja, color: "#fff" } : { background: "rgba(255,255,255,.14)", color: "rgba(255,255,255,.6)" };
        return (
          <Link key={s.key} to={matchLink(next, s.key)} title={`${t(name)} · ${sub}`} data-state={s.state} data-testid={`team-next-step-${s.key}`}
            className="inline-flex items-center" style={{ gap: 6, padding: later ? 3 : "3px 10px 3px 3px", borderRadius: 999, background: later ? "transparent" : "rgba(255,255,255,.08)", fontSize: 11, color: "rgba(255,255,255,.88)", minWidth: 0 }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", ...sq }}>{letter}</span>
            {!later && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><b>{t(name)}</b> · {sub}</span>}
          </Link>
        );
      })}
    </div>
  );
}

// ── Próximo partido ─────────────────────────────────────────────────────────
export function NextMatchBand({ next, team, conv, squadSize, us, rival, out, canManage, steps }) {
  const t = useT();
  const dfl = useDateLocale();
  if (!next) return <section className="rs2-card flex items-center" style={{ padding: 18, fontSize: 13, color: RS.faint }} data-testid="team-next-none">{t("Sin partidos programados.")}</section>;
  const days = differenceInCalendarDays(new Date(next.date), new Date());
  const when = days <= 0 ? t("Hoy") : days === 1 ? t("Mañana") : t("En {n} días", { n: days });
  const called = (conv?.player_ids || []).length;
  const btn = { fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, color: "#fff" };
  const box = { background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "9px 12px", minWidth: 0 };
  const Side = ({ label, row }) => (
    <div style={box}>
      <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.65)" }}>{label}</div>
      {row ? (
        <>
          <div className="flex items-baseline" style={{ gap: 6, marginTop: 4 }}><Big color="#fff" size={24}>{row.pos}º</Big><span style={{ fontSize: 11, color: "rgba(255,255,255,.75)" }}>{t("{pts} pts", { pts: row.pts })}</span></div>
          <div style={{ marginTop: 6 }}><FormChips form={(row.form || []).slice().reverse().slice(-5)} /></div>
        </>
      ) : <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 6 }}>—</div>}
    </div>
  );
  return (
    <section className="rs2-band flex flex-wrap" style={{ padding: "14px 18px", gap: 18, borderRadius: 12 }} data-testid="team-next">
      <div className="flex flex-col" style={{ flex: "1 1 420px", minWidth: 0, gap: 9 }}>
        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.72)" }}>{t("Próximo partido")}</span>
          <span style={{ fontSize: 11, background: "rgba(255,255,255,.12)", padding: "2px 8px", borderRadius: 999 }}>{t(TYPE_LABEL[next.type] || "")}{next.fcf_jornada ? ` · ${t("Jornada {n}", { n: next.fcf_jornada })}` : ""}</span>
          <span style={{ fontSize: 11, fontWeight: 700, background: RS.naranja, padding: "2px 8px", borderRadius: 999 }}>{when}</span>
        </div>
        <div className="flex flex-wrap items-baseline" style={{ gap: 10 }}>
          <span className="rs2-display" style={{ fontSize: 30, color: "#fff" }}>{team?.name || next.title}</span>
          {next.opponent && <><span style={{ fontSize: 14, color: "rgba(255,255,255,.7)" }}>vs</span><span className="rs2-display" style={{ fontSize: 30, color: "#fff" }}>{next.opponent}</span></>}
        </div>
        <div className="flex flex-wrap" style={{ gap: "4px 16px", fontSize: 12, color: "rgba(255,255,255,.85)" }}>
          <span className="capitalize" style={{ fontWeight: 700 }}>{format(new Date(next.date), "EEE d MMM · HH:mm", { locale: dfl })}</span>
          {conv?.callup_time && <span>{t("Convocatoria {time}", { time: conv.callup_time })}</span>}
          {next.opponent && <span>{next.is_home === false ? t("Fuera") : t("En casa")}{next.location ? ` · ${next.location}` : ""}</span>}
          {!next.opponent && next.location && <span>{next.location}</span>}
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 2 }}>
          <Countdown date={next.date} />
          {canManage ? (
            <>
              <Link to={matchLink(next, "tactica")} style={{ ...btn, background: RS.naranja }} data-testid="team-next-prepare">{t("Preparar partido")}</Link>
              <Link to={matchLink(next, "convocatoria")} style={{ ...btn, background: "rgba(255,255,255,.12)" }} data-testid="team-next-conv">
                {called > 0 ? t("Convocatoria · {n} de {m}", { n: called, m: squadSize }) : t("Convocatoria")}
              </Link>
              {next.type === "partido_liga" && next.opponent && <Link to={`${matchLink(next, "tactica")}#rival-report`} style={{ ...btn, background: "rgba(255,255,255,.12)" }}>{t("Informe del rival")}</Link>}
            </>
          ) : <Link to={matchLink(next)} style={{ ...btn, background: "rgba(255,255,255,.12)" }}>{t("Ver partido")}</Link>}
        </div>
        {steps && <BandSteps steps={steps} next={next} />}
      </div>
      <div className="grid" style={{ flex: "0 1 340px", minWidth: 0, gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
        <Side label={t("Rival")} row={rival} />
        <Side label={t("Nosotros")} row={us} />
        <div style={{ ...box, gridColumn: "span 2", fontSize: 11, color: "rgba(255,255,255,.85)" }} data-testid="team-next-out">
          {out.length === 0 ? t("Toda la plantilla disponible") : (
            <>
              {t("No disponibles:")}{" "}
              {out.map((u, i) => (
                <span key={u.player.id}>{i > 0 && " · "}<b>{playerFullName(u.player)}</b> ({t(REASON[u.reason] || "Otro").toLowerCase()}{u.until ? `, ${t("vuelve {date}", { date: format(new Date(u.until), "d MMM", { locale: dfl }) })}` : ""})</span>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Tarjetas de datos ───────────────────────────────────────────────────────
const Kpi = ({ title, children, foot, testId }) => (
  <div className="rs2-card flex flex-col" style={{ flex: "1 1 160px", minWidth: 0, padding: "11px 14px", gap: 6 }} data-testid={testId}>
    <Label>{title}</Label>
    {children}
    {foot && <p style={{ fontSize: 11, color: RS.muted }}>{foot}</p>}
  </div>
);

export function KpiRow({ rec, standing, me, att, lowAtt, squad }) {
  const t = useT();
  const gap = me ? leaderGap(standing?.rows || [], standing?.ourTeamId) : null;
  const attColor = att.rate == null ? RS.faint : att.rate >= 80 ? WIN : att.rate >= 60 ? "#B45309" : LOSS;
  return (
    <div className="flex flex-wrap" style={{ gap: 12 }}>
      <Kpi title={t("Temporada")} testId="team-season" foot={rec.n ? t("Goles {gf} a favor · {ga} en contra", { gf: rec.gf, ga: rec.ga }) : t("Todavía no hay resultados.")}>
        <div className="flex items-baseline" style={{ gap: 6 }}>
          <Big color={WIN}>{rec.w}</Big><span style={{ fontSize: 10, color: RS.muted }}>{t("V")}</span>
          <Big color={RS.muted}>{rec.d}</Big><span style={{ fontSize: 10, color: RS.muted }}>{t("E")}</span>
          <Big color={LOSS}>{rec.l}</Big><span style={{ fontSize: 10, color: RS.muted }}>{t("D")}</span>
          {rec.n > 0 && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: RS.ink }}>{t("{pct} % victorias", { pct: rec.winPct })}</span>}
        </div>
        {rec.n > 0 && (
          <div className="flex" style={{ height: 6, borderRadius: 3, overflow: "hidden" }} aria-hidden="true">
            <span style={{ flex: rec.w, background: WIN }} /><span style={{ flex: rec.d, background: "#C9BFC0" }} /><span style={{ flex: rec.l, background: LOSS }} />
          </div>
        )}
      </Kpi>
      <Kpi title={t("Clasificación")} testId="team-standing-kpi"
        foot={!me ? (standing?.available === false ? t("Sin datos de la FCF") : null) : gap?.leader ? t("A {n} pts del líder ({team})", { n: gap.gap, team: gap.leader.team }) : gap?.second ? t("Líder · {n} pts sobre el 2º", { n: gap.lead }) : null}>
        <div className="flex items-baseline" style={{ gap: 8 }}>
          <Big>{me ? `${me.pos}º` : "—"}</Big>
          {me && <span style={{ fontSize: 12, color: RS.muted }}>{t("{pts} pts", { pts: me.pts })}{Number(me.pj) > 0 ? ` · ${t("{n} por partido", { n: (me.pts / me.pj).toFixed(2).replace(".", ",") })}` : ""}</span>}
        </div>
        {me && <FormChips form={(me.form || []).slice().reverse().slice(-5)} />}
      </Kpi>
      <Kpi title={t("Asistencia · 30 días")} testId="team-attendance"
        foot={lowAtt.length ? t("Más bajos: {list}", { list: lowAtt.map((x) => `${x.name} ${x.rate} %`).join(" · ") }) : null}>
        <div className="flex items-baseline" style={{ gap: 8 }}>
          <Big color={att.rate == null ? RS.faint : RS.granate}>{att.rate == null ? "—" : `${att.rate} %`}</Big>
          {att.trend != null && att.trend !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: att.trend > 0 ? WIN : LOSS }}>{att.trend > 0 ? "▲" : "▼"} {t("{n} pts", { n: Math.abs(att.trend) })}</span>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: RS.lineSoft }}><div style={{ width: `${att.rate || 0}%`, height: 6, borderRadius: 3, background: attColor }} /></div>
      </Kpi>
      <Kpi title={t("Plantilla")} testId="team-squad-kpi" foot={squad.guests ? (squad.guests === 1 ? t("1 jugador de otro equipo ha jugado con este equipo") : t("{n} jugadores de otros equipos han jugado con este equipo", { n: squad.guests })) : null}>
        <div className="flex items-baseline" style={{ gap: 8 }}><Big>{squad.total}</Big><span style={{ fontSize: 12, color: RS.muted }}>{t("jugadores")}</span></div>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          <Chip bg="#DCFCE7" fg={WIN}>{t("{n} disponibles", { n: squad.available })}</Chip>
          {squad.injured > 0 && <Chip bg="#FEE2E2" fg={LOSS}>{squad.injured === 1 ? t("1 lesionado") : t("{n} lesionados", { n: squad.injured })}</Chip>}
          {squad.sanctioned > 0 && <Chip bg="#FEF3C7" fg="#92400E">{squad.sanctioned === 1 ? t("1 sancionado") : t("{n} sancionados", { n: squad.sanctioned })}</Chip>}
          {squad.other > 0 && <Chip bg={RS.lineSoft} fg={RS.ink2}>{t("{n} por otros motivos", { n: squad.other })}</Chip>}
        </div>
      </Kpi>
    </div>
  );
}

// ── Semana del equipo ──────────────────────────────────────────────────────
export function TeamWeek({ events, attendance, pendingTr, canManage, onCreate, onEdit }) {
  const t = useT();
  const dfl = useDateLocale();
  const [offset, setOffset] = useState(0);
  const today = startOfDay(new Date());
  const start = addDays(startOfWeek(today, { weekStartsOn: 1 }), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const attBy = useMemo(() => {
    const m = new Map();
    for (const a of attendance) {
      if (!a.event_id || !a.status) continue;
      const x = m.get(a.event_id) || { n: 0, ok: 0 };
      x.n += 1; if (a.status === "present" || a.status === "apart") x.ok += 1;
      m.set(a.event_id, x);
    }
    return m;
  }, [attendance]);
  const kind = (e) => (MATCH_TYPES.includes(e.type) ? "match" : TRAINING_TYPES.includes(e.type) ? "training" : "other");
  const STY = { match: ["#FDF2F4", "#F1C9CF", RS.granate], training: [RS.head, RS.line, RS.ink2], other: ["#FFF7ED", "#FAD7B5", "#8A3A00"] };
  const navBtn = { padding: 3, borderRadius: 6, color: RS.granate };
  return (
    <section className="rs2-card" style={{ flex: "2 1 560px", minWidth: 0 }} data-testid="team-week">
      <Head
        title={offset === 0 ? t("Esta semana") : `${format(days[0], "d", { locale: dfl })}–${format(days[6], "d MMM", { locale: dfl })}`}
        right={(
          <>
            <button type="button" onClick={() => setOffset((o) => o - 1)} style={navBtn} aria-label={t("Semana anterior")} data-testid="team-week-prev"><ChevronLeft className="w-4 h-4" /></button>
            {offset !== 0 && <button type="button" onClick={() => setOffset(0)} style={{ fontSize: 12, fontWeight: 700, color: RS.granate }}>{t("Hoy")}</button>}
            <button type="button" onClick={() => setOffset((o) => o + 1)} style={navBtn} aria-label={t("Semana siguiente")} data-testid="team-week-next"><ChevronRight className="w-4 h-4" /></button>
          </>
        )}
      />
      <div style={{ overflowX: "auto" }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(7, minmax(96px, 1fr))", gap: 5, padding: 8 }}>
          {days.map((d) => {
            const evs = events.filter((e) => e.date && isSameDay(new Date(e.date), d)).sort((a, b) => new Date(a.date) - new Date(b.date));
            const isToday = isSameDay(d, today);
            return (
              <div key={d.toISOString()} className="flex flex-col min-w-0" style={{ gap: 5, padding: 5, borderRadius: 9, minHeight: 96, ...(isToday ? { background: "#FFF7ED", outline: `1.5px solid ${RS.naranja}` } : {}) }}>
                <p className="capitalize" style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", color: isToday ? RS.naranja : RS.muted }}>{format(d, "EEE d", { locale: dfl })}</p>
                {evs.map((e) => {
                  const k = kind(e), off = isCancelled(e);
                  const [bg, bd, fc] = STY[k];
                  const a = attBy.get(e.id);
                  const pend = pendingTr.has(e.id);
                  const body = (
                    <div style={{ background: off ? RS.soft : bg, border: `1px solid ${off ? RS.line : bd}`, borderRadius: 7, padding: "5px 7px", opacity: off ? 0.65 : 1, textAlign: "left" }}>
                      <p className={off ? "line-through" : ""} style={{ fontSize: 11, lineHeight: 1.25, color: fc }}>
                        <b>{format(new Date(e.date), "HH:mm")}</b> {k === "match" ? (e.opponent ? `vs ${e.opponent}` : e.title) : (e.title || t("Entrenamiento"))}
                      </p>
                      {k === "match" && e.opponent && <p style={{ fontSize: 10, color: RS.muted }}>{e.is_home === false ? t("Fuera") : t("En casa")}</p>}
                      {k !== "match" && e.location && <p className="truncate" style={{ fontSize: 10, color: RS.muted }}>{e.location}</p>}
                      {off && <p style={{ fontSize: 10, fontWeight: 700, color: RS.muted }}>{cancelText(e, t)}</p>}
                      {!off && k === "training" && a && <p style={{ fontSize: 10, fontWeight: 700, color: WIN }}>{a.ok}/{a.n} ✓</p>}
                      {!off && k === "training" && !a && pend && <p style={{ fontSize: 10, fontWeight: 700, color: RS.naranja }}>{t("Pasar lista")}</p>}
                    </div>
                  );
                  if (k === "match") return <Link key={e.id} to={matchLink(e)} className="block hover:brightness-95">{body}</Link>;
                  if (k === "training") return <Link key={e.id} to={`/MyTeam/Attendance?eventId=${e.id}`} className="block hover:brightness-95" data-testid={`team-week-ev-${e.id}`}>{body}</Link>;
                  return <button key={e.id} type="button" onClick={() => onEdit(e)} className="block w-full hover:brightness-95" data-testid={`team-week-ev-${e.id}`}>{body}</button>;
                })}
                {canManage && (
                  <button type="button" onClick={() => onCreate(d)} aria-label={t("Añadir evento el {day}", { day: format(d, "EEEE d", { locale: dfl }) })}
                    className="flex items-center justify-center hover:bg-white" style={{ flex: evs.length ? "0 0 22px" : 1, minHeight: 22, border: `1px dashed ${RS.line}`, borderRadius: 7, color: RS.faint }}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Clasificación corta ────────────────────────────────────────────────────
export function MiniStanding({ standing }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const rows = standing?.rows || [];
  const shown = all ? [...rows].sort((a, b) => a.pos - b.pos) : standingWindow(rows, standing?.ourTeamId, 5);
  return (
    <section className="rs2-card" style={{ flex: "1 1 300px", minWidth: 0 }} data-testid="team-standing">
      <Head title={t("Clasificación")} right={rows.length > 5 && <button type="button" onClick={() => setAll((v) => !v)} style={{ color: RS.granate, fontWeight: 600, fontSize: 12 }} data-testid="team-standing-all">{all ? t("Ver menos") : t("Ver completa →")}</button>} />
      {!rows.length ? <p style={{ padding: "12px 14px", fontSize: 12, color: RS.faint }}>{standing?.available === false ? t("Sin datos de la FCF") : t("Este equipo no tiene la clasificación de la FCF enlazada.")}</p> : (
        <>
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {shown.map((r) => {
                const us = r.teamId === standing.ourTeamId;
                return (
                  <tr key={r.teamId || r.pos} style={us ? { background: "var(--club-primary-soft)", fontWeight: 700 } : { borderTop: `1px solid ${RS.lineSoft}` }}>
                    <td style={{ padding: "5px 6px 5px 14px", width: 26, color: RS.muted }}>{r.pos}</td>
                    <td className="truncate" style={{ padding: "5px 6px", maxWidth: 150, color: us ? RS.granate : RS.ink }} title={r.team}>{r.team}</td>
                    <td style={{ padding: "5px 6px", color: RS.muted, textAlign: "right" }}>{r.pj}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700 }}>{r.pts}</td>
                    <td style={{ padding: "5px 14px 5px 6px", width: 92 }}><FormChips form={(r.form || []).slice().reverse().slice(-5)} size={14} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="truncate" style={{ padding: "6px 14px 10px", fontSize: 11, color: RS.muted }}>{[standing.competition, standing.group].filter(Boolean).join(" · ")}</p>
        </>
      )}
    </section>
  );
}

// ── Plantilla compacta ─────────────────────────────────────────────────────
const SORTS = [["pos", msg("Por posición")], ["dorsal", msg("Por dorsal")], ["minutos", msg("Más minutos")], ["goles", msg("Goleadores")]];
const SORT_KEY = "rs_team_squad_sort";

export function SquadCompact({ rows, outById, canManage, onAddPlayer }) {
  const t = useT();
  const dfl = useDateLocale();
  const [mode, setModeState] = useState(() => { try { return localStorage.getItem(SORT_KEY) || "pos"; } catch { return "pos"; } });
  const setMode = (m) => { setModeState(m); try { localStorage.setItem(SORT_KEY, m); } catch { /* sin almacenamiento */ } };
  const groups = mode === "pos" ? squadGroups(rows) : [{ key: "all", rows: sortSquad(rows, mode) }];
  const th = (h, right) => <th style={{ textAlign: right ? "right" : "left", padding: "6px 8px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, fontWeight: 700, borderBottom: `1px solid ${RS.line}`, whiteSpace: "nowrap" }}>{h}</th>;
  const td = { padding: "4px 8px", borderTop: `1px solid ${RS.lineSoft}` };
  const status = (r) => {
    const u = outById.get(r.p.id);
    if (r.injury || u?.reason === "lesion" || r.p.status === "lesionado") {
      const until = r.injury?.expected_return || u?.until;
      return <Chip bg="#FEE2E2" fg={LOSS} title={r.injury?.diagnosis || ""}>{t("Lesión")}{until ? ` · ${format(new Date(until), "d MMM", { locale: dfl })}` : ""}</Chip>;
    }
    if (u) return <Chip bg="#FEF3C7" fg="#92400E">{t(REASON[u.reason] || "Otro")}</Chip>;
    if (r.level === "alert") return <Chip bg={RS.lineSoft} fg={RS.ink2} title={t("Por debajo del mínimo de minutos del club")}>{t("Pocos minutos")}</Chip>;
    return null;
  };
  return (
    <section className="rs2-card" style={{ flex: "2 1 600px", minWidth: 0 }} data-testid="team-squad">
      <div className="flex flex-wrap items-center" style={{ gap: 10, padding: "9px 14px", borderBottom: `1px solid ${RS.lineSoft}` }}>
        <h2 style={{ margin: 0, borderLeft: `4px solid ${RS.naranja}`, paddingLeft: 8, lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: 20, lineHeight: 1.1, color: RS.granate }}>{t("Plantilla · {n}", { n: rows.length })}</span></h2>
        <div className="flex flex-wrap" style={{ gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }} role="group" aria-label={t("Ordenar")}>
          {SORTS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} data-testid={`team-squad-sort-${k}`}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: 0, fontWeight: mode === k ? 700 : 400, background: mode === k ? "#fff" : "none", color: mode === k ? RS.granate : RS.ink2, boxShadow: mode === k ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>{t(l)}</button>
          ))}
        </div>
        <div className="flex" style={{ marginLeft: "auto", gap: 6 }}>
          <Link to="/MyTeam/Squad" style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: `1px solid ${RS.line}`, color: RS.ink2 }}>{t("Tabla completa")}</Link>
          {canManage && <button type="button" onClick={onAddPlayer} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 8, background: RS.granate, color: "#fff" }} data-testid="team-add-player">+ {t("Jugador")}</button>}
        </div>
      </div>
      {rows.length === 0 ? <p style={{ padding: 18, fontSize: 13, color: RS.faint, textAlign: "center" }}>{t("No hay jugadores en este equipo")}</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>{th("#")}{th(t("Jugador"))}{th(t("Año"))}{th(t("Pos"))}{th(t("PJ"), 1)}{th(t("% min"), 1)}{th(t("G"), 1)}{th(t("A"), 1)}{th(t("Entrenos"), 1)}{th("")}</tr></thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.key}>
                  {g.label && <tr><td colSpan={10} style={{ padding: "8px 8px 3px", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: RS.granate }}>{t(LINE_LABEL[g.key])} · {g.rows.length}</td></tr>}
                  {g.rows.map((r) => {
                    const lowAtt = r.attPct != null && r.attPct < 70;
                    return (
                      <tr key={r.p.id} className="hover:bg-gray-50" data-testid={`team-squad-row-${r.p.id}`}>
                        <td style={{ ...td, width: 30 }}><span className="rs2-display tabular-nums" style={{ fontSize: 16, color: RS.granate }}>{r.p.jersey_number ?? "•"}</span></td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          <Link to={`/PlayerProfile?id=${r.p.id}`} className="flex items-center hover:underline" style={{ gap: 7, fontWeight: 700, color: RS.ink }}>
                            <span className="flex items-center justify-center overflow-hidden shrink-0" style={{ width: 22, height: 22, borderRadius: 6, background: RS.soft }}>
                              {r.p.photo_url ? <img src={r.p.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <User className="w-3 h-3" style={{ color: RS.faint }} />}
                            </span>
                            {playerFullName(r.p)}
                          </Link>
                        </td>
                        <td style={{ ...td, color: RS.muted }}>{r.year ?? "—"}</td>
                        <td style={{ ...td, color: RS.muted }}>{POS_LABEL[r.p.position] || "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.pj}</td>
                        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }} title={t("{mins}' de {availMin}' disponibles (no cuentan los partidos de lesión, viaje, sanción…)", { mins: r.mins, availMin: r.availMin })}>
                          {r.pctMin == null ? <span style={{ color: RS.faint }}>—</span> : (
                            <>
                              <span style={{ display: "inline-block", width: 42, height: 5, background: RS.lineSoft, borderRadius: 9, verticalAlign: "middle", marginRight: 6, overflow: "hidden" }}><span style={{ display: "block", width: `${Math.min(100, r.pctMin)}%`, height: "100%", background: r.level === "alert" ? LOSS : r.level === "warn" ? "#B45309" : RS.granate }} /></span>
                              {r.pctMin} %
                            </>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: r.goals ? 700 : 400 }}>{r.p.position === "portero" ? (r.conceded ? `-${r.conceded}` : "–") : (r.goals || "–")}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.assists || "–"}</td>
                        <td style={{ ...td, textAlign: "right", ...(lowAtt ? { color: LOSS, fontWeight: 700 } : {}) }} title={r.attN ? t("{attN} entrenos registrados", { attN: r.attN }) : ""}>{r.attPct != null ? `${r.attPct} %` : "—"}</td>
                        <td style={td}>{status(r)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ padding: "7px 14px 10px", fontSize: 11, color: RS.muted }}>{t("En rojo, asistencia a entrenos por debajo del 70 %. En los porteros, G = goles encajados.")}</p>
    </section>
  );
}

// ── Partidos (últimos y próximos) ──────────────────────────────────────────
export function MatchesCard({ played, upcoming, pending }) {
  const t = useT();
  const dfl = useDateLocale();
  const Row = ({ m }) => {
    const r = matchResult(m);
    const c = r === "victoria" ? [WIN, "#DCFCE7"] : r === "derrota" ? [LOSS, "#FEE2E2"] : [DRAW, "#FEF3C7"];
    return (
      <Link to={matchLink(m)} className="flex items-center hover:bg-gray-50" style={{ gap: 8, padding: "6px 14px", borderTop: `1px solid ${RS.lineSoft}`, fontSize: 12 }}>
        <span className="capitalize" style={{ width: 58, color: RS.muted, whiteSpace: "nowrap" }}>{format(new Date(m.date), "d MMM", { locale: dfl })}</span>
        {m.is_home === false ? <Plane className="w-3.5 h-3.5 shrink-0" style={{ color: RS.muted }} aria-label={t("Fuera")} /> : <Home className="w-3.5 h-3.5 shrink-0" style={{ color: WIN }} aria-label={t("En casa")} />}
        <span className={`truncate ${isCancelled(m) ? "line-through" : ""}`} style={{ flex: 1, minWidth: 0, fontWeight: 700, color: RS.ink }}>{m.opponent || m.title}</span>
        {pending.has(m.id) && <Chip bg="#FEF3C7" fg="#92400E" title={(pending.get(m.id) || []).join(" · ")}>{t("Pendiente")}</Chip>}
        {r && <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: c[1], color: c[0], whiteSpace: "nowrap" }}>{r === "victoria" ? "✓" : r === "derrota" ? "✕" : "–"} {scoreText(m)}</span>}
        {!r && isCancelled(m) && <Chip bg={RS.lineSoft} fg={RS.muted}>{cancelText(m, t)}</Chip>}
      </Link>
    );
  };
  return (
    <section className="rs2-card" data-testid="team-matches">
      <Head title={t("Partidos")} right={<MoreLink to="/MyTeam/Matches">{t("Todos →")}</MoreLink>} />
      <Label style={{ padding: "8px 14px 2px" }}>{t("Últimos")}</Label>
      {played.length ? played.map((m) => <Row key={m.id} m={m} />) : <p style={{ padding: "4px 14px", fontSize: 12, color: RS.faint }}>—</p>}
      <Label style={{ padding: "10px 14px 2px" }}>{t("Próximos")}</Label>
      {upcoming.length ? upcoming.map((m) => <Row key={m.id} m={m} />) : <p style={{ padding: "4px 14px", fontSize: 12, color: RS.faint }}>—</p>}
      <div style={{ height: 6 }} />
    </section>
  );
}

// ── Líderes del equipo ─────────────────────────────────────────────────────
export function TeamLeaders({ rows }) {
  const t = useT();
  const list = rows.map((r) => ({ player: r.p, goals: r.p.position === "portero" ? 0 : r.goals, assists: r.assists, minutes: r.mins }));
  const cols = [[t("Goles"), topBy(list, "goals"), (r) => r.goals], [t("Asistencias"), topBy(list, "assists"), (r) => r.assists], [t("Minutos"), topBy(list, "minutes"), (r) => `${r.minutes}'`]];
  return (
    <section className="rs2-card" data-testid="team-leaders">
      <Head title={t("Líderes")} right={<MoreLink to="/Stats">{t("Estadísticas →")}</MoreLink>} />
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, padding: "10px 14px" }}>
        {cols.map(([l, top, v]) => (
          <div key={l} className="min-w-0">
            <Label style={{ marginBottom: 3 }}>{l}</Label>
            {top.length === 0 && <p style={{ fontSize: 12, color: RS.faint }}>—</p>}
            {top.map((r, i) => (
              <div key={r.player.id} className="flex items-center" style={{ gap: 6, padding: "2px 0", fontSize: 12 }}>
                <span style={{ width: 12, color: RS.faint }}>{i + 1}</span>
                <Link to={`/PlayerProfile?id=${r.player.id}`} className="truncate hover:underline" style={{ flex: 1, minWidth: 0, color: RS.ink, fontWeight: i === 0 ? 700 : 500 }}>{playerFullName(r.player)}</Link>
                <b className="tabular-nums">{v(r)}</b>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
