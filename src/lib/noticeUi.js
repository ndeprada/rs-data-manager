// Avisos (13/11/2026, maqueta «Maqueta Avisos · RS Manager» aprobada por Nacho): tipos, lectura, filtros y hora programada.
// Sin importaciones de la app (se prueba en Node); los textos se traducen al mostrarlos con t().

export const KINDS = [
  { key: "general", label: "General", bg: "#ECE8E8", fg: "#4A3D3F" },
  { key: "urgente", label: "Urgente", bg: "#FDE2E2", fg: "#B91C1C" },
  { key: "partido", label: "Partido", bg: "#DCE8FB", fg: "#1D4ED8" },
  { key: "entreno", label: "Entreno", bg: "#DDF3E4", fg: "#15803D" },
  { key: "documentacion", label: "Documentación", bg: "#EDE4FA", fg: "#6D28D9" },
];
export const kindInfo = (k) => KINDS.find((x) => x.key === k) || KINDS[0];

// Color de la lectura: verde desde el 80 %, ámbar desde el 50 %, rojo por debajo
export const READ_COLORS = { ok: "#15803D", warn: "#B45309", bad: "#B91C1C" };
export function readLevel(read, total) {
  if (!total) return "ok";
  const pct = (read / total) * 100;
  return pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad";
}

const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Enviados: who 'all' | 'mine', kind 'all' | clave, q = texto (título, texto, destinatarios o quién lo envió) */
export function filterSent(items, { who = "all", kind = "all", q = "" } = {}, uid = null) {
  const needle = norm(q).trim();
  return items.filter((n) => (who !== "mine" || n.sender_id === uid)
    && (kind === "all" || n.kind === kind)
    && (!needle || norm(`${n.title} ${n.body} ${n.audience_label} ${n.sender_name}`).includes(needle)));
}

/** Recibidos: solo sin leer y/o de un tipo */
export function filterInbox(items, { unread = false, kind = "all" } = {}) {
  return items.filter((n) => (!unread || !n.read) && (kind === "all" || n.kind === kind));
}

// Programados arriba (por hora de envío); el resto, como llegan (lo más nuevo primero)
export function splitSent(items) {
  const scheduled = items.filter((n) => n.status === "programado" || n.status === "enviando")
    .sort((a, b) => String(a.send_at).localeCompare(String(b.send_at)));
  const failed = items.filter((n) => n.status === "fallido");
  const sent = items.filter((n) => n.status === "enviado" || !n.status);
  return { scheduled, failed, sent };
}

// ── Hora programada ─────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
// Para <input type="datetime-local">: hora local «yyyy-MM-ddTHH:mm»
export const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export function fromLocalInput(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Propuestas rápidas: hoy a las 20:00 (si aún no ha pasado), mañana a las 9:00 y a las 18:00, y el viernes a las 18:00 */
export function quickTimes(now = new Date()) {
  const at = (days, h) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(h, 0, 0, 0); return d; };
  const out = [];
  if (at(0, 20) - now > 15 * 60_000) out.push({ key: "hoy20", label: "Hoy 20:00", date: at(0, 20) });
  out.push({ key: "man9", label: "Mañana 9:00", date: at(1, 9) }, { key: "man18", label: "Mañana 18:00", date: at(1, 18) });
  const toFri = (5 - now.getDay() + 7) % 7;
  if (toFri > 1) out.push({ key: "vie18", label: "Viernes 18:00", date: at(toFri, 18) });
  return out;
}

/** ¿Vale la hora? Al menos 2 minutos por delante y como mucho 60 días */
export function scheduleError(date, now = new Date()) {
  if (!date) return "Elige el día y la hora";
  if (date.getTime() < now.getTime() + 120_000) return "La hora ya ha pasado";
  if (date.getTime() > now.getTime() + 60 * 86_400_000) return "Como mucho, 60 días por delante";
  return null;
}

// Cómo se ve en la notificación del móvil (el texto se corta hacia los 110 caracteres)
export function pushPreview(body, max = 110) {
  const flat = String(body || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

// Equipos con más «sin leer» en una línea: «Infantil A 31 · Cadete B 24 · …»
export function teamsLine(byTeam, max = 4, none = "Sin equipo") {
  const parts = byTeam.slice(0, max).map((x) => `${x.team || none} ${x.n}`);
  return byTeam.length > max ? `${parts.join(" · ")} · …` : parts.join(" · ");
}
