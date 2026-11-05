import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, BookmarkPlus, X, ArrowUp, ArrowDown, Copy, LayoutTemplate, Users, Printer } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFirstName } from "@/lib/playerName";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import "@/styles/rs2.css";

import { useT, msg } from "@/i18n";
import BoardEditor from "@/components/board/BoardEditor";
import Board from "@/components/board/BoardSvg";
import { boardSvgMarkup } from "@/components/board/exportPng";
import { boardFramePng } from "@/components/board/BoardDownloads";
import { is3D, isStadium, normalizeBoard, teamsOf } from "@/lib/board";
import { TopChoice, lab as cardLab, inputCls as cardInput, pillCls as cardPill } from "@/components/board/BoardChipCard";
import { topModeOf, topPatch } from "@/lib/boardVariant";
import {
  assignPlayer, copyPiece, fillWithSquad, flipBoard, ownChips, pieceBoard, previousMatchPieces, legacyToBoard,
  SP_KINDS, typeOf, pieceSetup, printBoard, playerPatch, funcsFor, funcOf, fnPatch, setFunction, functionCounts, autoTitle, structuresFor, applyStructure, GK_COLOR,
} from "@/lib/setPieceBoard";
// Jugadas a balón parado con la pizarra común (la misma de tareas y tácticas). Rediseño del 05/11/2026 (maqueta aprobada por
// Nacho, con el aspecto de RS Manager): banda con las jugadas del partido; a la izquierda la jugada (tipo, a favor / en contra,
// lado), estructuras de partida, funciones (se dan tocando las fichas) y etiquetas rápidas; en el centro la pizarra dentro de la
// página, con un título que se escribe solo y los fotogramas debajo; a la derecha los jugadores con su función e instrucciones.
// Las jugadas se guardan en la biblioteca del equipo y se pueden traer del partido anterior; al copiarlas se conservan los
// jugadores que siguen convocados y los demás quedan marcados con «?» para elegir otro. Lógica pura en src/lib/setPieceBoard.js.
const TYPES = [
  { value: "corner_favor", label: msg("Córner a favor") },
  { value: "corner_contra", label: msg("Córner en contra") },
  { value: "falta_lateral", label: msg("Falta lateral a favor") },
  { value: "falta_frontal", label: msg("Falta frontal a favor") },
  { value: "falta_contra", label: msg("Falta en contra") },
  { value: "saque_banda", label: msg("Saque de banda") },
  { value: "penalti", label: msg("Penalti") },
  { value: "saque_puerta", label: msg("Saque de puerta") },
];
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
const fromTemplate = (tpl, n) => ({ ...newPiece(n), name: tpl.label, type: tpl.key, ...tpl.make() });

// ── Colores y piezas del aspecto de RS Manager (rs2) ──────────────────────────────────────────────────────────────
const RS = { granate: "#73000A", dark: "#36000D", naranja: "#FF6E00", bg: "#F5F2F1", line: "#E6DEDD", soft: "#EEE7E6", ink: "#1E1416", ink2: "#4A3D3F", muted: "#6B5E60", input: "#D9CFCE" };
const DISPLAY = "'Racing Sarria', 'IBM Plex Sans Condensed', sans-serif";
const FN_LABEL = {
  zona: msg("Zona"), hombre: msg("Hombre"), rechace: msg("Rechace"), corta: msg("Corta"), palo: msg("Palo"),
  lanzador: msg("Lanzador"), rematador: msg("Rematador"), bloqueo: msg("Bloqueo"), cierra: msg("Cierra"), portero: msg("Portero"),
};
const KIND_LABEL = { corner: msg("Córner"), falta_lateral: msg("F. lateral"), falta_frontal: msg("F. frontal"), banda: msg("Banda") };
const FIELD_LOOKS = [
  { id: "estadio", label: msg("Estadio"), swatch: "#2f7a43" },
  { id: "color", label: msg("Verde"), swatch: "#3f8a4a" },
  { id: "blanco-liso", label: msg("Blanco"), swatch: "#ffffff" },
  { id: "blanco", label: msg("Blanco y gris"), swatch: "repeating-linear-gradient(180deg, #ffffff 0 3px, #d9dde3 3px 6px)" },
  { id: "bn", label: msg("Blanco y negro"), swatch: "linear-gradient(135deg, #ffffff 50%, #111111 50%)" },
];
const LINE_COLORS = [
  { value: "", label: msg("Las del modo visual") },
  { value: "#c4cad3", label: msg("Gris claro") },
  { value: "#6b7280", label: msg("Gris") },
  { value: "#111111", label: msg("Negro") },
  { value: "#73000a", label: msg("Granate") },
  { value: "#ffffff", label: msg("Blanco") },
];
const DEF_TAGS = [msg("1er palo"), msg("2º palo"), msg("Ataque al balón"), msg("Línea sube"), msg("Segunda jugada"), msg("Salida rápida"), msg("Portero sale"), msg("Presión a la corta")];
const ATT_TAGS = [msg("1er palo"), msg("2º palo"), msg("Punto de penalti"), msg("Bloqueo"), msg("Desmarque"), msg("Rechace"), msg("Vigilancia"), msg("Jugada en corto")];

