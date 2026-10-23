import { emptyTask, hasText, taskMinutes } from "./sessionPlan.js";

// Paso de tareas entre la biblioteca de tareas (TrainingTask) y las tareas de una sesión (CoachSession.initial/main.tasks).
// Son dos formatos distintos: la biblioteca guarda campos sueltos (jugadores, espacio, variantes, puntos de entrenamiento…)
// y la sesión una ficha más compacta. Aquí se convierte en los dos sentidos sin perder lo que se pueda conservar.

// ── Tipos ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const TO_SESSION = {
  parejas: "analitica", analitico: "analitica", figura_pases: "analitica", finalizaciones: "finalizacion", rondo: "rondo",
  juego_posicion: "juego_posicion", juego_aplicacion: "juego_aplicacion", juego_posesion: "conservacion", juego_situacion: "juego_situacion",
  partido: "partido", partido_reducido: "partido_reducido", abp: "abp", preparacion_partido: "plan_partido", juego: "juego_tecnico",
  activacion_sin_balon: "activacion",
};
const TO_LIBRARY = {
  circuito_tecnico: "analitico", analitica: "analitico", juego_tecnico: "juego", juego_persecucion: "juego", juego_velocidad: "juego",
  juego_aplicacion: "juego_aplicacion", rondo: "rondo", partido_reducido: "partido_reducido", finalizacion: "finalizaciones",
  juego_posicion: "juego_posicion", conservacion: "juego_posesion", oleada: "juego_situacion", automatismo: "analitico",
  juego_situacion: "juego_situacion", minipartido: "partido_reducido", partido: "partido", abp: "abp", activacion: "activacion_sin_balon",
  plan_partido: "preparacion_partido",
};
export const sessionTypeOfLibrary = (t) => TO_SESSION[t] || "";
export const libraryTypeOfSession = (t) => TO_LIBRARY[t] || "";

// ── Momento del juego ↔ fases de la sesión ───────────────────────────────────────────────────────────────────────────
const MOMENT_PHASES = {
  juego_ataque: ["ataque_org"], juego_defensa: ["defensa_org"], transicion_defensa_ataque: ["trans_of"], transicion_ataque_defensa: ["trans_def"], balon_parado: ["abp"],
};
export const phasesOfMoment = (m) => [...(MOMENT_PHASES[m] || [])];
export const momentOfPhases = (phases = []) => {
  if (phases.length !== 1) return "ninguno";
  return Object.keys(MOMENT_PHASES).find((m) => MOMENT_PHASES[m][0] === phases[0]) || "ninguno";
};

// ── Puntos de entrenamiento («1E N: …», «EA M: …», «EA I: …») ────────────────────────────────────────────────────────
const STAFF = [["1E N", "coaching_points_1e"], ["EA M", "coaching_points_ea_m"], ["EA I", "coaching_points_ea_i"]];
const oneLine = (s) => String(s).trim().replace(/\s*\n+\s*/g, " · ");
const labelKey = (s) => s.replace(/\s+/g, "").toLowerCase();

export function staffFromLibrary(lib) {
  return STAFF.filter(([, k]) => hasText(lib?.[k])).map(([label, k]) => `${label}: ${oneLine(lib[k])}`).join("\n");
}
// Devuelve { fields: { coaching_points_1e, … }, rest } con las líneas que no son de ningún entrenador
export function staffToLibrary(text) {
  const fields = {};
  const rest = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([^:]{2,6}):\s*(.*)$/.exec(line);
    const hit = m && STAFF.find(([label]) => labelKey(label) === labelKey(m[1]));
    if (hit && m[2].trim()) fields[hit[1]] = fields[hit[1]] ? `${fields[hit[1]]}\n${m[2].trim()}` : m[2].trim();
    else rest.push(line);
  }
  return { fields, rest: rest.join("\n") };
}

// ── Descripción: lo que la sesión no tiene como campo aparte (jugadores, espacio, variantes) va en líneas al final ──────
const RE_META = /^Jugadores:\s*(\d+)\s*(?:·\s*Espacio:\s*(.+))?$/;
const RE_SPACE = /^Espacio:\s*(.+)$/;
const RE_VARIANTS = /^Variantes:\s*(.+)$/;

