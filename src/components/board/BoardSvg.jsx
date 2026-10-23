import React from "react";
import {
  arrowFlight, arrowProps, arrowPoints, ballStyle, chipOf, chipStyle, contrastColor, dashArray, faceOf, drawOrder, elementBounds, fieldOf, fieldTurn, unionBounds, fontOf, isQuad, ladderRungs, linkProps, linkShape,
  lookOf, materialOf, orientAngle, orientOf, teamsOf, toView, tokenR, viewBox, wavyPoints, zoneBox,
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
const STYLE = {
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

// En blanco y negro cada equipo tiene su relleno (en el orden de los equipos): negro, blanco, gris, rayas, y luego más.
const BN_FILLS = ["#111111", "#ffffff", "#9ca3af", "url(#bn-stripes)", "#e5e7eb", "url(#bn-hatch)", "#4b5563", "url(#bn-dots)"];
const BN_DARK = new Set(["#111111", "#4b5563"]);

// Cómo se pinta una ficha: relleno (o dibujo de dos colores), borde y color del texto de dentro.
export function chipPaint(board, el, look) {
  if (lookOf(look) === "bn") {
    const i = Math.max(0, teamsOf(board).findIndex((t) => t.id === el.team));
    const color = BN_FILLS[i % BN_FILLS.length];
    const dark = BN_DARK.has(color);
    return { pattern: "solid", color, color2: color, stroke: "#111111", text: dark ? "#ffffff" : "#111111", halo: dark ? "#111111" : "#ffffff" };
  }
  const st = chipStyle(board, el);
  const text = contrastColor(st.color);
  return { ...st, stroke: st.stroke || styleOf(look).chipStroke, text, halo: text === "#ffffff" ? "#111827" : "#ffffff" };
}

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
  const tq = field.id === "tq";
  return (
    <g>
      <g clipPath={tq ? "url(#tq-clip)" : undefined}>
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
      {/* en el 3/4 el campo se corta antes de la línea de fondo: se cierra con una línea para que no quede un tramo sin pintar */}
      {tq && <line x1={0} y1={h} x2={w} y2={h} {...p} />}
    </g>
  );
}

function Field({ field, orient, look, vb }) {
  const s = styleOf(look);
  const bands = [];
  if (s.stripe) for (let y = 0; y < field.h; y += 14) bands.push(<rect key={y} x={0} y={y} width={field.w} height={Math.min(7, field.h - y)} fill={s.stripe} />);
  const free = field.id === "free";
  // Cuadrícula de segadora: casillas de unos 6 m que encajan justo en el ancho del campo
  const cols = Math.max(4, Math.round(field.w / 6.2)), cell = field.w / cols;
  const checkId = `chk-${lookOf(look)}-${field.w}`;
  return (
    <>
      <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill={free ? s.bg : s.margin || s.bg} />
      <g transform={fieldTurn(field, orient)}>
        {free ? null : <rect x={0} y={0} width={field.w} height={field.h} fill={s.bg} />}
        {free ? null : bands}
        {!free && s.check && (
          <>
            <defs>
              <pattern id={checkId} width={cell * 2} height={cell * 2} patternUnits="userSpaceOnUse">
                <rect x={0} y={0} width={cell} height={cell} fill={s.check} />
                <rect x={cell} y={cell} width={cell} height={cell} fill={s.check} />
              </pattern>
            </defs>
            <rect x={0} y={0} width={field.w} height={field.h} fill={`url(#${checkId})`} />
          </>
        )}
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
  return (
    <g opacity={(el.opacity ?? 1) * ap.alpha}>
      {/* sombra del balón en el suelo: pequeña y muy sutil (sin línea hasta el punto más alto) */}
      {ground && <path d={pathOf(ground)} fill="none" stroke="#000" strokeOpacity={0.13} strokeWidth={Math.max(0.5, w * 1.1)} strokeLinecap="round" strokeLinejoin="round" />}
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
    </g>
  );
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

// Ficha dibujada: sombra, pies (si los tiene), cuerpo con su dibujo y relieve, borde y texto de dentro
function Chip({ el, ctx, c, r, ghost = false }) {
  const { board, look, orient } = ctx;
  const s = styleOf(look);
  const paint = chipPaint(board, el, look);
  const bn = lookOf(look) === "bn";
  const sw = Math.max(0.2, r * 0.13);
  const ang = faceOf(el) + orientAngle(orient);
  const inner = (el.inner || "").toString().slice(0, 3);
  const fs = r * (inner.length > 2 ? 0.95 : inner.length > 1 ? 1.2 : 1.5);
  const shadow = ghost ? 0 : s.shadow || 0;
  return (
    <>
      {shadow > 0 && <circle cx={c.x + SHADOW.x * r} cy={c.y + SHADOW.y * r} r={r * 1.14} fill="url(#chip-shadow)" fillOpacity={shadow} />}
      {el.feet && <g transform={`translate(${c.x} ${c.y}) rotate(${ang}) scale(${r})`}><Feet foot={s.foot} flat={bn} shadow={shadow} ang={ang} /></g>}
      {paint.pattern === "solid" || bn ? (
        <circle cx={c.x} cy={c.y} r={r} fill={paint.color} stroke={bn ? paint.stroke : "none"} strokeWidth={sw} />
      ) : (
        <g transform={`translate(${c.x} ${c.y}) scale(${r})`}><ChipFill pattern={paint.pattern} color={paint.color} color2={paint.color2} /></g>
      )}
      {!bn && <circle cx={c.x} cy={c.y} r={r} fill="url(#chip-shade)" />}
      {!bn && <circle cx={c.x} cy={c.y} r={r} fill="none" stroke={paint.stroke} strokeWidth={sw} />}
      {inner && !ghost && (
        <text x={c.x} y={c.y + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={800} fill={paint.text} stroke={paint.halo} strokeWidth={Math.max(0.12, fs * (paint.pattern === "solid" || bn ? 0.09 : 0.16))} paintOrder="stroke" style={{ fontFamily: "Arial, sans-serif" }}>{inner}</text>
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
      {paint.pattern === "solid" || bn ? (
        <circle r={1} fill={paint.color} stroke={bn ? paint.stroke : "none"} strokeWidth={0.18} />
      ) : (
        <ChipFill pattern={paint.pattern} color={paint.color} color2={paint.color2} />
      )}
      {!bn && <circle r={1} fill="url(#chip-shade)" />}
      {!bn && <circle r={1} fill="none" stroke={paint.stroke} strokeWidth={0.18} />}
    </svg>
  );
}

// Balón: color, dibujo y borde editables. Sin estilo guardado es el de siempre (punto central).
function BallBody({ el, c, r, look, shadow = 0 }) {
  const s = styleOf(look);
  const bn = lookOf(look) === "bn";
  const bs = ballStyle(el);
  const fill = bn ? "#ffffff" : bs.color;
  const ink = bn ? "#111111" : el.color2 || s.ball.stroke;
  const stroke = bn ? "#111111" : bs.stroke || s.ball.stroke;
  const pent = [0, 1, 2, 3, 4].map((i) => { const a = ((-90 + i * 72) * Math.PI) / 180; return [Math.cos(a), Math.sin(a)]; });
  return (
    <>
      {shadow > 0 && <circle cx={c.x + SHADOW.x * r * 1.1} cy={c.y + SHADOW.y * r * 1.1} r={r * 1.12} fill="url(#chip-shadow)" fillOpacity={shadow} />}
      <circle cx={c.x} cy={c.y} r={r} fill={fill} />
      <g transform={`translate(${c.x} ${c.y}) scale(${r})`}>
        <g clipPath="url(#chip-clip)">
          {bs.pattern === "dot" && <circle r={0.36} fill={ink} />}
          {bs.pattern === "stripe" && <rect x={-1} y={-0.28} width={2} height={0.56} fill={ink} />}
          {bs.pattern === "classic" && (
            <>
              <polygon points={pent.map(([x, y]) => `${(x * 0.4).toFixed(3)},${(y * 0.4).toFixed(3)}`).join(" ")} fill={ink} />
              {pent.map(([x, y], i) => <line key={`s${i}`} x1={x * 0.4} y1={y * 0.4} x2={x * 0.8} y2={y * 0.8} stroke={ink} strokeWidth={0.1} />)}
              {pent.map((_, i) => { const a = ((-54 + i * 72) * Math.PI) / 180; return <circle key={`p${i}`} cx={Math.cos(a) * 1.02} cy={Math.sin(a) * 1.02} r={0.32} fill={ink} />; })}
            </>
          )}
        </g>
      </g>
      {!bn && <circle cx={c.x} cy={c.y} r={r} fill="url(#chip-shade)" />}
      <circle cx={c.x} cy={c.y} r={r} fill="none" stroke={stroke} strokeWidth={0.35} />
    </>
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

function Piece({ el, ctx, selected, ghost = false }) {
  const { board, field, orient, look } = ctx;
  const s = styleOf(look);
  const c = toView(field, orient, el);
  const op = (el.opacity ?? 1) * (ghost ? 0.3 : 1);
  const ring = (r) => selected && !ghost && <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />;
  const mat = materialOf(el.k);
  if (mat) {
    const k = Number(el.size) || 1;
    const rot = (el.rot || 0) + orientAngle(orient);
    return (
      <g opacity={op} transform={`translate(${c.x} ${c.y}) rotate(${rot})`}>
        {selected && !ghost && <rect x={-mat.hw * k - 0.9} y={-mat.hh * k - 0.9} width={2 * mat.hw * k + 1.8} height={2 * mat.hh * k + 1.8} fill="none" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="1 0.8" />}
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
      return (
        <g opacity={op}>
          {ring(r * (el.feet ? 1.5 : 1) + 1.3)}
          <Chip el={el} ctx={ctx} c={c} r={r} ghost={ghost} />
          {el.label && !ghost ? (
            <text x={c.x} y={c.y + r + down + fs * 1.05} textAnchor="middle" fontSize={fs} fontWeight={700} fill={s.label.fill} stroke={s.label.stroke} strokeWidth={0.55} paintOrder="stroke" style={{ fontFamily: "Arial, sans-serif" }}>{el.label}</text>
          ) : null}
        </g>
      );
    }
    case "ball": {
      const r = Math.max(0.7, ctx.chip * 0.55) * (Number(el.size) || 1);
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
      return (
        <g opacity={op}>
          {ring(2.4 * k)}
          {el.shape === "flat" ? (
            <>
              <Shadow amount={sd} v={lightVec(0, 0.22 * k)} halo={0.3}>{(g) => <circle cx={c.x} cy={c.y} r={0.9 * k + g / 2} fill="#000" />}</Shadow>
              <circle cx={c.x} cy={c.y} r={0.9 * k} fill={col} stroke={s.coneStroke} strokeWidth={0.3} />
              {!bn && <circle cx={c.x} cy={c.y} r={0.9 * k} fill="url(#chip-shade)" />}
            </>
          ) : (
            <>
              <Shadow amount={sd} v={lightVec(0, 0.42 * k)}>{(g) => <polygon points={tri} fill="#000" stroke="#000" strokeWidth={g} strokeLinejoin="round" />}</Shadow>
              <polygon points={tri} fill={col} stroke={s.coneStroke} strokeWidth={0.3} strokeLinejoin="round" />
              {!bn && <polygon points={tri} fill="url(#cone-shade)" />}
            </>
          )}
        </g>
      );
    }
    case "goal": {
      const gw = el.w || 7.32;
      const gd = Math.max(1.1, Math.min(2.4, gw * 0.4));
      const rot = (el.rot || 0) + orientAngle(orient);
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
          <Shadow amount={ghost ? 0 : s.shadow || 0} v={lightVec(rot, 0.6)} halo={0.3}>
            {(g) => (
              <>
                <polygon points={`${-gw / 2},${fy} ${gw / 2},${fy} ${gw / 2 - inset},${by} ${-gw / 2 + inset},${by}`} fill="#000" fillOpacity={0.22} />
                <path d={`M ${-gw / 2} ${fy} L ${-gw / 2 + inset} ${by} L ${gw / 2 - inset} ${by} L ${gw / 2} ${fy}`} stroke="#000" strokeWidth={0.3 + g} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                <line x1={-gw / 2} y1={fy} x2={gw / 2} y2={fy} stroke="#000" strokeWidth={0.55 + g} strokeLinecap="round" />
                <circle cx={-gw / 2} cy={fy} r={0.38 + g / 2} fill="#000" />
                <circle cx={gw / 2} cy={fy} r={0.38 + g / 2} fill="#000" />
              </>
            )}
          </Shadow>
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
  const toV = (p) => toView(field, orient, p);
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
  const mark = { fill: "none", stroke: "#f59e0b", strokeWidth: 0.4, strokeDasharray: "1.6 1.2" };
  if (quad) {
    const pts = el.pts.map(toV).map((q) => `${q.x},${q.y}`).join(" ");
    return (
      <g>
        {/* la marca de selección va por detrás (como la de las flechas) para no tapar el color del borde elegido */}
        {selected && <polygon points={pts} fill="none" stroke="#f59e0b" strokeWidth={sw + 1.6} strokeLinejoin="round" opacity={0.5} />}
        <polygon points={pts} strokeLinejoin="round" {...common} />
      </g>
    );
  }
  const { x0, y0, x1, y1 } = zoneBox(el);
  const a = toV({ x: x0, y: y0 }), b = toV({ x: x1, y: y1 });
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
  const pad = 0.9 + (border ? sw / 2 : 0);
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
  const { field, orient, look } = ctx;
  const s = styleOf(look);
  const g = linkShape(el, els);
  if (!g) return null;
  const lp = linkProps(el);
  const toV = (p) => toView(field, orient, p);
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
  const toV = (p) => toView(ctx.field, ctx.orient, p);
  return (
    <g>
      {el.pts.map((q, i) => { const c = toV(q); return <circle key={`v${i}`} cx={c.x} cy={c.y} r={1.3} fill="#fff" stroke="#f59e0b" strokeWidth={0.5} pointerEvents="none" />; })}
      {el.pts.map((q, i) => { const c = toV(q); return <circle key={`h${i}`} data-h={`q${i}`} cx={c.x} cy={c.y} r={3.2} fill="transparent" />; })}
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

// Tirador para girar: un punto naranja sobre la propia ficha con pies (hacia dónde mira) o sobre el material (hacia dónde apunta)
function TurnHandle({ el, ctx }) {
  const c = toView(ctx.field, ctx.orient, el);
  const mat = materialOf(el.k);
  const base = mat ? mat.hh * (Number(el.size) || 1) + 0.6 : tokenR(ctx.chip, el) * 1.5;
  const a = (((mat ? el.rot || 0 : faceOf(el)) + orientAngle(ctx.orient)) * Math.PI) / 180;
  const R = base + 2.1;
  const hx = c.x + Math.sin(a) * R, hy = c.y - Math.cos(a) * R;
  return (
    <g>
      <line x1={c.x + Math.sin(a) * base} y1={c.y - Math.cos(a) * base} x2={hx} y2={hy} stroke="#f59e0b" strokeWidth={0.3} />
      <circle cx={hx} cy={hy} r={1.15} fill="#f59e0b" stroke="#fff" strokeWidth={0.4} pointerEvents="none" />
      <circle data-h={mat ? "r" : "f"} cx={hx} cy={hy} r={3.4} fill="transparent" />
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
        const c = toView(ctx.field, ctx.orient, el);
        const r = el.k === "token" ? tokenR(ctx.chip, el) : 1.2;
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
function GroupBox({ ids, els, ctx }) {
  const b = unionBounds(els.filter((e) => ids.includes(e.id)).map((e) => elementBounds(e, ctx.chip)));
  if (!b) return null;
  const a = toView(ctx.field, ctx.orient, { x: b.x0, y: b.y0 }), c = toView(ctx.field, ctx.orient, { x: b.x1, y: b.y1 });
  const pad = 1.2;
  return <rect x={Math.min(a.x, c.x) - pad} y={Math.min(a.y, c.y) - pad} width={Math.abs(a.x - c.x) + 2 * pad} height={Math.abs(a.y - c.y) + 2 * pad} fill="none" stroke="#f59e0b" strokeWidth={0.35} strokeDasharray="2 1.2" opacity={0.9} pointerEvents="none" />;
}
function BoxMark({ box, ctx }) {
  const a = toView(ctx.field, ctx.orient, { x: box.x, y: box.y }), b = toView(ctx.field, ctx.orient, { x: box.x + box.w, y: box.y + box.h });
  return <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(a.x - b.x)} height={Math.abs(a.y - b.y)} fill="#f59e0b" fillOpacity={0.12} stroke="#f59e0b" strokeWidth={0.4} strokeDasharray="1.6 1.2" pointerEvents="none" />;
}

export function Item({ el, ctx, els = [], selected = false, handles = false }) {
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
const Board = React.forwardRef(function Board({ board, els, selId = null, selIds = null, marks = [], markNumbers = false, ghosts = [], draft = null, handles = false, className = "", style, label = "Dibujo", ...rest }, ref) {
  const field = fieldOf(board.field);
  const orient = orientOf(board.orient);
  const look = lookOf(board.look);
  const vb = viewBox(field, orient);
  const ctx = { board, field, orient, look, chip: chipOf(board) };
  // Una sola cosa elegida (selId) o varias (selIds): con varias no hay tiradores, solo la marca de cada una y la caja del grupo
  const sel = selIds || (selId ? [selId] : []);
  const selEl = sel.length === 1 ? els.find((e) => e.id === sel[0]) : null;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={vb.join(" ")} className={className} style={style} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label} {...rest}>
      <defs>
        <pattern id="bn-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.6" stroke="#111" strokeWidth="0.3" /></pattern>
        <pattern id="bn-stripes" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="1.6" fill="#fff" /><rect width="0.8" height="1.6" fill="#111" /></pattern>
        <pattern id="bn-dots" width="1.4" height="1.4" patternUnits="userSpaceOnUse"><rect width="1.4" height="1.4" fill="#fff" /><circle cx="0.7" cy="0.7" r="0.3" fill="#111" /></pattern>
        <clipPath id="chip-clip"><circle r="1" /></clipPath>
        <ChipDefs />
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
      {drawOrder(els).map((el) => <Item key={el.id} el={el} els={els} ctx={ctx} selected={sel.includes(el.id) || (el.k !== "link" && marks.includes(el.id))} handles={handles} />)}
      {handles && sel.length > 1 && <GroupBox ids={sel} els={els} ctx={ctx} />}
      {markNumbers && marks.length > 0 && <MarkNumbers ids={marks} els={els} ctx={ctx} />}
      {handles && selEl && isQuad(selEl) && <QuadHandles el={selEl} ctx={ctx} />}
      {handles && selEl && ((selEl.k === "token" && selEl.feet) || materialOf(selEl.k)) && <TurnHandle el={selEl} ctx={ctx} />}
      {draft && draft.k === "box" && <BoxMark box={draft} ctx={ctx} />}
      {draft && draft.k !== "box" && <Item el={{ id: "draft", ...draft }} ctx={ctx} selected />}
    </svg>
  );
});
export default Board;
