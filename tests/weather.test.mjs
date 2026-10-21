import assert from 'node:assert/strict';
import { TRAINING_PLACE, validCoords, eventPlace, placeKey, hourKey, inForecastRange, parseForecast, forecastAt, weatherKind, isWet, weatherTitle } from '../src/lib/weather.js';
import { loadForecast } from '../src/lib/weatherApi.js';

// Coordenadas: solo las razonables (la FCF manda vacíos o ceros en algún partido)
assert.deepEqual(validCoords('41.425852', '2.145875'), { lat: 41.425852, lng: 2.145875 });
assert.deepEqual(validCoords(41.4, 2.1), { lat: 41.4, lng: 2.1 });
for (const bad of [['', ''], [null, null], [undefined, '2'], ['0', '0'], ['abc', '2'], ['91', '2'], ['41.4', '200']]) assert.equal(validCoords(...bad), null, JSON.stringify(bad));

// Lugar del evento: entrenos → Teixonera; partidos → coordenadas del campo; lo demás, nada
assert.equal(eventPlace({ type: 'entrenamiento' }), TRAINING_PLACE);
assert.equal(eventPlace({ type: 'entrenamiento_fisico', location_lat: 1, location_lng: 1 }), TRAINING_PLACE, 'un entreno siempre va a Teixonera');
assert.equal(eventPlace({ type: 'sesion_teorica' }), null, 'sesión teórica: sin previsión');
assert.equal(eventPlace({ type: 'sesion_video' }), null);
assert.deepEqual(eventPlace({ type: 'partido_liga', location: 'Camp Sant Genís', location_lat: 41.42, location_lng: 2.14 }), { lat: 41.42, lng: 2.14, name: 'Camp Sant Genís' });
assert.equal(eventPlace({ type: 'partido_liga', location: 'Camp X' }), null, 'partido sin coordenadas: sin previsión');
assert.equal(eventPlace({ type: 'partido_amistoso', location_lat: '', location_lng: '' }), null, 'amistoso sin saber si es en casa: sin previsión');
assert.equal(eventPlace({ type: 'partido_amistoso', is_home: false }), null, 'amistoso fuera sin coordenadas: sin previsión');
assert.equal(eventPlace({ type: 'partido_amistoso', is_home: true }), TRAINING_PLACE, 'amistoso en casa sin coordenadas: Teixonera');
assert.equal(eventPlace({ type: 'partido_amistoso', is_home: true, location_lat: 41.5, location_lng: 2.2, location: 'Otro campo' }).name, 'Otro campo', 'si hay coordenadas manda el campo');
assert.equal(eventPlace({ type: 'partido_liga', is_home: true }), null, 'liga en casa sin coordenadas: se espera a la sincronización con la FCF');
assert.equal(eventPlace({ type: 'reunion_equipo' }), null);
assert.equal(eventPlace({ type: 'evento_club' }), null);
assert.equal(eventPlace(null), null);
assert.equal(placeKey({ lat: 41.425852, lng: 2.145875 }), '41.43,2.15');

// Hora de la previsión: la hora en punto más cercana
assert.equal(hourKey('2026-10-21T19:00'), '2026-10-21T19:00');
assert.equal(hourKey('2026-10-21T19:29'), '2026-10-21T19:00');
assert.equal(hourKey('2026-10-21T19:30'), '2026-10-21T20:00');
assert.equal(hourKey('2026-10-21T23:45'), '2026-10-22T00:00', 'cruza la medianoche');
assert.equal(hourKey('2026-10-21T10:30:00'), '2026-10-21T11:00');
assert.equal(hourKey('basura'), null);
assert.equal(hourKey(undefined), null);

// Alcance: hasta 16 días vista, y no los ya pasados (con 2 h de margen)
const now = new Date(2026, 9, 21, 12, 0);
assert.equal(inForecastRange('2026-10-21T19:00', now), true);
assert.equal(inForecastRange('2026-10-21T10:30', now), true, 'empezó hace 1,5 h');
assert.equal(inForecastRange('2026-10-21T08:00', now), false, 'ya pasado');
assert.equal(inForecastRange('2026-11-05T20:00', now), true, 'día 16');
assert.equal(inForecastRange('2026-11-06T09:00', now), false, 'más allá de 16 días');
assert.equal(inForecastRange('', now), false);

