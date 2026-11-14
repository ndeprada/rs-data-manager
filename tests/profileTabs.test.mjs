import test from "node:test";
import assert from "node:assert/strict";
import {
  manualRows, participationSplit, ratingInfo, trainingSeason, attendanceStreak, absenceReasons,
  injuryImpact, injurySummary, phaseSteps, daysUntil, docState, docRows, cleanRequiredDocs, careerRows, clubFacts, seasonKey,
} from "../src/lib/profileTabs.js";
import { matchRows } from "../src/lib/playerProfile.js";

const now = new Date("2026-11-14T10:00:00");

test("matchRows: tipos, notas y jugador del partido", () => {
  const events = [
    { id: "l1", type: "partido_liga", team_id: "t", date: "2026-11-08T11:00", mvp_player_id: "p" },
    { id: "a1", type: "partido_amistoso", team_id: "t", date: "2026-11-01T11:00" },
  ];
  const convs = [{ event_id: "l1", player_ids: ["p"], starters: ["p"] }, { event_id: "a1", player_ids: ["p"] }];
  const stats = [{ event_id: "l1", player_id: "p", minutes_played: 90, notes: "  Muy bien ", rating: 3 }];
  const liga = matchRows({ events, convs, stats, playerId: "p", teamId: "t" });
  assert.equal(liga.length, 1);
  assert.equal(liga[0].notes, "Muy bien");
  assert.equal(liga[0].mvp, true);
  const all = matchRows({ events, convs, stats, playerId: "p", teamId: "t", types: ["partido_liga", "partido_amistoso"] });
  assert.equal(all.length, 2);
});

test("manualRows: solo los apuntados a mano sin partido conocido", () => {
  const stats = [
    { id: "s1", player_id: "p", event_id: "l1", date: "2026-11-08" },
    { id: "s2", player_id: "p", date: "2026-10-02", opponent: "CE X", minutes_played: 60, starter: false },
    { id: "s3", player_id: "q", date: "2026-10-02" },
  ];
  const r = manualRows(stats, "p", new Set(["l1"]));
  assert.equal(r.length, 1);
  assert.equal(r[0].ev.opponent, "CE X");
  assert.equal(r[0].starter, false);
  assert.equal(r[0].manual, true);
});

test("participationSplit: titular, suplente, fuera y no disponible", () => {
  const rows = [
    { called: true, starter: true, minutes: 90 },
    { called: true, starter: false, minutes: 20 },
    { called: true, starter: false, minutes: 0 },
    { called: false, reason: "decision_tecnica" },
    { called: false, reason: null },
    { called: false, reason: "enfermo" },
  ];
  const s = participationSplit(rows);
  assert.deepEqual([s.starter, s.sub, s.subUnused, s.benched, s.unavailable], [1, 2, 1, 2, 1]);
  assert.equal(s.reasons.sin_motivo, 1);
});

test("ratingInfo: media, tendencia y jugador del partido", () => {
  const mk = (d, r, mvp = false) => ({ ev: { date: `2026-10-${d}` }, rating: r, mvp });
  const info = ratingInfo([mk("01", 1), mk("08", 2), mk("15", 3), mk("22", 3, true), mk("29", 3)]);
  assert.equal(info.n, 5);
  assert.equal(info.avg, 2.4);
  assert.equal(info.recent, 3);
  assert.equal(info.trend, "up");
  assert.equal(info.mvp, 1);
  assert.deepEqual(info.last, [1, 2, 3, 3, 3]);
  assert.equal(ratingInfo([mk("01", 2)]).trend, null);
});

