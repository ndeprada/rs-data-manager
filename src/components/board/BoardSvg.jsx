import React from "react";
import {
  arrowFlight, arrowPoints, arrowProps, byRank, chipOf, dashArray, fieldOf, fontOf, lookOf, toView, tokenColor, tokenR, viewBox, wavyPoints,
} from "@/lib/board";

// Dibujo (solo pintar, sin interacción) de un fotograma sobre el campo, con tres modos visuales:
//  · blanco  → campo blanco con líneas grises finas y color solo en fichas y flechas (poca tinta al imprimir)
//  · color   → campo verde con franjas
//  · bn      → todo en negro sobre blanco; los equipos se distinguen por el relleno, las flechas por el trazo

const STYLE = {
  blanco: {
    bg: "#ffffff", margin: "#f0f2f5", stripe: "#f5f7f9", line: "#aab1bc", lineW: 0.24, ink: "#111827",
    arrows: { move: "#111827", pass: "#2563eb", dribble: "#73000A" },
    zoneFill: "#2563eb", zoneAlpha: 0.08, zoneLine: "#6b7280",
    label: { fill: "#111827", stroke: "#ffffff" }, textFill: "#111827", textStroke: "#ffffff",
    goal: { fill: "#f3f4f6", stroke: "#4b5563" }, cone: "#f97316", coneStroke: "#ffffff", ball: { fill: "#ffffff", stroke: "#111827" }, chipStroke: "#111827",
  },
  color: {
    bg: "#3f8a4a", stripe: "rgba(255,255,255,0.045)", line: "rgba(255,255,255,0.92)", lineW: 0.35, ink: "#111827",
    arrows: { move: "#ffffff", pass: "#fde047", dribble: "#fb923c" },
    zoneFill: "#ffffff", zoneAlpha: 0.1, zoneLine: "#ffffff",
    label: { fill: "#ffffff", stroke: "#000000" }, textFill: "#ffffff", textStroke: "#000000",
    goal: { fill: "rgba(255,255,255,0.35)", stroke: "#ffffff" }, cone: "#f97316", coneStroke: "#ffffff", ball: { fill: "#ffffff", stroke: "#111827" }, chipStroke: "#ffffff",
  },
  bn: {
    bg: "#ffffff", line: "#111111", lineW: 0.3, ink: "#111111",
    arrows: { move: "#111111", pass: "#111111", dribble: "#111111" },
    zoneFill: "url(#bn-hatch)", zoneAlpha: 1, zoneLine: "#111111",
    label: { fill: "#111111", stroke: "#ffffff" }, textFill: "#111111", textStroke: "#ffffff",
    goal: { fill: "#ffffff", stroke: "#111111" }, cone: "#9ca3af", coneStroke: "#111111", ball: { fill: "#ffffff", stroke: "#111111" }, chipStroke: "#111111",
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

// ── Campo ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// Medidas reglamentarias (m). Fútbol 7: Normas Reguladoras de Fútbol 7 de la RFEF (área de penalti 24×9, de meta 12×3,
// punto de penalti a 9, círculo de 6, portería de 6 y línea de fuera de juego a 12 m de la línea de meta; sin arco de área).
const SPEC = {
  f11: { aw: 40.32, ah: 16.5, gw: 18.32, gh: 5.5, goalW: 7.32, spot: 11, circle: 9.15, arc: 9.15, offside: 0 },
  f7: { aw: 24, ah: 9, gw: 12, gh: 3, goalW: 6, spot: 9, circle: 6, arc: 0, offside: 12 },
};

function Lines({ field, s }) {
  const { w, h } = field;
  if (field.id === "free") return null;
  const p = { fill: "none", stroke: s.line, strokeWidth: s.lineW, strokeLinejoin: "round", strokeLinecap: "round" };
  const sp = field.id === "f7" ? SPEC.f7 : SPEC.f11;
  const arcX = sp.arc ? Math.sqrt(Math.max(sp.arc ** 2 - (sp.ah - sp.spot) ** 2, 0)) : 0;
  const end = (
    <g {...p}>
      <rect x={w / 2 - sp.aw / 2} y={0} width={sp.aw} height={sp.ah} />
      <rect x={w / 2 - sp.gw / 2} y={0} width={sp.gw} height={sp.gh} />
      {sp.arc ? <path d={`M ${w / 2 - arcX} ${sp.ah} A ${sp.arc} ${sp.arc} 0 0 0 ${w / 2 + arcX} ${sp.ah}`} /> : null}
      <rect x={w / 2 - sp.goalW / 2} y={-1.8} width={sp.goalW} height={1.8} />
      <path d={`M 0 1 A 1 1 0 0 0 1 0 M ${w - 1} 0 A 1 1 0 0 0 ${w} 1`} />
      <circle cx={w / 2} cy={sp.spot} r={0.35} fill={s.line} stroke="none" />
    </g>
  );
  if (field.id === "half") {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} {...p} />
        {end}
        <path d={`M ${w / 2 - 9.15} ${h} A 9.15 9.15 0 0 1 ${w / 2 + 9.15} ${h}`} {...p} />
      </g>
    );
  }
  // Campo completo, 3/4 (el completo sin el último cuarto) y fútbol 7
  const H = field.id === "tq" ? 105 : h;
  return (
    <g clipPath={field.id === "tq" ? "url(#tq-clip)" : undefined}>
      <rect x={0} y={0} width={w} height={H} {...p} />
      {end}
      <g transform={`rotate(180 ${w / 2} ${H / 2})`}>{end}</g>
      <line x1={0} y1={H / 2} x2={w} y2={H / 2} {...p} />
      <circle cx={w / 2} cy={H / 2} r={sp.circle} {...p} />
      <circle cx={w / 2} cy={H / 2} r={0.35} fill={s.line} stroke="none" />
      {sp.offside ? (
        <g {...p} strokeDasharray="1.4 1.1">
          <line x1={0} y1={sp.offside} x2={w} y2={sp.offside} />
          <line x1={0} y1={H - sp.offside} x2={w} y2={H - sp.offside} />
        </g>
      ) : null}
    </g>
  );
}

