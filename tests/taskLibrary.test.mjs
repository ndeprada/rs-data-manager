import test from "node:test";
import assert from "node:assert/strict";
import {
  libraryToSessionTask, sessionTaskToLibrary, sessionTypeOfLibrary, libraryTypeOfSession, phasesOfMoment, momentOfPhases,
  staffFromLibrary, staffToLibrary, descriptionFromLibrary, descriptionToLibrary, filterLibraryTasks,
} from "../src/lib/taskLibrary.js";
import { TASK_TYPES, taskMinutes } from "../src/lib/sessionPlan.js";

const lib = {
  id: "L1", name: "Rondo 4v2 con comodines", description: "Cuadrado de 10x10.\nSe pierde y se presiona.", duration_minutes: 12,
  session_phase: "calentamiento", task_type: "rondo", game_moment: "juego_ataque", principles: "Mantener la posesión", sub_principles: "Apoyos",
  corrections: "Perfilarse antes de recibir", scoring: "10 pases = 1 punto", players_count: "6", space: "10x10m", variants: "Dos toques\nUn toque",
  coaching_points_1e: "Orientar el cuerpo", coaching_points_ea_m: "", coaching_points_ea_i: "Hablar\nSeñalar", diagram_url: "https://x/y.png",
  board: { v: 2, field: "half", frames: [{ id: "f", els: [{ id: "a", k: "token", x: 1, y: 2 }] }] }, tags: ["rondo"], notes: "Solo para mí",
};

test("tipos: cada tipo de la biblioteca lleva a un tipo de sesión que existe, y se vuelve a un tipo de la biblioteca", () => {
  const ids = new Set(TASK_TYPES.map((t) => t.id));
  for (const t of ["parejas", "analitico", "finalizaciones", "figura_pases", "rondo", "juego_posicion", "juego_aplicacion", "juego_posesion", "juego_situacion", "partido", "partido_reducido", "abp", "preparacion_partido", "juego", "activacion_sin_balon"]) {
    assert.ok(ids.has(sessionTypeOfLibrary(t)), `${t} → ${sessionTypeOfLibrary(t)}`);
  }
  assert.equal(sessionTypeOfLibrary("raro"), "");
  assert.equal(libraryTypeOfSession("conservacion"), "juego_posesion");
  assert.equal(libraryTypeOfSession("pf"), "", "lo que no tiene equivalente se deja sin tipo");
  for (const t of TASK_TYPES) if (libraryTypeOfSession(t.id)) assert.ok(libraryTypeOfSession(t.id).length > 0);
});

test("momento del juego ↔ fases", () => {
  assert.deepEqual(phasesOfMoment("juego_defensa"), ["defensa_org"]);
  assert.deepEqual(phasesOfMoment("transicion_defensa_ataque"), ["trans_of"]);
  assert.deepEqual(phasesOfMoment("fisico"), []);
  assert.equal(momentOfPhases(["trans_def"]), "transicion_ataque_defensa");
  assert.equal(momentOfPhases(["ataque_org", "trans_of"]), "ninguno", "varias fases no se reducen a un solo momento");
  assert.equal(momentOfPhases([]), "ninguno");
});

test("de la biblioteca a la sesión: título, tiempo, descripción con datos, objetivo, fases, correcciones y dibujo", () => {
  const t = libraryToSessionTask(lib, "inicial");
  assert.equal(t.part, "inicial");
  assert.equal(t.title, "Rondo 4v2 con comodines");
  assert.equal(t.type, "rondo");
  assert.equal(taskMinutes(t), 12);
  assert.equal(t.description, "Cuadrado de 10x10.\nSe pierde y se presiona.\nJugadores: 6 · Espacio: 10x10m\nVariantes: Dos toques · Un toque");
  assert.equal(t.objective, "Mantener la posesión · Apoyos");
  assert.deepEqual(t.phases, ["ataque_org"]);
  assert.equal(t.corrections, "Perfilarse antes de recibir");
  assert.equal(t.staff_corrections, "1E N: Orientar el cuerpo\nEA I: Hablar · Señalar");
  assert.equal(t.scoring, "10 pases = 1 punto");
  assert.equal(t.diagram_url, "https://x/y.png");
  assert.deepEqual(t.from_library, { id: "L1", name: "Rondo 4v2 con comodines" });
  assert.deepEqual(t.principal, [], "los contenidos del currículum se eligen después");
  assert.notEqual(t.board, lib.board, "el dibujo se copia: cambiarlo en la sesión no toca la biblioteca");
  t.board.frames[0].els[0].x = 99;
  assert.equal(lib.board.frames[0].els[0].x, 1);
});

test("cada carga crea una tarea nueva con su propio id y una tarea casi vacía no rompe nada", () => {
  const a = libraryToSessionTask(lib, "principal");
  const b = libraryToSessionTask(lib, "principal");
  assert.notEqual(a.id, b.id);
  const v = libraryToSessionTask({ name: "  Solo nombre " });
  assert.equal(v.title, "Solo nombre");
  assert.equal(v.serie_min, 0);
  assert.equal(v.board, null);
  assert.equal(v.description, "");
  assert.equal(v.diagram_url, undefined);
  assert.deepEqual(libraryToSessionTask({}).phases, []);
});