function Lab({ children, style }) {
  return <h3 className="rs2-label" style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: RS.muted, ...style }}>{children}</h3>;
}
function Card({ children, testId, style }) {
  return <section className="rounded-xl bg-white flex flex-col" style={{ border: `1px solid ${RS.line}`, padding: "12px 14px", gap: 9, ...style }} data-testid={testId}>{children}</section>;
}
function Seg({ options, value, onChange, label, testId }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap" style={{ gap: 6 }} data-testid={testId}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" aria-pressed={on} onClick={() => onChange(o.value)} data-testid={o.testId}
            style={{ flex: "1 1 auto", minHeight: 32, padding: "0 12px", borderRadius: 8, fontSize: 13, fontWeight: on ? 600 : 400, background: on ? RS.granate : RS.bg, color: on ? "#fff" : RS.ink2 }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
const pill = (on) => ({ height: 30, padding: "0 12px", borderRadius: 999, fontSize: 12.5, fontWeight: on ? 600 : 400, border: `1px solid ${on ? RS.granate : RS.input}`, background: on ? RS.granate : "#fff", color: on ? "#fff" : RS.ink2 });
const btnOut = { height: 34, padding: "0 14px", borderRadius: 8, fontSize: 13, background: "#fff", color: RS.ink2, border: `1px solid ${RS.input}` };
const inputCls = "w-full outline-none focus:ring-1 focus:ring-[#73000A]";
const inputStyle = { height: 36, borderRadius: 8, border: `1px solid ${RS.input}`, padding: "0 12px", fontSize: 13.5, background: "#fff", color: RS.ink };
const dot = (f) => ({ width: 14, height: 14, borderRadius: 999, flex: "0 0 auto", background: f ? f.color : "transparent", border: `2px solid ${f ? f.stroke || f.color : "#9A8C8E"}` });

// Pestaña «Jugador» de la tarjeta de una ficha del Racing (05/11/2026): jugador de los convocados, función y qué va encima
function AbpChipPlayer({ el, patch, candidates, byId, attack }) {
  const t = useT();
  const funcs = [...(attack ? [] : [{ id: "portero", color: GK_COLOR }]), ...funcsFor(attack)];
  const pl = el.player_id ? byId.get(el.player_id) : null;
  const fnName = (id) => (id && FN_LABEL[id] ? t(FN_LABEL[id]) : "");
  const setFn = (f) => {
    const p = fnPatch(f);
    if (topModeOf(el, "none") === "fn") Object.assign(p, topPatch("fn", el, { fn: f ? fnName(f.id) : "" }));
    patch(p, "fn");
  };
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
              <button key={f.id} type="button" aria-pressed={on} onClick={() => setFn(on ? null : f)} className={`${cardPill(on)} inline-flex items-center gap-1.5`} data-testid={`card-fn-${f.id}`}>
                <span aria-hidden style={dot(f)} />{fnName(f.id)}
              </button>
            );
          })}
        </div>
      </div>
      <TopChoice el={el} patch={patch} names={{ fn: fnName(el.fn) }} options={[{ id: "fn", label: t("Función") }, { id: "text", label: t("Otro texto") }, { id: "none", label: t("Nada") }]} />
      <p className="text-[11.5px] text-gray-500">{t("El dorsal y el nombre salen de su ficha.")}</p>
    </>
  );
}

