// Nombre y apellidos de los jugadores (14/11/2026, Nacho: «algunos jugadores… se les ponía el nombre y el primer apellido
// en la casilla de nombre… revísalo a ver si hay algún caso más»).
//
// La sincronización con la FCF crea jugadores a partir del nombre completo de la plantilla («NOMBRE APELLIDO1 APELLIDO2»)
// y antes daba por hecho que las dos últimas palabras eran los apellidos. Con apellidos compuestos («Abante de Prada»,
// «de la Fuente») el primer apellido acababa en el nombre. Ahora:
//  - `splitFullName` junta las partículas (de, del, la, i, y…) con el apellido que las sigue;
//  - `nameProposals` busca las fichas ya creadas cuyo nombre está mal partido comparándolas con la FCF, que guarda
//    los nombres como «APELLIDOS, NOMBRE» (fiable): por la ficha vinculada (`fcf_player_id`) o, si no, por el nombre.

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const JOIN = new Set(['i', 'y']);
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'i', 'y', 'da', 'das', 'do', 'dos', 'di', 'van', 'von', 'der', 'den', 'le', 'du', 'al', 'ben', 'bin']);

export function titleCase(s) {
  return clean(s).toLowerCase().replace(/(^|[\s\-'’(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

// Un apellido desde el final: la última palabra y las partículas que lleve delante («de la Fuente»)
function takeSurname(words) {
  if (!words.length) return [];
  let i = words.length - 1;
  for (;;) {
    while (i > 0 && PARTICLES.has(norm(words[i - 1])) && !JOIN.has(norm(words[i - 1]))) i -= 1;
    // «Puig i Cadafalch»: la conjunción une con el apellido de delante
    if (i > 1 && JOIN.has(norm(words[i - 1]))) { i -= 2; continue; }
    break;
  }
  return words.splice(i);
}

// «JOAN ABANTE DE PRADA» → { first: "Joan", last: "Abante De Prada" }. Siempre deja al menos una palabra de nombre.
export function splitFullName(full) {
  const words = clean(full).split(' ').filter(Boolean);
  if (words.length <= 2) return { first: titleCase(words[0] || ''), last: titleCase(words.slice(1).join(' ')) };
  const rest = [...words];
  const s2 = takeSurname(rest);
  const s1 = rest.length > 1 ? takeSurname(rest) : [];
  if (!rest.length) { // todo eran apellidos: la primera palabra es el nombre
    const all = [...s1, ...s2];
    return { first: titleCase(all[0]), last: titleCase(all.slice(1).join(' ')) };
  }
  return { first: titleCase(rest.join(' ')), last: titleCase([...s1, ...s2].join(' ')) };
}

// «ABANTE DE PRADA, JOAN» → nº de palabras del nombre y orden «nombre apellidos» normalizado
export function fcfParts(fcfName) {
  const [sur = '', fst = ''] = String(fcfName || '').split(',').map(clean);
  if (!sur || !fst) return null;
  return { firstWords: fst.split(' ').length, ordered: norm(`${fst} ${sur}`), first: fst, last: sur };
}

// Propuesta para una ficha: corta sus propias palabras donde dice la FCF (se respetan mayúsculas y acentos de la ficha).
// null si ya está bien o si las palabras no son las mismas y en el mismo orden.
export function proposalFor(p, fcfName) {
  const fp = fcfParts(fcfName);
  if (!fp) return null;
  const words = clean(`${p.first_name || ''} ${p.last_name || ''}`).split(' ').filter(Boolean);
  if (norm(words.join(' ')) !== fp.ordered) return null;
  const first = words.slice(0, fp.firstWords).join(' ');
  const last = words.slice(fp.firstWords).join(' ');
  if (!first || !last) return null;
  if (first === clean(p.first_name) && last === clean(p.last_name)) return null;
  return { first_name: first, last_name: last };
}

// Todas las formas de partir el nombre de una ficha en «apellidos, nombre» (para buscarla en fcf_players.name_norm)
export function splitKeys(p) {
  const words = norm(`${p.first_name || ''} ${p.last_name || ''}`).split(' ').filter(Boolean);
  const out = [];
  for (let k = 1; k < words.length; k++) out.push(`${words.slice(k).join(' ')}, ${words.slice(0, k).join(' ')}`);
  return out;
}

// Revisa todas las fichas. `db.query` sobre las tablas de la FCF. Devuelve { rows, fixes } donde rows son las fichas
// mal partidas: { id, team_id, current, proposed, source: 'vinculada' | 'nombre', fcf_name }.
export async function nameProposals(db, players) {
  const list = players.filter((r) => r.data && !r.data.archived && clean(r.data.first_name) && clean(r.data.last_name));
  const linked = [...new Set(list.map((r) => String(r.data.fcf_player_id || '')).filter(Boolean))];
  const byId = new Map();
  if (linked.length) {
    const { rows } = await db.query(`select id, name from fcf_players where id = any($1::text[])`, [linked]);
    for (const r of rows) byId.set(String(r.id), r.name);
  }
  const loose = list.filter((r) => !byId.has(String(r.data.fcf_player_id || '')));
  const keys = [...new Set(loose.flatMap((r) => splitKeys(r.data)))];
  const byKey = new Map();
  for (let i = 0; i < keys.length; i += 2000) {
    const { rows } = await db.query(`select name_norm, min(name) as name, count(*)::int as n from fcf_players where name_norm = any($1::text[]) group by name_norm`, [keys.slice(i, i + 2000)]);
    for (const r of rows) byKey.set(r.name_norm, r.name);
  }
  const out = [];
  for (const r of list) {
    const d = r.data;
    let fcfName = byId.get(String(d.fcf_player_id || ''));
    let source = 'vinculada';
    if (!fcfName) {
      // Sin vincular: solo si su nombre aparece en la FCF partido de UNA sola manera
      const hits = splitKeys(d).filter((k) => byKey.has(k));
      if (hits.length !== 1) continue;
      fcfName = byKey.get(hits[0]);
      source = 'nombre';
    }
    const proposed = proposalFor(d, fcfName);
    if (!proposed) continue;
    out.push({ id: r.id, team_id: d.team_id || null, current: { first_name: d.first_name, last_name: d.last_name }, proposed, source, fcf_name: fcfName });
  }
  return out;
}
