// Página Herramientas → Táctica (`src/pages/Tactics.jsx`): formato (fútbol 7 / fútbol 11) de cada pizarra, los huecos de los sistemas
// de fútbol 7 en el formato de esa página y el paso de la pizarra libre antigua (`free_positions`, en % sobre el campo) a la pizarra
// nueva (`board`, formato de `src/lib/board.js`). Sin importaciones de la app (rutas relativas) para poder probarlo en Node.
import { FORMATION_POSITIONS, F7_SLOT_ROLES, FORMATIONS_F7, formatOfFormation, formationLabel } from "./matchFormations.js";
import { teamPlaysF7 } from "./matchFormat.js";
import { emptyBoard, fieldOf, newId, normalizeBoard } from "./board.js";
import { playerFirstName } from "./playerName.js";

const round = (n) => Math.round(n * 10) / 10;

/**
 * Formato con el que se abre una pizarra ("f7" | "f11"): el de su formación guardada (7 huecos = F7, 11 = F11: así nunca se le cambia
 * a nadie la pizarra que dejó) y, si no se reconoce, el de la etapa del equipo (de S12 hacia abajo se juega a fútbol 7).
 */
export function tacticsBoardFormat(board, team) {
  return formatOfFormation(board?.formation) || (teamPlaysF7(team) ? "f7" : "f11");
}

// ── Huecos de los sistemas de fútbol 7 con el formato de la página (portería propia ARRIBA, y = 0) ──────────────────────────────
// En `matchFormations.js` el ataque va hacia arriba (portero abajo); esta página dibuja al revés, como siempre, así que se invierte y.
// El hueco del portero se llama «gk» (el color y el desplegable lo reconocen); los demás, p1…p6, en el orden de `FORMATION_POSITIONS`.
const ROLE_LABEL = { portero: "POR", lateral: "LAT", central: "CEN", medio: "MC", mediapunta: "MP", extremo: "EXT", punta: "DC" };

export function f7PageFormation(key) {
  const pos = FORMATION_POSITIONS[key];
  const roles = F7_SLOT_ROLES[key];
  return {
    label: formationLabel(key),
    positions: pos.map(([x, y], i) => ({ key: i === 0 ? "gk" : `p${i}`, label: ROLE_LABEL[roles[i]] || "", x, y: 100 - y })),
  };
}

export const FORMATION_KEYS_F7 = FORMATIONS_F7;
export const F7_PAGE_FORMATIONS = Object.fromEntries(FORMATION_KEYS_F7.map((k) => [k, f7PageFormation(k)]));

// ── Pizarra libre antigua → pizarra nueva ────────────────────────────────────────────────────────────────────────────────────
/** Nombre que lleva la ficha de un jugador en la pizarra: «Nombre I.» (nombre o apodo y la inicial del primer apellido). */
export function tokenLabel(player) {
  const first = playerFirstName(player);
  const initial = (player?.last_name || "").trim()[0];
  return `${first}${initial ? ` ${initial.toUpperCase()}.` : ""}`.trim() || "?";
}

/** Los jugadores de una pizarra libre antigua (`free_positions`: player_id, x%, y%) como primer y único fotograma de una pizarra nueva. */
export function freePositionsToBoard(positions, players, { f7 = false } = {}) {
  const field = f7 ? "f7" : "full";
  const F = fieldOf(field);
  const board = emptyBoard(field);
  const els = [];
  for (const p of positions || []) {
    const player = (players || []).find((pl) => pl.id === p.player_id);
    if (!player) continue;
    els.push({
      id: newId(), k: "token", team: player.position === "portero" ? "gk" : "a", label: tokenLabel(player),
      x: round((Math.min(100, Math.max(0, Number(p.x) || 0)) / 100) * F.w),
      y: round((Math.min(100, Math.max(0, Number(p.y) || 0)) / 100) * F.h),
    });
  }
  return { ...board, frames: [{ id: board.frames[0].id, els }] };
}

/**
 * Pizarra de jugadas de una pizarra táctica: la guardada (`board`); si no hay, la libre antigua convertida (solo se guarda cuando
 * alguien la edita; mientras tanto la antigua no se toca); y, si tampoco, una en blanco con el campo del formato (F7: 45 × 65 m).
 */
export function boardOfTactic(tb, { players = [], f7 = false } = {}) {
  if (tb?.board) return normalizeBoard(tb.board);
  if (Array.isArray(tb?.free_positions) && tb.free_positions.length) return freePositionsToBoard(tb.free_positions, players, { f7 });
  return emptyBoard(f7 ? "f7" : "full");
}

/** Campos que se ofrecen en la pizarra de jugadas según el formato (siempre incluye el que ya tenga la pizarra). */
export function fieldsFor(f7, current) {
  const ids = f7 ? ["f7", "free"] : ["full", "tq", "half", "free"];
  return current && !ids.includes(current) ? [...ids, current] : ids;
}
