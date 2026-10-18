// Cierre de temporada: historial (jugadores y equipos), traspasos y archivo de los datos de la temporada.
//
// Nada se borra. Los datos de la temporada cerrada (partidos, convocatorias, estadísticas, asistencia...) llevan
// la marca `archived_season` y dejan de salir en los listados normales. Los jugadores que se van llevan la misma
// marca (siguen en la base de datos, con su historial) y se pueden reincorporar. Todo se puede reabrir.

export const LINKED = ['MatchStats', 'TrainingAttendance', 'Convocatoria', 'MatchAvailability', 'MatchPlan', 'CoachMatchNote', 'SessionReport'];
export const ARCHIVABLE = new Set(['Event', 'Player', ...LINKED]);

const LIGA = 'partido_liga';
const TRAINING = ['entrenamiento', 'entrenamiento_fisico', 'sesion_teorica', 'sesion_video'];

export const isSeason = (s) => typeof s === 'string' && /^\d{4}-\d{4}$/.test(s) && Number(s.slice(5)) === Number(s.slice(0, 4)) + 1;
export const nextSeason = (s) => { const y = Number(s.slice(0, 4)) + 1; return `${y}-${y + 1}`; };
// La temporada va del 1 de agosto al 31 de julio. Las fechas de los eventos son texto "yyyy-MM-ddTHH:mm".
export const seasonBounds = (s) => { const y = Number(s.slice(0, 4)); return { from: `${y}-08-01`, to: `${y + 1}-08-01` }; };

export class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}

const fullName = (p) => `${p.first_name || ''} ${p.last_name || ''}`.trim();

