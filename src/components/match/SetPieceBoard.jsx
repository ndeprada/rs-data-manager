import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, BookmarkPlus, Library, X, Printer, ArrowUp, ArrowDown, Copy, FlipHorizontal, LayoutTemplate, Users, BookOpen, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playerFirstName } from "@/lib/playerName";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";

import { Button } from "@/components/ui/button";
import { useT, msg } from "@/i18n";
import BoardEditor from "@/components/board/BoardEditor";
import Board from "@/components/board/BoardSvg";
import { boardSvgMarkup } from "@/components/board/exportPng";
import { isStadium } from "@/lib/board";
import { assignPlayer, copyPiece, fillWithSquad, flipBoard, ownChips, pieceBoard, previousMatchPieces, setRole } from "@/lib/setPieceBoard";
// Jugadas a balón parado con la pizarra común (la misma de tareas y tácticas, a pantalla completa): medio campo con la
// portería arriba, fichas propias (con jugador: dorsal dentro, nombre debajo y rol encima) y rivales, balón, flechas, zonas…
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
const ROLES = [msg("Lanzador"), msg("Rematador 1er palo"), msg("Rematador 2º palo"), msg("Rematador"), msg("Bloqueador"), msg("Pantalla"), msg("Referencia"), msg("Rechace"), msg("Segunda jugada"), msg("Marca"), msg("Zona"), msg("Cobertura"), msg("Pasador")];
const GRANATE = "#73000A", NARANJA = "#FF6E00";
const F_BIG = "'Racing Sarria', sans-serif", F_TXT = "'IBM Plex Sans Condensed', sans-serif";
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