function Field({ field, orient, look, vb }) {
  const s = styleOf(look);
  const turn = orient === "h" ? `translate(0 ${field.w}) rotate(-90)` : undefined;
  const bands = [];
  if (s.stripe) for (let y = 0; y < field.h; y += 14) bands.push(<rect key={y} x={0} y={y} width={field.w} height={Math.min(7, field.h - y)} fill={s.stripe} />);
  const free = field.id === "free";
  return (
    <>
      <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill={free ? s.bg : s.margin || s.bg} />
      <g transform={turn}>
        {free ? null : <rect x={0} y={0} width={field.w} height={field.h} fill={s.bg} />}
        {free ? null : bands}
        <Lines field={field} s={s} />
      </g>
    </>
  );
}

// ── Elementos ──────────────────────────────────────────────────────────────────────────────────────────────────────

const pathOf = (pts) => pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

function Arrow({ el, ctx, selected, handles }) {
  const { field, orient, look } = ctx;
  const s = styleOf(look);
  const ap = arrowProps(el);
  const col = look === "bn" ? s.arrows.move : el.color || s.arrows[el.style] || s.arrows.move;
  const w = ap.width;
  const toV = (p) => toView(field, orient, p);
  const flight = arrowFlight(el, orient).map(toV);
  const n = flight.length - 1;
  const dx = flight[n].x - flight[n - 1].x, dy = flight[n].y - flight[n - 1].y;
  const dl = Math.hypot(dx, dy) || 1;
  const ux = dx / dl, uy = dy / dl;
  const headLen = 1.4 + 1.9 * w;
  const trim = ap.pointer === "none" ? 0 : ap.pointer === "bar" ? 0.4 : headLen * 0.7;
  const line = flight.map((p, i) => (i === n ? { x: p.x - ux * trim, y: p.y - uy * trim } : p));
  const d = pathOf(ap.wavy ? wavyPoints(line, 0.3 + w * 0.45, 2.4 + w * 0.6) : line);
  const end = flight[n];
  const hx = end.x, hy = end.y;
  const half = headLen * 0.5;
  const headPts = `${hx},${hy} ${hx - ux * headLen - uy * half},${hy - uy * headLen + ux * half} ${hx - ux * headLen + uy * half},${hy - uy * headLen - ux * half}`;
  const barPts = `${hx - uy * (1 + w * 1.5)},${hy + ux * (1 + w * 1.5)} ${hx + uy * (1 + w * 1.5)},${hy - ux * (1 + w * 1.5)}`;
  const dash = dashArray(ap.dash, w);
  const cap = "round";
  const borderCol = look === "bn" ? "#111111" : el.borderColor || "#111827";
  const ctrl = el.cx != null ? toV({ x: el.cx, y: el.cy }) : null;
  const start = flight[0];
  const ground = el.air ? arrowPoints(el, 24).map(toV) : null;
  const apex = el.air ? flight[12] : null;
  const groundMid = ground ? ground[12] : null;
  return (
    <g opacity={(el.opacity ?? 1) * ap.alpha}>
      {ground && (
        <g>
          <path d={pathOf(ground)} fill="none" stroke="#000" strokeOpacity={0.28} strokeWidth={Math.max(0.35, w * 0.9)} strokeLinecap="round" strokeDasharray="1.2 0.9" />
          <line x1={apex.x} y1={apex.y} x2={groundMid.x} y2={groundMid.y} stroke="#000" strokeOpacity={0.3} strokeWidth={0.2} strokeDasharray="0.6 0.6" />
        </g>
      )}
      {selected && <path d={d} fill="none" stroke="#f59e0b" strokeWidth={w + 1.6} opacity={0.5} strokeLinecap="round" strokeLinejoin="round" />}
      {ap.border && <path d={d} fill="none" stroke={borderCol} strokeWidth={w + 0.7} strokeDasharray={dash} strokeLinecap={cap} strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={col} strokeWidth={w} strokeDasharray={dash} strokeLinecap={cap} strokeLinejoin="round" />
      {ap.pointer === "none" ? null : ap.pointer === "bar" ? (
        <>
          {ap.border && <polyline points={barPts} stroke={borderCol} strokeWidth={w + 0.7} fill="none" strokeLinecap="round" />}
          <polyline points={barPts} stroke={col} strokeWidth={w + 0.15} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <polygon points={headPts} fill={col} stroke={ap.border ? borderCol : "none"} strokeWidth={0.35} strokeLinejoin="round" />
      )}
      {selected && handles && (
        <g>
          {ctrl && <line x1={start.x} y1={start.y} x2={ctrl.x} y2={ctrl.y} stroke="#f59e0b" strokeWidth={0.2} strokeDasharray="0.8 0.6" />}
          {ctrl && <line x1={end.x} y1={end.y} x2={ctrl.x} y2={ctrl.y} stroke="#f59e0b" strokeWidth={0.2} strokeDasharray="0.8 0.6" />}
          <circle cx={start.x} cy={start.y} r={1.3} fill="#fff" stroke="#f59e0b" strokeWidth={0.5} pointerEvents="none" />
          <circle cx={end.x} cy={end.y} r={1.3} fill="#fff" stroke="#f59e0b" strokeWidth={0.5} pointerEvents="none" />
          {ctrl && <circle cx={ctrl.x} cy={ctrl.y} r={1.3} fill="#f59e0b" stroke="#fff" strokeWidth={0.4} pointerEvents="none" />}
          {apex && <circle cx={apex.x} cy={apex.y} r={1.3} fill="#2563eb" stroke="#fff" strokeWidth={0.4} pointerEvents="none" />}
          {/* zonas de toque más grandes que lo que se ve, para poder agarrarlas con el dedo */}
          <circle data-h="p1" cx={start.x} cy={start.y} r={3.2} fill="transparent" />
          <circle data-h="p2" cx={end.x} cy={end.y} r={3.2} fill="transparent" />
          {ctrl && <circle data-h="c" cx={ctrl.x} cy={ctrl.y} r={3.2} fill="transparent" />}
          {apex && <circle data-h="l" cx={apex.x} cy={apex.y} r={3.2} fill="transparent" />}
        </g>
      )}
    </g>
  );
}

function Piece({ el, ctx, selected, ghost = false }) {
  const { board, field, orient, look } = ctx;
  const s = styleOf(look);
  const c = toView(field, orient, el);
  const op = (el.opacity ?? 1) * (ghost ? 0.3 : 1);
  const ring = (r) => selected && !ghost && <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />;
  switch (el.k) {
    case "token": {
      const r = tokenR(ctx.chip, el);
      const bn = look === "bn" ? BN_TEAM[el.team] || BN_TEAM.a : null;
      const fill = bn ? bn.fill : tokenColor(board, el);
      const stroke = bn ? bn.stroke : s.chipStroke;
      const fs = Math.max(1.8, r * 1.25);
      return (
        <g opacity={op}>
          {ring(r + 1.3)}
          <circle cx={c.x} cy={c.y} r={r} fill={fill} stroke={stroke} strokeWidth={Math.max(0.25, r * 0.2)} />
          {el.team === "gk" && !bn && !el.color && <circle cx={c.x} cy={c.y} r={r * 0.35} fill="#fff" />}
          {el.label && !ghost ? (
            <text x={c.x} y={c.y + r + fs * 1.05} textAnchor="middle" fontSize={fs} fontWeight={700} fill={s.label.fill} stroke={s.label.stroke} strokeWidth={0.55} paintOrder="stroke" style={{ fontFamily: "Arial, sans-serif" }}>{el.label}</text>
          ) : null}
        </g>
      );
    }
    case "ball": {
      const r = Math.max(0.7, ctx.chip * 0.55) * (Number(el.size) || 1);
      return (
        <g opacity={op}>
          {ring(r + 1.2)}
          <circle cx={c.x} cy={c.y} r={r} fill={s.ball.fill} stroke={s.ball.stroke} strokeWidth={0.35} />
          <circle cx={c.x} cy={c.y} r={r * 0.36} fill={s.ball.stroke} />
        </g>
      );
    }
    case "cone": {
      const k = Number(el.size) || 1;
      const col = look === "bn" ? s.cone : el.color || s.cone;
      return (
        <g opacity={op}>
          {ring(2.4 * k)}
          {el.shape === "flat" ? (
            <circle cx={c.x} cy={c.y} r={0.9 * k} fill={col} stroke={s.coneStroke} strokeWidth={0.3} />
          ) : (
            <polygon points={`${c.x},${c.y - 1.5 * k} ${c.x + 1.3 * k},${c.y + 1.1 * k} ${c.x - 1.3 * k},${c.y + 1.1 * k}`} fill={col} stroke={s.coneStroke} strokeWidth={0.3} />
          )}
        </g>
      );
    }
    case "goal": {
      const gw = el.w || 7.32;
      const gd = Math.max(1.1, Math.min(2.4, gw * 0.4));
      const rot = (el.rot || 0) + (orient === "h" ? -90 : 0);
      const bn = look === "bn";
      const col = bn ? s.goal.stroke : el.color || s.goal.stroke;
      // Vista desde arriba: la boca (postes y larguero) en el borde de abajo y la red hacia atrás, algo más estrecha al fondo
      const inset = Math.min(gd * 0.3, gw * 0.12);
      const fy = gd / 2, by = -gd / 2;
      const nx = Math.min(16, Math.max(3, Math.round(gw / 0.6)));
      const ny = Math.max(2, Math.round(gd / 0.45));
      const mesh = [];
      for (let i = 1; i < nx; i++) {
        const t = i / nx;
        mesh.push(`M ${(-gw / 2 + t * gw).toFixed(2)} ${fy} L ${(-gw / 2 + inset + t * (gw - 2 * inset)).toFixed(2)} ${by}`);
      }
      for (let j = 1; j < ny; j++) {
        const v = j / ny, y = fy - v * gd, x = gw / 2 - v * inset;
        mesh.push(`M ${(-x).toFixed(2)} ${y.toFixed(2)} L ${x.toFixed(2)} ${y.toFixed(2)}`);
      }
      return (
        <g opacity={op} transform={`translate(${c.x} ${c.y}) rotate(${rot})`}>
          {selected && !ghost && <rect x={-gw / 2 - 1.2} y={by - 1.1} width={gw + 2.4} height={gd + 2.2} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />}
          <polygon points={`${-gw / 2},${fy} ${gw / 2},${fy} ${gw / 2 - inset},${by} ${-gw / 2 + inset},${by}`} fill={bn ? "#ffffff" : col} fillOpacity={bn ? 1 : 0.1} />
          <path d={mesh.join(" ")} stroke={col} strokeOpacity={0.7} strokeWidth={0.13} fill="none" />
          <path d={`M ${-gw / 2} ${fy} L ${-gw / 2 + inset} ${by} L ${gw / 2 - inset} ${by} L ${gw / 2} ${fy}`} stroke={col} strokeWidth={0.3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <line x1={-gw / 2} y1={fy} x2={gw / 2} y2={fy} stroke={col} strokeWidth={0.55} strokeLinecap="round" />
          <circle cx={-gw / 2} cy={fy} r={0.38} fill={col} />
          <circle cx={gw / 2} cy={fy} r={0.38} fill={col} />
        </g>
      );
    }
    default: return null;
  }
}

function Zone({ el, ctx, selected }) {
  const { field, orient, look } = ctx;
  const s = styleOf(look);
  const a = toView(field, orient, { x: el.x, y: el.y });
  const b = toView(field, orient, { x: el.x + el.w, y: el.y + el.h });
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
  const bn = look === "bn";
  const alpha = el.fillOpacity ?? s.zoneAlpha;
  const hatch = bn;
  const fill = alpha <= 0 ? "none" : hatch ? "url(#bn-hatch)" : el.fill || s.zoneFill;
  const border = el.border !== false;
  const sw = el.strokeWidth ?? 0.45;
  const dash = border ? dashArray(el.dash || "dashed", sw * 1.4) : undefined;
  const common = {
    fill,
    fillOpacity: hatch ? 1 : alpha,
    stroke: border ? (bn ? s.zoneLine : el.stroke || s.zoneLine) : "none",
    strokeWidth: sw,
    strokeDasharray: dash,
    opacity: el.opacity ?? 1,
  };
  const pad = 0.9 + (border ? sw / 2 : 0);
  const mark = { fill: "none", stroke: "#f59e0b", strokeWidth: 0.4, strokeDasharray: "1.6 1.2" };
  return (
    <g>
      {el.shape === "ellipse" ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} /> : <rect x={x} y={y} width={w} height={h} {...common} />}
      {selected && (el.shape === "ellipse"
        ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2 + pad} ry={h / 2 + pad} {...mark} />
        : <rect x={x - pad} y={y - pad} width={w + 2 * pad} height={h + 2 * pad} {...mark} />)}
    </g>
  );
}

