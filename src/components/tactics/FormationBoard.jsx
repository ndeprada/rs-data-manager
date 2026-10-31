import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import Board from "@/components/board/BoardSvg";
import { LOOKS, ORIENTS, VIEWS, fieldOf, isPersp, marginOf, perspectiveOf, toView, viewBox } from "@/lib/board";
import { SLOT_PREFIX, formationBoard, formationStyleOf } from "@/lib/tacticsBoard";
import { playerFullName } from "@/lib/playerName";
import { useT } from "@/i18n";

// Pestaña «Formación» de Herramientas → Táctica con el campo y las fichas de la pizarra común (mismo diseño que «Análisis de
// Jugadas» y las tareas): cada hueco del sistema es una ficha; al tocarla se elige el jugador. El aspecto (modo visual, vista plana
// o en perspectiva y orientación) se guarda en la pizarra.
const selectCls = "h-8 rounded-md border border-gray-200 bg-white px-2 text-xs";

export default function FormationBoard({ formation, assignments, players, f7, style, onStyle, onAssign, readOnly = false }) {
  const t = useT();
  const [open, setOpen] = useState(null); // clave del hueco cuyo jugador se está eligiendo
  const st = formationStyleOf(style);
  const board = useMemo(() => formationBoard({ formation, assignments, players, f7, style }), [formation, assignments, players, f7, style]);
  const field = fieldOf(board.field);
  const persp = isPersp(board) ? perspectiveOf(field, board.orient, marginOf(board.look, board)) : null;
  const vb = persp ? persp.vb : viewBox(field, board.orient, marginOf(board.look, board));
  const at = (el) => { const v = toView(field, board.orient, el); return persp ? persp.P(v) : v; };
  const pct = (p) => ({ left: `${((p.x - vb[0]) / vb[2]) * 100}%`, top: `${((p.y - vb[1]) / vb[3]) * 100}%` });
  const els = board.frames[0].els;
  const openEl = open ? els.find((e) => e.id === `${SLOT_PREFIX}${open}`) : null;
  const openPos = formation?.positions.find((p) => p.key === open);
  const active = players.filter((p) => p.status !== "baja").sort((a, b) => playerFullName(a).localeCompare(playerFullName(b)));
  const usedBy = Object.fromEntries(Object.entries(assignments || {}).map(([k, a]) => [a?.player_id, k]));
  const tall = board.orient !== "h" && board.orient !== "hi";
  return (
    <div className="space-y-2" data-testid="formation-board">
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={st.view} onChange={(e) => onStyle({ view: e.target.value })} className={selectCls} aria-label={t("Vista del campo")} disabled={readOnly}>
          {VIEWS.map((v) => <option key={v.id} value={v.id}>{t(v.label)}</option>)}
        </select>
        <select value={st.orient} onChange={(e) => onStyle({ orient: e.target.value })} className={selectCls} aria-label={t("Orientación del campo")} disabled={readOnly}>
          {ORIENTS.map((o) => <option key={o.id} value={o.id}>{t(o.label)}</option>)}
        </select>
        <select value={st.look} onChange={(e) => onStyle({ look: e.target.value })} className={selectCls} aria-label={t("Modo visual")} disabled={readOnly}>
          {LOOKS.map((l) => <option key={l.id} value={l.id}>{t(l.label)}</option>)}
        </select>
        <span className="text-[11px] text-gray-400 ml-auto">{readOnly ? "" : t("Toca una ficha para elegir el jugador")}</span>
      </div>
      <div className={`relative mx-auto ${tall ? "max-w-md" : "max-w-2xl"}`} style={{ aspectRatio: `${vb[2]} / ${vb[3]}` }}>
        <div className="absolute inset-0 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
          <Board board={board} els={els} selIds={open ? [`${SLOT_PREFIX}${open}`] : []} className="w-full h-full select-none" style={{ display: "block" }} label={t("Formación")} />
        </div>
        {/* zonas para tocar cada ficha (encima del dibujo, en el sitio donde se ve) */}
        {!readOnly && els.map((el) => {
          const key = el.id.slice(SLOT_PREFIX.length);
          return (
            <button
              key={el.id}
              type="button"
              data-testid={`slot-${key}`}
              aria-label={t("Elegir jugador: {pos}", { pos: formation?.positions.find((p) => p.key === key)?.label || key })}
              onClick={() => setOpen((o) => (o === key ? null : key))}
              className="absolute w-11 h-11 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:ring-2 focus-visible:ring-amber-400"
              style={pct(at(el))}
            />
          );
        })}
        {openEl && openPos && (
          <div
            className="absolute z-20 w-56 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden"
            style={{ ...pct(at(openEl)), left: `clamp(112px, ${pct(at(openEl)).left}, calc(100% - 112px))`, transform: `translate(-50%, ${at(openEl).y - vb[1] > vb[3] * 0.55 ? "calc(-100% - 26px)" : "26px"})` }}
            data-testid="slot-menu"
          >
            <div className="flex items-center px-3 py-1.5 border-b border-gray-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex-1">{t("{pos} — Asignar", { pos: t(openPos.label) })}</span>
              <button type="button" onClick={() => setOpen(null)} className="h-6 w-6 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500" aria-label={t("Cerrar")}><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {assignments?.[open]?.player_id && (
                <button type="button" onClick={() => { onAssign(open, null); setOpen(null); }} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-b border-gray-100">
                  {t("✕ Quitar jugador")}
                </button>
              )}
              {active.map((p) => {
                const other = usedBy[p.id] && usedBy[p.id] !== open;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onAssign(open, p.id); setOpen(null); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${assignments?.[open]?.player_id === p.id ? "bg-gray-100 font-semibold" : ""} ${other ? "text-gray-400" : "text-gray-700"}`}
                  >
                    <span className="w-6 text-right tabular-nums text-gray-400">{p.jersey_number ?? ""}</span>
                    <span className="truncate">{playerFullName(p)}</span>
                    {p.status === "lesionado" && <span className="ml-auto text-orange-400">⚠</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
