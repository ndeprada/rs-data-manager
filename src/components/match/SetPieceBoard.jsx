import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, BookmarkPlus, X, Copy, Users, Printer, FileDown, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFirstName } from "@/lib/playerName";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import "@/styles/rs2.css";

import { useT, msg } from "@/i18n";
import BoardEditor from "@/components/board/BoardEditor";
import SetPieceWizard from "@/components/match/SetPieceWizard";
import Board from "@/components/board/BoardSvg";
import { preloadKitData } from "@/lib/clubKits";
import { boardSvgMarkup } from "@/components/board/exportPng";
import { load3d } from "@/components/board/load3d";
import { animFrameCount, chipStyle, contrastColor, fnPosOf, is3D, isStadium, orbitOf, teamsOf } from "@/lib/board";
import { lab as cardLab, inputCls as cardInput, pillCls as cardPill } from "@/components/board/BoardChipCard";
import { ColorPick } from "@/components/board/BoardControls";
import { useAuthOptional } from "@/lib/AuthContext";
import { currentDefaults, rememberDefaults } from "@/lib/boardDefaults";
import {
  assignPlayer, copyPiece, proposeSquad, flipBoard, ownChips, pieceBoard, previousMatchPieces, legacyToBoard,
  SP_KINDS, typeOf, pieceSetup, printBoard, spBaseFrom, playerPatch, funcsFor, funcOf, fnPatch, setFunction, autoTitle, structuresFor, applyStructure, GK_FN, printCrop, squeezeForPrint, hasSide, setupLabel,
} from "@/lib/setPieceBoard";
import { C as clubColor, F as clubFont } from "@/lib/brand";
import { BRAND } from "@/lib/brand";
// Jugadas a balón parado con la pizarra común (la misma de tareas y tácticas). Rediseño del 06/11/2026 (maqueta «Maqueta ABP ·
// rediseño» aprobada por Nacho): dos vistas, «Editor» (a la izquierda las jugadas del partido con su dibujo pequeño, agrupadas
// en a favor / en contra; en el centro una franja con nombre, tipo, lado, estructura y señal encima de la pizarra; a la derecha
// «Quién hace qué» e instrucciones) y «Resumen del partido» (todas las jugadas en tarjetas, el orden y qué se imprime, con la
// barra de impresión).
// Las jugadas se guardan en la biblioteca del equipo y se pueden traer del partido anterior; al copiarlas se conservan los
// jugadores que siguen convocados y los demás quedan marcados con «?» para elegir otro. Lógica pura en src/lib/setPieceBoard.js.
const uid = () => Math.random().toString(36).slice(2, 9);
const newPiece = (n) => ({ id: uid(), name: `Jugada ${n}`, type: "corner_favor", signal: "", notes: "", tokens: [], arrows: [] });
const shortName = (p) => (p ? `${playerFirstName(p)} ${(p.last_name || "").split(" ")[0]}`.trim() : "");

// ── Plantillas de partida (coordenadas sobre el campo 300×240; se cambian los jugadores después) ──
const mkOwn = (x, y, label, role = "") => ({ id: uid(), kind: "own", x, y, size: 1, label, role, player_id: null, color: null });
const mkRiv = (x, y, label, role = "") => ({ id: uid(), kind: "rival", x, y, size: 1, label, role, player_id: null, color: null });
const mkBall = (x, y) => ({ id: uid(), kind: "ball", x, y, size: 1, label: "", role: "", player_id: null, color: null });
const mkArr = (x1, y1, x2, y2, o = {}) => ({ id: uid(), x1, y1, x2, y2, dashed: false, team: "own", ...o });
const TEMPLATES = [
  { key: "corner_favor", label: msg("Córner a favor"), make: () => ({ tokens: [mkOwn(30, 26, "L", msg("Lanzador")), mkBall(14, 14), mkRiv(150, 18, "P"), mkOwn(104, 44, "1", msg("1er palo")), mkOwn(150, 62, "2", msg("Rematador")), mkOwn(198, 44, "3", msg("2º palo")), mkOwn(100, 112, "R", msg("Rechace")), mkOwn(200, 112, "R", msg("Rechace")), mkOwn(150, 175, "C", msg("Cobertura"))],
    arrows: [mkArr(38, 26, 132, 50, { cx: 80, cy: 22 }), mkArr(198, 96, 198, 64, { dashed: true }), mkArr(150, 86, 114, 52, { dashed: true })] }) },
  { key: "corner_contra", label: msg("Córner en contra"), make: () => ({ tokens: [mkRiv(284, 22, "X", msg("Lanzador")), mkBall(292, 12), mkOwn(150, 18, "P"), mkOwn(112, 30, "Z"), mkOwn(188, 30, "Z"), mkOwn(90, 62, "Z"), mkOwn(130, 70, "Z"), mkOwn(170, 70, "Z"), mkOwn(210, 62, "Z"), mkOwn(118, 100, "M", msg("Marca")), mkOwn(182, 100, "M", msg("Marca")), mkOwn(150, 128, "C", msg("Cobertura")), mkRiv(104, 48, "1"), mkRiv(150, 46, "2"), mkRiv(196, 48, "3"), mkRiv(232, 80, "4")], arrows: [] }) },
  { key: "falta_lateral", label: msg("Falta lateral a favor"), make: () => ({ tokens: [mkOwn(44, 158, "L", msg("Lanzador")), mkBall(52, 152), ...[75, 105, 135, 165, 195, 225].map((x, i) => mkOwn(x, 118, String(i + 1))), mkOwn(112, 162, "R", msg("Rechace")), mkOwn(188, 162, "R", msg("Rechace")), mkOwn(150, 200, "C", msg("Cobertura"))],
    arrows: [mkArr(58, 150, 158, 40, { cx: 70, cy: 70 }), ...[75, 105, 135, 165, 195, 225].map((x, i) => mkArr(x, 114, 108 + i * 17, 62, { dashed: true }))] }) },
  { key: "falta_frontal", label: msg("Falta frontal a favor"), make: () => ({ tokens: [mkOwn(138, 132, "T", msg("Toque")), mkOwn(164, 132, "L", msg("Lanzador")), mkBall(150, 124), mkRiv(150, 18, "P"), ...[122, 136, 150, 164, 178].map((x) => ({ ...mkRiv(x, 102, "B"), size: 0.75 })), mkOwn(120, 52, "1"), mkOwn(150, 56, "2"), mkOwn(182, 52, "3"), mkOwn(96, 120, "R", msg("Rechace")), mkOwn(204, 120, "R", msg("Rechace")), mkOwn(150, 182, "C", msg("Cobertura"))], arrows: [mkArr(150, 118, 190, 36, { cx: 200, cy: 90 })] }) },
  { key: "falta_contra", label: msg("Falta en contra (barrera + zona)"), make: () => ({ tokens: [mkRiv(176, 132, "X", msg("Lanzador")), mkBall(166, 128), mkOwn(150, 18, "P"), ...[122, 136, 150, 164, 178].map((x, i) => ({ ...mkOwn(x, 100, String(i + 1), i === 0 ? msg("Barrera") : ""), size: 0.75 })), mkOwn(84, 62, "Z"), mkOwn(108, 64, "Z"), mkOwn(192, 64, "Z"), mkOwn(216, 62, "Z"), mkOwn(150, 72, "Z"), mkOwn(150, 150, "R", msg("Rechace"))], arrows: [] }) },
  { key: "saque_banda", label: msg("Saque de banda"), make: () => ({ tokens: [mkOwn(8, 124, "L", msg("Saque")), mkBall(18, 124), mkOwn(44, 100, "1"), mkOwn(50, 148, "2"), mkOwn(86, 124, "3"), mkRiv(58, 116, "A"), mkRiv(72, 138, "B")], arrows: [mkArr(26, 124, 80, 124), mkArr(86, 124, 120, 100, { dashed: true }), mkArr(44, 100, 70, 80, { dashed: true })] }) },

];

// ── Colores y piezas del aspecto de RS Manager (rs2) ──────────────────────────────────────────────────────────────
const RS = { granate: clubColor.primary, dark: clubColor.primaryDark, naranja: clubColor.accent, bg: "#F5F2F1", line: "#E6DEDD", soft: "#EEE7E6", ink: "#1E1416", ink2: "#4A3D3F", muted: "#6B5E60", input: "#D9CFCE" };
const DISPLAY = clubFont.titleBody;
const FN_LABEL = {
  zona: msg("Zona"), hombre: msg("Hombre"), rechace: msg("Rechace"), corta: msg("Corta"), palo: msg("Palo"),
  lanzador: msg("Lanzador"), rematador: msg("Rematador"), bloqueo: msg("Bloqueo"), cierra: msg("Cierra"), portero: msg("Portero"),
};
const KIND_LABEL = { corner: msg("Córner"), falta_lateral: msg("Falta lateral"), falta_frontal: msg("Falta frontal"), banda: msg("Saque de banda"), saque_centro: msg("Saque de centro"), penalti: msg("Penalti"), otro: msg("Otro") };
const SIDE_LABEL = { l: msg("Lado izquierdo"), r: msg("Lado derecho"), both: msg("Ambos lados") };

function Lab({ children, style }) {
  return <div role="heading" aria-level={3} className="rs2-label" style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: RS.muted, ...style }}>{children}</div>;
}
function Card({ children, testId, style }) {
  return <section className="rounded-xl bg-white flex flex-col" style={{ border: `1px solid ${RS.line}`, padding: "12px 14px", gap: 9, ...style }} data-testid={testId}>{children}</section>;
}
const btnOut = { height: 34, padding: "0 14px", borderRadius: 8, fontSize: 13, background: "#fff", color: RS.ink2, border: `1px solid ${RS.input}` };

