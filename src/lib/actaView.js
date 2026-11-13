// Acta del partido (13/11/2026, maqueta «Maqueta Acta · RS Manager» aprobada por Nacho):
// línea del tiempo por partes con el marcador después de cada gol, y entradas/salidas de cada jugador.
// Sin importaciones de la app (tests en tests/actaView.test.mjs).

// Partes del partido a partir de la duración («2x45», «4x15»…); sin dato, dos partes del total
export function periodsOf(duration, totalMinutes = 90) {
  const m = String(duration || "").match(/^(\d+)x(\d+)$/);
  if (m && +m[1] > 0 && +m[2] > 0) return { n: +m[1], len: +m[2] };
  const total = Number(totalMinutes) > 0 ? Number(totalMinutes) : 90;
  return { n: 2, len: Math.round(total / 2) };
}

// En qué parte cae un minuto (el descuento de una parte se queda en ella: 45 → 1.ª, 46 → 2.ª)
export function periodOf(minute, { n, len }) {
  const m = Math.max(1, Number(minute) || 1);
  return Math.min(n - 1, Math.floor((m - 1) / len));
}

const QUARTERS = ["1.er cuarto", "2.º cuarto", "3.er cuarto", "4.º cuarto"];
const HALVES = ["1.ª parte", "2.ª parte"];
export function periodLabel(i, n) {
  if (n === 2) return HALVES[i] || `Parte ${i + 1}`;
  if (n === 4) return QUARTERS[i] || `Cuarto ${i + 1}`;
  return `Parte ${i + 1}`;
}

// Marcador en orden local-visitante (como en el resto de la app)
export const scoreText = (us, them, isHome) => (isHome === false ? `${them}-${us}` : `${us}-${them}`);

// Filas de la línea del tiempo: cabecera de cada parte que tiene eventos (desde la 2.ª, con el marcador al empezarla),
// los eventos en orden con el marcador tras cada gol, y «Final» con el resultado si el partido ya se jugó.
export function timelineRows(events, { duration, totalMinutes, isHome = true, played = false } = {}) {
  const per = periodsOf(duration, totalMinutes);
  const sorted = [...(events || [])].sort((a, b) => (Number(a.minute) || 0) - (Number(b.minute) || 0));
  const rows = [];
  let us = 0, them = 0, last = -1;
  for (const ev of sorted) {
    const p = periodOf(ev.minute, per);
    if (p !== last) {
      rows.push({ kind: "period", index: p, label: periodLabel(p, per.n), score: p > 0 ? scoreText(us, them, isHome) : null });
      last = p;
    }
    let score = null;
    if (ev.type === "goal") {
      if (ev.team === "away") them += 1; else us += 1;
      score = scoreText(us, them, isHome);
    }
    rows.push({ kind: "event", ev, score, rival: ev.team === "away" });
  }
  if (played && sorted.length) rows.push({ kind: "end", label: "Final", score: scoreText(us, them, isHome) });
  return rows;
}

// Cuándo entra y cuándo sale un jugador según los cambios del acta (null si no hay cambio)
export function subTimes(playerId, events) {
  let into = null, out = null;
  for (const e of events || []) {
    if (e.type !== "sub" || e.team === "away") continue;
    const m = Number(e.minute) || 0;
    if (e.playerIn === playerId && (into === null || m < into)) into = m;
    if (e.playerOut === playerId && (out === null || m > out)) out = m;
  }
  return { into, out };
}

// Texto de la columna «Cambio»: «entra 46'», «sale 62'» o «46'–80'»
export function subText({ into, out }) {
  if (into !== null && out !== null) return `${into}’–${out}’`;
  if (into !== null) return `entra ${into}’`;
  if (out !== null) return `sale ${out}’`;
  return "";
}

export function eventCounts(events) {
  const c = { goals: 0, subs: 0, cards: 0 };
  for (const e of events || []) {
    if (e.type === "goal") c.goals += 1;
    else if (e.type === "sub") c.subs += 1;
    else if (e.type === "card") c.cards += 1;
  }
  return c;
}
