import React from "react";
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceBetween, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceBetween,
  BringToFront, ChevronDown, ChevronUp, Circle, Copy, GripVertical, Minus, MoveUpRight, Plus, SendToBack, Square, Trash2, Triangle, Type, Waypoints, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawOrder, elementBounds, isCarried, teamOf, teamsOf } from "@/lib/board";
import { ChipGlyph } from "./BoardSvg";
import { ColorPick, DummyIcon, GoalIcon, HurdleIcon, LadderIcon, PoleIcon, Row, Toggle } from "./BoardControls";
import { typeOfArrow } from "./BoardProps";

// Panel de varios elementos a la vez (selección múltiple), botones de capas (orden de dibujo, también con uno solo) y la lista de
// capas del fotograma.

const PLURAL = {
  token: ["ficha", "fichas"], ball: ["balón", "balones"], cone: ["cono", "conos"], goal: ["portería", "porterías"], pole: ["pica", "picas"],
  hurdle: ["valla", "vallas"], ladder: ["escalera", "escaleras"], dummy: ["maniquí", "maniquíes"], arrow: ["flecha", "flechas"],
  zone: ["zona", "zonas"], link: ["conector", "conectores"], text: ["texto", "textos"],
};
export const describeSelection = (els) => {
  const n = {};
  for (const e of els) n[e.k] = (n[e.k] || 0) + 1;
  return Object.entries(n).map(([k, c]) => `${c} ${(PLURAL[k] || [k, k])[c === 1 ? 0 : 1]}`).join(", ");
};

const btn = "h-7 px-2 gap-1 text-xs";

/** Orden de capas: al frente · subir un nivel · bajar un nivel · al fondo */
export function LayerButtons({ onLayer }) {
  const items = [
    { id: "front", label: "Al frente", icon: BringToFront, title: "Poner encima de todo" },
    { id: "up", label: "Subir", icon: ChevronUp, title: "Subir un nivel: pasa por encima de lo que lo tapa" },
    { id: "down", label: "Bajar", icon: ChevronDown, title: "Bajar un nivel: pasa por debajo de lo que tiene debajo" },
    { id: "back", label: "Al fondo", icon: SendToBack, title: "Poner debajo de todo" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Capas">
      <span className="text-[11px] font-semibold text-gray-600">Capas</span>
      {items.map(({ id, label, icon: Icon, title }) => (
        <Button key={id} type="button" size="sm" variant="outline" className={btn} onClick={() => onLayer(id)} title={title}>
          <Icon className="w-3.5 h-3.5" /> {label}
        </Button>
      ))}
    </div>
  );
}

// Más / menos con un valor en medio (para el tamaño y la separación)
function Step({ label, onLess, onMore, lessTitle, moreTitle }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <span className="text-[11px] font-semibold text-gray-600">{label}</span>
      <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onLess} title={lessTitle} aria-label={lessTitle}><Minus className="w-3.5 h-3.5" /></Button>
      <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onMore} title={moreTitle} aria-label={moreTitle}><Plus className="w-3.5 h-3.5" /></Button>
    </div>
  );
}

const ALIGNS = [
  { id: "left", icon: AlignStartVertical, title: "Alinear a la izquierda" },
  { id: "hcenter", icon: AlignCenterVertical, title: "Centrar de izquierda a derecha" },
  { id: "right", icon: AlignEndVertical, title: "Alinear a la derecha" },
  { id: "top", icon: AlignStartHorizontal, title: "Alinear arriba" },
  { id: "vcenter", icon: AlignCenterHorizontal, title: "Centrar de arriba abajo" },
  { id: "bottom", icon: AlignEndHorizontal, title: "Alinear abajo" },
];
const DISTRIBUTES = [
  { id: "h", icon: AlignHorizontalSpaceBetween, title: "Repartir a lo ancho con el mismo hueco (las de los extremos no se mueven)" },
  { id: "v", icon: AlignVerticalSpaceBetween, title: "Repartir a lo alto con el mismo hueco (las de los extremos no se mueven)" },
];

