// Base de datos de jugadores de la FCF para Planificación → Scouting (pedido por Nacho el 27/10/2026).
//
// Los datos salen de las actas de la intranet de la FCF (Competició → Calendaris-Resultats-Classificacions), que se leen
// desde el navegador de quien tiene la sesión del club en la intranet (solo lectura) y llegan aquí por lotes a través de la página /FcfBridge.
// Se guarda cada acta y la aparición de cada jugador en ella; las estadísticas (PJ, titular, suplente, goles, tarjetas)
// se calculan al consultar. El jugador se identifica por su ID de la FCF, que es el mismo en todas las temporadas.
// Solo datos deportivos: nombre, equipo, competición, titular/suplente, goles y tarjetas. Uso interno del club.

export const SCHEMA = [
  `create table if not exists fcf_actas (
    acta text primary key,
    season text not null,
    competition text not null,
    grp text,
    jornada int,
    match_date text,
    home text,
    away text,
    imported_at timestamptz not null default now()
  )`,
  `create index if not exists fcf_actas_season_comp on fcf_actas (season, competition, grp)`,
  `create table if not exists fcf_players (
    id text primary key,
    name text not null,
    name_norm text not null,
    updated_at timestamptz not null default now()
  )`,
  `create index if not exists fcf_players_name on fcf_players (name_norm)`,
  `create table if not exists fcf_apps (
    acta text not null references fcf_actas (acta) on delete cascade,
    player_id text not null,
    team text not null,
    starter boolean not null,
    dorsal text,
    goals int not null default 0,
    pens int not null default 0,
    yellow int not null default 0,
    second_yellow int not null default 0,
    red int not null default 0,
    primary key (acta, player_id)
  )`,
  `create index if not exists fcf_apps_player on fcf_apps (player_id)`,
];

let schemaReady = null;
export function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = (async () => { for (const s of SCHEMA) await db.query(s); })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// Nombre sin acentos y en minúsculas, para buscar
export const normName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const clip = (v, n = 160) => String(v ?? '').slice(0, n);
const SEASON_RE = /^\d{4}-\d{4}$/;

// Convierte un acta tal como la manda el lector del navegador en filas para la base de datos.
// Devuelve null si el acta no es válida.
export function actaRows(a) {
  if (!a || !/^\d+$/.test(String(a.acta || ''))) return null;
  if (!SEASON_RE.test(String(a.season || '')) || !a.competition) return null;
  const players = Array.isArray(a.players) ? a.players : [];
  const byId = new Map();
  for (const p of players) {
    if (!/^\d+$/.test(String(p.id || '')) || !p.name) continue;
    if (byId.has(p.id)) continue;
    byId.set(p.id, { player_id: String(p.id), name: clip(p.name, 120), team: clip(p.team, 120), starter: !!p.tit, dorsal: clip(p.dorsal, 4), goals: 0, pens: 0, yellow: 0, second_yellow: 0, red: 0 });
  }
  for (const g of Array.isArray(a.goals) ? a.goals : []) {
    const row = g && byId.get(String(g.id));
    if (!row || /pr[òo]pia/i.test(String(g.type || ''))) continue; // los goles en propia puerta no se atribuyen
    row.goals += 1;
    if (/penal/i.test(String(g.type || ''))) row.pens += 1;
  }
  for (const c of Array.isArray(a.cards) ? a.cards : []) {
    const row = c && byId.get(String(c.id));
    if (!row) continue; // tarjetas a técnicos y delegados
    if (c.type === 'A') row.yellow += 1;
    else if (c.type === '2A') row.second_yellow += 1;
    else if (c.type === 'R') row.red += 1;
  }
  const teams = Array.isArray(a.teams) ? a.teams : [];
  return {
    acta: {
      acta: String(a.acta), season: a.season, competition: clip(a.competition), grp: clip(a.group, 40) || null,
      jornada: Number.isFinite(+a.jornada) ? +a.jornada : null, match_date: clip(a.date, 12) || null,
      home: clip(teams[0], 120) || null, away: clip(teams[1], 120) || null,
    },
    apps: [...byId.values()],
  };
}

