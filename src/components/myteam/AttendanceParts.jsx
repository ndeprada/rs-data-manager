// Mi equipo → Entrenamientos: piezas del resumen y de «Pasar lista» (rediseño del 13/11/2026 con el diseño rs2,
// maqueta «Maqueta Entrenamientos · RS Manager» aprobada por Nacho: «ok»). Cálculos en src/lib/trainingAttendance.js.
import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ClipboardCheck } from "lucide-react";
import { RS, YearBadge } from "@/components/rs2/kit";
import { Label, Big, Head, WIN, LOSS } from "@/components/rs2/dashParts";
import { squadGroups } from "@/lib/myTeamStats";
import { sortSummary } from "@/lib/trainingAttendance";
import { birthYearOf } from "@/lib/birthYear";
import { juvenilYear } from "@/lib/juvenilYear";
import { CURRENT_SEASON } from "@/lib/staffRoles";
import { playerFullName } from "@/lib/playerName";
import { cancelText } from "@/lib/eventCancel";
import { useT, useDateLocale, msg } from "@/i18n";

export const APART = "#2563EB", WARN = "#B45309";
export const ABSENCE_REASONS = [
  { value: "lesion", label: msg("Lesión") }, { value: "enfermo", label: msg("Enfermo") },
  { value: "clase", label: msg("Clase") }, { value: "examen", label: msg("Examen") },
  { value: "viaje", label: msg("Viaje") }, { value: "familiar", label: msg("Familiar") },
  { value: "permiso", label: msg("Permiso") }, { value: "otro", label: msg("Otro") },
];
export const REASON_LABEL = Object.fromEntries(ABSENCE_REASONS.map((r) => [r.value, r.label]));
const REASON_COLOR = { clase: "#7C2D12", lesion: "#C2410C", examen: "#F59E0B", enfermo: "#A16207", viaje: "#9CA3AF", familiar: "#78716C", permiso: "#A8A29E", otro: "#D6CDCE" };
export const POS_LABEL = { portero: "POR", lateral: "LAT", central: "CEN", libre: "LIB", mediocentro: "MC", interior: "INT", mediapunta: "MP", delantero_centro: "DC", extremo: "EXT" };
const DOT = { s: WIN, a: APART, n: LOSS, x: "#D6CDCE" };
const DOT_TITLE = { s: msg("Asiste"), a: msg("A parte"), n: msg("No asiste"), x: msg("Sin marcar"), c: msg("Cancelado") };

/** Cuadritos de entrenos: s asiste · a a parte · n no · x sin marcar · c cancelado */
export function Dots({ codes = [], size = 9, label }) {
  const t = useT();
  return (
    <span className="inline-flex align-middle" style={{ gap: 2 }} role="img" aria-label={label || codes.map((c) => t(DOT_TITLE[c])).join(", ")}>
      {codes.map((c, i) => (
        <span key={i} title={t(DOT_TITLE[c])} style={{ width: size, height: size, borderRadius: 2.5, display: "inline-block", ...(c === "c" ? { border: "1px dashed #C9BEBF" } : { background: DOT[c] }) }} />
      ))}
    </span>
  );
}

/** Barra con el %: rojo por debajo del 70, ámbar por debajo del 80 */
export function PctBar({ pct, w = 48 }) {
  if (pct == null) return <span style={{ color: RS.faint }}>—</span>;
  const c = pct < 70 ? LOSS : pct < 80 ? WARN : RS.granate;
  return (
    <span className="inline-flex items-center whitespace-nowrap" style={{ gap: 6 }}>
      <span style={{ width: w, height: 5, background: "#F1ECEC", borderRadius: 9, overflow: "hidden", display: "inline-block" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", background: c }} /></span>
      <span className="tabular-nums" style={{ fontWeight: 700, color: pct < 80 ? c : RS.ink }}>{pct} %</span>
    </span>
  );
}

export function Seg({ options, value, onChange, testPrefix, label }) {
  const t = useT();
  return (
    <div className="flex" role="group" aria-label={label} style={{ gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={on} data-testid={`${testPrefix}-${v}`}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", ...(on ? { background: "#fff", color: RS.granate, fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,.08)" } : { background: "none", color: RS.ink2 }) }}>{t(l)}</button>
        );
      })}
    </div>
  );
}

