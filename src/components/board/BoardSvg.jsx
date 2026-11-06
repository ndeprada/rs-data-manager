import { AD_LOGOS } from "@/lib/adLogos";
import { BIG_STAND, BS, cornerR, roundRect, rowSeats, seatHash, stairQuads, standRows } from "@/lib/stadiumGeo";
import React from "react";
import {
  arrowCorners, arrowFlight, arrowProps, arrowPoints, hasVia, ballStyle, chipOf, chipStyle, contrastColor, dashArray, faceOf, elementBounds, fieldTurn, unionBounds, fontOf, isQuad, ladderRungs, linkProps, linkShape,
  ballR, boardView, fieldKind, fieldOf, isGroundEl, isCutField, movePoints, pathMode, grassOf, grassRects, markLines, marksOf, marginOf, hasStands, hasAds, AD_PANELS, perspBoost, lookOf, lyingFlat, materialOf, orientAngle, paintOrder, teamsOf, textBgBox, toView, tokenR, chipTextScale, chipTextLook, chipLines, stackBaselines, viewBox, wavyPoints, zoneBox, labelBgOf, coneEdgeWidth,
} from "@/lib/board";

// Dibujo (solo pintar, sin interacción) de un fotograma sobre el campo, con seis modos visuales:
//  · blanco / blanco-liso / blanco-cuadros → campo blanco con líneas grises finas y color solo en fichas y flechas (poca
//    tinta al imprimir); con franjas de segadora, liso o con cuadrícula de segadora
//  · color / color-cuadros → campo verde con franjas o con cuadrícula
//  · bn      → todo en negro sobre blanco; los equipos se distinguen por el relleno, las flechas por el trazo

const BLANCO = {
  bg: "#ffffff", margin: "#f0f2f5", stripe: "#f5f7f9", line: "#aab1bc", lineW: 0.24, ink: "#111827",
  arrows: { move: "#111827", pass: "#2563eb", dribble: "#73000A" },
  zoneFill: "#2563eb", zoneAlpha: 0.08, zoneLine: "#6b7280", link: "#374151",
  label: { fill: "#111827", stroke: "#ffffff" }, textFill: "#111827", textStroke: "#ffffff",
  goal: { fill: "#f3f4f6", stroke: "#4b5563" }, cone: "#f97316", coneStroke: "#ffffff", ball: { fill: "#ffffff", stroke: "#111827" }, chipStroke: "#111827",
  foot: { fill: "#111827", stroke: "#6b7280" }, shadow: 0.26,
};
const COLOR = {
  bg: "#3f8a4a", stripe: "rgba(255,255,255,0.045)", line: "rgba(255,255,255,0.92)", lineW: 0.35, ink: "#111827",
  arrows: { move: "#ffffff", pass: "#fde047", dribble: "#fb923c" },
  zoneFill: "#ffffff", zoneAlpha: 0.1, zoneLine: "#ffffff", link: "#ffffff",
  label: { fill: "#ffffff", stroke: "#000000" }, textFill: "#ffffff", textStroke: "#000000",
  goal: { fill: "rgba(255,255,255,0.35)", stroke: "#ffffff" }, cone: "#f97316", coneStroke: "#ffffff", ball: { fill: "#ffffff", stroke: "#111827" }, chipStroke: "#ffffff",
  foot: { fill: "#111827", stroke: "#ffffff" }, shadow: 0.36,
};
// Estadio (como FmStadio): césped a cuadros, líneas blancas y gradas alrededor; las fichas llevan de borde su propio color más oscuro
const ESTADIO = {
  ...COLOR, bg: "#3d8b5f", margin: "#3d8b5f", stripe: null, check: "rgba(255,255,255,0.065)", line: "rgba(255,255,255,0.95)", lineW: 0.3, chipStroke: null, shadow: 0.4,
  surround: "#0d2a1f",
  stadium: { outer: "#0b2219", roof: "#1b2420", roofLine: "#56635d", riser: "#0f3324", riserLine: "rgba(0,0,0,0.35)", seats: ["#1f7a4f", "#238556", "#1c6f48", "#26905c"], seatDark: "#0f4a2f", seatLight: "#8fd3a9", aisle: "#6b7671", concourse: "#2b3330", track: "#26332d", boards: "#dfe4e6",
    // estadio grande (como FmStadio): asientos verde vivo sobre hormigón gris y cubierta gris clara
    seatA: "#0f7d59", seatB: "#2fbd8a", concrete: "#5d6361", concreteLight: "#7b817f", roofTop: "#858d8a", roofEdge: "#c9cfcc" },
};
const NOCHE = {
  ...ESTADIO, bg: "#2c3374", margin: "#2c3374", check: "rgba(255,255,255,0.055)",
  surround: "#0a1124",
  stadium: { outer: "#080d1d", roof: "#121729", roofLine: "#3d4566", riser: "#141a38", riserLine: "rgba(0,0,0,0.4)", seats: ["#2c3878", "#33418a", "#28336e", "#3a4996"], seatDark: "#1a2257", seatLight: "#8a98e0", aisle: "#545d80", concourse: "#1c2136", track: "#1a2038", boards: "#c9cfdc",
    seatA: "#2a3aa0", seatB: "#6c80e4", concrete: "#3c4258", concreteLight: "#555c76", roofTop: "#4e5672", roofEdge: "#9aa3c4" },
};
// Estilos de estadio (como los de FmStadio, con colores propios): el mismo estadio con otro césped, otras líneas y otras gradas.
// o = { pitch, check, line, surround, outer, track, seatA, seatB, concrete, concreteLight, roof, roofEdge, seat3d, concrete3d, night, light }
// `light` = césped claro: flechas, textos y nombres oscuros (como en el modo blanco) para que se lean.
function stadiumStyle(o) {
  const base = o.light ? { ...ESTADIO, arrows: BLANCO.arrows, zoneFill: BLANCO.zoneFill, zoneAlpha: 0.1, zoneLine: BLANCO.zoneLine, link: BLANCO.link, label: BLANCO.label, textFill: BLANCO.textFill, textStroke: BLANCO.textStroke } : ESTADIO;
  return {
    ...base, bg: o.pitch, margin: o.pitch, check: o.check, line: o.line || ESTADIO.line, surround: o.surround,
    stadium: {
      ...ESTADIO.stadium, outer: o.outer, track: o.track, seatA: o.seatA, seatB: o.seatB, concrete: o.concrete, concreteLight: o.concreteLight,
      roofTop: o.roof, roofEdge: o.roofEdge, seatDark: o.seatA, seatLight: o.seatB, seat3d: o.seat3d, concrete3d: o.concrete3d, night: !!o.night,
      riser: o.concrete, aisle: o.concreteLight, roof: o.roof, roofLine: o.roofEdge, concourse: o.concrete,
    },
  };
}
const STADIUM_STYLES = {
  "estadio-bosque": stadiumStyle({ pitch: "#2a6b3c", check: "rgba(255,255,255,0.06)", surround: "#0b1d12", outer: "#0a1a10", track: "#1f2e24",
    seatA: "#14532d", seatB: "#3f8f5c", concrete: "#3e4640", concreteLight: "#59625b", roof: "#6c746e", roofEdge: "#b8c0ba", seat3d: ["#1f6b3f", "#4fa872"], concrete3d: "#7f8780" }),
  "estadio-electrico": stadiumStyle({ pitch: "#1f55c8", check: "rgba(255,255,255,0.07)", surround: "#06123a", outer: "#050f30", track: "#13235a",
    seatA: "#0b2fa0", seatB: "#3fa0ff", concrete: "#2a3560", concreteLight: "#3e4b80", roof: "#4a5788", roofEdge: "#9fb4ff", seat3d: ["#1846d8", "#4fb4ff"], concrete3d: "#5a6596", night: true }),
  "estadio-cielo": stadiumStyle({ pitch: "#4f9fd4", check: "rgba(255,255,255,0.09)", surround: "#16405e", outer: "#123650", track: "#2b5c7e",
    seatA: "#2b7fc0", seatB: "#8fd0f5", concrete: "#6d8597", concreteLight: "#8ea3b2", roof: "#a9bccb", roofEdge: "#e3eef6", seat3d: ["#3a92d4", "#a2dcf8"], concrete3d: "#a2b4c2" }),
  "estadio-morado": stadiumStyle({ pitch: "#4a3291", check: "rgba(255,255,255,0.065)", surround: "#140a33", outer: "#10082a", track: "#2a1d55",
    seatA: "#3b1f86", seatB: "#a07cf0", concrete: "#3d3660", concreteLight: "#554d7c", roof: "#5f5888", roofEdge: "#c3b4f2", seat3d: ["#5a35c8", "#b796ff"], concrete3d: "#6c6596", night: true }),
  "estadio-neon": stadiumStyle({ pitch: "#17171c", check: "rgba(255,255,255,0.035)", line: "#ff3a4c", surround: "#050506", outer: "#060607", track: "#1e1e24",
    seatA: "#7a0d18", seatB: "#ff4d5e", concrete: "#2b2b31", concreteLight: "#3c3c44", roof: "#33333b", roofEdge: "#ff6b78", seat3d: ["#b0121f", "#ff5a69"], concrete3d: "#4a4a52", night: true }),
  "estadio-negro": stadiumStyle({ pitch: "#1f2124", check: "rgba(255,255,255,0.045)", surround: "#08090a", outer: "#08090a", track: "#25272b",
    seatA: "#2b2d31", seatB: "#5d6168", concrete: "#33363b", concreteLight: "#474a50", roof: "#3c3f45", roofEdge: "#9aa0a8", seat3d: ["#36393f", "#6e737b"], concrete3d: "#55585e", night: true }),
  "estadio-invierno": stadiumStyle({ pitch: "#e8eef3", check: "rgba(70,100,130,0.07)", line: "#8fa3b8", surround: "#c9d4de", outer: "#c2ced9", track: "#d6dfe7",
    seatA: "#9fb2c5", seatB: "#eef4f9", concrete: "#b6c2cd", concreteLight: "#cdd6de", roof: "#dde5ec", roofEdge: "#ffffff", seat3d: ["#a9bccd", "#f4f8fb"], concrete3d: "#c3ced8", light: true }),
};
const STYLE = {
  estadio: ESTADIO,
  "estadio-noche": NOCHE,
  ...STADIUM_STYLES,
  blanco: BLANCO,
  "blanco-liso": { ...BLANCO, stripe: null, margin: "#ffffff" },
  "blanco-cuadros": { ...BLANCO, stripe: null, check: "#eef0f3" },
  color: COLOR,
  "color-cuadros": { ...COLOR, stripe: null, check: "rgba(255,255,255,0.075)" },
  bn: {
    bg: "#ffffff", line: "#111111", lineW: 0.3, ink: "#111111",
    arrows: { move: "#111111", pass: "#111111", dribble: "#111111" },
    zoneFill: "url(#bn-hatch)", zoneAlpha: 1, zoneLine: "#111111", link: "#111111",
    label: { fill: "#111111", stroke: "#ffffff" }, textFill: "#111111", textStroke: "#ffffff",
    goal: { fill: "#ffffff", stroke: "#111111" }, cone: "#9ca3af", coneStroke: "#111111", ball: { fill: "#ffffff", stroke: "#111111" }, chipStroke: "#111111",
    foot: { fill: "#111111", stroke: "#111111" }, shadow: 0,
  },
};
export const styleOf = (look) => STYLE[lookOf(look)];
// Estilo del campo con el color de líneas que haya elegido la persona (`board.lineColor`; 05/11/2026, Nacho, para imprimir)
export const fieldStyle = (look, board) => (board?.lineColor ? { ...styleOf(look), line: board.lineColor } : styleOf(look));

// En blanco y negro cada equipo tiene su relleno (en el orden de los equipos): negro, blanco, gris, rayas, y luego más.
const BN_FILLS = ["#111111", "#ffffff", "#9ca3af", "url(#bn-stripes)", "#e5e7eb", "url(#bn-hatch)", "#4b5563", "url(#bn-dots)"];
const BN_DARK = new Set(["#111111", "#4b5563"]);

// Cómo se pinta una ficha: relleno (o dibujo de dos colores), borde y color del texto de dentro.
export function chipPaint(board, el, look) {
  if (lookOf(look) === "bn") {
    const i = Math.max(0, teamsOf(board).findIndex((t) => t.id === el.team));
    const color = BN_FILLS[i % BN_FILLS.length];
    const dark = BN_DARK.has(color);
    return { pattern: "solid", color, color2: color, stroke: "#111111", edge: chipStyle(board, el).edge, text: dark ? "#ffffff" : "#111111", halo: dark ? "#111111" : "#ffffff" };
  }
  const st = chipStyle(board, el);
  const text = contrastColor(st.color);
  return { ...st, stroke: st.stroke || styleOf(look).chipStroke || darken(st.color, 0.42), text, halo: text === "#ffffff" ? "#111827" : "#ffffff" };
}

// ── Campo ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// Medidas reglamentarias (m). Fútbol 7: Normas Reguladoras de Fútbol 7 de la RFEF (área de penalti 24×9, de meta 12×3,
// punto de penalti a 9, círculo de 6, portería de 6 y línea de fuera de juego a 12 m de la línea de meta; sin arco de área).
const SPEC = {
  f11: { aw: 40.32, ah: 16.5, gw: 18.32, gh: 5.5, goalW: 7.32, spot: 11, circle: 9.15, arc: 9.15, offside: 0 },
  f7: { aw: 24, ah: 9, gw: 12, gh: 3, goalW: 6, spot: 9, circle: 6, arc: 0, offside: 12 },
};


