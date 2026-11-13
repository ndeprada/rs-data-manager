import assert from "node:assert/strict";
import { kindInfo, readLevel, filterSent, filterInbox, splitSent, toLocalInput, fromLocalInput, quickTimes, scheduleError, pushPreview, teamsLine } from "../src/lib/noticeUi.js";

assert.equal(kindInfo("urgente").label, "Urgente");
assert.equal(kindInfo("raro").key, "general");
assert.equal(readLevel(35, 41), "ok");
assert.equal(readLevel(142, 268), "warn");
assert.equal(readLevel(6, 14), "bad");

const items = [
  { id: 1, title: "Convocatoria", body: "", kind: "partido", sender_id: "a", sender_name: "Nacho", audience_label: "Juvenil A", status: "enviado" },
  { id: 2, title: "Lluvia", body: "Entreno cancelado", kind: "urgente", sender_id: "b", sender_name: "Álex", audience_label: "Cadete A", status: "enviado" },
  { id: 3, title: "Futuro", kind: "general", sender_id: "a", status: "programado", send_at: "2026-11-20T08:00:00Z" },
  { id: 4, title: "Antes", kind: "general", sender_id: "a", status: "programado", send_at: "2026-11-15T08:00:00Z" },
  { id: 5, title: "Mal", kind: "general", sender_id: "a", status: "fallido" },
];
assert.deepEqual(filterSent(items, { who: "mine" }, "a").map((n) => n.id), [1, 3, 4, 5]);
assert.deepEqual(filterSent(items, { kind: "urgente" }).map((n) => n.id), [2]);
assert.deepEqual(filterSent(items, { q: "alex" }).map((n) => n.id), [2]);
assert.deepEqual(filterSent(items, { q: "cancelado" }).map((n) => n.id), [2]);
const s = splitSent(items);
assert.deepEqual(s.scheduled.map((n) => n.id), [4, 3]);
assert.deepEqual(s.sent.map((n) => n.id), [1, 2]);
assert.deepEqual(s.failed.map((n) => n.id), [5]);

assert.deepEqual(filterInbox([{ read: true, kind: "general" }, { read: false, kind: "urgente" }], { unread: true }).length, 1);
assert.deepEqual(filterInbox([{ read: true, kind: "general" }, { read: false, kind: "urgente" }], { kind: "general" }).length, 1);

const d = new Date(2026, 10, 14, 9, 5);
assert.equal(toLocalInput(d), "2026-11-14T09:05");
assert.equal(fromLocalInput("2026-11-14T09:05").getTime(), d.getTime());
assert.equal(fromLocalInput("mañana"), null);

const now = new Date(2026, 10, 13, 19, 50); // viernes 19:50
const q = quickTimes(now);
assert.deepEqual(q.map((x) => x.key), ["man9", "man18"], "hoy a las 20:00 queda a menos de 15 min y hoy ya es viernes");
const tue = quickTimes(new Date(2026, 10, 10, 10, 0));
assert.deepEqual(tue.map((x) => x.key), ["hoy20", "man9", "man18", "vie18"]);
assert.equal(tue[3].date.getDay(), 5);

assert.equal(scheduleError(null, now), "Elige el día y la hora");
assert.equal(scheduleError(new Date(now.getTime() + 60_000), now), "La hora ya ha pasado");
assert.equal(scheduleError(new Date(now.getTime() + 61 * 86_400_000), now), "Como mucho, 60 días por delante");
assert.equal(scheduleError(new Date(now.getTime() + 3600_000), now), null);

assert.equal(pushPreview("Hola\n\nqué tal"), "Hola qué tal");
assert.equal(pushPreview("x".repeat(200)).length, 110);
assert.equal(teamsLine([{ team: "Infantil A", n: 31 }, { team: "", n: 2 }]), "Infantil A 31 · Sin equipo 2");
assert.match(teamsLine([1, 2, 3, 4, 5].map((n) => ({ team: `T${n}`, n }))), /· …$/);
console.log("noticeUi ok");
