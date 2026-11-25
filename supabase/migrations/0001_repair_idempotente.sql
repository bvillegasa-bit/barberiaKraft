-- =============================================================================
-- Barbería Kraft — 0001_repair_idempotente.sql
-- Versión re-ejecutable de 0001_init.sql para pegar en el SQL Editor de Supabase.
--
-- ORDEN CORRECTO:
--   En una BD vacía: 0001_init.sql → 0002 → 0003.
--   Si 0003 se ejecutó antes y falló: ejecutar este repair y luego RE-ejecutar
--   0003 (revisar si es idempotente; si no, omitir lo que ya existe).
--
-- Alcance: solo reconstruye/asegura lo que define 0001. NO toca, NO dropea y
-- NO redefine public.feriados ni public.reservas (propiedad de 0003). Sí deja
-- disponibles public.is_admin() y gen_random_uuid(), que las policies de 0003
-- necesitan.
--
-- ATENCIÓN: si alguna de las 7 tablas ya existe con una estructura distinta a
-- la de 0001, NO la alteres: limitate a revisar sus columnas con el bloque de
-- verificación del final y corrige el desvío con una migración nueva.
-- =============================================================================

-- =============================================================================
-- 1. Extensiones
-- =============================================================================
create extension if not exists pgcrypto; -- gen_random_uuid() (idempotente; Supabase ya la incluye)

-- =============================================================================
-- 2. Tablas (definición exacta de 0001; se crean solo si faltan)
-- =============================================================================

-- ATENCIÓN: verificar columnas de profiles
create table if not exists public.profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  email     text not null,
  nombre    text not null default '',
  rol       text not null default 'cliente' check (rol in ('cliente','admin')),
  creado_en timestamptz not null default now()
);

-- ATENCIÓN: verificar columnas de servicios
create table if not exists public.servicios (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (char_length(nombre) > 0),
  descripcion  text not null default '',
  precio_soles numeric(10,2) not null check (precio_soles > 0),
  duracion_min int not null default 30 check (duracion_min > 0),
  activo       boolean not null default true,
  orden        int not null default 0
);

-- ATENCIÓN: verificar columnas de promociones
create table if not exists public.promociones (
  id                  uuid primary key default gen_random_uuid(),
  titulo              text not null check (char_length(titulo) > 0),
  descripcion         text not null default '',
  precio_oferta_soles numeric(10,2),
  beneficio           text not null default '',
  activo              boolean not null default true,
  creado_en           timestamptz not null default now()
);

-- ATENCIÓN: verificar columnas de configuracion
create table if not exists public.configuracion (
  clave       text primary key,
  valor       text not null,
  descripcion text not null default ''
);

-- ATENCIÓN: verificar columnas de sillas
create table if not exists public.sillas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique check (char_length(nombre) > 0),
  estado         text not null default 'libre' check (estado in ('libre','ocupada')),
  barbero_nombre text not null default '',
  servicio_id    uuid references public.servicios (id) on delete set null,
  ocupada_desde  timestamptz
);

-- ATENCIÓN: verificar columnas de clientes
create table if not exists public.clientes (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid references public.profiles (id) on delete set null,
  nombre              text not null default '',
  telefono            text not null default '',
  email               text not null,
  consentimiento_datos boolean not null default false,
  creado_en           timestamptz not null default now()
);

-- ATENCIÓN: verificar columnas de historial_atencion
create table if not exists public.historial_atencion (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid references public.clientes (id) on delete set null,
  servicio_id   uuid references public.servicios (id) on delete set null,
  silla_id      uuid references public.sillas (id) on delete set null,
  fecha_atencion timestamptz not null default now(),
  importe       numeric(10,2) check (importe > 0),
  notas         text not null default ''
);

-- =============================================================================
-- 3. Índices (idempotentes)
-- =============================================================================
create index if not exists idx_servicios_activo_orden on public.servicios (activo, orden, nombre);
create index if not exists idx_promociones_activo on public.promociones (activo);
create index if not exists idx_sillas_estado on public.sillas (estado);
-- Debe ser UNIQUE simple (no parcial) para el ON CONFLICT (profile_id) del trigger.
create unique index if not exists idx_clientes_profile on public.clientes (profile_id);
create index if not exists idx_historial_cliente on public.historial_atencion (cliente_id);

-- =============================================================================
-- 4. Funciones helper de rol (evitan recursión RLS; SECURITY DEFINER + search_path)
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
-- 5. Trigger: crear profile+cliente al registrarse (RF03, CA-RF03-2, CA-RF08-2)
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 6. Función de ocupación (fuente de verdad — RF02/RF10, fórmula spec §3.2)
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
-- 7. Trigger: límite de sillas ocupadas (CA-RF10-3, S-RF10-3) + gestiona ocupada_desde
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

drop trigger if exists trg_check_limite_sillas on public.sillas;
create trigger trg_check_limite_sillas
  before insert or update on public.sillas
  for each row execute function public.check_limite_sillas();

-- =============================================================================
-- 8. Trigger: impedir cambio de rol por no-admin (anti auto-escalada, refuerza RLS)
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