// Una jugada: cabecera (título, tipo y señal), la pizarra (vista previa → pantalla completa), las instrucciones al lado y,
// debajo, los jugadores de la jugada (cada ficha nuestra con su jugador y su rol).
function PieceEditor({ piece, onChange, candidates, lookup, header, side }) {
  const t = useT();
  const board = pieceBoard(piece, lookup);
  const setBoard = (b) => onChange({ ...piece, board: b });
  const chips = ownChips(board);
  const byId = new Map(lookup.map((p) => [p.id, p]));
  return (
    <div className="space-y-3">
      {header}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 min-w-0" data-testid="sp-board">
          <BoardEditor value={board} onChange={setBoard} fields={["half", "tq", "full", "free"]} filename={piece.name || t("Jugada")} />
        </div>
        {side}
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2" data-testid="sp-players">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t("Jugadores de la jugada")}</p>
          <button type="button" onClick={() => setBoard(fillWithSquad(board, candidates))} disabled={!chips.some((c) => !c.player_id) || !candidates.length}
            className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <Users className="w-3.5 h-3.5" /> {t("Rellenar con convocados")}
          </button>
        </div>
        {chips.length === 0 ? (
          <p className="text-xs text-gray-400">{t("Coloca fichas del Racing en la pizarra para darles jugador y rol.")}</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-1.5">
            {chips.map((c) => {
              const pl = c.player_id ? byId.get(c.player_id) : null;
              return (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5" style={{ borderColor: c.missing ? "#f59e0b" : "#e5e7eb" }}>
                  <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold" style={c.missing ? { background: "#fef3c7", color: "#92400e", border: "1px solid #f59e0b" } : { background: GRANATE, color: "#fff" }} title={c.missing ? t("El jugador de esta ficha no está disponible: elige otro") : undefined}>{c.inner || "·"}</span>
                  <Select value={c.player_id || "__none__"} onValueChange={(v) => setBoard(assignPlayer(board, c.id, v === "__none__" ? null : byId.get(v) || null))}>
                    <SelectTrigger className="h-8 text-xs border-gray-200 bg-white flex-1 min-w-[150px]"><SelectValue placeholder={t("Sin asignar")} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__none__">{c.missing ? t("Elegir jugador…") : t("Sin asignar")}</SelectItem>
                      {pl && !candidates.some((p) => p.id === pl.id) && <SelectItem value={pl.id}>{pl.jersey_number || "–"} · {shortName(pl)}</SelectItem>}
                      {candidates.map((p) => <SelectItem key={p.id} value={p.id}>{p.jersey_number || "–"} · {shortName(p)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input list="sp-roles" value={c.labelTop || ""} onChange={(e) => setBoard(setRole(board, c.id, e.target.value))} placeholder={t("Rol")} aria-label={t("Rol en la jugada")} className="h-8 w-24 sm:w-28 text-xs border-gray-200 bg-white shrink-0" />
                </div>
              );
            })}
          </div>
        )}
        <datalist id="sp-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
      </div>
    </div>
  );
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Dibujo (SVG como texto) de una jugada para imprimir: el primer fotograma de su pizarra; el estadio sale en blanco (poca tinta)
async function pieceSvg(piece, players) {
  const b = pieceBoard(piece, players);
  const printable = isStadium(b.look) ? { ...b, look: "blanco" } : b;
  const { svg } = await boardSvgMarkup(<Board board={printable} els={printable.frames[0].els} />, 1200);
  return svg.replace(/ width="\d+" height="\d+"/, ' style="width:100%;height:auto;display:block"');
}

async function printPieces(list, players, perPage, teamName, book = false) {
  const now = new Date(), y = now.getFullYear();
  const season = now.getMonth() >= 6 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  const cover = book ? `<div class="cover"><img src="${CLUB_LOGO_URL}" alt=""><h1>ESTRATEGIA<br>A BALÓN PARADO</h1><h3>${esc(teamName || "")}</h3><p>TEMPORADA ${season}</p></div>` : "";
  const typeLabel = (v) => TYPES.find((ty) => ty.value === v)?.label || v;
  const svgs = await Promise.all(list.map((p) => pieceSvg(p, players)));
  const cards = list.map((p, i) => `<section class="card">
    <header><div class="club"><img src="${CLUB_LOGO_URL}" alt=""><div><b>RACING SARRIÀ</b><span>${esc(teamName || "")}</span></div></div>
    <div class="ttl"><h2>${esc(p.name)}</h2>${(p.name || "").trim().toLowerCase() === typeLabel(p.type).toLowerCase() ? "" : `<span>${esc(typeLabel(p.type))}</span>`}</div></header>
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
    .ttl{text-align:right} .ttl h2{margin:0;font-family:'Racing Sarria',sans-serif;font-weight:400;font-size:${one ? 26 : 19}pt;line-height:1;color:#73000A;text-transform:uppercase;letter-spacing:.3px} .ttl span{display:block;font-family:'Racing Sarria',sans-serif;font-weight:400;letter-spacing:.5px;font-size:${one ? 15 : 11.5}pt;color:#FF6E00;font-weight:700;text-transform:uppercase;margin-top:1mm}
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
  const printList = [...order.filter((id) => pieces.some((p) => p.id === id)), ...pieces.map((p) => p.id).filter((id) => !order.includes(id))];
  const moveP = (id, dir) => { const i = printList.indexOf(id), j = i + dir; if (j < 0 || j >= printList.length) return; const n = [...printList]; [n[i], n[j]] = [n[j], n[i]]; setOrder(n); };
  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 2800); };
  const lookup = [...candidates, ...allPlayers.filter((p) => !candidates.some((c) => c.id === p.id))];
  const availableIds = candidates.map((p) => p.id);
  const doPrint = async () => {
    const list = printList.filter((id) => !off.includes(id)).map((id) => pieces.find((p) => p.id === id));
    if (!list.length) return flash(t("Marca al menos una jugada"));
    try { await printPieces(list, lookup, perPage, teamName); } catch (e) { flash(t("No se pudo imprimir: {error}", { error: e?.message || t("error") })); }
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
  const add = () => addPiece(newPiece(pieces.length + 1));
  const addTemplate = (tpl) => addPiece(fromTemplate(tpl, pieces.length + 1));
  const duplicate = () => { if (!active) return; addPiece({ ...copyPiece(active, { newId: uid, players: lookup, availableIds: lookup.map((p) => p.id), keepLibrary: false }), name: `${active.name} (${t("copia")})` }); };
  const flip = () => { if (active) update({ ...active, board: flipBoard(pieceBoard(active, lookup)) }); };
  const printBook = async () => {
    if (!library.length) return flash(t("La biblioteca está vacía"));
    const ord = TYPES.map((ty) => ty.value);
    const list = [...library].sort((a, b) => (ord.indexOf(a.type) - ord.indexOf(b.type)) || (a.name || "").localeCompare(b.name || ""));
    try { await printPieces(list, lookup, perPage, teamName, true); } catch (e) { flash(t("No se pudo imprimir: {error}", { error: e?.message || t("error") })); }
  };
  const update = (p) => onChange(pieces.map((x) => (x.id === p.id ? p : x)));
  const remove = (id) => { onChange(pieces.filter((x) => x.id !== id)); setActiveId(null); };
  const typeLabel = (v) => TYPES.find((ty) => ty.value === v)?.label || v;

  const saveToLibrary = async () => {
    if (!active || !teamId) return;
    const data = { team_id: teamId, name: active.name, type: active.type, signal: active.signal || "", notes: active.notes || "", board: pieceBoard(active, lookup), tokens: active.tokens || [], arrows: active.arrows || [] };
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
    const p = copyPiece({ ...newPiece(pieces.length + 1), name: l.name, type: l.type, signal: l.signal || "", notes: l.notes || "", lib_id: l.id, tokens: l.tokens || [], arrows: l.arrows || [], ...(l.board ? { board: l.board } : {}) }, { newId: uid, players: lookup, availableIds });
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

  const btn = "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">{t("⚽ Acciones a balón parado")}</p>
          <p className="text-[10px] text-gray-400">{t("Diseña las jugadas del partido y guárdalas para reutilizarlas.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPrintOpen((v) => !v)} disabled={!pieces.length} className={btn}><Printer className="w-3.5 h-3.5" /> {t("Imprimir")}</button>
          <button type="button" onClick={() => setPrevOpen((v) => !v)} disabled={!teamId} className={btn} data-testid="sp-prev-open"><History className="w-3.5 h-3.5" /> {t("Traer del partido anterior")}</button>
          <button type="button" onClick={() => setLibOpen((v) => !v)} className={btn}><Library className="w-3.5 h-3.5" /> {t("Biblioteca{v}", { v: library.length ? ` (${library.length})` : "" })}</button>
          <button type="button" onClick={() => setTplOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1.5 rounded" style={{ background: "var(--granate)" }}><Plus className="w-3.5 h-3.5" /> {t("Nueva jugada")}</button>
        </div>
      </div>
      {note && <p className="text-[11px] text-gray-600" role="status">{note}</p>}

      {prevOpen && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2" data-testid="sp-prev">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t("Jugadas del partido anterior")}</p>
            <button type="button" onClick={() => setPrevOpen(false)} className="text-gray-400 hover:text-gray-700" aria-label={t("Cerrar")}><X className="w-4 h-4" /></button>
          </div>
          {prevLoading && !prev ? <p className="text-xs text-gray-400">{t("Buscando…")}</p> : !prev ? (
            <p className="text-xs text-gray-400">{t("No hay jugadas en los partidos anteriores de este equipo.")}</p>
          ) : (
            <>
              <p className="text-xs text-gray-600">{[prev.event?.title || prev.event?.rival || t("Partido"), prev.event?.date ? String(prev.event.date).slice(0, 10).split("-").reverse().join("/") : ""].filter(Boolean).join(" · ")}</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {prev.pieces.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 truncate">{p.name || t("Sin nombre")}</p>
                      <p className="text-[10px] text-gray-400 truncate">{t(typeLabel(p.type))}</p>
                    </div>
                    <button type="button" onClick={() => bringPrev([p])} className="text-[11px] font-bold px-2 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0">{t("Copiar")}</button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="club" size="sm" onClick={() => bringPrev(prev.pieces)} className="gap-1" data-testid="sp-prev-all"><Copy className="w-3.5 h-3.5" /> {t("Copiar las {n} jugadas", { n: prev.pieces.length })}</Button>
                <p className="text-[10px] text-gray-400">{t("Los jugadores que no están convocados quedan marcados con «?» para elegir otro.")}</p>
              </div>
            </>
          )}
        </div>
      )}

      {tplOpen && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t("Empezar desde…")}</p>
            <button type="button" onClick={() => setTplOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <button type="button" onClick={add} className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /> {t("Campo en blanco")}</button>
            {TEMPLATES.map((tp) => (
              <button key={tp.key} type="button" onClick={() => addTemplate(tp)} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50 text-left"><LayoutTemplate className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--granate)" }} /> {t(tp.label)}</button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400">{t("Las fichas ya vienen colocadas. Después solo asignas los jugadores (o pulsas «Rellenar con convocados»).")}</p>
        </div>
      )}

      {printOpen && pieces.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t("Imprimir · elige jugadas y orden")}</p>
            <button type="button" onClick={() => setPrintOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1">
            {printList.map((id, i) => { const p = pieces.find((x) => x.id === id); return (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
                <input type="checkbox" checked={!off.includes(id)} onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== id) : [...off, id])} className="accent-[#73000A]" />
                <span className="text-xs font-semibold text-gray-800 truncate flex-1 min-w-0">{i + 1}. {p.name || t("Sin nombre")}</span>
                <button type="button" onClick={() => moveP(id, -1)} className="p-1 text-gray-400 hover:text-gray-800"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => moveP(id, 1)} className="p-1 text-gray-400 hover:text-gray-800"><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>); })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[[1, msg("1 por página")], [2, msg("2 por página")]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPerPage(v)} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${perPage === v ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`} style={perPage === v ? { background: "var(--granate)" } : {}}>{t(l)}</button>
            ))}
            <button type="button" onClick={printBook} disabled={!library.length} title={t("Imprime toda la biblioteca del equipo, con portada y agrupada por tipo")} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40"><BookOpen className="w-3.5 h-3.5" /> {t("Libro del equipo")}</button>
            <Button type="button" variant="club" size="sm" onClick={doPrint} className="ml-auto gap-1"><Printer className="w-3.5 h-3.5" /> {t("Imprimir")}</Button>
          </div>
        </div>
      )}

      {libOpen && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t("Biblioteca del equipo")}</p>
            <button type="button" onClick={() => setLibOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          {library.length === 0 ? (
            <p className="text-xs text-gray-400">{t("Aún no hay jugadas guardadas. Crea una y pulsa «Guardar en biblioteca».")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {library.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{l.name || t("Sin nombre")}</p>
                    <p className="text-[10px] text-gray-400 truncate">{typeLabel(l.type)}{l.signal ? ` · ${t("Señal: {signal}", { signal: l.signal })}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => addFromLibrary(l)} className="text-[11px] font-bold text-white px-2 py-1 rounded shrink-0" style={{ background: "var(--granate)" }}>{t("Usar")}</button>
                  <button type="button" onClick={() => removeFromLibrary(l)} className="p-1 text-gray-300 hover:text-red-500 shrink-0" title={t("Quitar de la biblioteca")}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pieces.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{t("Aún no hay jugadas. Crea una nueva, usa una de la biblioteca o tráelas del partido anterior.")}</p>
      ) : (
        <div className="grid lg:grid-cols-[200px_1fr] gap-4">
          <div className="space-y-1">
            {pieces.map((p) => (
              <button key={p.id} type="button" onClick={() => setActiveId(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${active?.id === p.id ? "border-[var(--granate)] bg-red-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <span className="block font-bold text-gray-900 truncate">{p.name || t("Sin nombre")}</span>
                <span className="text-[10px] text-gray-400">{typeLabel(p.type)}</span>
              </button>
            ))}
          </div>
          {active && (
            <div className="space-y-3 min-w-0">
              <PieceEditor key={active.id} piece={active} onChange={update} candidates={candidates} lookup={lookup}
                header={(
                  <>
                    <div className="flex items-start justify-between gap-3 border-b-2 pb-2" style={{ borderColor: GRANATE }}>
                      <div className="flex items-center gap-2 shrink-0">
                        <img src={CLUB_LOGO_URL} alt="" className="h-9 sm:h-11 w-auto" />
                        <div className="hidden sm:block leading-tight">
                          <p className="text-sm" style={{ fontFamily: F_BIG, color: GRANATE, letterSpacing: "0.05em" }}>{t("RACING SARRIÀ")}</p>
                          <p className="text-xs uppercase font-semibold" style={{ fontFamily: F_TXT, color: NARANJA }}>{teamName}</p>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col items-end">
                        <input value={active.name} onChange={(e) => update({ ...active, name: e.target.value })} placeholder={t("TÍTULO DE LA JUGADA")}
                          className="w-full text-right uppercase bg-transparent rounded px-1 outline-none hover:bg-gray-50 focus:bg-gray-50 focus:ring-1 focus:ring-[#FF6E00] text-xl sm:text-3xl leading-tight"
                          style={{ fontFamily: F_BIG, color: GRANATE, letterSpacing: "0.05em" }} />
                        <Select value={active.type} onValueChange={(v) => update({ ...active, type: v })}>
                          <SelectTrigger className="h-7 w-auto max-w-full border-0 bg-transparent shadow-none px-1 gap-1 focus:ring-0 hover:bg-gray-50 text-sm sm:text-base uppercase" style={{ fontFamily: F_BIG, color: NARANJA, letterSpacing: "0.05em" }}><SelectValue /></SelectTrigger>
                          <SelectContent>{TYPES.map((ty) => <SelectItem key={ty.value} value={ty.value}>{t(ty.label)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border px-2 py-1" style={{ borderColor: NARANJA }}>
                      <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded shrink-0" style={{ background: NARANJA, fontFamily: F_TXT, letterSpacing: "0.08em" }}>{t("SEÑAL")}</span>
                      <input value={active.signal || ""} onChange={(e) => update({ ...active, signal: e.target.value })} placeholder={t("Cómo se avisa: el lanzador se toca la cabeza, bota el balón…")}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-800" style={{ fontFamily: F_TXT }} />
                    </div>
                  </>
                )}
                side={(
                  <div className="w-full md:w-48 shrink-0 md:border-l-2 md:pl-3" style={{ borderColor: NARANJA }}>
                    <p className="text-[10px] font-bold mb-1" style={{ color: NARANJA, fontFamily: F_TXT, letterSpacing: "0.08em" }}>{t("INSTRUCCIONES")}</p>
                    <Textarea rows={5} value={active.notes} onChange={(e) => update({ ...active, notes: e.target.value })} className="border-gray-200 text-sm" style={{ fontFamily: F_TXT }} placeholder={t("Quién saca, quién ataca el primer palo, rechace…")} />
                  </div>
                )} />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={saveToLibrary} disabled={!teamId} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border" style={{ borderColor: "var(--granate)", color: "var(--granate)" }}>
                  <BookmarkPlus className="w-3.5 h-3.5" /> {active.lib_id ? t("Actualizar en la biblioteca") : t("Guardar en biblioteca")}
                </button>
                <button type="button" onClick={duplicate} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"><Copy className="w-3.5 h-3.5" /> {t("Duplicar")}</button>
                <button type="button" onClick={flip} title={t("Voltea la jugada de izquierda a derecha (por ejemplo, un córner del otro lado)")} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"><FlipHorizontal className="w-3.5 h-3.5" /> {t("Voltear izq/der")}</button>
                <button type="button" onClick={() => remove(active.id)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /> {t("Quitar del partido")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
