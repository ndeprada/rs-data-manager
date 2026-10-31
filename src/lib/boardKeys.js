// Atajos de teclado de la pizarra (al estilo de FmStadio). Sin importaciones de la app para poder probarlo en Node.
// Se lee la tecla física (`code`), así funcionan igual con Mayús, Alt (que en Mac cambia la letra) y en cualquier distribución
// de teclado. Devuelve el nombre de la acción o null; el editor decide qué hace con ella.

const MOD = (e) => e.ctrlKey || e.metaKey;

export function boardKeyAction(e, { hasSel = false } = {}) {
  const code = e.code || "";
  const k = code.startsWith("Key") ? code.slice(3).toLowerCase() : code.startsWith("Digit") ? code.slice(5) : code.startsWith("Numpad") && /\d$/.test(code) ? code.slice(-1) : code;
  // Ctrl/Cmd (o Alt) + Z deshacer, con Mayús rehacer; Ctrl+Y rehacer
  if ((MOD(e) || e.altKey) && k === "z") return e.shiftKey ? "redo" : "undo";
  if (MOD(e) && k === "y") return "redo";
  if (MOD(e) && k === "a") return "selectAll";
  if (MOD(e) && k === "d") return hasSel ? "duplicate" : null;
  if (MOD(e)) return null; // el resto de Ctrl/Cmd se lo queda el navegador (copiar, imprimir…)
  if (e.altKey) {
    if (k === "a") return "cycleArrow";
    if (k === "d") return "cycleZone";
    if (k === "t") return "cycleMaterial";
    if (k === "ArrowRight" || k === "ArrowDown") return "lastFrame";
    if (k === "ArrowLeft" || k === "ArrowUp") return "firstFrame";
    return null;
  }
  if (k === "Delete" || k === "Backspace") return hasSel ? (e.shiftKey ? "deleteHere" : "delete") : null;
  if (k.startsWith("Arrow")) {
    // con algo elegido, las flechas lo mueven; sin nada, pasan de fotograma
    if (hasSel) return `nudge${k.slice(5)}`;
    return k === "ArrowRight" || k === "ArrowDown" ? "nextFrame" : "prevFrame";
  }
  if (e.shiftKey && (k === "h" || k === "Slash")) return "help";
  if (e.shiftKey) return null;
  if (/^[0-9]$/.test(k)) return k === "0" ? "ball" : `team${k}`;
  const single = { v: "select", a: "arrow", d: "zone", e: "text", t: "material", c: "cone", l: "link", n: "addFrame", m: "removeFrame", j: "trail", y: "alignH", u: "alignV", i: "spread", Space: "play", Equal: "zoomIn", NumpadAdd: "zoomIn", Minus: "zoomOut", NumpadSubtract: "zoomOut" };
  return single[k] || null;
}

// Lista para la ayuda (en el orden en que se enseña)
export const BOARD_SHORTCUTS = [
  { group: "Herramientas", items: [
    ["V", "Mover / elegir"],
    ["1 … 9", "Fichas del equipo 1, 2, 3…"],
    ["0", "Balón"],
    ["A", "Flecha (Alt + A cambia de tipo)"],
    ["D", "Zona (Alt + D cambia de forma)"],
    ["E", "Texto"],
    ["T", "Material (Alt + T cambia de material)"],
    ["C", "Cono"],
    ["L", "Unir fichas"],
  ] },
  { group: "Lo elegido", items: [
    ["Supr", "Quitar de todos los fotogramas"],
    ["Mayús + Supr", "Quitar solo de este fotograma"],
    ["Flechas", "Mover 0,5 m (con Mayús, 2 m)"],
    ["Ctrl + D", "Duplicar"],
    ["Ctrl + A", "Elegir todo"],
    ["Y", "Alinear en horizontal"],
    ["U", "Alinear en vertical"],
    ["I", "Repartir con el mismo hueco"],
  ] },
  { group: "Fotogramas", items: [
    ["N", "Nuevo fotograma"],
    ["M", "Quitar el fotograma"],
    ["→ / ↓", "Siguiente (sin nada elegido)"],
    ["← / ↑", "Anterior (sin nada elegido)"],
    ["Alt + → / ←", "Último / primero"],
    ["Espacio", "Reproducir / parar"],
    ["J", "Rastro sí / no"],
  ] },
  { group: "General", items: [
    ["Ctrl + Z", "Deshacer"],
    ["Ctrl + Mayús + Z", "Rehacer (también Ctrl + Y)"],
    ["+ / −", "Acercar / alejar"],
    ["Mayús + H", "Esta ayuda"],
  ] },
];
