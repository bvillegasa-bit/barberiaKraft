-- =============================================================================
-- Barbería Kraft — Hito 1 · migración 0001_init.sql
-- Fecha: 2026-09-21 · Proyecto: calidad-de-software-g6 (barberia-kraft)
-- Aplicar en Supabase (SQL editor) o `supabase db push`. NO editar a mano.
-- Copia LITERAL del topic_key sdd/plataforma-barberia-kraft/sql-schema.
-- Orden: extensions → tablas → funciones helper → trigger auth → función
-- ocupación → trigger límite sillas → trigger rol → RLS policies → grants → seed.
-- =============================================================================

-- =============================================================================
-- 1. Extensiones
-- =============================================================================
create extension if not exists pgcrypto; -- gen_random_uuid() (idempotente; Supabase ya la incluye)

-- =============================================================================
-- 2. Tablas
-- =============================================================================

-- Perfiles: rol del usuario (cliente|admin). Creada por trigger desde auth.users.
create table public.profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  email     text not null,
  nombre    text not null default '',
  rol       text not null default 'cliente' check (rol in ('cliente','admin')),
  creado_en timestamptz not null default now()
);

-- Catálogo de servicios (RF01/RF06)
create table public.servicios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (char_length(nombre) > 0),
  descripcion  text not null default '',
  precio_soles numeric(10,2) not null check (precio_soles > 0),
  duracion_min int not null default 30 check (duracion_min > 0),
  activo       boolean not null default true,
  orden        int not null default 0
);
create index idx_servicios_activo_orden on public.servicios (activo, orden, nombre);

-- Promociones (RF05/RF07) — opción A: activo/inactivo
create table public.promociones (
  id                  uuid primary key default gen_random_uuid(),
  titulo              text not null check (char_length(titulo) > 0),
  descripcion         text not null default '',
  precio_oferta_soles numeric(10,2),
  beneficio           text not null default '',
  activo              boolean not null default true,
  creado_en           timestamptz not null default now()
);
create index idx_promociones_activo on public.promociones (activo);

-- Parámetros configurables (RF02): sillas_totales=4, tiempo_servicio_promedio_min=30, techo_espera_min=60
create table public.configuracion (
  clave       text primary key,
  valor       text not null,
  descripcion text not null default ''
);

-- Sillas del local (RF10): una fila por silla
create table public.sillas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique check (char_length(nombre) > 0),
  estado         text not null default 'libre' check (estado in ('libre','ocupada')),
  barbero_nombre text not null default '',
  servicio_id    uuid references public.servicios (id) on delete set null,
  ocupada_desde  timestamptz
);
create index idx_sillas_estado on public.sillas (estado);

-- Clientes (RF03/RF08) — consentimiento Ley 29733
create table public.clientes (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid references public.profiles (id) on delete set null,
  nombre              text not null default '',
  telefono            text not null default '',
  email               text not null,
  consentimiento_datos boolean not null default false,
  creado_en           timestamptz not null default now()
);
create unique index idx_clientes_profile on public.clientes (profile_id);

-- Historial de atención (RF09) — esquema+RLS en Hito 1; pantallas admin en Hito 2
create table public.historial_atencion (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid references public.clientes (id) on delete set null,
  servicio_id   uuid references public.servicios (id) on delete set null,
  silla_id      uuid references public.sillas (id) on delete set null,
  fecha_atencion timestamptz not null default now(),
  importe       numeric(10,2) check (importe > 0),
  notas         text not null default ''
);
create index idx_historial_cliente on public.historial_atencion (cliente_id);

-- =============================================================================
-- 3. Funciones helper de rol (evitan recursión RLS; SECURITY DEFINER + search_path)
-- =============================================================================
create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select rol from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin')
$$;

-- =============================================================================
-- 4. Trigger: crear profile+cliente al registrarse (RF03, CA-RF03-2, CA-RF08-2)
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, nombre, rol)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', ''), 'cliente');
  insert into public.clientes (profile_id, email, consentimiento_datos)
  values (new.id, new.email, false)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 5. Función de ocupación (fuente de verdad — RF02/RF10, fórmula spec §3.2)
-- =============================================================================
create or replace function public.obtener_ocupacion()
returns table (sillas_totales int, sillas_ocupadas int, porcentaje int, espera_min int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_totales int; v_tiempo int; v_techo int; v_ocupadas int;
  v_porcentaje numeric; v_espera numeric;
begin
  select coalesce((select valor::int from public.configuracion where clave = 'sillas_totales'), 4) into v_totales;
  select coalesce((select valor::int from public.configuracion where clave = 'tiempo_servicio_promedio_min'), 30) into v_tiempo;
  select coalesce((select valor::int from public.configuracion where clave = 'techo_espera_min'), 60) into v_techo;
  select count(*) into v_ocupadas from public.sillas where estado = 'ocupada';

  v_porcentaje := round((v_ocupadas::numeric / nullif(v_totales, 0)::numeric) * 100);  -- 0 decimales
  v_espera     := ceil((v_tiempo * v_ocupadas)::numeric / nullif(v_totales, 0)::numeric); -- entero superior
  v_espera     := least(v_espera, v_techo::numeric);                                    -- techo 60

  return query select v_totales, v_ocupadas, v_porcentaje::int, v_espera::int;
end;
$$;

-- =============================================================================
-- 6. Trigger: límite de sillas ocupadas (CA-RF10-3, S-RF10-3) + gestiona ocupada_desde
-- =============================================================================
create or replace function public.check_limite_sillas()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_totales int; v_ocupadas int;
begin
  if new.estado = 'ocupada' then
    select coalesce((select valor::int from public.configuracion where clave = 'sillas_totales'), 4) into v_totales;
    select count(*) into v_ocupadas from public.sillas where estado = 'ocupada';
    if v_ocupadas >= v_totales then
      raise exception 'limite_sillas_alcanzado' using errcode = '23514',
        hint = 'No se pueden ocupar más sillas que sillas_totales';
    end if;
  end if;
  if new.estado = 'ocupada' and old.estado = 'libre' then
    new.ocupada_desde := now();
  elsif new.estado = 'libre' then
    new.ocupada_desde := null;
  end if;
  return new;
end;
$$;

create trigger trg_check_limite_sillas
  before insert or update on public.sillas
  for each row execute function public.check_limite_sillas();

-- =============================================================================
-- 7. Trigger: impedir cambio de rol por no-admin (anti auto-escalada, refuerza RLS)
-- =============================================================================
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.rol is distinct from new.rol and not public.is_admin() then
    raise exception 'rol_no_modificable';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- =============================================================================
-- 8. RLS: enable + policies (S-RLS-1/2/3, S-RF10-2, CA-RNF03-1)
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.servicios         enable row level security;
alter table public.promociones       enable row level security;
alter table public.configuracion     enable row level security;
alter table public.sillas            enable row level security;
alter table public.clientes          enable row level security;
alter table public.historial_atencion enable row level security;

-- profiles: anon nada; cliente solo su fila (UPDATE sin cambiar rol); admin TODO
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid() and public.get_my_role() = 'cliente')
  with check (id = auth.uid() and rol = 'cliente');
