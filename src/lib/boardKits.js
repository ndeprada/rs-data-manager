// Equipaciones para las fichas de la pizarra (galería «Equipaciones»), al estilo de FmStadio pero sin clubes: colores lisos,
// porteros, rayas, camisetas de diseños habituales (nombradas por sus colores, nunca por un club) y las del propio Racing Sarrià.
// Cada equipación es un parche para el equipo: { color, color2, pattern, kit, trim }. Sin importaciones de la app (se prueba en Node).

const solid = (name, color) => ({ name, kit: "boton", pattern: "solid", color });
const stripes = (name, color, color2) => ({ name, kit: "boton", pattern: "stripes", color, color2 });
const shirt = (name, color, color2, pattern, trim) => ({ name, kit: "camiseta", pattern, color, color2, trim });

export const KIT_GROUPS = [
  {
    id: "basicos", name: "Básicos", kits: [
      solid("Negro", "#1f1f1f"), solid("Azul", "#1d2fe0"), solid("Verde oscuro", "#1f5c34"), solid("Fucsia", "#e23ad6"),
      solid("Celeste", "#5aafe6"), solid("Verde claro", "#5cbf5a"), solid("Naranja", "#f0923a"), solid("Rosa", "#c3a6dc"),
      solid("Rojo", "#c02a2a"), solid("Blanco", "#f4f4f4"), solid("Amarillo", "#f5e04a"), solid("Granate", "#73000A"),
    ],
  },
  {
    id: "porteros", name: "Porteros", kits: [
      shirt("Verde flúor", "#7cf03a", "#1f1f1f", "solid", "#1f1f1f"), shirt("Naranja", "#FF6E00", "#1f1f1f", "solid", "#1f1f1f"),
      shirt("Azul eléctrico", "#1f6bff", "#ffffff", "solid", "#0b2a8a"), shirt("Amarillo", "#f5e04a", "#1f1f1f", "solid", "#1f1f1f"),
      shirt("Rosa", "#ff5fb0", "#1f1f1f", "solid", "#1f1f1f"), shirt("Negro", "#1f1f1f", "#7cf03a", "solid", "#7cf03a"),
      shirt("Gris", "#8a8f98", "#1f1f1f", "solid", "#1f1f1f"), shirt("Morado", "#6d3fd1", "#ffffff", "solid", "#ffffff"),
    ],
  },
  {
    id: "rayas", name: "Rayas", kits: [
      stripes("Azul y negro", "#1d2fe0", "#111111"), stripes("Azul y naranja", "#1d3f8f", "#f0923a"), stripes("Azul y rosa", "#2f4fc0", "#f0a0d8"),
      stripes("Azul y amarillo", "#1d3f8f", "#f5e04a"), stripes("Granate y azul", "#7a1630", "#5aafe6"), stripes("Gris oscuro", "#3a3d42", "#6b7078"),
      stripes("Verde y negro", "#1f6b3a", "#111111"), stripes("Verde y rojo", "#1f6b3a", "#c02a2a"), stripes("Naranja y negro", "#f07a1a", "#111111"),
      stripes("Naranja y blanco", "#f07a1a", "#ffffff"), stripes("Rojo y blanco", "#d42a2a", "#ffffff"), stripes("Rojo y negro", "#c02a2a", "#111111"),
      stripes("Blanco y azul", "#ffffff", "#2f63d9"), stripes("Blanco y negro", "#ffffff", "#111111"), stripes("Amarillo y negro", "#f5e04a", "#111111"),
    ],
  },
  {
    id: "camisetas", name: "Camisetas", kits: [
      shirt("Rayas rojas y blancas", "#ffffff", "#d42a2a", "stripes", "#111111"),
      shirt("Rayas blancas y azules", "#ffffff", "#2f63d9", "stripes", "#2f63d9"),
      shirt("Rayas celestes y blancas", "#ffffff", "#6db8ea", "stripes", "#1d3f8f"),
      shirt("Rayas azules y granates", "#1d3f8f", "#8a1538", "stripes", "#f5e04a"),
      shirt("Rayas rojas y negras", "#111111", "#c02a2a", "stripes", "#111111"),
      shirt("Rayas verdes y blancas", "#ffffff", "#1f8a4a", "stripes", "#1f8a4a"),
      shirt("Aros verdes y blancos", "#1f8a4a", "#ffffff", "hoops", "#1f8a4a"),
      shirt("Aros azules y blancos", "#1d3f8f", "#ffffff", "hoops", "#1d3f8f"),
      shirt("Banda roja sobre blanco", "#ffffff", "#d42a2a", "sash", "#d42a2a"),
      shirt("Banda negra sobre amarillo", "#f5e04a", "#111111", "sash", "#111111"),
      shirt("Mitades azul y rojo", "#1d3f8f", "#c02a2a", "halves", "#f5e04a"),
      shirt("Cuartos azules y blancos", "#ffffff", "#2f63d9", "quarters", "#2f63d9"),
      shirt("Blanca con ribetes azules", "#ffffff", "#1d3f8f", "solid", "#1d3f8f"),
      shirt("Blanca con ribetes negros", "#ffffff", "#111111", "solid", "#111111"),
      shirt("Roja con ribetes blancos", "#c02a2a", "#ffffff", "solid", "#ffffff"),
      shirt("Azul con ribetes amarillos", "#1d3f8f", "#f5e04a", "solid", "#f5e04a"),
      shirt("Celeste con ribetes blancos", "#6db8ea", "#ffffff", "solid", "#ffffff"),
      shirt("Amarilla con ribetes azules", "#f5e04a", "#1d3f8f", "solid", "#1d3f8f"),
      shirt("Negra con ribetes dorados", "#1f1f1f", "#d4a63a", "solid", "#d4a63a"),
      shirt("Verde con ribetes blancos", "#1f6b3a", "#ffffff", "solid", "#ffffff"),
      shirt("Naranja con ribetes negros", "#f07a1a", "#111111", "solid", "#111111"),
      shirt("Morada con ribetes blancos", "#5b2a86", "#ffffff", "solid", "#ffffff"),
    ],
  },
  {
    // Equipaciones del club (identidad visual de Racing Sarrià): 1.ª blanca con ribete granate, 2.ª toda granate, 3.ª verde
    // con ribete verde más oscuro; porteros de naranja o azul eléctrico.
    id: "racing", name: "Racing Sarrià", kits: [
      shirt("1.ª equipación", "#ffffff", "#73000A", "solid", "#73000A"),
      shirt("2.ª equipación", "#73000A", "#ffffff", "solid", "#36000D"),
      shirt("3.ª equipación", "#1f8a4a", "#ffffff", "solid", "#145c30"),
      shirt("Portero naranja", "#FF6E00", "#1f1f1f", "solid", "#1f1f1f"),
      shirt("Portero azul eléctrico", "#1f6bff", "#ffffff", "solid", "#0b2a8a"),
    ],
  },
];

// Parche que se aplica al equipo al elegir una equipación (borra el borde propio: el de la equipación sale de su color)
export function kitPatch(kit) {
  return {
    color: kit.color,
    color2: kit.color2 || undefined,
    pattern: kit.pattern || "solid",
    kit: kit.kit === "camiseta" ? "camiseta" : "boton",
    trim: kit.kit === "camiseta" ? kit.trim || kit.color2 : undefined,
    stroke: undefined,
  };
}

// ¿El equipo lleva ya esta equipación? (para marcarla en la galería)
export function sameKit(team, kit) {
  const p = kitPatch(kit);
  const low = (v) => String(v || "").toLowerCase();
  return low(team?.color) === low(p.color) && (team?.pattern || "solid") === p.pattern && (team?.kit === "camiseta" ? "camiseta" : "boton") === p.kit
    && (p.pattern === "solid" || low(team?.color2) === low(p.color2)) && (p.kit !== "camiseta" || low(team?.trim) === low(p.trim));
}