// ── Porterías ────────────────────────────────────────────────────────────────────────────────────────────────────────
// Alto y fondo de una portería según su ancho (los mismos que el 3D)
export function goalDims(gw) {
  const h = gw >= 7 ? 2.44 : gw >= 2.9 ? 2 : Math.max(0.8, gw * 0.5);
  return { h, gd: Math.max(1.1, Math.min(2.4, gw * 0.4)) };
}
// Porterías de cada tipo de campo (ancho, alto y fondo en m); el rectángulo y el espacio libre no llevan
export const FIELD_GOAL = { f11: { gw: 7.32, h: 2.44, gd: 2 }, f7: { gw: 6, h: 2, gd: 1.5 }, futsal: { gw: 3, h: 2, gd: 1 }, f4: { gw: 3, h: 1.5, gd: 1 } };
const SMALL_KINDS = new Set(["futsal", "f4", "rect"]);
// Portería «de verdad»: postes y larguero gruesos con un borde oscuro, red con malla (techo inclinado, fondo y laterales) y barras finas
// detrás. En coordenadas locales la boca está en y = 0 y la red hacia −y; `proj(x, y, z)` lleva un punto (z = altura en m) a la pantalla:
// en plano es la vista desde arriba (la altura no cuenta) y en perspectiva el suelo proyectado levantado z × su escala.
function GoalShape({ gw, gd, h, frame, net, proj, k = 1, flat = true, shadow = 0, sv = null }) {
  const x = gw / 2, ins = Math.min(gd * 0.22, gw * 0.08), bx = x - ins, hb = h * 0.62;
  const P = (p) => { const q = proj(p[0], p[1], p[2] || 0); return `${q.x.toFixed(3)} ${q.y.toFixed(3)}`; };
  const seg = (a, b) => `M ${P(a)} L ${P(b)}`;
  const quad = (q) => `M ${q.map(P).join(" L ")} Z`;
  const bw = Math.max(0.16, Math.min(0.3, gw * 0.04)) * k;
  const roof = [[-x, 0, h], [x, 0, h], [bx, -gd, hb], [-bx, -gd, hb]];
  const back = [[-bx, -gd, hb], [bx, -gd, hb], [bx, -gd, 0], [-bx, -gd, 0]];
  const sideL = [[-x, 0, h], [-bx, -gd, hb], [-bx, -gd, 0], [-x, 0, 0]];
  const sideR = [[x, 0, h], [bx, -gd, hb], [bx, -gd, 0], [x, 0, 0]];
  const nets = flat ? [roof] : [back, sideL, sideR, roof];
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
  const mesh = (q, cell = 0.3) => {
    const U = Math.max(1, Math.round(dist(q[0], q[1]) / cell)), V = Math.max(1, Math.round(dist(q[1], q[2]) / cell));
    const out = [];
    for (let i = 1; i < U; i++) out.push(seg(lerp(q[0], q[1], i / U), lerp(q[3], q[2], i / U)));
    for (let j = 1; j < V; j++) out.push(seg(lerp(q[0], q[3], j / V), lerp(q[1], q[2], j / V)));
    return out.join(" ");
  };
  const front = `${seg([-x, 0, 0], [-x, 0, h])} L ${P([x, 0, h])} L ${P([x, 0, 0])}`;
  const rear = [seg([-x, 0, 0], [-bx, -gd, 0]), seg([x, 0, 0], [bx, -gd, 0]), seg([-bx, -gd, 0], [bx, -gd, 0]), seg([-bx, -gd, 0], [-bx, -gd, hb]), seg([bx, -gd, 0], [bx, -gd, hb]), seg([-bx, -gd, hb], [bx, -gd, hb]), seg([-x, 0, h], [-bx, -gd, hb]), seg([x, 0, h], [bx, -gd, hb])].join(" ");
  const line = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  const netEls = (
    <g key="net">
      {nets.map((q, i) => <path key={i} d={quad(q)} fill={net} fillOpacity={q === roof ? 0.14 : 0.08} />)}
      <path d={nets.map((q) => mesh(q)).join(" ")} stroke={net} strokeOpacity={0.6} strokeWidth={0.06 * k} {...line} />
    </g>
  );
  const rearEls = <path key="rear" d={rear} stroke={frame} strokeOpacity={0.85} strokeWidth={bw * 0.32} {...line} />;
  const frontEls = (
    <g key="front">
      <path d={front} stroke="#111827" strokeOpacity={0.5} strokeWidth={bw + 0.12 * k} {...line} />
      <path d={front} stroke={frame} strokeWidth={bw} {...line} />
    </g>
  );
  // de frente (se ve la boca) primero la red y luego el marco; de espaldas, al revés
  const mouthFirst = flat || proj(0, 0, 0).y > proj(0, -gd, 0).y;
  return (
    <>
      {shadow > 0 && sv && (
        <g transform={`translate(${sv.x.toFixed(3)} ${sv.y.toFixed(3)})`} opacity={shadow * 0.7}>
          <path d={quad(roof)} fill="#000" fillOpacity={0.3} />
          <path d={front} stroke="#000" strokeOpacity={0.6} strokeWidth={bw * 0.7} {...line} />
        </g>
      )}
      {mouthFirst ? [rearEls, netEls, frontEls] : [frontEls, netEls, rearEls]}
    </>
  );
}
const goalNet = (s) => (contrastColor(s.bg) === "#ffffff" ? "#ffffff" : "#6b7280");
const goalFrame = (s) => (s.goal?.stroke === "#4b5563" ? "#ffffff" : s.goal?.stroke || "#ffffff");