// Respuesta de la fuente → previsión por hora; los huecos (vacíos al final del alcance) se ignoran
const resp = { hourly: {
  time: ['2026-10-21T18:00', '2026-10-21T19:00', '2026-10-21T20:00', '2026-10-21T21:00'],
  temperature_2m: [14.4, 13.6, 12.5, null],
  weather_code: [3, 61, 0, null],
  precipitation_probability: [10, 70, 5, 0],
  is_day: [1, 0, 0, 0],
} };
const f = parseForecast(resp);
assert.deepEqual(Object.keys(f), ['2026-10-21T18:00', '2026-10-21T19:00', '2026-10-21T20:00']);
assert.deepEqual(f['2026-10-21T19:00'], [14, 61, 70, 0], 'redondea la temperatura');
const w = forecastAt(f, '2026-10-21T19:10');
assert.deepEqual([w.temp, w.kind, w.pop, w.day, w.label], [14, 'rain', 70, false, 'Lluvia']);
assert.equal(forecastAt(f, '2026-10-21T21:00'), null, 'hora sin datos');
assert.equal(forecastAt(f, '2026-10-22T19:00'), null, 'día sin datos');
assert.equal(forecastAt(null, '2026-10-21T19:00'), null);
assert.deepEqual(parseForecast({}), {});
assert.deepEqual(parseForecast(null), {});

// Tipos de tiempo y cuándo resaltar
for (const [code, kind] of [[0, 'clear'], [1, 'clear'], [2, 'partly'], [3, 'cloudy'], [45, 'fog'], [53, 'drizzle'], [61, 'rain'], [80, 'rain'], [73, 'snow'], [95, 'storm'], [99, 'storm'], [999, 'cloudy']]) assert.equal(weatherKind(code).kind, kind, `código ${code}`);
assert.equal(weatherKind(65).label, 'Lluvia fuerte');
assert.equal(isWet({ kind: 'rain', pop: 20 }), true);
assert.equal(isWet({ kind: 'cloudy', pop: 60 }), true, 'nublado pero con mucha probabilidad de lluvia');
assert.equal(isWet({ kind: 'cloudy', pop: 30 }), false);
assert.equal(isWet({ kind: 'clear', pop: null }), false);
assert.equal(isWet(null), false);
assert.equal(weatherTitle(w, { name: 'Teixonera' }, '2026-10-21T19:00'), 'Lluvia · 14 °C · 70 % de probabilidad de lluvia · Teixonera, 19:00');
assert.equal(weatherTitle(null), '');

// Varias tarjetas piden a la vez → UNA sola llamada a la fuente, y cada una recibe lo suyo
const calls = [];
globalThis.fetch = async (url) => {
  calls.push(String(url));
  const u = new URL(url);
  const lats = u.searchParams.get('latitude').split(',');
  const mk = (lat) => ({ hourly: { time: ['2026-10-21T19:00'], temperature_2m: [Number(lat)], weather_code: [0], precipitation_probability: [0], is_day: [1] } });
  return { ok: true, json: async () => (lats.length === 1 ? mk(lats[0]) : lats.map(mk)) };
};
const [a, b, c, a2] = await Promise.all([
  loadForecast({ lat: 41.43, lng: 2.15 }), loadForecast({ lat: 41.4, lng: 2.17 }), loadForecast({ lat: 41.5, lng: 2.2 }), loadForecast({ lat: 41.43, lng: 2.15 }),
]);
assert.equal(calls.length, 1, 'una sola petición para tres lugares distintos');
assert.match(calls[0], /latitude=41\.43%2C41\.40%2C41\.50/);
assert.match(calls[0], /forecast_days=16/);
assert.match(calls[0], /timezone=Europe%2FMadrid/);
assert.equal(a['2026-10-21T19:00'][0], 41, 'cada tarjeta recibe la previsión de su lugar');
assert.equal(b['2026-10-21T19:00'][0], 41);
assert.equal(c['2026-10-21T19:00'][0], 42, '41,5 redondea a 42');
assert.deepEqual(a2, a, 'el mismo lugar pedido dos veces se comparte');
// un solo lugar: la fuente devuelve un objeto, no una lista
const solo = await loadForecast({ lat: 41.42, lng: 2.14 });
assert.equal(solo['2026-10-21T19:00'][0], 41);
assert.equal(calls.length, 2);
// si la fuente falla, la promesa se rechaza (la tarjeta no muestra nada)
globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
await assert.rejects(() => loadForecast({ lat: 40, lng: 2 }), /503/);

console.log('weather ok');
