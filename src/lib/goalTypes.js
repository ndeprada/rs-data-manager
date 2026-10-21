// Clasificación de goles (marcados y encajados): fase de juego, zona/sector y detalle de balón parado.
import { msg } from "../i18n/translate.js";
export const GOAL_PHASES = [
  { value: "ataque_organizado", label: msg("Ataque organizado") },
  { value: "transicion", label: msg("Transición") },
  { value: "balon_parado", label: msg("Balón parado") },
  { value: "gol_propio", label: msg("Gol en propia") },
];
export const GOAL_AREAS = [{ value: "dentro", label: msg("Dentro del área") }, { value: "fuera", label: msg("Fuera del área") }];
export const GOAL_SECTORS = [{ value: "izquierda", label: msg("Izquierda") }, { value: "centro", label: msg("Centro") }, { value: "derecha", label: msg("Derecha") }];
export const SP_TYPES = [
  { value: "penalti", label: msg("Penalti") },
  { value: "corner", label: msg("Córner") },
  { value: "falta_lateral", label: msg("Falta lateral") },
  { value: "falta_frontal", label: msg("Falta frontal") },
  { value: "saque_banda", label: msg("Saque de banda") },
  { value: "saque_centro", label: msg("Saque de centro") },
  { value: "saque_puerta", label: msg("Saque de puerta") },
];
export const SP_HOW = [
  { value: "directo", label: msg("Directo") },
  { value: "rechace", label: msg("Rechace") },
  { value: "segunda_jugada", label: msg("Segunda jugada") },
  { value: "ensayada", label: msg("Jugada ensayada") },
];
// Cómo se creó el gol (según la fase) y cómo acabó
const OTROS = [{ value: "error_portero", label: msg("Error del portero") }, { value: "error_individual", label: msg("Error individual (pase o control)") }];
export const CREATE_ORG = [
  { value: "centro_lateral", label: msg("Centro lateral") },
  { value: "combinacion_interior", label: msg("Combinación interior") },
  { value: "ruptura", label: msg("Ruptura al espacio") },
  { value: "accion_individual", label: msg("Acción individual") },
  { value: "entre_lineas", label: msg("Juego entre líneas") },
  { value: "cambio_orientacion", label: msg("Cambio de orientación") },
  { value: "rechace", label: msg("Rechace / segunda jugada") },
  { value: "tiro_lejano", label: msg("Tiro lejano") },
  ...OTROS,
];
export const CREATE_TRANS = [
  { value: "robo_alto", label: msg("Robo alto (presión)") },
  { value: "contraataque", label: msg("Contraataque") },
  { value: "perdida_salida", label: msg("Pérdida en salida de balón") },
  ...OTROS,
];
export const CREATE_ALL = [...CREATE_ORG, ...CREATE_TRANS.filter((t) => !CREATE_ORG.some((o) => o.value === t.value))];
export const FINISHES = [
  { value: "cabeza", label: msg("Cabeza") },
  { value: "pie_dominante", label: msg("Pie dominante") },
  { value: "pie_no_dominante", label: msg("Pie no dominante") },
  { value: "volea", label: msg("Volea") },
  { value: "vaselina", label: msg("Vaselina") },
  { value: "uno_contra_uno", label: msg("1 contra 1 con el portero") },
  { value: "rechace_portero", label: msg("Rechace del portero") },
];
const find = (list, v) => list.find((x) => x.value === v)?.label || "";
const same = (s) => s;

// Valores antiguos de goal_type → clasificación nueva (para no perder lo ya registrado)
const LEGACY = {
  dentro_area: { area: "dentro" },
  fuera_area: { area: "fuera" },
  centro_lateral: { phase: "ataque_organizado", area: "dentro", create: "centro_lateral" },
  ataque_posicional: { phase: "ataque_organizado" },
  contraataque: { phase: "transicion", create: "contraataque" },
  perdida_salida: { phase: "transicion", create: "perdida_salida" },
  penalti: { phase: "balon_parado", sp: "penalti" },
  esquina: { phase: "balon_parado", sp: "corner" },
  balon_parado: { phase: "balon_parado", sp: "falta_lateral" },
  saque_centro: { phase: "balon_parado", sp: "saque_centro" },
  saque_porteria: { phase: "balon_parado", sp: "saque_puerta" },
  gol_propio: { phase: "gol_propio" },
};

// Objeto guardado en goal_events → clasificación {phase, area, sector, sp, how}
export const fromStored = (g = {}) => {
  const legacy = g.goal_phase ? {} : (LEGACY[g.goal_type] || {});
  return { phase: g.goal_phase || legacy.phase || "", area: g.goal_area || legacy.area || "", sector: g.goal_sector || "", sp: g.goal_sp || legacy.sp || "", how: g.goal_how || "", create: g.goal_create || legacy.create || "", finish: g.goal_finish || "" };
};

// Clasificación → campos para guardar (incluye goal_type antiguo para que lo existente siga funcionando)
export const toStored = (c = {}) => {
  let goal_type = null;
  if (c.phase === "ataque_organizado") goal_type = "ataque_posicional";
  else if (c.phase === "transicion") goal_type = "contraataque";
  else if (c.phase === "gol_propio") goal_type = "gol_propio";
  else if (c.phase === "balon_parado") goal_type = { penalti: "penalti", corner: "esquina", saque_centro: "saque_centro", saque_puerta: "saque_porteria" }[c.sp] || "balon_parado";
  return { goal_type, goal_phase: c.phase || null, goal_area: c.area || null, goal_sector: c.sector || null, goal_sp: c.sp || null, goal_how: c.how || null, goal_create: c.create || null, goal_finish: c.finish || null };
};

// Texto corto: "Ataque organizado · Dentro · Derecha" / "Córner · Rechace · Izquierda"
export const goalLabel = (c = {}, t = same) => {
  const f = (list, v) => { const x = find(list, v); return x ? t(x) : x; };
  if (!c.phase && !c.area) return "";
  if (c.phase === "balon_parado") return [f(SP_TYPES, c.sp) || t(msg("Balón parado")), c.sp !== "penalti" && f(SP_HOW, c.how), c.sp !== "penalti" && f(GOAL_SECTORS, c.sector), f(FINISHES, c.finish)].filter(Boolean).join(" · ");
  if (c.phase === "gol_propio") return t(msg("Gol en propia"));
  return [f(GOAL_PHASES, c.phase), f(CREATE_ALL, c.create), c.area && (c.area === "dentro" ? t(msg("Dentro")) : t(msg("Fuera"))), f(GOAL_SECTORS, c.sector), f(FINISHES, c.finish)].filter(Boolean).join(" · ");
};
