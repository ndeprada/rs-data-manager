// Cuatro cuadraditos C · P · A · V de un partido (pasos de src/lib/matchSteps.js): verde = hecho,
// naranja = lo que falta ahora, gris = más adelante. Cada uno abre ese paso del partido.
// Los usan Mi equipo → Partidos y la Agenda del fin de semana del Panel.
import React from "react";
import { Link } from "react-router-dom";
import { WIN } from "@/components/rs2/dashParts";
import { useT, msg } from "@/i18n";

export const STEP_LETTERS = { convocatoria: ["C", msg("Convocatoria")], tactica: ["P", msg("Preparación")], acta: ["A", msg("Acta")], postpartido: ["V", msg("Postpartido")] };

export default function StepSquares({ steps, eventId, teamId, testId, only }) {
  const t = useT();
  const list = only ? steps.filter((s) => only.includes(s.key)) : steps;
  return (
    <span className="inline-flex" style={{ gap: 3 }} data-testid={testId || `match-steps-${eventId}`}>
      {list.map((s) => {
        const [letter, name] = STEP_LETTERS[s.key];
        const sub = s.sub ? t(s.sub.key, s.sub.vars) : "";
        const st = s.state === "done" ? { background: WIN, color: "#fff" }
          : s.state === "now" ? { background: "#FFF7ED", color: "#9A3412", border: "1px solid #F5C2A0" }
          : { background: "#F3ECEB", color: "#B7AAAC" };
        return (
          <Link key={s.key} to={`/MatchDetail?id=${eventId}${teamId ? `&teamId=${teamId}` : ""}&tab=${s.key}`} title={`${t(name)} · ${sub}`} data-state={s.state} data-step={s.key}
            style={{ width: 18, height: 18, borderRadius: 5, fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", ...st }}>{letter}</Link>
        );
      })}
    </span>
  );
}