/** Alinear (izquierda, centro, derecha, arriba, medio, abajo) y repartir con el mismo hueco, siempre «como se ve» en pantalla */
export function AlignBar({ onAlign, onDistribute, canDistribute }) {
  const iconBtn = "h-7 w-7 p-0";
  return (
    <>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Alinear">
        <span className="text-[11px] font-semibold text-gray-600">Alinear</span>
        {ALIGNS.map(({ id, icon: Icon, title }) => (
          <Button key={id} type="button" size="sm" variant="outline" className={iconBtn} onClick={() => onAlign(id)} title={title} aria-label={title}><Icon className="w-3.5 h-3.5" /></Button>
        ))}
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Repartir">
        <span className="text-[11px] font-semibold text-gray-600">Repartir</span>
        {DISTRIBUTES.map(({ id, icon: Icon, title }) => (
          <Button key={id} type="button" size="sm" variant="outline" className={iconBtn} onClick={() => onDistribute(id)} disabled={!canDistribute} title={canDistribute ? title : "Para repartir hacen falta al menos tres cosas"} aria-label={title}><Icon className="w-3.5 h-3.5" /></Button>
        ))}
      </div>
    </>
  );
}

/**
 * els       elementos elegidos (dos o más)
 * frames    número de fotogramas (para «Solo aquí»)
 * onTeam / onColor / onFeet / onResize(factor) / onSpread(factor) / onAlign(dónde) / onDistribute(eje) / onLayer(dónde) / onDup / onDel(soloAquí) / onClear
 */
