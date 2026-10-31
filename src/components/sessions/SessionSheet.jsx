import React from "react";
import { CLUB_LOGO_URL } from "@/lib/clubConfig";
import { PitchView, hasBoard } from "./PitchBoard";
import { allTasks, contentName, fmtMin, hasText, isBlankTask, phasesLabel, seriesLabel, sessionTypeInfo, taskMinutes } from "@/lib/sessionPlan";
import { playerShortName, posShort, shortDate, sortRoster } from "./sessionHelpers";

// Ficha de la sesión con el formato de las sesiones del club (A4 vertical). Se usa en la vista previa y al imprimir / guardar PDF.
// Todo en milímetros y puntos para que se vea igual en pantalla y en papel.

const GRANATE = "#73000A";
const DISPLAY = "var(--font-display), 'Racing Sarria', Arial, sans-serif";
const lines = (s) => String(s || "").split("\n").map((x) => x.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean);

const Label = ({ children }) => (
  <div style={{ fontFamily: DISPLAY, fontSize: "7.5pt", fontWeight: 800, textDecoration: "underline", textTransform: "uppercase", marginTop: "2.4mm", marginBottom: "0.6mm", letterSpacing: "0.02em" }}>{children}</div>
);

function Bullets({ text, mark = "•" }) {
  const rows = lines(text);
  if (!rows.length) return null;
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: "1.2mm", lineHeight: 1.28 }}>
          <span style={{ flex: "none" }}>{mark}</span><span>{r}</span>
        </div>
      ))}
    </div>
  );
}

// Cabecera, texto y dibujo de cada tarea van en tres filas de una misma cuadrícula, para que todo quede alineado entre columnas
function taskHead(task) {
  const m = taskMinutes(task);
  const sl = seriesLabel(task);
  return `${(task.title || "Tarea").toUpperCase()}${sl ? ` (${sl})` : ""}${m ? ` [${fmtMin(m)}]` : ""}`;
}

function TaskBody({ task }) {
  const principals = task.principal || [];
  const secondary = task.secondary || [];
  const phases = phasesLabel(task.phases);
  return (
    <>
      <Bullets text={task.description} />
      {hasText(task.objective) && (<><Label>Objetivo</Label><div style={{ lineHeight: 1.28 }}>{task.objective}</div></>)}
      {phases && (<><Label>Momento / fase</Label><div style={{ lineHeight: 1.28 }}>{phases}</div></>)}
      {(principals.length > 0 || secondary.length > 0) && (
        <>
          <Label>Contenidos</Label>
          {principals.map((id, i) => <div key={id} style={{ lineHeight: 1.28 }}>{i + 1}. {contentName(id)}</div>)}
          {secondary.map((id, i) => <div key={id} style={{ lineHeight: 1.28, color: "#555" }}>{principals.length + i + 1}. {contentName(id)} <span style={{ fontSize: "6pt" }}>(sec.)</span></div>)}
        </>
      )}
      {(hasText(task.corrections) || hasText(task.staff_corrections)) && (
        <>
          <Label>Correcciones</Label>
          <Bullets text={task.corrections} mark="©" />
          {hasText(task.staff_corrections) && <div style={{ marginTop: "1.4mm" }}>{lines(task.staff_corrections).map((r, i) => {
            const k = r.indexOf(":");
            return <div key={i} style={{ lineHeight: 1.28 }}>{k > 0 && k < 9 ? <><b>{r.slice(0, k + 1)}</b>{r.slice(k + 1)}</> : r}</div>;
          })}</div>}
        </>
      )}
      {hasText(task.scoring) && (
        <>
          <Label>Puntuación</Label>
          <div style={{ color: "#c8102e", lineHeight: 1.28 }}>{lines(task.scoring).map((r, i) => <div key={i}>{r}</div>)}</div>
        </>
      )}
    </>
  );
}

// Dibujo de la tarea en la ficha: el de la pizarra o, si no hay, la imagen que venía de la biblioteca
const hasDrawing = (t) => hasBoard(t.board) || Boolean(t.diagram_url);
function Drawing({ task, full, half }) {
  if (hasBoard(task.board)) return <PitchView board={task.board} print style={{ width: "100%", maxHeight: task.board.field === "full" ? full : half }} />;
  return <img src={task.diagram_url} alt="" style={{ width: "100%", maxHeight: full, objectFit: "contain" }} />;
}

