// Previsión del tiempo de los eventos: dónde (campo del partido o Teixonera para entrenos), a qué hora y cómo se traduce.
// Sin importaciones de la app: lo usan también la sincronización de la FCF (servidor) y los tests.

// Campo municipal de Teixonera (Horta-Guinardó): coordenadas que publica la FCF para «Camp de Futbol Mpal. Teixonera».
// Es el lugar de todos los entrenamientos del club a efectos de previsión.
export const TRAINING_PLACE = { lat: 41.425852, lng: 2.145875, name: "Teixonera" };

// Entrenos al aire libre (las sesiones teóricas y de vídeo no llevan previsión)
export const OUTDOOR_TRAINING_TYPES = ["entrenamiento", "entrenamiento_fisico"];
export const MATCH_TYPES_WEATHER = ["partido_liga", "partido_amistoso", "torneo"];

export const FORECAST_DAYS = 16; // lo máximo que da la fuente gratuita (Open-Meteo)

const pad = (n) => String(n).padStart(2, "0");

// ¿Son coordenadas razonables (España y alrededores)? La FCF manda cadenas vacías o 0 en algún partido.
export function validCoords(lat, lng) {
  const a = Number(lat), b = Number(lng);
  if (lat === null || lat === undefined || lat === "" || lng === null || lng === undefined || lng === "") return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < 26 || a > 45 || b < -19 || b > 6) return null;
  return { lat: a, lng: b };
}

// Lugar de un evento para la previsión, o null si no se puede saber:
//  · entrenos al aire libre → Teixonera
//  · partidos (y torneos) → las coordenadas del campo que guarda la sincronización con la FCF
export function eventPlace(ev) {
  if (!ev) return null;
  if (OUTDOOR_TRAINING_TYPES.includes(ev.type)) return TRAINING_PLACE;
  if (MATCH_TYPES_WEATHER.includes(ev.type)) {
    const c = validCoords(ev.location_lat, ev.location_lng);
    return c ? { ...c, name: ev.location || "" } : null;
  }
  return null;
}

// Clave de lugar (2 decimales ≈ 1 km: más fino no aporta, la fuente trabaja con cuadrículas de varios km)
export const placeKey = (p) => `${Number(p.lat).toFixed(2)},${Number(p.lng).toFixed(2)}`;

// Fecha-hora local de un evento. Los eventos se guardan como texto local «2026-10-21T19:00»; alguno antiguo puede traer «Z».
function localParts(value) {
  const s = String(value || "");
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
  if (m && !/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes() };
}

// Hora de la previsión que le corresponde: la hora en punto más cercana al inicio («2026-10-21T19:00»)
export function hourKey(value) {
  const p = localParts(value);
  if (!p) return null;
  const d = new Date(p.y, p.mo - 1, p.d, p.h + (p.mi >= 30 ? 1 : 0), 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

// ¿Cae dentro de lo que se puede prever? Desde ahora (hasta 2 h tarde, por si ya empezó) hasta los próximos 16 días.
export function inForecastRange(value, now = new Date()) {
  const p = localParts(value);
  if (!p) return false;
  const t = new Date(p.y, p.mo - 1, p.d, p.h, p.mi).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + FORECAST_DAYS).getTime();
  return t >= now.getTime() - 2 * 3600 * 1000 && t < end;
}

// Respuesta de Open-Meteo para un lugar → { "2026-10-21T19:00": [temperatura, código, % lluvia, esDeDía] }
export function parseForecast(json) {
  const h = json?.hourly;
  const out = {};
  if (!h?.time) return out;
  h.time.forEach((t, i) => {
    const temp = h.temperature_2m?.[i];
    const code = h.weather_code?.[i];
    if (temp == null || code == null) return; // más allá del alcance del modelo la fuente devuelve vacío
    out[t] = [Math.round(temp), code, h.precipitation_probability?.[i] ?? null, h.is_day?.[i] === 0 ? 0 : 1];
  });
  return out;
}

// Previsión de un evento a partir de lo que devuelve parseForecast: { temp, code, pop, day, kind, label } o null
export function forecastAt(forecast, value) {
  const k = hourKey(value);
  const row = k && forecast ? forecast[k] : null;
  if (!row) return null;
  const [temp, code, pop, day] = row;
  const { kind, label } = weatherKind(code);
  return { temp, code, pop, day: day !== 0, kind, label };
}

// Código meteorológico OMM (WMO) → tipo y texto
export function weatherKind(code) {
  const c = Number(code);
  if (c === 0) return { kind: "clear", label: "Despejado" };
  if (c === 1) return { kind: "clear", label: "Casi despejado" };
  if (c === 2) return { kind: "partly", label: "Parcialmente nublado" };
  if (c === 3) return { kind: "cloudy", label: "Nublado" };
  if (c === 45 || c === 48) return { kind: "fog", label: "Niebla" };
  if (c >= 51 && c <= 57) return { kind: "drizzle", label: "Llovizna" };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { kind: "rain", label: c >= 65 || c === 82 ? "Lluvia fuerte" : "Lluvia" };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { kind: "snow", label: "Nieve" };
  if (c >= 95 && c <= 99) return { kind: "storm", label: "Tormenta" };
  return { kind: "cloudy", label: "Nublado" };
}

// ¿Se espera agua? (para resaltar el icono en azul)
export const isWet = (w) => !!w && (["drizzle", "rain", "snow", "storm"].includes(w.kind) || (w.pop ?? 0) >= 50);

// Texto completo para el tooltip: «Lluvia · 14 °C · 70 % de probabilidad de lluvia · Teixonera, 19:00»
export function weatherTitle(w, place, value) {
  if (!w) return "";
  const p = localParts(value);
  const hour = p ? `${pad(p.h)}:${pad(p.mi)}` : "";
  const where = [place?.name, hour].filter(Boolean).join(", ");
  return `${w.label} · ${w.temp} °C${w.pop != null ? ` · ${w.pop} % de probabilidad de lluvia` : ""}${where ? ` · ${where}` : ""}`;
}