export default function MultiPanel({ els, board, look, frames, onTeam, onColor, onFeet, onResize, onSpread, onAlign, onDistribute, onLayer, onDup, onDel, onClear }) {
  const tokens = els.filter((e) => e.k === "token");
  const teams = teamsOf(board);
  const teamOfAll = tokens.length && tokens.every((t) => t.team === tokens[0].team) ? tokens[0].team : null;
  const allFeet = tokens.length > 0 && tokens.every((t) => t.feet);
  const sizable = els.some((e) => e.k !== "zone" && e.k !== "link");
  const spreadable = els.filter((e) => e.k !== "link").length > 1;
  const colorable = look !== "bn";
  const carried = els.some(isCarried);
  return (
    <div className="rounded-lg border px-2 py-1.5 space-y-1.5 bg-amber-50 border-amber-200" data-testid="board-multi">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{els.length} elegidos</span>
        <span className="text-[11px] text-amber-800 flex-1 min-w-[100px]">{describeSelection(els)} · arrastra cualquiera para moverlos juntos</span>
        <Button type="button" size="sm" variant="outline" className={btn} onClick={onClear} title="Dejar de elegir"><X className="w-3.5 h-3.5" /> Soltar</Button>
      </div>
      {(tokens.length > 0 || colorable) && (
        <Row>
          {tokens.length > 0 && (
            <div className="flex gap-1 items-center" role="group" aria-label="Equipo de las fichas elegidas">
              <span className="text-[11px] font-semibold text-gray-600">Equipo</span>
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={`Pasar las ${tokens.length} fichas a ${t.name}`}
                  aria-label={t.name}
                  aria-pressed={teamOfAll === t.id}
                  onClick={() => onTeam(t.id)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${teamOfAll === t.id ? "border-gray-900" : "border-transparent"}`}
                >
                  <ChipGlyph board={board} el={{ team: t.id }} look={look} size={20} />
                </button>
              ))}
            </div>
          )}
          {colorable && <ColorPick value="" onChange={onColor} label="Color de todo" wide />}
          {tokens.length > 0 && <Toggle on={allFeet} onChange={onFeet} title="Pies en todas las fichas elegidas">Pies</Toggle>}
        </Row>
      )}
      <Row>
        {sizable && <Step label="Tamaño" onLess={() => onResize(1 / 1.15)} onMore={() => onResize(1.15)} lessTitle="Más pequeño" moreTitle="Más grande" />}
        {spreadable && <Step label="Separación" onLess={() => onSpread(1 / 1.15)} onMore={() => onSpread(1.15)} lessTitle="Juntar" moreTitle="Separar" />}
      </Row>
      <Row>
        {spreadable && <AlignBar onAlign={onAlign} onDistribute={onDistribute} canDistribute={els.filter((e) => elementBounds(e)).length > 2} />}
        <LayerButtons onLayer={onLayer} />
      </Row>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <Button type="button" size="sm" variant="outline" className={btn} onClick={onDup} title="Duplicar todo lo elegido"><Copy className="w-3.5 h-3.5" /> Duplicar</Button>
        {carried && frames > 1 && <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onDel(true)} title="Quitar solo de este fotograma">Solo aquí</Button>}
        <Button type="button" size="sm" variant="outline" className={`${btn} text-red-600`} onClick={() => onDel(false)} title={carried && frames > 1 ? "Quitar de todos los fotogramas" : "Quitar"}><Trash2 className="w-3.5 h-3.5" /> Quitar</Button>
      </div>
    </div>
  );
}

// ── Lista de capas del fotograma ───────────────────────────────────────────────────────────────────────────────────

const ARROW_NAME = { move: "Desplazamiento", pass: "Pase", air: "Pase aéreo", dribble: "Conducción" };
const LINK_NAME = { line: "línea", zone: "zona", mesh: "red" };
const SINGULAR = Object.fromEntries(Object.entries(PLURAL).map(([k, [one]]) => [k, one.charAt(0).toUpperCase() + one.slice(1)]));

/** Nombre corto de un elemento para la lista de capas */
export function layerName(el, board) {
  if (el.k === "token") {
    const n = String(el.inner || el.label || el.labelTop || "").trim();
    return n ? `Ficha ${n}` : `Ficha · ${teamOf(board, el.team).name}`;
  }
  if (el.k === "arrow") return ARROW_NAME[typeOfArrow(el)] || "Flecha";
  if (el.k === "text") { const t = String(el.text || "").trim(); return t ? `Texto «${t.length > 22 ? `${t.slice(0, 21)}…` : t}»` : "Texto"; }
  if (el.k === "link") return `Conector (${LINK_NAME[el.mode || "line"] || "línea"})`;
  return SINGULAR[el.k] || el.k;
}

const KIND_ICON = { ball: Circle, cone: Triangle, goal: GoalIcon, pole: PoleIcon, hurdle: HurdleIcon, ladder: LadderIcon, dummy: DummyIcon, text: Type, link: Waypoints, arrow: MoveUpRight };
function LayerGlyph({ el, board, look }) {
  if (el.k === "token") return <ChipGlyph board={board} el={el} look={look} size={18} />;
  if (el.k === "zone") return <span className="w-4 h-4 rounded-[3px] border" style={{ background: el.fill || "#93c5fd", opacity: 0.8, borderColor: el.stroke || "#6b7280" }} aria-hidden="true" />;
  const Icon = KIND_ICON[el.k] || Square;
  const color = el.k === "cone" ? "#f97316" : el.k === "arrow" ? el.color || "#374151" : undefined;
  return <Icon className="w-4 h-4 text-gray-500" style={color ? { color } : undefined} />;
}

/**
 * els       elementos del fotograma actual
 * sel       ids elegidos
 * onPick(id, sumar)  elegir (o sumar / quitar de lo elegido si `sumar`)
 * onStep(id, dir)    dir +1 = un puesto hacia delante, -1 = un puesto hacia atrás
 * onMoveTo(id, pos)  al soltar una fila arrastrada: nuevo puesto en el orden de dibujo (0 = el del fondo)
 */
export function LayerList({ els, board, look, sel, onPick, onStep, onMoveTo }) {
  const rows = drawOrder(els).slice().reverse(); // arriba del todo = lo que se ve por delante
  const box = React.useRef(null);
  const [drag, setDrag] = React.useState(null); // { id, from, over }: fila que se está arrastrando y fila sobre la que está
  const first = sel[0];
  // Fila sobre la que está el puntero (la lista puede estar desplazada); al acercarse a un borde se desplaza sola
  const rowAt = (clientY) => {
    const c = box.current;
    if (!c) return 0;
    const r = c.getBoundingClientRect();
    if (clientY < r.top + 22) c.scrollTop -= 10;
    else if (clientY > r.bottom - 22) c.scrollTop += 10;
    const items = [...c.querySelectorAll("li")];
    const at = items.findIndex((li) => clientY < li.getBoundingClientRect().bottom);
    return at < 0 ? items.length - 1 : at;
  };
  const endDrag = (commit) => {
    if (commit && drag && drag.over !== drag.from) onMoveTo?.(drag.id, rows.length - 1 - drag.over);
    setDrag(null);
  };
  // al elegir algo en el dibujo, su fila se deja a la vista dentro de la lista (sin mover la página)
  React.useEffect(() => {
    const c = box.current;
    const row = c && first ? c.querySelector(`[data-layer="${CSS.escape(first)}"]`) : null;
    if (!row) return;
    if (row.offsetTop < c.scrollTop) c.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > c.scrollTop + c.clientHeight) c.scrollTop = row.offsetTop + row.offsetHeight - c.clientHeight;
  }, [first, rows.length]);
  return (
    <div className="rounded-lg border border-gray-200 bg-white" data-testid="board-layers">
      <div className="flex items-center gap-2 px-2 pt-1.5">
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Capas · {rows.length}</span>
        <span className="text-[11px] text-gray-500">Lo de arriba se ve por delante</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-2 py-2 text-[11px] text-gray-500">No hay nada en este fotograma.</p>
      ) : (
        <ul ref={box} className="relative max-h-48 overflow-y-auto px-1 py-1 space-y-0.5" aria-label="Capas del fotograma">
          {rows.map((el, i) => {
            const on = sel.includes(el.id);
            const name = layerName(el, board);
            return (
              <li
                key={el.id}
                data-layer={el.id}
                className={`flex items-center gap-1 rounded-md border pl-0.5 pr-0.5 h-8 ${on ? "bg-amber-100 border-amber-300" : "border-transparent hover:bg-gray-50"} ${drag?.id === el.id ? "opacity-50" : ""} ${drag && drag.over === i && drag.from !== i ? (drag.over < drag.from ? "shadow-[0_-2px_0_0_#d97706]" : "shadow-[0_2px_0_0_#d97706]") : ""}`}
              >
                <span
                  role="img"
                  aria-label={`Arrastrar para cambiar de capa: ${name}`}
                  title="Arrastra para cambiar de capa"
                  className="h-7 w-5 flex items-center justify-center text-gray-400 cursor-grab touch-none shrink-0"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); setDrag({ id: el.id, from: i, over: i }); }}
                  onPointerMove={(e) => { if (drag?.id === el.id) { const over = rowAt(e.clientY); if (over !== drag.over) setDrag((d) => (d ? { ...d, over } : d)); } }}
                  onPointerUp={() => endDrag(true)}
                  onPointerCancel={() => endDrag(false)}
                ><GripVertical className="w-4 h-4" /></span>
                <button
                  type="button"
                  className="flex-1 min-w-0 h-full flex items-center gap-2 text-left text-xs text-gray-800"
                  aria-pressed={on}
                  title={`Elegir: ${name}`}
                  onClick={(e) => onPick(el.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                >
                  <span className="w-5 flex items-center justify-center shrink-0"><LayerGlyph el={el} board={board} look={look} /></span>
                  <span className="truncate">{name}</span>
                </button>
                <button type="button" className="h-7 w-7 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent" disabled={i === 0} onClick={() => onStep(el.id, 1)} title={`Subir un puesto: ${name}`} aria-label={`Subir ${name}`}><ChevronUp className="w-4 h-4" /></button>
                <button type="button" className="h-7 w-7 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent" disabled={i === rows.length - 1} onClick={() => onStep(el.id, -1)} title={`Bajar un puesto: ${name}`} aria-label={`Bajar ${name}`}><ChevronDown className="w-4 h-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