test("trainingSeason: códigos, meses y ausencias", () => {
  const events = [
    { id: "e1", type: "entrenamiento", team_id: "t", date: "2026-10-01T19:00" },
    { id: "e2", type: "entrenamiento", team_id: "t", date: "2026-10-03T19:00" },
    { id: "e3", type: "entrenamiento", team_id: "t", date: "2026-11-02T19:00", cancelled: true },
    { id: "e4", type: "entrenamiento", team_id: "t", date: "2026-11-05T19:00" },
    { id: "e5", type: "entrenamiento", team_id: "t", date: "2026-11-10T19:00" },
    { id: "e6", type: "entrenamiento", team_id: "t", date: "2026-11-20T19:00" },
    { id: "e7", type: "entrenamiento", team_id: "t", date: "2026-12-01T19:00" },
    { id: "o1", type: "entrenamiento", team_id: "otro", date: "2026-11-06T19:00" },
    { id: "o2", type: "entrenamiento", team_id: "otro", date: "2026-11-07T19:00" },
    { id: "pp", type: "partido_liga", team_id: "t", date: "2026-11-08T11:00" },
  ];
  const att = [
    { event_id: "e1", player_id: "p", status: "present" },
    { event_id: "e2", player_id: "p", status: "absent", absence_reason: "enfermo", notes: "fiebre" },
    { event_id: "e4", player_id: "q", status: "present" },
    { event_id: "o1", player_id: "p", status: "apart" },
  ];
  const s = trainingSeason(events, att, { teamId: "t", playerId: "p", now, since: new Date("2026-08-01") });
  assert.deepEqual(s.items.map((i) => i.code), ["s", "n", "c", "x", "a", "p", "f"]);
  assert.equal(s.months.length, 2);
  assert.equal(s.counts.present, 1);
  assert.equal(s.pct, 67);
  assert.deepEqual(s.missed.map((i) => i.id), ["o1", "e2"]);
  assert.equal(s.missed[1].note, "fiebre");
  assert.deepEqual(absenceReasons(s.items), [["enfermo", 1]]);
});

test("attendanceStreak: cuenta hasta la última falta", () => {
  const it = (code, date) => ({ code, date });
  const r = attendanceStreak([it("s", "1"), it("n", "2"), it("s", "3"), it("c", "4"), it("a", "5"), it("s", "6"), it("f", "7")]);
  assert.equal(r.n, 3);
  assert.equal(r.until, "6");
  assert.equal(attendanceStreak([]).n, 0);
});

test("injuryImpact: partidos y entrenos perdidos durante la lesión", () => {
  const events = [
    { id: "m1", team_id: "t", type: "partido_liga", date: "2026-11-08T11:00" },
    { id: "m2", team_id: "t", type: "partido_liga", date: "2026-10-25T11:00" },
    { id: "e1", team_id: "t", type: "entrenamiento", date: "2026-11-04T19:00" },
  ];
  const convs = [
    { event_id: "m1", player_ids: ["x"], absence_reasons: { p: "lesion" } },
    { event_id: "m2", player_ids: ["x"], absence_reasons: { p: "lesion" } },
  ];
  const attendance = [{ event_id: "e1", player_id: "p", status: "absent" }, { player_id: "p", status: "absent", date: "2026-11-06" }];
  const im = injuryImpact({ injury_date: "2026-11-02", status: "activa" }, { events, convs, attendance, playerId: "p", teamId: "t", now });
  assert.deepEqual(im, { matches: 1, trainings: 2, days: 12 });
  const closed = injuryImpact({ injury_date: "2026-11-02", status: "alta", actual_return: "2026-11-05" }, { events, convs, attendance, playerId: "p", teamId: "t", now });
  assert.equal(closed.matches, 0);
  assert.equal(closed.trainings, 1);
  assert.equal(closed.days, 4);
});

test("injurySummary, fases y días hasta la vuelta", () => {
  const inj = [{ injury_date: "2026-09-12", body_part: "tobillo" }, { injury_date: "2026-11-02", body_part: "tobillo" }, { injury_date: "2025-11-14", body_part: "rodilla" }];
  const s = injurySummary(inj, { since: new Date("2026-08-01"), impactOf: () => ({ matches: 1, days: 5 }) });
  assert.deepEqual(s, { n: 2, days: 10, matches: 2, repeated: { zone: "tobillo", n: 2 } });
  assert.equal(phaseSteps([]), null);
  assert.deepEqual(phaseSteps([{ status: "completada" }, { status: "en_curso" }, {}]).map((p) => p.state), ["done", "now", "todo"]);
  assert.equal(daysUntil("2026-11-22", now), 8);
  assert.equal(daysUntil(null, now), null);
});