// Una jugada: columna izquierda (la jugada y sus atajos), pizarra en el centro y jugadores e instrucciones a la derecha
function PieceEditor({ piece, onChange, candidates, lookup, teamId, onSave, onDuplicate, onRemove, libLinked }) {
  const t = useT();
  const board = pieceBoard(piece, lookup);
  const setup = pieceSetup(piece);
  const funcs = funcsFor(setup.attack);
  const [fnTool, setFnTool] = useState(undefined); // undefined = nada; null = «Sin función»; si no, el id de la función
  const [tag, setTag] = useState(null);
  const setBoard = (b) => onChange({ ...piece, ...setup, type: typeOf(setup.kind, setup.attack), board: b });
  const setSetup = (next) => {
    const s = { ...setup, ...next };
    let b = board;
    if (next.side && next.side !== setup.side) b = flipBoard(b);
    onChange({ ...piece, ...s, type: typeOf(s.kind, s.attack), board: b });
    if (next.attack !== undefined && next.attack !== setup.attack) setFnTool(undefined);
  };
  const chips = ownChips(board);
  const counts = functionCounts(board, setup.attack);
  const { title, subtitle } = autoTitle(board, setup);
  const byId = new Map(lookup.map((p) => [p.id, p]));
  const structs = structuresFor(setup.kind, setup.attack);
  const tpl = TEMPLATES.find((x) => x.key === typeOf(setup.kind, setup.attack));
  const hasEls = board.frames.some((f) => f.els.length);
  const applyTpl = () => {
    if (!tpl) return;
    if (hasEls && !window.confirm(t("Se cambiará todo el dibujo de esta jugada. ¿Seguir?"))) return;
    const made = tpl.make();
    let b = legacyToBoard({ id: piece.id, tokens: made.tokens, arrows: made.arrows });
    if (setup.side === "l") b = flipBoard(b);
    setBoard(b);
  };
  const tags = setup.attack ? ATT_TAGS : DEF_TAGS;
  const fnObj = fnTool === undefined ? null : fnTool === null ? null : funcOf(setup.attack, fnTool);
  const paint = fnTool === undefined ? null : { teams: ["a"], patch: () => fnPatch(fnObj) };
  const stamp = tag ? { make: (p, newId) => ({ id: newId(), k: "text", x: p.x, y: p.y, text: t(tag), size: 1.8, bold: true, bg: RS.naranja, color: RS.ink }) } : null;
  const order = (c) => (c.fn === "portero" ? -1 : funcs.findIndex((f) => f.id === c.fn) === -1 ? 99 : funcs.findIndex((f) => f.id === c.fn));
  const sortedChips = [...chips].sort((a, b) => order(a) - order(b));
  const overlay = title || subtitle ? (
    <div style={{ background: RS.dark, borderRadius: 12, padding: "9px 14px" }}>
      {title && <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 22, lineHeight: 1, color: "#fff" }} data-testid="sp-auto-title">{title}</p>}
      {subtitle && <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, letterSpacing: ".12em", color: "#E3EEE6" }} data-testid="sp-auto-subtitle">{subtitle}</p>}
    </div>
  ) : null;

  return (
    <div className="flex flex-wrap items-start" style={{ gap: 12 }}>
      {/* Izquierda */}
      <aside className="flex flex-col" style={{ flex: "0 1 290px", minWidth: 250, gap: 10 }}>
        <Card testId="sp-piece">
          <Lab>{t("Jugada abierta")}</Lab>
          <label className="flex flex-col" style={{ gap: 4, fontSize: 12, color: RS.muted }}>{t("Nombre")}
            <input value={piece.name || ""} onChange={(e) => onChange({ ...piece, name: e.target.value })} placeholder={t("TÍTULO DE LA JUGADA")} className={inputCls} style={inputStyle} data-testid="sp-name" />
          </label>
          <label className="flex flex-col" style={{ gap: 4, fontSize: 12, color: RS.muted }}>{t("Señal")}
            <input value={piece.signal || ""} onChange={(e) => onChange({ ...piece, signal: e.target.value })} placeholder={t("Cómo se avisa: el lanzador se toca la cabeza, bota el balón…")} className={inputCls} style={inputStyle} />
          </label>
          <p style={{ margin: 0, fontSize: 12, color: RS.muted }}>{board.frames.length === 1 ? t("1 fotograma") : t("{n} fotogramas", { n: board.frames.length })}{libLinked ? ` · ${t("en la biblioteca")}` : ""}</p>
        </Card>

        <Card testId="sp-setup">
          <Lab>{t("Balón parado")}</Lab>
          <Seg label={t("Tipo")} value={setup.kind} onChange={(v) => setSetup({ kind: v })} options={SP_KINDS.map((k) => ({ value: k.id, label: t(KIND_LABEL[k.id]), testId: `sp-kind-${k.id}` }))} />
          <Seg label={t("A favor o en contra")} value={setup.attack} onChange={(v) => setSetup({ attack: v })} options={[{ value: true, label: t("A favor"), testId: "sp-attack" }, { value: false, label: t("En contra"), testId: "sp-defense" }]} />
          <Seg label={t("Lado")} value={setup.side} onChange={(v) => setSetup({ side: v })} options={[{ value: "l", label: t("Lado izquierdo"), testId: "sp-side-l" }, { value: "r", label: t("Lado derecho"), testId: "sp-side-r" }]} />
          <p style={{ margin: 0, fontSize: 12, color: RS.muted }}>{t("Cambiar de lado da la vuelta a toda la jugada.")}</p>
        </Card>

        <Card testId="sp-field">
          <Lab>{t("Campo")}</Lab>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {FIELD_LOOKS.map((l) => {
              const on = (board.look || "estadio") === l.id;
              return (
                <button key={l.id} type="button" aria-pressed={on} onClick={() => setBoard({ ...board, look: l.id })} style={{ ...pill(on), display: "inline-flex", alignItems: "center", gap: 6 }} data-testid={`sp-look-${l.id}`}>
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, border: "1px solid #9A8C8E", background: l.swatch }} />{t(l.label)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 6 }} role="group" aria-label={t("Color de las líneas")}>
            <span style={{ fontSize: 12, color: RS.muted, marginRight: 2 }}>{t("Líneas")}</span>
            {LINE_COLORS.map((c) => {
              const on = (board.lineColor || "") === c.value;
              return (
                <button key={c.value || "auto"} type="button" aria-pressed={on} title={t(c.label)} aria-label={t(c.label)} onClick={() => { const { lineColor: _l, ...rest } = board; setBoard(c.value ? { ...rest, lineColor: c.value } : rest); }} data-testid={`sp-line-${c.value || "auto"}`}
                  style={{ height: 28, minWidth: 28, padding: c.value ? 0 : "0 10px", borderRadius: 999, fontSize: 12, border: `2px solid ${on ? RS.granate : RS.input}`, background: c.value || "#fff", color: RS.ink2 }}>
                  {c.value ? "" : t("Auto")}
                </button>
              );
            })}
            <label className="inline-flex items-center" style={{ gap: 4, fontSize: 12, color: RS.muted }} title={t("Otro color")}>
              <input type="color" value={board.lineColor || "#9ca3af"} onChange={(e) => setBoard({ ...board, lineColor: e.target.value })} aria-label={t("Otro color")} style={{ width: 28, height: 28, padding: 0, border: "none", background: "none" }} />
            </label>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: RS.muted }}>{t("Para imprimir gastando poca tinta: blanco liso o blanco y gris, con las líneas en gris.")}</p>
        </Card>

        <Card testId="sp-structures">
          <Lab>{t("Estructura de partida")}</Lab>
          {structs.length > 0 ? (
            <>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {structs.map((s) => (
                  <button key={s.id} type="button" onClick={() => setBoard(applyStructure(board, s, { side: setup.side, newId: uid }))} style={pill(false)} data-testid={`sp-struct-${s.id}`}>{t(s.label)}</button>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: RS.muted }}>{t("Coloca a los jugadores y les da su función; los que ya tenían jugador lo conservan.")}</p>
            </>
          ) : tpl ? (
            <>
              <button type="button" onClick={applyTpl} style={{ ...pill(false), alignSelf: "flex-start" }} data-testid="sp-struct-tpl">{t("Básica: {name}", { name: t(tpl.label) })}</button>
              <p style={{ margin: 0, fontSize: 12, color: RS.muted }}>{t("Empieza con las fichas ya colocadas; después las mueves y les das jugador.")}</p>
            </>
          ) : <p style={{ margin: 0, fontSize: 12, color: RS.muted }}>{t("Sin estructuras para este tipo de jugada.")}</p>}
        </Card>

        <Card testId="sp-functions">
          <Lab>{t("Funciones")}</Lab>
          <div className="grid grid-cols-2" style={{ gap: 6 }}>
            {counts.map((c) => {
              const on = fnTool !== undefined && (c.id === null ? fnTool === null : fnTool === c.id);
              return (
                <button key={c.id || "none"} type="button" aria-pressed={on} onClick={() => { setTag(null); setFnTool(on ? undefined : c.id); }} data-testid={`sp-fn-${c.id || "none"}`}
                  className="flex items-center text-left" style={{ gap: 8, minHeight: 34, padding: "0 10px", borderRadius: 8, fontSize: 13, background: "#fff", color: RS.ink, border: `1px solid ${on ? RS.granate : RS.line}`, boxShadow: on ? `inset 0 0 0 1px ${RS.granate}` : "none", fontWeight: on ? 600 : 400 }}>
                  <span aria-hidden style={dot(c.id ? c : null)} />
                  <span style={{ flex: "1 1 auto" }}>{c.id ? t(FN_LABEL[c.id]) : t("Sin función")}</span>
                  <span style={{ fontSize: 12, color: RS.muted }} className="tabular-nums">{c.n || ""}</span>
                </button>
              );
            })}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: fnTool !== undefined ? RS.granate : RS.muted, fontWeight: fnTool !== undefined ? 600 : 400 }} role="status">
            {fnTool === undefined ? t("Elige una función y toca los jugadores en el campo: cambian de color y el título se escribe solo.")
              : t("Toca las fichas del Racing para darles «{fn}». Vuelve a tocar el botón para terminar.", { fn: fnTool ? t(FN_LABEL[fnTool]) : t("Sin función") })}
          </p>
        </Card>

        <Card testId="sp-tags">
          <Lab>{t("Etiquetas rápidas")}</Lab>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {tags.map((g) => (
              <button key={g} type="button" aria-pressed={tag === g} onClick={() => { setFnTool(undefined); setTag(tag === g ? null : g); }} style={pill(tag === g)} data-testid="sp-tag">{t(g)}</button>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: tag ? RS.granate : RS.muted, fontWeight: tag ? 600 : 400 }}>{tag ? t("Toca el sitio del campo donde va «{tag}».", { tag: t(tag) }) : t("Tocas una y luego el sitio del campo donde va.")}</p>
        </Card>
      </aside>

      {/* Centro: la pizarra */}
      <div className="min-w-0" style={{ flex: "999 1 560px" }} data-testid="sp-board">
        <BoardEditor value={board} onChange={setBoard} fields={["half", "tq", "full", "free"]} filename={piece.name || t("Jugada")}
          embedded embedHeight={660} paint={paint} stamp={stamp} onStampDone={() => setTag(null)} overlayTitle={overlay}
          variant="abp"
          chipPlayer={(el, patch) => (el.team === "a" ? <AbpChipPlayer el={el} patch={patch} candidates={candidates} byId={byId} attack={setup.attack} /> : null)}
          chipDescribe={(el) => (el.team === "a" && el.fn && FN_LABEL[el.fn] ? `${teamsOf(board).find((x) => x.id === "a")?.name || "Racing"} · ${t(FN_LABEL[el.fn])}` : null)} />
      </div>

      {/* Derecha: quién es quién */}
      <aside className="flex flex-col" style={{ flex: "1 1 260px", maxWidth: 330, minWidth: 240, gap: 10 }}>
        <Card testId="sp-players" style={{ padding: 0, gap: 0, overflow: "hidden" }}>
          <div className="flex items-baseline justify-between" style={{ padding: "12px 14px 8px", gap: 8 }}>
            <Lab>{t("Jugadores de la jugada")}</Lab>
            <button type="button" onClick={() => setBoard(fillWithSquad(board, candidates))} disabled={!chips.some((c) => !c.player_id) || !candidates.length}
              className="inline-flex items-center disabled:opacity-40" style={{ gap: 4, fontSize: 12, fontWeight: 600, color: RS.granate }}>
              <Users className="w-3.5 h-3.5" /> {t("Rellenar con convocados")}
            </button>
          </div>
          {sortedChips.length === 0 ? (
            <p style={{ margin: 0, padding: "0 14px 12px", fontSize: 12, color: RS.muted }}>{t("Elige una estructura de partida o coloca fichas del Racing en la pizarra.")}</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {sortedChips.map((c) => {
                const pl = c.player_id ? byId.get(c.player_id) : null;
                const f = c.fn === "portero" ? { color: GK_COLOR } : funcOf(setup.attack, c.fn);
                const bg = c.missing ? "#fef3c7" : f ? f.color : RS.granate;
                const light = bg.toUpperCase() === "#FFFFFF" || bg.toUpperCase() === "#EAB308" || bg.toUpperCase() === "#FF6E00";
                return (
                  <li key={c.id} className="flex items-center" style={{ gap: 6, minHeight: 36, padding: "2px 10px 2px 14px", borderTop: `1px solid ${RS.soft}` }}>
                    <span className="flex items-center justify-center shrink-0" title={c.missing ? t("El jugador de esta ficha no está disponible: elige otro") : undefined}
                      style={{ width: 24, height: 24, borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: c.missing ? "#92400e" : bg.toUpperCase() === "#FFFFFF" ? RS.granate : light ? RS.ink : "#fff", border: `1.5px solid ${c.missing ? "#f59e0b" : f?.stroke || bg}` }}>{c.inner || "·"}</span>
                    <Select value={c.player_id || "__none__"} onValueChange={(v) => setBoard(assignPlayer(board, c.id, v === "__none__" ? null : byId.get(v) || null))}>
                      <SelectTrigger className="h-8 text-[13px] border-0 shadow-none bg-transparent px-1 flex-1 min-w-0"><SelectValue placeholder={t("Sin asignar")} /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none__">{c.missing ? t("Elegir jugador…") : t("Sin asignar")}</SelectItem>
                        {pl && !candidates.some((p) => p.id === pl.id) && <SelectItem value={pl.id}>{pl.jersey_number || "–"} · {shortName(pl)}</SelectItem>}
                        {candidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.jersey_number || "–"} · {shortName(p)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <select value={c.fn === "portero" ? "portero" : funcOf(setup.attack, c.fn) ? c.fn : ""} aria-label={t("Función")}
                      onChange={(e) => { const v = e.target.value; setBoard(v === "portero" ? setFunction(board, c.id, { id: "portero", color: GK_COLOR }) : setFunction(board, c.id, funcOf(setup.attack, v))); }}
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
            className="w-full outline-none focus:ring-1 focus:ring-[#73000A] resize-y" style={{ borderRadius: 8, border: `1px solid ${RS.input}`, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.45, minHeight: 116, color: RS.ink }} />
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            <button type="button" onClick={onSave} disabled={!teamId} className="inline-flex items-center justify-center disabled:opacity-40" style={{ ...btnOut, border: `1px solid ${RS.granate}`, color: RS.granate, fontWeight: 600, gap: 6, flex: "1 1 auto" }}>
              <BookmarkPlus className="w-4 h-4" /> {libLinked ? t("Actualizar en la biblioteca") : t("Guardar en biblioteca")}
            </button>
            <button type="button" onClick={onDuplicate} className="inline-flex items-center" style={{ ...btnOut, gap: 6 }}><Copy className="w-4 h-4" /> {t("Duplicar")}</button>
            <button type="button" onClick={onRemove} className="inline-flex items-center" style={{ ...btnOut, gap: 6, color: "#B42318" }}><Trash2 className="w-4 h-4" /> {t("Quitar del partido")}</button>
          </div>
        </Card>
      </aside>
    </div>
  );
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Dibujo de una jugada para imprimir: el primer fotograma de su pizarra, con la vista y la orientación elegidas en el panel
// «Imprimir» (`printBoard`); el estadio sale en blanco (poca tinta). En 3D se hace una imagen (PNG); en plano y perspectiva, SVG.
const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
async function pieceSvg(piece, players, opts = {}) {
  const b = printBoard(pieceBoard(piece, players), opts);
  const printable = isStadium(b.look) ? { ...b, look: "blanco" } : b;
  if (is3D(printable)) {
    const url = await blobToDataUrl(await boardFramePng(printable, 0));
    return `<img src="${url}" alt="" style="width:100%;height:auto;display:block">`;
  }
  const { svg } = await boardSvgMarkup(<Board board={printable} els={printable.frames[0].els} frame={0} />, 1200);
  return svg.replace(/ width="\d+" height="\d+"/, ' style="width:100%;height:auto;display:block"');
}

async function printPieces(list, players, perPage, teamName, book = false, look = {}) {
  const now = new Date(), y = now.getFullYear();
  const season = now.getMonth() >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  const cover = book ? `<div class="cover"><img src="${CLUB_LOGO_URL}" alt=""><h1>ESTRATEGIA<br>A BALÓN PARADO</h1><h3>${esc(teamName || "")}</h3><p>TEMPORADA ${season}</p></div>` : "";
  const typeLabel = (v) => TYPES.find((ty) => ty.value === v)?.label || v;
  const svgs = await Promise.all(list.map((p) => pieceSvg(p, players, look)));
  const titles = list.map((p) => autoTitle(pieceBoard(p, players), pieceSetup(p)).title);
  const cards = list.map((p, i) => `<section class="card">
    <header><div class="club"><img src="${CLUB_LOGO_URL}" alt=""><div><b>RACING SARRIÀ</b><span>${esc(teamName || "")}</span></div></div>
    <div class="ttl"><h2>${esc(p.name)}</h2>${(p.name || "").trim().toLowerCase() === typeLabel(p.type).toLowerCase() ? "" : `<span>${esc(typeLabel(p.type))}</span>`}${titles[i] ? `<em>${esc(titles[i])}</em>` : ""}</div></header>
    ${p.signal ? `<div class="sig"><b>SEÑAL</b><span>${esc(p.signal)}</span></div>` : ""}
    <div class="body"><div class="fld">${svgs[i]}</div>${p.notes ? `<div class="notes"><b>INSTRUCCIONES</b>${esc(p.notes)}</div>` : ""}</div></section>`).join("");
  const one = perPage === 1;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Acciones a balón parado${teamName ? " · " + esc(teamName) : ""}</title>
  <style>
    @font-face{font-family:'Racing Sarria';src:url('${location.origin}/fonts/RacingSarria.ttf') format('truetype')}
    @font-face{font-family:'IBM Plex Sans Condensed';font-weight:400;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Regular.ttf') format('truetype')}
    @font-face{font-family:'IBM Plex Sans Condensed';font-weight:500;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Medium.ttf') format('truetype')}
    @font-face{font-family:'IBM Plex Sans Condensed';font-weight:700;src:url('${location.origin}/fonts/IBMPlexSansCondensed-Bold.ttf') format('truetype')}
    @page{size:A4;margin:10mm} *{box-sizing:border-box} body{margin:0;font-family:'IBM Plex Sans Condensed',Arial,sans-serif;color:#222}
    .card{break-inside:avoid;page-break-inside:avoid;height:${one ? "275mm" : "134mm"};${one ? "" : "margin-bottom:6mm;"}overflow:hidden}
    ${one ? "" : ".card:nth-child(2n){margin-bottom:0}"}
    header{border-bottom:.6mm solid #73000A;padding-bottom:2mm;display:flex;justify-content:space-between;align-items:flex-start;gap:8mm;margin-bottom:3mm}
    .club{display:flex;align-items:center;gap:2.5mm} .club img{height:${one ? 15 : 12}mm;width:auto}
    .club b{display:block;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:${one ? 14 : 11}pt;color:#73000A;line-height:1.05;letter-spacing:.3px} .club span{display:block;font-size:${one ? 13 : 10}pt;color:#FF6E00;font-weight:700;text-transform:uppercase;line-height:1.1}
    .ttl{text-align:right} .ttl h2{margin:0;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:${one ? 26 : 19}pt;line-height:1;color:#73000A;text-transform:uppercase;letter-spacing:.3px} .ttl em{display:block;font-style:normal;font-family:'Racing Sarria',sans-serif;font-size:${one ? 12 : 10}pt;color:#36000D;margin-top:1mm;letter-spacing:.3px} .ttl span{display:block;font-family:'Racing Sarria',sans-serif;font-weight:400;letter-spacing:.5px;font-size:${one ? 15 : 11.5}pt;color:#FF6E00;font-weight:700;text-transform:uppercase;margin-top:1mm}
    .sig{display:flex;align-items:center;gap:3mm;border:.3mm solid #FF6E00;border-radius:1.5mm;padding:1.2mm 3mm;margin-bottom:3mm;font-size:${one ? 12 : 10}pt}
    .sig b{background:#FF6E00;color:#fff;padding:.4mm 2mm;border-radius:1mm;font-size:${one ? 10 : 8.5}pt;letter-spacing:.5px} .sig span{color:#333;font-weight:500}
    .body{display:flex;gap:4mm;align-items:flex-start;justify-content:center} .fld{flex:1;min-width:0;${one ? "max-height:225mm;" : "max-width:132mm;max-height:100mm;"}overflow:hidden}
    .notes{width:${one ? "52mm" : "48mm"};font-size:${one ? 11 : 9.5}pt;white-space:pre-wrap;color:#333;border-left:.5mm solid #FF6E00;padding-left:3mm;font-weight:500}
    .notes b{display:block;color:#FF6E00;font-size:${one ? 9.5 : 8.5}pt;letter-spacing:.5px;margin-bottom:1mm}
    .cover{height:275mm;page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6mm}
    .cover img{height:50mm;width:auto} .cover h1{margin:0;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:40pt;line-height:1.05;color:#73000A;letter-spacing:.5px;border-bottom:1.2mm solid #FF6E00;padding-bottom:5mm}
    .cover h3{margin:0;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:24pt;color:#FF6E00;text-transform:uppercase;letter-spacing:.5px} .cover p{margin:0;font-size:13pt;color:#555;letter-spacing:2px}
  </style></head><body>${cover}<div class="pages">${cards}</div></body></html>`;
  const old = document.getElementById("sp-print-frame");
  if (old) old.remove();
  const fr = document.createElement("iframe");
  fr.id = "sp-print-frame";
  fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(fr);
  const doc = fr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.print(); } };
  const ready = fr.contentWindow.document.fonts?.ready || Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 1800))]).then(() => setTimeout(go, 500));
  return true;
}

export default function SetPieceBoard({ pieces, onChange, candidates = [], allPlayers = [], teamName = "", teamId, eventId, eventDate }) {
  const t = useT();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState(null);
  const [libOpen, setLibOpen] = useState(false);
  const [note, setNote] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [order, setOrder] = useState([]);
  const [off, setOff] = useState([]);
  const [perPage, setPerPage] = useState(1);
  // Vista y orientación al imprimir (se recuerdan en este navegador)
  const [printLook, setPrintLook] = useState(() => { try { return { view: "board", orient: "board", ...JSON.parse(localStorage.getItem("rs_sp_print") || "{}") }; } catch { return { view: "board", orient: "board" }; } });
  const setLook = (patch) => setPrintLook((o) => { const n = { ...o, ...patch }; try { localStorage.setItem("rs_sp_print", JSON.stringify(n)); } catch { /* sin almacenamiento */ } return n; });
  const printList = [...order.filter((id) => pieces.some((p) => p.id === id)), ...pieces.map((p) => p.id).filter((id) => !order.includes(id))];
  const moveP = (id, dir) => { const i = printList.indexOf(id), j = i + dir; if (j < 0 || j >= printList.length) return; const n = [...printList]; [n[i], n[j]] = [n[j], n[i]]; setOrder(n); };
  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 2800); };
  const lookup = [...candidates, ...allPlayers.filter((p) => !candidates.some((c) => c.id === p.id))];
  const availableIds = candidates.map((p) => p.id);
  const doPrint = async () => {
    const list = printList.filter((id) => !off.includes(id)).map((id) => pieces.find((p) => p.id === id));
    if (!list.length) return flash(t("Marca al menos una jugada"));
    try { await printPieces(list, lookup, perPage, teamName, false, printLook); } catch (e) { flash(t("No se pudo imprimir: {error}", { error: e?.message || t("error") })); }
  };
  const active = pieces.find((p) => p.id === activeId) || pieces[0] || null;

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
  const add = () => addPiece({ ...newPiece(pieces.length + 1), kind: "corner", attack: false, side: "r", type: "corner_contra", board: normalizeBoard(legacyToBoard({ id: "nueva", tokens: [], arrows: [] })) });
  const addTemplate = (tpl) => addPiece(fromTemplate(tpl, pieces.length + 1));
  const duplicate = () => { if (!active) return; addPiece({ ...copyPiece(active, { newId: uid, players: lookup, availableIds: lookup.map((p) => p.id), keepLibrary: false }), name: `${active.name} (${t("copia")})` }); };
  const printBook = async () => {
    if (!library.length) return flash(t("La biblioteca está vacía"));
    const ord = TYPES.map((ty) => ty.value);
    const list = [...library].sort((a, b) => (ord.indexOf(a.type) - ord.indexOf(b.type)) || (a.name || "").localeCompare(b.name || ""));
    try { await printPieces(list, lookup, perPage, teamName, true, printLook); } catch (e) { flash(t("No se pudo imprimir: {error}", { error: e?.message || t("error") })); }
  };
  const update = (p) => onChange(pieces.map((x) => (x.id === p.id ? p : x)));
  const remove = (id) => { onChange(pieces.filter((x) => x.id !== id)); setActiveId(null); };
  const typeLabel = (v) => TYPES.find((ty) => ty.value === v)?.label || v;

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

  const bandBtn = { height: 34, padding: "0 14px", borderRadius: 8, border: "1px solid #fff", background: "transparent", color: "#fff", fontSize: 13 };
  const panelHead = (label, onClose) => (
    <div className="flex items-center justify-between">
      <Lab>{label}</Lab>
      <button type="button" onClick={onClose} className="text-[#9A8C8E] hover:text-[#1E1416]" aria-label={t("Cerrar")}><X className="w-4 h-4" /></button>
    </div>
  );
  const rowCls = "flex items-center gap-2 rounded-lg bg-white px-3 py-2";
  return (
    <div className="flex flex-col" style={{ gap: 12, fontFamily: "'IBM Plex Sans Condensed', system-ui, sans-serif", color: RS.ink }} data-testid="set-pieces">
      <div className="flex flex-wrap items-center" style={{ background: RS.dark, color: "#fff", borderRadius: 14, padding: "12px 18px", gap: "10px 18px" }}>
        <div className="min-w-0">
          <p style={{ margin: 0, fontSize: 12, color: "#E8C9CD" }}>{teamName || t("Acciones a balón parado")}</p>
          <h2 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 26, lineHeight: 1, fontWeight: 400, color: "#fff", textTransform: "none" }}>{t("Balón parado")}</h2>
        </div>
        <nav aria-label={t("Jugadas del partido")} className="flex flex-wrap" style={{ gap: 6, flex: "1 1 360px" }}>
          {pieces.map((p) => {
            const on = active?.id === p.id;
            return (
              <button key={p.id} type="button" onClick={() => setActiveId(p.id)} aria-pressed={on} data-testid="sp-piece-tab"
                style={{ height: 32, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: on ? 700 : 400, border: on ? "none" : "1px solid rgba(255,255,255,.45)", background: on ? RS.naranja : "transparent", color: on ? RS.ink : "#fff", maxWidth: 260 }} className="truncate">
                {p.name || t("Sin nombre")}
              </button>
            );
          })}
          <button type="button" onClick={() => setTplOpen((v) => !v)} data-testid="sp-new"
            style={{ height: 32, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: "1px dashed rgba(255,255,255,.65)", background: "transparent", color: "#fff" }}>+ {t("Nueva jugada")}</button>
        </nav>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          <button type="button" onClick={() => setPrevOpen((v) => !v)} disabled={!teamId} style={bandBtn} className="disabled:opacity-40" data-testid="sp-prev-open">{t("Traer del partido anterior")}</button>
          <button type="button" onClick={() => setLibOpen((v) => !v)} style={bandBtn}>{t("Biblioteca{v}", { v: library.length ? ` (${library.length})` : "" })}</button>
          <button type="button" onClick={printBook} disabled={!library.length} title={t("Imprime toda la biblioteca del equipo, con portada y agrupada por tipo")} style={bandBtn} className="disabled:opacity-40">{t("Libro del equipo")}</button>
          <button type="button" onClick={() => setPrintOpen((v) => !v)} disabled={!pieces.length} className="inline-flex items-center disabled:opacity-40" style={{ ...bandBtn, border: "none", background: RS.naranja, color: RS.ink, fontWeight: 700, gap: 6 }}><Printer className="w-4 h-4" /> {t("Imprimir")}</button>
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
                      <p className="text-[11px] truncate" style={{ color: RS.muted }}>{t(typeLabel(p.type))}</p>
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

      {tplOpen && (
        <Card>
          {panelHead(t("Empezar desde…"), () => setTplOpen(false))}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button type="button" onClick={add} className="flex items-center gap-2 text-left" style={{ ...btnOut, border: `1px dashed ${RS.granate}`, color: RS.granate, fontWeight: 600 }} data-testid="sp-new-blank"><Plus className="w-4 h-4" /> {t("Campo en blanco")}</button>
            {TEMPLATES.map((tp) => (
              <button key={tp.key} type="button" onClick={() => addTemplate(tp)} className="flex items-center gap-2 text-left" style={btnOut}><LayoutTemplate className="w-4 h-4 shrink-0" style={{ color: RS.granate }} /> {t(tp.label)}</button>
            ))}
          </div>
          <p className="text-[12px]" style={{ color: RS.muted, margin: 0 }}>{t("En un córner, después eliges la estructura de partida y las funciones a la izquierda.")}</p>
        </Card>
      )}

      {printOpen && pieces.length > 0 && (
        <Card>
          {panelHead(t("Imprimir · elige jugadas y orden"), () => setPrintOpen(false))}
          <div className="space-y-1">
            {printList.map((id, i) => { const p = pieces.find((x) => x.id === id); return (
              <div key={id} className={rowCls} style={{ border: `1px solid ${RS.line}`, padding: "4px 10px" }}>
                <input type="checkbox" checked={!off.includes(id)} onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== id) : [...off, id])} className="accent-[#73000A]" />
                <span className="text-[13px] truncate flex-1 min-w-0">{i + 1}. {p.name || t("Sin nombre")}</span>
                <button type="button" onClick={() => moveP(id, -1)} className="p-1" style={{ color: RS.muted }} aria-label={t("Subir")}><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => moveP(id, 1)} className="p-1" style={{ color: RS.muted }} aria-label={t("Bajar")}><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>); })}
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="sp-print-view">
            <span className="text-[12px] w-[86px]" style={{ color: RS.muted }}>{t("Vista")}</span>
            {[["board", msg("Como en la pizarra")], ["flat", msg("Plana (desde arriba)")], ["persp", msg("Perspectiva")], ["3d", msg("3D")]].map(([v, l]) => (
              <button key={v} type="button" data-testid={`sp-print-view-${v}`} onClick={() => setLook({ view: v })} style={pill(printLook.view === v)}>{t(l)}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="sp-print-orient">
            <span className="text-[12px] w-[86px]" style={{ color: RS.muted }}>{t("Orientación")}</span>
            {[["board", msg("Como en la pizarra")], ["v", msg("Vertical")], ["h", msg("Horizontal")]].map(([v, l]) => (
              <button key={v} type="button" data-testid={`sp-print-orient-${v}`} onClick={() => setLook({ orient: v })} style={pill(printLook.orient === v)}>{t(l)}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[[1, msg("1 por página")], [2, msg("2 por página")]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPerPage(v)} style={pill(perPage === v)}>{t(l)}</button>
            ))}
            <button type="button" onClick={doPrint} className="ml-auto inline-flex items-center" style={{ ...btnOut, background: RS.granate, color: "#fff", border: "none", fontWeight: 600, gap: 6 }}><Printer className="w-4 h-4" /> {t("Imprimir")}</button>
          </div>
        </Card>
      )}

      {libOpen && (
        <Card>
          {panelHead(t("Biblioteca del equipo"), () => setLibOpen(false))}
          {library.length === 0 ? (
            <p className="text-xs" style={{ color: RS.muted }}>{t("Aún no hay jugadas guardadas. Crea una y pulsa «Guardar en biblioteca».")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {library.map((l) => (
                <div key={l.id} className={rowCls} style={{ border: `1px solid ${RS.line}` }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate">{l.name || t("Sin nombre")}</p>
                    <p className="text-[11px] truncate" style={{ color: RS.muted }}>{t(typeLabel(l.type))}{l.signal ? ` · ${t("Señal: {signal}", { signal: l.signal })}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => addFromLibrary(l)} style={{ ...btnOut, height: 30, background: RS.granate, color: "#fff", border: "none", fontWeight: 600 }}>{t("Usar")}</button>
                  <button type="button" onClick={() => removeFromLibrary(l)} className="p-1" style={{ color: "#B9A7A9" }} title={t("Quitar de la biblioteca")}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {!active ? (
        <Card>
          <p className="text-sm text-center" style={{ color: RS.muted, margin: "16px 0" }}>{t("Aún no hay jugadas. Crea una nueva, usa una de la biblioteca o tráelas del partido anterior.")}</p>
        </Card>
      ) : (
        <PieceEditor key={active.id} piece={active} onChange={update} candidates={candidates} lookup={lookup} teamId={teamId}
          libLinked={!!active.lib_id && library.some((l) => l.id === active.lib_id)}
          onSave={saveToLibrary} onDuplicate={duplicate} onRemove={() => remove(active.id)} />
      )}
    </div>
  );
}
