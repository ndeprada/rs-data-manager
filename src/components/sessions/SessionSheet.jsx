import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import "./sessionFonts";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { PitchView, hasBoard } from "./PitchBoard";
import {
  allTasks, blockInfo, contentBlock, contentName, fmtMin, hasText, isBlankTask, phasesLabel, seriesLabel, sessionTypeInfo, sessionTypeName,
  staffRolesText, stageInfo, taskMinutes,
  recText,
} from "@/lib/sessionPlan";
import { fullDate, playerFullName, posShort, sortRoster } from "./sessionHelpers";
import { areaFor, attendanceOf } from "./sessionAttendance";
import { packPages } from "./sessionPdf";

// Hoja de la sesión en hojas A4 (rediseño del 02/11/2026, igual que la maqueta aprobada por Nacho).
// Cada hoja mide 794 × 1123 px (A4 a 96 ppp) y se compone de bloques (cabecera, objetivos, jugadores, cada tarea…):
// los bloques se miden y se reparten en hojas sin partir ninguno. La misma hoja se ve en la vista previa, se imprime
// (vectorial) y se pasa a PDF. Solo estilos en línea (también se copia a la maqueta). Siempre en español.

export const PAGE_W = 794, PAGE_H = 1123;
const PAD = { t: 30, x: 34, b: 22 };
const FOOT = 20; // pie de página
const GAP = 10;
export const CONTENT_W = PAGE_W - 2 * PAD.x;
export const CONTENT_H = PAGE_H - PAD.t - PAD.b - FOOT;

const GRANATE = "#73000A", DARK = "#36000D", INK = "#1F1416", SOFT = "#3A2E30", MUTED = "#6B5E60", LINE = "#E6DEDD";
const DISPLAY = "'Barlow Condensed', 'Racing Sarria', Arial, sans-serif";
const BODY = "Inter, Arial, Helvetica, sans-serif";
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lines = (s) => String(s || "").split("\n").map((x) => x.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean);

const d = { fontFamily: DISPLAY, textTransform: "uppercase", letterSpacing: ".02em" };
const k = { fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", color: GRANATE, fontSize: 11, letterSpacing: ".04em" };
const sec = { fontFamily: DISPLAY, fontWeight: 800, textTransform: "uppercase", fontSize: 9.5, color: GRANATE, marginTop: 5, letterSpacing: ".04em" };

const Sec = ({ children }) => <div style={sec}>{children}</div>;
function Bullets({ text }) {
  const rows = lines(text);
  if (!rows.length) return null;
  return <div style={{ lineHeight: 1.35, marginTop: 3 }}>{rows.map((r, i) => <div key={i}>• {r}</div>)}</div>;
}

function Chip({ id, task, kind }) {
  const b = blockInfo(contentBlock(id, task));
  const p = kind === "P";
  return (
    <span style={{ display: "inline-block", borderRadius: 999, padding: "1px 6px", fontSize: 9, fontWeight: 600, margin: "0 3px 3px 0", background: p ? "#FBEDEE" : "#F3F0F0", color: p ? GRANATE : SOFT }}>
      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: b?.color || "#999", marginRight: 4, verticalAlign: 0 }} />
      {contentName(id, task)} ({kind})
    </span>
  );
}

function taskMeta(task) {
  const sl = seriesLabel(task);
  const rec = Number(String(task.rec_min || "").replace(",", ".")) || 0;
  const players = /^\d+$/.test(String(task.players_n || "").trim()) ? `${task.players_n} jugadores` : task.players_n;
  return [sl, rec ? `rec. ${recText(rec)}` : "", task.space, players, task.material].filter(hasText).join(" · ");
}

const hasDrawing = (t) => hasBoard(t.board) || Boolean(t.diagram_url);
function Drawing({ task, maxH }) {
  if (hasBoard(task.board)) return <PitchView board={task.board} print style={{ width: "100%", maxHeight: maxH, display: "block" }} />;
  return <img src={task.diagram_url} alt="" crossOrigin="anonymous" style={{ width: "100%", maxHeight: maxH, objectFit: "contain", display: "block" }} />;
}