// Pestaña «Jugador» de la tarjeta de una ficha del Racing (05/11/2026; función rehecha el 06/11/2026, Nacho: «no quiero que esto
// implique un cambio de color de la ficha… poder seleccionar si la función aparece encima de la ficha, debajo de la ficha, o el
// nombre debajo y la función todavía debajo… y el color del texto de la función»): jugador de los convocados, función, dónde se
// escribe y su color. `toTeam(keys)` copia esos campos a las demás fichas del Racing.
const FN_POS_OPTS = [
  { id: "top", label: msg("Encima") },
  { id: "below", label: msg("Debajo") },
  { id: "under", label: msg("Bajo el nombre") },
  { id: "none", label: msg("No mostrar") },
];
// Nombre solo en esta jugada (13/11/2026, Nacho: «algunos nombres o apellidos, al ser muy largos, tapan otros nombres…
// poder editar su nombre solo en la jugada»): la etiqueta vive en la ficha de la pizarra, así que cambiarla no toca la
// ficha del jugador ni otras jugadas. Atajos: solo el nombre, solo el apellido o la inicial con el apellido.
function NameInPlay({ el, pl, patch }) {
  const t = useT();
  const full = shortName(pl);
  const [first = "", last = ""] = full.split(" ");
  const opts = [...new Set([full, first, last, first && last ? `${first[0]}. ${last}` : ""].filter(Boolean))];
  const cur = el.label ?? full;
  return (
    <div className="space-y-1" data-testid="card-name-play">
      <span className={cardLab}>{t("Nombre en esta jugada")}</span>
      <input value={cur} maxLength={24} onChange={(e) => patch({ label: e.target.value }, "label")} className={cardInput} data-testid="card-name-input" />
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("Nombre en esta jugada")}>
        {opts.map((o) => (
          <button key={o} type="button" aria-pressed={cur === o} onClick={() => patch({ label: o }, "label")} className={`${cardPill(cur === o)} text-[11.5px]`} data-testid="card-name-opt">
            {o === full ? t("Como en su ficha") : o}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-500">{t("Solo cambia aquí: su ficha y las demás jugadas no se tocan.")}</p>
    </div>
  );
}

function AbpChipPlayer({ el, patch, candidates, byId, attack, toTeam }) {
  const t = useT();
  const [done, setDone] = useState(null);
  const funcs = [...(attack ? [] : [GK_FN]), ...funcsFor(attack)];
  const pl = el.player_id ? byId.get(el.player_id) : null;
  const fnName = (id) => (id && FN_LABEL[id] ? t(FN_LABEL[id]) : "");
  const pos = fnPosOf(el);
  return (
    <>
      <label className="block space-y-1"><span className={cardLab}>{t("Jugador")}</span>
        <select value={el.player_id || ""} onChange={(e) => patch(playerPatch(byId.get(e.target.value) || null), "player")} className={cardInput} data-testid="card-player">
          <option value="">{el.missing ? t("Elegir jugador…") : t("Sin asignar")}</option>
          {pl && !candidates.some((p) => p.id === pl.id) && <option value={pl.id}>{pl.jersey_number || "–"} · {shortName(pl)}</option>}
          {candidates.map((p) => <option key={p.id} value={p.id}>{p.jersey_number || "–"} · {shortName(p)}</option>)}
        </select>
      </label>
      {el.missing && <p className="text-[11.5px] font-semibold text-amber-700">{t("El jugador de esta ficha no está disponible: elige otro")}</p>}
      <div className="space-y-1.5">
        <span className={cardLab}>{t("Función")}</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("Función")} data-testid="card-fn">
          {funcs.map((f) => {
            const on = el.fn === f.id;
            return (
              <button key={f.id} type="button" aria-pressed={on} onClick={() => { setDone(null); patch(fnPatch(on ? null : f, el), "fn"); }} className={cardPill(on)} data-testid={`card-fn-${f.id}`}>
                {fnName(f.id)}
              </button>
            );
          })}
        </div>
      </div>
      {el.fnText && (
        <div className="space-y-1.5" data-testid="card-fn-style">
          <span className={cardLab}>{t("Dónde se escribe la función")}</span>
          <div className="grid grid-cols-4 gap-1" role="group" aria-label={t("Dónde se escribe la función")}>
            {FN_POS_OPTS.map((o) => (
              <button key={o.id} type="button" aria-pressed={pos === o.id} onClick={() => { setDone(null); patch({ fnPos: o.id === "under" ? undefined : o.id }, "fnPos"); }}
                className={`${cardPill(pos === o.id)} px-1 text-[11.5px] leading-tight`} data-testid={`card-fnpos-${o.id}`}>{t(o.label)}</button>
            ))}
          </div>
          {pos !== "none" && (
            <div className="flex items-center gap-2 text-[12px] text-gray-600">
              <span>{t("Color de la función")}</span>
              <ColorPick value={el.fnColor || ""} onChange={(c) => { setDone(null); patch({ fnColor: c || undefined }, "fnColor"); }} label={t("Color de la función")} auto={t("Como el nombre")} autoSwatch="#111827" />
            </div>
          )}
          {toTeam && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setDone(toTeam(["fnPos", "fnColor", "fnFs"]))} data-testid="card-fn-team"
                className="h-7 px-2.5 rounded-md border border-club bg-[#FBEFEF] text-[11.5px] font-semibold text-club hover:bg-[#F6E2E2]">{t("Igual en todas las fichas del Racing")}</button>
              {done != null && <span className="text-[11px] text-gray-600" role="status" data-testid="card-fn-team-done">{done ? t("Hecho: {n} fichas", { n: done }) : t("Ya estaban todas así")}</span>}
            </div>
          )}
        </div>
      )}
      <label className="block space-y-1"><span className={cardLab}>{t("Texto libre encima de la ficha")}</span>
        <input value={el.labelTop || ""} maxLength={24} onChange={(e) => patch({ labelTop: e.target.value || undefined, topMode: undefined }, "labelTop")}
          placeholder={t("p. ej. 1.er PALO, SALE AL CORTE…")} className={cardInput} data-testid="card-free-top" />
      </label>
      {pl && <NameInPlay el={el} pl={pl} patch={patch} />}
      <p className="text-[11.5px] text-gray-500">{t("El dorsal sale de su ficha. La función no cambia el color de la ficha (solo el portero va en verde).")}</p>
    </>
  );
}

// Dibujo pequeño de una jugada (lista del editor y tarjetas del resumen): primer fotograma, plano, en vertical y en blanco
function PieceThumbRaw({ piece, lookup }) {
  const data = useMemo(() => {
    const b0 = printBoard(pieceBoard(piece, lookup), { view: "flat", orient: "v" });
    const b = isStadium(b0.look) ? { ...b0, look: "blanco" } : b0;
    return { b, crop: printCrop(b, 1.3, { tight: true }) };
  }, [piece, lookup]);
  return <Board board={data.b} els={data.b.frames[0]?.els || []} frame={0} camera={null} viewOverride={data.crop} style={{ width: "100%", height: "100%", display: "block" }} />;
}
const PieceThumb = memo(PieceThumbRaw);