// Guarda un lote de actas en una sola transacción y con pocas consultas (todas las actas del lote a la vez).
// Repetir un acta la sustituye (se puede volver a leer sin duplicar).
export async function importActas(db, actas) {
  const rows = [];
  const seen = new Set();
  let skipped = 0;
  for (const a of actas) {
    const r = actaRows(a);
    if (!r || seen.has(r.acta.acta)) { skipped += 1; continue; }
    seen.add(r.acta.acta);
    rows.push(r);
  }
  if (!rows.length) return { saved: 0, skipped };
  const A = rows.map((r) => r.acta);
  const apps = rows.flatMap((r) => r.apps.map((p) => ({ ...p, acta: r.acta.acta })));
  // Un mismo jugador puede salir en varias actas del lote: un solo registro (el último nombre visto)
  const players = new Map();
  for (const p of apps) players.set(p.player_id, p.name);
  const col = (list, k) => list.map((x) => x[k]);
  await db.tx(async (c) => {
    await c.query(
      `insert into fcf_actas (acta, season, competition, grp, jornada, match_date, home, away, imported_at)
       select t.*, now() from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[], $7::text[], $8::text[])
         as t(acta, season, competition, grp, jornada, match_date, home, away)
       on conflict (acta) do update set season=excluded.season, competition=excluded.competition, grp=excluded.grp,
         jornada=excluded.jornada, match_date=excluded.match_date, home=excluded.home, away=excluded.away, imported_at=now()`,
      [col(A, 'acta'), col(A, 'season'), col(A, 'competition'), col(A, 'grp'), col(A, 'jornada'), col(A, 'match_date'), col(A, 'home'), col(A, 'away')]
    );
    await c.query(`delete from fcf_apps where acta = any($1::text[])`, [col(A, 'acta')]);
    if (!apps.length) return;
    const ids = [...players.keys()];
    await c.query(
      `insert into fcf_players (id, name, name_norm, updated_at)
       select t.*, now() from unnest($1::text[], $2::text[], $3::text[]) as t(id, name, name_norm)
       on conflict (id) do update set name = excluded.name, name_norm = excluded.name_norm, updated_at = now()`,
      [ids, ids.map((i) => players.get(i)), ids.map((i) => normName(players.get(i)))]
    );
    await c.query(
      `insert into fcf_apps (acta, player_id, team, starter, dorsal, goals, pens, yellow, second_yellow, red)
       select * from unnest($1::text[], $2::text[], $3::text[], $4::boolean[], $5::text[], $6::int[], $7::int[], $8::int[], $9::int[], $10::int[])`,
      [col(apps, 'acta'), col(apps, 'player_id'), col(apps, 'team'), col(apps, 'starter'), col(apps, 'dorsal'),
        col(apps, 'goals'), col(apps, 'pens'), col(apps, 'yellow'), col(apps, 'second_yellow'), col(apps, 'red')]
    );
  });
  return { saved: rows.length, skipped };
}

// Año de nacimiento a partir de la competición: «… S15» en 2026-2027 = 2027 − 15 = 2012.
// En juveniles y otras sin «S» no se puede (null). Es una estimación: no ve si el jugador juega un año por arriba.
export function birthYearFromCompetition(competition, season) {
  const m = String(competition || '').match(/\bS(\d{1,2})\b/);
  const end = Number(String(season || '').slice(5, 9));
  if (!m || !end) return null;
  return end - Number(m[1]);
}

export async function meta(db) {
  const { rows: comps } = await db.query(
    `select season, competition, grp, count(*)::int as actas, max(imported_at) as last
     from fcf_actas group by season, competition, grp order by season desc, competition, grp`
  );
  const { rows: tot } = await db.query(`select count(*)::int as players from fcf_players`);
  return {
    players: tot[0]?.players || 0,
    actas: comps.reduce((s, c) => s + c.actas, 0),
    last_import: comps.reduce((m, c) => (!m || c.last > m ? c.last : m), null),
    seasons: [...new Set(comps.map((c) => c.season))],
    competitions: comps,
  };
}

