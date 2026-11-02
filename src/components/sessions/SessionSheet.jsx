import React from "react";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { PitchView, hasBoard } from "./PitchBoard";
import {
  allTasks, blockInfo, contentBlock, contentName, fmtMin, hasText, isBlankTask, phasesLabel, seriesLabel, sessionTypeInfo, sessionTypeName,
  staffRolesText, stageInfo, taskMinutes,
} from "@/lib/sessionPlan";
import { fullDate, playerFullName, posShort, sortRoster } from "./sessionHelpers";
import { areaFor, attendanceOf } from "./sessionAttendance";

// Hoja de la sesión (A4 vertical; rediseño del 02/11/2026 aprobado por Nacho con la maqueta).
// Cabecera con escudo y equipo, objetivos, jugadores (disponibilidad y área del PDI), parte inicial y cada tarea de la
// parte principal en su propio bloque con el dibujo a la derecha. Cada bloque lleva data-pdf-block: el PDF corta las páginas
// entre bloques. Todo en milímetros y puntos para que se vea igual en pantalla y en papel. Siempre en español.

const GRANATE = "#73000A";
const DARK = "#36000D";
const DISPLAY = "var(--font-display), 'Racing Sarria', Arial, sans-serif";
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lines = (s) => String(s || "").split("\n").map((x) => x.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean);

const Label = ({ children }) => (
  <div style={{ fontFamily: DISPLAY, fontSize: "7.4pt", fontWeight: 800, color: GRANATE, textTransform: "uppercase", marginTop: "1.8mm", marginBottom: "0.4mm", letterSpacing: "0.03em" }}>{children}</div>
);

function Bullets({ text }) {
  const rows = lines(text);
  if (!rows.length) return null;
  return <div>{rows.map((r, i) => <div key={i} style={{ display: "flex", gap: "1.2mm", lineHeight: 1.3 }}><span style={{ flex: "none" }}>•</span><span>{r}</span></div>)}</div>;
}

const Band = ({ title, minutes }) => (
  <div style={{ background: DARK, color: "#fff", fontFamily: DISPLAY, fontWeight: 800, display: "flex", padding: "1.3mm 2.4mm", fontSize: "8.6pt", textTransform: "uppercase", letterSpacing: "0.03em" }}>
    <span style={{ flex: 1 }}>{title}</span><span>{minutes}</span>
  </div>
);

function taskMeta(task) {
  const m = taskMinutes(task);
  const sl = seriesLabel(task);
  const rec = Number(String(task.rec_min || "").replace(",", ".")) || 0;
  return [sl && `${sl}${rec ? ` · rec. ${String(rec).replace(".", ",")}’` : ""}`, m ? `${fmtMin(m)}` : "", task.space, /^\d+$/.test(String(task.players_n || "").trim()) ? `${task.players_n} jugadores` : task.players_n, task.material]
    .filter((x) => hasText(x)).join(" · ");
}

function Contents({ task }) {
  const p = task.principal || [], s = task.secondary || [];
  if (!p.length && !s.length) return null;
  const chip = (id, kind) => {
    const b = blockInfo(contentBlock(id, task));
    return (
      <span key={id} style={{ display: "inline-block", borderRadius: "3mm", padding: "0 1.8mm", lineHeight: "4.2mm", marginRight: "1mm", marginBottom: "0.8mm", fontSize: "6.8pt", fontWeight: 600, background: kind === "P" ? "#FBEDEE" : "#F2EFEF", color: kind === "P" ? GRANATE : "#3A2E30", whiteSpace: "nowrap" }}>
        <span style={{ width: "1.6mm", height: "1.6mm", borderRadius: "50%", background: b?.color || "#999", display: "inline-block", marginRight: "1mm", verticalAlign: "middle", position: "relative", top: "-0.2mm" }} />
        {contentName(id, task)} ({kind})
      </span>
    );
  };
  return (<><Label>Contenidos</Label><div>{p.map((id) => chip(id, "P"))}{s.map((id) => chip(id, "S"))}</div></>);
}