// ── Cálculo del historial (puro: no toca la base de datos) ───────────────────────────────────────
export function buildSnapshot({ season, closedAt, teams, players, events, stats, attendance, plan, standings = {}, staff = [], existingHistory = new Set() }) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const ligaIds = new Set(events.filter((e) => e.type === LIGA).map((e) => e.id));
  const trainingIds = new Set(events.filter((e) => TRAINING.includes(e.type)).map((e) => e.id));

  const zero = () => ({ matches_played: 0, matches_starter: 0, matches_sub: 0, minutes_played: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, training_sessions: 0, training_present: 0, rsum: 0, rn: 0 });
  const byPlayer = new Map();
  const of = (id) => { if (!byPlayer.has(id)) byPlayer.set(id, zero()); return byPlayer.get(id); };

  for (const s of stats) {
    if (!s.player_id || !ligaIds.has(s.event_id)) continue; // en el historial cuenta solo la liga, como en las estadísticas de la app
    const r = of(s.player_id);
    if ((s.minutes_played || 0) > 0 || s.starter) { r.matches_played += 1; if (s.starter) r.matches_starter += 1; else r.matches_sub += 1; }
    r.minutes_played += s.minutes_played || 0;
    r.goals += s.goals || 0;
    r.assists += s.assists || 0;
    r.yellow_cards += s.yellow_cards || 0;
    r.red_cards += s.red_cards || 0;
    if (s.rating) { r.rsum += s.rating; r.rn += 1; }
  }
  for (const a of attendance) {
    if (!a.player_id) continue;
    if (a.event_id && !trainingIds.has(a.event_id)) continue;
    const r = of(a.player_id);
    r.training_sessions += 1;
    if (a.status !== 'absent') r.training_present += 1;
  }

  // Resultados de cada equipo (liga): nuestros goles = score_home, del rival = score_away
  const record = new Map();
  for (const e of events) {
    if (e.type !== LIGA || e.score_home == null || e.score_away == null || !e.team_id) continue;
    const r = record.get(e.team_id) || { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 };
    r.pj += 1; r.gf += e.score_home; r.gc += e.score_away;
    if (e.score_home > e.score_away) { r.g += 1; r.pts += 3; } else if (e.score_home === e.score_away) { r.e += 1; r.pts += 1; } else r.p += 1;
    record.set(e.team_id, r);
  }

  const playerDocs = [];
  const rosterOf = new Map();
  for (const p of players) {
    if (!p.team_id) continue;
    const team = teamById.get(p.team_id);
    const st = byPlayer.get(p.id) || zero();
    if (!rosterOf.has(p.team_id)) rosterOf.set(p.team_id, []);
    rosterOf.get(p.team_id).push({
      player_id: p.id, name: fullName(p), birth_year: p.birth_year || null, jersey_number: p.jersey_number ?? null, position: p.position || null,
      matches: st.matches_played, minutes: st.minutes_played, goals: st.goals, assists: st.assists,
    });
    if (existingHistory.has(p.id)) continue; // ya hay un registro manual de esa temporada
    const { rsum, rn, ...counts } = st;
    playerDocs.push({
      player_id: p.id, season, team_id: p.team_id, team_name: team?.name || '', category: team?.fcf_category_name || team?.category || '',
      ...counts, avg_rating: rn ? Math.round((rsum / rn) * 10) / 10 : '', is_current: false, source: 'cierre_temporada',
    });
  }

  const teamDocs = teams.map((t) => {
    const s = standings[t.id] || null;
    const roster = (rosterOf.get(t.id) || []).sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
    return {
      team_id: t.id, team_name: t.name, category: t.fcf_category_name || t.category || '', season, closed_at: closedAt,
      competition: s?.competition || t.fcf_competition_label || '', group: s?.group || t.fcf_group_label || '',
      standing: s ? { pos: s.pos ?? null, pts: s.pts ?? null, pj: s.pj ?? null, g: s.g ?? null, e: s.e ?? null, p: s.p ?? null, gf: s.gf ?? null, gc: s.gc ?? null } : null,
      record: record.get(t.id) || { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 },
      roster,
      staff: staff.filter((x) => x.team_id === t.id).map((x) => ({ name: x.name, role: x.role })),
    };
  });

  // Traspasos del plan: { moves: { [playerId]: { to: <teamId> | 'baja' | 'stay' } } }
  const moves = [];
  const playerById = new Map(players.map((p) => [p.id, p]));
  for (const [pid, mv] of Object.entries(plan?.moves || {})) {
    const p = playerById.get(pid);
    const to = mv?.to;
    if (!p || !to || to === 'stay') continue;
    if (to === 'baja') {
      moves.push({ id: pid, kind: 'baja', from: p.team_id || null, to: null, prev_status: p.status || 'activo',
        patch: { status: 'baja', archived_season: season, last_team_id: p.team_id || null, prev_status: p.status || 'activo' } });
    } else if (teamById.has(to) && to !== p.team_id) {
      moves.push({ id: pid, kind: 'move', from: p.team_id || null, to, prev_status: p.status || 'activo',
        patch: { team_id: to, previous_team_id: p.team_id || null } });
    }
  }

  const undecided = players.filter((p) => p.team_id && p.status !== 'baja' && !plan?.moves?.[p.id]).length;
  return {
    teamDocs, playerDocs, moves,
    summary: {
      teams: teamDocs.length, player_history: playerDocs.length,
      moved: moves.filter((m) => m.kind === 'move').length, bajas: moves.filter((m) => m.kind === 'baja').length,
      stay: Object.values(plan?.moves || {}).filter((m) => m?.to === 'stay').length, undecided,
    },
  };
}

// ── Lectura de datos ─────────────────────────────────────────────────────────────────────────────
const NOT_ARCHIVED = `coalesce(data->>'archived_season', '') = ''`;
const rowsOf = async (db, type, extra = '', params = []) =>
  (await db.query(`select id, data from entities where entity_type = $1 and ${NOT_ARCHIVED} ${extra}`, [type, ...params])).rows.map((r) => ({ id: r.id, ...r.data }));

async function loadSeason(db, season) {
  const { from, to } = seasonBounds(season);
  const events = await rowsOf(db, 'Event', `and data->>'date' >= $2 and data->>'date' < $3`, [from, to]);
  const ids = events.map((e) => e.id);
  const linked = async (type) => rowsOf(db, type, `and (data->>'event_id' = any($2::text[]) or (coalesce(data->>'event_id', '') = '' and data->>'date' >= $3 and data->>'date' < $4))`, [ids, from, to]);
  const [teams, players, stats, attendance] = await Promise.all([rowsOf(db, 'Team'), rowsOf(db, 'Player'), linked('MatchStats'), linked('TrainingAttendance')]);
  const assignments = await rowsOf(db, 'TeamStaffAssignment');
  const members = new Map((await rowsOf(db, 'StaffMember')).map((m) => [m.id, m]));
  const staff = assignments.filter((a) => a.active !== false).map((a) => {
    const m = members.get(a.staff_member_id);
    return { team_id: a.team_id, name: m ? fullName(m) : '', role: a.team_role || '' };
  }).filter((x) => x.name);
  const history = (await db.query(`select data->>'player_id' as pid from entities where entity_type = 'PlayerSeasonHistory' and data->>'season' = $1`, [season])).rows;
  const plan = (await db.query(`select data from entities where entity_type = 'SeasonPlan' and data->>'season' = $1 order by created_at desc limit 1`, [season])).rows[0]?.data || null;
  return { from, to, events, teams, players, stats, attendance, staff, plan, existingHistory: new Set(history.map((h) => h.pid)) };
}

