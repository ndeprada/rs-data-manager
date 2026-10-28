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
  // Nivel de edad de la competición (S15 = 15; juvenil = 17; otras = null): sirve para el año de nacimiento y las alertas
  `alter table fcf_actas add column if not exists lvl int`,
  `update fcf_actas set lvl = coalesce(substring(competition from 'S([0-9]{1,2})$')::int, case when competition ilike '%JUVENIL%' then 17 end)
   where lvl is null and (competition ~ 'S[0-9]{1,2}$' or competition ilike '%JUVENIL%')`,
  `create index if not exists fcf_actas_lvl on fcf_actas (season, lvl)`,
];

// Nivel de edad de una competición: «… S15» = 15, juvenil = 17 (abarca tres años), otras (amateur…) = null
export function compLevel(competition) {
  const c = String(competition || '');
  const m = c.match(/S(\d{1,2})$/);
  if (m) return Number(m[1]);
  return /JUVENIL/i.test(c) ? 17 : null;
}

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
      `insert into fcf_actas (acta, season, competition, grp, jornada, match_date, home, away, lvl, imported_at)
       select t.*, now() from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[], $7::text[], $8::text[], $9::int[])
         as t(acta, season, competition, grp, jornada, match_date, home, away, lvl)
       on conflict (acta) do update set season=excluded.season, competition=excluded.competition, grp=excluded.grp,
         jornada=excluded.jornada, match_date=excluded.match_date, home=excluded.home, away=excluded.away, lvl=excluded.lvl, imported_at=now()`,
      [col(A, 'acta'), col(A, 'season'), col(A, 'competition'), col(A, 'grp'), col(A, 'jornada'), col(A, 'match_date'), col(A, 'home'), col(A, 'away'),
        A.map((x) => compLevel(x.competition))]
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

// Año de nacimiento estimado de cada jugador con todo lo leído: la categoría S más joven en la que ha jugado (S16 en 2025-26 = 2010).
// Juvenil no cuenta (abarca tres años). Un jugador que juega por arriba sigue teniendo su categoría propia en otras actas.
const BY_EXPR = `max(substring(c.season from 6 for 4)::int - c.lvl)`;
export async function birthYears(db, ids) {
  const list = [...new Set((ids || []).map(String))];
  if (!list.length) return new Map();
  const { rows } = await db.query(
    `select p.player_id, ${BY_EXPR} as by from fcf_apps p join fcf_actas c on c.acta = p.acta
     where p.player_id = any($1::text[]) and c.lvl <= 16 group by p.player_id`, [list]
  );
  return new Map(rows.map((r) => [r.player_id, r.by]));
}

// Dorsales habituales: los números con los que ha salido en las actas, el más usado primero (hasta 3), con cuántas veces.
// `src` es una tabla/CTE con player_id y dorsal (ya filtrada por temporada, equipo…).
const DORSALS_SQL = (src, keys = 'player_id') => `
      select ${keys}, json_agg(json_build_object('d', dorsal, 'n', n) order by n desc, length(dorsal), dorsal) as dorsals from (
        select ${keys}, dorsal, count(*)::int as n from ${src}
        where dorsal is not null and dorsal <> '' group by ${keys}, dorsal
      ) dd group by ${keys}`;
export function cleanDorsals(v) {
  const list = typeof v === 'string' ? JSON.parse(v) : v;
  return Array.isArray(list) ? list.slice(0, 3).map((x) => ({ d: String(x.d), n: Number(x.n) || 0 })) : [];
}
// Dorsales de la temporada de varios jugadores (todas sus actas de esa temporada)
export async function seasonDorsals(db, season, ids) {
  const list = [...new Set((ids || []).map(String))];
  if (!list.length) return new Map();
  const { rows } = await db.query(
    `with a as (select p.player_id, p.dorsal from fcf_apps p join fcf_actas c on c.acta = p.acta
       where c.season = $1 and p.player_id = any($2::text[])) ${DORSALS_SQL('a')}`,
    [season, list]
  );
  return new Map(rows.map((r) => [r.player_id, cleanDorsals(r.dorsals)]));
}