function TaskText({ task, compact = false }) {
  const phases = phasesLabel(task.phases);
  const staff = staffRolesText(task.staff_roles || []);
  return (
    <>
      <Bullets text={task.description} />
      {(hasText(task.objective) || phases) && (
        <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: "0 3mm" }}>
          {hasText(task.objective) && <div><Label>Objetivo</Label><div style={{ lineHeight: 1.3 }}>{task.objective}</div></div>}
          {phases && <div><Label>Fase del juego</Label><div style={{ lineHeight: 1.3 }}>{phases}</div></div>}
        </div>
      )}
      <Contents task={task} />
      {hasText(task.corrections) && (<><Label>Correcciones</Label><Bullets text={task.corrections} /></>)}
      {(hasText(staff) || hasText(task.staff_corrections)) && (
        <>
          <Label>Cuerpo técnico</Label>
          {[...lines(staff), ...lines(task.staff_corrections)].map((r, i) => {
            const k = r.indexOf(":");
            return <div key={i} style={{ lineHeight: 1.3 }}>{k > 0 && k < 40 ? <><b>{r.slice(0, k + 1)}</b>{r.slice(k + 1)}</> : r}</div>;
          })}
        </>
      )}
      {hasText(task.scoring) && (<><Label>Puntuación</Label><div style={{ color: "#B91C1C", lineHeight: 1.3 }}>{lines(task.scoring).map((r, i) => <div key={i}>{r}</div>)}</div></>)}
    </>
  );
}

// Dibujo de la tarea: el de la pizarra o, si no hay, la imagen que venía de la biblioteca
const hasDrawing = (t) => hasBoard(t.board) || Boolean(t.diagram_url);
function Drawing({ task, maxH }) {
  if (hasBoard(task.board)) return <PitchView board={task.board} print style={{ width: "100%", maxHeight: maxH }} />;
  return <img src={task.diagram_url} alt="" crossOrigin="anonymous" style={{ width: "100%", maxHeight: maxH, objectFit: "contain" }} />;
}

const Teams = ({ task }) => (hasText(task.teams_text)
  ? <div style={{ marginTop: "1mm", lineHeight: 1.3 }}><b style={{ fontFamily: DISPLAY, color: GRANATE, textTransform: "uppercase", fontSize: "7.2pt" }}>Equipos: </b>{lines(task.teams_text).join(" · ")}</div>
  : null);

function TaskTitle({ n, task, size = "9.6pt" }) {
  const meta = taskMeta(task);
  return (
    <div style={{ marginBottom: "1mm" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, color: GRANATE, fontSize: size, textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1.15 }}>{n} · {task.title || "Tarea"}</div>
      {meta && <div style={{ fontWeight: 600, marginTop: "0.4mm", color: "#3A2E30" }}>{meta}</div>}
    </div>
  );
}

function MainTask({ task, n }) {
  const draw = hasDrawing(task);
  return (
    <div data-pdf-block style={{ border: "0.3mm solid #E6DEDD", borderRadius: "1.5mm", marginTop: "2.5mm", overflow: "hidden", breakInside: "avoid" }}>
      <div style={{ display: "grid", gridTemplateColumns: draw ? "minmax(0,1fr) 78mm" : "1fr", gap: "3mm", padding: "2.4mm" }}>
        <div style={{ minWidth: 0 }}>
          <TaskTitle n={n} task={task} />
          <TaskText task={task} />
          {!draw && <Teams task={task} />}
        </div>
        {draw && (
          <div style={{ minWidth: 0 }}>
            <div style={{ borderRadius: "1.2mm", overflow: "hidden", background: "#EEF3EE" }}><Drawing task={task} maxH="96mm" /></div>
            <Teams task={task} />
          </div>
        )}
      </div>
    </div>
  );
}

