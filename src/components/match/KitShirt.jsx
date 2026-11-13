// Camiseta del club vista de espaldas (foto real) con el texto de la espalda y el dorsal estampados.
// Encima del texto van las capas de sombra y luz de la propia foto, recortadas a la forma de las letras, para que el
// estampado siga los pliegues. Se dibuja dentro de un <svg>; (x, y) = centro, h = alto en unidades del svg.
import React, { useId } from "react";
import { KIT_IMG, KIT_BACK_TEXT } from "@/lib/clubKits";
import { F as clubFont } from "@/lib/brand";

export function KitShirt({ x = 0, y = 0, h, kit, number = "", backText = KIT_BACK_TEXT, shadow = true }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!kit) return null;
  const s = h / KIT_IMG.h;
  const w = KIT_IMG.w * s;
  const font = clubFont.title;
  const back = backText ? <text x="220" y="112" textAnchor="middle" fontSize="21" letterSpacing="0.6" style={{ fontFamily: font }}>{backText}</text> : null;
  const num = number !== "" && number != null ? <text x="220" y="326" textAnchor="middle" fontSize="205" style={{ fontFamily: font }}>{number}</text> : null;
  return (
    <g transform={`translate(${x - w / 2} ${y - h / 2}) scale(${s})`} pointerEvents="none">
      <defs>
        <clipPath id={`${uid}t`}>{back}{num}</clipPath>
        {shadow && <filter id={`${uid}f`} x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="8" /></filter>}
      </defs>
      {shadow && <ellipse cx="220" cy="490" rx="170" ry="8" fill="#000" opacity=".25" filter={`url(#${uid}f)`} />}
      <image href={kit.img} width={KIT_IMG.w} height={KIT_IMG.h} />
      <g fill={kit.num}>{back}{num}</g>
      {(back || num) && (
        <g clipPath={`url(#${uid}t)`}>
          <image href={kit.shade} width={KIT_IMG.w} height={KIT_IMG.h} />
          <image href={kit.light} width={KIT_IMG.w} height={KIT_IMG.h} opacity=".7" />
        </g>
      )}
    </g>
  );
}

// Camiseta pequeña para los botones de equipación (sin dorsal)
export function KitIcon({ kit, size = 30 }) {
  return (
    <svg viewBox={`0 0 ${KIT_IMG.w} ${KIT_IMG.h}`} width={size} height={size * KIT_IMG.h / KIT_IMG.w} aria-hidden="true">
      <image href={kit.img} width={KIT_IMG.w} height={KIT_IMG.h} />
    </svg>
  );
}
