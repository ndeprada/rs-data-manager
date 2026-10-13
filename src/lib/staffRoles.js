// Roles y funciones del cuerpo técnico — fuente única para registro, accesos y personal.

export const CURRENT_SEASON = "2025-2026";

// Función de una persona en el club (campo app_role del usuario).
// teams: "required" = hay que indicar equipo(s) y rol en cada uno;
//        "optional" = puede además estar asignada a equipos concretos;
//        "none"     = rol general del club, sin equipos.
export const APP_FUNCTIONS = [
  { value: "coordinador_general", label: "Coordinador General", teams: "none" },
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

export const teamRoleLabel = (v) => TEAM_ROLES.find((r) => r.value === v)?.label || v || "Sin rol";

// Roles de equipo que implican entrenar (para el acceso "como entrenador")
export const COACHING_TEAM_ROLES = ["primer_entrenador", "segundo_entrenador", "asistente"];

export const functionConfig = (value) => APP_FUNCTIONS.find((f) => f.value === value) || null;