// Una tarea: texto a la izquierda y dibujo a la derecha (como en la maqueta)
function TaskCard({ task, n }) {
  const draw = hasDrawing(task);
  const phases = phasesLabel(task.phases);
  const staff = [...lines(staffRolesText(task.staff_roles || [])), ...lines(task.staff_corrections)];
  const m = taskMinutes(task);
  const meta = taskMeta(task);
  const p = task.principal || [], s = task.secondary || [];
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: draw ? "minmax(0,1fr) 300px" : "minmax(0,1fr)", gap: 10, padding: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...d, fontSize: 13, fontWeight: 800, color: GRANATE, lineHeight: 1.15 }}>{n} · {task.title || "Tarea"}{m ? <span style={{ color: SOFT, fontWeight: 700 }}> · {fmtMin(m)}</span> : null}</div>
          {meta && <div style={{ fontWeight: 600, marginTop: 1 }}>{meta}</div>}
          {hasText(task.description) && <div style={{ lineHeight: 1.35, marginTop: 4 }}>{lines(task.description).map((r, i) => <div key={i}>• {r}</div>)}</div>}
          {(hasText(task.objective) || phases) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "4px 10px", marginTop: 2 }}>
              {hasText(task.objective) && <div><Sec>Objetivo</Sec><div style={{ lineHeight: 1.35 }}>{task.objective}</div></div>}
              {phases && <div><Sec>Fase del juego</Sec><div style={{ lineHeight: 1.35 }}>{phases}</div></div>}
            </div>
          )}
          {(p.length > 0 || s.length > 0) && (
            <>
              <Sec>Contenidos</Sec>
              <div style={{ marginTop: 2 }}>{p.map((id) => <Chip key={id} id={id} task={task} kind="P" />)}{s.map((id) => <Chip key={id} id={id} task={task} kind="S" />)}</div>
            </>
          )}
          {hasText(task.corrections) && (<><Sec>Correcciones</Sec><Bullets text={task.corrections} /></>)}
          {staff.length > 0 && (
            <>
              <Sec>Cuerpo técnico</Sec>
              <div style={{ lineHeight: 1.35 }}>{staff.map((r, i) => { const c = r.indexOf(":"); return <span key={i}>{i ? " · " : ""}{c > 0 && c < 40 ? <><b>{r.slice(0, c + 1)}</b>{r.slice(c + 1)}</> : r}</span>; })}</div>
            </>
          )}
          {hasText(task.scoring) && (<><Sec>Puntuación</Sec><div style={{ lineHeight: 1.35, color: "#B91C1C" }}>{lines(task.scoring).join(" · ")}</div></>)}
          {!draw && hasText(task.teams_text) && <div style={{ marginTop: 4, lineHeight: 1.35 }}><b>Equipos:</b> {lines(task.teams_text).join(" · ")}</div>}
        </div>
        {draw && (
          <div style={{ minWidth: 0 }}>
            <div style={{ borderRadius: 6, overflow: "hidden", background: "#EEF3EE" }}><Drawing task={task} maxH={330} /></div>
            {hasText(task.teams_text) && <div style={{ marginTop: 4, lineHeight: 1.35 }}><b>Equipos:</b> {lines(task.teams_text).join(" · ")}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const Band = ({ title, minutes }) => (
  <div style={{ background: DARK, color: "#fff", display: "flex", padding: "4px 8px", borderRadius: 6, ...d }}>
    <span style={{ flex: 1, fontWeight: 800, fontSize: 12 }}>{title}</span><span style={{ fontWeight: 800, fontSize: 12 }}>{minutes}</span>
  </div>
);

const ST_TEXT = { si: ["Sí", "#15803D"], ad: ["Al margen", "#B45309"], no: ["No", "#C81E1E"] };

// Bloques de la hoja, en orden: cada uno se mide y se coloca entero en una hoja
export function sheetBlocks({ session, team, players = [], matchRef, pdiGoals = [], ownerName = "" }) {
  const type = sessionTypeInfo(session.session_type);
  const initial = (session.initial?.tasks || []).filter((t) => !isBlankTask(t));
  const main = (session.main?.tasks || []).filter((t) => !isBlankTask(t));
  const sum = (ts) => ts.reduce((s, t) => s + taskMinutes(t), 0);
  const roster = sortRoster(players);
  const att = session.attendance || {};
  const match = session.match_ref || matchRef || "";
  const stage = stageInfo(session.stage);
  const eff = roster.map((p) => attendanceOf(p, att[p.id]));
  const available = eff.filter((a) => a.st !== "no").length;
  const total = sum(initial) + sum(main);
  const when = [cap(fullDate(session.date)), session.time_place].filter(hasText).join(" · ");
  const blocks = [];

  blocks.push({ key: "head", el: (
    <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
      <div style={{ width: 58, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={CLUB_LOGO_URL} alt="" crossOrigin="anonymous" style={{ width: 54, height: "auto" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, minWidth: 0 }}>
        <div style={{ ...d, fontSize: 12, fontWeight: 700, color: MUTED }}>Racing Sarrià · Sesión de entrenamiento</div>
        <div style={{ ...d, fontSize: 26, fontWeight: 800, color: GRANATE, lineHeight: 1 }}>{team?.name || "Equipo"}</div>
        <div style={{ fontSize: 10, color: SOFT }}>{[ownerName && `Entrenador: ${ownerName}`, stage?.label].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "3px 10px", alignContent: "center", background: "#F7F3F3", borderRadius: 8, padding: "8px 12px", maxWidth: 360 }}>
        <span style={k}>Fecha</span><span style={{ fontWeight: 600 }}>{when || "—"}</span>
        <span style={k}>Tipo</span>
        <span>{type ? <span style={{ background: type.color, color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 700, fontSize: 9.5, textTransform: "uppercase" }}>{sessionTypeName(type)}</span> : "—"}</span>
        <span style={k}>Duración</span><span style={{ fontWeight: 600 }}>{session.duration || 90}'{total ? ` (${fmtMin(total)} de tareas)` : ""}</span>
        {hasText(match) && <><span style={k}>Partido</span><span style={{ fontWeight: 600 }}>{match}</span></>}
      </div>
    </div>
  ) });

  if (hasText(session.obj_atk) || hasText(session.obj_def)) blocks.push({ key: "obj", el: (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
      {[["Objetivos ofensivos", session.obj_atk], ["Objetivos defensivos", session.obj_def]].map(([t, v]) => (
        <div key={t} style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 8px" }}>
          <div style={k}>{t}</div>
          <div style={{ lineHeight: 1.35, marginTop: 2, whiteSpace: "pre-line" }}>{v || "—"}</div>
        </div>
      ))}
    </div>
  ) });

  if (roster.length && session.show_attendance !== false) {
    const th = { background: DARK, color: "#fff", fontFamily: DISPLAY, fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: ".04em", padding: "3px 6px", textAlign: "left" };
    const td = { borderBottom: "1px solid #EFE6E6", padding: "2.5px 6px", textAlign: "left", fontSize: 9.5, lineHeight: 1.25, verticalAlign: "top" };
    blocks.push({ key: "players", el: (
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <colgroup><col style={{ width: 34 }} /><col style={{ width: 24 }} /><col style={{ width: 190 }} /><col style={{ width: 120 }} /><col /></colgroup>
        <thead><tr><th style={th}>Pos</th><th style={th}>Nº</th><th style={th}>Jugador</th><th style={th}>Disponible</th><th style={th}>Área del PDI que trabaja</th></tr></thead>
        <tbody>
          {roster.map((p, i) => {
            const a = eff[i];
            const st = ST_TEXT[a.st];
            return (
              <tr key={p.id}>
                <td style={td}><b style={{ color: GRANATE }}>{posShort(p.position)}</b></td>
                <td style={td}>{p.jersey_number ?? ""}</td>
                <td style={td}>{playerFullName(p)}</td>
                <td style={{ ...td, color: st?.[1] || "#9A8C8E", fontWeight: a.st && a.st !== "si" ? 600 : 400 }}>{st ? `${st[0]}${a.st !== "si" && a.obs ? ` · ${a.obs}` : ""}` : ""}</td>
                <td style={td}>{a.st === "no" ? "—" : areaFor(p, att[p.id], pdiGoals)}</td>
              </tr>
            );
          })}
          <tr><td colSpan={5} style={{ ...td, color: MUTED, borderBottom: 0 }}>{hasText(session.attendance_others) ? `Otros / a prueba: ${session.attendance_others} · ` : ""}Disponibles {available} de {roster.length}</td></tr>
        </tbody>
      </table>
    ) });
  }

  if (initial.length) {
    blocks.push({ key: "band-i", stick: true, el: <Band title="Parte inicial" minutes={fmtMin(sum(initial))} />, tight: true });
    initial.forEach((t, i) => blocks.push({ key: `i-${t.id}`, el: <TaskCard task={t} n={i + 1} /> }));
  }
  if (main.length) {
    blocks.push({ key: "band-m", stick: true, el: <Band title="Parte principal" minutes={fmtMin(sum(main))} />, tight: true });
    main.forEach((t, i) => blocks.push({ key: `m-${t.id}`, el: <TaskCard task={t} n={i + 1} /> }));
  }
  if (hasText(session.notes)) blocks.push({ key: "notes", el: (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "6px 8px" }}>
      <span style={k}>Notas </span><span style={{ whiteSpace: "pre-line", lineHeight: 1.35 }}>{session.notes}</span>
    </div>
  ) });
  return blocks;
}

export function Page({ children, n, of }) {
  return (
    <div className="session-page" style={{ width: PAGE_W, height: PAGE_H, boxSizing: "border-box", padding: `${PAD.t}px ${PAD.x}px ${PAD.b}px`, background: "#fff", fontFamily: BODY, color: INK, fontSize: 10, display: "flex", flexDirection: "column", overflow: "hidden", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <div style={{ height: FOOT, display: "flex", alignItems: "flex-end", justifyContent: "space-between", fontSize: 8.5, color: "#9A8C8E", borderTop: "1px solid #EFE6E6", paddingTop: 4, boxSizing: "border-box" }}>
        <span>Racing Sarrià · RS Manager</span><span>Página {n} de {of}</span>
      </div>
    </div>
  );
}

const gapAfter = (b) => (b.tight ? 6 : GAP);

/**
 * La hoja repartida en páginas A4. Primero mide cada bloque (fuera de la vista) y luego los coloca.
 * onReady(nodosDeLasPáginas) se llama cuando ya están colocadas (para el PDF).
 */
export default function SessionSheet({ onPages, ...props }) {
  const blocks = useMemo(() => sheetBlocks(props), [props]);
  const measure = useRef(null);
  const [pages, setPages] = useState(null);
  const sig = blocks.map((b) => b.key).join("|");
  useLayoutEffect(() => {
    const host = measure.current;
    if (!host) return undefined;
    let raf = 0;
    const run = () => {
      const hs = [...host.children].map((c) => c.getBoundingClientRect().height);
      const next = packPages(blocks.map((b, i) => ({ h: hs[i], gap: gapAfter(b), stick: !!b.stick })), CONTENT_H);
      // solo si cambia el reparto (si no, cada render volvería a repartir y no pararía)
      setPages((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    run();
    // las imágenes (escudo, dibujos) pueden cambiar la altura al cargar
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); });
    [...host.children].forEach((c) => ro.observe(c));
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [sig, blocks]);
  useLayoutEffect(() => { if (pages && onPages) onPages(pages.length); }, [pages, onPages]);

  return (
    <>
      <div ref={measure} aria-hidden="true" className="session-measure" style={{ position: "absolute", left: -20000, top: 0, width: CONTENT_W, fontFamily: BODY, fontSize: 10, color: INK, visibility: "hidden" }}>
        {blocks.map((b) => <div key={b.key} style={{ display: "flow-root" }}>{b.el}</div>)}
      </div>
      {(pages || [blocks.map((_, i) => i)]).map((idxs, p, all) => (
        <Page key={p} n={p + 1} of={all.length}>
          {idxs.map((i, j) => (
            <div key={blocks[i].key} style={{ marginTop: j ? gapAfter(blocks[idxs[j - 1]]) : 0, display: "flow-root" }}>{blocks[i].el}</div>
          ))}
        </Page>
      ))}
    </>
  );
}

export { allTasks };