async function archiveCounts(db, season) {
  const { from, to } = seasonBounds(season);
  const ev = await db.query(`select count(*)::int as n from entities where entity_type = 'Event' and ${NOT_ARCHIVED} and data->>'date' >= $1 and data->>'date' < $2`, [from, to]);
  const out = { Event: ev.rows[0].n };
  for (const type of LINKED) {
    const r = await db.query(
      `select count(*)::int as n from entities where entity_type = $1 and ${NOT_ARCHIVED}
         and (data->>'event_id' in (select id::text from entities where entity_type = 'Event' and ${NOT_ARCHIVED} and data->>'date' >= $2 and data->>'date' < $3)
              or (coalesce(data->>'event_id', '') = '' and data->>'date' >= $2 and data->>'date' < $3))`, [type, from, to]);
    out[type] = r.rows[0].n;
  }
  return out;
}

// ── Estado ───────────────────────────────────────────────────────────────────────────────────────
export async function seasonStatus(db, season) {
  const closes = (await db.query(`select id, data from entities where entity_type = 'SeasonClose' order by created_at desc`)).rows
    .map((r) => ({ id: r.id, season: r.data.season, status: r.data.status, closed_at: r.data.closed_at, closed_by: r.data.closed_by, summary: r.data.summary, archived: r.data.archived }));
  return { season, next_season: nextSeason(season), archive: await archiveCounts(db, season), closes };
}

// ── Cerrar ───────────────────────────────────────────────────────────────────────────────────────
export async function closeSeason(db, { season, standings = {}, userName = '', dry = false, now = new Date() }) {
  if (!isSeason(season)) throw new HttpError(400, 'bad_season');
  const already = await db.query(`select id from entities where entity_type = 'SeasonClose' and data->>'season' = $1 and data->>'status' = 'closed'`, [season]);
  if (already.rows.length) throw new HttpError(409, 'already_closed', 'Esa temporada ya está cerrada.');

  const d = await loadSeason(db, season);
  const closedAt = now.toISOString();
  const snap = buildSnapshot({ season, closedAt, teams: d.teams, players: d.players, events: d.events, stats: d.stats, attendance: d.attendance, plan: d.plan, standings, staff: d.staff, existingHistory: d.existingHistory });
  const archive = await archiveCounts(db, season);
  if (dry) return { dry: true, season, summary: snap.summary, archive };

  const bumpTeams = d.teams.filter((t) => t.season === season).map((t) => t.id);
  const result = await db.tx(async (t) => {
    const ins = async (type, docs) => {
      if (!docs.length) return [];
      const r = await t.query(`insert into entities (entity_type, data) select $1, x from jsonb_array_elements($2::jsonb) x returning id`, [type, JSON.stringify(docs)]);
      return r.rows.map((x) => x.id);
    };
    const teamHist = await ins('TeamSeasonHistory', snap.teamDocs);
    const playerHist = await ins('PlayerSeasonHistory', snap.playerDocs);

    if (snap.moves.length) {
      await t.query(
        `update entities e set data = e.data || m.patch, updated_at = now()
           from jsonb_to_recordset($1::jsonb) as m(id uuid, patch jsonb)
          where e.entity_type = 'Player' and e.id = m.id`,
        [JSON.stringify(snap.moves.map((m) => ({ id: m.id, patch: m.patch })))]);
    }

    const mark = `jsonb_build_object('archived_season', $1::text)`;
    const ev = await t.query(
      `with u as (update entities set data = data || ${mark}, updated_at = now()
                   where entity_type = 'Event' and ${NOT_ARCHIVED} and data->>'date' >= $2 and data->>'date' < $3 returning 1)
       select count(*)::int as n from u`, [season, d.from, d.to]);
    const archived = { Event: ev.rows[0].n };
    for (const type of LINKED) {
      const r = await t.query(
        `with u as (update entities set data = data || ${mark}, updated_at = now()
                     where entity_type = $4 and ${NOT_ARCHIVED}
                       and (data->>'event_id' in (select id::text from entities where entity_type = 'Event' and data->>'archived_season' = $1)
                            or (coalesce(data->>'event_id', '') = '' and data->>'date' >= $2 and data->>'date' < $3)) returning 1)
         select count(*)::int as n from u`, [season, d.from, d.to, type]);
      archived[type] = r.rows[0].n;
    }

    if (bumpTeams.length) {
      await t.query(`update entities set data = data || jsonb_build_object('season', $2::text), updated_at = now() where entity_type = 'Team' and id = any($1::uuid[])`, [bumpTeams, nextSeason(season)]);
    }

    const log = {
      season, status: 'closed', closed_at: closedAt, closed_by: userName, summary: snap.summary, archived,
      moves: snap.moves.map((m) => ({ id: m.id, kind: m.kind, from: m.from, to: m.to, prev_status: m.prev_status })),
      history_ids: { team: teamHist, player: playerHist }, bumped_team_ids: bumpTeams,
    };
    const closeId = (await ins('SeasonClose', [log]))[0];
    return { closeId, archived };
  });
  return { dry: false, season, summary: snap.summary, archived: result.archived, close_id: result.closeId };
}