drop trigger if exists trg_prevent_role_change on public.profiles;
create trigger trg_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- =============================================================================
-- 9. RLS: enable + policies (S-RLS-1/2/3, S-RF10-2, CA-RNF03-1)
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.servicios         enable row level security;
alter table public.promociones       enable row level security;
alter table public.configuracion     enable row level security;
alter table public.sillas            enable row level security;
alter table public.clientes          enable row level security;
alter table public.historial_atencion enable row level security;

-- profiles: anon nada; cliente solo su fila (UPDATE sin cambiar rol); admin TODO
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid() and public.get_my_role() = 'cliente')
  with check (id = auth.uid() and rol = 'cliente');
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles for all to authenticated
  using (public.is_admin());

-- servicios: público solo activos; admin TODO (ve inactivos)
drop policy if exists "servicios_select_public" on public.servicios;
create policy "servicios_select_public" on public.servicios for select to anon, authenticated
  using (activo = true);
drop policy if exists "servicios_admin_all" on public.servicios;
create policy "servicios_admin_all" on public.servicios for all to authenticated
  using (public.is_admin());

-- promociones: público solo activas; admin TODO
drop policy if exists "promociones_select_public" on public.promociones;
create policy "promociones_select_public" on public.promociones for select to anon, authenticated
  using (activo = true);
drop policy if exists "promociones_admin_all" on public.promociones;
create policy "promociones_admin_all" on public.promociones for all to authenticated
  using (public.is_admin());

-- configuracion: anon SOLO claves públicas (sillas_totales, tiempo promedio — NUNCA techo); admin TODO
drop policy if exists "configuracion_select_public" on public.configuracion;
create policy "configuracion_select_public" on public.configuracion for select to anon, authenticated
  using (clave in ('sillas_totales', 'tiempo_servicio_promedio_min'));
drop policy if exists "configuracion_admin_all" on public.configuracion;
create policy "configuracion_admin_all" on public.configuracion for all to authenticated
  using (public.is_admin());

-- sillas: lectura pública del estado; solo admin escribe (S-RF10-2)
drop policy if exists "sillas_select_public" on public.sillas;
create policy "sillas_select_public" on public.sillas for select to anon, authenticated
  using (true);
drop policy if exists "sillas_admin_all" on public.sillas;
create policy "sillas_admin_all" on public.sillas for all to authenticated
  using (public.is_admin());

-- clientes: JAMÁS anon (S-RLS-3); cliente solo SU fila (S-RLS-1); admin TODO
drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own" on public.clientes for select to authenticated
  using (profile_id = auth.uid());
drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own" on public.clientes for insert to authenticated
  with check (profile_id = auth.uid());
drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own" on public.clientes for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "clientes_admin_all" on public.clientes;
create policy "clientes_admin_all" on public.clientes for all to authenticated
  using (public.is_admin());

-- historial_atencion: JAMÁS anon; cliente solo su historial; admin TODO
drop policy if exists "historial_select_own" on public.historial_atencion;
create policy "historial_select_own" on public.historial_atencion for select to authenticated
  using (cliente_id in (select c.id from public.clientes c where c.profile_id = auth.uid()));
drop policy if exists "historial_admin_all" on public.historial_atencion;
create policy "historial_admin_all" on public.historial_atencion for all to authenticated
  using (public.is_admin());

-- =============================================================================
-- 10. Grants (doble capa: RLS gobierna; grants de superficie)
-- =============================================================================
grant usage on schema public to anon, authenticated;
grant select on public.servicios, public.promociones, public.sillas, public.configuracion to anon;
grant select, insert, update, delete on public.servicios, public.promociones, public.sillas, public.configuracion to authenticated;
grant select, insert, update, delete on public.profiles, public.clientes, public.historial_atencion to authenticated;
grant execute on function public.obtener_ocupacion() to anon, authenticated;
grant execute on function public.get_my_role(), public.is_admin() to authenticated;

-- =============================================================================
-- 11. Seed (configuración + 4 sillas) — NO sobrescribe lo que sembró 0003
-- =============================================================================
insert into public.configuracion (clave, valor, descripcion) values
  ('sillas_totales',               '4',  'Capacidad del local'),
  ('tiempo_servicio_promedio_min', '30', 'Duración promedio de un servicio'),
  ('techo_espera_min',             '60', 'Techo máximo de espera mostrada')
on conflict (clave) do nothing;

insert into public.sillas (nombre) values
  ('Silla 1'), ('Silla 2'), ('Silla 3'), ('Silla 4')
on conflict (nombre) do nothing;

-- =============================================================================
-- 12. VERIFICACIÓN (solo lectura; descomentar en el SQL Editor si se desea)
-- =============================================================================
-- select 'profiles'           as tabla, count(*) as filas from public.profiles
-- union all select 'servicios',          count(*) from public.servicios
-- union all select 'promociones',        count(*) from public.promociones
-- union all select 'configuracion',      count(*) from public.configuracion
-- union all select 'sillas',             count(*) from public.sillas
-- union all select 'clientes',           count(*) from public.clientes
-- union all select 'historial_atencion', count(*) from public.historial_atencion
-- union all select 'feriados',           count(*) from public.feriados
-- union all select 'reservas',           count(*) from public.reservas;
--
-- select proname from pg_proc where proname='is_admin';
-- select proname from pg_proc where proname='gen_random_uuid';
-- select tablename, policyname from pg_policies where schemaname = 'public' order by tablename, policyname;
-- =============================================================================
