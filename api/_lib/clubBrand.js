// Configuración del aspecto del club (página Configuración): una sola fila `ClubSettings` en la tabla entities,
// fuera del alcance de la API genérica (CLUB_PRIVATE). Solo se guarda lo que cambia respecto a los valores por
// defecto (Racing Sarrià), ya limpio: sin fila o con `brand: {}`, la app sale exactamente como siempre.
import { query } from './db.js';
import { brandDiff, cleanBrand } from '../../src/lib/brand.js';

const TYPE = 'ClubSettings';

async function row() {
  return (await query(`select id, data from entities where entity_type = $1 order by created_at asc limit 1`, [TYPE])).rows[0] || null;
}

export async function readClubBrand() {
  const r = await row();
  return cleanBrand(r?.data?.brand || {});
}

export async function saveClubBrand(raw, user) {
  const brand = brandDiff(raw || {});
  const r = await row();
  const data = { ...(r?.data || {}), brand, updated_at: new Date().toISOString(), updated_by: user?.full_name || user?.email || '' };
  if (r) await query(`update entities set data = $2::jsonb, updated_at = now() where id = $1`, [r.id, JSON.stringify(data)]);
  else await query(`insert into entities (entity_type, data) values ($1, $2::jsonb)`, [TYPE, JSON.stringify(data)]);
  return brand;
}
