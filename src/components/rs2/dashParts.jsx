// Piezas comunes del Panel y de Mi equipo (diseño rs2). Ojo: dentro de .rs2 el color de un título va en un span de dentro.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { differenceInMinutes } from "date-fns";
import { RS } from "@/components/rs2/kit";
import { useT, msg } from "@/i18n";

export const WIN = "#15803D", LOSS = "#B91C1C", DRAW = "#A16207";
export const FORM = { G: ["V", WIN], E: ["E", "#B45309"], P: ["D", LOSS] };

export const Label = ({ children, style }) => <p className="rs2-label" style={{ fontSize: 10, letterSpacing: ".12em", ...style }}>{children}</p>;
export const Big = ({ children, color = RS.granate, size = 30 }) => <span className="rs2-display tabular-nums" style={{ fontSize: size, color, lineHeight: 1 }}>{children}</span>;

export function Head({ title, right, testId }) {
  return (
    <div className="flex flex-wrap items-center" style={{ gap: 10, padding: "9px 14px", borderBottom: `1px solid ${RS.lineSoft}` }} data-testid={testId}>
      <h2 style={{ margin: 0, borderLeft: `4px solid ${RS.naranja}`, paddingLeft: 8, lineHeight: 1 }}><span className="rs2-display" style={{ fontSize: 20, lineHeight: 1.1, color: RS.granate }}>{title}</span></h2>
      <div className="flex flex-wrap items-center" style={{ marginLeft: "auto", gap: 10, fontSize: 12 }}>{right}</div>
    </div>
  );
}

export const MoreLink = ({ to, children }) => <Link to={to} style={{ color: RS.granate, fontWeight: 600, fontSize: 12 }}>{children}</Link>;

/** Últimos resultados de la FCF («G», «E», «P») como cuadraditos V/E/D */
export function FormChips({ form = [], size = 15 }) {
  return (
    <span className="flex" style={{ gap: 2 }}>
      {form.map((f, i) => (
        <span key={i} style={{ width: size, height: size, borderRadius: 3, background: (FORM[f] || ["?", "#9ca3af"])[1], color: "#fff", fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{(FORM[f] || ["?"])[0]}</span>
      ))}
    </span>
  );
}

export function Countdown({ date }) {
  const t = useT();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);
  const mins = Math.max(0, differenceInMinutes(new Date(date), now));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return (
    <div className="flex" style={{ gap: 6 }} data-testid="dash-countdown">
      {[[d, msg("días")], [h, msg("horas")], [m, msg("min")]].map(([v, l]) => (
        <div key={l} style={{ background: "rgba(255,255,255,.1)", borderRadius: 8, padding: "4px 9px", textAlign: "center" }}>
          <div className="rs2-display tabular-nums" style={{ fontSize: 20, lineHeight: 1, color: "#fff" }}>{String(v).padStart(2, "0")}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,.65)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t(l)}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tarjetas de pendientes: [{ key, icon, count, label, cta, to | onClick, tone }]. Las de count 0 no salen;
 * sin ninguna, «Todo al día». testPrefix: «dash-pending» en el Panel, «team-pending» en Mi equipo.
 */
export function PendingCards({ items, testPrefix = "dash-pending", extra = null }) {
  const t = useT();
  const shown = items.filter((i) => i && i.count > 0);
  if (shown.length === 0 && !extra) {
    return <p className="flex items-center" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: WIN }} data-testid={`${testPrefix}-none`}><CheckCircle2 className="w-4 h-4" /> {t("Todo al día: no hay pendientes")}</p>;
  }
  return (
    <div className="flex flex-wrap" style={{ gap: 8 }} data-testid={testPrefix}>
      {shown.map(({ key, icon: Icon, count, label, cta, to, tone = RS.ink2, onClick }) => {
        const body = (
          <>
            {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: tone }} aria-hidden="true" />}
            <Big size={22} color={tone}>{count}</Big>
            <span style={{ fontSize: 12, color: RS.ink2, lineHeight: 1.2, flex: 1, minWidth: 0 }}>{label}</span>
            {cta && <span style={{ fontSize: 11, fontWeight: 700, color: RS.granate, whiteSpace: "nowrap" }}>{t(cta)} →</span>}
          </>
        );
        const style = { flex: "1 1 200px", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, minWidth: 0, textAlign: "left" };
        return onClick
          ? <button key={key} type="button" onClick={onClick} className="rs2-card hover:shadow-md transition-shadow" style={style} data-testid={`${testPrefix}-${key}`}>{body}</button>
          : <Link key={key} to={to} className="rs2-card hover:shadow-md transition-shadow" style={style} data-testid={`${testPrefix}-${key}`}>{body}</Link>;
      })}
      {extra}
    </div>
  );
}
