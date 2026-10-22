import React from "react";
import { Input } from "@/components/ui/input";
import { AIR_MAX, CHIP_RANGE, DASHES, FONTS, GOAL_SIZES, arrowProps, chipOf, defaultControl, teamsOf } from "@/lib/board";
import { styleOf } from "./BoardSvg";
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

export const KIND_LABEL = { token: "Ficha", ball: "Balón", cone: "Cono", goal: "Portería", arrow: "Flecha", zone: "Zona", text: "Texto" };

const LINE_OPTS = DASHES.map((d) => ({ id: d.id, label: d.label }));
const selectCls = "h-7 rounded-md border border-gray-200 bg-white px-1.5 text-xs";
const pct = (v) => `${Math.round(v * 100)}%`;

function TeamBlock({ teamId, teams, patchTeam, el, patch, board, setChip, brush }) {
  const team = teams.find((t) => t.id === teamId) || teams[0];
  return (
    <>
      <Row>
        {!brush && (
          <>
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
                  className={`w-6 h-6 rounded-full border-2 ${el.team === t.id ? "border-gray-900" : "border-white shadow-[0_0_0_1px_rgba(0,0,0,.15)]"}`}
                  style={{ background: t.color }}
                />
              ))}
            </div>
          </>
        )}
        <Input value={team.name} onChange={(e) => patchTeam(team.id, { name: e.target.value })} className="h-7 w-32 text-xs" aria-label="Nombre del equipo" title="Nombre del equipo" />
        <ColorPick value={team.color} onChange={(c) => patchTeam(team.id, { color: c })} label="Color del equipo" wide />
        {!brush && <ColorPick value={el.color || ""} onChange={(c) => patch({ color: c || undefined })} label="Solo esta ficha" auto="Del equipo" autoSwatch={team.color} wide />}
      </Row>
      <Row>
        <Slider label="Tamaño de las fichas" value={chipOf(board)} min={CHIP_RANGE[0]} max={CHIP_RANGE[1]} step={0.1} onChange={setChip} fmt={(v) => `${v.toFixed(1)}`} />
        {!brush && <Slider label="Esta ficha" value={Number(el.size) || 1} min={0.6} max={2} step={0.1} onChange={(v) => patch({ size: v }, "size")} fmt={pct} />}
      </Row>
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

function ZoneBlock({ el, patch, look }) {
  const border = el.border !== false;
  const alpha = el.fillOpacity ?? styleOf(look).zoneAlpha;
  const transp = Math.round((1 - Math.min(1, Math.max(0, alpha))) * 100);
  const fillAuto = styleOf(look).zoneFill.startsWith("url") ? "#2563eb" : styleOf(look).zoneFill;
  return (
    <>
      <Row>
        <Seg label="Forma" value={el.shape || "rect"} options={[{ id: "rect", label: "Rectángulo" }, { id: "ellipse", label: "Elipse" }]} onChange={(v) => patch({ shape: v })} />
        <ColorPick value={el.fill || ""} onChange={(c) => patch({ fill: c || undefined })} label="Relleno" auto="Según el modo" autoSwatch={fillAuto} wide />
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

/**
 * el      elemento seleccionado, o { k, …propiedades de la herramienta } si es para lo siguiente que se dibuje (brush)
 * patch   (cambio, clave?) => void   · onType (tipo de flecha) · patchTeam (id, cambio) · setChip (tamaño de ficha)
 */
export default function BoardProps({ el, brush = false, board, look, patch, onType, patchTeam, setChip }) {
  const teams = teamsOf(board);
  const s = styleOf(look);
  switch (el.k) {
    case "token":
      return <TeamBlock teamId={el.team} teams={teams} patchTeam={patchTeam} el={el} patch={patch} board={board} setChip={setChip} brush={brush} />;
    case "ball":
      return (
        <Row>
          <Slider label="Tamaño del balón" value={Number(el.size) || 1} min={0.6} max={2.2} step={0.1} onChange={(v) => patch({ size: v }, "size")} fmt={pct} />
        </Row>
      );
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
            <Slider label="Ancho" value={el.w || 7.32} min={1} max={12} step={0.5} onChange={(v) => patch({ w: v }, "w")} fmt={(v) => `${v} m`} />
            <Slider label="Giro" value={el.rot || 0} min={0} max={345} step={15} onChange={(v) => patch({ rot: v }, "rot")} fmt={(v) => `${v}°`} />
          </Row>
        </>
      );
    case "arrow":
      return <ArrowBlock el={el} brush={brush} patch={patch} onType={onType} look={look} />;
    case "zone":
      return <ZoneBlock el={el} patch={patch} look={look} />;
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