const ST_TEXT = { si: ["Sí", "#15803D"], ad: ["Al margen", "#B45309"], no: ["No", "#C81E1E"] };

export default function SessionSheet({ session, team, players = [], matchRef, pdiGoals = [], ownerName = "" }) {
  const type = sessionTypeInfo(session.session_type);
  const initial = (session.initial?.tasks || []).filter((t) => !isBlankTask(t));
  const main = (session.main?.tasks || []).filter((t) => !isBlankTask(t));
  const sum = (ts) => ts.reduce((s, t) => s + taskMinutes(t), 0);
  const roster = sortRoster(players);
  const att = session.attendance || {};
  const showAtt = roster.length > 0 && session.show_attendance !== false;
  const match = session.match_ref || matchRef || "";
  const stage = stageInfo(session.stage);
  const eff = roster.map((p) => attendanceOf(p, att[p.id]));
  const available = eff.filter((a) => a.st !== "no").length;

  const rowGrid = { display: "grid", gridTemplateColumns: initial.length ? "8mm 5.5mm minmax(0,1fr) 19mm minmax(0,0.9fr)" : "9mm 6mm minmax(0,1fr) 26mm minmax(0,1.1fr)", gap: "0 1.5mm", padding: "0.7mm 1.2mm", fontSize: "6.8pt", lineHeight: "3.3mm", alignItems: "start" };
  const hk = { fontFamily: DISPLAY, fontWeight: 800, color: GRANATE, textTransform: "uppercase", fontSize: "7.4pt", letterSpacing: "0.03em" };

  const initialBox = initial.length > 0 && (
    <div data-pdf-block={showAtt ? undefined : ""} style={{ border: "0.3mm solid #E6DEDD", borderRadius: "1.5mm", overflow: "hidden" }}>
      <Band title="Parte inicial" minutes={fmtMin(sum(initial))} />
      <div style={{ padding: "2mm 2.4mm" }}>
        {initial.map((t, i) => (
          <div key={t.id} style={{ marginTop: i ? "2.5mm" : 0 }}>
            <TaskTitle n={i + 1} task={t} size="8.8pt" />
            <TaskText task={t} compact />
            {hasDrawing(t) && <div style={{ marginTop: "1.5mm", borderRadius: "1.2mm", overflow: "hidden", background: "#EEF3EE" }}><Drawing task={t} maxH="62mm" /></div>}
            <Teams task={t} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="session-sheet" style={{ width: "194mm", background: "#fff", color: "#1F1416", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "7.6pt", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", boxSizing: "border-box" }}>
      {/* Cabecera */}
      <div data-pdf-block style={{ display: "flex", gap: "3mm", alignItems: "stretch" }}>
        <div style={{ width: "16mm", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={CLUB_LOGO_URL} alt="" crossOrigin="anonymous" style={{ width: "15mm", height: "auto" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.6mm" }}>
          <div style={{ ...hk, color: "#6B5E60", fontSize: "7.6pt" }}>Racing Sarrià · Sesión de entrenamiento</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 800, color: GRANATE, fontSize: "19pt", lineHeight: 1, textTransform: "uppercase" }}>{team?.name || "Equipo"}</div>
          <div style={{ color: "#3A2E30" }}>{[ownerName && `Entrenador: ${ownerName}`, stage?.label].filter(Boolean).join(" · ")}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.8mm 3mm", alignContent: "center", background: "#F7F3F3", borderRadius: "1.5mm", padding: "2mm 3mm", maxWidth: "92mm" }}>
          <span style={hk}>Fecha</span><span style={{ fontWeight: 700 }}>{cap(fullDate(session.date))}</span>
          <span style={hk}>Tipo</span>
          <span>{type ? <span style={{ display: "inline-block", background: type.color, color: "#fff", borderRadius: "1mm", padding: "0 1.6mm", lineHeight: "4mm", fontWeight: 700, fontSize: "7pt", textTransform: "uppercase" }}>{sessionTypeName(type)}</span> : "—"}</span>
          <span style={hk}>Duración</span><span style={{ fontWeight: 700 }}>{session.duration || 90}’{initial.length + main.length ? ` (${fmtMin(sum(initial) + sum(main))} de tareas)` : ""}</span>
          {hasText(match) && <><span style={hk}>Partido</span><span style={{ fontWeight: 700 }}>{match}</span></>}
        </div>
      </div>

      {(hasText(session.obj_atk) || hasText(session.obj_def)) && (
        <div data-pdf-block style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5mm", marginTop: "2.5mm" }}>
          {[["Objetivos ofensivos", session.obj_atk], ["Objetivos defensivos", session.obj_def]].map(([k, v]) => (
            <div key={k} style={{ border: "0.3mm solid #E6DEDD", borderRadius: "1.5mm", padding: "1.6mm 2.4mm" }}>
              <div style={hk}>{k}</div>
              <div style={{ lineHeight: 1.35, marginTop: "0.5mm", whiteSpace: "pre-line" }}>{v || "—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Jugadores + parte inicial */}
      {showAtt ? (
        <div data-pdf-block style={{ display: "grid", gridTemplateColumns: initial.length ? "minmax(0,1.2fr) minmax(0,1fr)" : "1fr", gap: "2.5mm", marginTop: "2.5mm", alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
            {/* Rejilla en vez de <table>: html2canvas coloca mal el texto de las celdas de una tabla */}
            <div style={{ ...rowGrid, background: DARK, color: "#fff", fontFamily: DISPLAY, fontWeight: 700, fontSize: "6.8pt", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              <span>Pos</span><span>Nº</span><span>Jugador</span><span>Disponible</span><span>Área PDI</span>
            </div>
            {roster.map((p, i) => {
              const a = eff[i];
              const st = ST_TEXT[a.st];
              return (
                <div key={p.id} style={{ ...rowGrid, borderBottom: "0.2mm solid #EFE6E6" }}>
                  <span style={{ fontWeight: 700, color: GRANATE }}>{posShort(p.position)}</span>
                  <span>{p.jersey_number ?? ""}</span>
                  <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{playerFullName(p)}</span>
                  <span style={{ color: st?.[1] || "#9A8C8E", fontWeight: a.st && a.st !== "si" ? 700 : 400 }}>{st ? `${st[0]}${a.st !== "si" && a.obs ? ` · ${a.obs}` : ""}` : ""}</span>
                  <span>{a.st === "no" ? "—" : areaFor(p, att[p.id], pdiGoals)}</span>
                </div>
              );
            })}
            <div style={{ ...rowGrid, display: "block", color: "#6B5E60" }}>{hasText(session.attendance_others) ? `Otros / a prueba: ${session.attendance_others} · ` : ""}Disponibles {available} de {roster.length}</div>
          </div>
          {initialBox}
        </div>
      ) : initial.length > 0 && <div style={{ marginTop: "2.5mm" }}>{initialBox}</div>}

      {/* Parte principal */}
      {main.length > 0 && (
        <div style={{ marginTop: "2.5mm" }}>
          <div data-pdf-block style={{ borderRadius: "1.5mm", overflow: "hidden" }}><Band title="Parte principal" minutes={fmtMin(sum(main))} /></div>
          {main.map((t, i) => <MainTask key={t.id} task={t} n={i + 1} />)}
        </div>
      )}

      {hasText(session.notes) && (
        <div data-pdf-block style={{ marginTop: "2.5mm", border: "0.3mm solid #E6DEDD", borderRadius: "1.5mm", padding: "1.6mm 2.4mm" }}>
          <span style={hk}>Notas </span><span style={{ whiteSpace: "pre-line" }}>{session.notes}</span>
        </div>
      )}
      <div data-pdf-block style={{ marginTop: "2mm", fontSize: "6pt", color: "#9A8C8E", textAlign: "right" }}>Racing Sarrià · RS Manager</div>
    </div>
  );
}

export { allTasks };