export function descriptionFromLibrary(lib) {
  const lines = [];
  if (hasText(lib?.description)) lines.push(String(lib.description).trim());
  const players = String(lib?.players_count ?? "").trim();
  const space = String(lib?.space ?? "").trim();
  if (players && space) lines.push(`Jugadores: ${players} · Espacio: ${space}`);
  else if (players) lines.push(`Jugadores: ${players}`);
  else if (space) lines.push(`Espacio: ${space}`);
  if (hasText(lib?.variants)) lines.push(`Variantes: ${oneLine(lib.variants)}`);
  return lines.join("\n");
}
export function descriptionToLibrary(text) {
  const out = { description: [], players_count: "", space: "", variants: "" };
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    let m;
    if (!out.players_count && (m = RE_META.exec(line))) { out.players_count = m[1]; if (m[2]) out.space = m[2].trim(); }
    else if (!out.space && (m = RE_SPACE.exec(line))) out.space = m[1].trim();
    else if (!out.variants && (m = RE_VARIANTS.exec(line))) out.variants = m[1].trim();
    else out.description.push(raw);
  }
  return { ...out, description: out.description.join("\n").trim() };
}

const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

/** Tarea de la biblioteca → tarea de sesión (part: "inicial" | "principal"). La tarea de la biblioteca no se toca. */
export function libraryToSessionTask(lib, part = "principal") {
  const base = emptyTask(part);
  const objective = [lib?.principles, lib?.sub_principles].filter(hasText).map((s) => oneLine(s)).join(" · ");
  return {
    ...base,
    title: String(lib?.name ?? "").trim(),
    type: sessionTypeOfLibrary(lib?.task_type),
    series: 1,
    serie_min: Number(lib?.duration_minutes) > 0 ? Number(lib.duration_minutes) : 0,
    description: descriptionFromLibrary(lib),
    objective,
    phases: phasesOfMoment(lib?.game_moment),
    corrections: hasText(lib?.corrections) ? String(lib.corrections).trim() : "",
    staff_corrections: staffFromLibrary(lib),
    scoring: hasText(lib?.scoring) ? String(lib.scoring).trim() : "",
    board: lib?.board ? clone(lib.board) : null,
    ...(lib?.diagram_url ? { diagram_url: lib.diagram_url } : {}),
    from_library: { id: lib?.id ?? null, name: String(lib?.name ?? "").trim() },
  };
}

/** Tarea de sesión → datos para crear una tarea nueva en la biblioteca (la sesión no se toca). */
export function sessionTaskToLibrary(task, part = task?.part || "principal") {
  const meta = descriptionToLibrary(task?.description);
  const staff = staffToLibrary(task?.staff_corrections);
  const mins = taskMinutes(task);
  return {
    name: String(task?.title ?? "").trim(),
    description: meta.description,
    duration_minutes: mins > 0 ? Math.max(1, Math.round(mins)) : 15,
    session_phase: part === "inicial" ? "calentamiento" : "parte_principal",
    difficulty: "media",
    task_type: libraryTypeOfSession(task?.type),
    game_moment: momentOfPhases(task?.phases || []),
    tactical_aspect: "ninguno",
    notes: staff.rest,
    diagram_url: task?.diagram_url || "",
    board: task?.board ? clone(task.board) : null,
    media_files: [],
    football_format: "ambos",
    players_count: meta.players_count,
    space: meta.space,
    tags: [],
    principles: hasText(task?.objective) ? String(task.objective).trim() : "",
    sub_principles: "",
    corrections: hasText(task?.corrections) ? String(task.corrections).trim() : "",
    scoring: hasText(task?.scoring) ? String(task.scoring).trim() : "",
    variants: meta.variants,
    coaching_points_1e: staff.fields.coaching_points_1e || "",
    coaching_points_ea_m: staff.fields.coaching_points_ea_m || "",
    coaching_points_ea_i: staff.fields.coaching_points_ea_i || "",
  };
}

/** Filtra y ordena tareas de la biblioteca para elegir: por texto (nombre, descripción, etiquetas) y por fase de sesión. */
export function filterLibraryTasks(tasks = [], { query = "", phase = "" } = {}) {
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = norm(query).split(/\s+/).filter(Boolean);
  return tasks
    .filter((t) => (!phase || t.session_phase === phase))
    .filter((t) => {
      if (!words.length) return true;
      const hay = norm([t.name, t.description, t.principles, t.space, ...(t.tags || [])].join(" "));
      return words.every((w) => hay.includes(w));
    });
}