const segOuter = { display: "inline-flex", background: RS.bg, borderRadius: 999, padding: 2 };
const segBtn = (on) => ({ height: 28, padding: "0 11px", borderRadius: 999, fontSize: 13, fontWeight: on ? 600 : 400, background: on ? RS.dark : "transparent", color: on ? "#fff" : RS.ink2 });
const iconBtn = { width: 34, height: 34, borderRadius: 8, border: `1px solid ${RS.line}`, background: "#fff", color: RS.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center" };
const selPill = { height: 32, borderRadius: 999, border: `1px solid ${RS.input}`, background: "#fff", fontSize: 13, fontWeight: 600, color: RS.ink, padding: "0 10px" };

// Una jugada (rediseño del 06/11/2026, maqueta «Maqueta ABP · rediseño» aprobada por Nacho): encima de la pizarra, en una franja,
// el nombre, el tipo, a favor / en contra, el lado, la estructura de partida, el resumen automático y la señal; la pizarra de
// siempre; a la derecha «Quién hace qué» (jugador y función de cada ficha) y las instrucciones.
function PieceEditor({ piece, onChange, candidates, lookup, teamId, onSave, onDuplicate, onRemove, libLinked, onPrint, busy, total, shirtKit }) {
  const t = useT();
  const board = pieceBoard(piece, lookup);
  const setup = pieceSetup(piece);
  const funcs = funcsFor(setup.attack);
  const saved = (s) => ({ kind: s.kind, attack: s.attack, side: s.side, draw_side: s.drawSide, ...(s.kind === "otro" ? { kind_other: s.other } : {}) });
  const setBoard = (b) => onChange({ ...piece, ...saved(setup), type: typeOf(setup.kind, setup.attack), board: b });
  // Lado: izquierda ↔ derecha da la vuelta a la jugada; «ambos lados» solo cambia el texto (06/11/2026)
  const setSetup = (next) => {
    const s = { ...setup, ...next };
    let b = board;
    if ((next.side === "l" || next.side === "r") && next.side !== setup.drawSide) { b = flipBoard(b); s.drawSide = next.side; }
    onChange({ ...piece, ...saved(s), type: typeOf(s.kind, s.attack), board: b });
  };
  const chips = ownChips(board);
  const { title, mark } = autoTitle(board, setup);
  const byId = new Map(lookup.map((p) => [p.id, p]));
  const structs = structuresFor(setup.kind, setup.attack);
  const tpl = TEMPLATES.find((x) => x.key === typeOf(setup.kind, setup.attack));
  const hasEls = board.frames.some((f) => f.els.length);
  // Vista base de las jugadas nuevas (07/11/2026, Nacho): se guarda la de esta jugada en el perfil de quien la usa
  const auth = useAuthOptional();
  const [baseMsg, setBaseMsg] = useState("");
  const saveBase = () => {
    const d = rememberDefaults({ ...currentDefaults(auth?.user), sp: spBaseFrom(board) });
    base44.auth?.updateMe?.({ board_defaults: d }).catch(() => {});
    setBaseMsg(t("Guardada"));
    setTimeout(() => setBaseMsg(""), 2000);
  };
  // Opciones de la pizarra fuera del campo (07/11/2026): la columna de la derecha las recibe solo si está al lado de la pizarra
  // (en pantallas estrechas la columna baja debajo y las opciones se quedan sobre el campo, como antes)
  const [sideEl, setSideEl] = useState(null);
  const [beside, setBeside] = useState(false);
  const rowRef = useRef(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !sideEl || typeof ResizeObserver === "undefined") return undefined;
    const check = () => { const a = sideEl.parentElement?.getBoundingClientRect(), r = row.firstElementChild?.getBoundingClientRect(); setBeside(!!a && !!r && a.left >= r.right - 4); };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(row);
    return () => ro.disconnect();
  }, [sideEl]);
  const applyTpl = () => {
    if (!tpl) return;
    if (hasEls && !window.confirm(t("Se cambiará todo el dibujo de esta jugada. ¿Seguir?"))) return;
    const made = tpl.make();
    let b = legacyToBoard({ id: piece.id, tokens: made.tokens, arrows: made.arrows });
    if (setup.drawSide === "l") b = flipBoard(b);
    setBoard(b);
  };
  const pickStructure = (id) => {
    if (id === "__tpl") return applyTpl();
    const st = structs.find((x) => x.id === id);
    if (st) setBoard(applyStructure(board, st, { side: setup.drawSide, newId: uid }));
  };
  const order = (c) => (c.fn === "portero" ? -1 : funcs.findIndex((f) => f.id === c.fn) === -1 ? 99 : funcs.findIndex((f) => f.id === c.fn));
  const sortedChips = [...chips].sort((a, b) => order(a) - order(b));

  const header = (
    <section className="rounded-xl bg-white flex flex-col" style={{ border: `1px solid ${RS.line}`, padding: "12px 16px", gap: 10 }} data-testid="sp-head">
      <div className="flex items-center" style={{ gap: 10 }}>
        <input value={piece.name || ""} onChange={(e) => onChange({ ...piece, name: e.target.value })} placeholder={t("Nombre de la jugada")} aria-label={t("Nombre de la jugada")}
          className="flex-1 min-w-0 outline-none rounded-md hover:bg-[#F5F2F1] focus:bg-[#F5F2F1]" style={{ fontFamily: DISPLAY, fontSize: 28, lineHeight: 1.1, color: RS.granate, textTransform: "uppercase", padding: "2px 6px", margin: "0 -6px", background: "transparent", border: "none" }} data-testid="sp-name" />
        <span className="hidden sm:inline" style={{ fontSize: 12, color: RS.muted, whiteSpace: "nowrap" }}>{animFrameCount(board) > 1 ? t("Hoja + animación ({n} fotogramas)", { n: animFrameCount(board) }) : t("Solo hoja")}{libLinked ? ` · ${t("en la biblioteca")}` : ""}</span>
        <button type="button" onClick={saveBase} data-testid="sp-base-save"
          title={t("Las jugadas nuevas que crees saldrán con el campo, la vista, la orientación, los colores de los equipos y el tamaño y la letra de las fichas de esta jugada")}
          className="inline-flex items-center whitespace-nowrap" style={{ height: 34, padding: "0 10px", gap: 5, borderRadius: 8, border: `1px solid ${RS.line}`, background: baseMsg ? RS.granate : "#fff", color: baseMsg ? "#fff" : RS.ink2, fontSize: 12.5, fontWeight: 600 }}>
          <Star className="w-3.5 h-3.5" fill={baseMsg ? "currentColor" : "none"} />{baseMsg || t("Usar como vista base")}
        </button>
        <button type="button" onClick={onDuplicate} title={t("Duplicar")} aria-label={t("Duplicar")} style={iconBtn} data-testid="sp-dup"><Copy className="w-4 h-4" /></button>
        <button type="button" onClick={onSave} disabled={!teamId} title={libLinked ? t("Actualizar en la biblioteca") : t("Guardar en biblioteca")} aria-label={libLinked ? t("Actualizar en la biblioteca") : t("Guardar en biblioteca")} style={{ ...iconBtn, color: libLinked ? RS.granate : RS.ink2 }} className="disabled:opacity-40" data-testid="sp-save-lib"><BookmarkPlus className="w-4 h-4" /></button>
        <button type="button" onClick={onRemove} title={t("Quitar del partido")} aria-label={t("Quitar del partido")} style={{ ...iconBtn, color: "#B42318" }} data-testid="sp-remove"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
        <span className="inline-flex items-center" style={{ background: RS.bg, borderRadius: 999, padding: 2 }} data-testid="sp-chips">
          <span style={{ fontSize: 11.5, color: RS.muted, padding: "0 6px 0 8px" }}>{t("Fichas")}</span>
          <button type="button" style={segBtn(!board.realShirts)} onClick={() => board.realShirts && setBoard({ ...board, realShirts: undefined })} data-testid="sp-chips-buttons">{t("Botones")}</button>
          <button type="button" style={segBtn(!!board.realShirts)} onClick={() => { if (!board.realShirts) { preloadKitData(); setBoard({ ...board, realShirts: true, shirtKit: shirtKit || board.shirtKit }); } }} data-testid="sp-chips-shirts">{t("Camisetas")}</button>
        </span>
        <select value={setup.kind} onChange={(e) => setSetup({ kind: e.target.value })} aria-label={t("Tipo de jugada")} style={selPill} data-testid="sp-kind">
          {SP_KINDS.map((k) => <option key={k.id} value={k.id}>{t(KIND_LABEL[k.id])}</option>)}
        </select>
        {setup.kind === "otro" && (
          <input value={piece.kind_other || ""} onChange={(e) => onChange({ ...piece, kind_other: e.target.value })} placeholder={t("Qué jugada es (p. ej. saque de puerta)")} aria-label={t("Tipo de jugada")}
            className="outline-none focus:ring-1 focus:ring-club" style={{ ...selPill, fontWeight: 400, width: 220, padding: "0 12px" }} data-testid="sp-kind-other" />
        )}
        <span role="group" aria-label={t("A favor o en contra")} style={segOuter}>
          <button type="button" aria-pressed={setup.attack} onClick={() => setSetup({ attack: true })} style={segBtn(setup.attack)} data-testid="sp-attack">{t("A favor")}</button>
          <button type="button" aria-pressed={!setup.attack} onClick={() => setSetup({ attack: false })} style={segBtn(!setup.attack)} data-testid="sp-defense">{t("En contra")}</button>
        </span>
        {hasSide(setup.kind) && (
          <span role="group" aria-label={t("Lado")} style={segOuter}>
            {[["l", t("Izquierdo")], ["r", t("Derecho")], ["both", t("Ambos")]].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={setup.side === v} onClick={() => setSetup({ side: v })} style={segBtn(setup.side === v)} data-testid={`sp-side-${v}`}>{l}</button>
            ))}
          </span>
        )}
        {(structs.length > 0 || tpl) && (
          <select value="" onChange={(e) => { if (e.target.value) pickStructure(e.target.value); }} aria-label={t("Estructura de partida")} style={{ ...selPill, fontWeight: 400, color: RS.ink2 }} data-testid="sp-structure">
            <option value="">{t("Estructura de partida…")}</option>
            {structs.map((st) => <option key={st.id} value={st.id}>{t(st.label)}</option>)}
            {!structs.length && tpl && <option value="__tpl">{t("Básica: {name}", { name: t(tpl.label) })}</option>}
          </select>
        )}
        <span className="flex-1" />
        {(title || mark) && (
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".05em", color: RS.muted, textAlign: "right" }}>
            {title && <span style={{ fontFamily: DISPLAY, fontSize: 15, letterSpacing: 0, color: RS.dark, marginRight: 8 }} data-testid="sp-auto-title">{title}</span>}
            {mark && <span data-testid="sp-auto-subtitle">{mark}</span>}
          </span>
        )}
      </div>
      <label className="flex items-center" style={{ gap: 10, minHeight: 36, borderRadius: 999, background: RS.granate, color: "#fff", padding: "0 6px 0 14px" }}>
        <span style={{ fontFamily: DISPLAY, fontSize: 15, letterSpacing: ".04em" }}>{t("SEÑAL")}</span>
        <input value={piece.signal || ""} onChange={(e) => onChange({ ...piece, signal: e.target.value })} placeholder={t("Señal: levantar el balón, brazo derecho extendido…")} aria-label={t("Señal")}
          className="flex-1 min-w-0 outline-none placeholder:text-white/60" style={{ height: 28, border: "none", borderRadius: 999, background: "rgba(255,255,255,.13)", color: "#fff", fontSize: 14, padding: "0 12px" }} data-testid="sp-signal" />
      </label>
    </section>
  );

  // A pantalla completa: un título pequeño, solo para leer, con el nombre, el tipo y la señal
  const kindText = setup.kind === "otro" ? setup.other || t("Otra jugada") : t(KIND_LABEL[setup.kind]);
  const studioTag = (
    <div style={{ background: "rgba(54,0,13,.92)", borderRadius: 10, padding: "7px 12px", color: "#fff", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 19, lineHeight: 1, textTransform: "uppercase" }}>{piece.name || t("Sin nombre")}</span>
      <span style={{ fontSize: 12, color: "#E8C9CD" }}>{[kindText, setup.attack ? t("A favor") : t("En contra"), hasSide(setup.kind) ? t(SIDE_LABEL[setup.side]) : ""].filter(Boolean).join(" · ")}</span>
      {piece.signal && <span style={{ alignSelf: "flex-start", fontSize: 12, background: RS.granate, border: "1px solid rgba(255,255,255,.35)", borderRadius: 999, padding: "2px 9px" }}><b style={{ fontFamily: DISPLAY, fontWeight: 400 }}>{t("SEÑAL")}</b> · {piece.signal}</span>}
    </div>
  );

  return (
    <div ref={rowRef} className="flex flex-wrap items-start" style={{ gap: 14 }}>
      {/* Centro: la jugada y la pizarra */}
      <div className="min-w-0 flex flex-col" style={{ flex: "999 1 560px", gap: 8 }} data-testid="sp-board">
        {header}
        <BoardEditor value={board} onChange={setBoard} fields={["half", "tq", "full", "free"]} filename={piece.name || t("Jugada")}
          embedded embedHeight={620} studioTitle={studioTag}
          variant="abp" sideHost={beside ? sideEl : null}
          chipPlayer={(el, patch, toTeam) => (el.team === "a" ? <AbpChipPlayer el={el} patch={patch} candidates={candidates} byId={byId} attack={setup.attack} toTeam={toTeam} /> : null)}
          chipDescribe={(el) => (el.team === "a" && el.fn && FN_LABEL[el.fn] ? `${teamsOf(board).find((x) => x.id === "a")?.name || BRAND.shortName} · ${t(FN_LABEL[el.fn])}` : null)} />
      </div>

      {/* Derecha: quién hace qué */}
      <aside className="flex flex-col" style={{ flex: "1 1 260px", maxWidth: 320, minWidth: 240, gap: 12 }}>
        <div ref={setSideEl} className="empty:hidden" data-testid="sp-board-side" />
        <Card testId="sp-players" style={{ padding: 0, gap: 0, overflow: "clip" }}>
          <div className="flex flex-wrap items-baseline justify-between" style={{ padding: "12px 14px 8px", columnGap: 8, rowGap: 4 }}>
            <Lab style={{ whiteSpace: "nowrap" }}>{t("Quién hace qué")}{chips.length ? ` · ${chips.length}` : ""}</Lab>
            <button type="button" onClick={() => setBoard(proposeSquad(board, candidates, setup.attack))} disabled={!chips.some((c) => !c.player_id) || !candidates.length}
              className="inline-flex items-center disabled:opacity-40" style={{ gap: 4, fontSize: 12, fontWeight: 600, color: RS.granate, whiteSpace: "nowrap" }}>
              <Users className="w-3.5 h-3.5" /> {t("Rellenar con convocados")}
            </button>
          </div>
          {sortedChips.length === 0 ? (
            <p style={{ margin: 0, padding: "0 14px 12px", fontSize: 12, color: RS.muted }}>{t("Elige una estructura de partida o coloca fichas del Racing en la pizarra.")}</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {sortedChips.map((c) => {
                const pl = c.player_id ? byId.get(c.player_id) : null;
                const cs = chipStyle(board, c);
                const bg = c.missing ? "#fef3c7" : cs.color || RS.granate;
                return (
                  <li key={c.id} className="flex items-center" style={{ gap: 6, minHeight: 34, padding: "1px 10px 1px 14px", borderTop: `1px solid ${RS.soft}` }}>
                    <span className="flex items-center justify-center shrink-0" title={c.missing ? t("El jugador de esta ficha no está disponible: elige otro") : undefined}
                      style={{ width: 24, height: 24, borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: c.missing ? "#92400e" : contrastColor(bg), border: `1.5px solid ${c.missing ? "#f59e0b" : cs.stroke || bg}` }}>{c.inner || "·"}</span>
                    <Select value={c.player_id || "__none__"} onValueChange={(v) => setBoard(assignPlayer(board, c.id, v === "__none__" ? null : byId.get(v) || null))}>
                      <SelectTrigger className="h-8 text-[13px] border-0 shadow-none bg-transparent px-1 flex-1 min-w-0"><SelectValue placeholder={t("Sin asignar")} /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none__">{c.missing ? t("Elegir jugador…") : t("Sin asignar")}</SelectItem>
                        {pl && !candidates.some((p) => p.id === pl.id) && <SelectItem value={pl.id}>{pl.jersey_number || "–"} · {shortName(pl)}</SelectItem>}
                        {candidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.jersey_number || "–"} · {shortName(p)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <select value={c.fn === "portero" ? "portero" : funcOf(setup.attack, c.fn) ? c.fn : ""} aria-label={t("Función")}
                      onChange={(e) => { const v = e.target.value; setBoard(setFunction(board, c.id, funcOf(setup.attack, v))); }}
                      className="shrink-0 outline-none" style={{ height: 26, borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "0 6px", maxWidth: 110, border: `1px solid ${RS.line}`, background: RS.bg, color: RS.ink2 }}>
                      <option value="">{t("Sin función")}</option>
                      {!setup.attack && <option value="portero">{t("Portero")}</option>}
                      {funcs.map((fx) => <option key={fx.id} value={fx.id}>{t(FN_LABEL[fx.id])}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <Lab>{t("Instrucciones")}</Lab>
          <textarea rows={6} value={piece.notes || ""} onChange={(e) => onChange({ ...piece, notes: e.target.value })} placeholder={t("Quién saca, quién ataca el primer palo, rechace…")}
            className="w-full outline-none focus:ring-1 focus:ring-club resize-y" style={{ borderRadius: 8, border: `1px solid ${RS.input}`, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.45, minHeight: 116, color: RS.ink }} />
          <p style={{ margin: 0, fontSize: 11.5, color: RS.muted }}>{t("Salen en la hoja impresa, debajo del campo.")}</p>
        </Card>
        {/* Imprimir sin salir del editor (la hoja = el fotograma «Hoja») */}
        <section className="rounded-xl flex flex-col" style={{ background: RS.dark, color: "#fff", padding: "12px 14px", gap: 9 }} data-testid="sp-print-card">
          <div role="heading" aria-level={3} style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#E8C9CD" }}>{t("Imprimir")}</div>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            <button type="button" disabled={!!busy} onClick={() => onPrint("one")} className="disabled:opacity-50" style={{ height: 32, padding: "0 12px", borderRadius: 999, background: "#fff", color: RS.dark, fontSize: 13, fontWeight: 700 }} data-testid="sp-print-one">{t("Esta jugada")}</button>
            <button type="button" disabled={!!busy || total < 1} onClick={() => onPrint("bench")} className="disabled:opacity-50" style={{ height: 32, padding: "0 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.4)", color: "#fff", fontSize: 13, fontWeight: 600 }} data-testid="sp-print-bench">{t("Todas en una (banquillo)")}</button>
          </div>
          <button type="button" onClick={() => onPrint("more")} style={{ alignSelf: "flex-start", fontSize: 12.5, color: "#FFD3B0", fontWeight: 600 }} data-testid="sp-print-more">{t("Más opciones: 2 o 4 por hoja, vista, PDF…")}</button>
          <p style={{ margin: 0, fontSize: 11.5, color: "#E8C9CD" }}>{t("Se imprime la hoja, en fondo blanco: casi no gasta tinta.")}</p>
        </section>
      </aside>
    </div>
  );
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Dibujo de una jugada para imprimir: el primer fotograma de su pizarra, con la vista y la orientación elegidas en el panel
// «Imprimir» (`printBoard`); el estadio sale en blanco (poca tinta). Se recorta a la zona de la jugada y a la proporción del
// hueco de la hoja (`printCrop`, 06/11/2026) para que el campo salga lo más grande posible. En 3D se hace una imagen (PNG);
// en plano y perspectiva, SVG. Los dos llenan su hueco sin deformarse.
const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
let printSeq = 0;
async function pieceSvg(piece, players, opts = {}, aspect = 1.4) {
  const b = printBoard(pieceBoard(piece, players), opts);
  // campo algo más corto (`squeezeForPrint`): con 2 o 4 por hoja sale más grande
  const printable = squeezeForPrint(isStadium(b.look) ? { ...b, look: "blanco" } : b);
  const crop = printCrop(printable, aspect, { tight: true });
  if (is3D(printable)) {
    const ar = crop ? crop[2] / crop[3] : aspect;
    const c = document.createElement("canvas");
    c.width = 2400; c.height = Math.round(2400 / ar);
    await (await load3d()).renderBoard3D(c, printable, printable.frames[0].els, { frame: 0, orbit: orbitOf(printable, 0), ...(crop ? { viewOverride: crop } : {}) });
    const url = await blobToDataUrl(await new Promise((res, rej) => c.toBlob((x) => (x ? res(x) : rej(new Error("PNG"))), "image/png")));
    return { html: `<img src="${url}" alt="">`, ar };
  }
  const { svg } = await boardSvgMarkup(<Board board={printable} els={printable.frames[0].els} frame={0} camera={null} viewOverride={crop} />, 1600);
  // cada dibujo con sus propios nombres internos: varios en la misma hoja compartían el recorte y los rellenos del primero
  const pre = `p${++printSeq}-`;
  const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1]?.split(/[\s,]+/).map(Number);
  const ar = crop ? crop[2] / crop[3] : vb && vb[3] ? vb[2] / vb[3] : aspect;
  const html = svg.replace(/ width="\d+(\.\d+)?" height="\d+(\.\d+)?"/, "")
    .replace(/\bid="/g, `id="${pre}`).replace(/url\(#/g, `url(#${pre}`).replace(/href="#/g, `href="#${pre}`);
  return { html, ar };
}

// Hojas A4 sin márgenes de la impresora (así el navegador no escribe arriba y abajo el título, la dirección ni la fecha):
// el margen lo pone cada hoja (10 mm). 1, 2 o 4 jugadas por hoja (4 = dos columnas y dos filas); las instrucciones van
// debajo del campo, a todo el ancho, y el campo ocupa todo lo que queda. «Descargar PDF» compone las mismas hojas en la
// página (fuera de la vista) y las fotografía (`downloadSessionPdf`, como la hoja de sesión).
const PAGE_W = 196, PAGE_H = 283, GAP = 6; // margen de 7 mm (13/11/2026: el campo, lo más grande posible)
// Hoja rediseñada (06/11/2026, Nacho: «estamos perdiendo mucho espacio… la señal con una pastillita naranja encima a la
// derecha del campo… el escudo un poco más pequeño, Racing Sarrià y debajo el equipo con la misma tipografía… el tipo de
// jugada y el nombre… el campo más corto»): cabecera de una línea, una franja pequeña con el título automático y la señal,
// el campo recortado a lo justo de la jugada (a todo el ancho) e instrucciones debajo.
const SZ = {
  1: { logo: 11, club: 13, team: 11, h2: 22, kind: 10.5, em: 10, sig: 10, notes: 11, notesb: 9.5, notesMax: 80, pad: 2.5 },
  2: { logo: 8.5, club: 10, team: 8.5, h2: 16, kind: 8.5, em: 8.5, sig: 8.5, notes: 9.5, notesb: 8.5, notesMax: 34, pad: 2 },
  4: { logo: 6.5, club: 7.5, team: 6.5, h2: 11.5, kind: 6.5, em: 6.5, sig: 6.5, notes: 7.5, notesb: 6.5, notesMax: 30, pad: 1.3 },
};
// Proporción del hueco del campo (solo orienta el recorte; con «lo justo» manda la jugada)
function fieldBoxAspect(p, per) {
  if (per === "all") return ((PAGE_W - 4) / 2) / 46;
  const w = per === 4 ? (PAGE_W - GAP) / 2 : PAGE_W;
  const card = per === 1 ? PAGE_H : (PAGE_H - GAP) / 2;
  return w / Math.max(30, card * 0.6);
}
// Estilos de las hojas; `sc` = prefijo para usarlos dentro de la página (PDF) sin tocar el resto de la app
function sheetCss(per, sc = "") {
  const z = SZ[per] || SZ[1];
  const one = per === 1;
  const D = `font-family:${clubFont.title};font-weight:400;letter-spacing:.3px;text-transform:uppercase`;
  return `
    ${sc}.page{width:210mm;height:297mm;padding:7mm;display:${per === 4 ? "grid" : "flex"};${per === 4 ? "grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;" : "flex-direction:column;"}gap:${GAP}mm;overflow:hidden;break-after:page;page-break-after:always;background:#fff;box-sizing:border-box;font-family:'${clubFont.bodyName}',Arial,sans-serif;color:#222}
    ${sc}.page *{box-sizing:border-box}
    ${sc}.page:last-child{break-after:auto;page-break-after:auto}
    ${sc}.card{${per === 4 || per === "all" ? "" : `flex:${one ? "1 1 0" : `0 0 ${(PAGE_H - GAP) / 2}mm`};`}min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
    ${sc}header{flex:none;display:flex;justify-content:space-between;align-items:center;gap:${z.pad * 2}mm;padding-bottom:${z.pad * 0.6}mm;border-bottom:.5mm solid ${clubColor.primary}}
    ${sc}.club{display:flex;align-items:center;gap:${z.pad * 0.8}mm;flex:none} ${sc}.club img{height:${z.logo}mm;width:auto;display:block}
    ${sc}.club b{display:block;${D};font-size:${z.club}pt;color:${clubColor.primary};line-height:1} ${sc}.club span{display:block;${D};font-size:${z.team}pt;color:${clubColor.accent};line-height:1.05;margin-top:.4mm}
    ${sc}.ttl{text-align:right;min-width:0} ${sc}.ttl span{display:block;${D};font-size:${z.kind}pt;color:${clubColor.accent};line-height:1}
    ${sc}.ttl h2{margin:.5mm 0 0;${D};font-size:${z.h2}pt;line-height:1;color:${clubColor.primary};overflow-wrap:anywhere}
    ${sc}.meta{flex:none;display:flex;justify-content:space-between;align-items:center;gap:${z.pad * 1.5}mm;margin:${z.pad * 0.6}mm 0 ${z.pad * 0.5}mm;min-height:${z.sig * 0.5}mm}
    ${sc}.meta em{font-style:normal;${D};font-size:${z.em}pt;color:${clubColor.primaryDark};min-width:0}
    ${sc}.sig{margin-left:auto;display:inline-flex;align-items:baseline;gap:1.5mm;background:${clubColor.primary};color:#fff;border-radius:10mm;padding:${z.pad * 0.3}mm ${z.pad * 1.2}mm;font-size:${z.sig}pt;font-weight:600;line-height:1.2;max-width:65%}
    ${sc}.sig b{${D};font-size:${z.sig * 0.9}pt;letter-spacing:.6px;flex:none}
    ${sc}.fld{flex:0 1 auto;width:100%;min-height:0;position:relative} ${sc}header + .fld{margin-top:${z.pad}mm}
    ${sc}.fld svg,${sc}.fld img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;overflow:hidden}
    ${sc}.notes{flex:none;margin-top:${z.pad}mm;font-size:${z.notes}pt;white-space:pre-wrap;color:#333;border-left:.5mm solid ${clubColor.accent};padding-left:${z.pad}mm;font-weight:500;line-height:1.3;max-height:${z.notesMax}mm;overflow:hidden}
    ${sc}.notes b{display:block;${D};color:${clubColor.accent};font-size:${z.notesb}pt;letter-spacing:.5px;margin-bottom:.6mm}
    ${per === "all" ? `
    ${sc}.bqtop{flex:none;display:flex;align-items:center;gap:3mm;padding-bottom:1.5mm;border-bottom:.5mm solid ${clubColor.primary}}
    ${sc}.bqtop img{height:8mm;width:auto;display:block} ${sc}.bqtop b{display:block;${D};font-size:15pt;color:${clubColor.primary};line-height:1} ${sc}.bqtop span{display:block;${D};font-size:9pt;color:${clubColor.accent};line-height:1.1;margin-top:.4mm}
    ${sc}.bqtop em{margin-left:auto;font-style:normal;font-size:7.5pt;color:#6B5E60;text-align:right;line-height:1.3}
    ${sc}.bqg{flex:1 1 0;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:4mm}
    ${sc}.bqc{border:.3mm solid #E6DEDD;border-radius:2mm;padding:2mm;gap:1.2mm}
    ${sc}.bqh{flex:none;display:flex;justify-content:space-between;align-items:baseline;gap:2mm} ${sc}.bqh b{${D};font-size:12.5pt;color:${clubColor.primary};line-height:1.05;min-width:0;overflow-wrap:anywhere} ${sc}.bqh.ctr b{color:${clubColor.primaryDark}}
    ${sc}.bqh span{flex:none;font-size:6.5pt;font-weight:700;letter-spacing:.5px;color:#B54800;text-transform:uppercase} ${sc}.bqh.ctr span{color:#4A3D3F}
    ${sc}.bqc .fld{flex:1 1 0;aspect-ratio:auto!important}
    ${sc}.bqn{flex:none;font-size:8pt;color:#333;line-height:1.25;overflow:hidden;max-height:7.5mm} ${sc}.bqn b{font-weight:700}` : ""}
    ${sc}.cover{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6mm}
    ${sc}.cover img{height:50mm;width:auto} ${sc}.cover h1{margin:0;font-family:${clubFont.title};font-weight:400;font-size:40pt;line-height:1.05;color:${clubColor.primary};letter-spacing:.5px;border-bottom:1.2mm solid ${clubColor.accent};padding-bottom:5mm}
    ${sc}.cover h3{margin:0;font-family:${clubFont.title};font-weight:400;font-size:24pt;color:${clubColor.accent};text-transform:uppercase;letter-spacing:.5px} ${sc}.cover p{margin:0;font-size:13pt;color:#555;letter-spacing:2px}`;
}
const fontFaces = () => `
    @font-face{font-family:'${clubFont.titleName}';src:url('${location.origin}${clubFont.titleUrl}') format('truetype')}
    @font-face{font-family:'${clubFont.bodyName}';font-weight:400;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Regular.ttf') format('truetype')}
    @font-face{font-family:'${clubFont.bodyName}';font-weight:500;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Medium.ttf') format('truetype')}
    @font-face{font-family:'${clubFont.bodyName}';font-weight:700;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Bold.ttf') format('truetype')}`;
const fileSlug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();

async function printPieces(list, players, perPage, teamName, book = false, look = {}, mode = "print") {
  if (list.some((p) => p.board?.realShirts)) await preloadKitData();
  // «Todas en una» (banquillo, 06/11/2026): hasta 8 jugadas por hoja en dos columnas, con la señal bien grande
  const per = perPage === "all" ? "all" : [1, 2, 4].includes(perPage) ? perPage : 1;
  const chunk = per === "all" ? 8 : per;
  const now = new Date(), y = now.getFullYear();
  const season = now.getMonth() >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  const cover = book ? `<div class="page cover"><img src="${CLUB_LOGO_URL}" alt=""><h1>ESTRATEGIA<br>A BALÓN PARADO</h1><h3>${esc(teamName || "")}</h3><p>TEMPORADA ${season}</p></div>` : "";
  const svgs = await Promise.all(list.map((p) => pieceSvg(p, players, look, fieldBoxAspect(p, per))));
  const cards = list.map((p, i) => `<section class="card">
    <header><div class="club"><img src="${CLUB_LOGO_URL}" alt=""><div><b>${esc(BRAND.clubName.toUpperCase())}</b>${teamName ? `<span>${esc(teamName)}</span>` : ""}</div></div>
    <div class="ttl"><span>${esc(setupLabel(pieceSetup(p)))}</span><h2>${esc(p.name)}</h2></div></header>
    ${p.signal ? `<div class="meta"><span class="sig"><b>SEÑAL</b>${esc(p.signal)}</span></div>` : ""}
    <div class="fld" style="aspect-ratio:${svgs[i].ar.toFixed(4)}">${svgs[i].html}</div>${p.notes ? `<div class="notes"><b>INSTRUCCIONES</b>${esc(p.notes)}</div>` : ""}</section>`);
  const bench = list.map((p, i) => {
    const st = pieceSetup(p);
    return `<section class="card bqc">
    <div class="bqh${st.attack ? "" : " ctr"}"><b>${esc(p.signal || p.name || "")}</b><span>${st.attack ? "A FAVOR" : "EN CONTRA"}</span></div>
    <div class="fld" style="aspect-ratio:${svgs[i].ar.toFixed(4)}">${svgs[i].html}</div>
    <div class="bqn">${p.signal ? `<b>${esc(p.name)}</b> · ` : ""}${esc(setupLabel(st))}</div></section>`;
  });
  const pages = [];
  for (let i = 0; i < cards.length; i += chunk) {
    if (per === "all") {
      const part = bench.slice(i, i + chunk);
      pages.push(`<div class="page"><div class="bqtop"><img src="${CLUB_LOGO_URL}" alt=""><div><b>BALÓN PARADO · BANQUILLO</b>${teamName ? `<span>${esc(teamName)}</span>` : ""}</div><em>${list.length} JUGADAS<br>se buscan por la señal</em></div>
      <div class="bqg" style="grid-template-rows:repeat(${Math.max(2, Math.ceil(part.length / 2))},minmax(0,1fr))">${part.join("")}</div></div>`);
    } else pages.push(`<div class="page">${cards.slice(i, i + chunk).join("")}</div>`);
  }
  const body = `${cover}${pages.join("")}`;

  if (mode === "pdf") {
    const old = document.getElementById("sp-pdf-root");
    if (old) old.remove();
    const root = document.createElement("div");
    root.id = "sp-pdf-root";
    root.className = "sp-pdf rs-nodark";
    root.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;z-index:-1;pointer-events:none";
    root.innerHTML = `<style>${fontFaces()}${sheetCss(per, ".sp-pdf ")}</style>${body}`;
    document.body.appendChild(root);
    try {
      const { downloadSessionPdf } = await import("@/components/sessions/sessionPdf");
      await downloadSessionPdf([...root.querySelectorAll(".page")], `balon-parado${teamName ? `-${fileSlug(teamName)}` : ""}.pdf`);
    } finally { root.remove(); }
    return true;
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>&#8203;</title>
  <style>${fontFaces()}
    @page{size:A4;margin:0} html,body{margin:0;padding:0} body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    ${sheetCss(per)}
  </style></head><body>${body}</body></html>`;
  const old = document.getElementById("sp-print-frame");
  if (old) old.remove();
  const fr = document.createElement("iframe");
  fr.id = "sp-print-frame";
  fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(fr);
  const doc = fr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { window.print(); } };
  const ready = fr.contentWindow.document.fonts?.ready || Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 1800))]).then(() => setTimeout(go, 500));
  return true;
}

export default function SetPieceBoard({ pieces, onChange, candidates = [], allPlayers = [], teamName = "", teamId, eventId, eventDate, shirtKit = null }) {
  const t = useT();
  // Camisetas reales (13/11/2026): las jugadas con «Fichas: Camisetas» llevan la equipación del partido (la de la Preparación)
  const kitKey = shirtKit ? `${shirtKit.field}|${shirtKit.gk}` : "";
  useEffect(() => {
    if (!pieces.some((p) => p.board?.realShirts)) return;
    preloadKitData();
    if (!shirtKit) return;
    const stale = pieces.some((p) => p.board?.realShirts && `${p.board.shirtKit?.field}|${p.board.shirtKit?.gk}` !== kitKey);
    if (stale) onChange(pieces.map((p) => (p.board?.realShirts ? { ...p, board: { ...p.board, shirtKit: { ...shirtKit } } } : p)));
  }, [kitKey, pieces]);
  const qc = useQueryClient();
  const auth = useAuthOptional();
  const [activeId, setActiveId] = useState(null);
  const [libOpen, setLibOpen] = useState(false);
  const [note, setNote] = useState("");
  const [view, setView] = useState("editor");
  const [dragId, setDragId] = useState(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [off, setOff] = useState([]);
  // Vista y orientación al imprimir (se recuerdan en este navegador)
  const [printLook, setPrintLook] = useState(() => { try { return { view: "board", orient: "board", ...JSON.parse(localStorage.getItem("rs_sp_print") || "{}") }; } catch { return { view: "board", orient: "board" }; } });
  const perPage = [1, 2, 4, "all"].includes(printLook.per) ? printLook.per : 1;
  const setPerPage = (n) => setLook({ per: n });
  const setLook = (patch) => setPrintLook((o) => { const n = { ...o, ...patch }; try { localStorage.setItem("rs_sp_print", JSON.stringify(n)); } catch { /* sin almacenamiento */ } return n; });
  // Orden de impresión = el de las jugadas: primero las de a favor y luego las de en contra (se cambia arrastrando en el resumen)
  const favor = pieces.filter((p) => pieceSetup(p).attack), contra = pieces.filter((p) => !pieceSetup(p).attack);
  const printList = [...favor, ...contra].map((p) => p.id);
  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 2800); };
  const lookup = useMemo(() => [...candidates, ...allPlayers.filter((p) => !candidates.some((c) => c.id === p.id))], [candidates, allPlayers]);
  const availableIds = candidates.map((p) => p.id);
  const [busy, setBusy] = useState(null);
  const doPrint = async (mode = "print") => {
    const list = printList.filter((id) => !off.includes(id)).map((id) => pieces.find((p) => p.id === id));
    if (!list.length) return flash(t("Marca al menos una jugada"));
    setBusy(mode);
    try { await printPieces(list, lookup, perPage, teamName, false, printLook, mode); }
    catch (e) { flash(mode === "pdf" ? t("No se pudo crear el PDF: {error}", { error: e?.message || t("error") }) : t("No se pudo imprimir: {error}", { error: e?.message || t("error") })); }
    finally { setBusy(null); }
  };
  const active = pieces.find((p) => p.id === activeId) || pieces[0] || null;
  // Imprimir desde el editor: esta jugada (1 por hoja) o todas en una hoja para el banquillo
  const printQuick = async (list, per) => {
    setBusy("print");
    try { await printPieces(list, lookup, per, teamName, false, printLook, "print"); }
    catch (e) { flash(t("No se pudo imprimir: {error}", { error: e?.message || t("error") })); }
    finally { setBusy(null); }
  };

  const { data: library = [] } = useQuery({
    queryKey: ["setplays", teamId],
    queryFn: () => base44.entities.SetPlay.filter({ team_id: teamId }),
    enabled: !!teamId,
  });
  // Jugadas del partido anterior del equipo (se buscan solo al abrir «Traer del partido anterior»)
  const { data: prevPlans = [], isFetching: prevLoading } = useQuery({
    queryKey: ["matchplans-team", teamId],
    queryFn: () => base44.entities.MatchPlan.filter({ team_id: teamId }),
    enabled: !!teamId && prevOpen,
  });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: () => base44.entities.Event.list("-date"), enabled: !!teamId && prevOpen });
  const prev = prevOpen ? previousMatchPieces({ plans: prevPlans, events, eventId, eventDate }) : null;

  const addPiece = (p) => { onChange([...pieces, p]); setActiveId(p.id); setTplOpen(false); };
  const duplicate = () => { if (!active) return; addPiece({ ...copyPiece(active, { newId: uid, players: lookup, availableIds: lookup.map((p) => p.id), keepLibrary: false }), name: `${active.name} (${t("copia")})` }); };
  const printBook = async () => {
    if (!library.length) return flash(t("La biblioteca está vacía"));
    const ord = SP_KINDS.map((k) => k.id);
    const key = (x) => { const st = pieceSetup(x); return ord.indexOf(st.kind) * 2 + (st.attack ? 0 : 1); };
    const list = [...library].sort((a, b) => (key(a) - key(b)) || (a.name || "").localeCompare(b.name || ""));
    try { await printPieces(list, lookup, perPage, teamName, true, printLook); } catch (e) { flash(t("No se pudo imprimir: {error}", { error: e?.message || t("error") })); }
  };
  const update = (p) => onChange(pieces.map((x) => (x.id === p.id ? p : x)));
  const remove = (id) => { onChange(pieces.filter((x) => x.id !== id)); setActiveId(null); };
  // «Córner en contra · Lado derecho», traducido (la hoja impresa usa setupLabel, siempre en español)
  const setupText = (p) => {
    const st = pieceSetup(p);
    const k = st.kind === "otro" ? st.other || t("Otra jugada") : t(KIND_LABEL[st.kind] || "Córner");
    return [`${k} · ${st.attack ? t("A favor") : t("En contra")}`, hasSide(st.kind) ? t(SIDE_LABEL[st.side]) : ""].filter(Boolean).join(" · ");
  };

  const saveToLibrary = async () => {
    if (!active || !teamId) return;
    const s = pieceSetup(active);
    const data = { team_id: teamId, name: active.name, type: typeOf(s.kind, s.attack), kind: s.kind, attack: s.attack, side: s.side, signal: active.signal || "", notes: active.notes || "", board: pieceBoard(active, lookup), tokens: active.tokens || [], arrows: active.arrows || [] };
    try {
      if (active.lib_id && library.some((l) => l.id === active.lib_id)) {
        await base44.entities.SetPlay.update(active.lib_id, data);
        flash(t("Jugada actualizada en la biblioteca"));
      } else {
        const created = await base44.entities.SetPlay.create(data);
        update({ ...active, lib_id: created.id });
        flash(t("Jugada guardada en la biblioteca"));
      }
      qc.invalidateQueries({ queryKey: ["setplays", teamId] });
    } catch (e) { flash(t("No se pudo guardar: {error}", { error: e?.message || t("error") })); }
  };
  // Usar una jugada guardada: se mantiene todo y los jugadores solo si siguen convocados; si no, la ficha queda marcada con «?»
  const addFromLibrary = (l) => {
    const p = copyPiece({ ...newPiece(pieces.length + 1), name: l.name, type: l.type, ...(l.kind ? { kind: l.kind, attack: l.attack, side: l.side } : {}), signal: l.signal || "", notes: l.notes || "", lib_id: l.id, tokens: l.tokens || [], arrows: l.arrows || [], ...(l.board ? { board: l.board } : {}) }, { newId: uid, players: lookup, availableIds });
    onChange([...pieces, p]); setActiveId(p.id); setLibOpen(false);
  };
  const removeFromLibrary = async (l) => {
    await base44.entities.SetPlay.delete(l.id);
    qc.invalidateQueries({ queryKey: ["setplays", teamId] });
  };
  // Traer las jugadas del partido anterior: todas de golpe o una a una, sin repetir las que ya están (por nombre)
  const bringPrev = (list) => {
    const have = new Set(pieces.map((p) => (p.name || "").trim().toLowerCase()));
    const copies = list.filter((p) => !have.has((p.name || "").trim().toLowerCase())).map((p) => copyPiece(p, { newId: uid, players: lookup, availableIds }));
    if (!copies.length) return flash(t("Esas jugadas ya están en este partido"));
    onChange([...pieces, ...copies]);
    setActiveId(copies[0].id);
    setPrevOpen(false);
    const missing = copies.reduce((n, p) => n + ownChips(p.board).filter((c) => c.missing).length, 0);
    flash(missing ? t("{n} jugadas copiadas · {m} fichas sin jugador disponible (marcadas con ?)", { n: copies.length, m: missing }) : t("{n} jugadas copiadas", { n: copies.length }));
  };

  // Arrastrar una tarjeta del resumen delante de otra (dentro de su grupo o al otro: entonces cambia a favor / en contra no; solo el orden)
  const dropOn = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const moving = pieces.find((p) => p.id === dragId);
    const rest = pieces.filter((p) => p.id !== dragId);
    const i = rest.findIndex((p) => p.id === targetId);
    if (!moving || i < 0) return;
    onChange([...rest.slice(0, i), moving, ...rest.slice(i)]);
    setDragId(null);
  };
  const openPiece = (id) => { setActiveId(id); setView("editor"); };
  const panelHead = (label, onClose) => (
    <div className="flex items-center justify-between">
      <Lab>{label}</Lab>
      <button type="button" onClick={onClose} className="text-[#9A8C8E] hover:text-[#1E1416]" aria-label={t("Cerrar")}><X className="w-4 h-4" /></button>
    </div>
  );
  const rowCls = "flex items-center gap-2 rounded-lg bg-white px-3 py-2";
  const topBtn = { height: 36, padding: "0 13px", borderRadius: 9, border: `1px solid ${RS.input}`, background: "#fff", color: RS.ink2, fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 6 };
  const tabBtn = (on) => ({ height: 32, padding: "0 14px", borderRadius: 8, fontSize: 13.5, fontWeight: on ? 700 : 600, background: on ? "#fff" : "transparent", color: on ? RS.granate : RS.ink2, boxShadow: on ? "0 1px 2px rgba(54,0,13,.12)" : "none" });
  const groups = [
    { id: "favor", label: t("A favor"), color: "#1E7A46", list: favor },
    { id: "contra", label: t("En contra"), color: "#C62828", list: contra },
  ];
  const shortMeta = (p) => { const st = pieceSetup(p); const k = st.kind === "otro" ? st.other || t("Otra jugada") : t(KIND_LABEL[st.kind] || "Córner"); return [k, hasSide(st.kind) ? t(SIDE_LABEL[st.side]) : ""].filter(Boolean).join(" · "); };
  // Señales del partido, en el orden de las jugadas; las repetidas, en rojo
  const sigKey = (x) => String(x || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const signals = printList.map((id) => pieces.find((p) => p.id === id)).filter((p) => p && String(p.signal || "").trim()).map((p) => ({ id: p.id, name: p.name, signal: String(p.signal).trim(), key: sigKey(p.signal) }));
  const dupSet = new Set(signals.filter((x, i) => signals.findIndex((y) => y.key === x.key) !== i).map((x) => x.key));
  const printCount = printList.filter((id) => !off.includes(id)).length;
  const darkSeg = (label, value, onSet, options, prefix) => (
    <span className="inline-flex items-center" style={{ gap: 6 }}>
      <span style={{ fontSize: 12.5, color: "#E8C9CD" }}>{label}</span>
      <span role="group" aria-label={label} style={{ display: "inline-flex", background: "rgba(255,255,255,.1)", borderRadius: 8, padding: 2 }}>
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onSet(v)} data-testid={`${prefix}${v}`}
            style={{ height: 28, minWidth: 30, padding: "0 9px", borderRadius: 6, fontSize: 12.5, fontWeight: value === v ? 700 : 400, background: value === v ? "#fff" : "transparent", color: value === v ? RS.dark : "#fff" }}>{l}</button>
        ))}
      </span>
    </span>
  );

  return (
    <div className="flex flex-col" style={{ gap: 12, fontFamily: `'${clubFont.bodyName}', system-ui, sans-serif`, color: RS.ink }} data-testid="set-pieces">
      {/* Barra superior: qué es, editor o resumen, y acciones */}
      <div className="flex flex-wrap items-center" style={{ gap: "10px 16px" }}>
        <div className="min-w-0" style={{ marginRight: 4 }}>
          {/* sin <h2>: la regla general de títulos de la app le pondría otro color */}
          <div role="heading" aria-level={2} style={{ fontFamily: DISPLAY, fontSize: 28, lineHeight: 1, color: RS.granate }} data-testid="sp-band-title">{t("BALÓN PARADO")}</div>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: RS.muted }}>{[teamName, pieces.length === 1 ? t("1 jugada") : t("{n} jugadas", { n: pieces.length })].filter(Boolean).join(" · ")}</p>
        </div>
        <div role="tablist" aria-label={t("Vista")} style={{ display: "inline-flex", background: RS.soft, borderRadius: 10, padding: 3, gap: 2 }}>
          <button type="button" role="tab" aria-selected={view === "editor"} onClick={() => setView("editor")} style={tabBtn(view === "editor")} data-testid="sp-view-editor">{t("Editor")}</button>
          <button type="button" role="tab" aria-selected={view === "resumen"} onClick={() => setView("resumen")} style={tabBtn(view === "resumen")} data-testid="sp-view-summary">{t("Resumen del partido")}</button>
        </div>
        <span className="flex-1" />
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          <button type="button" onClick={() => setPrevOpen((v) => !v)} disabled={!teamId} style={topBtn} className="disabled:opacity-40" data-testid="sp-prev-open">{t("Traer del partido anterior")}</button>
          <button type="button" onClick={() => setLibOpen((v) => !v)} style={topBtn} data-testid="sp-lib-open">{t("Biblioteca{v}", { v: library.length ? ` (${library.length})` : "" })}</button>
          <button type="button" onClick={() => setView("resumen")} disabled={!pieces.length} className="disabled:opacity-40" style={{ ...topBtn, border: "none", background: RS.granate, color: "#fff", fontWeight: 700 }} data-testid="sp-print-open"><Printer className="w-4 h-4" /> {t("Imprimir / PDF")}</button>
        </div>
      </div>
      {note && <p style={{ margin: 0, fontSize: 12.5, color: RS.ink2 }} role="status">{note}</p>}

      {prevOpen && (
        <Card testId="sp-prev">
          {panelHead(t("Jugadas del partido anterior"), () => setPrevOpen(false))}
          {prevLoading && !prev ? <p className="text-xs" style={{ color: RS.muted }}>{t("Buscando…")}</p> : !prev ? (
            <p className="text-xs" style={{ color: RS.muted }}>{t("No hay jugadas en los partidos anteriores de este equipo.")}</p>
          ) : (
            <>
              <p className="text-xs" style={{ color: RS.ink2 }}>{[prev.event?.title || prev.event?.rival || t("Partido"), prev.event?.date ? String(prev.event.date).slice(0, 10).split("-").reverse().join("/") : ""].filter(Boolean).join(" · ")}</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {prev.pieces.map((p) => (
                  <div key={p.id} className={rowCls} style={{ border: `1px solid ${RS.line}` }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate">{p.name || t("Sin nombre")}</p>
                      <p className="text-[11px] truncate" style={{ color: RS.muted }}>{setupText(p)}</p>
                    </div>
                    <button type="button" onClick={() => bringPrev([p])} style={{ ...btnOut, height: 30 }}>{t("Copiar")}</button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => bringPrev(prev.pieces)} className="inline-flex items-center" style={{ ...btnOut, background: RS.granate, color: "#fff", border: "none", fontWeight: 600, gap: 6 }} data-testid="sp-prev-all"><Copy className="w-4 h-4" /> {t("Copiar las {n} jugadas", { n: prev.pieces.length })}</button>
                <p className="text-[11px]" style={{ color: RS.muted }}>{t("Los jugadores que no están convocados quedan marcados con «?» para elegir otro.")}</p>
              </div>
            </>
          )}
        </Card>
      )}

      <SetPieceWizard open={tplOpen} onOpenChange={setTplOpen} onCreate={addPiece} templates={TEMPLATES} candidates={candidates} lookup={lookup} pieces={pieces} library={library}
        base={tplOpen ? currentDefaults(auth?.user).sp || null : null}
        onClearBase={() => { const d = rememberDefaults({ ...currentDefaults(auth?.user), sp: undefined }); base44.auth?.updateMe?.({ board_defaults: d }).catch(() => {}); }}
        Thumb={PieceThumb} kindLabel={(k) => KIND_LABEL[k] || KIND_LABEL.corner} fnLabel={(f) => (FN_LABEL[f] ? t(FN_LABEL[f]) : f)} uid={uid} availableIds={availableIds} />

      {libOpen && (
        <Card>
          <div className="flex items-center justify-between" style={{ gap: 8 }}>
            <Lab>{t("Biblioteca del equipo")}</Lab>
            <span className="flex items-center" style={{ gap: 8 }}>
              <button type="button" onClick={printBook} disabled={!library.length} title={t("Imprime toda la biblioteca del equipo, con portada y agrupada por tipo")} className="inline-flex items-center disabled:opacity-40" style={{ ...btnOut, height: 30, gap: 6 }}><Printer className="w-3.5 h-3.5" /> {t("Libro del equipo")}</button>
              <button type="button" onClick={() => setLibOpen(false)} className="text-[#9A8C8E] hover:text-[#1E1416]" aria-label={t("Cerrar")}><X className="w-4 h-4" /></button>
            </span>
          </div>
          {library.length === 0 ? (
            <p className="text-xs" style={{ color: RS.muted }}>{t("Aún no hay jugadas guardadas. Crea una y pulsa «Guardar en biblioteca».")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {library.map((l) => (
                <div key={l.id} className={rowCls} style={{ border: `1px solid ${RS.line}` }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate">{l.name || t("Sin nombre")}</p>
                    <p className="text-[11px] truncate" style={{ color: RS.muted }}>{setupText(l)}{l.signal ? ` · ${t("Señal: {signal}", { signal: l.signal })}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => addFromLibrary(l)} style={{ ...btnOut, height: 30, background: RS.granate, color: "#fff", border: "none", fontWeight: 600 }}>{t("Usar")}</button>
                  <button type="button" onClick={() => removeFromLibrary(l)} className="p-1" style={{ color: "#B9A7A9" }} title={t("Quitar de la biblioteca")}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {view === "editor" ? (
        <div className="flex flex-wrap items-start" style={{ gap: 14 }}>
          {/* Izquierda: las jugadas del partido */}
          <nav aria-label={t("Jugadas del partido")} className="rounded-xl bg-white flex flex-col" style={{ flex: "1 1 240px", maxWidth: 270, border: `1px solid ${RS.line}`, overflow: "hidden" }} data-testid="sp-list">
            <div className="flex items-baseline justify-between" style={{ padding: "12px 14px 4px" }}>
              <Lab>{t("Jugadas del partido")}</Lab>
              <span style={{ fontSize: 12, color: RS.muted }}>{pieces.length}</span>
            </div>
            <div className="flex flex-col" style={{ padding: "0 8px 8px", gap: 1 }}>
              {groups.map((g) => g.list.length > 0 && (
                <div key={g.id} className="flex flex-col" style={{ gap: 1 }}>
                  <div className="flex items-center" style={{ gap: 8, padding: "9px 6px 5px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: g.color }}>{g.label} · {g.list.length}</span>
                    <span className="flex-1" style={{ height: 1, background: RS.soft }} />
                  </div>
                  {g.list.map((p) => {
                    const on = active?.id === p.id;
                    return (
                      <button key={p.id} type="button" onClick={() => setActiveId(p.id)} aria-current={on ? "true" : undefined} data-testid="sp-piece-tab"
                        className="flex items-center text-left w-full" style={{ gap: 10, padding: 6, borderRadius: 9, background: on ? "#FBEEEF" : "transparent", boxShadow: on ? `inset 0 0 0 1.5px ${RS.granate}` : "none" }}>
                        <span className="shrink-0 overflow-hidden" style={{ width: 54, height: 44, borderRadius: 6, border: `1px solid ${RS.line}`, background: "#fff" }}><PieceThumb piece={p} lookup={lookup} /></span>
                        <span className="flex flex-col min-w-0" style={{ gap: 1 }}>
                          <span className="truncate" style={{ fontSize: 14, fontWeight: on ? 700 : 600, color: on ? RS.granate : RS.ink }}>{p.name || t("Sin nombre")}</span>
                          <span className="truncate" style={{ fontSize: 12, color: RS.muted }}>{shortMeta(p)} · {animFrameCount(pieceBoard(p, lookup)) > 1 ? t("animada") : t("solo hoja")}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {!pieces.length && <p style={{ margin: "4px 6px 8px", fontSize: 12.5, color: RS.muted }}>{t("Aún no hay jugadas. Crea una nueva, usa una de la biblioteca o tráelas del partido anterior.")}</p>}
            </div>
            {signals.length > 0 && (
              <div className="flex flex-col" style={{ margin: "0 10px 10px", padding: "9px 11px", borderRadius: 9, background: RS.bg, gap: 4 }} data-testid="sp-signals">
                <Lab>{t("Señales del partido")}</Lab>
                {signals.map((x) => (
                  <button key={x.id} type="button" onClick={() => setActiveId(x.id)} className="text-left" style={{ fontSize: 12.5, lineHeight: 1.35, color: RS.ink2 }}>
                    <b style={{ color: dupSet.has(x.key) ? "#B42318" : RS.ink }}>{x.signal}</b> → {x.name || t("Sin nombre")}
                  </button>
                ))}
                {dupSet.size > 0
                  ? <span style={{ fontSize: 11.5, fontWeight: 600, color: "#B42318" }} data-testid="sp-signals-dup">{t("Hay señales repetidas")}</span>
                  : signals.length > 1 && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#1E7A46" }}>{t("Sin señales repetidas")}</span>}
              </div>
            )}
            <div style={{ padding: 10, borderTop: `1px solid ${RS.soft}`, marginTop: "auto" }}>
              <button type="button" onClick={() => setTplOpen(true)} className="w-full" style={{ height: 40, borderRadius: 9, border: `1.5px dashed ${RS.granate}`, background: "#fff", color: RS.granate, fontWeight: 700, fontSize: 14 }} data-testid="sp-new">+ {t("Nueva jugada")}</button>
            </div>
          </nav>
          <div className="min-w-0" style={{ flex: "999 1 640px" }}>
            {!active ? (
              <Card>
                <p className="text-sm text-center" style={{ color: RS.muted, margin: "16px 0" }}>{t("Aún no hay jugadas. Crea una nueva, usa una de la biblioteca o tráelas del partido anterior.")}</p>
              </Card>
            ) : (
              <PieceEditor key={active.id} piece={active} onChange={update} candidates={candidates} lookup={lookup} teamId={teamId} shirtKit={shirtKit}
                libLinked={!!active.lib_id && library.some((l) => l.id === active.lib_id)}
                onSave={saveToLibrary} onDuplicate={duplicate} onRemove={() => remove(active.id)}
                busy={busy} total={pieces.length}
                onPrint={(w) => (w === "more" ? setView("resumen") : printQuick(w === "one" ? [active] : printList.map((id) => pieces.find((p) => p.id === id)), w === "one" ? 1 : "all"))} />
            )}
          </div>
        </div>
      ) : (
        /* Resumen del partido: todas las jugadas de un vistazo, el orden y qué se imprime */
        <div className="flex flex-col" style={{ gap: 16 }} data-testid="sp-summary">
          {!pieces.length && <Card><p className="text-sm text-center" style={{ color: RS.muted, margin: "16px 0" }}>{t("Aún no hay jugadas. Crea una nueva, usa una de la biblioteca o tráelas del partido anterior.")}</p></Card>}
          {groups.map((g) => g.list.length > 0 && (
            <section key={g.id} className="flex flex-col" style={{ gap: 10 }}>
              <div className="flex items-center" style={{ gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: g.color }}>{g.label}</span>
                <span style={{ fontSize: 13, color: RS.muted }}>{g.list.length === 1 ? t("1 jugada") : t("{n} jugadas", { n: g.list.length })}</span>
                <span className="flex-1" style={{ height: 1, background: RS.line }} />
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                {g.list.map((p) => {
                  const on = !off.includes(p.id);
                  const { title } = autoTitle(pieceBoard(p, lookup), pieceSetup(p));
                  return (
                    <article key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => setDragId(null)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); dropOn(p.id); }}
                      className="rounded-xl bg-white flex flex-col" style={{ padding: 10, gap: 8, border: `1px solid ${dragId === p.id ? RS.granate : RS.line}`, opacity: on ? 1 : 0.6, cursor: "grab" }} data-testid="sp-sum-card">
                      <div className="relative overflow-hidden" style={{ aspectRatio: "74 / 60", borderRadius: 8, border: `1px solid ${RS.soft}` }}>
                        <button type="button" onClick={() => openPiece(p.id)} className="absolute inset-0" aria-label={t("Abrir {name} en el editor", { name: p.name || t("Sin nombre") })} style={{ background: "#fff" }}><PieceThumb piece={p} lookup={lookup} /></button>
                        <label className="absolute flex items-center" style={{ top: 6, right: 6, gap: 5, background: "rgba(255,255,255,.94)", borderRadius: 6, padding: "3px 7px", fontSize: 12, color: RS.ink2 }}>
                          <input type="checkbox" checked={on} onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== p.id) : [...off, p.id])} className="accent-club" style={{ margin: 0 }} data-testid="sp-sum-print" />{t("Imprimir")}
                        </label>
                      </div>
                      <button type="button" onClick={() => openPiece(p.id)} className="flex flex-col text-left" style={{ gap: 5, padding: "0 2px" }}>
                        <span style={{ fontFamily: DISPLAY, fontSize: 18, lineHeight: 1.05, color: RS.granate, textTransform: "uppercase" }}>{p.name || t("Sin nombre")}</span>
                        <span style={{ fontSize: 12.5, color: RS.ink2 }}>{shortMeta(p)}</span>
                        {p.signal && <span className="truncate" style={{ alignSelf: "flex-start", maxWidth: "100%", fontSize: 12, color: "#fff", background: RS.granate, borderRadius: 999, padding: "3px 9px" }}><b style={{ fontFamily: DISPLAY, fontWeight: 400, letterSpacing: ".04em" }}>{t("SEÑAL")}</b> · {p.signal}</span>}
                        {title && <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em", color: RS.muted }}>{title}</span>}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {pieces.length > 0 && <p style={{ margin: 0, fontSize: 12.5, color: RS.muted }}>{t("Arrastra una tarjeta para cambiar el orden de impresión. Tócala para abrirla en el editor.")}</p>}

          {/* Barra de impresión */}
          {pieces.length > 0 && (
            <div className="flex flex-wrap items-center sticky" style={{ bottom: 8, zIndex: 5, gap: "10px 16px", background: RS.dark, color: "#fff", borderRadius: 12, padding: "10px 16px" }} data-testid="sp-print">
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{t("{n} de {m} jugadas para imprimir", { n: printCount, m: printList.length })}</span>
              <span className="flex" style={{ gap: 8, fontSize: 12.5 }}>
                <button type="button" onClick={() => setOff([])} style={{ color: "#FFD3B0", fontWeight: 600 }} data-testid="sp-print-all">{t("Todas")}</button>
                <button type="button" onClick={() => setOff(printList)} style={{ color: "#E8C9CD" }}>{t("Ninguna")}</button>
              </span>
              {darkSeg(t("Vista"), printLook.view, (v) => setLook({ view: v }), [["board", t("Como en la pizarra")], ["flat", t("Plana")], ["persp", t("Perspectiva")], ["3d", t("3D")]], "sp-print-view-")}
              {darkSeg(t("Orientación"), printLook.orient, (v) => setLook({ orient: v }), [["board", t("Como en la pizarra")], ["v", t("Vertical")], ["h", t("Horizontal")]], "sp-print-orient-")}
              {darkSeg(t("Por hoja"), perPage, setPerPage, [[1, "1"], [2, "2"], [4, "4"], ["all", t("Todas en una")]], "sp-print-per-")}
              <span className="flex" style={{ gap: 8, marginLeft: "auto" }}>
              <button type="button" onClick={() => doPrint("pdf")} disabled={!!busy} className="inline-flex items-center disabled:opacity-50" style={{ height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,.5)", color: "#fff", fontWeight: 600, gap: 6 }} data-testid="sp-print-pdf"><FileDown className="w-4 h-4" /> {busy === "pdf" ? t("Preparando el PDF…") : t("Descargar PDF")}</button>
              <button type="button" onClick={() => doPrint("print")} disabled={!!busy} className="inline-flex items-center disabled:opacity-50" style={{ height: 36, padding: "0 16px", borderRadius: 9, background: RS.naranja, color: RS.ink, fontWeight: 700, gap: 6 }} data-testid="sp-print-go"><Printer className="w-4 h-4" /> {t("Imprimir")}</button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
