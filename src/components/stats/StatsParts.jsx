// Estadísticas (rediseño rs2 del 13/11/2026, maqueta «Maqueta Estadísticas · RS Manager» aprobada por Nacho): piezas.
// Cálculos en src/lib/statsOverview.js.
import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { RS, YearBadge } from "@/components/rs2/kit";
import { Head, Label, Big, FormChips, WIN, LOSS } from "@/components/rs2/dashParts";
import { PctBar, Seg, GroupHead } from "@/components/myteam/AttendanceParts";
import MatchResultPill from "@/components/calendar/MatchResultPill";
import { squadGroups } from "@/lib/myTeamStats";
import { sortPlayers } from "@/lib/statsOverview";
import { minutesLevel, reasonShort, isAjeno } from "@/lib/participation";
import { GOAL_SHORT, GOAL_LABEL } from "@/lib/participationGoals";
import { playerFullName } from "@/lib/playerName";
import { birthYearOf } from "@/lib/birthYear";
import { juvenilYear } from "@/lib/juvenilYear";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { useT, useDateLocale, msg } from "@/i18n";

const DRAW = "#D97706", WARN = "#B45309";
export const POS_LABEL = { portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB", mediocentro: "MC", interior: "INT", mediapunta: "MP", delantero_centro: "DC", extremo: "EXT" };
const comma = (n) => (n == null ? "—" : String(n).replace(".", ","));

export function VedBar({ w = 0, d = 0, l = 0, width = 120 }) {
  if (!(w + d + l)) return <span style={{ display: "inline-block", width, height: 7, borderRadius: 9, background: "#F1ECEC", verticalAlign: "middle" }} />;
  return (
    <span className="inline-flex" style={{ height: 7, width, borderRadius: 9, overflow: "hidden", verticalAlign: "middle" }}>
      <span style={{ flex: w, background: WIN }} /><span style={{ flex: d, background: "#F59E0B" }} /><span style={{ flex: l, background: LOSS }} />
    </span>
  );
}

export function Kpi({ title, big, color, small, foot, children, testId }) {
  return (
    <div className="rs2-card flex flex-col" style={{ flex: "1 1 170px", padding: "11px 14px", gap: 5, minWidth: 0 }} data-testid={testId}>
      <Label>{title}</Label>
      <div className="flex items-baseline flex-wrap" style={{ gap: 8 }}><Big size={28} color={color}>{big}</Big>{small && <span style={{ fontSize: 12, color: RS.muted }}>{small}</span>}</div>
      {children}
      {foot && <div style={{ fontSize: 11, color: RS.muted }}>{foot}</div>}
    </div>
  );
}

export const recordSmall = (r, t) => (
  <><b style={{ color: WIN }}>{r.w}</b> {t("V")} · <b style={{ color: DRAW }}>{r.d}</b> {t("E")} · <b style={{ color: LOSS }}>{r.l}</b> {t("D")}</>
);

// ── Comparativa por equipo (Todo el club) ─────────────────────────────────
const COMPARE_SORTS = [["categoria", msg("Por categoría")], ["victorias", msg("% victorias")], ["entrenos", msg("Entrenos")]];
export function CompareTable({ rows, sort, onSort, onPick }) {
  const t = useT();
  const th = (a = "left") => ({ textAlign: a, padding: "6px 8px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, fontWeight: 700, borderBottom: `1px solid ${RS.line}`, whiteSpace: "nowrap" });
  const td = { padding: "6px 8px", borderTop: "1px solid #F3EEEE", verticalAlign: "middle", whiteSpace: "nowrap" };
  return (
    <section className="rs2-card" style={{ flex: "2 1 700px", minWidth: 0, overflow: "hidden" }} data-testid="stats-compare">
      <Head title={t("Comparativa por equipo")} right={<Seg options={COMPARE_SORTS} value={sort} onChange={onSort} testPrefix="stats-compare-sort" label={t("Orden")} />} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th style={th()}>{t("Equipo")}</th><th style={th()} className="hidden lg:table-cell">{t("Competición")}</th><th style={th("center")}>{t("Pos")}</th>
            <th style={th("right")}>{t("PJ")}</th><th style={th()}>{t("V-E-D")}</th><th style={th("right")}>{t("Goles")}</th>
            <th style={th()} className="hidden md:table-cell">{t("Racha")}</th><th style={th()}>{t("Entrenos")}</th><th style={th("center")}>{t("Pocos min.")}</th>
            <th style={th("center")} title={t("Jugadores por detrás del ritmo de sus objetivos de temporada (titular, completos, 3 cuartos)")}>{t("Objetivos")}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const diff = r.rec.gf - r.rec.ga;
              return (
                <tr key={r.team.id} data-testid={`stats-compare-${r.team.id}`}>
                  <td style={td}>
                    <button type="button" onClick={() => onPick(r.team.id)} style={{ fontWeight: 700, color: RS.ink, textAlign: "left" }}>{r.team.name}</button>
                    <span style={{ fontSize: 10, color: RS.muted, marginLeft: 5 }}>{r.f7 ? "F7" : "F11"}</span>
                  </td>
                  <td style={{ ...td, fontSize: 11, color: RS.muted }} className="hidden lg:table-cell">{r.comp || "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{r.pos ? `${r.pos}.º` : <span style={{ color: RS.faint }}>—</span>}</td>
                  <td style={{ ...td, textAlign: "right" }} className="tabular-nums">{r.rec.n}</td>
                  <td style={td}><VedBar w={r.rec.w} d={r.rec.d} l={r.rec.l} width={64} /> <span className="tabular-nums" style={{ fontSize: 11, color: RS.ink2 }}>{r.rec.w}-{r.rec.d}-{r.rec.l}</span></td>
                  <td style={{ ...td, textAlign: "right" }} className="tabular-nums">{r.rec.gf}-{r.rec.ga} <span style={{ fontSize: 11, color: diff >= 0 ? WIN : LOSS }}>{diff > 0 ? "+" : ""}{diff}</span></td>
                  <td style={td} className="hidden md:table-cell">{r.form.length ? <FormChips form={r.form} size={16} /> : <span style={{ color: RS.faint }}>—</span>}</td>
                  <td style={td}><PctBar pct={r.att} w={40} /></td>
                  <td style={{ ...td, textAlign: "center", fontWeight: r.low ? 700 : 400, color: r.low ? LOSS : RS.faint }}>{r.low || "—"}</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: r.behind ? 700 : 400, color: r.behind ? WARN : RS.faint }} title={r.behind == null ? t("Sin objetivos (equipo de rendimiento)") : undefined}>{r.behind == null ? "·" : (r.behind || "✓")}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: RS.faint }}>{t("Sin equipos")}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Líderes ──────────────────────────────────────────────────────────────
function LeaderList({ title, items, unit = "", teamName }) {
  const t = useT();
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <Label>{title}</Label>
      <div className="flex flex-col" style={{ gap: 5, marginTop: 6 }}>
        {!items.length && <p style={{ fontSize: 11, color: RS.faint }}>{t("Sin datos")}</p>}
        {items.map((it, i) => (
          <div key={it.id} className="flex items-center" style={{ gap: 6, fontSize: 12 }}>
            <span style={{ width: 14, color: RS.muted }}>{i + 1}</span>
            <span className="min-w-0" style={{ flex: 1 }}>
              <Link to={`/PlayerProfile?id=${it.id}`} className="block truncate" style={{ fontWeight: 700, color: RS.ink }}>{it.name}</Link>
              {teamName && <span className="block truncate" style={{ fontSize: 10.5, color: RS.muted }}>{it.sub}</span>}
            </span>
            <span className="rs2-display tabular-nums" style={{ fontSize: 18, color: RS.granate }}>{it.value}{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeadersCard({ title, goals, assists, minutes, showTeam, formatSeg }) {
  const t = useT();
  return (
    <section className="rs2-card" data-testid="stats-leaders">
      <Head title={title} right={formatSeg} />
      <div className="flex flex-wrap" style={{ gap: 16, padding: "10px 14px 12px" }}>
        <LeaderList title={t("Goles")} items={goals} teamName={showTeam} />
        <LeaderList title={t("Asistencias")} items={assists} teamName={showTeam} />
        <LeaderList title={t("Minutos")} items={minutes} unit="'" teamName={showTeam} />
      </div>
    </section>
  );
}

export function RecentResults({ list, teamsById, showTeam }) {
  const t = useT();
  const dfl = useDateLocale();
  return (
    <section className="rs2-card" data-testid="stats-recent">
      <Head title={t("Últimos resultados")} right={<Link to="/Calendar" style={{ color: RS.granate }}>{t("Calendario")} →</Link>} />
      {!list.length && <p style={{ padding: "12px 14px", fontSize: 12, color: RS.faint }}>{t("Todavía no hay partidos jugados")}</p>}
      {list.map((ev) => (
        <Link key={ev.id} to={`/MatchDetail?id=${ev.id}&teamId=${ev.team_id}`} className="flex items-center hover:bg-[#FBF8F8]" style={{ gap: 8, padding: "6px 14px", borderTop: "1px solid #F3EEEE", fontSize: 12 }}>
          <span className="capitalize" style={{ width: 56, color: RS.muted, whiteSpace: "nowrap" }}>{format(new Date(ev.date), "EEE d", { locale: dfl })}</span>
          {showTeam && <b className="truncate" style={{ width: 104 }}>{teamsById.get(ev.team_id)?.name || ""}</b>}
          <span className="truncate" style={{ flex: 1, minWidth: 0, color: RS.ink2 }}>{ev.is_home === false ? t("en {rival}", { rival: ev.opponent || "?" }) : t("vs {rival}", { rival: ev.opponent || "?" })}</span>
          <MatchResultPill event={ev} size="sm" />
        </Link>
      ))}
      <div style={{ height: 6 }} />
    </section>
  );
}

// ── Tabla de jugadores (un equipo) ───────────────────────────────────────
const PLAYER_SORTS = [["pos", msg("Por posición")], ["min", msg("Más minutos")], ["goles", msg("Goles")], ["bajo", msg("% más bajo")]];
const reasonsLine = (reasons, t) => Object.entries(reasons || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${t(reasonShort(k))} ${n}`).join(" · ");

export function PlayerStatsTable({ rows, guests, sort, onSort, fmt, cycle, rule, ruleOwn, onEditRule, goals, pace, goalsOff }) {
  const t = useT();
  const dfl = useDateLocale();
  const td = { padding: "5px 8px", borderTop: "1px solid #F3EEEE", verticalAlign: "middle", whiteSpace: "nowrap" };
  const th = (a = "left", cls = "") => ({ style: { textAlign: a, padding: "6px 8px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, fontWeight: 700, borderBottom: `1px solid ${RS.line}`, whiteSpace: "nowrap" }, className: cls });
  const level = (pct, r) => minutesLevel(fmt, pct, r || rule);
  const isF7 = fmt === "f7";
  const withGoals = !!goals;
  const cols = 17 + (isF7 ? 4 : 0) + (withGoals ? 1 : 0);
  const GOAL_COLOR = { done: [WIN, "#DCFCE7"], ok: [RS.ink2, "#F3ECEB"], behind: [WARN, "#FEF3C7"], impossible: [LOSS, "#FEE2E2"] };
  const goalChips = (list) => (
    <span className="inline-flex" style={{ gap: 3 }}>
      {list.map((g) => {
        const [fg, bg] = GOAL_COLOR[g.state];
        const tip = `${t(GOAL_LABEL[g.key])}: ${g.value} ${t("de")} ${g.target} · ${g.state === "done" ? t("cumplido") : g.state === "behind" ? t("por detrás del ritmo") : g.state === "impossible" ? t("ya no llega con los partidos que quedan") : t("va a ritmo")}`;
        return <span key={g.key} title={tip} data-state={g.state} className="tabular-nums" style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{g.state === "done" ? "✓ " : ""}{t(GOAL_SHORT[g.key])} {g.value}/{g.target}</span>;
      })}
    </span>
  );
  const reasonsOf = (reasons, ajeno) => Object.entries(reasons || {}).filter(([k]) => isAjeno(k) === ajeno).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${t(reasonShort(k))} ${n}`).join(" · ");
  const qCell = (n, k) => <td key={k} style={{ ...td, textAlign: "right", color: n ? (k < 2 ? LOSS : RS.ink) : RS.faint, fontWeight: n && k < 2 ? 700 : 400, background: "#FBF8F7" }} className="tabular-nums hidden md:table-cell">{n || "–"}</td>;
  const barFor = (pct, r) => {
    const lv = level(pct, r);
    const c = lv === "alert" ? LOSS : lv === "warn" ? WARN : RS.granate;
    if (pct == null) return <span style={{ color: RS.faint }}>—</span>;
    return (
      <span className="inline-flex items-center whitespace-nowrap" style={{ gap: 6 }}>
        <span style={{ width: 48, height: 5, background: "#F1ECEC", borderRadius: 9, overflow: "hidden", display: "inline-block" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", background: c }} /></span>
        <span className="tabular-nums" style={{ fontWeight: 700, color: lv === "alert" || lv === "warn" ? c : RS.ink }}>{pct} %</span>
      </span>
    );
  };
  const chip = (txt, bg, fg, key) => <span key={key} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: bg, color: fg, whiteSpace: "nowrap" }}>{txt}</span>;
  const row = (r) => {
    const { p, b, t: tt, inj, warn } = r;
    const lv = level(b.pctAvail, r.rule);
    const jy = juvenilYear(birthYearOf(p), CURRENT_SEASON);
    return (
      <tr key={p.id} data-testid={`stats-player-${p.id}`}>
        <td style={{ ...td, width: 28 }}><span className="rs2-display tabular-nums" style={{ fontSize: 16, color: RS.granate }}>{p.jersey_number ?? "·"}</span></td>
        <td style={td}><Link to={`/PlayerProfile?id=${p.id}`} style={{ fontWeight: 700, color: RS.ink }}>{playerFullName(p)}</Link></td>
        <td style={{ ...td, color: RS.muted }} className="hidden md:table-cell">{jy ? <YearBadge year={birthYearOf(p)} sm /> : (birthYearOf(p) ?? "—")}</td>
        <td style={{ ...td, color: RS.muted }}>{POS_LABEL[p.position] || "—"}</td>
        <td style={{ ...td, textAlign: "right" }} className="tabular-nums hidden md:table-cell">{b.conv}</td>
        <td style={{ ...td, textAlign: "right" }} className="tabular-nums">{b.played}</td>
        <td style={{ ...td, textAlign: "right" }} className="tabular-nums hidden md:table-cell">{b.titular}</td>
        <td style={{ ...td, textAlign: "right", color: RS.muted }} className="tabular-nums hidden md:table-cell" title={b.suplenteSin ? t("{n} sin jugar", { n: b.suplenteSin }) : undefined}>{b.suplente}{b.suplenteSin ? <span style={{ fontSize: 10, color: RS.faint }}> ({b.suplenteSin})</span> : null}</td>
        <td style={{ ...td, textAlign: "right", color: b.benched ? RS.ink : RS.faint }} className="tabular-nums hidden md:table-cell" title={reasonsOf(b.reasons, false) || undefined}>{b.benched || "–"}</td>
        <td style={{ ...td, textAlign: "right", color: b.unavailable ? RS.ink : RS.faint }} className="tabular-nums hidden md:table-cell" title={reasonsOf(b.reasons, true) || undefined}>{b.unavailable || "–"}</td>
        {isF7 && [1, 2, 3, 4].map((k) => qCell(b.quarters?.[k] || 0, k))}
        <td style={{ ...td, textAlign: "right" }} className="tabular-nums">{b.mins}'</td>
        <td style={td}>{barFor(b.pctAvail, r.rule)}</td>
        {withGoals && <td style={td} data-testid={`stats-goals-${p.id}`}>{goalChips(r.goals || [])}</td>}
        <td style={{ ...td, textAlign: "right", fontWeight: 700 }} className="tabular-nums">{tt.goals || "–"}</td>
        <td style={{ ...td, textAlign: "right" }} className="tabular-nums">{tt.assists || "–"}</td>
        <td style={{ ...td, textAlign: "right" }} className="tabular-nums hidden md:table-cell">{tt.yellow || "–"}{tt.red ? <span style={{ color: LOSS }}> · {tt.red}R</span> : null}</td>
        <td style={{ ...td, fontSize: 11, color: RS.ink2, whiteSpace: "normal", minWidth: 120 }} className="hidden lg:table-cell">{reasonsLine(b.reasons, t) || <span style={{ color: RS.faint }}>—</span>}</td>
        <td style={td}>
          <span className="inline-flex flex-wrap" style={{ gap: 4 }}>
            {inj && chip(inj.expected_return ? t("Lesión · vuelve {d}", { d: format(new Date(inj.expected_return), "d MMM", { locale: dfl }) }) : t("Lesión"), "#FEE2E2", LOSS, "inj")}
            {lv === "alert" && chip(t("Pocos minutos"), "#FEE2E2", LOSS, "min")}
            {warn && chip(t("A 1 de sanción"), "#FEF3C7", WARN, "card")}
          </span>
        </td>
      </tr>
    );
  };
  const groups = sort === "pos" ? squadGroups(rows, (r) => r.p.position) : [{ key: "all", label: "", rows: sortPlayers(rows, sort) }];
  return (
    <section className="rs2-card" style={{ overflow: "hidden" }} data-testid="stats-players">
      <Head title={t("Participación y números de cada jugador")} right={<Seg options={PLAYER_SORTS} value={sort} onChange={onSort} testPrefix="stats-player-sort" label={t("Orden")} />} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th {...th()}>#</th><th {...th()}>{t("Jugador")}</th><th {...th("left", "hidden md:table-cell")}>{t("Año")}</th><th {...th()}>{t("Pos")}</th>
            <th {...th("right", "hidden md:table-cell")} title={t("Partidos convocado")}>{t("Conv.")}</th>
            <th {...th("right")} title={t("Partidos jugados")}>{t("PJ")}</th><th {...th("right", "hidden md:table-cell")}>{t("Tit.")}</th><th {...th("right", "hidden md:table-cell")} title={t("Suplente (entre paréntesis, sin llegar a jugar)")}>{t("Sup.")}</th>
            <th {...th("right", "hidden md:table-cell")} title={t("No convocado por decisión del entrenador: decisión técnica, descanso o sin motivo")}>{t("Fuera")}</th>
            <th {...th("right", "hidden md:table-cell")} title={t("No disponible: lesión, enfermedad, sanción, viaje, estudios u otro motivo")}>{t("No disp.")}</th>
            {isF7 && [1, 2, 3, 4].map((k) => <th key={k} {...th("right", "hidden md:table-cell")} title={k === 1 ? t("Partidos en que jugó 1 cuarto") : t("Partidos en que jugó {n} cuartos", { n: k })} >{t("{n}C", { n: k })}</th>)}
            <th {...th("right")}>{t("Minutos")}</th><th {...th()}>{t("% min. disponibles")}</th>
            {withGoals && <th {...th()} title={t("Objetivos de participación a final de liga")}>{t("Objetivos")}</th>}
            <th {...th("right")}>{t("G")}</th><th {...th("right")}>{t("A")}</th><th {...th("right", "hidden md:table-cell")} title={t("Tarjetas amarillas")}>{t("TA")}</th>
            <th {...th("left", "hidden lg:table-cell")}>{t("Motivos de no convocatoria")}</th><th {...th()} />
          </tr></thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                {g.label && <tr><td colSpan={cols} style={{ padding: "10px 8px 3px" }}><GroupHead title={t(g.label)} right={g.rows.length} /></td></tr>}
                {g.rows.map(row)}
              </React.Fragment>
            ))}
            {guests.length > 0 && (
              <>
                <tr><td colSpan={cols} style={{ padding: "10px 8px 3px" }}><GroupHead title={t("De otros equipos")} right={guests.length} /></td></tr>
                {guests.map((x) => (
                  <tr key={x.p.id} style={{ background: "#F8FBFF" }}>
                    <td style={td} />
                    <td style={td}><Link to={`/PlayerProfile?id=${x.p.id}`} style={{ fontWeight: 700, color: RS.ink }}>{playerFullName(x.p)}</Link> <span style={{ fontSize: 11, color: RS.muted }}>{x.team}</span></td>
                    <td style={td} className="hidden md:table-cell" /><td style={{ ...td, color: RS.muted }}>{POS_LABEL[x.p.position] || "—"}</td>
                    <td style={td} className="hidden md:table-cell" /><td style={{ ...td, textAlign: "right" }}>{x.t.games}</td><td style={td} className="hidden md:table-cell" /><td style={td} className="hidden md:table-cell" /><td style={td} className="hidden md:table-cell" /><td style={td} className="hidden md:table-cell" />
                    {isF7 && [1, 2, 3, 4].map((k) => <td key={k} style={td} className="hidden md:table-cell" />)}
                    <td style={{ ...td, textAlign: "right" }}>{x.t.minutes}'</td>
                    <td style={{ ...td, fontSize: 11, color: RS.muted }}>{t("Cuenta en su equipo")}</td>
                    {withGoals && <td style={td} />}
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{x.t.goals || "–"}</td><td style={{ ...td, textAlign: "right" }}>{x.t.assists || "–"}</td>
                    <td style={{ ...td, textAlign: "right" }} className="hidden md:table-cell">{x.t.yellow || "–"}</td><td style={td} className="hidden lg:table-cell" /><td style={td} />
                  </tr>
                ))}
              </>
            )}
            {!rows.length && <tr><td colSpan={cols} style={{ padding: 24, textAlign: "center", color: RS.faint }}>{t("Todavía no hay partidos cerrados de este equipo en esta competición.")}</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "8px 14px 10px", fontSize: 11, color: RS.muted, borderTop: `1px solid ${RS.line}` }}>
        <b style={{ color: RS.ink2 }}>{t("% min. disponibles")}</b> {t("= minutos jugados sobre los de los partidos en que podía jugar (sin lesión, sanción, viaje…).")}{" "}
        <span data-testid="stats-rule">
          {rule ? (rule.target ? t("Mínimo de este equipo: {a} % (en rojo por debajo) · objetivo {b} % (en ámbar)", { a: rule.alert, b: rule.target }) : t("Mínimo de este equipo: {a} % (en rojo por debajo)", { a: rule.alert })) : null}
          {rule ? ` · ${ruleOwn ? t("propio del equipo") : t("el del club")}` : null}
          {onEditRule && <> · <button type="button" onClick={onEditRule} data-testid="stats-rule-edit" style={{ font: "inherit", fontWeight: 700, color: RS.granate, background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>{t("Cambiar")}</button></>}
        </span>
        {isF7 ? ` ${t("1C–4C: partidos en que jugó 1, 2, 3 o 4 cuartos (orientativo: cuenta un cuarto si estuvo más de la mitad); en rojo, menos de 2.")}` : ""}
        {withGoals ? ` ${t("Objetivos a final de liga: ✓ cumplido, gris a ritmo, ámbar por detrás del ritmo, rojo ya no llega (quedan {n} partidos).", { n: pace?.remaining ?? 0 })}` : ""}
        {goalsOff ? ` ${t("Equipo de rendimiento: sin objetivos de participación.")}` : ""}
        {cycle ? ` ${t("«A 1 de sanción»: le falta una amarilla para cumplir ciclo ({n} amarillas = 1 partido).", { n: cycle })}` : ""}
      </div>
    </section>
  );
}

export const commaNum = comma;
