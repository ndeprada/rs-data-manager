// Formaciones de la pestaña Táctica y posición de cada jugador en el campo (la usan la pizarra y la hoja del entrenador en PDF).
export const FORMATIONS_F11 = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-5-1", "4-1-4-1"];

// Fútbol 7 (etapas S8 a S12), según el modelo del club (TFM: posicionamiento básico, 4.8.13/4.8.14) y lo que pidió Nacho el 25/10/2026.
// La primera es la táctica por defecto: el sistema base. Las claves se guardan en cada plan de partido (no cambiarlas); lo que ve
// la gente es la etiqueta (`FORMATION_LABELS`).
//   «3-1-2»        BASE: portero · central y dos laterales MÁS ADELANTADOS que el central · mediapunta · dos extremos abiertos, por encima del mediapunta
//   «3-1-2 puntas» la misma defensa y mediapunta · dos puntas (por dentro) en lugar de los extremos abiertos
//   «3-2-1»        la misma defensa · dos medios y un solo punta
//   «2-3-1»        dos atrás, tres en medio y un punta
export const FORMATIONS_F7 = ["3-1-2", "3-1-2 puntas", "3-2-1", "2-3-1"];
// Sistemas de F7 anteriores que ya no se ofrecen, pero se siguen entendiendo para que un partido ya preparado con ellos se vea igual que lo dejó
// (aparecen en el desplegable solo si ese partido los usa).
export const LEGACY_F7 = ["2-2-2", "1-3-2"];
// Claves que estuvieron publicadas unos minutos el 25/10/2026 con otro nombre; se leen como las de ahora.
const FORMATION_ALIASES = { "3-2-1 base": "3-1-2", "3-2-1 medios": "3-2-1" };
export const normalizeFormation = (f) => FORMATION_ALIASES[f] || f;

export const FORMATION_LABELS = {
  "3-1-2": "3-1-2 · Base",
  "3-1-2 puntas": "3-1-2 · 2 puntas",
  "3-2-1": "3-2-1 · 2 medios y 1 punta",
  "2-2-2": "2-2-2 (antiguo)",
  "1-3-2": "1-3-2 (antiguo)",
};
export const formationLabel = (f) => FORMATION_LABELS[normalizeFormation(f)] || f;
export const formationsFor = (isF7) => (isF7 ? FORMATIONS_F7 : FORMATIONS_F11);
/** ¿Es una formación válida para ese formato? (las antiguas de F7 también) */
export const isFormationOf = (isF7, f) => formationsFor(isF7).includes(f) || (isF7 && LEGACY_F7.includes(f));
/** Formaciones para el desplegable: las del formato y, si el partido usa una antigua, esa también. */
export const formationOptions = (isF7, current) => (isF7 && LEGACY_F7.includes(current) ? [...FORMATIONS_F7, current] : formationsFor(isF7));

// Quién ocupa cada hueco en los sistemas de F7 (el hueco 0 es siempre el portero). Solo documenta y sirve a los tests.
export const F7_SLOT_ROLES = {
  "3-1-2":        ["portero", "lateral", "central", "lateral", "mediapunta", "extremo", "extremo"],
  "3-1-2 puntas": ["portero", "lateral", "central", "lateral", "mediapunta", "punta", "punta"],
  "3-2-1":        ["portero", "lateral", "central", "lateral", "medio", "medio", "punta"],
};

// Positions as [x%, y%] — origin top-left, attack towards top
// 4-3-3: MC pivot retrasado (50,52), dos MCO avanzados (28,42)(72,42)
//        Extremos adelantados (18,18)(82,18), DC ligeramente más retrasado (50,24)
export const FORMATION_POSITIONS = {
  "4-3-3":    [[50,88],[18,68],[38,68],[62,68],[82,68],[28,42],[50,52],[72,42],[18,18],[50,24],[82,18]],
  "4-4-2":    [[50,88],[18,68],[38,68],[62,68],[82,68],[18,46],[38,46],[62,46],[82,46],[35,20],[65,20]],
  "4-2-3-1":  [[50,88],[18,68],[38,68],[62,68],[82,68],[35,54],[65,54],[22,38],[50,34],[78,38],[50,16]],
  "3-5-2":    [[50,88],[25,68],[50,68],[75,68],[10,50],[30,46],[50,44],[70,46],[90,50],[35,20],[65,20]],
  "3-4-3":    [[50,88],[25,68],[50,68],[75,68],[18,48],[40,48],[60,48],[82,48],[22,22],[50,18],[78,22]],
  "5-3-2":    [[50,88],[10,68],[28,68],[50,68],[72,68],[90,68],[28,46],[50,42],[72,46],[35,20],[65,20]],
  "4-5-1":    [[50,88],[18,68],[38,68],[62,68],[82,68],[12,46],[32,44],[52,44],[72,44],[88,46],[50,18]],
  "4-1-4-1":  [[50,88],[18,68],[38,68],[62,68],[82,68],[50,56],[18,40],[38,40],[62,40],[82,40],[50,18]],
  // Fútbol 7, sistemas del club (ataque, hacia arriba). La defensa de tres es la misma en los tres: el central, más atrás, y los dos laterales
  // por delante de él, como en el posicionamiento básico del TFM. Orden de huecos: portero, lateral izq., central, lateral der., …
  "3-1-2":        [[50,88],[22,61],[50,70],[78,61],[50,40],[17,26],[83,26]],   // BASE (la de siempre): mediapunta (50,40) algo por debajo de los extremos abiertos (y 26)
  "3-1-2 puntas": [[50,88],[22,61],[50,70],[78,61],[50,40],[36,22],[64,22]],   // el mismo mediapunta y dos puntas por dentro
  "3-2-1":        [[50,88],[22,61],[50,70],[78,61],[32,44],[68,44],[50,20]],   // dos medios y un solo punta
  "2-3-1":    [[50,88],[30,72],[70,72],[20,50],[50,46],[80,50],[50,20]],
  // F7 de antes, sin cambios (solo se ven si un partido ya los usa)
  "2-2-2":    [[50,88],[30,70],[70,70],[30,46],[70,46],[30,22],[70,22]],
  "1-3-2":    [[50,88],[50,72],[22,52],[50,48],[78,52],[30,22],[70,22]],
};
