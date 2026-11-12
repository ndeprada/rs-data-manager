import React from "react";
import { BringToFront, CircleSlash, Copy, EyeOff, Lock, SendToBack, Sun, Trash2, X } from "lucide-react";
import { DEFAULT_CHIP, FONTS, chipOf, chipStyle, labelBgOf, teamsOf } from "@/lib/board";
import { CARD_TABS, EDGE_STEPS, TACTIC_POSITIONS, cleanCardTab, edgeStepOf, tacticPlayerPatch, topModeOf, topPatch } from "@/lib/boardVariant";
import { getRoleOptions } from "@/lib/competencyCatalog";
import { roleShort } from "@/lib/squadPlan";
import { ChipGlyph, chipPaint } from "./BoardSvg";
import { ColorPick, NO_FILL, Slider, TextSizePick, Toggle } from "./BoardControls";

// Tarjeta de una ficha (05/11/2026, maqueta aprobada por Nacho: «una tarjeta mucho más sencilla… que no me tape lo que hay
// detrás»). Una sola ventana pequeña junto a la ficha, con tres pestañas —Jugador · Aspecto · Letra— y una fila de iconos
// abajo. Lo que vale para todo el equipo (equipaciones, tamaño de todas, pies a todas) va aparte, en «Cambiar para todo el
// equipo». La pestaña Jugador cambia según la versión de la pizarra: en balón parado la pone la página (`playerSlot`: jugador
// y función), en táctica jugador de la plantilla, puesto y rol, y en tareas (y para las fichas del rival) dorsal, nombre,
// texto de encima y equipo.

const TAB_LABEL = { jugador: "Jugador", aspecto: "Aspecto", letra: "Letra" };
export const lab = "block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500";
export const inputCls = "h-8 w-full min-w-0 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-900";
export const pillCls = (on) => `h-7 rounded-md px-2 text-[12px] font-semibold border ${on ? "border-club bg-[#FBEFEF] text-club" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`;
const iconBtn = "h-8 w-8 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30";

const readTab = () => { try { return cleanCardTab(localStorage.getItem("rs_chip_tab")); } catch { return "jugador"; } };
const saveTab = (t) => { try { localStorage.setItem("rs_chip_tab", t); } catch { /* sin almacenamiento */ } };

