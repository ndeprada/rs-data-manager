import { FORECAST_DAYS, parseForecast, placeKey } from "./weather.js";

// Previsión por hora de Open-Meteo (gratuita, sin clave, datos de los servicios meteorológicos europeos).
// Cada tarjeta de evento pide «su» lugar; aquí se juntan todas las peticiones de un mismo instante en UNA sola llamada
// (Open-Meteo admite varias coordenadas a la vez), así un calendario con 30 campos distintos hace una petición, no 30.
const URL_BASE = "https://api.open-meteo.com/v1/forecast";
const BATCH_MS = 40;
const MAX_PER_CALL = 40;

let pending = new Map(); // placeKey → { place, waiters: [{ resolve, reject }] }
let timer = null;

async function fetchChunk(places) {
  const qs = new URLSearchParams({
    latitude: places.map((p) => Number(p.lat).toFixed(2)).join(","),
    longitude: places.map((p) => Number(p.lng).toFixed(2)).join(","),
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
    timezone: "Europe/Madrid",
    forecast_days: String(FORECAST_DAYS),
  });
  const r = await fetch(`${URL_BASE}?${qs}`);
  if (!r.ok) throw new Error(`Previsión: error ${r.status}`);
  const j = await r.json();
  const list = Array.isArray(j) ? j : [j]; // con un solo lugar devuelve un objeto; con varios, una lista en el mismo orden
  return list.map(parseForecast);
}

async function flush() {
  const batch = pending;
  pending = new Map();
  timer = null;
  const entries = [...batch.values()];
  for (let i = 0; i < entries.length; i += MAX_PER_CALL) {
    const chunk = entries.slice(i, i + MAX_PER_CALL);
    try {
      const results = await fetchChunk(chunk.map((e) => e.place));
      chunk.forEach((e, k) => e.waiters.forEach((w) => w.resolve(results[k] || {})));
    } catch (err) {
      chunk.forEach((e) => e.waiters.forEach((w) => w.reject(err)));
    }
  }
}

// Previsión (por hora) de un lugar. Devuelve el resultado de parseForecast.
export function loadForecast(place) {
  return new Promise((resolve, reject) => {
    const key = placeKey(place);
    const entry = pending.get(key) || { place, waiters: [] };
    entry.waiters.push({ resolve, reject });
    pending.set(key, entry);
    if (!timer) timer = setTimeout(flush, BATCH_MS);
  });
}
