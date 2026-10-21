import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from "lucide-react";
import { eventPlace, placeKey, inForecastRange, forecastAt, isWet, weatherTitle } from "@/lib/weather";
import { loadForecast } from "@/lib/weatherApi";
import { isCancelled } from "@/lib/eventCancel";

const ICONS = { fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, cloudy: Cloud };
const iconFor = (w) => (w.kind === "clear" ? (w.day ? Sun : Moon) : w.kind === "partly" ? (w.day ? CloudSun : CloudMoon) : ICONS[w.kind] || Cloud);

// Color del icono según el tiempo, para reconocerlo de un vistazo (sol ámbar, lluvia azul, tormenta violeta…)
const ICON_COLOR = {
  clear: (w) => (w.day ? "text-amber-500" : "text-indigo-500"),
  partly: (w) => (w.day ? "text-amber-500" : "text-indigo-500"),
  cloudy: () => "text-slate-500",
  fog: () => "text-slate-400",
  drizzle: () => "text-sky-500",
  rain: () => "text-sky-600",
  snow: () => "text-cyan-500",
  storm: () => "text-violet-600",
};

// Tamaños: xs = tarjetas muy estrechas (planificación semanal en móvil) · sm = tarjetas y bloques · md = listas · lg = vistas con sitio
const SIZES = {
  xs: { icon: "w-3.5 h-3.5 sm:w-4 sm:h-4", text: "text-[11px] sm:text-xs", gap: "gap-0.5" },
  sm: { icon: "w-4 h-4", text: "text-xs", gap: "gap-1" },
  md: { icon: "w-[18px] h-[18px]", text: "text-sm", gap: "gap-1" },
  lg: { icon: "w-5 h-5", text: "text-base", gap: "gap-1.5" },
};

/**
 * Previsión del tiempo a la hora de un evento: icono + temperatura (y % de lluvia si se pide).
 * Entrenos → Teixonera · partidos → el campo que indica la federación. Sin previsión (evento lejano, ya jugado,
 * cancelado, sin ubicación o sin conexión con la fuente) no muestra nada.
 *   rain: añade el % de probabilidad de lluvia junto a los grados (vistas con más sitio)
 *   onDark: texto blanco, para ponerlo sobre un bloque de color
 *   size: xs | sm | md | lg (tamaño del icono y de los grados)
 */
export default function EventWeather({ event, rain = false, onDark = false, size = "sm", className = "" }) {
  const place = eventPlace(event);
  const show = !!place && !!event?.date && !isCancelled(event) && event.score_home == null && inForecastRange(event.date);
  const { data } = useQuery({
    queryKey: ["weather", place ? placeKey(place) : null],
    queryFn: () => loadForecast(place),
    enabled: show,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const w = show && data ? forecastAt(data, event.date) : null;
  if (!w) return null;
  const Icon = iconFor(w);
  const wet = isWet(w);
  const sz = SIZES[size] || SIZES.sm;
  const iconColor = onDark ? "text-white" : (ICON_COLOR[w.kind] || ICON_COLOR.cloudy)(w);
  return (
    <span title={weatherTitle(w, place, event.date)} aria-label={weatherTitle(w, place, event.date)}
      className={`inline-flex items-center ${sz.gap} ${sz.text} font-bold leading-none whitespace-nowrap ${onDark ? "text-white" : wet ? "text-sky-700" : "text-gray-700"} ${className}`}>
      <Icon className={`${sz.icon} shrink-0 ${iconColor}`} strokeWidth={2.2} />
      {w.temp}°
      {rain && w.pop != null && w.pop >= 20 && <span className={`font-semibold ${onDark ? "opacity-90" : "text-sky-600"}`}>· {w.pop}%</span>}
    </span>
  );
}