export function GroupHead({ title, right }) {
  return (
    <div className="flex items-center" style={{ gap: 8, padding: "4px 8px", background: RS.soft, borderLeft: `3px solid ${RS.naranja}`, borderRadius: "0 6px 6px 0" }} data-testid="att-group">
      <span className="rs2-display" style={{ fontSize: 14, color: RS.granateDark, textTransform: "uppercase", lineHeight: 1.1 }}>{title}</span>
      <span className="tabular-nums" style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: RS.ink2 }}>{right}</span>
    </div>
  );
}

const reasonsText = (reasons, t) => Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${t(REASON_LABEL[k] || k)} ${n}`).join(" · ");

// ── Aviso de entrenos sin lista ──────────────────────────────────────────
export function PendingBanner({ pending }) {
  const t = useT();
  const dfl = useDateLocale();
  if (!pending.length) return null;
  const last = pending[pending.length - 1].ev;
  const names = pending.slice(-2).reverse().map((x) => format(new Date(x.ev.date), "EEE d MMM", { locale: dfl }));
  return (
    <Link to={`/MyTeam/Attendance?eventId=${last.id}`} className="flex items-center hover:shadow-md transition-shadow" data-testid="att-pending"
      style={{ gap: 10, padding: "8px 12px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10 }}>
      <ClipboardCheck className="w-4 h-4 shrink-0" style={{ color: WARN }} aria-hidden="true" />
      <Big size={22} color={WARN}>{pending.length}</Big>
      <span style={{ fontSize: 12, color: RS.ink2, flex: 1, minWidth: 0 }}>
        {pending.length === 1 ? t("entreno sin pasar lista") : t("entrenos sin pasar lista")} · <b>{names.join(" · ")}</b>{pending.length > 2 ? ` · ${t("y {n} más", { n: pending.length - 2 })}` : ""}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: RS.granate, whiteSpace: "nowrap" }}>{t("Pasar lista del {day}", { day: format(new Date(last.date), "EEEE d", { locale: dfl }) })} →</span>
    </Link>
  );
}

// ── Cuatro cifras ────────────────────────────────────────────────────────
function Kpi({ title, children, foot, testId }) {
  return (
    <div className="rs2-card flex flex-col" style={{ flex: "1 1 200px", padding: "11px 14px", gap: 5, minWidth: 0 }} data-testid={testId}>
      <Label>{title}</Label>
      {children}
      {foot && <div style={{ fontSize: 11, color: RS.muted }}>{foot}</div>}
    </div>
  );
}

export function AttendanceKpis({ periodLabel, rates, clubRate, done, off, pending, absences, reasons, low }) {
  const t = useT();
  const absTotal = reasons.reduce((s, [, n]) => s + n, 0);
  const trendC = rates.trend > 0 ? WIN : rates.trend < 0 ? LOSS : RS.muted;
  return (
    <div className="flex flex-wrap" style={{ gap: 12 }} data-testid="att-kpis">
      <Kpi title={t("Asistencia · {period}", { period: t(periodLabel) })} testId="att-kpi-rate" foot={clubRate != null ? t("Media del club: {n} %", { n: clubRate }) : null}>
        <div className="flex items-baseline flex-wrap" style={{ gap: 8 }}>
          <Big size={28}>{rates.period != null ? `${rates.period} %` : "—"}</Big>
          {rates.last30 != null && periodLabel !== "30 días" && (
            <span style={{ fontSize: 12, color: RS.muted }}>{t("30 días:")} <b style={{ color: trendC }}>{rates.last30} %{rates.trend ? ` ${rates.trend > 0 ? "▲" : "▼"} ${Math.abs(rates.trend)}` : ""}</b></span>
          )}
        </div>
        <div style={{ height: 6, borderRadius: 99, background: "#F1ECEC", overflow: "hidden" }}><span style={{ display: "block", width: `${rates.period || 0}%`, height: "100%", background: RS.granate }} /></div>
      </Kpi>
      <Kpi title={t("Entrenos")} testId="att-kpi-done"
        foot={[off ? (off === 1 ? t("1 cancelado") : t("{n} cancelados", { n: off })) : null, pending ? (pending === 1 ? t("1 sin pasar lista") : t("{n} sin pasar lista", { n: pending })) : null].filter(Boolean).join(" · ") || null}>
        <div className="flex items-baseline" style={{ gap: 8 }}><Big size={28}>{done}</Big><span style={{ fontSize: 12, color: RS.muted }}>{t("realizados")}</span></div>
      </Kpi>
      <Kpi title={t("Ausencias")} testId="att-kpi-abs"
        foot={absTotal ? reasons.slice(0, 3).map(([k, n]) => `${t(REASON_LABEL[k] || k)} ${Math.round((n / absTotal) * 100)} %`).join(" · ") : null}>
        <div className="flex items-baseline" style={{ gap: 8 }}><Big size={28} color={absences ? LOSS : RS.granate}>{absences}</Big><span style={{ fontSize: 12, color: RS.muted }}>{t("en el periodo")}</span></div>
        {absTotal > 0 && (
          <div className="flex" style={{ height: 6, borderRadius: 99, overflow: "hidden" }}>
            {reasons.map(([k, n]) => <span key={k} style={{ flex: n, background: REASON_COLOR[k] || "#D6CDCE" }} />)}
          </div>
        )}
      </Kpi>
      <Kpi title={t("Por debajo del 70 %")} testId="att-kpi-low" foot={low.slice(0, 3).map((r) => `${playerFullName(r.p)} ${r.pct} %`).join(" · ") || null}>
        <div className="flex items-baseline" style={{ gap: 8 }}><Big size={28} color={low.length ? LOSS : RS.granate}>{low.length}</Big><span style={{ fontSize: 12, color: RS.muted }}>{low.length === 1 ? t("jugador") : t("jugadores")}</span></div>
      </Kpi>
    </div>
  );
}

// ── Tabla por jugador ────────────────────────────────────────────────────
const PERIODS = [["temporada", msg("Temporada")], ["30", msg("Últimos 30 días")], ["mes", msg("Este mes")]];
const SORTS = [["posicion", msg("Por posición")], ["bajo", msg("% más bajo")], ["dorsal", msg("Por dorsal")]];

export function SummaryTable({ rows, period, onPeriod, sort, onSort, total, injuredById }) {
  const t = useT();
  const dfl = useDateLocale();
  const td = { padding: "5px 8px", borderTop: "1px solid #F3EEEE", verticalAlign: "middle" };
  const th = (a = "left") => ({ textAlign: a, padding: "6px 8px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: RS.muted, fontWeight: 700, borderBottom: `1px solid ${RS.line}`, whiteSpace: "nowrap" });
  const row = (r) => {
    const inj = injuredById.get(r.p.id);
    return (
      <tr key={r.p.id} data-testid={`att-row-${r.p.id}`}>
        <td style={{ ...td, width: 28 }}><span className="rs2-display tabular-nums" style={{ fontSize: 16, color: RS.granate }}>{r.p.jersey_number ?? "·"}</span></td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          <Link to={`/PlayerProfile?id=${r.p.id}`} style={{ fontWeight: 700, color: RS.ink }}>{playerFullName(r.p)}</Link>
          {inj && <span className="hidden sm:inline" style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#FEE2E2", color: LOSS }}>{inj.expected_return ? t("Lesión · vuelve {d}", { d: format(new Date(inj.expected_return), "d MMM", { locale: dfl }) }) : t("Lesión")}</span>}
        </td>
        <td style={{ ...td, color: RS.muted }} className="hidden md:table-cell">{juvenilYear(birthYearOf(r.p), CURRENT_SEASON) ? <YearBadge year={birthYearOf(r.p)} sm /> : (birthYearOf(r.p) ?? "—")}</td>
        <td style={{ ...td, color: RS.muted }} className="hidden md:table-cell">{POS_LABEL[r.p.position] || "—"}</td>
        <td style={{ ...td, whiteSpace: "nowrap" }}><Dots codes={r.last} /></td>
        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: WIN }} className="hidden md:table-cell tabular-nums">{r.present || "–"}</td>
        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: APART }} className="hidden md:table-cell tabular-nums">{r.apart || "–"}</td>
        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: LOSS }} className="hidden md:table-cell tabular-nums">{r.absent || "–"}</td>
        <td style={{ ...td }}><PctBar pct={r.pct} /></td>
        <td style={{ ...td, fontSize: 11, color: RS.ink2 }} className="hidden lg:table-cell">{reasonsText(r.reasons, t) || <span style={{ color: RS.faint }}>—</span>}</td>
      </tr>
    );
  };
  const groups = sort === "posicion" ? squadGroups(rows, (r) => r.p.position) : [{ key: "all", label: "", rows: sortSummary(rows, sort) }];
  return (
    <section className="rs2-card" style={{ flex: "2 1 680px", minWidth: 0, overflow: "hidden" }} data-testid="att-summary">
      <Head title={t("Asistencia por jugador")} right={<><Seg options={PERIODS} value={period} onChange={onPeriod} testPrefix="att-period" label={t("Periodo")} /><Seg options={SORTS} value={sort} onChange={onSort} testPrefix="att-sort" label={t("Orden")} /></>} />
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>
            <th style={th()}>#</th><th style={th()}>{t("Jugador")}</th><th style={th()} className="hidden md:table-cell">{t("Año")}</th><th style={th()} className="hidden md:table-cell">{t("Pos")}</th>
            <th style={th()}>{t("Últimos 10")}</th><th style={th("right")} className="hidden md:table-cell">{t("Asiste")}</th><th style={th("right")} className="hidden md:table-cell">{t("A parte")}</th>
            <th style={th("right")} className="hidden md:table-cell">{t("No")}</th><th style={th()}>{t("% asistencia")}</th><th style={th()} className="hidden lg:table-cell">{t("Motivos")}</th>
          </tr></thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                {g.label && <tr><td colSpan={10} style={{ padding: "10px 8px 3px" }}><GroupHead title={t(g.label)} right={g.rows.length} /></td></tr>}
                {g.rows.map(row)}
              </React.Fragment>
            ))}
            {!rows.length && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: RS.faint }}>{t("Sin jugadores")}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 14, padding: "8px 14px 10px", fontSize: 11, color: RS.muted, borderTop: `1px solid ${RS.line}` }}>
        <span>{total === 1 ? t("1 entreno con lista en el periodo") : t("{n} entrenos con lista en el periodo", { n: total })} · {t("«A parte» cuenta como asistencia")}</span>
        <span className="flex flex-wrap items-center" style={{ gap: 10, marginLeft: "auto" }}>
          {[["s", msg("Asiste")], ["a", msg("A parte")], ["n", msg("No")], ["c", msg("Cancelado")]].map(([c, l]) => <span key={c} className="inline-flex items-center" style={{ gap: 4 }}><Dots codes={[c]} />{t(l)}</span>)}
        </span>
      </div>
    </section>
  );
}

// ── Columna derecha ──────────────────────────────────────────────────────
export function RecentTrainings({ list }) {
  const t = useT();
  const dfl = useDateLocale();
  return (
    <section className="rs2-card" data-testid="att-recent">
      <Head title={t("Entrenos recientes")} />
      {!list.length && <p style={{ padding: "12px 14px", fontSize: 12, color: RS.faint }}>{t("Todavía no hay entrenos")}</p>}
      {list.map(({ ev, state, totals }) => (
        <Link key={ev.id} to={`/MyTeam/Attendance?eventId=${ev.id}`} className="flex items-center hover:bg-[#FBF8F8]" style={{ gap: 8, padding: "6px 14px", borderTop: "1px solid #F3EEEE", fontSize: 12 }} data-testid={`att-recent-${ev.id}`}>
          <span className={`capitalize ${state === "off" ? "line-through" : ""}`} style={{ width: 84, whiteSpace: "nowrap", fontWeight: state === "off" ? 400 : 700, color: state === "off" ? RS.muted : RS.ink }}>{format(new Date(ev.date), "EEE d MMM", { locale: dfl })}</span>
          <span className="truncate" style={{ flex: 1, minWidth: 0, color: RS.muted }}>{ev.title || t("Entrenamiento")}</span>
          {state === "done" && (
            <>
              <span className="tabular-nums whitespace-nowrap" style={{ fontSize: 11, color: RS.ink2 }}><b style={{ color: WIN }}>{totals.present}</b>{totals.apart ? `+${totals.apart}` : ""} · <b style={{ color: LOSS }}>{totals.absent}</b> {t("no")}</span>
              <span style={{ width: 66, textAlign: "right" }}><PctBar pct={totals.pct} w={22} /></span>
            </>
          )}
          {state === "pending" && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#FFF7ED", color: WARN, whiteSpace: "nowrap" }}>{t("Pasar lista")}</span>}
          {state === "off" && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#F1ECEC", color: RS.muted, whiteSpace: "nowrap" }}>{cancelText(ev, t)}</span>}
        </Link>
      ))}
      <div style={{ height: 6 }} />
    </section>
  );
}

export function ReasonsCard({ reasons }) {
  const t = useT();
  const max = reasons[0]?.[1] || 1;
  return (
    <section className="rs2-card" data-testid="att-reasons">
      <Head title={t("Motivos de ausencia")} />
      <div className="flex flex-col" style={{ padding: "8px 14px 12px", gap: 6 }}>
        {!reasons.length && <p style={{ fontSize: 12, color: RS.faint }}>{t("Sin ausencias en el periodo")}</p>}
        {reasons.map(([k, n]) => (
          <div key={k} className="flex items-center" style={{ gap: 8, fontSize: 12 }}>
            <span style={{ width: 66 }}>{t(REASON_LABEL[k] || k)}</span>
            <span style={{ flex: 1, height: 7, background: "#F1ECEC", borderRadius: 9, overflow: "hidden" }}><span style={{ display: "block", width: `${(n / max) * 100}%`, height: "100%", background: REASON_COLOR[k] || "#D6CDCE" }} /></span>
            <b className="tabular-nums" style={{ width: 24, textAlign: "right" }}>{n}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ExternalCard({ list }) {
  const t = useT();
  if (!list.length) return null;
  return (
    <section className="rs2-card" data-testid="att-external">
      <Head title={t("Otros equipos y a prueba · {n}", { n: list.length })} />
      {list.map((e) => (
        <div key={e.key} className="flex items-center" style={{ gap: 8, padding: "6px 14px", borderTop: "1px solid #F3EEEE", fontSize: 12 }}>
          <span className="truncate" style={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{e.name}</span>
          <span style={{ color: RS.muted, fontSize: 11, whiteSpace: "nowrap" }}>{e.origin}</span>
          <span className="tabular-nums whitespace-nowrap" style={{ fontSize: 11 }}><b style={{ color: WIN }}>{e.present + e.apart}</b>{e.absent ? <> · <b style={{ color: LOSS }}>{e.absent}</b> {t("no")}</> : null}</span>
        </div>
      ))}
      <div style={{ height: 6 }} />
    </section>
  );
}
