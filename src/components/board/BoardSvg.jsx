import React from "react";
import { arrowHeading, arrowPoints, byRank, fieldOf, lookOf, toView, viewBox, wavyPoints } from "@/lib/board";

// Dibujo (solo pintar, sin interacción) de un fotograma sobre el campo, con tres modos visuales:
//  · blanco  → campo blanco con líneas grises finas y color solo en fichas y flechas (poca tinta al imprimir)
//  · color   → campo verde con franjas
//  · bn      → todo en negro sobre blanco; los equipos se distinguen por el relleno, las flechas por el trazo

export const TEAM_COLORS = { a: "#73000A", b: "#2563eb", c: "#f59e0b", gk: "#16a34a", n: "#374151" };

const STYLE = {
  blanco: {
    bg: "#ffffff", line: "#9ca3af", lineW: 0.32, ink: "#111827",
    arrows: { move: "#111827", pass: "#2563eb", dribble: "#73000A" },
    zoneFill: "rgba(37,99,235,0.08)", zoneLine: "#6b7280",
    label: { fill: "#111827", stroke: "#ffffff" }, textFill: "#111827", textStroke: "#ffffff",
    goal: { fill: "#f3f4f6", stroke: "#6b7280" }, cone: { fill: "#f97316", stroke: "#ffffff" }, ball: { fill: "#ffffff", stroke: "#111827" },
  },
  color: {
    bg: "#3f8a4a", stripe: "rgba(255,255,255,0.045)", line: "rgba(255,255,255,0.92)", lineW: 0.35, ink: "#111827",
    arrows: { move: "#ffffff", pass: "#fde047", dribble: "#fb923c" },
    zoneFill: "rgba(255,255,255,0.10)", zoneLine: "#ffffff",
    label: { fill: "#ffffff", stroke: "#000000" }, textFill: "#ffffff", textStroke: "#000000",
    goal: { fill: "rgba(255,255,255,0.35)", stroke: "#ffffff" }, cone: { fill: "#f97316", stroke: "#ffffff" }, ball: { fill: "#ffffff", stroke: "#111827" },
  },
  bn: {
    bg: "#ffffff", line: "#111111", lineW: 0.3, ink: "#111111",
    arrows: { move: "#111111", pass: "#111111", dribble: "#111111" },
    zoneFill: "url(#bn-hatch)", zoneLine: "#111111",
    label: { fill: "#111111", stroke: "#ffffff" }, textFill: "#111111", textStroke: "#ffffff",
    goal: { fill: "#ffffff", stroke: "#111111" }, cone: { fill: "#9ca3af", stroke: "#111111" }, ball: { fill: "#ffffff", stroke: "#111111" },
  },
};
export const styleOf = (look) => STYLE[lookOf(look)];

const BN_TEAM = {
  a: { fill: "#111111", stroke: "#111111" },
  b: { fill: "#ffffff", stroke: "#111111" },
  c: { fill: "#9ca3af", stroke: "#111111" },
  gk: { fill: "url(#bn-stripes)", stroke: "#111111" },
  n: { fill: "#e5e7eb", stroke: "#111111" },
};
const tokenPaint = (look, team) => {
  if (look === "bn") return BN_TEAM[team] || BN_TEAM.a;
  return { fill: TEAM_COLORS[team] || TEAM_COLORS.a, stroke: look === "color" ? "#ffffff" : "#111827" };
};

// Líneas del campo (medidas reglamentarias de fútbol 11; fútbol 7 en proporción)
function Lines({ field, s }) {
  const { w, h } = field;
  const p = { fill: "none", stroke: s.line, strokeWidth: s.lineW };
  if (field.id === "free") return <rect x={0} y={0} width={w} height={h} {...p} strokeDasharray="1.2 1.2" />;
  const k = field.id === "f7" ? 0.72 : 1;
  const aw = 40.3 * k, ah = 16.5 * k, gw = 18.32 * k, gh = 5.5 * k, goalW = 7.32 * k, spot = 11 * k, arcR = 9.15 * k;
  const arcX = Math.sqrt(Math.max(arcR ** 2 - (ah - spot) ** 2, 0));
  const half = field.id === "half";
  const goal = (
    <g {...p}>
      <rect x={w / 2 - aw / 2} y={0} width={aw} height={ah} />
      <rect x={w / 2 - gw / 2} y={0} width={gw} height={gh} />
      <path d={`M ${w / 2 - arcX} ${ah} A ${arcR} ${arcR} 0 0 0 ${w / 2 + arcX} ${ah}`} />
      <rect x={w / 2 - goalW / 2} y={-1.8} width={goalW} height={1.8} />
      <circle cx={w / 2} cy={spot} r={0.4} fill={s.line} stroke="none" />
    </g>
  );
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} {...p} />
      {goal}
      {half ? (
        <path d={`M ${w / 2 - 9.15} ${h} A 9.15 9.15 0 0 1 ${w / 2 + 9.15} ${h}`} {...p} />
      ) : (
        <>
          <g transform={`rotate(180 ${w / 2} ${h / 2})`}>{goal}</g>
          <line x1={0} y1={h / 2} x2={w} y2={h / 2} {...p} />
          <circle cx={w / 2} cy={h / 2} r={arcR} {...p} />
          <circle cx={w / 2} cy={h / 2} r={0.4} fill={s.line} stroke="none" />
        </>
      )}
    </g>
  );
}