function MainTasks({ tasks }) {
  const cols = Math.max(1, Math.min(tasks.length, 4));
  const anyBoard = tasks.some(hasDrawing);
  const line = (i) => (i === 0 ? "none" : "0.3mm solid #cbb");
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {tasks.map((t, i) => (
        <div key={`h${t.id}`} style={{ gridColumn: i + 1, gridRow: 1, borderLeft: line(i), fontFamily: DISPLAY, color: GRANATE, fontWeight: 800, fontSize: "8.4pt", textAlign: "center", padding: "1.6mm 1.5mm", borderBottom: "0.3mm solid #d8c4c8", background: "#fff" }}>{taskHead(t)}</div>
      ))}
      {tasks.map((t, i) => (
        <div key={`b${t.id}`} style={{ gridColumn: i + 1, gridRow: 2, borderLeft: line(i), padding: "1.6mm 2mm 2mm", background: "#f6f2f2", minWidth: 0 }}><TaskBody task={t} /></div>
      ))}
      {anyBoard && tasks.map((t, i) => (
        <div key={`d${t.id}`} style={{ gridColumn: i + 1, gridRow: 3, borderLeft: line(i), borderTop: "0.3mm solid #d8c4c8", background: "#e9efe9", padding: "1mm", display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0 }}>
          {hasDrawing(t) && <Drawing task={t} full="88mm" half="52mm" />}
        </div>
      ))}
    </div>
  );
}

const ST = { si: ["#22b14c", ""], ad: ["#bde3c3", ""], no: ["#e5322d", ""] };