create policy "profiles_admin_all" on public.profiles for all to authenticated
  using (public.is_admin());

-- servicios: público solo activos; admin TODO (ve inactivos)
create policy "servicios_select_public" on public.servicios for select to anon, authenticated
  using (activo = true);
create policy "servicios_admin_all" on public.servicios for all to authenticated
  using (public.is_admin());

-- promociones: público solo activas; admin TODO
create policy "promociones_select_public" on public.promociones for select to anon, authenticated
  using (activo = true);
create policy "promociones_admin_all" on public.promociones for all to authenticated
  using (public.is_admin());

-- configuracion: anon SOLO claves públicas (sillas_totales, tiempo promedio — NUNCA techo); admin TODO
create policy "configuracion_select_public" on public.configuracion for select to anon, authenticated
  using (clave in ('sillas_totales', 'tiempo_servicio_promedio_min'));
create policy "configuracion_admin_all" on public.configuracion for all to authenticated
  using (public.is_admin());

-- sillas: lectura pública del estado; solo admin escribe (S-RF10-2)
create policy "sillas_select_public" on public.sillas for select to anon, authenticated
  using (true);
create policy "sillas_admin_all" on public.sillas for all to authenticated
  using (public.is_admin());

-- clientes: JAMÁS anon (S-RLS-3); cliente solo SU fila (S-RLS-1); admin TODO
create policy "clientes_select_own" on public.clientes for select to authenticated
  using (profile_id = auth.uid());
create policy "clientes_insert_own" on public.clientes for insert to authenticated
  with check (profile_id = auth.uid());
create policy "clientes_update_own" on public.clientes for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "clientes_admin_all" on public.clientes for all to authenticated
  using (public.is_admin());

-- historial_atencion: JAMÁS anon; cliente solo su historial; admin TODO
create policy "historial_select_own" on public.historial_atencion for select to authenticated
  using (cliente_id in (select c.id from public.clientes c where c.profile_id = auth.uid()));
create policy "historial_admin_all" on public.historial_atencion for all to authenticated
  using (public.is_admin());

-- =============================================================================
-- 9. Grants (doble capa: RLS gobierna; grants de superficie)
-- =============================================================================
grant usage on schema public to anon, authenticated;
grant select on public.servicios, public.promociones, public.sillas, public.configuracion to anon;
grant select, insert, update, delete on public.servicios, public.promociones, public.sillas, public.configuracion to authenticated;
grant select, insert, update, delete on public.profiles, public.clientes, public.historial_atencion to authenticated;
grant execute on function public.obtener_ocupacion() to anon, authenticated;
grant execute on function public.get_my_role(), public.is_admin() to authenticated;

-- =============================================================================
-- 10. Seed (configuración + 4 sillas)
-- =============================================================================
insert into public.configuracion (clave, valor, descripcion) values
  ('sillas_totales',               '4',  'Capacidad del local'),
  ('tiempo_servicio_promedio_min', '30', 'Duración promedio de un servicio'),
  ('techo_espera_min',             '60', 'Techo máximo de espera mostrada')
on conflict (clave) do nothing;

insert into public.sillas (nombre) values
  ('Silla 1'), ('Silla 2'), ('Silla 3'), ('Silla 4')
on conflict (nombre) do nothing;

-- ============================================================
-- FIX 2026-09-21: ON CONFLICT (profile_id) requiere indice UNIQUE
-- simple (NO parcial). Leccion aprendida en produccion:
--   * Antes: idx_clientes_profile NO unico -> 42P10 en cada signup
--     (trigger handle_new_user, ON CONFLICT sin arbnitro).
--   * Intento 2: indice UNIQUE parcial (WHERE profile_id IS NOT NULL)
--     SIGUE fallando: PostgreSQL no infiere un indice parcial como
--     arbnitro de ON CONFLICT (col) si el INSERT no tiene WHERE que
--     implique el predicado.
--   * Fix final: indice UNIQUE simple sobre (profile_id). PostgreSQL
--     permite multiples NULL en indices unicos, preservando el
--     ON DELETE SET NULL de clientes.profile_id.
-- Aplicado en produccion via SQL Editor 2026-09-21.
-- ============================================================