// Buscador: una fila por jugador con sus números de la temporada (filtrable por competición, grupo, equipo, nombre, año e ids)
export async function searchPlayers(db, f = {}) {
  const params = [];
  const where = [];
  const add = (v) => { params.push(v); return `$${params.length}`; };
  where.push(`c.season = ${add(SEASON_RE.test(f.season || '') ? f.season : '2026-2027')}`);
  if (f.competition) where.push(`c.competition = ${add(String(f.competition))}`);
  if (f.grp) where.push(`c.grp = ${add(String(f.grp))}`);
  if (f.team) where.push(`p.team = ${add(String(f.team))}`);
  const ids = String(f.ids || '').split(',').map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).slice(0, 500);
  if (f.ids !== undefined) where.push(`p.player_id = any(${add(ids)}::text[])`);
  const year = parseInt(f.year, 10);
  if (year > 1990 && year < 2030) {
    where.push(`p.player_id in (select p2.player_id from fcf_apps p2 join fcf_actas c2 on c2.acta = p2.acta
      where c2.lvl <= 16 group by p2.player_id having max(substring(c2.season from 6 for 4)::int - c2.lvl) = ${add(year)})`);
  }
  const q = normName(f.q);
  const nameFilter = q.length >= 2 ? `where f.name_norm like ${add(`%${q}%`)}` : '';
  const limit = Math.min(Math.max(parseInt(f.limit, 10) || 50, 1), 500);
  const offset = Math.max(parseInt(f.offset, 10) || 0, 0);
  const sort = SORTS[f.sort] || SORTS.tit;
  const sql = `
    with a as (
      select p.player_id, p.team, p.starter, p.dorsal, p.goals, p.yellow, p.second_yellow, p.red, c.competition, c.grp, c.season
      from fcf_apps p join fcf_actas c on c.acta = p.acta
      where ${where.join(' and ')}
    ), ds as (${DORSALS_SQL('a')}
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
    select agg.*, ds.dorsals, f.name, count(*) over()::int as total
    from agg join fcf_players f on f.id = agg.player_id left join ds on ds.player_id = agg.player_id
    ${nameFilter}
    order by ${sort}, f.name
    limit ${limit} offset ${offset}`;
  const { rows } = await db.query(sql, params);
  const by = await birthYears(db, rows.map((r) => r.player_id));
  return {
    total: rows[0]?.total || 0,
    rows: rows.map(({ total: _t, ...r }) => ({ ...r, dorsals: cleanDorsals(r.dorsals), sup: r.pj - r.tit, birth_year: by.get(r.player_id) ?? null })),
  };
}

// Cuántos jugadores hay de cada año de nacimiento en una temporada (para los botones de año)
export async function yearCounts(db, season) {
  const s = SEASON_RE.test(season || '') ? season : '2026-2027';
  const { rows } = await db.query(
    `with cur as (select distinct p.player_id from fcf_apps p join fcf_actas c on c.acta = p.acta where c.season = $1)
     select by::int as year, count(*)::int as n from (
       select p.player_id, ${BY_EXPR} as by from fcf_apps p join fcf_actas c on c.acta = p.acta
       where c.lvl <= 16 and p.player_id in (select player_id from cur) group by p.player_id
     ) t group by by order by by`, [s]
  );
  const { rows: tot } = await db.query(`select count(distinct p.player_id)::int as n from fcf_apps p join fcf_actas c on c.acta = p.acta where c.season = $1`, [s]);
  const known = rows.reduce((a, r) => a + r.n, 0);
  return { years: rows, unknown: Math.max(0, (tot[0]?.n || 0) - known) };
}

