// Piezas de la pantalla Personal y de la ficha del entrenador (diseño rs2, 13/11/2026).
import React from "react";
import { Check, Clock } from "lucide-react";
import { RS } from "@/components/rs2/kit";
import { WIN, LOSS } from "@/components/rs2/dashParts";
import { COACH_AREAS } from "@/lib/coachAreas";
import { avgColor } from "@/lib/coachMethod";
import { teamPlaysF7 } from "@/lib/matchFormat";
import { useT, useFormat, msg } from "@/i18n";

export const AMBER = "#B45309";
export const LEVEL_COLOR = { ok: WIN, warn: AMBER, bad: LOSS };

// Rol en el equipo, corto (el primer entrenador no lleva nada)
const ROLE_SHORT = {
  segundo_entrenador: msg("2.º"), preparador_fisico: msg("PF"), entrenador_porteros: msg("EP"), asistente: msg("Asist."),
  delegado: msg("Del."), coordinador: msg("Coord."), fisio: msg("Fisio"), analista: msg("Analista"),
};

export function TeamChip({ team, role }) {
  const t = useT();
  const short = ROLE_SHORT[role];
  return (
    <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 5, background: RS.soft, color: RS.ink, whiteSpace: "nowrap", display: "inline-block" }}>
      {team.name}{short && <span style={{ color: RS.muted }}> · {t(short)}</span>}<span style={{ color: RS.faint }}> · {teamPlaysF7(team) ? "F7" : "F11"}</span>
    </span>
  );
}

export function Avatar({ name, initials, photo, size = 30, accent = false }) {
  if (photo) return <img src={photo} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <span aria-hidden="true" className="rs2-display" title={name}
      style={{ width: size, height: size, borderRadius: "50%", background: accent ? RS.naranja : RS.granate, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, flexShrink: 0 }}>
      {initials}
    </span>
  );
}

/** Cinco barritas, una por área de la 360 (media del periodo abierto), y la media de todas */
export function AreaBars({ data, height = 16 }) {
  const t = useT();
  const { num } = useFormat();
  if (!data || data.overall == null) return <span style={{ fontSize: 11, color: RS.faint }}>{t("sin observar")}</span>;
  const tip = COACH_AREAS.map((a) => `${t(a.label)}: ${data.areas[a.key].avg == null ? "—" : num(data.areas[a.key].avg, { maximumFractionDigits: 1 })}`).join(" · ");
  return (
    <span className="inline-flex items-end" style={{ gap: 6 }} title={tip}>
      <span className="inline-flex items-end" style={{ gap: 2, height }}>
        {COACH_AREAS.map((a) => {
          const v = data.areas[a.key].avg;
          return (
            <span key={a.key} style={{ width: 6, height, background: RS.lineSoft, borderRadius: 2, position: "relative", display: "inline-block" }}>
              {v != null && <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${Math.max(15, (v / 4) * 100)}%`, background: avgColor(v), borderRadius: 2 }} />}
            </span>
          );
        })}
      </span>
      <b className="tabular-nums" style={{ fontSize: 12, color: RS.ink }}>{num(data.overall, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
    </span>
  );
}

export function Pct({ value, level }) {
  if (value == null) return <span style={{ color: RS.faint }}>—</span>;
  return <b className="tabular-nums" style={{ color: LEVEL_COLOR[level] || RS.ink }}>{value} %</b>;
}

export const OkMark = () => <Check width={14} height={14} color={WIN} aria-label="ok" />;

export function AccessMark({ access }) {
  const t = useT();
  if (access === "approved") return <span title={t("Con acceso")}><Check width={15} height={15} color={WIN} aria-hidden="true" /><span className="sr-only">{t("Con acceso")}</span></span>;
  if (access === "pending") return <span title={t("Pendiente de aprobar")}><Clock width={15} height={15} color={AMBER} aria-hidden="true" /><span className="sr-only">{t("Pendiente de aprobar")}</span></span>;
  return <span title={t("Sin acceso a la app")} style={{ color: RS.faint }}>—</span>;
}

/** «hace 3 días» / «hoy» / «ayer» */
export function agoText(t, days) {
  if (days == null) return "";
  if (days === 0) return t("hoy");
  if (days === 1) return t("ayer");
  return t("hace {n} días", { n: days });
}

export const euro = (num, v) => `${num(v, { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })} €`;

/** Botones de opción en cápsula (Todos · Entrenadores …) */
export function Segmented({ options, value, onChange, testPrefix, label }) {
  const t = useT();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap" style={{ gap: 3, background: RS.soft, borderRadius: 999, padding: 3 }}>
      {options.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k} data-testid={`${testPrefix}-${k}`}
          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: 0, fontWeight: value === k ? 700 : 400, background: value === k ? "#fff" : "none", color: value === k ? RS.granate : RS.ink2, boxShadow: value === k ? "0 1px 2px rgba(0,0,0,.08)" : "none", whiteSpace: "nowrap" }}>{typeof l === "string" ? t(l) : l}</button>
      ))}
    </div>
  );
}
