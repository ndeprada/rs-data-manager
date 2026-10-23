// Qué entrenadores ve cada coordinador de etapa (F7 / F11). Una sola regla para la lista de Entrenadores y para la ficha:
// un entrenador pertenece a la etapa de TODOS los equipos que lleva (puede llevar uno de F7 y otro de F11), no solo al primero.
export const isStageF7 = (team) => {
  if (!team) return false;
  const cat = (team.category || "").toLowerCase();
  return cat.includes("alevin") || cat.includes("benjamin") || cat.includes("benjami") || cat.includes("prebenjami") || cat.includes("ludica") || cat.includes("f7");
};
export const isStageF11 = (team) => !isStageF7(team);

export const STAGE_COORD_ROLES = ["coordinador_f7", "coordinador_f11"];

// ¿Le toca a este coordinador de etapa ver a un entrenador que lleva estos equipos? Basta con que lleve uno de su etapa.
export function stageSeesCoach(coordType, teams = []) {
  if (coordType === "coordinador_f7") return teams.some(isStageF7);
  if (coordType === "coordinador_f11") return teams.some(isStageF11);
  return false;
}