// Equipos de un grupo con sus jugadores y partidos leídos
export async function groupTeams(db, { season, competition, grp } = {}) {
  if (!SEASON_RE.test(season || '') || !competition || !grp) return [];
  const { rows } = await db.query(
    `select p.team, count(distinct p.player_id)::int as players, count(distinct p.acta)::int as pj, sum(p.goals)::int as goals
     from fcf_apps p join fcf_actas c on c.acta = p.acta
     where c.season = $1 and c.competition = $2 and c.grp = $3
     group by p.team order by p.team`, [season, String(competition), String(grp)]
  );
  return rows;
}

// Plantilla de un equipo (según las actas): sus jugadores con estadísticas y un resumen del equipo
export async function teamSquad(db, { season, competition, grp, team } = {}) {
  if (!SEASON_RE.test(season || '') || !team) return null;
  const f = { season, team, limit: 500, sort: 'tit' };
  if (competition) f.competition = competition;
  if (grp) f.grp = grp;
  const squad = await searchPlayers(db, f);
  const params = [season, String(team)];
  let extra = '';
  if (competition) { params.push(String(competition)); extra += ` and c.competition = $${params.length}`; }
  if (grp) { params.push(String(grp)); extra += ` and c.grp = $${params.length}`; }
  const { rows } = await db.query(
    `select count(distinct p.acta)::int as pj, sum(p.goals)::int as goals, max(c.match_date) as last_date, max(c.imported_at) as last_import
     from fcf_apps p join fcf_actas c on c.acta = p.acta where c.season = $1 and p.team = $2${extra}`, params
  );
  return { team, season, competition: competition || squad.rows[0]?.competition || null, grp: grp || squad.rows[0]?.grp || null, ...rows[0], players: squad.rows };
}

const prevSeason = (s) => { const a = Number(String(s).slice(0, 4)); return `${a - 1}-${a}`; };
// Juvenil de 1.º año que merece alerta (decidido con Nacho el 28/10/2026): solo en Juvenil Primera y Preferent (Liga Nacional y
// Segona no) y con MÁS de 5 titularidades en esa competición. El resto de juveniles se distinguen por el color de su año.
const FIRST_YEAR_COMPS = `(c.competition ilike '%PREFERENT%' or c.competition ilike '%PRIMERA%') and c.competition not ilike '%NACIONAL%'`;
export const FIRST_YEAR_MIN_TIT = 6;

