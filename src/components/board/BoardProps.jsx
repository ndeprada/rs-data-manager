import React from "react";
import { Input } from "@/components/ui/input";
import { AIR_MAX, BALL_PATTERNS, CHIP_PATTERNS, DASHES, DEFAULT_CHIP, FONTS, GOAL_SIZES, LADDER_RUNGS, arrowPath, arrowProps, ballStyle, chipOf, chipStyle, contrastColor, defaultControl, firstBend, hasVia, ladderRungs, linkProps, materialOf, teamsOf, zoneShapePatch } from "@/lib/board";
import { ChipGlyph, styleOf } from "./BoardSvg";
import { ColorPick, NO_FILL, Row, Seg, Slider, Toggle } from "./BoardControls";

// Panel de propiedades de la pizarra: según lo que esté seleccionado (o la herramienta activa, para lo siguiente que se
// dibuje) se puede cambiar tamaño, color, trazo, borde, transparencia, tipografía…

export const ARROW_TYPES = [
  { id: "move", label: "Desplaz." },
  { id: "pass", label: "Pase" },
  { id: "air", label: "Pase aéreo" },
  { id: "dribble", label: "Conducción" },
];
// Lo que define cada tipo de flecha (el resto de propiedades —grosor, color, borde…— se conserva al cambiar de tipo)
export const ARROW_PRESETS = {
  move: { style: "move", dash: "solid", wavy: false, air: false },
  pass: { style: "pass", dash: "dashed", wavy: false, air: false },
  air: { style: "pass", dash: "solid", wavy: false, air: true, lift: 6 },
  dribble: { style: "dribble", dash: "solid", wavy: true, air: false },
};
export const typeOfArrow = (a) => (a.air ? "air" : a.style || "move");

export const KIND_LABEL = { token: "Ficha", ball: "Balón", cone: "Cono", goal: "Portería", pole: "Pica", hurdle: "Valla", ladder: "Escalera de coordinación", dummy: "Maniquí", arrow: "Flecha", zone: "Zona", link: "Conector entre fichas", text: "Texto" };

const LINE_OPTS = DASHES.map((d) => ({ id: d.id, label: d.label }));
const selectCls = "h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs";
const pct = (v) => `${Math.round(v * 100)}%`;

const plainBtn = "h-7 px-2 rounded-md border text-[11px] font-semibold bg-white text-gray-600 border-gray-200 hover:bg-gray-50";