test("documentos: estado, obligatorios y menores", () => {
  assert.equal(docState({ expiry_date: "2026-11-30" }, now).state, "soon");
  assert.equal(docState({ expiry_date: "2026-11-01" }, now).state, "expired");
  assert.equal(docState({ expiry_date: "2027-09-01" }, now).state, "ok");
  assert.equal(docState({}, now).state, "ok");
  const docs = [
    { id: "a", document_type: "seguro", upload_date: "2026-09-01", expiry_date: "2026-11-30" },
    { id: "b", document_type: "seguro", upload_date: "2025-09-01", expiry_date: "2025-11-30" },
    { id: "c", document_type: "otro", upload_date: "2026-07-12" },
  ];
  const req = ["autorizacion_legal", "seguro", "consentimiento_padres"];
  const adult = docRows(docs, req, { now, minor: false });
  assert.deepEqual(adult.rows.map((r) => [r.type, r.state]), [["autorizacion_legal", "missing"], ["seguro", "soon"]]);
  assert.equal(adult.rows[1].doc.id, "a");
  assert.equal(adult.rows[1].others.length, 1);
  assert.equal(adult.rest.length, 1);
  assert.deepEqual(adult.counts, { missing: 1, soon: 1, expired: 0, ok: 1 });
  assert.equal(docRows(docs, req, { now, minor: true }).rows.length, 3);
  assert.deepEqual(cleanRequiredDocs(["seguro", "seguro", "nada"]), ["seguro"]);
  assert.deepEqual(cleanRequiredDocs(null), []);
});

test("careerRows y clubFacts: club + actas de la FCF", () => {
  const isClub = (t) => /RACING/.test(t);
  const rows = careerRows({
    current: { season: "2026-2027", team: "Juvenil A", pj: 10 },
    club: [{ id: "h1", season: "2025-2026", team_name: "Cadete A", matches_played: 27, matches_starter: 22, training_sessions: 100, training_present: 91, avg_rating: 2.3 }],
    fcf: [
      { season: "2026-2027", team: "RACING SARRIA A", competition: "LLIGA NACIONAL", pj: 10 },
      { season: "2025-2026", team: "RACING SARRIA A", competition: "CADET PREFERENT", pj: 26 },
      { season: "2024-2025", team: "RACING SARRIA B", competition: "CADET PRIMERA", pj: 24, dorsals: [{ d: "8", n: 20 }] },
      { season: "2023-2024", team: "CE EUROPA A", competition: "INFANTIL PREFERENT", pj: 22, yellow: 1, second_yellow: 1, dorsals: [{ d: "8", n: 4 }, { d: "10", n: 3 }] },
    ],
    isClubTeam: isClub,
  });
  assert.deepEqual(rows.map((r) => [seasonKey(r.season), r.source]), [["2026-27", "club"], ["2025-26", "club"], ["2024-25", "fcf"], ["2023-24", "fcf"]]);
  assert.equal(rows[0].competition, "LLIGA NACIONAL");
  assert.equal(rows[1].attPct, 91);
  assert.equal(rows[1].competition, "CADET PREFERENT");
  assert.equal(rows[3].yellow, 2);
  const f = clubFacts(rows);
  assert.equal(f.first, "2024-25");
  assert.equal(f.seasons, 3);
  assert.equal(f.origin.team, "CE EUROPA A");
  assert.deepEqual(f.dorsals[0], { dorsal: "8", n: 20 });
});

test("careerRows: la temporada del club sin cifras toma las de las actas y el dorsal del club manda", async () => {
  const { careerRows, clubFacts } = await import("../src/lib/profileTabs.js");
  const rows = careerRows({
    club: [{ season: "2025-2026", team_name: "Juvenil A" }],
    fcf: [
      { season: "2025-2026", team: "RACING SARRIA A", competition: "JUVENIL PREFERENT", pj: 24, tit: 20, goals: 6, yellow: 3, dorsals: [{ d: "7", n: 20 }] },
      { season: "2024-2025", team: "CAN BUXERES A", pj: 26, goals: 11, dorsals: [{ d: "9", n: 25 }] },
    ],
    isClubTeam: (n) => /RACING/.test(n),
  });
  const club = rows.find((r) => r.source === "club");
  assert.equal(club.pj, 24); assert.equal(club.goals, 6); assert.equal(club.yellow, 3);
  assert.equal(clubFacts(rows).dorsals[0].dorsal, "7");
});