function Text({ el, ctx, selected }) {
  const { field, orient, look } = ctx;
  const s = styleOf(look);
  const c = toView(field, orient, el);
  const fs = Number(el.size) || 3;
  return (
    <g opacity={el.opacity ?? 1}>
      <text x={c.x} y={c.y} fontSize={fs} fontWeight={el.bold === false ? 400 : 700} fill={look === "bn" ? s.textFill : el.color || s.textFill} stroke={s.textStroke} strokeWidth={Math.max(0.4, fs * 0.16)} paintOrder="stroke" textAnchor="middle" style={{ fontFamily: fontOf(el.font) }}>{el.text}</text>
      {selected && <rect x={c.x - Math.max(4, (el.text || "").length * fs * 0.3)} y={c.y - fs} width={Math.max(8, (el.text || "").length * fs * 0.6)} height={fs * 1.4} fill="none" stroke="#f59e0b" strokeWidth={0.4} strokeDasharray="1 0.8" />}
    </g>
  );
}

export function Item({ el, ctx, selected = false, handles = false }) {
  if (el.k === "arrow") return <Arrow el={el} ctx={ctx} selected={selected} handles={handles} />;
  if (el.k === "zone") return <Zone el={el} ctx={ctx} selected={selected} />;
  if (el.k === "text") return <Text el={el} ctx={ctx} selected={selected} />;
  return <Piece el={el} ctx={ctx} selected={selected} />;
}

