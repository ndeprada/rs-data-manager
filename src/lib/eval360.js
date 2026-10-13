// Evaluación 360: perfil general del jugador (nota 1-10 por ítem).
// Ítems tomados del TFM "RCD Espanyol · Área de Metodología":
//  - 4.5.1 Perfil general del jugador (técnico, táctico, físico, mental)
//  - 4.6 Currículum por etapas (técnica ofensiva/defensiva, bases del juego, hábitos de juego)
// No reordenar ni cambiar los ids: se guardan en las evaluaciones.

export const AREAS = [
  {
    key: "tecnica",
    label: "Técnica",
    hint: "Fundamentos técnicos del currículum",
    items: [
      { id: "controles_orientados", label: "Controles orientados" },
      { id: "recepcion_girada", label: "Recepción girada" },
      { id: "control_invisible", label: "Dejar correr el balón (control invisible)" },
      { id: "pases", label: "Pases" },
      { id: "conduccion", label: "Conducción" },
      { id: "regate", label: "Regate y 1 contra 1" },
      { id: "tiro", label: "Tiro y finalización" },
      { id: "juego_cabeza", label: "Juego de cabeza" },
      { id: "entrada", label: "Entrada" },
      { id: "cobertura_balon", label: "Cobertura de balón" },
      { id: "ambos_perfiles", label: "Dominio de ambos perfiles" },
    ],
  },
  {
    key: "tactica",
    label: "Táctica",
    hint: "Comprensión del juego y comportamientos",
    items: [
      { id: "lectura_juego", label: "Lectura del juego (mirar antes y después de recibir)" },
      { id: "decisiones", label: "Toma de decisiones" },
      { id: "desmarques", label: "Desmarques (al pie y al espacio)" },
      { id: "ocupacion", label: "Ocupación racional del espacio" },
      { id: "juego_bloque", label: "Juego en bloque y distancias" },
      { id: "presion", label: "Presión (aproximación y entrada)" },
      { id: "colocacion", label: "Marcaje, colocación y coberturas" },
      { id: "transiciones", label: "Transiciones (presión tras pérdida y repliegue)" },
      { id: "comprension_modelo", label: "Comprensión del modelo de juego" },
      { id: "adaptabilidad", label: "Adaptabilidad a posiciones y contextos" },
      { id: "comunicacion_juego", label: "Comunicación (vivir el partido)" },
    ],
  },
  {
    key: "fisica",
    label: "Física",
    hint: "Capacidades físicas del perfil de jugador",
    items: [
      { id: "velocidad", label: "Velocidad y cambio de ritmo" },
      { id: "potencia", label: "Potencia y salto" },
      { id: "resistencia", label: "Repetir esfuerzos de alta intensidad" },
      { id: "grandes_espacios", label: "Atacar y defender grandes espacios" },
      { id: "agilidad", label: "Agilidad y coordinación" },
      { id: "fuerza_duelo", label: "Fuerza y duelos (usar el cuerpo)" },
      { id: "recuperacion", label: "Recuperación entre esfuerzos" },
    ],
  },
  {
    key: "mental",
    label: "Mental",
    hint: "Actitud y aspectos mentales",
    items: [
      { id: "competitivo", label: "Competitividad" },
      { id: "trabajador", label: "Trabajo y esfuerzo" },
      { id: "mejora_continua", label: "Mentalidad de mejora continua" },
      { id: "humildad", label: "Humildad" },
      { id: "motivacion", label: "Motivación" },
      { id: "concentracion", label: "Concentración" },
      { id: "liderazgo", label: "Liderazgo" },
      { id: "trabajo_equipo", label: "Trabajo en equipo" },
      { id: "gestion_error", label: "Gestión del error y resiliencia" },
      { id: "compromiso", label: "Compromiso y disciplina" },
    ],
  },
];

// Portero: sustituye los ítems técnicos por los de su perfil (catálogo de competencias técnicas del portero).
export const GK_TECH_ITEMS = [
  { id: "gk_bajo_palos", label: "Acciones defensivas bajo palos" },
  { id: "gk_salidas", label: "Salidas (seguridad y precisión)" },
  { id: "gk_juego_aereo", label: "Juego aéreo" },
  { id: "gk_pies", label: "Juego con los pies (construcción y reinicio)" },
  { id: "gk_posicionamiento", label: "Posicionamiento y coordinación con la línea defensiva" },
  { id: "gk_reinicio", label: "Reinicio rápido del juego" },
];

export function areasFor(position) {
  if (position !== "portero") return AREAS;
  return AREAS.map((a) => (a.key === "tecnica" ? { ...a, items: GK_TECH_ITEMS } : a));
}

const round1 = (n) => Math.round(n * 10) / 10;

// scores: { tecnica: { itemId: 1..10 }, ... } -> { tecnica: media | null, ..., overall }
export function computeAverages(scores = {}) {
  const out = {};
  const vals = [];
  AREAS.forEach((a) => {
    const nums = Object.values(scores[a.key] || {}).map(Number).filter((n) => n >= 1 && n <= 10);
    out[a.key] = nums.length ? round1(nums.reduce((s, n) => s + n, 0) / nums.length) : null;
    if (out[a.key] !== null) vals.push(out[a.key]);
  });
  out.overall = vals.length ? round1(vals.reduce((s, n) => s + n, 0) / vals.length) : null;
  return out;
}

export function scoreColor(v) {
  if (v == null) return "#9ca3af";
  if (v >= 8) return "#16a34a";
  if (v >= 6) return "#6b1f28";
  if (v >= 4) return "#ea580c";
  return "#dc2626";
}