export default function SessionSheet({ session, team, players = [], matchRef }) {
  const type = sessionTypeInfo(session.session_type);
  const initial = (session.initial?.tasks || []).filter((t) => !isBlankTask(t));
  const main = (session.main?.tasks || []).filter((t) => !isBlankTask(t));
  const initialMin = initial.reduce((s, t) => s + taskMinutes(t), 0);
  const mainMin = main.reduce((s, t) => s + taskMinutes(t), 0);
  const roster = sortRoster(players);
  const att = session.attendance || {};
  const showAtt = roster.length > 0 && session.show_attendance !== false;
  const initialTitle = initial.map((t) => (t.title || "").toUpperCase()).filter(Boolean).join(" + ");
  const initialMins = initial.map((t) => taskMinutes(t)).filter(Boolean);
  const boards = initial.filter(hasDrawing);
  const match = session.match_ref || matchRef || "";

  const cell = { border: "0.2mm solid #e3d9db", padding: "0.5mm 1mm", fontSize: "6.2pt", lineHeight: 1.2, verticalAlign: "middle" };
  const th = { ...cell, background: GRANATE, color: "#fff", fontFamily: DISPLAY, fontWeight: 800, textAlign: "center", fontSize: "6.4pt" };

  return (
    <div style={{ width: "194mm", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "7.4pt", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", boxSizing: "border-box" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", gap: "2mm", alignItems: "stretch" }}>
        <div style={{ width: "17mm", flex: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <img src={CLUB_LOGO_URL} alt="" crossOrigin="anonymous" style={{ width: "15mm", height: "auto" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto auto auto auto auto auto 1fr", alignItems: "center", background: "#f1eded", fontSize: "7.4pt" }}>
            {[["FECHA", shortDate(session.date)], ["SESIÓN", null], ["TIEMPO", `${session.duration || 90}’`], ["PARTIDO", match]].map(([k, v]) => (
              <React.Fragment key={k}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, padding: "1.6mm 2.4mm", color: GRANATE }}>{k}</div>
                {k === "SESIÓN" ? (
                  <div style={{ background: type?.color || "#9ca3af", color: "#fff", fontFamily: DISPLAY, fontWeight: 800, padding: "1.6mm 7mm", textTransform: "uppercase", letterSpacing: "0.04em" }}>{type?.label || "—"}</div>
                ) : (
                  <div style={{ padding: "1.6mm 2.4mm", ...(k === "PARTIDO" ? { gridColumn: "span 1" } : {}) }}>{v}</div>
                )}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "20mm 1fr", marginTop: "1.2mm", background: "#f7f4f4", alignItems: "center" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, color: GRANATE, fontSize: "7.4pt", gridRow: "span 2", padding: "0 2mm" }}>OBJETIVOS</div>
            <div style={{ display: "grid", gridTemplateColumns: "8mm 1fr", borderBottom: "0.2mm solid #e3d9db", padding: "1mm 1mm" }}><b style={{ fontFamily: DISPLAY, color: GRANATE }}>ATQ</b><span>{session.obj_atk}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "8mm 1fr", padding: "1mm 1mm" }}><b style={{ fontFamily: DISPLAY, color: GRANATE }}>DEF</b><span>{session.obj_def}</span></div>
          </div>
        </div>
      </div>
      {team?.name && <div style={{ fontFamily: DISPLAY, fontSize: "7pt", color: "#666", margin: "1mm 0 0 19mm" }}>{team.name}</div>}

      {/* Asistencia + parte inicial */}
      <div style={{ display: "grid", gridTemplateColumns: showAtt ? "1fr 58mm" : "1fr", gap: "2.5mm", marginTop: "2.5mm", alignItems: "start" }}>
        {showAtt && (
          <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
            <colgroup><col style={{ width: "7mm" }} /><col style={{ width: "15mm" }} /><col style={{ width: "5mm" }} /><col style={{ width: "5mm" }} /><col style={{ width: "5mm" }} /><col style={{ width: "17mm" }} /><col /></colgroup>
            <thead>
              <tr><th colSpan={7} style={{ ...th, fontSize: "7.4pt", padding: "1mm" }}>ASISTENCIA</th></tr>
              <tr>
                <th style={{ ...th, width: "7mm", background: "#fff", color: "#111", borderColor: "#e3d9db" }}>POS</th>
                <th style={{ ...th, width: "13mm", background: "#fff", color: "#111", borderColor: "#e3d9db" }}>JUGADOR</th>
                <th style={{ ...th, width: "4.5mm", background: "#22b14c" }}>SI</th>
                <th style={{ ...th, width: "4.5mm", background: "#bde3c3", color: "#111" }}>AD</th>
                <th style={{ ...th, width: "4.5mm", background: "#e5322d" }}>NO</th>
                <th style={{ ...th, width: "16mm", background: "#fff", color: "#111", borderColor: "#e3d9db" }}>OBSERV.</th>
                <th style={{ ...th, background: "#f1eded", color: "#111", borderColor: "#e3d9db" }}>ÁREAS DE DESARROLLO</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => {
                const a = att[p.id] || {};
                return (
                  <tr key={p.id}>
                    <td style={{ ...cell, fontWeight: 700, color: GRANATE }}>{posShort(p.position)}</td>
                    <td style={{ ...cell, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{playerShortName(p)}</td>
                    {["si", "ad", "no"].map((k) => <td key={k} style={{ ...cell, background: a.st === k ? ST[k][0] : "#fff" }} />)}
                    <td style={cell}>{a.obs}</td>
                    <td style={cell}>{a.areas}</td>
                  </tr>
                );
              })}
              {hasText(session.attendance_others) && (
                <tr><td colSpan={2} style={{ ...cell, fontWeight: 700, color: GRANATE }}>OTROS J/PRUEBAS</td><td colSpan={5} style={cell}>{session.attendance_others}</td></tr>
              )}
            </tbody>
          </table>
        )}

        <div style={{ border: "0.3mm solid #d8c4c8" }}>
          <div style={{ background: GRANATE, color: "#fff", fontFamily: DISPLAY, fontWeight: 800, textAlign: "center", padding: "1.6mm", fontSize: "8pt" }}>PARTE INICIAL [{fmtMin(initialMin)}]</div>
          {(initialTitle || initialMins.length > 0) && (
            <div style={{ fontFamily: DISPLAY, color: GRANATE, fontWeight: 800, textAlign: "center", padding: "1.6mm 1mm", fontSize: "7.6pt", borderBottom: "0.3mm solid #d8c4c8" }}>
              {initialTitle}{initialMins.length > 0 && ` (${initialMins.map((m) => fmtMin(m)).join(" + ")})`}
            </div>
          )}
          <div style={{ padding: "1.4mm 2mm", background: "#f6f2f2" }}>
            {initial.map((t) => (
              <div key={t.id} style={{ marginBottom: "1.2mm" }}>
                {hasText(t.description) ? <Bullets text={t.description} /> : t.title ? <div>• {t.title}{taskMinutes(t) ? ` (${fmtMin(taskMinutes(t))})` : ""}</div> : null}
                {(t.principal || []).length > 0 && <div style={{ color: "#555", fontSize: "6.4pt", lineHeight: 1.25 }}>Contenidos: {t.principal.map(contentName).join(", ")}{(t.secondary || []).length > 0 ? ` · sec.: ${t.secondary.map(contentName).join(", ")}` : ""}</div>}
                {hasText(t.corrections) && <div style={{ fontSize: "6.4pt", lineHeight: 1.25 }}>© {lines(t.corrections).join(" · ")}</div>}
              </div>
            ))}
          </div>
          {boards.map((t) => (
            <div key={t.id} style={{ borderTop: "0.3mm solid #d8c4c8", background: "#e9efe9", padding: "1mm", display: "flex", justifyContent: "center" }}>
              <Drawing task={t} full="60mm" half="40mm" />
            </div>
          ))}
        </div>
      </div>

      {/* Parte principal */}
      {main.length > 0 && (
        <div data-avoid-break style={{ marginTop: "2.5mm", border: "0.3mm solid #d8c4c8" }}>
          <div style={{ background: GRANATE, color: "#fff", fontFamily: DISPLAY, fontWeight: 800, textAlign: "center", padding: "1.6mm", fontSize: "8pt" }}>PARTE PRINCIPAL [{fmtMin(mainMin)}]</div>
          <MainTasks tasks={main.slice(0, 4)} />
        </div>
      )}

      {hasText(session.notes) && (
        <div style={{ marginTop: "2.5mm", border: "0.3mm solid #e3d9db", padding: "1.5mm 2mm" }}>
          <b style={{ fontFamily: DISPLAY, color: GRANATE }}>NOTAS</b> <span style={{ whiteSpace: "pre-line" }}>{session.notes}</span>
        </div>
      )}
      <div style={{ marginTop: "2mm", fontSize: "5.6pt", color: "#999", textAlign: "right" }}>Racing Sarrià · RS Manager</div>
    </div>
  );
}

export { allTasks };