function Lines({ field, s, goals = true, rot = 0 }) {
  const { w, h } = field;
  if (field.id === "free") return null;
  const p = { fill: "none", stroke: s.line, strokeWidth: s.lineW, strokeLinejoin: "round", strokeLinecap: "round" };
  const kind = fieldKind(field);
  if (SMALL_KINDS.has(kind)) {
    // fútbol sala, fútbol 4 y rectángulo: las mismas líneas que en perspectiva (fieldShapes), con sus porterías
    const fg = FIELD_GOAL[kind];
    const goal = (r, flip) => goals && fg && <GoalShape key={`g${flip ? 1 : 0}`} gw={fg.gw} gd={fg.gd} h={fg.h} frame={goalFrame(s)} net={goalNet(s)} proj={(px, py) => (flip ? { x: w / 2 - px, y: h - py } : { x: w / 2 + px, y: py })} shadow={s.shadow || 0} sv={lightVec(r, fg.h * 0.3)} />;
    return (
      <g>
        {fieldShapes(field).map((g, i) => (g.dot
          ? <circle key={i} cx={g.dot.x} cy={g.dot.y} r={0.25} fill={s.line} />
          : <path key={i} d={g.pts.map((q, j) => `${j ? "L" : "M"} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" ") + (g.closed ? " Z" : "")} {...p} strokeDasharray={g.dash ? "1.4 1.1" : undefined} />))}
        {goal(rot, false)}
        {goal(rot + 180, true)}
      </g>
    );
  }
  const sp = field.id === "f7" ? SPEC.f7 : SPEC.f11;
  const arcX = sp.arc ? Math.sqrt(Math.max(sp.arc ** 2 - (sp.ah - sp.spot) ** 2, 0)) : 0;
  const end = (
    <g {...p}>
      <rect x={w / 2 - sp.aw / 2} y={0} width={sp.aw} height={sp.ah} />
      <rect x={w / 2 - sp.gw / 2} y={0} width={sp.gw} height={sp.gh} />
      {sp.arc ? <path d={`M ${w / 2 - arcX} ${sp.ah} A ${sp.arc} ${sp.arc} 0 0 0 ${w / 2 + arcX} ${sp.ah}`} /> : null}
      <path d={`M 0 1 A 1 1 0 0 0 1 0 M ${w - 1} 0 A 1 1 0 0 0 ${w} 1`} />
      <circle cx={w / 2} cy={sp.spot} r={0.35} fill={s.line} stroke="none" />
    </g>
  );
  const fg = FIELD_GOAL[field.id === "f7" ? "f7" : "f11"];
  const goal = (r) => goals && <GoalShape gw={fg.gw} gd={fg.gd} h={fg.h} frame={goalFrame(s)} net={goalNet(s)} proj={(px, py) => ({ x: w / 2 + px, y: py })} shadow={s.shadow || 0} sv={lightVec(r, fg.h * 0.3)} />;
  if (field.id === "half") {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} {...p} />
        {end}
        {goal(rot)}
        <path d={`M ${w / 2 - 9.15} ${h} A 9.15 9.15 0 0 1 ${w / 2 + 9.15} ${h}`} {...p} />
      </g>
    );
  }
  // Campo completo, 3/4 (el completo sin el último cuarto) y fútbol 7
  const H = field.id === "tq" ? 105 : h;
  const tq = field.id === "tq";
  return (
    <g>
      <g clipPath={tq ? "url(#tq-clip)" : undefined}>
        <rect x={0} y={0} width={w} height={H} {...p} />
        {end}
        {goal(rot)}
        <g transform={`rotate(180 ${w / 2} ${H / 2})`}>{end}{goal(rot + 180)}</g>
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
      {/* en el 3/4 el campo se corta antes de la línea de fondo: se cierra con una línea para que no quede un tramo sin pintar */}
      {tq && <line x1={0} y1={h} x2={w} y2={h} {...p} />}
    </g>
  );
}


// ── Estadio (modos «estadio»): gradas y vallas alrededor del campo, en coordenadas del campo (vertical) ────────────────
// Rectángulo de esquinas redondeadas y medidas de las gradas: en src/lib/stadiumGeo.js (los usa también el 3D)
export { roundRect };
// Los cuatro lados rectos a una distancia d: inicio, dirección (unitaria), largo y ángulo base del texto (para leerlo de frente)
function straightSides(field, d) {
  const r = cornerR(d), W = field.w, H = field.h;
  return [
    { id: "top", p: { x: -d + r, y: -d }, u: { x: 1, y: 0 }, n: { x: 0, y: -1 }, len: W + 2 * d - 2 * r, angle: 0 },
    { id: "right", p: { x: W + d, y: -d + r }, u: { x: 0, y: 1 }, n: { x: 1, y: 0 }, len: H + 2 * d - 2 * r, angle: 90 },
    { id: "bottom", p: { x: W + d - r, y: H + d }, u: { x: -1, y: 0 }, n: { x: 0, y: 1 }, len: W + 2 * d - 2 * r, angle: 0 },
    { id: "left", p: { x: -d, y: H + d - r }, u: { x: 0, y: -1 }, n: { x: -1, y: 0 }, len: H + 2 * d - 2 * r, angle: 90 },
  ];
}
// Cuadrilátero de un tramo de lado: de `a` a `b` m a lo largo del lado (medidos en la distancia `d`), entre las distancias d0 y d1
function sideQuad(sd, a, b, d0, d1, dRef) {
  const at = (t, d) => ({ x: sd.p.x + sd.u.x * t + sd.n.x * (d - dRef), y: sd.p.y + sd.u.y * t + sd.n.y * (d - dRef) });
  return [at(a, d0), at(b, d0), at(b, d1), at(a, d1)];
}
// Geometría del estadio: anillo de arriba (cubierta y grada alta), pasillo, grada baja, foso, vallas y césped
export const STAND = { apron: 2.6, ads: 4.0, track: 4.8, lowTop: 9.0, ring: 9.6, upTop: 12.3, roof: 12.8, row: 0.7 };
export function stadiumParts(field, { stands = true, ads = true } = {}) {
  const S = STAND;
  const rowsOf = (d0, d1) => { const out = []; for (let d = d0 + S.row / 2, i = 0; d < d1; d += S.row, i++) out.push({ d, i, pts: roundRect(field, d) }); return out; };
  const aislesOf = (d0, d1) => {
    const out = [];
    for (const sd of straightSides(field, d1)) {
      const n = Math.max(2, Math.round(sd.len / 13));
      for (let k = 1; k < n; k++) { const t = (sd.len * k) / n; out.push(sideQuad(sd, t - 0.55, t + 0.55, d0, d1, d1)); }
    }
    return out;
  };
  const panels = [];
  if (ads) {
    let j = 0;
    for (const sd of straightSides(field, S.ads)) {
      const n = Math.max(1, Math.round(sd.len / 10));
      const len = sd.len / n;
      for (let k = 0; k < n; k++, j++) {
        const pts = sideQuad(sd, k * len + 0.08, (k + 1) * len - 0.08, S.apron + 0.05, S.ads - 0.05, S.ads);
        const mid = { x: (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4, y: (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4 };
        panels.push({ pts, mid, angle: sd.angle, horizontal: sd.angle === 0, len, ...AD_PANELS[j % AD_PANELS.length] });
      }
    }
  }
  return stands
    ? { stands: true, roof: roundRect(field, S.roof), upper: roundRect(field, S.upTop), upRows: rowsOf(S.ring, S.upTop), upAisles: aislesOf(S.ring, S.upTop), ring: roundRect(field, S.ring), lower: roundRect(field, S.lowTop), lowRows: rowsOf(S.track, S.lowTop), lowAisles: aislesOf(S.track, S.lowTop), track: roundRect(field, S.track), boards: ads ? roundRect(field, S.ads) : null, apron: roundRect(field, S.apron), panels }
    : { stands: false, boards: ads ? roundRect(field, S.ads) : null, apron: roundRect(field, S.apron), panels };
}
const ptsPath = (pts, T = (p) => p) => pts.map(T).map((q, i) => `${i ? "L" : "M"} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" ") + " Z";
// En perspectiva las vallas están de pie: el borde del lado del campo, levantado su altura (a la escala de su profundidad)
const BOARD_H = 1.25;
function standingBoard(pn, T, textAt) {
  const a = T(pn.pts[0]), b = T(pn.pts[1]);
  const ka = textAt(pn.pts[0]).k, kb = textAt(pn.pts[1]).k;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${b.x.toFixed(2)} ${(b.y - BOARD_H * kb).toFixed(2)} L ${a.x.toFixed(2)} ${(a.y - BOARD_H * ka).toFixed(2)} Z`;
}
// Ángulo del texto de una valla para que se lea derecho en pantalla, sea cual sea la orientación del campo
const uprightAngle = (base, oa) => { const sc = (((base + oa + 180) % 360) + 360) % 360 - 180; return sc > 90 || sc <= -90 ? base + 180 : base; };
// Altura (m) de la grada a una distancia d de las líneas: grada baja y grada alta con su pendiente, pasillo plano entre las dos
export function standHeight(d) {
  const S = STAND;
  if (d <= S.track) return 0;
  const low = (x) => 0.6 + (x - S.track) * 0.8;
  if (d <= S.lowTop) return low(d);
  const hLow = low(S.lowTop);
  if (d <= S.ring) return hLow;
  const up = hLow + 0.5 + (Math.min(d, S.upTop) - S.ring) * 1.05;
  return d <= S.upTop ? up : up + 1.6;
}
const mixHex = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};
const FULL_H = 105;
// Gradas grandes, como en FmStadio (y como en la vista 3D): filas de 1,6 m con asientos de 1 m (no van a escala, para que en un
// vídeo 16:9 con el campo en vertical llenen los lados), grada baja, pasillo, grada alta y cubierta gris por detrás.
// Se pinta de fuera hacia dentro: cada fila tapa lo que queda dentro de ella. En perspectiva se levantan su altura (a medias).
// La geometría (filas, esquinas, escaleras y asientos) está en src/lib/stadiumGeo.js.
export { BIG_STAND };
// Altura (m) de las gradas grandes a una distancia d de las líneas (para levantarlas en perspectiva)
function bigHeight(d) {
  if (d <= BS.track) return 0;
  if (d <= BS.lowTop) return 2.2 + (d - BS.track) * 0.52;
  if (d <= BS.upStart) return 2.2 + (BS.lowTop - BS.track) * 0.52;
  if (d <= BS.upTop) return 15 + (d - BS.upStart) * 0.75;
  return 38;
}
function Stands({ field, st, T, textAt }) {
  const persp = !!textAt;
  const center = persp ? textAt({ x: field.w / 2, y: field.h / 2 }) : null;
  // en perspectiva: subir el punto (a media altura, para no tapar el campo), solo en las gradas que se ven de cara
  const lift = (p, h) => {
    if (!persp || !h) return T ? T(p) : p;
    const at = textAt(p);
    const vx = at.x - center.x, vy = at.y - center.y, len = Math.hypot(vx, vy) || 1;
    const f = Math.max(0, Math.min(1, 0.55 - (vy / len) * 1.1)) * 0.45;
    return { x: at.x, y: at.y - h * at.k * f };
  };
  const ring = (d, h = bigHeight(d)) => roundRect(field, d, 18).map((p) => lift(p, h)).map((q, i) => `${i ? "L" : "M"} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" ") + " Z";
  const A = st.seatA || st.seatDark, B = st.seatB || st.seatLight, conc = st.concrete || st.riser, concL = st.concreteLight || st.aisle;
  const rows = standRows();
  const els = [];
  // fuera de la grada: la cubierta (gris), con paneles
  els.push(<path key="roofout" d={ring(BS.roofOut, 38)} fill={st.roofTop || st.roof} />);
  for (let d = BS.outer + 4; d < BS.roofOut; d += 6) els.push(<path key={`rp${d}`} d={ring(d, 38)} fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={0.3} />);
  els.push(<path key="back" d={ring(BS.outer, 38)} fill={conc} />);
  const seg = (a, b, h) => { const qa = lift(a, h), qb = lift(b, h); return `M ${qa.x.toFixed(2)} ${qa.y.toFixed(2)} L ${qb.x.toFixed(2)} ${qb.y.toFixed(2)}`; };
  const flatQuad = (pts, h) => pts.map((p) => lift(p, h)).map((q, i) => `${i ? "L" : "M"} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" ") + " Z";
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.tier === 0 && i === BS.lowRows - 1) els.push(<path key="aisle" d={ring(BS.upStart)} fill={concL} />);
    els.push(<path key={`f${i}`} d={ring(r.d1)} fill={conc} />);
    // la arista del escalón, más oscura (sombra de la contrahuella)
    els.push(<path key={`e${i}`} d={ring(r.d0 + 0.06)} fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={0.16} />);
    const mid = r.d0 + BS.row * 0.42, h = bigHeight(mid);
    // Degradado de delante (oscuro) a atrás (claro), con algún asiento un poco más claro u oscuro que los de su fila
    const base = mixHex(A, B, 0.12 + r.t * 0.78);
    const tones = [base, mixHex(base, B, 0.22), mixHex(base, A, 0.22), mixHex(base, "#ffffff", 0.14)];
    const groups = [[], [], [], []], backs = [];
    rowSeats(field, mid, r.tier).forEach((s0) => {
      const v = seatHash(s0.part, s0.i, i);
      groups[v < 0.7 ? 0 : v < 0.84 ? 1 : v < 0.95 ? 2 : 3].push(seg(s0.a, s0.b, h));
      const off = (p) => ({ x: p.x + s0.n.x * 0.44, y: p.y + s0.n.y * 0.44 });
      backs.push(seg(off(s0.a), off(s0.b), h));
    });
    groups.forEach((g, j) => g.length && els.push(<path key={`a${i}-${j}`} d={g.join(" ")} fill="none" stroke={tones[j]} strokeWidth={0.72} />));
    els.push(<path key={`b${i}`} d={backs.join(" ")} fill="none" stroke={mixHex(base, "#000000", 0.28)} strokeWidth={0.18} />);
    // escaleras: un peldaño por fila (hormigón claro), con su canto
    const steps = stairQuads(field, r.d0, r.d1, r.tier);
    els.push(<path key={`s${i}`} d={steps.map((q) => flatQuad(q, h)).join(" ")} fill={concL} />);
    els.push(<path key={`sn${i}`} d={steps.map((q) => seg(q[0], q[1], h)).join(" ")} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={0.14} />);
  }
  // cubierta volada por encima de las filas de atrás, con su canto claro y su sombra
  els.push(<path key="roofshade" d={`${ring(BS.roofIn - 2.5, 30)} ${ring(BS.roofIn, 30)}`} fill="#000" fillRule="evenodd" opacity={0.18} />);
  els.push(<path key="roof" d={`${ring(BS.roofOut, 38)} ${ring(BS.roofIn, 32)}`} fill={st.roofTop || st.roof} fillRule="evenodd" />);
  els.push(<path key="roofedge" d={ring(BS.roofIn, 32)} fill="none" stroke={st.roofEdge || st.roofLine} strokeWidth={0.5} />);
  els.push(<path key="track" d={ring(BS.track, 0)} fill={st.track} />);
  return <g>{els}</g>;
}

// Las gradas tienen miles de asientos: se guardan ya dibujadas (mismo campo, colores, orientación y perspectiva = mismo dibujo),
// así al animar o mover algo no se vuelven a calcular.
const STANDS_CACHE = new WeakMap();
function cachedStands(field, st, orient, T, textAt) {
  const f = (p) => { const q = T ? T(p) : p; return `${q.x.toFixed(3)},${q.y.toFixed(3)}`; };
  const key = [field.id, field.w, field.h, orient, textAt ? `p${f({ x: 0, y: 0 })};${f({ x: field.w, y: field.h })};${f({ x: field.w, y: 0 })}` : "f"].join("|");
  let m = STANDS_CACHE.get(st);
  if (!m) { m = new Map(); STANDS_CACHE.set(st, m); }
  if (!m.has(key)) { if (m.size > 12) m.clear(); m.set(key, <Stands field={field} st={st} T={T} textAt={textAt} />); }
  return m.get(key);
}
function Stadium({ field, s, board, orient, T, textAt }) {
  const st = s.stadium;
  // en medio campo y 3/4 se dibuja el estadio del campo completo (la imagen lo corta en línea recta)
  if (isCutField(field.id)) field = { ...field, h: FULL_H };
  const parts = stadiumParts(field, { stands: hasStands(board), ads: hasAds(board) });
  const P = (pts) => ptsPath(pts, T);
  const oa = orientAngle(orient);
  // En perspectiva, las vallas del fondo (las que se ven de frente) se dibujan de pie, por encima del césped; las demás, en el suelo
  const centerY = textAt ? textAt({ x: field.w / 2, y: field.h / 2 }).y : 0;
  const standing = (pn) => {
    if (!textAt) return false;
    const a = T(pn.pts[0]), b = T(pn.pts[1]);
    return Math.abs(b.x - a.x) > Math.abs(b.y - a.y) * 1.5 && textAt(pn.mid).y < centerY;
  };
  const flatPanels = parts.panels.filter((pn) => !standing(pn));
  const standPanels = parts.panels.filter(standing);
  const drawPanel = (pn) => {
    const up = standing(pn);
    const at = up ? textAt({ x: (pn.pts[0].x + pn.pts[1].x) / 2, y: (pn.pts[0].y + pn.pts[1].y) / 2 }) : textAt ? textAt(pn.mid) : { x: pn.mid.x, y: pn.mid.y, k: 1 };
    const fs = (up ? 0.9 : 0.82) * at.k;
    // en el suelo y en perspectiva solo se escribe en las vallas de delante (las de los lados quedan de canto)
    const flatText = !textAt || (() => { const a = T(pn.pts[0]), b = T(pn.pts[1]); return Math.abs(b.x - a.x) > Math.abs(b.y - a.y) * 1.5; })();
    return (
      <g key={`ad${pn.text}${pn.mid.x.toFixed(1)}${pn.mid.y.toFixed(1)}`}>
        {up ? <path d={standingBoard(pn, T, textAt)} fill={pn.bg} stroke="rgba(0,0,0,0.3)" strokeWidth={0.06} /> : <path d={P(pn.pts)} fill={pn.bg} stroke="rgba(0,0,0,0.25)" strokeWidth={0.05} />}
        {(up || flatText) && pn.logo && AD_LOGOS[pn.logo] && (() => {
          const L = AD_LOGOS[pn.logo];
          const a = textAt ? T(pn.pts[0]) : pn.pts[0], b = textAt ? T(pn.pts[1]) : pn.pts[1];
          const span = textAt ? Math.hypot(b.x - a.x, b.y - a.y) : pn.len;
          const h = Math.min((up ? 0.92 : 1.05) * at.k, (span * 0.8) / L.ar);
          const cy = up ? at.y - BOARD_H * at.k * 0.5 : at.y;
          const rot = textAt ? 0 : uprightAngle(pn.angle, oa);
          return <image href={pn.ink === "#ffffff" ? L.w : L.o} x={-L.ar / 2} y={-0.5} width={L.ar} height={1} preserveAspectRatio="xMidYMid meet"
            transform={`translate(${at.x.toFixed(2)} ${cy.toFixed(2)}) rotate(${rot}) scale(${h.toFixed(3)})`} />;
        })()}
        {(up || flatText) && !pn.logo && (
          <text x={at.x} y={up ? at.y - BOARD_H * at.k * 0.5 + fs * 0.36 : at.y + fs * 0.36} fontSize={fs} fontWeight={800} fill={pn.ink} textAnchor="middle" letterSpacing={fs * 0.08}
            transform={textAt ? undefined : `rotate(${uprightAngle(pn.angle, oa)} ${at.x} ${at.y})`} style={{ fontFamily: "Arial, sans-serif" }}>{pn.text}</text>
        )}
      </g>
    );
  };
  return (
    <g>
      {parts.stands && cachedStands(field, st, orient, T, textAt)}
      {parts.boards && <path d={P(parts.boards)} fill={st.boards} />}
      {flatPanels.map(drawPanel)}
      <path d={P(parts.apron)} fill={s.bg} />
      {standPanels.map(drawPanel)}
    </g>
  );
}

// Tiradores de la trayectoria de una ficha o del balón elegido (desde el fotograma anterior): «+» en cada tramo para
// añadir un cambio de dirección, quiebros que se arrastran (doble clic lo quita) y el punto de control de la curva.
function PathHandles({ g, V, u = 0.12 }) {
  const mode = pathMode(g);
  const corners = [g.from, ...(mode === "poly" ? g.path.via : []), g.to];
  const ctrl = mode === "curve" ? { x: g.path.cx, y: g.path.cy } : null;
  const C = ctrl && V(ctrl), A = V(g.from), B = V(g.to);
  const guide = { stroke: "#f59e0b", strokeWidth: u, strokeDasharray: `${3 * u} ${2 * u}`, pointerEvents: "none" };
  return (
    <g data-testid="path-handles">
      {C && <line x1={A.x} y1={A.y} x2={C.x} y2={C.y} {...guide} />}
      {C && <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} {...guide} />}
      {C && <HandleDot x={C.x} y={C.y} u={u} fill="#f59e0b" />}
      {C && <circle data-h="tc" cx={C.x} cy={C.y} r={HIT * u} fill="transparent" />}
      {!ctrl && corners.slice(0, -1).map((c, i) => {
        const m = V({ x: (c.x + corners[i + 1].x) / 2, y: (c.y + corners[i + 1].y) / 2 });
        return <PlusHandle key={`tm${i}`} h={`tm${i}`} x={m.x} y={m.y} u={u} />;
      })}
      {corners.slice(1, -1).map((c, i) => { const q = V(c); return (
        <g key={`tv${i}`}>
          <HandleDot x={q.x} y={q.y} u={u} r={3.5} fill="#f59e0b" />
          <circle data-h={`tv${i}`} cx={q.x} cy={q.y} r={HIT * u} fill="transparent" />
        </g>
      ); })}
    </g>
  );
}

// Tiradores del editor (03/11/2026, Nacho: «botoncitos más sutiles y más pequeños»): se dibujan en píxeles de pantalla
// (u = metros por píxel, lo calcula Board), así miden lo mismo con zoom o sin él. La zona de toque es mayor que lo que se ve.
// en pantallas táctiles la zona de toque es mayor (el dedo tapa más que el ratón)
const HIT = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches ? 18 : 11;
function HandleDot({ x, y, u, r = 4, fill = "#fff", stroke }) {
  return <circle cx={x} cy={y} r={r * u} fill={fill} stroke={stroke || (fill === "#fff" ? "#f59e0b" : "#fff")} strokeWidth={1.3 * u} pointerEvents="none" />;
}
function PlusHandle({ h, x, y, u }) {
  const a = 2.2 * u;
  return (
    <g>
      <circle cx={x} cy={y} r={4.2 * u} fill="#fff" stroke="#f59e0b" strokeWidth={u} strokeDasharray={`${1.6 * u} ${1.1 * u}`} pointerEvents="none" />
      <path d={`M ${x - a} ${y} H ${x + a} M ${x} ${y - a} V ${y + a}`} stroke="#f59e0b" strokeWidth={1.1 * u} pointerEvents="none" />
      <circle data-h={h} cx={x} cy={y} r={(HIT - 2) * u} fill="transparent" />
    </g>
  );
}

// Césped: rectángulos agrupados por tono (un trazo por tono) y marcas de carriles/franjas
function grassGroups(field, look, board) {
  const s = styleOf(look);
  if (lookOf(look) === "bn" || field.id === "free") return [];
  let g = grassOf(board);
  if (g === "auto") g = s.check ? "cuadros" : s.stripe ? "franjas" : "liso";
  const white = s.bg === "#ffffff";
  const tones = {
    a: s.check || s.stripe || (white ? "#f3f5f8" : "rgba(255,255,255,0.06)"),
    h: white ? "rgba(17,24,39,0.035)" : "rgba(0,0,0,0.075)",
    v: white ? "rgba(17,24,39,0.022)" : "rgba(255,255,255,0.07)",
  };
  const by = new Map();
  for (const r of grassRects(field, g)) { const k = r.tone; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  return [...by.entries()].map(([k, list]) => ({ fill: tones[k], rects: list }));
}
const markStyle = (s) => ({ stroke: s.line, strokeOpacity: 0.62, strokeWidth: s.lineW * 0.85, strokeDasharray: "1.3 1", fill: "none", strokeLinecap: "round" });

const unionVb = (a, b) => { const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]); return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y]; };
// Medio campo y 3/4 son un encuadre del campo completo (como un zoom): se pinta el campo entero y el recuadro lo corta
const drawFieldOf = (field) => (isCutField(field.id) ? { ...field, id: "full", h: FULL_H } : field);
function Field({ field: shown, orient, look, vb, board }) {
  const s = fieldStyle(look, board);
  const field = drawFieldOf(shown);
  const free = field.id === "free";
  const grass = grassGroups(field, look, board);
  const marks = markLines(field, marksOf(board));
  return (
    <>
      <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill={free ? s.bg : s.stadium && hasStands(board) ? s.stadium.outer : s.margin || s.bg} />
      <g transform={fieldTurn(shown, orient)}>
        {!free && s.stadium && <Stadium field={field} s={s} board={board} orient={orient} />}
        {free ? null : <rect x={0} y={0} width={field.w} height={field.h} fill={s.bg} />}
        {grass.map((gr, i) => <path key={`g${i}`} d={gr.rects.map((r) => `M ${r.x} ${r.y} h ${r.w} v ${r.h} h ${-r.w} Z`).join(" ")} fill={gr.fill} />)}
        {marks.length > 0 && <g {...markStyle(s)} data-testid="board-marks">{marks.map((m, i) => <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />)}</g>}
        <Lines field={field} s={s} goals={!board?._noGoals} rot={orientAngle(orient)} />
      </g>
    </>
  );
}

// Campo en perspectiva: las mismas líneas que el plano, pero cada punto se proyecta (los círculos y arcos, muestreados)
const arcPts = (cx, cy, r, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });
const rectPts = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
// Fútbol sala (40 × 20, reglas de la FIFA): área de 6 m hecha con dos cuartos de círculo desde los postes y una recta, punto de
// penalti a 6 m y doble penalti a 10 m, círculo central de 3 m, arcos de esquina y zonas de cambio (a 5 y 10 m de la línea
// central, en una banda). Fútbol 4 (30 × 20): bandas, línea central y círculo de 3 m. Rectángulo: solo el contorno.
function smallFieldShapes(field, kind) {
  const { w, h } = field, out = [];
  const line = (pts, closed = false, dash = false) => out.push({ pts, closed, dash });
  line(rectPts(0, 0, w, h), true);
  if (kind === "rect") return out;
  line([{ x: 0, y: h / 2 }, { x: w, y: h / 2 }]);
  line(arcPts(w / 2, h / 2, 3, 0, 2 * Math.PI, 40), true);
  out.push({ dot: { x: w / 2, y: h / 2 } });
  const corner = kind === "futsal" ? 0.25 : 0.6;
  for (const flip of [false, true]) {
    const f = flip ? (q) => ({ x: w - q.x, y: h - q.y }) : (q) => q;
    line(arcPts(0, 0, corner, Math.PI / 2, 0, 6).map(f));
    line(arcPts(w, 0, corner, Math.PI, Math.PI / 2, 6).map(f));
    if (kind === "futsal") {
      const a = w / 2 - 1.5, b = w / 2 + 1.5;
      line([...arcPts(a, 0, 6, Math.PI, Math.PI / 2, 16), ...arcPts(b, 0, 6, Math.PI / 2, 0, 16)].map(f));
      out.push({ dot: f({ x: w / 2, y: 6 }) }, { dot: f({ x: w / 2, y: 10 }) });
    }
  }
  if (kind === "futsal") for (const d of [-10, -5, 5, 10]) line([{ x: -0.4, y: h / 2 + d }, { x: 0.4, y: h / 2 + d }]);
  return out;
}
export function fieldShapes(field) {
  // en coordenadas del campo (vertical, portería a atacar arriba): { pts, closed } para líneas, { dot } para puntos
  const { w, h } = field;
  if (field.id === "free") return [];
  const kind = fieldKind(field);
  if (SMALL_KINDS.has(kind)) return smallFieldShapes(field, kind);
  const sp = field.id === "f7" ? SPEC.f7 : SPEC.f11;
  const out = [];
  const line = (pts, closed = false, dash = false) => out.push({ pts, closed, dash });
  const H = field.id === "tq" ? 105 : h;
  const end = (flip) => {
    const f = flip ? (p) => ({ x: w - p.x, y: H - p.y }) : (p) => p;
    line(rectPts(w / 2 - sp.aw / 2, 0, sp.aw, sp.ah).map(f), true);
    line(rectPts(w / 2 - sp.gw / 2, 0, sp.gw, sp.gh).map(f), true);
    if (sp.arc) { const dy = sp.ah - sp.spot, a = Math.acos(Math.min(1, dy / sp.arc)); line(arcPts(w / 2, sp.spot, sp.arc, Math.PI / 2 + a, Math.PI / 2 - a, 24).map(f)); }
    line(arcPts(0, 0, 1, Math.PI / 2, 0, 8).map(f));
    line(arcPts(w, 0, 1, Math.PI, Math.PI / 2, 8).map(f));
    out.push({ dot: f({ x: w / 2, y: sp.spot }) });
  };
  if (field.id === "half") {
    line(rectPts(0, 0, w, h), true);
    end(false);
    line(arcPts(w / 2, h, 9.15, Math.PI, 2 * Math.PI, 30));
    return out;
  }
  line(rectPts(0, 0, w, H), true);
  end(false);
  end(true);
  line([{ x: 0, y: H / 2 }, { x: w, y: H / 2 }]);
  line(arcPts(w / 2, H / 2, sp.circle, 0, 2 * Math.PI, 56), true);
  out.push({ dot: { x: w / 2, y: H / 2 } });
  if (sp.offside) { line([{ x: 0, y: sp.offside }, { x: w, y: sp.offside }], false, true); line([{ x: 0, y: H - sp.offside }, { x: w, y: H - sp.offside }], false, true); }
  if (field.id === "tq") line([{ x: 0, y: h }, { x: w, y: h }]);
  return out;
}
function FieldPersp({ field: shown, orient, look, vb, persp, board }) {
  const s = fieldStyle(look, board);
  const field = drawFieldOf(shown);
  const free = field.id === "free";
  const T = (p) => persp.P(toView(shown, orient, p));
  // texto de las vallas en perspectiva: en su sitio y a la escala de su profundidad (solo en las vallas que se ven de frente)
  const textAt = (p) => { const v = toView(shown, orient, p); const q = persp.P(v); return { x: q.x, y: q.y, k: persp.scaleAt(v) }; };
  const poly = (pts, closed) => pts.map(T).map((q, i) => `${i ? "L" : "M"} ${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" ") + (closed ? " Z" : "");
  const [x0, y0, W, H] = viewBox(shown, orient, marginOf(look, board));
  const ground = [{ x: x0, y: y0 }, { x: x0 + W, y: y0 }, { x: x0 + W, y: y0 + H }, { x: x0, y: y0 + H }].map(persp.P);
  const tqH = field.id === "tq";
  const clipId = `pclip-${field.id}-${orient}`;
  const fieldPoly = poly(rectPts(0, 0, field.w, field.h), true);
  const grass = grassGroups(field, look, board);
  const marks = markLines(field, marksOf(board));
  const lp = { fill: "none", stroke: s.line, strokeWidth: s.lineW, strokeLinejoin: "round", strokeLinecap: "round" };
  return (
    <>
      <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill={free ? s.bg : s.stadium ? s.stadium.outer : s.margin || s.bg} />
      <polygon points={ground.map((q) => `${q.x},${q.y}`).join(" ")} fill={free ? s.bg : s.stadium && hasStands(board) ? s.stadium.outer : s.margin || s.bg} />
      {!free && (
        <>
          {s.stadium && <Stadium field={field} s={s} board={board} orient={orient} T={T} textAt={textAt} />}
          <defs><clipPath id={clipId}><path d={fieldPoly} /></clipPath></defs>
          <path d={fieldPoly} fill={s.bg} />
          {grass.map((gr, i) => <path key={`g${i}`} d={gr.rects.map((r) => poly(rectPts(r.x, r.y, r.w, r.h), true)).join(" ")} fill={gr.fill} />)}
          {marks.length > 0 && <g {...markStyle(s)} data-testid="board-marks">{marks.map((m, i) => <path key={i} d={poly([{ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 }], false)} />)}</g>}
          <g clipPath={tqH ? `url(#${clipId}-tq)` : undefined}>
            {tqH && <defs><clipPath id={`${clipId}-tq`}><path d={poly(rectPts(-3, -3, field.w + 6, field.h + 3), true)} /></clipPath></defs>}
            {fieldShapes(field).map((g, i) => (g.dot
              ? (() => { const q = T(g.dot), k = persp.scaleAt(toView(shown, orient, g.dot)); return <ellipse key={i} cx={q.x} cy={q.y} rx={0.35 * k} ry={0.35 * persp.depthAt(toView(shown, orient, g.dot))} fill={s.line} />; })()
              : <path key={i} d={poly(g.pts, g.closed)} {...lp} strokeDasharray={g.dash ? "1.4 1.1" : undefined} />))}
          </g>
          {(() => {
            const fg = FIELD_GOAL[fieldKind(field)], Hh = tqH ? 105 : field.h;
            if (!fg) return null;
            const lift = (p, z) => { const v = toView(shown, orient, p); const q = persp.P(v); return { x: q.x, y: q.y - z * persp.scaleAt(v) }; };
            const ends = [{ p: (px, py) => ({ x: field.w / 2 + px, y: py }), at: { x: field.w / 2, y: 0 } }];
            if (field.id !== "half" && !tqH) ends.push({ p: (px, py) => ({ x: field.w / 2 - px, y: Hh - py }), at: { x: field.w / 2, y: Hh } });
            return ends.map((e, i) => <GoalShape key={`goal${i}`} gw={fg.gw} gd={fg.gd} h={fg.h} frame={goalFrame(s)} net={goalNet(s)} flat={false} k={persp.scaleAt(toView(shown, orient, e.at))} proj={(px, py, pz) => lift(e.p(px, py), pz)} />);
          })()}
        </>
      )}
    </>
  );
}

// ── Elementos ──────────────────────────────────────────────────────────────────────────────────────────────────────

// Parte de una línea desde su inicio (`reveal` de 0 a 1): la flecha que aparece en un fotograma se va dibujando
function revealPts(pts, reveal) {
  if (reveal == null || reveal >= 1) return pts;
  const lens = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
  let left = lens.reduce((s, l) => s + l, 0) * Math.max(0, reveal);
  const out = [pts[0]];
  for (let i = 0; i < lens.length; i++) {
    if (left >= lens[i]) { out.push(pts[i + 1]); left -= lens[i]; continue; }
    const t = lens[i] ? left / lens[i] : 0;
    if (t > 0.001) out.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t });
    break;
  }
  return out;
}

const pathOf = (pts) => pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

function Arrow({ el, ctx, selected, handles }) {
  const { orient, look } = ctx;
  const u = ctx.px || 0.12;
  const s = styleOf(look);
  const ap = arrowProps(el);
  const col = look === "bn" ? s.arrows.move : el.color || s.arrows[el.style] || s.arrows.move;
  const w = ap.width;
  const toV = ctx.V;
  const flight = revealPts(arrowFlight(el, orient).map(toV), el.reveal);
  if (flight.length < 2) return null;
  const n = flight.length - 1;
  const dx = flight[n].x - flight[n - 1].x, dy = flight[n].y - flight[n - 1].y;
  const dl = Math.hypot(dx, dy) || 1;
  const ux = dx / dl, uy = dy / dl;
  // Punta estilizada (03/11/2026, Nacho: «la punta más estrechita»): más corta y estrecha que antes (1,4 + 1,9·w de largo y
  // tan ancha como larga), con la base algo hundida; la línea termina dentro de la punta.
  const headLen = 1.0 + 1.5 * w;
  const trim = ap.pointer === "none" || ap.pointer === "dot" ? 0 : ap.pointer === "bar" ? 0.4 : headLen * 0.72;
  const line = flight.map((p, i) => (i === n ? { x: p.x - ux * trim, y: p.y - uy * trim } : p));
  const d = pathOf(ap.wavy ? wavyPoints(line, 0.3 + w * 0.45, 2.4 + w * 0.6) : line);
  const end = flight[n];
  const hx = end.x, hy = end.y;
  const half = Math.max(w * 0.95, headLen * 0.36);
  const notch = headLen * 0.8;
  const headPts = `${hx},${hy} ${hx - ux * headLen - uy * half},${hy - uy * headLen + ux * half} ${hx - ux * notch},${hy - uy * notch} ${hx - ux * headLen + uy * half},${hy - uy * headLen - ux * half}`;
  const barHalf = 0.7 + w * 1.2;
  const barPts = `${hx - uy * barHalf},${hy + ux * barHalf} ${hx + uy * barHalf},${hy - ux * barHalf}`;
  const dash = dashArray(ap.dash, w);
  const cap = "round";
  const borderCol = look === "bn" ? "#111111" : el.borderColor || "#111827";
  const ctrl = el.cx != null && !hasVia(el) ? toV({ x: el.cx, y: el.cy }) : null;
  const corners = arrowCorners(el).map(toV);
  const start = flight[0];
  const ground = el.air ? revealPts(arrowPoints(el, 24).map(toV), el.reveal) : null;
  const apex = el.air ? flight[12] : null;
  return (
    <g opacity={(el.opacity ?? 1) * ap.alpha}>
      {/* sombra del balón en el suelo: pequeña y muy sutil (sin línea hasta el punto más alto) */}
      {ground && <path d={pathOf(ground)} fill="none" stroke="#000" strokeOpacity={0.13} strokeWidth={Math.max(0.5, w * 1.1)} strokeLinecap="round" strokeLinejoin="round" />}
      {selected && <path d={d} fill="none" stroke="#f59e0b" strokeWidth={w + Math.max(0.5, 5 * u)} opacity={0.45} strokeLinecap="round" strokeLinejoin="round" />}
      {ap.border && <path d={d} fill="none" stroke={borderCol} strokeWidth={w + 0.7} strokeDasharray={dash} strokeLinecap={cap} strokeLinejoin="round" />}
      <path d={d} fill="none" stroke={col} strokeWidth={w} strokeDasharray={dash} strokeLinecap={cap} strokeLinejoin="round" />
      {ap.pointer === "none" ? null : ap.pointer === "dot" ? (
        <circle cx={hx} cy={hy} r={0.6 + w * 0.9} fill={col} stroke={ap.border ? borderCol : "none"} strokeWidth={0.35} />
      ) : ap.pointer === "bar" ? (
        <>
          {ap.border && <polyline points={barPts} stroke={borderCol} strokeWidth={w + 0.7} fill="none" strokeLinecap="round" />}
          <polyline points={barPts} stroke={col} strokeWidth={w + 0.15} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <polygon points={headPts} fill={col} stroke={ap.border ? borderCol : "none"} strokeWidth={0.35} strokeLinejoin="round" />
      )}
      {selected && handles && (
        <g>
          {ctrl && <line x1={start.x} y1={start.y} x2={ctrl.x} y2={ctrl.y} stroke="#f59e0b" strokeWidth={u} strokeDasharray={`${3 * u} ${2 * u}`} />}
          {ctrl && <line x1={end.x} y1={end.y} x2={ctrl.x} y2={ctrl.y} stroke="#f59e0b" strokeWidth={u} strokeDasharray={`${3 * u} ${2 * u}`} />}
          <HandleDot x={start.x} y={start.y} u={u} />
          <HandleDot x={end.x} y={end.y} u={u} />
          {ctrl && <HandleDot x={ctrl.x} y={ctrl.y} u={u} fill="#f59e0b" />}
          {apex && <HandleDot x={apex.x} y={apex.y} u={u} fill="#2563eb" />}
          {/* zonas de toque más grandes que lo que se ve, para poder agarrarlas con el dedo */}
          <circle data-h="p1" cx={start.x} cy={start.y} r={HIT * u} fill="transparent" />
          <circle data-h="p2" cx={end.x} cy={end.y} r={HIT * u} fill="transparent" />
          {ctrl && <circle data-h="c" cx={ctrl.x} cy={ctrl.y} r={HIT * u} fill="transparent" />}
          {/* flecha con quiebros: cada quiebro se arrastra (doble clic lo quita) y el «+» de cada tramo añade otro */}
          {!el.air && !ctrl && corners.slice(0, -1).map((c, i) => {
            const m = { x: (c.x + corners[i + 1].x) / 2, y: (c.y + corners[i + 1].y) / 2 };
            return <PlusHandle key={`m${i}`} h={`m${i}`} x={m.x} y={m.y} u={u} />;
          })}
          {corners.slice(1, -1).map((c, i) => (
            <g key={`v${i}`}>
              <HandleDot x={c.x} y={c.y} u={u} r={3.5} fill="#f59e0b" />
              <circle data-h={`v${i}`} cx={c.x} cy={c.y} r={HIT * u} fill="transparent" />
            </g>
          ))}
          {apex && <circle data-h="l" cx={apex.x} cy={apex.y} r={HIT * u} fill="transparent" />}
        </g>
      )}
    </g>
  );
}

// Relleno de una ficha (en espacio unitario, recortado al círculo): liso o con un dibujo del segundo color
function ChipFill({ pattern, color, color2 }) {
  return (
    <g clipPath="url(#chip-clip)">
      <rect x={-1} y={-1} width={2} height={2} fill={color} />
      {pattern === "sash" && <rect x={-1.6} y={-0.31} width={3.2} height={0.62} transform="rotate(45)" fill={color2} />}
      {pattern === "v" && (
        <>
          <rect x={-0.6} y={-1} width={0.4} height={2} fill={color2} />
          <rect x={0.2} y={-1} width={0.4} height={2} fill={color2} />
        </>
      )}
      {pattern === "h" && (
        <>
          <rect x={-1} y={-0.6} width={2} height={0.4} fill={color2} />
          <rect x={-1} y={0.2} width={2} height={0.4} fill={color2} />
        </>
      )}
      {pattern === "halves" && <rect x={0} y={-1} width={1} height={2} fill={color2} />}
      {pattern === "stripes" && [-0.86, -0.43, 0, 0.43, 0.86].map((x) => <rect key={x} x={x - 0.11} y={-1} width={0.22} height={2} fill={color2} />)}
      {pattern === "hoops" && [-0.72, -0.24, 0.24, 0.72].map((y) => <rect key={y} x={-1} y={y - 0.12} width={2} height={0.24} fill={color2} />)}
      {pattern === "quarters" && (
        <>
          <rect x={0} y={-1} width={1} height={1} fill={color2} />
          <rect x={-1} y={0} width={1} height={1} fill={color2} />
        </>
      )}
    </g>
  );
}

// Ficha «camiseta»: la camiseta vista de frente dentro del disco (cuello arriba): el cuerpo con el dibujo del equipo, las
// mangas a los lados (algo más oscuras, con su costura) y el cuello y los puños del color de los ribetes. Sin escudos.
const SLEEVE_L = "M -1.05 -0.62 L -0.34 -0.98 Q -0.5 -0.2 -0.62 0.62 L -1.05 0.62 Z";
const SLEEVE_R = "M 1.05 -0.62 L 0.34 -0.98 Q 0.5 -0.2 0.62 0.62 L 1.05 0.62 Z";
function ShirtFace({ pattern, color, color2, trim }) {
  return (
    <g>
      <ChipFill pattern={pattern} color={color} color2={color2} />
      <g clipPath="url(#chip-clip)">
        <path d={SLEEVE_L} fill="#000" fillOpacity={0.14} />
        <path d={SLEEVE_R} fill="#000" fillOpacity={0.14} />
        <path d="M -0.34 -0.98 Q -0.5 -0.2 -0.62 0.62 M 0.34 -0.98 Q 0.5 -0.2 0.62 0.62" fill="none" stroke="#000" strokeOpacity={0.28} strokeWidth={0.05} />
        {/* puños */}
        <path d="M -0.98 -0.18 A 1 1 0 0 0 -0.82 0.58" fill="none" stroke={trim} strokeWidth={0.2} />
        <path d="M 0.98 -0.18 A 1 1 0 0 1 0.82 0.58" fill="none" stroke={trim} strokeWidth={0.2} />
        {/* cuello: el hueco (más oscuro) y el ribete en pico redondeado */}
        <path d="M -0.34 -1.02 Q 0 -0.42 0.34 -1.02 Z" fill="#000" fillOpacity={0.35} />
        <path d="M -0.36 -1.02 Q 0 -0.42 0.36 -1.02" fill="none" stroke={trim} strokeWidth={0.13} strokeLinecap="round" />
        {/* bajo de la camiseta */}
        <path d="M -0.62 0.62 L 0.62 0.62" stroke="#000" strokeOpacity={0.18} strokeWidth={0.05} />
      </g>
    </g>
  );
}

// Cuerpo de una ficha en espacio unitario (radio 1): disco liso, con dibujo o camiseta
function ChipBody({ paint, bn, sw = 0.18 }) {
  if (bn) return <circle r={1} fill={paint.color} stroke={sw > 0 ? paint.stroke : "none"} strokeWidth={sw} />;
  if (paint.kit === "camiseta") return <ShirtFace pattern={paint.pattern} color={paint.color} color2={paint.color2} trim={paint.trim} />;
  if (paint.pattern === "solid") return <circle r={1} fill={paint.color} />;
  return <ChipFill pattern={paint.pattern} color={paint.color} color2={paint.color2} />;
}

// Relieve y sombra de las fichas. Todo son degradados y formas (sin filtros SVG) para que se vea igual en pantalla, en el PNG
// y en el vídeo, y para que animar muchas fichas no pese.
//  · chip-shade: capa neutra sobre el relleno (luz arriba a la izquierda, borde más oscuro abajo a la derecha): vale para cualquier color o dibujo
//  · chip-shadow: sombra suave en el suelo (más opaca en el centro, se desvanece en el borde)
//  · foot-shade / cone-shade: el pie y el cono se oscurecen hacia un lado para que parezcan redondeados
export function ChipDefs() {
  return (
    <>
      <radialGradient id="chip-shade" cx="0.36" cy="0.3" r="0.82">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="0.74" stopColor="#000000" stopOpacity="0.06" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.34" />
      </radialGradient>
      <radialGradient id="hl-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd60a" stopOpacity="0.55" />
        <stop offset="0.6" stopColor="#ffd60a" stopOpacity="0.28" />
        <stop offset="1" stopColor="#ffd60a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="ball-shade" cx="0.38" cy="0.34" r="0.78">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.8" stopColor="#000000" stopOpacity="0.1" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.42" />
      </radialGradient>
      <radialGradient id="chip-gloss" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.22" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="chip-shadow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#000000" stopOpacity="1" />
        <stop offset="0.6" stopColor="#000000" stopOpacity="0.85" />
        <stop offset="0.86" stopColor="#000000" stopOpacity="0.3" />
        <stop offset="1" stopColor="#000000" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="foot-shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id="puck-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
        <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id="cone-shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
      </linearGradient>
    </>
  );
}

// Dirección de la luz: arriba a la izquierda de la pantalla, así que la sombra cae hacia abajo y a la derecha (en unidades de radio)
const SHADOW = { x: 0.16, y: 0.26 };

// Desvío de la sombra de un objeto dentro de un grupo girado `rot` grados: sigue cayendo hacia abajo-derecha de la pantalla (h = largo en m)
function lightVec(rot, h) {
  const a = (rot * Math.PI) / 180, dx = (SHADOW.x / SHADOW.y) * h, dy = h;
  return { x: dx * Math.cos(a) + dy * Math.sin(a), y: -dx * Math.sin(a) + dy * Math.cos(a) };
}

// Sombra de un objeto: su misma forma en negro, desplazada y con un borde más suave. `children(g)` dibuja la forma con `g` de más
// de grosor (0 = forma exacta, >0 = borde suave). Todo en un grupo con opacidad para que las formas que se solapan no oscurezcan dos veces.
function Shadow({ amount, v, halo = 0.45, children }) {
  if (!amount) return null;
  return (
    <g transform={`translate(${v.x.toFixed(3)} ${v.y.toFixed(3)})`} opacity={amount}>
      <g opacity={0.45}>{children(halo)}</g>
      {children(0)}
    </g>
  );
}

// Pies de una ficha: dos zapatillas cortas que asoman por delante (el frente es «hacia arriba» en espacio unitario). Sencillas a propósito:
// un óvalo oscuro con borde claro y un poco de volumen; en blanco y negro (impresión) solo contorno.
const FOOT_X = 0.5, FOOT_W = 0.48, FOOT_Y = -1.42, FOOT_H = 0.9;
function Feet({ foot, flat, shadow = 0, ang = 0 }) {
  // la sombra no gira con la ficha: se pone con el desvío de la luz deshecho el giro
  const v = lightVec(ang, SHADOW.y * 0.8);
  const rect = { y: FOOT_Y, width: FOOT_W, height: FOOT_H, rx: FOOT_W / 2 };
  return (
    <>
      {shadow > 0 && [-1, 1].map((sx) => (
        <rect key={`s${sx}`} {...rect} x={sx * FOOT_X - FOOT_W / 2 + v.x} y={FOOT_Y + v.y} fill="#000" fillOpacity={shadow * 0.55} stroke="#000" strokeOpacity={shadow * 0.25} strokeWidth={0.18} />
      ))}
      {[-1, 1].map((sx) => (
        <g key={sx}>
          <rect {...rect} x={sx * FOOT_X - FOOT_W / 2} fill={flat ? "#ffffff" : foot.fill} stroke={flat ? "#111111" : "#ffffff"} strokeWidth={0.1} />
          {!flat && <rect {...rect} x={sx * FOOT_X - FOOT_W / 2} fill="url(#foot-shade)" />}
        </g>
      ))}
    </>
  );
}

// Peto sobre la ficha (en espacio unitario; el trazado tiene los hombros hacia −y y se da la vuelta para que queden al lado contrario de los pies): el torso con el escote en pico y las sisas a los lados,
// recortado al círculo; por las sisas y el escote se sigue viendo el color del equipo. En blanco y negro, punteado con borde negro.
const BIB_PATH = "M-0.42,-1.1 L-0.2,-1.1 L0,-0.42 L0.2,-1.1 L0.42,-1.1 C0.42,-0.5 0.55,-0.12 0.68,0.05 L0.68,1.1 L-0.68,1.1 L-0.68,0.05 C-0.55,-0.12 -0.42,-0.5 -0.42,-1.1 Z";
function Bib({ color, bn }) {
  // los hombros y el escote van al lado contrario de los pies (pedido por Nacho el 29/10/2026)
  return (
    <g clipPath="url(#chip-clip)" transform="scale(1 -1)">
      <path d={BIB_PATH} fill={bn ? "url(#bn-dots)" : color} stroke={bn ? "#111111" : "#000000"} strokeOpacity={bn ? 1 : 0.28} strokeWidth={0.07} />
      {!bn && <path d={BIB_PATH} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.04} transform="translate(0 0.05)" />}
    </g>
  );
}

// Ficha dibujada: sombra, pies (si los tiene), cuerpo con su dibujo y relieve, borde y texto de dentro
// Color más oscuro (para el canto de las fichas en perspectiva)
export function darken(hex, f = 0.38) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#374151";
  const n = parseInt(m[1], 16);
  const ch = (v) => Math.round(v * (1 - f)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

// `puck` > 0 (solo en perspectiva): la ficha es un disco con grosor; la cara de arriba queda en c y el suelo (sombra, pies) `puck` más abajo
function Chip({ el, ctx, c, r, ghost = false, puck = 0 }) {
  const { board, look, orient } = ctx;
  const s = styleOf(look);
  const paint = chipPaint(board, el, look);
  const bn = lookOf(look) === "bn";
  // grosor del borde: el normal × lo elegido en la ficha o en su equipo (0 = sin borde)
  const sw = Math.max(0.2, r * 0.13) * (paint.edge ?? 1);
  const ang = faceOf(el) + orientAngle(orient);
  const inner = (el.inner || "").toString().slice(0, 3);
  const fs = r * (inner.length > 2 ? 0.95 : inner.length > 1 ? 1.2 : 1.5) * chipTextScale(el, "inner");
  const shadow = ghost ? 0 : s.shadow || 0;
  // con peto, el dorsal se lee sobre el color del peto
  const bib = el.bib ? (bn ? { text: "#111111", halo: "#ffffff" } : { text: contrastColor(el.bib), halo: contrastColor(el.bib) === "#ffffff" ? "#111827" : "#ffffff" }) : null;
  const gy = c.y + puck; // suelo
  return (
    <>
      {shadow > 0 && <circle cx={c.x + SHADOW.x * r} cy={gy + SHADOW.y * r} r={r * 1.14} fill="url(#chip-shadow)" fillOpacity={shadow} />}
      {el.feet && <g transform={`translate(${c.x} ${gy}) rotate(${ang}) scale(${r})`}><Feet foot={s.foot} flat={bn} shadow={shadow} ang={ang} /></g>}
      {puck > 0 && (
        <g>
          <path d={`M ${c.x - r} ${c.y} L ${c.x - r} ${gy} A ${r} ${r} 0 0 0 ${c.x + r} ${gy} L ${c.x + r} ${c.y} Z`} fill={bn ? "#ffffff" : darken(paint.color)} stroke={sw > 0 ? (bn ? "#111111" : paint.stroke) : "none"} strokeWidth={sw} strokeLinejoin="round" />
          {!bn && <path d={`M ${c.x - r} ${c.y} L ${c.x - r} ${gy} A ${r} ${r} 0 0 0 ${c.x + r} ${gy} L ${c.x + r} ${c.y} Z`} fill="url(#puck-side)" />}
        </g>
      )}
      <g transform={`translate(${c.x} ${c.y}) scale(${r})`}><ChipBody paint={paint} bn={bn} sw={sw / r} /></g>
      {el.bib && <g transform={`translate(${c.x} ${c.y}) rotate(${ang}) scale(${r})`}><Bib color={el.bib} bn={bn} /></g>}
      {!bn && <circle cx={c.x} cy={c.y} r={r} fill="url(#chip-shade)" />}
      {!bn && <ellipse cx={c.x - r * 0.3} cy={c.y - r * 0.42} rx={r * 0.5} ry={r * 0.32} fill="url(#chip-gloss)" />}
      {!bn && sw > 0 && <circle cx={c.x} cy={c.y} r={r} fill="none" stroke={paint.stroke} strokeWidth={sw} />}
      {inner && !ghost && (
        (() => {
          const lk = chipTextLook(el, "inner");
          const halo = lk.halo === "none" ? "none" : !bn && lk.halo ? lk.halo : bib ? bib.halo : paint.halo;
          return <text x={c.x} y={c.y + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={lk.bold ? 800 : 500} fill={!bn && lk.color ? lk.color : bib ? bib.text : paint.text} stroke={halo} strokeWidth={halo === "none" ? 0 : Math.max(0.12, fs * (paint.pattern === "solid" || bn ? 0.09 : 0.16) * (lk.halo && lk.halo !== "none" ? 1.6 : 1))} paintOrder="stroke" style={{ fontFamily: lk.font }}>{inner}</text>;
        })()
      )}
    </>
  );
}

// Ficha pequeña para botones y paneles (con el diseño del equipo o de la ficha)
export function ChipGlyph({ board, el, look = "blanco", size = 18 }) {
  const paint = chipPaint(board, el, look);
  const bn = lookOf(look) === "bn";
  return (
    <svg width={size} height={size} viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <clipPath id="chip-clip"><circle r="1" /></clipPath>
        <pattern id="bn-stripes" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#fff" /><rect width="0.8" height="1.6" fill="#111" /></pattern>
        <pattern id="bn-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#111" strokeWidth="0.3" /></pattern>
        <pattern id="bn-dots" width="1.4" height="1.4" patternUnits="userSpaceOnUse"><rect width="1.4" height="1.4" fill="#fff" /><circle cx="0.7" cy="0.7" r="0.3" fill="#111" /></pattern>
        <ChipDefs />
      </defs>
      <ChipBody paint={paint} bn={bn} sw={0.18 * (paint.edge ?? 1)} />
      {el.bib && <Bib color={el.bib} bn={bn} />}
      {!bn && <circle r={1} fill="url(#chip-shade)" />}
      {!bn && <ellipse cx={-0.3} cy={-0.42} rx={0.5} ry={0.32} fill="url(#chip-gloss)" />}
      {!bn && (paint.edge ?? 1) > 0 && <circle r={1} fill="none" stroke={paint.stroke} strokeWidth={0.18 * (paint.edge ?? 1)} />}
    </svg>
  );
}

// Balón: color, dibujo y borde editables. Sin estilo guardado es el de siempre (punto central).
// Dibujo de cada modelo de balón en un círculo de radio 1 (recortado al círculo). Diseños propios, sin marcas:
//  · classic: pentágono en el centro, cinco medio asomando por el borde y las costuras de los hexágonos
//  · modern: cuatro paneles curvos en aspa con un ribete fino
//  · helix: tres aspas curvas que giran desde el centro
//  · seams: balón de entreno, las costuras y los pentágonos apenas teñidos
const PENT = [0, 1, 2, 3, 4].map((i) => { const a = ((-90 + i * 72) * Math.PI) / 180; return [Math.cos(a), Math.sin(a)]; });
const f3 = (v) => v.toFixed(3);
function BallArt({ pattern, ink, seam }) {
  const pent = (r, cx = 0, cy = 0, rot = 0, sq = 1) => PENT.map(([x, y]) => {
    const a = (rot * Math.PI) / 180, X = x * r, Y = y * r * sq;
    return `${f3(cx + X * Math.cos(a) - Y * Math.sin(a))},${f3(cy + X * Math.sin(a) + Y * Math.cos(a))}`;
  }).join(" ");
  if (pattern === "dot") return <circle r={0.36} fill={ink} />;
  if (pattern === "stripe") return <rect x={-1} y={-0.28} width={2} height={0.56} fill={ink} />;
  if (pattern === "plain") return null;
  if (pattern === "classic" || pattern === "seams") {
    const edge = [0, 1, 2, 3, 4].map((i) => -54 + i * 72);
    const lines = [];
    PENT.forEach(([x, y]) => {
      const a = Math.atan2(y, x);
      lines.push(`M ${f3(x * 0.36)} ${f3(y * 0.36)} L ${f3(Math.cos(a) * 0.66)} ${f3(Math.sin(a) * 0.66)}`);
      [-1, 1].forEach((sg) => { const b = a + sg * 0.5; lines.push(`M ${f3(Math.cos(a) * 0.66)} ${f3(Math.sin(a) * 0.66)} L ${f3(Math.cos(b) * 0.84)} ${f3(Math.sin(b) * 0.84)}`); });
    });
    const fillP = pattern === "classic";
    return (
      <>
        <path d={lines.join(" ")} stroke={seam} strokeWidth={0.05} strokeLinecap="round" fill="none" />
        <polygon points={pent(0.36)} fill={ink} fillOpacity={fillP ? 1 : 0.16} stroke={seam} strokeWidth={fillP ? 0.04 : 0.06} strokeLinejoin="round" />
        {edge.map((deg, i) => {
          const a = (deg * Math.PI) / 180;
          return <polygon key={i} points={pent(0.34, Math.cos(a) * 1.0, Math.sin(a) * 1.0, deg + 90, 0.6)} fill={ink} fillOpacity={fillP ? 1 : 0.16} stroke={seam} strokeWidth={fillP ? 0.04 : 0.06} strokeLinejoin="round" />;
        })}
      </>
    );
  }
  if (pattern === "modern") {
    const blade = "M 0.12 -0.12 C 0.25 -0.62 0.62 -0.98 1.05 -0.9 C 0.74 -0.66 0.46 -0.3 0.12 -0.12 Z";
    return (
      <>
        {[0, 90, 180, 270].map((d) => <path key={d} d={blade} transform={`rotate(${d})`} fill={ink} stroke={seam} strokeWidth={0.05} strokeLinejoin="round" />)}
        {[45, 135, 225, 315].map((d) => <path key={`s${d}`} d="M 0 0 L 0 -1.05" transform={`rotate(${d})`} stroke={seam} strokeWidth={0.04} />)}
        <circle r={0.16} fill="none" stroke={seam} strokeWidth={0.05} />
      </>
    );
  }
  if (pattern === "helix") {
    const blade = "M 0 0 C 0.38 -0.08 0.62 -0.42 0.58 -1.05 C 0.84 -0.74 0.86 -0.3 0.66 0.06 C 0.46 -0.02 0.24 0.02 0 0 Z";
    return (
      <>
        {[0, 120, 240].map((d) => <path key={d} d={blade} transform={`rotate(${d})`} fill={ink} stroke={seam} strokeWidth={0.05} strokeLinejoin="round" />)}
        <circle r={0.13} fill={ink} stroke={seam} strokeWidth={0.04} />
      </>
    );
  }
  return null;
}
function BallBody({ el, c, r, look, shadow = 0 }) {
  const s = styleOf(look);
  const bn = lookOf(look) === "bn";
  const bs = ballStyle(el);
  const fill = bn ? "#ffffff" : bs.color;
  const ink = bn ? "#111111" : el.color2 || s.ball.stroke;
  const stroke = bn ? "#111111" : bs.stroke || mixHex(contrastColor(fill) === "#ffffff" ? "#ffffff" : "#111827", fill.length === 7 ? fill : "#ffffff", 0.35);
  const seam = mixHex(ink.length === 7 ? ink : "#111827", fill.length === 7 ? fill : "#ffffff", 0.45);
  return (
    <>
      {shadow > 0 && <ellipse cx={c.x + SHADOW.x * r * 1.3} cy={c.y + SHADOW.y * r * 1.3} rx={r * 1.08} ry={r * 0.98} fill="url(#chip-shadow)" fillOpacity={shadow * 1.1} />}
      <g transform={`translate(${c.x} ${c.y}) scale(${r})`}>
        <circle r={1} fill={fill} />
        <g clipPath="url(#chip-clip)"><BallArt pattern={bs.pattern} ink={ink} seam={seam} /></g>
        {!bn && <circle r={1} fill="url(#ball-shade)" />}
        {!bn && <ellipse cx={-0.36} cy={-0.42} rx={0.3} ry={0.2} transform="rotate(-35 -0.36 -0.42)" fill="#ffffff" fillOpacity={0.55} />}
        <circle r={1} fill="none" stroke={stroke} strokeWidth={bn ? 0.12 : 0.09} />
      </g>
    </>
  );
}
/** Balón pequeño para el selector de modelos */
export function BallGlyph({ pattern, color = "#ffffff", color2 = "#111827", size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="-1.15 -1.15 2.3 2.3" aria-hidden="true">
      <defs><clipPath id="chip-clip"><circle r="1" /></clipPath><ChipDefs /></defs>
      <BallBody el={{ pattern, color, color2 }} c={{ x: 0, y: 0 }} r={1} look="blanco" />
    </svg>
  );
}

// Material con giro: pica, valla, escalera de coordinación y maniquí. Se dibuja en su sitio con la parte de «arriba» hacia −y.
function MaterialBody({ el, look, rot = 0, shadow = 0 }) {
  const mat = materialOf(el.k);
  const bn = lookOf(look) === "bn";
  const k = Number(el.size) || 1;
  const col = bn ? "#111111" : el.color || mat.color;
  const edge = bn ? "#111111" : look === "color" || look === "color-cuadros" ? "#ffffff" : "#111827";
  const sh = (h) => lightVec(rot, h * k);
  switch (el.k) {
    case "pole":
      return (
        <>
          <Shadow amount={shadow} v={sh(0.7)}>{(g) => <line x1={0} y1={1.35 * k} x2={0} y2={-1.5 * k} stroke="#000" strokeWidth={0.62 * k + g} strokeLinecap="round" />}</Shadow>
          <ellipse cx={0} cy={1.35 * k} rx={0.8 * k} ry={0.42 * k} fill={bn ? "#ffffff" : col} fillOpacity={bn ? 1 : 0.55} stroke={edge} strokeWidth={0.18} />
          <line x1={0} y1={1.35 * k} x2={0} y2={-1.5 * k} stroke={edge} strokeWidth={0.62 * k + 0.2} strokeLinecap="round" />
          <line x1={0} y1={1.35 * k} x2={0} y2={-1.5 * k} stroke={bn ? "#ffffff" : col} strokeWidth={0.62 * k} strokeLinecap="round" />
          <line x1={0} y1={-0.6 * k} x2={0} y2={-1.5 * k} stroke={bn ? "#111111" : "#ffffff"} strokeWidth={0.62 * k} strokeLinecap="butt" strokeOpacity={bn ? 1 : 0.9} />
          {!bn && <line x1={-0.14 * k} y1={1.2 * k} x2={-0.14 * k} y2={-1.35 * k} stroke="#ffffff" strokeOpacity={0.4} strokeWidth={0.16 * k} strokeLinecap="round" />}
        </>
      );
    case "hurdle":
      return (
        <>
          <Shadow amount={shadow} v={sh(0.5)}>
            {(g) => (
              <>
                {[-1, 1].map((sx) => <line key={sx} x1={sx * 1.35 * k} y1={-0.95 * k} x2={sx * 1.35 * k} y2={0.95 * k} stroke="#000" strokeWidth={0.5 * k + g} strokeLinecap="round" />)}
                <line x1={-1.35 * k} y1={0} x2={1.35 * k} y2={0} stroke="#000" strokeWidth={0.5 * k + g} strokeLinecap="round" />
              </>
            )}
          </Shadow>
          {[-1, 1].map((sx) => <line key={sx} x1={sx * 1.35 * k} y1={-0.95 * k} x2={sx * 1.35 * k} y2={0.95 * k} stroke={edge} strokeWidth={0.5 * k + 0.2} strokeLinecap="round" />)}
          <line x1={-1.35 * k} y1={0} x2={1.35 * k} y2={0} stroke={edge} strokeWidth={0.5 * k + 0.2} strokeLinecap="round" />
          {[-1, 1].map((sx) => <line key={`c${sx}`} x1={sx * 1.35 * k} y1={-0.95 * k} x2={sx * 1.35 * k} y2={0.95 * k} stroke={bn ? "#ffffff" : col} strokeWidth={0.5 * k} strokeLinecap="round" />)}
          <line x1={-1.35 * k} y1={0} x2={1.35 * k} y2={0} stroke={bn ? "#ffffff" : col} strokeWidth={0.5 * k} strokeLinecap="round" />
        </>
      );
    case "ladder": {
      const hw = 0.85 * k, hh = 3.1 * k, n = ladderRungs(el);
      const ys = [];
      for (let i = 0; i <= n; i++) ys.push(-hh + (i * 2 * hh) / n);
      return (
        <>
          <Shadow amount={shadow * 0.8} v={sh(0.22)} halo={0.25}>
            {(g) => (
              <>
                {ys.map((y, i) => <line key={i} x1={-hw} y1={y} x2={hw} y2={y} stroke="#000" strokeWidth={0.28 + g} />)}
                <line x1={-hw} y1={-hh} x2={-hw} y2={hh} stroke="#000" strokeWidth={0.4 + g} strokeLinecap="round" />
                <line x1={hw} y1={-hh} x2={hw} y2={hh} stroke="#000" strokeWidth={0.4 + g} strokeLinecap="round" />
              </>
            )}
          </Shadow>
          <rect x={-hw} y={-hh} width={2 * hw} height={2 * hh} fill={bn ? "#ffffff" : col} fillOpacity={bn ? 1 : 0.1} />
          {ys.map((y, i) => <line key={i} x1={-hw} y1={y} x2={hw} y2={y} stroke={col} strokeWidth={0.28} strokeLinecap="butt" />)}
          <line x1={-hw} y1={-hh} x2={-hw} y2={hh} stroke={col} strokeWidth={0.4} strokeLinecap="round" />
          <line x1={hw} y1={-hh} x2={hw} y2={hh} stroke={col} strokeWidth={0.4} strokeLinecap="round" />
        </>
      );
    }
    case "dummy":
      return (
        <>
          <Shadow amount={shadow} v={sh(0.55)}>
            {(g) => (
              <>
                <ellipse cx={0} cy={0.15 * k} rx={1.25 * k + g / 2} ry={0.75 * k + g / 2} fill="#000" />
                <circle cx={0} cy={-0.05 * k} r={0.5 * k + g / 2} fill="#000" />
              </>
            )}
          </Shadow>
          <ellipse cx={0} cy={0.15 * k} rx={1.25 * k} ry={0.75 * k} fill={bn ? "#ffffff" : col} stroke={edge} strokeWidth={0.28} />
          {!bn && <ellipse cx={0} cy={0.15 * k} rx={1.25 * k} ry={0.75 * k} fill="url(#chip-shade)" />}
          <circle cx={0} cy={-0.05 * k} r={0.5 * k} fill={bn ? "#ffffff" : col} stroke={edge} strokeWidth={0.25} />
          {!bn && <circle cx={0} cy={-0.05 * k} r={0.5 * k} fill="url(#chip-shade)" />}
        </>
      );
    default: return null;
  }
}

// `part` (solo en perspectiva): "body" = la ficha tumbada (se dibuja aplastada) y "labels" = sus textos de arriba y abajo (de pie);
// `pq` = cuánto se aplasta en ese punto (alto/ancho) para colocar los textos justo encima y debajo del disco
function Piece({ el, ctx, selected, ghost = false, part = null, pq = 1 }) {
  const { board, field, orient, look } = ctx;
  const s = styleOf(look);
  const c = toView(field, orient, el);
  const op = (el.opacity ?? 1) * (ghost ? 0.3 : 1);
  const ring = (r) => selected && !ghost && <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="#f59e0b" strokeWidth={1.4 * (ctx.px || 0.12)} strokeDasharray={`${3.5 * (ctx.px || 0.12)} ${2.5 * (ctx.px || 0.12)}`} />;
  const mat = materialOf(el.k);
  if (mat) {
    const k = Number(el.size) || 1;
    const rot = (el.rot || 0) + orientAngle(orient);
    return (
      <g opacity={op} transform={`translate(${c.x} ${c.y}) rotate(${rot})`}>
        {selected && !ghost && <rect x={-mat.hw * k - 0.9} y={-mat.hh * k - 0.9} width={2 * mat.hw * k + 1.8} height={2 * mat.hh * k + 1.8} fill="none" stroke="#f59e0b" strokeWidth={1.4 * (ctx.px || 0.12)} strokeDasharray={`${3.5 * (ctx.px || 0.12)} ${2.5 * (ctx.px || 0.12)}`} />}
        <MaterialBody el={el} look={look} rot={rot} shadow={ghost ? 0 : s.shadow || 0} />
      </g>
    );
  }
  switch (el.k) {
    case "token": {
      const r = tokenR(ctx.chip, el);
      const fs = Math.max(1.8, r * 1.25);
      // con los pies hacia abajo, el nombre baja un poco para no taparlos
      const a = ((faceOf(el) + orientAngle(orient)) * Math.PI) / 180;
      const down = el.feet ? Math.max(0, -Math.cos(a)) * r * 0.45 : 0;
      // y con los pies hacia arriba, el texto de arriba sube
      const up = el.feet ? Math.max(0, Math.cos(a)) * r * 0.45 : 0;
      if (part === "body") {
        const puck = r * 0.42 / pq; // grosor del disco: ~0,42 radios en pantalla
        return (
          <g opacity={op}>
            {ring(r * (el.feet ? 1.5 : 1) + 1.3)}
            <Chip el={el} ctx={ctx} c={c} r={r} ghost={ghost} puck={puck} />
          </g>
        );
      }
      const lbg = labelBgOf(board, el);
      const lk = chipTextLook(el, "label");
      const bnL = lookOf(look) === "bn";
      const lHalo = lbg || lk.halo === "none" ? "none" : !bnL && lk.halo ? lk.halo : s.label.stroke;
      const tag = (line, y, key, fs) => {
        const own = line.which === "fn" && !bnL && el.fnColor ? el.fnColor : null;
        const col = own || (!bnL && lk.color ? lk.color : null);
        return (
          <React.Fragment key={key}>
            <TextBg x={c.x} y={y} text={line.text} fs={fs} bold={lk.bold} bg={lbg} alpha={el.labelBgOpacity} look={look} />
            <text x={c.x} y={y} textAnchor="middle" fontSize={fs} fontWeight={lk.bold ? 700 : 400} fill={lbg ? inkOnBg(lbg, col, look) : col || s.label.fill} stroke={lHalo} strokeWidth={lHalo === "none" ? 0 : lk.halo ? Math.max(0.55, fs * 0.2) : 0.55} paintOrder="stroke" style={{ fontFamily: lk.font }}>{line.text}</text>
          </React.Fragment>
        );
      };
      // textos de arriba (de la ficha hacia arriba) y de abajo (de la ficha hacia abajo): nombre, función y texto de encima
      const lines = chipLines(el);
      const stack = (list, anchor, dir, key) => {
        const sizes = list.map((l) => fs * chipTextScale(el, l.which));
        const ys = stackBaselines(sizes, anchor, dir);
        return list.map((l, i) => tag(l, ys[i], `${key}${i}`, sizes[i]));
      };
      if (part === "labels") {
        // de pie, en la escala de la ficha: el disco mide r·pq de alto y su canto 0,42·r
        return (
          <g opacity={op}>
            {!ghost ? stack(lines.top, c.y - (r + up) * pq, -1, "t") : null}
            {!ghost ? stack(lines.bottom, c.y + (r + down) * pq + r * 0.42, 1, "b") : null}
          </g>
        );
      }
      return (
        <g opacity={op}>
          {ring(r * (el.feet ? 1.5 : 1) + 1.3)}
          <Chip el={el} ctx={ctx} c={c} r={r} ghost={ghost} />
          {!ghost ? stack(lines.top, c.y - r - up, -1, "t") : null}
          {!ghost ? stack(lines.bottom, c.y + r + down, 1, "b") : null}
        </g>
      );
    }
    case "ball": {
      const r = ballR(ctx.chip) * (Number(el.size) || 1);
      return (
        <g opacity={op}>
          {ring(r + 1.2)}
          <BallBody el={el} c={c} r={r} look={look} shadow={ghost ? 0 : s.shadow || 0} />
        </g>
      );
    }
    case "cone": {
      const k = Number(el.size) || 1;
      const col = look === "bn" ? s.cone : el.color || s.cone;
      const bn = look === "bn";
      const sd = ghost ? 0 : s.shadow || 0;
      const tri = `${c.x},${c.y - 1.5 * k} ${c.x + 1.3 * k},${c.y + 1.1 * k} ${c.x - 1.3 * k},${c.y + 1.1 * k}`;
      // borde: color y grosor elegibles (03/11/2026, Nacho: «el cono plano tiene un borde muy ancho»); el grosor va con el tamaño
      const edgeCol = bn ? s.coneStroke : el.stroke || s.coneStroke;
      const ew = coneEdgeWidth(el);
      return (
        <g opacity={op}>
          {ring(2.4 * k)}
          {el.shape === "flat" ? (
            <>
              <Shadow amount={sd} v={lightVec(0, 0.22 * k)} halo={0.3}>{(g) => <circle cx={c.x} cy={c.y} r={0.9 * k + g / 2} fill="#000" />}</Shadow>
              <circle cx={c.x} cy={c.y} r={0.9 * k} fill={col} stroke={ew > 0 ? edgeCol : "none"} strokeWidth={ew} />
              {!bn && <circle cx={c.x} cy={c.y} r={0.9 * k} fill="url(#chip-shade)" />}
            </>
          ) : (
            <>
              <Shadow amount={sd} v={lightVec(0, 0.42 * k)}>{(g) => <polygon points={tri} fill="#000" stroke="#000" strokeWidth={g} strokeLinejoin="round" />}</Shadow>
              <polygon points={tri} fill={col} stroke={ew > 0 ? edgeCol : "none"} strokeWidth={ew} strokeLinejoin="round" />
              {!bn && <polygon points={tri} fill="url(#cone-shade)" />}
            </>
          )}
        </g>
      );
    }
    case "goal": {
      const gw = el.w || 7.32;
      const { h, gd } = goalDims(gw);
      const rot = (el.rot || 0) + orientAngle(orient);
      const bn = look === "bn";
      const col = bn ? s.goal.stroke : el.color || goalFrame(s);
      // Vista desde arriba: la boca (postes y larguero) en el borde de abajo del recuadro y la red hacia atrás
      return (
        <g opacity={op} transform={`translate(${c.x} ${c.y}) rotate(${rot})`}>
          {selected && !ghost && <rect x={-gw / 2 - 1.2} y={-gd / 2 - 1.1} width={gw + 2.4} height={gd + 2.2} fill="none" stroke="#f59e0b" strokeWidth={1.4 * (ctx.px || 0.12)} strokeDasharray={`${3.5 * (ctx.px || 0.12)} ${2.5 * (ctx.px || 0.12)}`} />}
          <GoalShape gw={gw} gd={gd} h={h} frame={col} net={goalNet(s)} proj={(px, py) => ({ x: px, y: py + gd / 2 })} shadow={ghost ? 0 : s.shadow || 0} sv={lightVec(rot, h * 0.3)} />
        </g>
      );
    }
    default: return null;
  }
}

function Zone({ el, ctx, selected }) {
  const { look } = ctx;
  const s = styleOf(look);
  const toV = ctx.V;
  const quad = isQuad(el);
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
  // marca de elegida fina (1,2 px) y pegada a la zona, con los tiradores encima (03/11/2026: antes era un marco grueso por fuera)
  const u = ctx.px || 0.12;
  const mark = { fill: "none", stroke: "#f59e0b", strokeWidth: 1.2 * u, strokeDasharray: `${4 * u} ${3 * u}` };
  const halo = { fill: "none", stroke: "#f59e0b", strokeWidth: sw + 5 * u, strokeLinejoin: "round", opacity: 0.45 };
  if (quad) {
    const pts = el.pts.map(toV).map((q) => `${q.x},${q.y}`).join(" ");
    return (
      <g>
        {/* la marca de selección va por detrás (como la de las flechas) para no tapar el color del borde elegido */}
        {selected && <polygon points={pts} {...halo} />}
        <polygon points={pts} strokeLinejoin="round" {...common} />
      </g>
    );
  }
  const { x0, y0, x1, y1 } = zoneBox(el);
  if (ctx.persp) {
    // en perspectiva la zona es el contorno proyectado (un rectángulo se ve como un trapecio y la elipse, aplastada)
    const ring = el.shape === "ellipse"
      ? Array.from({ length: 48 }, (_, i) => { const t = (i / 48) * Math.PI * 2; return { x: (x0 + x1) / 2 + Math.cos(t) * (x1 - x0) / 2, y: (y0 + y1) / 2 + Math.sin(t) * (y1 - y0) / 2 }; })
      : [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    const pts = ring.map(toV).map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ");
    return (
      <g>
        {selected && <polygon points={pts} {...halo} />}
        <polygon points={pts} strokeLinejoin="round" {...common} />
      </g>
    );
  }
  const a = toV({ x: x0, y: y0 }), b = toV({ x: x1, y: y1 });
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
  const pad = (border ? sw / 2 : 0) + 1.5 * u;
  return (
    <g>
      {el.shape === "ellipse" ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} /> : <rect x={x} y={y} width={w} height={h} {...common} />}
      {selected && (el.shape === "ellipse"
        ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2 + pad} ry={h / 2 + pad} {...mark} />
        : <rect x={x - pad} y={y - pad} width={w + 2 * pad} height={h + 2 * pad} {...mark} />)}
    </g>
  );
}

// Conector entre fichas: línea, zona o red según el tipo; su forma sale de dónde estén las fichas en ese momento.
function Link({ el, ctx, els, selected }) {
  const { look } = ctx;
  const s = styleOf(look);
  const g = linkShape(el, els);
  if (!g) return null;
  const lp = linkProps(el);
  const toV = ctx.V;
  const bn = look === "bn";
  const col = bn ? s.link : el.color || s.link;
  const sw = lp.width;
  const dash = dashArray(lp.dash, sw * 1.4);
  const stroke = { stroke: col, strokeWidth: sw, strokeDasharray: dash, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  const halo = { stroke: "#f59e0b", strokeWidth: sw + 1.6, opacity: 0.5, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  let body = null;
  if (g.kind === "zone") {
    const pts = g.poly.map(toV).map((q) => `${q.x},${q.y}`).join(" ");
    body = (
      <>
        {selected && <polygon points={pts} {...halo} />}
        <polygon points={pts} {...stroke} stroke={lp.border ? col : "none"} fill={lp.fillOpacity > 0 ? (bn ? "url(#bn-hatch)" : col) : "none"} fillOpacity={bn ? 1 : lp.fillOpacity} />
      </>
    );
  } else if (g.kind === "line") {
    const d = pathOf(g.pts.map(toV)) + (g.closed ? " Z" : "");
    body = (
      <>
        {selected && <path d={d} {...halo} />}
        <path d={d} {...stroke} />
      </>
    );
  } else {
    const d = g.segs.map(([a, b]) => { const p = toV(a), q = toV(b); return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} L ${q.x.toFixed(2)} ${q.y.toFixed(2)}`; }).join(" ");
    body = (
      <>
        {selected && <path d={d} {...halo} />}
        <path d={d} {...stroke} />
      </>
    );
  }
  return <g opacity={el.opacity ?? 1}>{body}</g>;
}

// Esquinas de una zona libre para arrastrarlas (van en la capa de encima, para que ninguna ficha las tape)
function QuadHandles({ el, ctx }) {
  const toV = ctx.V;
  const u = ctx.px || 0.12;
  return (
    <g>
      {el.pts.map((q, i) => { const c = toV(q); return <HandleDot key={`v${i}`} x={c.x} y={c.y} u={u} />; })}
      {el.pts.map((q, i) => { const c = toV(q); return <circle key={`h${i}`} data-h={`q${i}`} cx={c.x} cy={c.y} r={HIT * u} fill="transparent" />; })}
    </g>
  );
}

// Tiradores de una zona rectangular o elíptica: en las esquinas cambian ancho y alto a la vez (la esquina contraria se queda
// quieta) y en los lados solo el ancho o solo el alto; la figura sigue siendo un rectángulo o una elipse (no se deforma).
// Cuadraditos pequeños (7 px las esquinas, 6 px los lados) que miden lo mismo con cualquier zoom.
function ZoneHandles({ el, ctx }) {
  const toV = ctx.V;
  const u = ctx.px || 0.12;
  const { x0, y0, x1, y1 } = zoneBox(el);
  const corners = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const edges = [{ x: (x0 + x1) / 2, y: y0 }, { x: x1, y: (y0 + y1) / 2 }, { x: (x0 + x1) / 2, y: y1 }, { x: x0, y: (y0 + y1) / 2 }];
  const sq = (c, half, fill, key) => <rect key={key} x={c.x - half * u} y={c.y - half * u} width={2 * half * u} height={2 * half * u} rx={1.2 * u} fill={fill} stroke={fill === "#fff" ? "#f59e0b" : "#fff"} strokeWidth={1.2 * u} pointerEvents="none" />;
  return (
    <g data-testid="zone-handles">
      {edges.map((q, i) => sq(toV(q), 3, "#fff", `ev${i}`))}
      {corners.map((q, i) => sq(toV(q), 3.5, "#f59e0b", `cv${i}`))}
      {edges.map((q, i) => { const c = toV(q); return <circle key={`eh${i}`} data-h={`ze${i}`} cx={c.x} cy={c.y} r={(HIT - 1) * u} fill="transparent" />; })}
      {corners.map((q, i) => { const c = toV(q); return <circle key={`ch${i}`} data-h={`zc${i}`} cx={c.x} cy={c.y} r={HIT * u} fill="transparent" />; })}
    </g>
  );
}

// Fondo opcional de un texto (recuadro redondeado). En blanco y negro, blanco con borde negro fino.
function TextBg({ x, y, text, fs, bold, bg, alpha, look }) {
  if (!bg || !String(text || "").trim()) return null;
  const b = textBgBox(x, y, text, fs, bold);
  const bn = look === "bn";
  return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx} fill={bn ? "#ffffff" : bg} fillOpacity={bn ? 1 : alpha ?? 1} stroke={bn ? "#111111" : "#000000"} strokeOpacity={bn ? 1 : 0.14} strokeWidth={Math.max(0.12, fs * (bn ? 0.05 : 0.04))} pointerEvents="none" />;
}
// Letra sobre un fondo: el color elegido o el que mejor se lee sobre ese fondo; sin halo
const inkOnBg = (bg, color, look) => (look === "bn" ? "#111111" : color || contrastColor(bg));

function Text({ el, ctx, selected }) {
  const { field, orient, look } = ctx;
  const s = styleOf(look);
  const c = toView(field, orient, el);
  const fs = Number(el.size) || 3;
  const bold = el.bold !== false;
  const bg = el.bg && String(el.text || "").trim() ? el.bg : null;
  const fill = bg ? inkOnBg(bg, el.color, look) : look === "bn" ? s.textFill : el.color || s.textFill;
  return (
    <g opacity={el.opacity ?? 1}>
      <TextBg x={c.x} y={c.y} text={el.text} fs={fs} bold={bold} bg={bg} alpha={el.bgOpacity} look={look} />
      <text x={c.x} y={c.y} fontSize={fs} fontWeight={bold ? 700 : 400} fill={fill} stroke={bg ? "none" : s.textStroke} strokeWidth={bg ? 0 : Math.max(0.4, fs * 0.16)} paintOrder="stroke" textAnchor="middle" style={{ fontFamily: fontOf(el.font) }}>{el.text}</text>
      {selected && <rect x={c.x - Math.max(4, (el.text || "").length * fs * 0.3)} y={c.y - fs} width={Math.max(8, (el.text || "").length * fs * 0.6)} height={fs * 1.4} fill="none" stroke="#f59e0b" strokeWidth={1.4 * (ctx.px || 0.12)} strokeDasharray={`${3.5 * (ctx.px || 0.12)} ${2.5 * (ctx.px || 0.12)}`} />}
    </g>
  );
}

// Tirador para girar: un punto naranja sobre la propia ficha con pies (hacia dónde mira) o sobre el material (hacia dónde apunta)
function TurnHandle({ el, ctx }) {
  const c = toView(ctx.field, ctx.orient, el);
  const mat = materialOf(el.k);
  const base = mat ? mat.hh * (Number(el.size) || 1) + 0.6 : tokenR(ctx.chip, el) * 1.5;
  const a = (((mat ? el.rot || 0 : faceOf(el)) + orientAngle(ctx.orient)) * Math.PI) / 180;
  const u = ctx.px || 0.12;
  const R = base + Math.max(1.2, 16 * u);
  const hx = c.x + Math.sin(a) * R, hy = c.y - Math.cos(a) * R;
  return (
    <g>
      <line x1={c.x + Math.sin(a) * base} y1={c.y - Math.cos(a) * base} x2={hx} y2={hy} stroke="#f59e0b" strokeWidth={1.2 * u} />
      <HandleDot x={hx} y={hy} u={u} fill="#f59e0b" />
      <circle data-h={mat ? "r" : "f"} cx={hx} cy={hy} r={HIT * u} fill="transparent" />
    </g>
  );
}

// Números del orden en que se han ido tocando las fichas para un conector
function MarkNumbers({ ids, els, ctx }) {
  return (
    <g pointerEvents="none">
      {ids.map((id, i) => {
        const el = els.find((e) => e.id === id);
        if (!el) return null;
        const c = ctx.V(el);
        const r = (el.k === "token" ? tokenR(ctx.chip, el) : 1.2) * (ctx.persp ? ctx.persp.scaleAt(toView(ctx.field, ctx.orient, el)) * perspBoost(el) : 1);
        const bx = c.x + r * 0.85 + 0.2, by = c.y - r * 0.85 - 0.2;
        const fs = i >= 9 ? 1.25 : 1.5;
        return (
          <g key={id}>
            <circle cx={bx} cy={by} r={1.15} fill="#f59e0b" stroke="#fff" strokeWidth={0.3} />
            <text x={bx} y={by + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={800} fill="#fff" style={{ fontFamily: "Arial, sans-serif" }}>{i + 1}</text>
          </g>
        );
      })}
    </g>
  );
}

// Recuadro con el que se eligen varias fichas a la vez
// Caja que rodea a todo lo elegido cuando son varias cosas (se ve que se moverán juntas)
// Recuadro de elegir varios y marco del grupo elegido: línea continua fina (1 px de pantalla) y relleno muy suave
// (06/11/2026, Nacho: «que no tenga una línea discontinua y sea más fino y más sutil»)
const SEL_LINE = 1;
function GroupBox({ ids, els, ctx }) {
  const b = unionBounds(els.filter((e) => ids.includes(e.id)).map((e) => elementBounds(e, ctx.chip)));
  if (!b) return null;
  if (ctx.persp) {
    const pts = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }].map(ctx.V);
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
    const lo = { x: Math.min(...xs) - 1.2, y: Math.min(...ys) - 3 }, hi = { x: Math.max(...xs) + 1.2, y: Math.max(...ys) + 1.2 };
    return <rect x={lo.x} y={lo.y} width={hi.x - lo.x} height={hi.y - lo.y} fill="none" stroke="#f59e0b" strokeWidth={SEL_LINE * (ctx.px || 0.12)} opacity={0.7} pointerEvents="none" />;
  }
  const a = toView(ctx.field, ctx.orient, { x: b.x0, y: b.y0 }), c = toView(ctx.field, ctx.orient, { x: b.x1, y: b.y1 });
  const pad = 1.2;
  return <rect x={Math.min(a.x, c.x) - pad} y={Math.min(a.y, c.y) - pad} width={Math.abs(a.x - c.x) + 2 * pad} height={Math.abs(a.y - c.y) + 2 * pad} fill="none" stroke="#f59e0b" strokeWidth={SEL_LINE * (ctx.px || 0.12)} opacity={0.7} pointerEvents="none" />;
}
function BoxMark({ box, ctx }) {
  if (ctx.persp) {
    const pts = [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }].map(ctx.V);
    return <polygon points={pts.map((q) => `${q.x},${q.y}`).join(" ")} fill="#f59e0b" fillOpacity={0.06} stroke="#f59e0b" strokeOpacity={0.75} strokeWidth={SEL_LINE * (ctx.px || 0.12)} pointerEvents="none" />;
  }
  const a = toView(ctx.field, ctx.orient, { x: box.x, y: box.y }), b = toView(ctx.field, ctx.orient, { x: box.x + box.w, y: box.y + box.h });
  return <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(a.x - b.x)} height={Math.abs(a.y - b.y)} fill="#f59e0b" fillOpacity={0.06} stroke="#f59e0b" strokeOpacity={0.75} strokeWidth={SEL_LINE * (ctx.px || 0.12)} pointerEvents="none" />;
}

// Lo que está tumbado en el suelo se aplasta con la perspectiva (`lyingFlat`); lo demás (fichas, balón, picas, maniquíes, textos) se ve de pie.
// En perspectiva, un elemento de un punto se dibuja como siempre y se lleva a su sitio con su escala
export function perspWrap(el, ctx, flat = lyingFlat(el)) {
  const c = toView(ctx.field, ctx.orient, el);
  const b = perspBoost(el);
  const q = ctx.persp.P(c), k = ctx.persp.scaleAt(c) * b;
  const ky = flat ? ctx.persp.depthAt(c) * b : k;
  return `translate(${q.x.toFixed(3)} ${q.y.toFixed(3)}) scale(${k.toFixed(4)} ${ky.toFixed(4)}) translate(${(-c.x).toFixed(3)} ${(-c.y).toFixed(3)})`;
}
const isGround = isGroundEl;

// En perspectiva, una ficha es un disco tumbado en el suelo (con su canto y su sombra) y sus textos se leen de pie
export const squashAt = (el, ctx) => { const c = toView(ctx.field, ctx.orient, el); return ctx.persp.depthAt(c) / ctx.persp.scaleAt(c); };
function PerspToken({ el, ctx, selected, ghost = false }) {
  const pq = squashAt(el, ctx);
  return (
    <>
      <g transform={perspWrap(el, ctx, true)}><Piece el={el} ctx={ctx} selected={selected} ghost={ghost} part="body" pq={pq} /></g>
      <g transform={perspWrap(el, ctx, false)}><Piece el={el} ctx={ctx} selected={selected} ghost={ghost} part="labels" pq={pq} /></g>
    </>
  );
}

// Portería de material en perspectiva: de pie, con su altura (no aplastada en el suelo)
function PerspGoal({ el, ctx, selected }) {
  const s = styleOf(ctx.look);
  const gw = el.w || 7.32;
  const { h, gd } = goalDims(gw);
  const c = toView(ctx.field, ctx.orient, el);
  const a = (((el.rot || 0) + orientAngle(ctx.orient)) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const lift = (lx, ly, z = 0) => { const v = { x: c.x + lx * ca - ly * sa, y: c.y + lx * sa + ly * ca }; const q = ctx.persp.P(v); return { x: q.x, y: q.y - z * ctx.persp.scaleAt(v) }; };
  const bn = ctx.look === "bn";
  const col = bn ? s.goal.stroke : el.color || goalFrame(s);
  const box = [[-gw / 2 - 1.2, -gd / 2 - 1.1], [gw / 2 + 1.2, -gd / 2 - 1.1], [gw / 2 + 1.2, gd / 2 + 1.1], [-gw / 2 - 1.2, gd / 2 + 1.1]].map(([x, y]) => lift(x, y));
  return (
    <g opacity={el.opacity ?? 1}>
      {selected && <polygon points={box.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke="#f59e0b" strokeWidth={1.4 * (ctx.px || 0.12)} strokeDasharray={`${3.5 * (ctx.px || 0.12)} ${2.5 * (ctx.px || 0.12)}`} />}
      <GoalShape gw={gw} gd={gd} h={h} frame={col} net={goalNet(s)} flat={false} k={ctx.persp.scaleAt(c)} proj={(px, py, pz) => lift(px, py + gd / 2, pz)} />
    </g>
  );
}
// Resaltado (tecla H, como en FmStadio): halo amarillo en el suelo alrededor de una ficha, el balón o el material.
// Va en el suelo (en perspectiva, aplastado como el campo) y sale también en la imagen y el vídeo.
function HighlightHalo({ el, ctx }) {
  if (!el.hl || el.x == null || el.k === "zone" || el.k === "arrow" || el.k === "link") return null;
  const mat = materialOf(el.k);
  const r = el.k === "token" ? tokenR(ctx.chip, el) * 1.75 * (ctx.persp ? perspBoost(el) : 1)
    : el.k === "ball" ? ballR(ctx.chip) * (Number(el.size) || 1) * 2.4
    : el.k === "text" ? (Number(el.size) || 3) * 0.9
    : el.k === "goal" ? (el.w || 7.32) * 0.7
    : mat ? Math.max(mat.hw, mat.hh) * (Number(el.size) || 1) * 1.6 : 2.4 * (Number(el.size) || 1);
  const ring = (rr) => {
    if (!ctx.persp) { const c = toView(ctx.field, ctx.orient, el); return { cx: c.x, cy: c.y, rx: rr, ry: rr }; }
    const c = toView(ctx.field, ctx.orient, el), q = ctx.persp.P(c);
    return { cx: q.x, cy: q.y, rx: rr * ctx.persp.scaleAt(c), ry: rr * ctx.persp.depthAt(c) };
  };
  const a = ring(r), b = ring(r * 0.92);
  return (
    <g pointerEvents="none" opacity={el.opacity ?? 1}>
      <ellipse {...a} fill="url(#hl-glow)" />
      <ellipse {...b} fill="none" stroke="#ffd60a" strokeWidth={Math.max(0.18, r * 0.07)} strokeOpacity={0.95} />
    </g>
  );
}
export function Item({ el, ctx, els = [], selected = false, handles = false }) {
  if (el.hl) return <><HighlightHalo el={el} ctx={ctx} /><ItemInner el={el} ctx={ctx} els={els} selected={selected} handles={handles} /></>;
  return <ItemInner el={el} ctx={ctx} els={els} selected={selected} handles={handles} />;
}
function ItemInner({ el, ctx, els = [], selected = false, handles = false }) {
  if (ctx.persp && el.k === "token") return <PerspToken el={el} ctx={ctx} selected={selected} />;
  if (ctx.persp && el.k === "goal") return <PerspGoal el={el} ctx={ctx} selected={selected} />;
  if (ctx.persp && !isGround(el)) return <g transform={perspWrap(el, ctx)}><ItemFlat el={el} ctx={ctx} els={els} selected={selected} handles={handles} /></g>;
  return <ItemFlat el={el} ctx={ctx} els={els} selected={selected} handles={handles} />;
}
function ItemFlat({ el, ctx, els, selected, handles }) {
  if (el.k === "link") return <Link el={el} ctx={ctx} els={els} selected={selected} />;
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
const Board = React.forwardRef(function Board({ board, els, selId = null, selIds = null, marks = [], markNumbers = false, ghosts = [], draft = null, handles = false, className = "", style, label = "Dibujo", aspect = null, camera, frame = 0, fullView = false, viewOverride = null, overlay = null, ...rest }, ref) {
  // todo el recuadro (campo + margen) y lo que se ve: cámara del fotograma, zoom guardado o proporción fija
  const { field, orient, look, persp, fullVb, vb } = boardView(board, { camera, frame, aspect, fullView, viewOverride });
  const clipVb = `vbclip-${React.useId().replace(/:/g, "")}`;
  const V = persp ? (p) => persp.P(toView(field, orient, p)) : (p) => toView(field, orient, p);
  // Metros por píxel de pantalla (para que los tiradores midan siempre lo mismo en pantalla): solo con tiradores
  const svgEl = React.useRef(null);
  const setSvg = React.useCallback((n) => { svgEl.current = n; if (typeof ref === "function") ref(n); else if (ref) ref.current = n; }, [ref]);
  const [box, setBox] = React.useState(null);
  React.useLayoutEffect(() => {
    const n = svgEl.current;
    if (!handles || !n || typeof ResizeObserver === "undefined") return undefined;
    const m = () => setBox((b) => (b && b[0] === n.clientWidth && b[1] === n.clientHeight ? b : [n.clientWidth, n.clientHeight]));
    m();
    const ro = new ResizeObserver(m);
    ro.observe(n);
    return () => ro.disconnect();
  }, [handles]);
  const px = box && box[0] > 0 && box[1] > 0 ? Math.max(vb[2] / box[0], vb[3] / box[1]) : Math.max(vb[2], vb[3]) / 900;
  const ctx = { board, field, orient, look, chip: chipOf(board), persp, V, px };
  // En perspectiva, sin capas elegidas a mano, lo de atrás se pinta antes que lo de delante (dentro de cada tipo)
  const order = paintOrder(els, field, orient, persp);
  // Una sola cosa elegida (selId) o varias (selIds): con varias no hay tiradores, solo la marca de cada una y la caja del grupo
  const sel = selIds || (selId ? [selId] : []);
  const selEl = sel.length === 1 ? els.find((e) => e.id === sel[0]) : null;
  return (
    <svg ref={setSvg} xmlns="http://www.w3.org/2000/svg" viewBox={vb.join(" ")} className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} {...rest}>
      <defs>
        <pattern id="bn-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#111" strokeWidth="0.3" /></pattern>
        <pattern id="bn-stripes" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#fff" /><rect width="0.8" height="1.6" fill="#111" /></pattern>
        <pattern id="bn-dots" width="1.4" height="1.4" patternUnits="userSpaceOnUse"><rect width="1.4" height="1.4" fill="#fff" /><circle cx="0.7" cy="0.7" r="0.3" fill="#111" /></pattern>
        <clipPath id="chip-clip"><circle r="1" /></clipPath>
        <ChipDefs />
        <clipPath id="tq-clip"><rect x="-3" y="-3" width={field.w + 6} height={field.h + 3} /></clipPath>
        {/* lo que se ve en el editor es exactamente lo que sale en la imagen y el vídeo */}
        <clipPath id={clipVb}><rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} /></clipPath>
      </defs>
      <g clipPath={`url(#${clipVb})`}>
      {persp ? <FieldPersp field={field} orient={orient} look={look} vb={unionVb(fullVb, vb)} persp={persp} board={board} /> : <Field field={field} orient={orient} look={look} vb={unionVb(fullVb, vb)} board={board} />}
      {ghosts.map((g) => {
        const ghost = { ...g, x: g.from.x, y: g.from.y };
        const mine = handles && sel.length === 1 && sel[0] === g.id;
        const route = movePoints(g.from, g.to, g.path).map(V);
        return (
          <g key={`g${g.id}`}>
            <polyline points={route.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ")} fill="none" stroke={mine ? "#f59e0b" : styleOf(look).ink} strokeWidth={mine ? 0.42 : 0.3} strokeDasharray="0.9 0.9" opacity={mine ? 0.95 : 0.45} strokeLinejoin="round" />
            {persp ? (ghost.k === "token" ? <PerspToken el={ghost} ctx={ctx} ghost /> : <g transform={perspWrap(ghost, ctx)}><Piece el={ghost} ctx={ctx} ghost /></g>) : <Piece el={ghost} ctx={ctx} ghost />}
          </g>
        );
      })}
      {order.map((el) => <Item key={el.id} el={el} els={els} ctx={ctx} selected={sel.includes(el.id) || (el.k !== "link" && marks.includes(el.id))} handles={handles} />)}
      {handles && sel.length === 1 && ghosts.filter((g) => g.id === sel[0]).map((g) => <PathHandles key={`ph${g.id}`} g={g} V={V} u={px} />)}
      {handles && sel.length > 1 && <GroupBox ids={sel} els={els} ctx={ctx} />}
      {markNumbers && marks.length > 0 && <MarkNumbers ids={marks} els={els} ctx={ctx} />}
      {handles && selEl && isQuad(selEl) && <QuadHandles el={selEl} ctx={ctx} />}
      {handles && selEl && selEl.k === "zone" && !isQuad(selEl) && <ZoneHandles el={selEl} ctx={ctx} />}
      {handles && selEl && ((selEl.k === "token" && selEl.feet) || materialOf(selEl.k)) && (persp ? <g transform={perspWrap(selEl, ctx, selEl.k === "token" || lyingFlat(selEl))}><TurnHandle el={selEl} ctx={ctx} /></g> : <TurnHandle el={selEl} ctx={ctx} />)}
      {draft && draft.k === "box" && <BoxMark box={draft} ctx={ctx} />}
      {draft && draft.k !== "box" && <Item el={{ id: "draft", ...draft }} ctx={ctx} selected />}
      {overlay}
      </g>
    </svg>
  );
});
export default Board;

// ── Piezas para la vista 3D (src/lib/board3d.js): se pintan en 2D y se usan como texturas ─────────────────────────────
const SVG_DEFS = (
  <>
    <pattern id="bn-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#111" strokeWidth="0.3" /></pattern>
    <pattern id="bn-stripes" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#fff" /><rect width="0.8" height="1.6" fill="#111" /></pattern>
    <pattern id="bn-dots" width="1.4" height="1.4" patternUnits="userSpaceOnUse"><rect width="1.4" height="1.4" fill="#fff" /><circle cx="0.7" cy="0.7" r="0.3" fill="#111" /></pattern>
    <clipPath id="chip-clip"><circle r="1" /></clipPath>
    <ChipDefs />
  </>
);
/** Suelo del 3D: el campo en plano (vertical, ataca arriba), sin gradas ni vallas, en el recuadro `region` [x0, y0, x1, y1]. */
export function GroundSvg({ board, region }) {
  const b = { ...board, field: isCutField(board.field) ? "full" : board.field, view: undefined, orient: "v", stands: false, ads: false, cam: undefined, frames: [{ id: "g", els: [] }], _noGoals: true };
  return <Board board={b} els={[]} camera={null} viewOverride={[region[0], region[1], region[2] - region[0], region[3] - region[1]]} />;
}
/** Lo pintado en el suelo (zonas, flechas, conectores y lo que está tumbado) sobre fondo transparente, en el mismo recuadro. */
export function GroundMarksSvg({ board, els, all, region, sel = [] }) {
  const field = fieldOf(isCutField(board.field) ? "full" : board.field);
  const ctx = { board, field, orient: "v", look: lookOf(board.look), chip: chipOf(board), persp: null, V: (p) => p };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${region[0]} ${region[1]} ${region[2] - region[0]} ${region[3] - region[1]}`}>
      <defs>{SVG_DEFS}</defs>
      {paintOrder(els, field, "v", null).map((el) => <Item key={el.id} el={el} els={all || els} ctx={ctx} selected={sel.includes(el.id)} />)}
    </svg>
  );
}
/** Cara de arriba de una ficha (sin relieve: lo pone la luz del 3D). `ang` = hacia dónde mira el peto en pantalla; el dorsal, derecho. */
export function ChipTopSvg({ board, el, look, ang = 0 }) {
  const paint = chipPaint(board, el, look);
  const bn = lookOf(look) === "bn";
  const inner = (el.inner || "").toString().slice(0, 3);
  const fs = (inner.length > 2 ? 0.95 : inner.length > 1 ? 1.2 : 1.5) * chipTextScale(el, "inner");
  const bib = el.bib ? (bn ? { text: "#111111", halo: "#ffffff" } : { text: contrastColor(el.bib), halo: contrastColor(el.bib) === "#ffffff" ? "#111827" : "#ffffff" }) : null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 2 2">
      <defs>{SVG_DEFS}</defs>
      <rect x="-1" y="-1" width="2" height="2" fill={bn ? "#ffffff" : darken(paint.color)} />
      <ChipBody paint={paint} bn={bn} sw={0.12 * (paint.edge ?? 1)} />
      {el.bib && <g transform={`rotate(${ang})`}><Bib color={el.bib} bn={bn} /></g>}
      {!bn && <ellipse cx={-0.3} cy={-0.42} rx={0.5} ry={0.32} fill="url(#chip-gloss)" opacity={0.6} />}
      {(paint.edge ?? 1) > 0 && <circle r={1 - 0.05 * (paint.edge ?? 1)} fill="none" stroke={paint.stroke} strokeWidth={0.1 * (paint.edge ?? 1)} />}
      {inner && (() => {
        const lk = chipTextLook(el, "inner");
        const halo = lk.halo === "none" ? "none" : !bn && lk.halo ? lk.halo : bib ? bib.halo : paint.halo;
        return <text x={0} y={fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={lk.bold ? 800 : 500} fill={!bn && lk.color ? lk.color : bib ? bib.text : paint.text} stroke={halo} strokeWidth={halo === "none" ? 0 : Math.max(0.12, fs * (paint.pattern === "solid" || bn ? 0.09 : 0.16) * (lk.halo && lk.halo !== "none" ? 1.6 : 1))} paintOrder="stroke" style={{ fontFamily: lk.font }}>{inner}</text>;
      })()}
    </svg>
  );
}
