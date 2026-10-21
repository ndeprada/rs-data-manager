// Posiciones de fútbol 7 (Sub-8 a Sub-12): portero, lateral, central, mediapunta y extremo.
// Fuente: TFM de Nacho de Prada, apartado 4.5.2 «Fútbol 7 · Competencias y contenidos por posición», adaptado a Racing Sarrià.
// En fútbol 7 no hay roles ni perfiles cerrados: la posición es una herramienta de desarrollo (ver F7_PRINCIPLE).
// Sin importaciones de la app: se usa también en los tests.

export const F7_PRINCIPLE =
  "En fútbol 7 la posición no define al jugador: se utiliza para potenciar sus virtudes y ampliar sus capacidades. " +
  "Cada jugador actúa en más de una posición durante la temporada, de forma planificada, y eso no determina su posición en fútbol 11.";

// Orden en que se ofrecen al elegir posición
export const F7_POSITION_ORDER = ["portero", "lateral", "central", "mediapunta", "extremo"];

export const F7_POSITIONS = {
  portero: {
    label: "Portero",
    short: "POR",
    why: "Jugador con condiciones físicas y técnicas favorables para las demandas de la posición. En el juego ha de ser seguro y concentrado, con capacidad para participar con los pies de forma simple pero eficaz. Debe comunicarse y ayudar a organizar al equipo. Valiente.",
    contents: ["Pases", "Controles orientados", "Mirar antes y después de recibir", "Jugar de costado", "Sacar rápido", "Juego en bloque", "Comunicación (vivir el partido)"],
  },
  lateral: {
    label: "Lateral",
    short: "LAT",
    why: "Jugador con capacidad de conducción y progresión, o juego simple con balón a través del pase, a poder ser con vocación ofensiva para incorporarse y ocupar los espacios libres. No necesariamente rápido sino inteligente para aparecer. Debe ser competente en el 1x1 defensivo y en las coberturas.",
    contents: ["Conducción", "Doy y voy", "Pasillo (espacios libres)", "Desdoblamiento", "Superioridades numéricas", "Marcaje", "Entrada", "Coberturas"],
  },
  central: {
    label: "Central",
    short: "CEN",
    why: "Jugador con visión de juego, iniciativa y capacidad para distribuir el balón o progresar mediante la conducción y generar superioridades numéricas. Defensivamente, debe ser competente en el marcaje, la anticipación y las coberturas.",
    contents: ["Conducción", "Dar opción de pase", "Doy y voy / estoy", "Superioridades numéricas", "Marcaje", "Anticipación", "Coberturas", "Vigilancias ofensivas"],
  },
  mediapunta: {
    label: "Mediapunta",
    short: "MP",
    why: "Jugador completo, con facilidad para recibir entre líneas y desenvolverse en espacios reducidos. Con capacidad para interpretar el juego, relacionarse con sus compañeros y alternar apoyos y movimientos en profundidad. Debe tener llegada y capacidad para finalizar.",
    contents: ["Dar opción de pase", "Desmarque de apoyo", "Desmarque en profundidad", "Doy y estoy", "Pared", "Doblada", "Recepción girada", "Mirar antes y después de recibir", "Jugar de costado", "Control", "Pase", "Tiro"],
  },
  extremo: {
    label: "Extremo",
    short: "EXT",
    why: "Jugador preferiblemente rápido o potente, atrevido y competente en el 1x1 y que no pierde el balón con facilidad. Ha de dar profundidad a través del desmarque o del pase. Paciente para jugar abierto pero atento para cuando ha de entrar en diagonal, atacar los espacios y llegar a zonas de finalización.",
    contents: ["Ocupación racional del terreno de juego (amplitud y profundidad)", "Desmarque en profundidad", "Regate", "Controles orientados", "Pasillo", "Ocupar las zonas de remate", "Tiro", "Control", "Pase"],
  },
};

export const isF7Position = (position) => F7_POSITION_ORDER.includes(position);
export const f7Info = (position) => F7_POSITIONS[position] || null;

// Etapa del jugador: la que se haya fijado a mano en su ficha (pdi_stage) o, si no, la de su equipo.
export const stageOf = (player, teamIsF7) => player?.pdi_stage || (teamIsF7 ? "f7" : "f11");

// Posiciones de fútbol 11 (las de siempre)
export const F11_POSITION_OPTIONS = [
  { value: "portero", label: "Portero" },
  { value: "lateral", label: "Lateral" },
  { value: "central", label: "Central" },
  { value: "mediocentro", label: "Mediocentro" },
  { value: "interior", label: "Interior" },
  { value: "delantero_centro", label: "Delantero Centro" },
  { value: "extremo", label: "Extremo" },
];
const F7_POSITION_OPTIONS = F7_POSITION_ORDER.map((value) => ({ value, label: F7_POSITIONS[value].label }));

// Posiciones que se ofrecen a un jugador según su etapa. Si ya tiene guardada una de la otra etapa (o la antigua «libre»)
// se mantiene como opción aparte, marcada, para no borrarle el dato al abrir su ficha.
export function positionChoices(stage, current) {
  const base = stage === "f7" ? F7_POSITION_OPTIONS : F11_POSITION_OPTIONS;
  if (!current || base.some((p) => p.value === current)) return base;
  const other = (stage === "f7" ? F11_POSITION_OPTIONS : F7_POSITION_OPTIONS).find((p) => p.value === current);
  const label = other ? `${other.label} (${stage === "f7" ? "fútbol 11" : "fútbol 7"})` : current === "libre" ? "Libre (antigua)" : current;
  return [...base, { value: current, label, legacy: true }];
}

// Contenidos de una posición como «aspectos» elegibles en el plan de desarrollo
export function f7ContentOptions(position, { other = false } = {}) {
  const keys = other ? F7_POSITION_ORDER.filter((p) => p !== position) : [position];
  return keys.flatMap((pk) => {
    const info = F7_POSITIONS[pk];
    if (!info) return [];
    return info.contents.map((text, i) => ({ id: `f7.${pk}.${i}`, source: other ? "other" : "f7", group: pk, groupLabel: info.label, subLabel: "Contenidos que favorece", text, roleLabel: info.label }));
  });
}
