import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from "lucide-react";
import { eventPlace, placeKey, inForecastRange, forecastAt, isWet, weatherTitle } from "@/lib/weather";
import { loadForecast } from "@/lib/weatherApi";
import { isCancelled } from "@/lib/eventCancel";

const ICONS = { fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, cloudy: Cloud };
const iconFor = (w) => (w.kind === "clear" ? (w.day ? Sun : Moon) : w.kind === "partly" ? (w.day ? CloudSun : CloudMoon) : ICONS[w.kind] || Cloud);

/**
 * Previsión del tiempo a la hora de un evento: icono + temperatura (y % de lluvia si se pide).
 * Entrenos → Teixonera · partidos → el campo que indica la federación. Sin previsión (evento lejano, ya jugado,
 * cancelado, sin ubicación o sin conexión con la fuente) no muestra nada.
 *   rain: añade el % de probabilidad de lluvia junto a los grados (vistas con más sitio)
 *   onDark: texto blanco, para ponerlo sobre un bloque de color
 */
export default function EventWeather({ event, rain = false, onDark = false, className = "" }) {
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
  return (
    <span title={weatherTitle(w, place, event.date)} className={`inline-flex items-center gap-0.5 font-semibold leading-none whitespace-nowrap ${onDark ? "text-white" : wet ? "text-sky-600" : "text-gray-500"} ${className}`}>
      <Icon className="w-3 h-3 shrink-0" strokeWidth={2.2} />
      {w.temp}°
      {rain && w.pop != null && w.pop >= 20 && <span className="font-normal opacity-80">· {w.pop}%</span>}
    </span>
  );
}