const SORTS = {
  tit: 'tit desc, pj desc, goals desc',
  goals: 'goals desc, tit desc',
  pj: 'pj desc, tit desc',
  name: 'name asc',
};

// Buscador: una fila por jugador con sus números de la temporada (filtrable por competición, grupo, equipo y nombre)
export async function searchPlayers(db, f = {}) {
  const params = [];
  const where = [];
  const add = (v) => { params.push(v); return `$${params.length}`; };
  where.push(`c.season = ${add(SEASON_RE.test(f.season || '') ? f.season : '2026-2027')}`);
  if (f.competition) where.push(`c.competition = ${add(String(f.competition))}`);
  if (f.grp) where.push(`c.grp = ${add(String(f.grp))}`);
  if (f.team) where.push(`p.team = ${add(String(f.team))}`);
  const q = normName(f.q);
  const nameFilter = q.length >= 2 ? `where f.name_norm like ${add(`%${q}%`)}` : '';
  const limit = Math.min(Math.max(parseInt(f.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(f.offset, 10) || 0, 0);
  const sort = SORTS[f.sort] || SORTS.tit;
  const sql = `
    with a as (
      select p.player_id, p.team, p.starter, p.goals, p.yellow, p.second_yellow, p.red, c.competition, c.grp, c.season
      from fcf_apps p join fcf_actas c on c.acta = p.acta
      where ${where.join(' and ')}
    ), agg as (
      select player_id,
        count(*)::int as pj,
        sum(case when starter then 1 else 0 end)::int as tit,
        sum(goals)::int as goals,
        sum(yellow)::int as yellow,
        sum(second_yellow + red)::int as reds,
        mode() within group (order by team) as team,
        mode() within group (order by competition) as competition,
        mode() within group (order by grp) as grp,
        max(season) as season
      from a group by player_id
    )
    select agg.*, f.name, count(*) over()::int as total
    from agg join fcf_players f on f.id = agg.player_id
    ${nameFilter}
    order by ${sort}
    limit ${limit} offset ${offset}`;
  const { rows } = await db.query(sql, params);
  return {
    total: rows[0]?.total || 0,
    rows: rows.map(({ total: _t, ...r }) => ({ ...r, sup: r.pj - r.tit, birth_year: birthYearFromCompetition(r.competition, r.season) })),
  };
}

// Ficha: temporada a temporada (equipo y competición) y la lista de partidos
export async function playerDetail(db, id) {
  if (!/^\d+$/.test(String(id || ''))) return null;
  const { rows: pl } = await db.query(`select id, name from fcf_players where id = $1`, [String(id)]);
  if (!pl[0]) return null;
  const { rows: seasons } = await db.query(
    `select c.season, p.team, c.competition, c.grp,
       count(*)::int as pj, sum(case when p.starter then 1 else 0 end)::int as tit,
       sum(p.goals)::int as goals, sum(p.pens)::int as pens, sum(p.yellow)::int as yellow,
       sum(p.second_yellow)::int as second_yellow, sum(p.red)::int as red
     from fcf_apps p join fcf_actas c on c.acta = p.acta
     where p.player_id = $1
     group by c.season, p.team, c.competition, c.grp
     order by c.season desc, pj desc`, [String(id)]
  );
  const { rows: matches } = await db.query(
    `select c.acta, c.season, c.competition, c.grp, c.jornada, c.match_date, c.home, c.away,
       p.team, p.starter, p.dorsal, p.goals, p.yellow, p.second_yellow, p.red
     from fcf_apps p join fcf_actas c on c.acta = p.acta
     where p.player_id = $1
     order by c.season desc, c.jornada desc nulls last
     limit 200`, [String(id)]
  );
  const years = seasons.map((s) => birthYearFromCompetition(s.competition, s.season)).filter(Boolean);
  return {
    id: pl[0].id,
    name: pl[0].name,
    birth_year: years.length ? Math.max(...years) : null,
    seasons: seasons.map((s) => ({ ...s, sup: s.pj - s.tit })),
    matches,
  };
}