// Alertas de una temporada:
//  · primer_ano: juvenil de 1.º año (nacido en «fin de temporada − 17») titular habitual en Juvenil Primera o Preferent.
//  · arriba: jugador que aparece en actas de una categoría superior a la suya (la más joven en la que juega esa temporada).
export async function alerts(db, season, { minTit = FIRST_YEAR_MIN_TIT } = {}) {
  const s = SEASON_RE.test(season || '') ? season : '2026-2027';
  const prev = prevSeason(s);
  const end = Number(s.slice(5, 9));
  const { rows: first } = await db.query(
    `with cur as (
       select p.player_id, c.competition, c.grp, mode() within group (order by p.team) as team,
         count(*)::int as pj, sum(case when p.starter then 1 else 0 end)::int as tit, sum(p.goals)::int as goals
       from fcf_apps p join fcf_actas c on c.acta = p.acta
       where c.season = $1 and c.lvl = 17 and ${FIRST_YEAR_COMPS}
       group by p.player_id, c.competition, c.grp
       having sum(case when p.starter then 1 else 0 end) >= $3
     ), by as (
       select p.player_id, ${BY_EXPR} as by from fcf_apps p join fcf_actas c on c.acta = p.acta
       where c.lvl <= 16 and p.player_id in (select player_id from cur) group by p.player_id
     ), prev as (
       select p.player_id, mode() within group (order by c.competition) as prev_comp, mode() within group (order by p.team) as prev_team
       from fcf_apps p join fcf_actas c on c.acta = p.acta
       where c.season = $2 and c.lvl <= 16 and p.player_id in (select player_id from cur) group by p.player_id
     )
     select cur.*, by.by, prev.prev_comp, prev.prev_team, f.name
     from cur join by on by.player_id = cur.player_id and by.by = $4
     left join prev on prev.player_id = cur.player_id join fcf_players f on f.id = cur.player_id
     order by cur.tit desc, cur.pj desc limit 2000`, [s, prev, Math.max(0, Number(minTit) || 0), end - 17]
  );
  const { rows: up } = await db.query(
    `with s as (
       select p.player_id, p.team, p.starter, p.goals, c.competition, c.grp, c.lvl
       from fcf_apps p join fcf_actas c on c.acta = p.acta where c.season = $1 and c.lvl is not null
     ), own as (
       select player_id, min(lvl) as own from s group by player_id having min(lvl) < max(lvl)
     ), own_comp as (
       select s.player_id, mode() within group (order by s.competition) as own_comp, mode() within group (order by s.team) as own_team
       from s join own o on o.player_id = s.player_id where s.lvl = o.own group by s.player_id
     ), upc as (
       select s.player_id, s.competition, s.grp, max(s.lvl) as lvl, mode() within group (order by s.team) as team,
         count(*)::int as pj, sum(case when s.starter then 1 else 0 end)::int as tit, sum(s.goals)::int as goals
       from s join own o on o.player_id = s.player_id where s.lvl > o.own group by s.player_id, s.competition, s.grp
     )
     select upc.*, o.own, oc.own_comp, oc.own_team, f.name
     from upc join own o on o.player_id = upc.player_id join own_comp oc on oc.player_id = upc.player_id join fcf_players f on f.id = upc.player_id
     order by upc.pj desc, upc.tit desc limit 2000`, [s]
  );
  const allIds = [...first.map((r) => r.player_id), ...up.map((r) => r.player_id)];
  const by = await birthYears(db, allIds);
  const dors = await seasonDorsals(db, s, allIds);
  return [
    ...first.map((r) => ({
      kind: 'primer_ano', player_id: r.player_id, name: r.name, birth_year: r.by,
      team: r.team, competition: r.competition, grp: r.grp, pj: r.pj, tit: r.tit, goals: r.goals, dorsals: dors.get(r.player_id) || [],
      prev_comp: r.prev_comp, prev_team: r.prev_team,
    })),
    ...up.map((r) => ({
      kind: 'arriba', player_id: r.player_id, name: r.name, birth_year: by.get(r.player_id) ?? (r.own <= 16 ? end - r.own : null),
      team: r.team, competition: r.competition, grp: r.grp, pj: r.pj, tit: r.tit, goals: r.goals, dorsals: dors.get(r.player_id) || [],
      own_comp: r.own_comp, own_team: r.own_team,
    })),
  ];
}

// Ficha: temporada a temporada (equipo y competición) y la lista de partidos
export async function playerDetail(db, id) {
  if (!/^\d+$/.test(String(id || ''))) return null;
  const { rows: pl } = await db.query(`select id, name from fcf_players where id = $1`, [String(id)]);
  if (!pl[0]) return null;
  const { rows: seasons } = await db.query(
    `with a as (select c.season, p.team, c.competition, c.grp, p.dorsal from fcf_apps p join fcf_actas c on c.acta = p.acta where p.player_id = $1),
     ds as (${DORSALS_SQL('a', 'season, team, competition, grp')})
     select c.season, p.team, c.competition, c.grp, min(ds.dorsals::text) as dorsals,
       count(*)::int as pj, sum(case when p.starter then 1 else 0 end)::int as tit,
       sum(p.goals)::int as goals, sum(p.pens)::int as pens, sum(p.yellow)::int as yellow,
       sum(p.second_yellow)::int as second_yellow, sum(p.red)::int as red
     from fcf_apps p join fcf_actas c on c.acta = p.acta
     left join ds on ds.season = c.season and ds.team = p.team and ds.competition = c.competition and ds.grp = c.grp
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
  const by = await birthYears(db, [String(id)]);
  return {
    id: pl[0].id,
    name: pl[0].name,
    birth_year: by.get(String(id)) ?? null,
    seasons: seasons.map((s) => ({ ...s, dorsals: cleanDorsals(s.dorsals), sup: s.pj - s.tit })),
    matches,
  };
}
