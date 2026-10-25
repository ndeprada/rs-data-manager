import React from "react";
import { Check, X, Minus } from "lucide-react";
import { scoreText, scoreTitle, playedResult } from "@/lib/matchScore";
import { useT, msg } from "@/i18n";

// Color del resultado de un partido ya jugado: verde victoria, rojo derrota, ámbar empate.
// Lo usan las tarjetas de todos los calendarios (equipo y club) para que se vea igual en todas partes.
export const RESULT_STYLES = {
  victoria: { solid: "#16a34a", bg: "#f0fdf4", pill: "#dcfce7", border: "#86efac", text: "#166534", word: msg("Victoria"), Icon: Check },
  derrota:  { solid: "#dc2626", bg: "#fef2f2", pill: "#fee2e2", border: "#fca5a5", text: "#991b1b", word: msg("Derrota"), Icon: X },
  empate:   { solid: "#d97706", bg: "#fffbeb", pill: "#fef3c7", border: "#fcd34d", text: "#92400e", word: msg("Empate"), Icon: Minus },
};

/** { result, rs } de un partido ya jugado (o { result: null, rs: null }). */
export function resultOf(event, now) {
  const result = playedResult(event, now);
  return { result, rs: result ? RESULT_STYLES[result] : null };
}

const SIZES = {
  xs: "text-[9px] px-1 py-px gap-0.5 rounded-full",
  sm: "text-[11px] px-1.5 py-0.5 gap-0.5 rounded-md",
  md: "text-xs px-2 py-1 gap-1 rounded-md",
};
const ICON = { xs: "w-2 h-2", sm: "w-2.5 h-2.5", md: "w-3 h-3" };

/**
 * Marcador pequeño de un partido jugado: icono (✓ victoria, ✕ derrota, – empate) + «2 - 1» (orden local-visitante),
 * en el color del resultado. El icono hace que no dependa solo del color. `onDark`: sobre un fondo de color (blanco con letra de color).
 * No pinta nada si el partido no tiene resultado, está suspendido o aún no se ha jugado.
 */
export default function MatchResultPill({ event, size = "sm", onDark = false, className = "" }) {
  const t = useT();
  const { result, rs } = resultOf(event);
  if (!rs) return null;
  const Icon = rs.Icon;
  return (
    <span
      className={`inline-flex items-center shrink-0 font-black leading-none tabular-nums ${SIZES[size]} ${className}`}
      style={onDark ? { background: "#fff", color: rs.text } : { background: rs.solid, color: "#fff" }}
      title={`${t(rs.word)} · ${scoreTitle(event, undefined, t)}`}
      data-testid="match-result" data-result={result}
    >
      <Icon className={ICON[size]} strokeWidth={3.5} aria-hidden="true" />
      <span className="sr-only">{t(rs.word)}</span>
      {scoreText(event)}
    </span>
  );
}