function TeamDots({ board, el, look, patch }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Equipo de esta ficha" data-testid="card-team">
      {teamsOf(board).map((t) => (
        <button key={t.id} type="button" title={t.name} aria-label={t.name} aria-pressed={el.team === t.id} onClick={() => patch({ team: t.id })}
          className={`h-8 min-w-8 px-1 rounded-md flex items-center gap-1 border text-[11px] font-semibold ${el.team === t.id ? "border-club bg-[#FBEFEF] text-club" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <ChipGlyph board={board} el={{ team: t.id }} look={look} size={18} />
          <span className="max-w-[64px] truncate">{t.name}</span>
        </button>
      ))}
    </div>
  );
}

// Dorsal, nombre y texto de encima escritos a mano (tareas y fichas sin jugador)
function TextFields({ el, patch, focus = true }) {
  const nameRef = React.useRef(null);
  React.useEffect(() => { if (focus) { nameRef.current?.focus(); nameRef.current?.select?.(); } }, [el.id, focus]);
  return (
    <>
      <div className="grid grid-cols-[60px_1fr] gap-2">
        <label className="space-y-1"><span className={lab}>Nº</span>
          <input value={el.inner || ""} maxLength={3} onChange={(e) => patch({ inner: e.target.value || undefined }, "inner")} className={`${inputCls} text-center`} aria-label="Texto dentro de la ficha" title="Dorsal o letra (hasta 3)" />
        </label>
        <label className="space-y-1"><span className={lab}>Nombre</span>
          <input ref={nameRef} value={el.label || ""} onChange={(e) => patch({ label: e.target.value }, "label")} className={inputCls} aria-label="Nombre de la ficha" />
        </label>
      </div>
      <label className="block space-y-1"><span className={lab}>Texto encima</span>
        <input value={el.labelTop || ""} onChange={(e) => patch({ labelTop: e.target.value || undefined, topMode: e.target.value ? "text" : undefined }, "labelTop")} placeholder="Ej.: comodín, 1.º toque…" className={inputCls} aria-label="Texto por arriba de la ficha" />
      </label>
    </>
  );
}

// Encima de la ficha: botones (función/puesto/rol, otro texto, nada) y la casilla si es «otro texto»
export function TopChoice({ el, patch, options, names }) {
  const mode = topModeOf(el, "none");
  return (
    <div className="space-y-1.5">
      <span className={lab}>Encima de la ficha</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="group" aria-label="Encima de la ficha">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={mode === o.id} onClick={() => patch(topPatch(o.id, el, names), "topMode")} className={pillCls(mode === o.id)} data-testid={`card-top-${o.id}`}>{o.label}</button>
        ))}
      </div>
      {mode === "text" && (
        <input value={el.labelTop || ""} onChange={(e) => patch({ labelTop: e.target.value || undefined }, "labelTop")} placeholder="Texto encima" className={inputCls} aria-label="Texto por arriba de la ficha" autoFocus />
      )}
    </div>
  );
}

// Táctica: jugador de la plantilla, puesto y rol
function TacticPlayer({ el, patch, roster }) {
  const roles = el.pos ? getRoleOptions(el.pos) : [];
  const rolName = el.rol ? roleShort(el.rol) || roles.find((r) => r.value === el.rol)?.label : "";
  const names = { rol: rolName };
  const setPos = (pos) => {
    const next = { ...el, pos: pos || undefined, rol: undefined };
    const p = { pos: pos || undefined, rol: undefined };
    const mode = topModeOf(el, "none");
    if (mode === "pos" || mode === "rol") Object.assign(p, topPatch(mode, next, { rol: "" }));
    patch(p, "pos");
  };
  const setRol = (rol) => {
    const name = rol ? roleShort(rol) || roles.find((r) => r.value === rol)?.label : "";
    const p = { rol: rol || undefined };
    if (topModeOf(el, "none") === "rol") Object.assign(p, topPatch("rol", el, { rol: name }));
    patch(p, "rol");
  };
  return (
    <>
      <label className="block space-y-1"><span className={lab}>Jugador</span>
        <select value={el.player_id || ""} onChange={(e) => patch(tacticPlayerPatch(el, roster.find((r) => r.id === e.target.value) || null), "player")} className={inputCls} data-testid="card-player">
          <option value="">Sin jugador de la plantilla</option>
          {roster.map((r) => <option key={r.id} value={r.id}>{r.number ? `${r.number} · ` : ""}{r.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1"><span className={lab}>Puesto</span>
          <select value={el.pos || ""} onChange={(e) => setPos(e.target.value)} className={inputCls} data-testid="card-pos">
            <option value="">—</option>
            {TACTIC_POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className={lab}>Rol</span>
          <select value={el.rol || ""} onChange={(e) => setRol(e.target.value)} disabled={!roles.length} className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`} data-testid="card-rol">
            <option value="">{roles.length ? "—" : "Elige el puesto"}</option>
            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
      </div>
      <TopChoice el={el} patch={patch} names={names} options={[{ id: "pos", label: "Puesto" }, { id: "rol", label: "Rol" }, { id: "text", label: "Otro" }, { id: "none", label: "Nada" }]} />
      <details className="text-[12px] text-gray-600">
        <summary className="cursor-pointer select-none font-semibold text-club">Cambiar el dorsal o el nombre a mano</summary>
        <div className="grid grid-cols-[60px_1fr] gap-2 pt-1.5">
          <input value={el.inner || ""} maxLength={3} onChange={(e) => patch({ inner: e.target.value || undefined }, "inner")} className={`${inputCls} text-center`} aria-label="Texto dentro de la ficha" />
          <input value={el.label || ""} onChange={(e) => patch({ label: e.target.value }, "label")} className={inputCls} aria-label="Nombre de la ficha" />
        </div>
      </details>
    </>
  );
}

// Una fila de la pestaña Letra: tamaño + tipografía, negrita, color y borde de la letra
function LetterLine({ title, sizeKey, prefix, el, patch, bn, sizeTestid, fontTestid, note }) {
  const f = prefix ? el[`${prefix}Font`] || "sans" : null;
  const bold = prefix ? el[`${prefix}Bold`] !== false : null;
  const halo = prefix ? el[`${prefix}Halo`] : null;
  const k = (s) => `${prefix}${s}`;
  return (
    <div className="space-y-1" role="group" aria-label={title} data-testid={fontTestid}>
      <span className={lab}>{title}</span>
      <div className="flex flex-wrap items-end gap-1">
        <div className="w-[76px] shrink-0"><TextSizePick label="Tamaño" value={el[sizeKey]} onChange={(v) => patch({ [sizeKey]: v }, sizeKey)} testid={sizeTestid} /></div>
        {prefix ? (
          <>
            <select value={f} onChange={(e) => patch({ [k("Font")]: e.target.value === "sans" ? undefined : e.target.value }, k("Font"))} aria-label={`${title}: tipografía`}
              className="h-7 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1 text-xs text-gray-900" style={{ fontFamily: FONTS.find((x) => x.id === f)?.css }}>
              {FONTS.map((x) => <option key={x.id} value={x.id} style={{ fontFamily: x.css }}>{x.label}</option>)}
            </select>
            <button type="button" aria-pressed={bold} onClick={() => patch({ [k("Bold")]: bold ? false : undefined }, k("Bold"))} title="Negrita" aria-label={`${title}: negrita`}
              className={`h-7 w-7 shrink-0 rounded-md border text-xs font-black ${bold ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>B</button>
            {!bn && <ColorPick value={el[`${prefix}Color`] || ""} onChange={(c) => patch({ [k("Color")]: c || undefined }, k("Color"))} label="Color de la letra" auto="Automático" autoSwatch="#111827" />}
            <button type="button" aria-pressed={halo !== "none"} onClick={() => patch({ [k("Halo")]: halo === "none" ? undefined : "none" }, k("Halo"))} title={halo === "none" ? "Letra sin borde: tocar para ponérselo" : "Letra con borde: tocar para quitarlo"} aria-label={`${title}: borde de la letra`}
              className={`h-7 w-7 shrink-0 rounded-md border flex items-center justify-center ${halo === "none" ? "border-gray-200 bg-white" : "border-gray-900 bg-gray-100"}`}>
              <span className="text-[14px] font-black leading-none" style={halo === "none" ? { color: "#111827" } : { color: "#ffffff", WebkitTextStroke: "1.3px #111827" }}>A</span>
            </button>
          </>
        ) : <span className="pb-1.5 text-[11px] text-gray-500">{note}</span>}
      </div>
      {prefix && !bn && halo !== "none" && halo && (
        <div className="flex items-center gap-1 text-[11px] text-gray-500">Color del borde <ColorPick value={halo || ""} onChange={(c) => patch({ [k("Halo")]: c || undefined }, k("Halo"))} label="Color del borde de la letra" auto="Automático" autoSwatch="#ffffff" /></div>
      )}
    </div>
  );
}

export default function ChipCard({
  el, board, look, roster = [], variant = "tareas", playerSlot = null, describe = null,
  patch, onClose, onDup, onDel, canDelHere = false, locked = false, hl = false, onLock, onHl, onLayer, onTeamPanel, onLetterToTeam,
  style, sheet = false, onGrab,
}) {
  const [tab, setTabState] = React.useState(readTab);
  const [applied, setApplied] = React.useState(null); // «Hecho: n fichas» tras aplicar la letra a todo el equipo
  React.useEffect(() => { setApplied(null); }, [el.id, tab]);
  const setTab = (t) => { setTabState(t); saveTab(t); };
  const teams = teamsOf(board);
  const team = teams.find((t) => t.id === el.team) || teams[0];
  const base = chipOf(board);
  const pctOne = Math.round((base / DEFAULT_CHIP) * (Number(el.size) || 1) * 100);
  const own = el.color != null || el.pattern != null || el.color2 != null || el.stroke != null;
  const bn = look === "bn";
  const slot = playerSlot ? playerSlot(el, patch) : null;
  const tactic = !slot && variant === "tactica" && roster.length > 0 && (el.team === "a" || el.team === "gk");
  const custom = Boolean(slot || tactic);
  const sub = (describe && describe(el)) || team?.name || "";
  const head = el.label || (el.inner ? `Ficha ${el.inner}` : "Ficha");
  const labels = Boolean(el.label || el.labelTop);

  return (
    <div
      className={sheet
        ? "z-20 rounded-t-2xl border border-gray-200 bg-white text-gray-900 shadow-2xl flex flex-col"
        : "z-20 w-[300px] max-w-[calc(100%-8px)] rounded-xl border border-gray-200 bg-white text-gray-900 shadow-2xl flex flex-col"}
      style={style}
      data-testid="chip-quick"
      role="dialog"
      aria-label="Editar esta ficha"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className={`flex items-center gap-2 px-3 pt-2.5 pb-2 ${onGrab ? "cursor-move" : ""}`} onPointerDown={onGrab || undefined} data-testid="card-head">
        <ChipGlyph board={board} el={el} look={look} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold truncate leading-tight">{head}</div>
          <div className="text-[11.5px] text-gray-500 truncate">{sub}</div>
        </div>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} className="h-8 w-8 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500" aria-label="Cerrar" title="Cerrar"><X className="w-4 h-4" /></button>
      </div>
      <div className="mx-2.5 p-[3px] rounded-lg bg-[#F3EEED] grid grid-cols-3 gap-[3px]" role="tablist" aria-label="Pestañas de la ficha">
        {CARD_TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`card-tab-${t}`}
            className={`h-7 rounded-md text-[12.5px] font-semibold ${tab === t ? "bg-white text-club shadow-sm" : "text-gray-600"}`}>{TAB_LABEL[t]}</button>
        ))}
      </div>

      <div className="px-3 py-3 space-y-3 overflow-y-auto min-h-0" data-testid={`card-body-${tab}`}>
        {tab === "jugador" && (
          slot ? slot
            : tactic ? <TacticPlayer el={el} patch={patch} roster={roster} />
              : (
                <>
                  <TextFields el={el} patch={patch} focus={!sheet} />
                  <div className="space-y-1.5"><span className={lab}>Equipo</span><TeamDots board={board} el={el} look={look} patch={patch} /></div>
                </>
              )
        )}

        {tab === "aspecto" && (
          <>
            {custom && <div className="space-y-1.5"><span className={lab}>Equipo</span><TeamDots board={board} el={el} look={look} patch={patch} /></div>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {!bn && <ColorPick value={own ? chipStyle(board, el).color : ""} onChange={(c) => patch(c ? { color: c } : { color: undefined, pattern: undefined, color2: undefined, stroke: undefined })} label="Color" auto="El del equipo" autoSwatch={chipStyle(board, { team: el.team }).color} wide />}
              <ColorPick value={el.bib || ""} onChange={(c) => patch({ bib: c || undefined })} label="Peto" auto="Sin peto" autoSwatch={NO_FILL} wide />
            </div>
            <div className="space-y-1.5">
              <span className={lab}>Borde</span>
              <div className="flex flex-wrap items-center gap-2">
                {!bn && <ColorPick value={el.stroke || ""} onChange={(c) => patch({ stroke: c || undefined })} label="Color del borde" auto="El del equipo" autoSwatch={chipPaint(board, { team: el.team }, look).stroke} />}
                <div className="flex-1 min-w-[170px] grid grid-cols-4 gap-0.5 rounded-lg bg-[#F3EEED] p-0.5" role="group" aria-label="Grosor del borde" data-testid="card-edge">
                  {EDGE_STEPS.map((s) => {
                    const on = edgeStepOf(chipStyle(board, el).edge) === s.id;
                    return <button key={s.id} type="button" aria-pressed={on} onClick={() => patch({ edge: s.value }, "edge")} className={`h-7 rounded-md text-[11.5px] font-semibold ${on ? "bg-white text-club shadow-sm" : "text-gray-600"}`}>{s.label}</button>;
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><Slider label="Tamaño" value={pctOne} min={20} max={250} step={5} onChange={(v) => patch({ size: Math.round(((v / 100) * DEFAULT_CHIP / base) * 100) / 100 }, "size")} fmt={(v) => `${v}%`} width="w-full" /></div>
              <Toggle on={!!el.feet} onChange={(v) => patch({ feet: v || undefined })} title="Pies: marcan hacia dónde mira">Pies</Toggle>
            </div>
            {labels && (
              <div className="flex flex-wrap items-center gap-2">
                <ColorPick value={el.labelBg && el.labelBg !== "chip" && el.labelBg !== "none" ? el.labelBg : ""} onChange={(c) => patch({ labelBg: c || (board.labelChip ? "none" : undefined) })} label="Fondo de los textos" auto="Sin fondo" autoSwatch={NO_FILL} wide />
                {!bn && <Toggle on={!!labelBgOf(board, el) && labelBgOf(board, el) === chipStyle(board, el).color} onChange={(v) => patch({ labelBg: v ? "chip" : board.labelChip ? "none" : undefined })} title="El nombre con el color de la ficha">Nombre del color de la ficha</Toggle>}
              </div>
            )}
            {onTeamPanel && <button type="button" onClick={() => onTeamPanel(el.team)} className="text-[12px] font-semibold text-club hover:underline" data-testid="card-team-panel">Cambiar para todo el equipo →</button>}
          </>
        )}

        {tab === "letra" && (
          <>
            <LetterLine title="Dorsal" sizeKey="innerFs" prefix="inner" el={el} patch={patch} bn={bn} sizeTestid="fs-inner" fontTestid="chip-font-inner" />
            <LetterLine title="Nombre (y texto de encima)" sizeKey="labelFs" prefix="label" el={el} patch={patch} bn={bn} sizeTestid="fs-label" fontTestid="chip-font-label" />
            <LetterLine title="Texto de encima" sizeKey="topFs" el={el} patch={patch} bn={bn} sizeTestid="fs-top" note="Misma letra que el nombre" />
            {el.fnText && <LetterLine title="Función" sizeKey="fnFs" el={el} patch={patch} bn={bn} sizeTestid="fs-fn" note="Misma letra que el nombre; el color, en Jugador" />}
            {onLetterToTeam && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setApplied(onLetterToTeam())} data-testid="card-letter-team"
                  className="h-8 px-3 rounded-md border border-club bg-[#FBEFEF] text-[12px] font-semibold text-club hover:bg-[#F6E2E2]">Aplicar esta letra a todo el equipo</button>
                {applied != null && <span className="text-[11.5px] text-gray-600" role="status" data-testid="card-letter-done">{applied ? `Hecho: ${applied} ${applied === 1 ? "ficha" : "fichas"} de ${team?.name || "su equipo"}` : "Ya tenían todas esta letra"}</span>}
              </div>
            )}
            <p className="text-[11px] text-gray-500">Copia el tamaño, la tipografía, la negrita, el color y el borde de la letra (dorsal, nombre, texto de encima y función) a las demás fichas de {team?.name || "su equipo"}, en todos los fotogramas.</p>
          </>
        )}
      </div>

      <div className="border-t border-gray-100 px-1.5 py-1 flex items-center justify-between" role="toolbar" aria-label="Acciones de la ficha">
        <button type="button" className={iconBtn} onClick={onDup} aria-label="Duplicar" title="Duplicar (Ctrl + D)"><Copy className="w-4 h-4" /></button>
        <button type="button" className={`${iconBtn} ${locked ? "bg-gray-900 text-white hover:bg-gray-800" : ""}`} aria-pressed={locked} onClick={onLock} aria-label="Bloquear" title="Bloquear (B): no se mueve sin querer" data-testid="flag-lock"><Lock className="w-4 h-4" /></button>
        <button type="button" className={`${iconBtn} ${hl ? "bg-amber-300 text-gray-900 hover:bg-amber-300" : ""}`} aria-pressed={hl} onClick={onHl} aria-label="Resaltar" title="Resaltar (H)" data-testid="flag-hl"><Sun className="w-4 h-4" /></button>
        <button type="button" className={iconBtn} onClick={() => onLayer("front")} aria-label="Traer delante" title="Delante de todo"><BringToFront className="w-4 h-4" /></button>
        <button type="button" className={iconBtn} onClick={() => onLayer("back")} aria-label="Llevar detrás" title="Detrás de todo"><SendToBack className="w-4 h-4" /></button>
        <button type="button" className={iconBtn} disabled={!canDelHere} onClick={() => onDel("from")} aria-label="Desaparece desde este fotograma" title="Sigue en los fotogramas anteriores y desaparece desde este" data-testid="del-from-here"><EyeOff className="w-4 h-4" /></button>
        <button type="button" className={iconBtn} disabled={!canDelHere} onClick={() => onDel(true)} aria-label="Quitar solo de este fotograma" title="Quitar solo de este fotograma"><CircleSlash className="w-4 h-4" /></button>
        <button type="button" className={`${iconBtn} bg-red-50 text-red-700 hover:bg-red-100`} onClick={() => onDel(false)} aria-label="Quitar" title="Quitar de todos los fotogramas"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