function Field({ field, orient, look, vb }) {
  const s = styleOf(look);
  const turn = orient === "h" ? `translate(0 ${field.w}) rotate(-90)` : undefined;
  const bands = [];
  if (s.stripe) for (let y = 0; y < field.h; y += 14) bands.push(<rect key={y} x={0} y={y} width={field.w} height={Math.min(7, field.h - y)} fill={s.stripe} />);
  return (
    <>
      <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill={s.bg} />
      <g transform={turn}>
        {bands}
        <Lines field={field} s={s} />
      </g>
    </>
  );
}

const pathOf = (pts) => pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

function Arrow({ el, field, orient, look, selected, handles }) {
  const s = styleOf(look);
  const col = s.arrows[el.style] || s.arrows.move;
  const raw = arrowPoints(el);
  const head = arrowHeading(el);
  // la línea se acorta para que no sobresalga por la punta
  const trim = el.pointer === "none" ? 0 : el.pointer === "bar" ? 0.4 : 1.6;
  const line = raw.map((p, i) => (i === raw.length - 1 ? { x: p.x - head.ux * trim, y: p.y - head.uy * trim } : p));
  const shaped = el.style === "dribble" ? wavyPoints(line) : line;
  const v = shaped.map((p) => toView(field, orient, p));
  const end = toView(field, orient, { x: el.x2, y: el.y2 });
  const dirEnd = toView(field, orient, { x: el.x2 - head.ux, y: el.y2 - head.uy });
  const ux = end.x - dirEnd.x, uy = end.y - dirEnd.y;
  const hx = end.x, hy = end.y;
  const headPts = `${hx},${hy} ${hx - ux * 2.4 - uy * 1.2},${hy - uy * 2.4 + ux * 1.2} ${hx - ux * 2.4 + uy * 1.2},${hy - uy * 2.4 - ux * 1.2}`;
  const barPts = `${hx - uy * 1.6},${hy + ux * 1.6} ${hx + uy * 1.6},${hy - ux * 1.6}`;
  const c1 = toView(field, orient, { x: el.x1, y: el.y1 });
  const c2 = end;
  const ctrl = el.cx != null ? toView(field, orient, { x: el.cx, y: el.cy }) : null;
  return (
    <g opacity={el.opacity ?? 1}>
      {selected && <path d={pathOf(v)} fill="none" stroke="#f59e0b" strokeWidth={2} opacity={0.5} strokeLinecap="round" />}
      <path d={pathOf(v)} fill="none" stroke={col} strokeWidth={0.55} strokeDasharray={el.style === "pass" ? "1.6 1.1" : undefined} strokeLinecap="round" strokeLinejoin="round" />
      {el.pointer === "none" ? null : el.pointer === "bar" ? <polyline points={barPts} stroke={col} strokeWidth={0.7} fill="none" strokeLinecap="round" /> : <polygon points={headPts} fill={col} />}
      {selected && handles && (
        <g>
          {ctrl && <line x1={c1.x} y1={c1.y} x2={ctrl.x} y2={ctrl.y} stroke="#f59e0b" strokeWidth={0.2} strokeDasharray="0.8 0.6" />}
          {ctrl && <line x1={c2.x} y1={c2.y} x2={ctrl.x} y2={ctrl.y} stroke="#f59e0b" strokeWidth={0.2} strokeDasharray="0.8 0.6" />}
          <circle data-h="p1" cx={c1.x} cy={c1.y} r={1.5} fill="#fff" stroke="#f59e0b" strokeWidth={0.5} />
          <circle data-h="p2" cx={c2.x} cy={c2.y} r={1.5} fill="#fff" stroke="#f59e0b" strokeWidth={0.5} />
          {ctrl && <circle data-h="c" cx={ctrl.x} cy={ctrl.y} r={1.5} fill="#f59e0b" stroke="#fff" strokeWidth={0.4} />}
        </g>
      )}
    </g>
  );
}