/**
 * board   { field, look, orient, teams, chipSize }  (de normalizeBoard)
 * els     elementos a pintar (un fotograma, o el intermedio de la animación)
 * ghosts  [{ …elemento, from, to }] posición anterior de lo que se ha movido (rastro)
 * draft   flecha o zona que se está dibujando
 */
const Board = React.forwardRef(function Board({ board, els, selId = null, ghosts = [], draft = null, handles = false, className = "", style, label = "Dibujo", ...rest }, ref) {
  const field = fieldOf(board.field);
  const orient = board.orient === "h" ? "h" : "v";
  const look = lookOf(board.look);
  const vb = viewBox(field, orient);
  const ctx = { board, field, orient, look, chip: chipOf(board) };
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={vb.join(" ")} className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} {...rest}>
      <defs>
        <pattern id="bn-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#111" strokeWidth="0.3" /></pattern>
        <pattern id="bn-stripes" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#fff" /><rect width="0.8" height="1.6" fill="#111" /></pattern>
        <clipPath id="tq-clip"><rect x="-3" y="-3" width={field.w + 6} height={field.h + 3} /></clipPath>
      </defs>
      <Field field={field} orient={orient} look={look} vb={vb} />
      {ghosts.map((g) => {
        const a = toView(field, orient, g.from), b = toView(field, orient, g.to);
        return (
          <g key={`g${g.id}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={styleOf(look).ink} strokeWidth={0.3} strokeDasharray="0.9 0.9" opacity={0.45} />
            <Piece el={{ ...g, x: g.from.x, y: g.from.y }} ctx={ctx} ghost />
          </g>
        );
      })}
      {[...els].sort(byRank).map((el) => <Item key={el.id} el={el} ctx={ctx} selected={el.id === selId} handles={handles} />)}
      {draft && <Item el={{ id: "draft", ...draft }} ctx={ctx} selected />}
    </svg>
  );
});
export default Board;
