// Clasificación de goles (marcados y encajados): fase de juego, zona/sector y detalle de balón parado.
export const GOAL_PHASES = [
  { value: "ataque_organizado", label: "Ataque organizado" },
  { value: "transicion", label: "Transición" },
  { value: "balon_parado", label: "Balón parado" },
  { value: "gol_propio", label: "Gol en propia" },
];
export const GOAL_AREAS = [{ value: "dentro", label: "Dentro del área" }, { value: "fuera", label: "Fuera del área" }];
export const GOAL_SECTORS = [{ value: "izquierda", label: "Izquierda" }, { value: "centro", label: "Centro" }, { value: "derecha", label: "Derecha" }];
export const SP_TYPES = [
  { value: "penalti", label: "Penalti" },
  { value: "corner", label: "Córner" },
  { value: "falta_lateral", label: "Falta lateral" },
  { value: "falta_frontal", label: "Falta frontal" },
  { value: "saque_banda", label: "Saque de banda" },
  { value: "saque_centro", label: "Saque de centro" },
  { value: "saque_puerta", label: "Saque de puerta" },
];
export const SP_HOW = [
  { value: "directo", label: "Directo" },
  { value: "rechace", label: "Rechace" },
  { value: "segunda_jugada", label: "Segunda jugada" },
  { value: "ensayada", label: "Jugada ensayada" },
];
// Cómo se creó el gol (según la fase) y cómo acabó
const OTROS = [{ value: "error_portero", label: "Error del portero" }, { value: "error_individual", label: "Error individual (pase o control)" }];
export const CREATE_ORG = [
  { value: "centro_lateral", label: "Centro lateral" },
  { value: "combinacion_interior", label: "Combinación interior" },
  { value: "ruptura", label: "Ruptura al espacio" },
  { value: "accion_individual", label: "Acción individual" },
  { value: "entre_lineas", label: "Juego entre líneas" },
  { value: "cambio_orientacion", label: "Cambio de orientación" },
  { value: "rechace", label: "Rechace / segunda jugada" },
  { value: "tiro_lejano", label: "Tiro lejano" },
  ...OTROS,
];
export const CREATE_TRANS = [
  { value: "robo_alto", label: "Robo alto (presión)" },
  { value: "contraataque", label: "Contraataque" },
  { value: "perdida_salida", label: "Pérdida en salida de balón" },
  ...OTROS,
];
export const CREATE_ALL = [...CREATE_ORG, ...CREATE_TRANS.filter((t) => !CREATE_ORG.some((o) => o.value === t.value))];
export const FINISHES = [
  { value: "cabeza", label: "Cabeza" },
  { value: "pie_dominante", label: "Pie dominante" },
  { value: "pie_no_dominante", label: "Pie no dominante" },
  { value: "volea", label: "Volea" },
  { value: "vaselina", label: "Vaselina" },
  { value: "uno_contra_uno", label: "1 contra 1 con el portero" },
  { value: "rechace_portero", label: "Rechace del portero" },
];
const find = (list, v) => list.find((x) => x.value === v)?.label || "";

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
export const goalLabel = (c = {}) => {
  if (!c.phase && !c.area) return "";
  if (c.phase === "balon_parado") return [find(SP_TYPES, c.sp) || "Balón parado", c.sp !== "penalti" && find(SP_HOW, c.how), c.sp !== "penalti" && find(GOAL_SECTORS, c.sector), find(FINISHES, c.finish)].filter(Boolean).join(" · ");
  if (c.phase === "gol_propio") return "Gol en propia";
  return [find(GOAL_PHASES, c.phase), find(CREATE_ALL, c.create), c.area && (c.area === "dentro" ? "Dentro" : "Fuera"), find(GOAL_SECTORS, c.sector), find(FINISHES, c.finish)].filter(Boolean).join(" · ");
};
