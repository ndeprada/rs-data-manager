// Agenda del fin de semana del Panel (12/11/2026): lógica pura (sin importaciones de la app; se prueba en Node).
// Equipación de cada partido en Event.agenda_meta = { locker, kit: ""|"segunda"|"tercera" ("" = 1ª), kit_color, kit_size }.

export const KIT_KEYS = ["primera", "segunda", "tercera"];
export const KIT_SHORT = { primera: "1ª", segunda: "2ª", tercera: "3ª" };

// Colores habituales de equipación (sugerencias del campo «Color» y la muestra de color). No son los colores del club.
export const KIT_COLORS = [
  ["granate", "#7A1020"], ["blanca", "#FFFFFF"], ["negra", "#1F1F1F"], ["verde", "#1F8A3B"], ["naranja", "#F07B00"],
  ["roja", "#D32F2F"], ["azul", "#1E4FB5"], ["celeste", "#6EC1F0"], ["amarilla", "#F5C800"], ["gris", "#8A8A8A"], ["morada", "#6A3FA0"],
];
export const KIT_SIZES = ["8", "10", "12", "14", "16", "S", "M", "L", "XL"];

const norm = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Muestra de color para un nombre escrito a mano («Verde», «blanco», «#123456»…); null si no se reconoce */
export function kitSwatch(name) {
  const n = norm(name);
  if (!n) return null;
  if (/^#[0-9a-f]{6}$/.test(n)) return n;
  // «blanco»/«blanca», «rojo»/«roja»…: se compara sin la última letra
  const stem = n.replace(/[oa]s?$/, "");
  const hit = KIT_COLORS.find(([k]) => k.replace(/[oa]$/, "") === stem || n.startsWith(k.replace(/[oa]$/, "")));
  return hit ? hit[1] : null;
}

/** Lee agenda_meta (objeto o texto JSON) */
export function agendaMeta(ev) {
  const m = ev?.agenda_meta;
  if (!m) return {};
  if (typeof m === "object") return m;
  try { return JSON.parse(m) || {}; } catch { return {}; }
}

/** Equipación indicada o null si no hay nada (1ª sin color ni talla = lo de siempre, no se escribe) */
export function kitInfo(meta) {
  const kit = KIT_KEYS.includes(meta?.kit) ? meta.kit : "primera";
  const color = String(meta?.kit_color || "").trim();
  const size = String(meta?.kit_size || "").trim();
  if (kit === "primera" && !color && !size) return null;
  return { kit, color, size };
}

const sizeText = (s) => (/^\d+$/.test(s) ? `talla ${s}` : s);

/** «2ª · verde · talla 14» (null si no hay nada) */
export function kitText(meta) {
  const k = kitInfo(meta);
  if (!k) return null;
  return [KIT_SHORT[k.kit], k.color.toLowerCase(), k.size && sizeText(k.size)].filter(Boolean).join(" · ");
}

const time = (ev) => new Date(ev.date).getTime();
const dayKey = (ev) => String(ev.date || "").slice(0, 10);

/**
 * Orden de la agenda: "hora" = sábado y luego domingo, cada día por hora; "equipo" = por el orden de los equipos
 * (teamIds, el de la app) y, dentro de un equipo, por fecha.
 */
export function sortAgenda(matches, order = "hora", teamIds = []) {
  const list = [...matches];
  if (order === "equipo") {
    const pos = (id) => { const i = teamIds.indexOf(id); return i < 0 ? 1e6 : i; };
    return list.sort((a, b) => pos(a.team_id) - pos(b.team_id) || time(a) - time(b));
  }
  return list.sort((a, b) => time(a) - time(b));
}

/**
 * Partidos en casa por campo y por día: [{ field, count, days: [{ day: "yyyy-MM-dd", items }] }]
 * Campo = fieldName(ev) (nombre del campo o lugar). El campo con más partidos va primero.
 */
export function homeGroups(matches, fieldName = (ev) => ev.location || "") {
  const by = new Map();
  for (const ev of matches) {
    if (ev.is_home === false) continue;
    const f = String(fieldName(ev) || "").trim() || "—";
    if (!by.has(f)) by.set(f, []);
    by.get(f).push(ev);
  }
  return [...by.entries()]
    .map(([field, evs]) => {
      const days = new Map();
      for (const ev of [...evs].sort((a, b) => time(a) - time(b))) {
        const d = dayKey(ev);
        if (!days.has(d)) days.set(d, []);
        days.get(d).push(ev);
      }
      return { field, count: evs.length, days: [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, items]) => ({ day, items })) };
    })
    .sort((a, b) => b.count - a.count || (a.field < b.field ? -1 : 1));
}

/** Escala para que una hoja de alto contentH quepa en pageH (nunca agranda) */
export function fitScale(contentH, pageH) {
  if (!(contentH > 0) || !(pageH > 0)) return 1;
  return Math.min(1, pageH / contentH);
}
