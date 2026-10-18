// Roles y funciones del cuerpo técnico — fuente única para registro, accesos y personal.

// La temporada empieza en agosto: de agosto de 2026 a julio de 2027 es "2026-2027".
export function seasonFor(date = new Date()) {
  const start = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${start + 1}`;
}
export const CURRENT_SEASON = seasonFor();

// Función de una persona en el club (campo app_role del usuario).
// teams: "required" = hay que indicar equipo(s) y rol en cada uno;
//        "optional" = puede además estar asignada a equipos concretos;
//        "none"     = rol general del club, sin equipos.
export const APP_FUNCTIONS = [
  { value: "director", label: "Director", teams: "optional", hint: "Acceso completo, como coordinación general" },
  { value: "director_deportivo", label: "Director Deportivo", teams: "optional", hint: "Acceso completo, como coordinación general" },
  { value: "coordinador_general", label: "Coordinador General", teams: "optional", hint: "Acceso a todos los equipos; añade los que además entrenes" },
  { value: "coordinador_f7", label: "Coordinador de etapa F7", teams: "optional" },
  { value: "coordinador_f11", label: "Coordinador de etapa F11", teams: "optional" },
  { value: "entrenador", label: "Entrenador", teams: "required" },
  { value: "entrenador_porteros", label: "Entrenador de Porteros", teams: "none", hint: "Rol general para todos los equipos" },
  { value: "preparador_fisico", label: "Preparador Físico", teams: "optional" },
  { value: "psicologo", label: "Psicólogo", teams: "optional" },
  { value: "fisioterapeuta", label: "Fisioterapeuta", teams: "optional" },
];

export const STAFF_FUNCTION_VALUES = APP_FUNCTIONS.map((f) => f.value);

export const FUNCTION_LABELS = {
  ...Object.fromEntries(APP_FUNCTIONS.map((f) => [f.value, f.label])),
  jugador: "Jugador",
  admin: "Admin",
};

// Rol concreto dentro de un equipo (TeamStaffAssignment.team_role)
export const TEAM_ROLES = [
  { value: "primer_entrenador", label: "1er Entrenador" },
  { value: "segundo_entrenador", label: "2º Entrenador" },
  { value: "asistente", label: "Asistente" },
  { value: "delegado", label: "Delegado" },
  { value: "analista", label: "Analista" },
  { value: "preparador_fisico", label: "Preparador Físico" },
  { value: "entrenador_porteros", label: "Entrenador de Porteros" },
  { value: "fisio", label: "Fisio" },
  { value: "coordinador", label: "Coordinador" },
];

// Roles que se ofrecen a quien se registra como entrenador
export const COACH_TEAM_ROLES = TEAM_ROLES.filter((r) =>
  ["primer_entrenador", "segundo_entrenador", "asistente", "delegado", "analista"].includes(r.value)
);

// Orden de visualización del cuerpo técnico de un equipo
const TEAM_ROLE_ORDER = ["primer_entrenador", "segundo_entrenador", "asistente", "preparador_fisico", "entrenador_porteros", "delegado", "fisio", "analista", "coordinador"];
export const teamRoleRank = (v) => { const i = TEAM_ROLE_ORDER.indexOf(v); return i === -1 ? 99 : i; };

export const teamRoleLabel = (v) => TEAM_ROLES.find((r) => r.value === v)?.label || v || "Sin rol";

// Roles de equipo que implican entrenar (para el acceso "como entrenador")
export const COACHING_TEAM_ROLES = ["primer_entrenador", "segundo_entrenador", "asistente"];

export const functionConfig = (value) => APP_FUNCTIONS.find((f) => f.value === value) || null;
