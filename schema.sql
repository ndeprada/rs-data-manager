-- RS Data Manager - schema propio (sustituye a Base44)
-- Ejecutar una vez en la base de datos Postgres (Neon / Vercel Postgres)

create extension if not exists pgcrypto;

-- Credenciales de login, separadas de los datos de perfil
create table if not exists auth_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Almacén genérico de "entidades" (Team, StaffMember, User, TeamStaffAssignment, etc.)
-- Cada fila es un documento JSON, igual que en Base44. El id de la fila coincide
-- con auth_users.id para el caso de entity_type = 'User'.
create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entities_type on entities (entity_type);
create index if not exists idx_entities_data on entities using gin (data);
create index if not exists idx_entities_type_created on entities (entity_type, created_at desc);