// Ficha: con una ficha elegida, el diseño de SU EQUIPO y lo que vale para todas (lo de cada ficha —textos, peto, color propio,
// tamaño— se edita con doble clic sobre ella, en `ChipQuickEdit`); sin elegir, cómo saldrán las fichas nuevas de esa herramienta.
function TeamBlock({ el, brush, board, look, patch, patchTeam, setChip, setFeet, canRemoveTeam, onRemoveTeam, onQuick }) {
  const teams = teamsOf(board);
  const team = teams.find((t) => t.id === el.team) || teams[0];
  const bn = look === "bn";
  const shown = chipStyle(board, { team: team.id });
  const write = (p) => patchTeam(team.id, p);
  // Los deslizadores hablan en porcentaje (100 % = tamaño por defecto)
  const base = chipOf(board);
  const pctAll = Math.round((base / DEFAULT_CHIP) * 100);
  return (
    <>
      {!brush && (
        <Row>
          <button type="button" className="h-7 px-2 rounded-md border text-[11px] font-semibold bg-gray-900 text-white border-gray-900 hover:bg-gray-800" onClick={onQuick} data-testid="chip-quick-open">Editar esta ficha</button>
          <span className="text-[11px] text-gray-500">o doble clic (o clic derecho) sobre ella: nombre, dorsal, texto de arriba, peto, color…</span>
        </Row>
      )}
      {brush && (
        <Row>
          <ColorPick value={el.bib || ""} onChange={(c) => patch({ bib: c || undefined })} label="Peto en las nuevas" auto="Sin peto" autoSwatch={NO_FILL} wide />
        </Row>
      )}
      <Row>
        <span className="text-[11px] font-semibold text-gray-600">Equipo</span>
        <ChipGlyph board={board} el={{ team: team.id }} look={look} size={22} />
        <Input value={team.name} onChange={(e) => patchTeam(team.id, { name: e.target.value })} className="h-7 w-32 text-xs" aria-label="Nombre del equipo" title="Nombre del equipo" />
        {canRemoveTeam && <button type="button" className={`${plainBtn} text-red-600`} onClick={() => onRemoveTeam(team.id)}>Quitar este equipo</button>}
      </Row>
      {bn ? (
        <p className="text-[11px] text-gray-500">En blanco y negro cada equipo se distingue por su relleno (negro, blanco, gris, rayas…); los colores se ven al cambiar de modo.</p>
      ) : (
        <Row>
          <ColorPick value={shown.color} onChange={(c) => write({ color: c })} label="Relleno del equipo" wide />
          <select value={shown.pattern} onChange={(e) => write({ pattern: e.target.value })} className={selectCls} aria-label="Dibujo de las fichas del equipo">
            {CHIP_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {shown.pattern !== "solid" && <ColorPick value={shown.color2} onChange={(c) => write({ color2: c })} label="Segundo color" wide />}
          <ColorPick value={team.stroke || ""} onChange={(c) => write({ stroke: c || undefined })} label="Borde" auto="Por defecto" autoSwatch={styleOf(look).chipStroke} wide />
        </Row>
      )}
      <Row>
        <Slider label="Tamaño de todas las fichas" value={pctAll} min={55} max={210} step={5} onChange={(v) => setChip((v / 100) * DEFAULT_CHIP)} fmt={(v) => `${v}%`} />
      </Row>
      <Row>
        {brush && <Toggle on={!!el.feet} onChange={(v) => patch({ feet: v || undefined })} title="Dos pies que asoman por delante: marcan hacia dónde mira o cómo está perfilado el jugador">Fichas nuevas con pies</Toggle>}
        <button type="button" className={plainBtn} onClick={() => setFeet(true)}>Pies a todas</button>
        <button type="button" className={plainBtn} onClick={() => setFeet(false)}>Quitar pies a todas</button>
      </Row>
      {!brush && el.feet && <p className="text-[11px] text-gray-500">Arrastra el punto naranja que sale de la ficha para girar hacia dónde mira. En cada fotograma puede mirar a un lado distinto y la animación gira sola.</p>}
    </>
  );
}

// Balón: diseño, colores y tamaño
function BallBlock({ el, patch, look }) {
  const bs = ballStyle(el);
  const s = styleOf(look);
  const bn = look === "bn";
  return (
    <>
      <Row>
        <Seg label="Diseño del balón" value={bs.pattern} options={BALL_PATTERNS} onChange={(v) => patch({ pattern: v })} />
        {!bn && (
          <>
            <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Color" auto="Blanco" autoSwatch="#ffffff" wide />
            <ColorPick value={el.color2 || ""} onChange={(c) => patch({ color2: c || undefined })} label="Dibujo" auto="Según el modo" autoSwatch={s.ball.stroke} wide />
            <ColorPick value={el.stroke || ""} onChange={(c) => patch({ stroke: c || undefined })} label="Borde" auto="Según el modo" autoSwatch={s.ball.stroke} wide />
          </>
        )}
      </Row>
      <Row>
        <Slider label="Tamaño del balón" value={Number(el.size) || 1} min={0.6} max={2.2} step={0.1} onChange={(v) => patch({ size: v }, "size")} fmt={pct} />
      </Row>
    </>
  );
}

// Pica, valla, escalera de coordinación y maniquí: color, tamaño y (escalera) peldaños; se giran con el punto naranja
function MaterialBlock({ el, brush, patch, look }) {
  const mat = materialOf(el.k);
  const bn = look === "bn";
  return (
    <>
      <Row>
        {!bn && <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Color" auto="Por defecto" autoSwatch={mat.color} wide />}
        <Slider label="Tamaño" value={Number(el.size) || 1} min={0.6} max={2.2} step={0.1} onChange={(v) => patch({ size: v }, "size")} fmt={pct} />
        {el.k === "ladder" && <Slider label="Peldaños" value={ladderRungs(el)} min={LADDER_RUNGS[0]} max={LADDER_RUNGS[1]} step={1} onChange={(v) => patch({ rungs: v }, "rungs")} fmt={(v) => `${v}`} />}
      </Row>
      {!brush && <p className="text-[11px] text-gray-500">Arrastra el punto naranja que sale del material para girarlo.</p>}
    </>
  );
}

function ArrowBlock({ el, brush, patch, onType, look }) {
  const ap = arrowProps(el);
  const type = typeOfArrow(el);
  const path = brush ? (el.bends ? "poly" : el.curved ? "curve" : "straight") : arrowPath(el);
  const setPath = (v) => {
    if (brush) return patch({ curved: v === "curve", bends: v === "poly" });
    if (v === "straight") return patch({ cx: undefined, cy: undefined, via: undefined });
    if (v === "curve") return patch({ ...defaultControl(el), via: undefined });
    return patch({ cx: undefined, cy: undefined, via: hasVia(el) ? el.via : [firstBend(el)] });
  };
  const auto = styleOf(look).arrows[el.style] || "#111827";
  return (
    <>
      <Row>
        <Seg label="Tipo de flecha" value={type} options={ARROW_TYPES} onChange={onType} />
        {type !== "air" && <Seg label="Trazado" value={path} options={[{ id: "straight", label: "Recta" }, { id: "curve", label: "Curva" }, { id: "poly", label: "Quiebros" }]} onChange={setPath} />}
        <Seg label="Punta" value={ap.pointer} options={[{ id: "arrow", label: "Flecha" }, { id: "bar", label: "Barra" }, { id: "dot", label: "Punto" }, { id: "none", label: "Sin punta" }]} onChange={(v) => patch({ pointer: v })} />
      </Row>
      <Row>
        <Seg label="Trazo" value={ap.dash} options={LINE_OPTS} onChange={(v) => patch({ dash: v })} />
        <Slider label="Grosor" value={ap.width} min={0.2} max={2} step={0.05} onChange={(v) => patch({ width: v }, "width")} fmt={(v) => v.toFixed(2)} />
      </Row>
      <Row>
        <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Color" auto="Según el tipo" autoSwatch={auto} wide />
        <Toggle on={ap.border} onChange={(v) => patch({ border: v })}>Borde</Toggle>
        {ap.border && <ColorPick value={el.borderColor || "#111827"} onChange={(c) => patch({ borderColor: c })} label="Color del borde" wide />}
        {type === "air" && (
          <>
            <Slider label="Altura" value={Math.abs(Number(el.lift) || 6)} min={1} max={AIR_MAX} step={0.5} onChange={(v) => patch({ lift: (Number(el.lift) < 0 ? -1 : 1) * v }, "lift")} fmt={(v) => `${v} m`} />
            <Toggle on={Number(el.lift) < 0} onChange={() => patch({ lift: -(Number(el.lift) || 6) })} title="Curvar el arco hacia el otro lado">Otro lado</Toggle>
          </>
        )}
      </Row>
      {path === "poly" && type !== "air" && !brush && <p className="text-[11px] text-gray-500">Arrastra los puntos naranjas para mover cada quiebro; el «+» de cada tramo añade otro y doble clic sobre un quiebro lo quita.</p>}
      {path === "curve" && type !== "air" && !brush && <p className="text-[11px] text-gray-500">Arrastra el punto naranja para curvar la flecha.</p>}
      {type === "air" && !brush && <p className="text-[11px] text-gray-500">Arrastra el punto azul para subir o bajar el arco (y pasarlo al otro lado); la sombra gris marca por dónde va el balón en el suelo.</p>}
    </>
  );
}

function ZoneBlock({ el, brush, patch, look }) {
  const border = el.border !== false;
  const alpha = el.fillOpacity ?? styleOf(look).zoneAlpha;
  const transp = Math.round((1 - Math.min(1, Math.max(0, alpha))) * 100);
  const fillAuto = styleOf(look).zoneFill.startsWith("url") ? "#2563eb" : styleOf(look).zoneFill;
  return (
    <>
      <Row>
        {!(brush && el.shape === "quad") && (
          <Seg
            label="Forma"
            value={el.shape || "rect"}
            options={[{ id: "rect", label: "Rectángulo" }, { id: "ellipse", label: "Elipse" }, ...(brush ? [] : [{ id: "quad", label: "4 esquinas" }])]}
            onChange={(v) => patch(brush ? { shape: v } : zoneShapePatch(el, v))}
          />
        )}
        <ColorPick
          value={el.fill || ""}
          onChange={(c) => patch(c ? { fill: c, ...(el.fillOpacity == null ? { fillOpacity: 0.35 } : {}) } : { fill: undefined })}
          label="Relleno"
          auto="Según el modo"
          autoSwatch={fillAuto}
          wide
        />
        <Slider label="Transparencia" value={transp} min={0} max={100} step={5} onChange={(v) => patch({ fillOpacity: Math.round((1 - v / 100) * 100) / 100 }, "fillOpacity")} fmt={(v) => `${v}%`} />
      </Row>
      <Row>
        <Toggle on={border} onChange={(v) => patch({ border: v })}>Borde</Toggle>
        {border && (
          <>
            <ColorPick value={el.stroke || ""} onChange={(c) => patch({ stroke: c || undefined })} label="Color del borde" auto="Según el modo" autoSwatch={styleOf(look).zoneLine} wide />
            <Seg label="Trazo del borde" value={el.dash || "dashed"} options={LINE_OPTS.slice(0, 2)} onChange={(v) => patch({ dash: v })} />
            <Slider label="Grosor" value={el.strokeWidth ?? 0.45} min={0.15} max={1.6} step={0.05} onChange={(v) => patch({ strokeWidth: v }, "strokeWidth")} fmt={(v) => v.toFixed(2)} />
          </>
        )}
      </Row>
    </>
  );
}

function LinkBlock({ el, patch, look }) {
  const lp = linkProps(el);
  const n = (el.ids || []).length;
  const transp = Math.round((1 - Math.min(1, Math.max(0, lp.fillOpacity))) * 100);
  return (
    <>
      <Row>
        <Seg label="Tipo de conector" value={lp.mode} options={[{ id: "line", label: "Línea" }, { id: "zone", label: "Zona" }, { id: "mesh", label: "Red" }]} onChange={(v) => patch({ mode: v })} />
        {lp.mode === "line" && n > 2 && <Toggle on={lp.closed} onChange={(v) => patch({ closed: v })} title="Unir también la última ficha con la primera">Cerrar</Toggle>}
        <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Color" auto="Según el modo" autoSwatch={styleOf(look).link} wide />
      </Row>
      <Row>
        <Seg label="Trazo" value={lp.dash} options={LINE_OPTS} onChange={(v) => patch({ dash: v })} />
        <Slider label="Grosor" value={lp.width} min={0.1} max={1.6} step={0.05} onChange={(v) => patch({ width: v }, "width")} fmt={(v) => v.toFixed(2)} />
      </Row>
      {lp.mode === "zone" && (
        <Row>
          <Slider label="Transparencia" value={transp} min={0} max={100} step={5} onChange={(v) => patch({ fillOpacity: Math.round((1 - v / 100) * 100) / 100 }, "fillOpacity")} fmt={(v) => `${v}%`} />
          <Toggle on={lp.border} onChange={(v) => patch({ border: v })}>Borde</Toggle>
        </Row>
      )}
      <p className="text-[11px] text-gray-500">Une {n} fichas y se mueve con ellas: arrastra las fichas para cambiar la figura.</p>
    </>
  );
}

/**
 * el      elemento seleccionado, o { k, …propiedades de la herramienta } si es para lo siguiente que se dibuje (brush)
 * patch   (cambio, clave?) => void   · onType (tipo de flecha) · patchTeam (id, cambio) · setChip (tamaño de ficha)
 */
export default function BoardProps({ el, brush = false, board, look, patch, onType, patchTeam, setChip, setFeet, canRemoveTeam = false, onRemoveTeam, onQuick }) {
  const s = styleOf(look);
  switch (el.k) {
    case "token":
      return <TeamBlock el={el} brush={brush} board={board} look={look} patch={patch} patchTeam={patchTeam} setChip={setChip} setFeet={setFeet} canRemoveTeam={canRemoveTeam} onRemoveTeam={onRemoveTeam} onQuick={onQuick} />;
    case "ball":
      return <BallBlock el={el} patch={patch} look={look} />;
    case "pole":
    case "hurdle":
    case "ladder":
    case "dummy":
      return <MaterialBlock el={el} brush={brush} patch={patch} look={look} />;
    case "cone":
      return (
        <Row>
          <Seg label="Forma del cono" value={el.shape || "tri"} options={[{ id: "tri", label: "Triángulo" }, { id: "flat", label: "Plano" }]} onChange={(v) => patch({ shape: v })} />
          <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Color" auto="Naranja" autoSwatch={s.cone} wide />
          <Slider label="Tamaño" value={Number(el.size) || 1} min={0.6} max={2.2} step={0.1} onChange={(v) => patch({ size: v }, "size")} fmt={pct} />
        </Row>
      );
    case "goal":
      return (
        <>
          <Row>
            <Seg
              label="Tipo de portería"
              value={GOAL_SIZES.find((g) => g.w === (el.w || 7.32))?.id || ""}
              options={GOAL_SIZES.map((g) => ({ id: g.id, label: `${g.label} (${g.w} m)` }))}
              onChange={(id) => patch({ w: GOAL_SIZES.find((g) => g.id === id).w })}
            />
          </Row>
          <Row>
            <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Color y red" auto="Por defecto" autoSwatch={s.goal.stroke} wide />
          </Row>
          <Row>
            <Slider label="Ancho" value={el.w || 7.32} min={1} max={12} step={0.5} onChange={(v) => patch({ w: v }, "w")} fmt={(v) => `${v} m`} />
            <Slider label="Giro" value={el.rot || 0} min={0} max={345} step={15} onChange={(v) => patch({ rot: v }, "rot")} fmt={(v) => `${v}°`} />
          </Row>
        </>
      );
    case "arrow":
      return <ArrowBlock el={el} brush={brush} patch={patch} onType={onType} look={look} />;
    case "zone":
      return <ZoneBlock el={el} brush={brush} patch={patch} look={look} />;
    case "link":
      return <LinkBlock el={el} patch={patch} look={look} />;
    case "text":
      return (
        <>
          {!brush && (
            <Row>
              <Input value={el.text || ""} onChange={(e) => patch({ text: e.target.value }, "text")} className="h-7 w-48 text-xs" aria-label="Texto" />
            </Row>
          )}
          <Row>
            <Slider label="Tamaño" value={Number(el.size) || 3} min={1.5} max={10} step={0.5} onChange={(v) => patch({ size: v }, "size")} fmt={(v) => `${v}`} />
            <select value={el.font || "sans"} onChange={(e) => patch({ font: e.target.value })} className={selectCls} aria-label="Tipografía">
              {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Color" auto={el.bg ? "Automático" : "Según el modo"} autoSwatch={el.bg && look !== "bn" ? contrastColor(el.bg) : s.textFill} wide />
            <Toggle on={el.bold !== false} onChange={(v) => patch({ bold: v })}>Negrita</Toggle>
          </Row>
          <Row>
            <ColorPick value={el.bg || ""} onChange={(c) => patch({ bg: c || undefined })} label="Fondo" auto="Sin fondo" autoSwatch={NO_FILL} wide />
            {el.bg && <Slider label="Opacidad del fondo" value={Math.round((el.bgOpacity ?? 1) * 100)} min={20} max={100} step={5} onChange={(v) => patch({ bgOpacity: v >= 100 ? undefined : v / 100 }, "bgOpacity")} fmt={(v) => `${v}%`} />}
          </Row>
          {el.bg && !el.color && <p className="text-[11px] text-gray-500">Con fondo, la letra sale en negro o en blanco según lo que mejor se lea; puedes elegir otro color arriba.</p>}
        </>
      );
    default:
      return null;
  }
}
