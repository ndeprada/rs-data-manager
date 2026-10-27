// Colores y textos compartidos por la pantalla de Planificación (campo, ventanas y listas). Scouting sigue en español (traducción pendiente, bloque 5).
// Verde = continúa, ámbar = duda, rojo = se va (baja del club o baja propia, con etiqueta), azul = objetivo de scouting, índigo = jugador seguido,
// fucsia = puesto a reforzar, gris con etiqueta verde azulado = pasa a otro equipo del club («Viene de…» en el equipo destino, con su color normal).

export const CHIP = {
  continua: "bg-white border-emerald-500 text-gray-900",
  duda: "bg-amber-100 border-amber-500 text-amber-950",
  sale: "bg-red-100 border-red-500 text-red-900",
  objetivo: "bg-sky-100 border-sky-500 border-dashed text-sky-950",
  seguido: "bg-indigo-50 border-indigo-400 border-dotted text-indigo-950",
  pasa: "bg-slate-100 border-slate-400 text-slate-600",
};
export const DOT = { continua: "bg-emerald-500", duda: "bg-amber-500", sale: "bg-red-500", objetivo: "bg-sky-500", seguido: "bg-indigo-400", pasa: "bg-slate-400" };
export const STATUS_BTN = {
  continua: "border-emerald-500 bg-emerald-50 text-emerald-800",
  duda: "border-amber-500 bg-amber-50 text-amber-800",
  sale: "border-red-500 bg-red-50 text-red-800",
  objetivo: "border-sky-500 bg-sky-50 text-sky-800",
  seguido: "border-indigo-400 bg-indigo-50 text-indigo-800",
};
export const LEAVE_TAG = "bg-red-600 text-white";
export const PASS_TAG = "bg-teal-600 text-white";
export const NEED_BG = "bg-fuchsia-600 text-white";

export const DECISION = {
  fichar: { label: "A · Fichar", cls: "bg-green-50 text-green-700 border-green-200" },
  seguir_viendo: { label: "B · Seguir viendo", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  descartar: { label: "C · Descartar", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};
