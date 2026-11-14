// Partidos en que el jugador fue convocado y jugó menos del mínimo por partido (14/11/2026, Nacho): 25' en fútbol 11 y la
// mitad del partido en fútbol 7. En las etapas de rendimiento (Cadet S16 A, juveniles y primer equipo) es orientativo y sale
// en gris. Lo cuenta `participationOf` (`belowMin`).
import React from "react";
import { useT } from "@/i18n";

export default function BelowMinBadge({ n, perf = false, testId }) {
  const t = useT();
  if (!n) return null;
  const title = n === 1
    ? t("1 partido convocado jugando menos del mínimo por partido (25’ en fútbol 11, la mitad en fútbol 7)")
    : t("{n} partidos convocado jugando menos del mínimo por partido (25’ en fútbol 11, la mitad en fútbol 7)", { n });
  return (
    <span title={perf ? `${title} · ${t("orientativo en esta etapa")}` : title} data-testid={testId}
      className="tabular-nums" style={{ display: "inline-block", marginLeft: 5, padding: "0 5px", borderRadius: 999, fontSize: 10, fontWeight: 700, lineHeight: "15px",
        color: perf ? "#6B5B5D" : "#92400E", background: perf ? "#F1ECEB" : "#FEF3C7" }}>
      ↓{n}
    </span>
  );
}
