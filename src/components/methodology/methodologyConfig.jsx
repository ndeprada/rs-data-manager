// Configuración centralizada de categorías y etiquetas

export const GAME_MOMENTS = [
  { value: "juego_ataque", label: "Juego en Ataque", color: "#2563eb", bg: "#dbeafe" },
  { value: "juego_defensa", label: "Juego en Defensa", color: "#dc2626", bg: "#fee2e2" },
  { value: "transicion_ataque_defensa", label: "Trans. At→Def", color: "#7c3aed", bg: "#ede9fe" },
  { value: "transicion_defensa_ataque", label: "Trans. Def→At", color: "#059669", bg: "#d1fae5" },
  { value: "balon_parado", label: "Balón Parado", color: "#d97706", bg: "#fef3c7" },
  { value: "fisico", label: "Físico", color: "#0891b2", bg: "#cffafe" },
  { value: "ninguno", label: "Sin categoría", color: "#6b7280", bg: "#f3f4f6" },
];

export const TACTICAL_ASPECTS = [
  // Momentos
  { value: "presion", label: "Presión", group: "Táctica" },
  { value: "salida_balon", label: "Salida de Balón", group: "Táctica" },
  { value: "juego_posicion", label: "Juego de Posición", group: "Táctica" },
  { value: "contraataque", label: "Contraataque", group: "Táctica" },
  { value: "repliegue", label: "Repliegue", group: "Táctica" },
  { value: "estrategia", label: "Estrategia", group: "Táctica" },
  // Físico
  { value: "resistencia", label: "Resistencia", group: "Físico" },
  { value: "velocidad", label: "Velocidad", group: "Físico" },
  { value: "fuerza", label: "Fuerza", group: "Físico" },
  { value: "coordinacion", label: "Coordinación", group: "Físico" },
  { value: "flexibilidad", label: "Flexibilidad", group: "Físico" },
  { value: "ninguno", label: "Sin aspecto", group: "Otro" },
];

export const SESSION_PHASES = [
  { value: "calentamiento", label: "Calentamiento", color: "#f59e0b" },
  { value: "parte_principal", label: "Parte Principal", color: "#8B1A2B" },
  { value: "vuelta_calma", label: "Vuelta a la Calma", color: "#6b7280" },
];

export const DIFFICULTY_LEVELS = [
  { value: "baja", label: "Baja", color: "#16a34a" },
  { value: "media", label: "Media", color: "#d97706" },
  { value: "alta", label: "Alta", color: "#dc2626" },
];

export const SESSION_STATUS = [
  { value: "planificada", label: "Planificada", color: "#2563eb" },
  { value: "realizada", label: "Realizada", color: "#16a34a" },
  { value: "cancelada", label: "Cancelada", color: "#dc2626" },
];

export function getGameMoment(value) {
  return GAME_MOMENTS.find(m => m.value === value) || GAME_MOMENTS[GAME_MOMENTS.length - 1];
}

export function getSessionPhase(value) {
  return SESSION_PHASES.find(p => p.value === value) || SESSION_PHASES[0];
}

export function getDifficulty(value) {
  return DIFFICULTY_LEVELS.find(d => d.value === value) || DIFFICULTY_LEVELS[1];
}