function Piece({ el, field, orient, look, selected, ghost = false }) {
  const s = styleOf(look);
  const c = toView(field, orient, el);
  const op = (el.opacity ?? 1) * (ghost ? 0.3 : 1);
  const ring = (r) => selected && !ghost && <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />;
  switch (el.k) {
    case "token": {
      const paint = tokenPaint(look, el.team);
      return (
        <g opacity={op}>
          {ring(3.6)}
          <circle cx={c.x} cy={c.y} r={2.3} fill={paint.fill} stroke={paint.stroke} strokeWidth={look === "bn" ? 0.5 : 0.45} />
          {el.team === "gk" && look !== "bn" && <circle cx={c.x} cy={c.y} r={0.8} fill="#fff" />}
          {el.label && !ghost ? (
            <text x={c.x} y={c.y + 5.4} textAnchor="middle" fontSize={2.7} fontWeight={700} fill={s.label.fill} stroke={s.label.stroke} strokeWidth={0.55} paintOrder="stroke" style={{ fontFamily: "Arial, sans-serif" }}>{el.label}</text>
          ) : null}
        </g>
      );
    }
    case "ball":
      return (
        <g opacity={op}>
          {ring(2.6)}
          <circle cx={c.x} cy={c.y} r={1.25} fill={s.ball.fill} stroke={s.ball.stroke} strokeWidth={0.4} />
          <circle cx={c.x} cy={c.y} r={0.45} fill={s.ball.stroke} />
        </g>
      );
    case "cone":
      return (
        <g opacity={op}>
          {ring(2.6)}
          <polygon points={`${c.x},${c.y - 1.5} ${c.x + 1.3},${c.y + 1.1} ${c.x - 1.3},${c.y + 1.1}`} fill={s.cone.fill} stroke={s.cone.stroke} strokeWidth={0.3} />
        </g>
      );
    case "goal": {
      const wide = orient === "h" ? { w: 1.8, h: 6 } : { w: 6, h: 1.8 };
      return (
        <g opacity={op}>
          {selected && !ghost && <rect x={c.x - wide.w / 2 - 1.2} y={c.y - wide.h / 2 - 1.1} width={wide.w + 2.4} height={wide.h + 2.2} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />}
          <rect x={c.x - wide.w / 2} y={c.y - wide.h / 2} width={wide.w} height={wide.h} fill={s.goal.fill} stroke={s.goal.stroke} strokeWidth={0.45} />
        </g>
      );
    }
    default: return null;
  }
}

function Zone({ el, field, orient, look, selected }) {
  const s = styleOf(look);
  const a = toView(field, orient, { x: el.x, y: el.y });
  const b = toView(field, orient, { x: el.x + el.w, y: el.y + el.h });
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
  const common = { fill: s.zoneFill, stroke: selected ? "#f59e0b" : s.zoneLine, strokeWidth: 0.45, strokeDasharray: "1.6 1.2", opacity: el.opacity ?? 1 };
  return el.shape === "ellipse" ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} /> : <rect x={x} y={y} width={w} height={h} {...common} />;
}

function Text({ el, field, orient, look }) {
  const s = styleOf(look);
  const c = toView(field, orient, el);
  return (
    <text x={c.x} y={c.y} fontSize={3} fontWeight={700} fill={s.textFill} stroke={s.textStroke} strokeWidth={0.5} paintOrder="stroke" textAnchor="middle" opacity={el.opacity ?? 1} style={{ fontFamily: "Arial, sans-serif" }}>{el.text}</text>
  );
}

export function Item({ el, field, orient, look, selected = false, handles = false }) {
  if (el.k === "arrow") return <Arrow el={el} field={field} orient={orient} look={look} selected={selected} handles={handles} />;
  if (el.k === "zone") return <Zone el={el} field={field} orient={orient} look={look} selected={selected} />;
  if (el.k === "text") return <Text el={el} field={field} orient={orient} look={look} />;
  return <Piece el={el} field={field} orient={orient} look={look} selected={selected} />;
}

/**
 * board   { field, look, orient }  (de normalizeBoard)
 * els     elementos a pintar (un fotograma, o el intermedio de la animación)
 * ghosts  [{ k, team, from, to }] posición anterior de lo que se ha movido (rastro)
 * draft   flecha o zona que se está dibujando
 */
const Board = React.forwardRef(function Board({ board, els, selId = null, ghosts = [], draft = null, handles = false, className = "", style, label = "Dibujo", ...rest }, ref) {
  const field = fieldOf(board.field);
  const orient = board.orient === "h" ? "h" : "v";
  const look = lookOf(board.look);
  const vb = viewBox(field, orient);
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={vb.join(" ")} className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} {...rest}>
      <defs>
        <pattern id="bn-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#111" strokeWidth="0.3" /></pattern>
        <pattern id="bn-stripes" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#fff" /><rect width="0.8" height="1.6" fill="#111" /></pattern>
      </defs>
      <Field field={field} orient={orient} look={look} vb={vb} />
      {ghosts.map((g) => {
        const a = toView(field, orient, g.from), b = toView(field, orient, g.to);
        return (
          <g key={`g${g.id}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={styleOf(look).ink} strokeWidth={0.3} strokeDasharray="0.9 0.9" opacity={0.45} />
            <Piece el={{ k: g.k, team: g.team, x: g.from.x, y: g.from.y }} field={field} orient={orient} look={look} ghost />
          </g>
        );
      })}
      {[...els].sort(byRank).map((el) => <Item key={el.id} el={el} field={field} orient={orient} look={look} selected={el.id === selId} handles={handles} />)}
      {draft && <Item el={{ id: "draft", ...draft }} field={field} orient={orient} look={look} selected />}
    </svg>
  );
});
export default Board;
