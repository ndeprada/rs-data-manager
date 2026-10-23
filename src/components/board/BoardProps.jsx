import React from "react";
import { Input } from "@/components/ui/input";
import { AIR_MAX, BALL_PATTERNS, CHIP_PATTERNS, DASHES, DEFAULT_CHIP, FONTS, GOAL_SIZES, LADDER_RUNGS, arrowProps, ballStyle, chipOf, chipStyle, defaultControl, ladderRungs, linkProps, materialOf, teamsOf, zoneShapePatch } from "@/lib/board";
import { ChipGlyph, styleOf } from "./BoardSvg";
import { ColorPick, Row, Seg, Slider, Toggle } from "./BoardControls";

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

const OWN_KEYS = ["color", "pattern", "color2", "stroke"];
const plainBtn = "h-7 px-2 rounded-md border text-[11px] font-semibold bg-white text-gray-600 border-gray-200 hover:bg-gray-50";

// Ficha: texto de dentro, nombre, equipo, diseño (color, dibujo, borde) del equipo o de esta ficha, tamaño y pies
function TeamBlock({ el, brush, board, look, patch, patchTeam, setChip, setFeet, canRemoveTeam, onRemoveTeam }) {
  const teams = teamsOf(board);
  const team = teams.find((t) => t.id === el.team) || teams[0];
  const hasOwn = !brush && OWN_KEYS.some((k) => el[k] != null);
  // Por defecto se edita el equipo; «Solo esta ficha» deja el diseño propio de la ficha seleccionada
  const [scope, setScope] = React.useState(hasOwn ? "chip" : "team");
  const bn = look === "bn";
  const editChip = !brush && scope === "chip";
  const target = editChip ? el : { team: team.id };
  const shown = chipStyle(board, target);
  const write = (p) => (editChip ? patch(p) : patchTeam(team.id, p));
  // Los dos deslizadores hablan en el mismo porcentaje (100 % = tamaño por defecto): el de «todas» las iguala
  const base = chipOf(board);
  const pctAll = Math.round((base / DEFAULT_CHIP) * 100);
  const pctOne = Math.round((base / DEFAULT_CHIP) * (Number(el.size) || 1) * 100);
  return (
    <>
      {!brush && (
        <Row>
          <Input value={el.inner || ""} maxLength={3} onChange={(e) => patch({ inner: e.target.value || undefined }, "inner")} placeholder="Nº" className="h-7 w-14 text-xs text-center" aria-label="Texto dentro de la ficha" title="Texto dentro de la ficha (dorsal o letra)" />
          <Input value={el.label || ""} onChange={(e) => patch({ label: e.target.value }, "label")} placeholder="Nombre" className="h-7 w-28 text-xs" aria-label="Nombre de la ficha" />
          <div className="flex gap-1" role="group" aria-label="Equipo">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.name}
                aria-label={t.name}
                aria-pressed={el.team === t.id}
                onClick={() => patch({ team: t.id })}
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${el.team === t.id ? "border-gray-900" : "border-transparent"}`}
              >
                <ChipGlyph board={board} el={{ team: t.id }} look={look} size={20} />
              </button>
            ))}
          </div>
        </Row>
      )}
      <Row>
        {!brush && <Seg label="Qué diseño editas" value={scope} options={[{ id: "team", label: "El equipo" }, { id: "chip", label: "Solo esta ficha" }]} onChange={setScope} />}
        {!editChip && <Input value={team.name} onChange={(e) => patchTeam(team.id, { name: e.target.value })} className="h-7 w-32 text-xs" aria-label="Nombre del equipo" title="Nombre del equipo" />}
        {canRemoveTeam && <button type="button" className={`${plainBtn} text-red-600`} onClick={() => onRemoveTeam(team.id)}>Quitar este equipo</button>}
      </Row>
      {bn ? (
        <p className="text-[11px] text-gray-500">En blanco y negro cada equipo se distingue por su relleno (negro, blanco, gris, rayas…); los colores se ven al cambiar de modo.</p>
      ) : (
        <Row>
          <ChipGlyph board={board} el={target} look={look} size={24} />
          <ColorPick value={shown.color} onChange={(c) => write({ color: c })} label="Relleno" wide />
          <select value={shown.pattern} onChange={(e) => write({ pattern: e.target.value })} className={selectCls} aria-label="Dibujo de la ficha">
            {CHIP_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {shown.pattern !== "solid" && <ColorPick value={shown.color2} onChange={(c) => write({ color2: c })} label="Segundo color" wide />}
          <ColorPick value={editChip ? el.stroke || "" : team.stroke || ""} onChange={(c) => write({ stroke: c || undefined })} label="Borde" auto="Por defecto" autoSwatch={styleOf(look).chipStroke} wide />
          {editChip && hasOwn && <button type="button" className={plainBtn} onClick={() => patch({ color: undefined, pattern: undefined, color2: undefined, stroke: undefined })} title="Vuelve al diseño del equipo">Quitar cambios de la ficha</button>}
        </Row>
      )}
      <Row>
        <Slider label="Todas las fichas" value={pctAll} min={55} max={210} step={5} onChange={(v) => setChip((v / 100) * DEFAULT_CHIP)} fmt={(v) => `${v}%`} />
        {!brush && <Slider label="Solo esta" value={pctOne} min={40} max={250} step={5} onChange={(v) => patch({ size: Math.round(((v / 100) * DEFAULT_CHIP / base) * 100) / 100 }, "size")} fmt={(v) => `${v}%`} />}
      </Row>
      <Row>
        <Toggle on={!!el.feet} onChange={(v) => patch({ feet: v || undefined })} title="Dos pies que asoman por delante: marcan hacia dónde mira o cómo está perfilado el jugador">{brush ? "Fichas nuevas con pies" : "Pies"}</Toggle>
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
  const curved = brush ? !!el.curved : el.cx != null;
  const toggleCurve = () => (brush ? patch({ curved: !curved }) : patch(curved ? { cx: undefined, cy: undefined } : defaultControl(el)));
  const auto = styleOf(look).arrows[el.style] || "#111827";
  return (
    <>
      <Row>
        <Seg label="Tipo de flecha" value={type} options={ARROW_TYPES} onChange={onType} />
        <Toggle on={curved} onChange={toggleCurve} title="Pase en curva: arrastra el punto naranja para curvarlo">Curva</Toggle>
        <Seg label="Punta" value={ap.pointer} options={[{ id: "arrow", label: "Flecha" }, { id: "bar", label: "Barra" }, { id: "none", label: "Sin punta" }]} onChange={(v) => patch({ pointer: v })} />
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
export default function BoardProps({ el, brush = false, board, look, patch, onType, patchTeam, setChip, setFeet, canRemoveTeam = false, onRemoveTeam }) {
  const s = styleOf(look);
  switch (el.k) {
    case "token":
      return <TeamBlock el={el} brush={brush} board={board} look={look} patch={patch} patchTeam={patchTeam} setChip={setChip} setFeet={setFeet} canRemoveTeam={canRemoveTeam} onRemoveTeam={onRemoveTeam} />;
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
            <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Color" auto="Según el modo" autoSwatch={s.textFill} wide />
            <Toggle on={el.bold !== false} onChange={(v) => patch({ bold: v })}>Negrita</Toggle>
          </Row>
        </>
      );
    default:
      return null;
  }
}