test("de la sesión a la biblioteca: se recuperan jugadores, espacio, variantes y puntos de entrenamiento", () => {
  const s = libraryToSessionTask(lib, "principal");
  const back = sessionTaskToLibrary(s);
  assert.equal(back.name, lib.name);
  assert.equal(back.description, "Cuadrado de 10x10.\nSe pierde y se presiona.");
  assert.equal(back.players_count, "6");
  assert.equal(back.space, "10x10m");
  assert.equal(back.variants, "Dos toques · Un toque");
  assert.equal(back.coaching_points_1e, "Orientar el cuerpo");
  assert.equal(back.coaching_points_ea_i, "Hablar · Señalar");
  assert.equal(back.coaching_points_ea_m, "");
  assert.equal(back.duration_minutes, 12);
  assert.equal(back.session_phase, "parte_principal");
  assert.equal(back.task_type, "rondo");
  assert.equal(back.game_moment, "juego_ataque");
  assert.equal(back.principles, "Mantener la posesión · Apoyos");
  assert.equal(back.football_format, "ambos");
  assert.equal(back.difficulty, "media");
  assert.deepEqual(back.board, lib.board);
  assert.equal(sessionTaskToLibrary(s, "inicial").session_phase, "calentamiento");
});

test("una tarea hecha a mano en la sesión también se guarda: tiempo redondeado, líneas sueltas a notas", () => {
  const task = {
    part: "principal", title: "Salida de balón", type: "juego_posicion", series: 3, serie_min: 4, rec_min: 1, total_override: "",
    description: "Organización 4-3-3.", objective: "Salir jugando", phases: ["ataque_org", "trans_of"], staff_corrections: "1E N: Pase al pie\nOjo con el tiempo de juego\nea m: Ocupar espacios", board: null,
  };
  const l = sessionTaskToLibrary(task);
  assert.equal(l.duration_minutes, 14, "3×4’ + 2×1’");
  assert.equal(l.game_moment, "ninguno");
  assert.equal(l.coaching_points_1e, "Pase al pie");
  assert.equal(l.coaching_points_ea_m, "Ocupar espacios", "la etiqueta se reconoce aunque esté en minúsculas");
  assert.equal(l.notes, "Ojo con el tiempo de juego");
  assert.equal(l.board, null);
  assert.equal(l.players_count, "");
  assert.equal(sessionTaskToLibrary({ title: "x" }).duration_minutes, 15, "sin tiempo se propone 15’");
  assert.equal(sessionTaskToLibrary({ title: "x", series: 1, serie_min: 7.5 }).duration_minutes, 8);
});

test("la descripción solo separa las líneas con el formato exacto y deja el resto como está", () => {
  assert.equal(descriptionFromLibrary({ description: "A", players_count: "", space: "20x30" }), "A\nEspacio: 20x30");
  assert.equal(descriptionFromLibrary({ players_count: 8 }), "Jugadores: 8");
  const raro = descriptionToLibrary("Jugadores: unos cuantos\nEspacio: la mitad\nTexto");
  assert.equal(raro.players_count, "", "«unos cuantos» no es un número: se queda en la descripción");
  assert.equal(raro.space, "la mitad");
  assert.equal(raro.description, "Jugadores: unos cuantos\nTexto");
  assert.equal(descriptionToLibrary("").description, "");
});

test("puntos de entrenamiento: idas y vueltas", () => {
  assert.equal(staffFromLibrary({}), "");
  const text = staffFromLibrary({ coaching_points_ea_m: "Línea 1\nLínea 2" });
  assert.equal(text, "EA M: Línea 1 · Línea 2");
  assert.deepEqual(staffToLibrary("").fields, {});
  assert.equal(staffToLibrary("EA I:   \nsuelto").rest, "EA I:\nsuelto", "una etiqueta sin texto no cuenta como punto de entrenamiento");
});

test("buscar en la biblioteca: sin tildes, por palabras y por fase", () => {
  const all = [
    { id: 1, name: "Rondo de presión", session_phase: "calentamiento", tags: ["rondo"] },
    { id: 2, name: "Finalización 1v1", session_phase: "parte_principal", description: "Duelos ante el portero" },
    { id: 3, name: "Juego de posición 4v4+3", session_phase: "parte_principal", space: "40x30" },
  ];
  assert.deepEqual(filterLibraryTasks(all).map((t) => t.id), [1, 2, 3]);
  assert.deepEqual(filterLibraryTasks(all, { query: "presion" }).map((t) => t.id), [1]);
  assert.deepEqual(filterLibraryTasks(all, { query: "posicion 4v4" }).map((t) => t.id), [3]);
  assert.deepEqual(filterLibraryTasks(all, { phase: "parte_principal" }).map((t) => t.id), [2, 3]);
  assert.deepEqual(filterLibraryTasks(all, { query: "portero", phase: "calentamiento" }).map((t) => t.id), []);
  assert.deepEqual(filterLibraryTasks(undefined), []);
});