// ── Reabrir (deshacer) ───────────────────────────────────────────────────────────────────────────
export async function reopenSeason(db, { season, now = new Date() }) {
  if (!isSeason(season)) throw new HttpError(400, 'bad_season');
  const row = (await db.query(`select id, data from entities where entity_type = 'SeasonClose' and data->>'season' = $1 and data->>'status' = 'closed' order by created_at desc limit 1`, [season])).rows[0];
  if (!row) throw new HttpError(404, 'not_closed', 'Esa temporada no está cerrada.');
  const later = await db.query(`select 1 from entities where entity_type = 'SeasonClose' and data->>'status' = 'closed' and data->>'season' > $1 limit 1`, [season]);
  if (later.rows.length) throw new HttpError(409, 'later_closed', 'Hay una temporada posterior cerrada: reábrela primero.');
  const log = row.data;

  await db.tx(async (t) => {
    // Datos archivados de esa temporada
    await t.query(`update entities set data = data - 'archived_season', updated_at = now() where entity_type = any($2::text[]) and data->>'archived_season' = $1`, [season, ['Event', ...LINKED]]);
    // Jugadores: bajas y traspasos
    const restore = (log.moves || []).map((m) => ({ id: m.id, kind: m.kind, from_team: m.from, to_team: m.to, prev_status: m.prev_status }));
    if (restore.length) {
      await t.query(
        `update entities e set data = case
              when m.kind = 'baja' then (e.data - 'archived_season' - 'last_team_id' - 'prev_status') || jsonb_build_object('status', coalesce(m.prev_status, 'activo'))
              else (e.data - 'previous_team_id') || jsonb_build_object('team_id', m.from_team) end,
            updated_at = now()
           from jsonb_to_recordset($1::jsonb) as m(id uuid, kind text, from_team text, to_team text, prev_status text)
          where e.entity_type = 'Player' and e.id = m.id and (m.kind = 'baja' or e.data->>'team_id' = m.to_team)`,
        [JSON.stringify(restore)]);
    }
    // Historial creado en el cierre
    const hist = [...(log.history_ids?.team || []), ...(log.history_ids?.player || [])];
    if (hist.length) await t.query(`delete from entities where id = any($1::uuid[]) and entity_type in ('TeamSeasonHistory', 'PlayerSeasonHistory')`, [hist]);
    // Temporada de los equipos
    if ((log.bumped_team_ids || []).length) {
      await t.query(`update entities set data = data || jsonb_build_object('season', $2::text), updated_at = now() where entity_type = 'Team' and id = any($1::uuid[])`, [log.bumped_team_ids, season]);
    }
    await t.query(`update entities set data = data || $2::jsonb, updated_at = now() where id = $1`, [row.id, JSON.stringify({ status: 'reopened', reopened_at: now.toISOString() })]);
  });
  return { season, reopened: true };
}
