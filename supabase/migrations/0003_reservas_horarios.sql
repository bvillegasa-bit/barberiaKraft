-- =============================================================================
-- Barbería Kraft — migración 0003_reservas_horarios.sql
-- Proyecto: calidad-de-software-g6 (barberia-kraft)
--
-- Alcance: feriados, reservas (tickets) y parámetros de horario.
-- Depende de 0001_init.sql: usa public.profiles, public.servicios,
-- public.sillas, public.configuracion y la función public.is_admin().
--
-- Idempotente: se puede re-ejecutar con `if not exists`, `on conflict do nothing`
-- y `drop policy if exists` antes de cada `create policy`.
-- NO modifica las claves existentes de configuracion (sillas_totales,
-- tiempo_servicio_promedio_min, techo_espera_min).
-- =============================================================================

-- =============================================================================
-- 1. Feriados (días no laborables / cierre especial)
-- =============================================================================
-- El admin puede añadir o quitar feriados con INSERT/DELETE desde el panel o
-- el SQL Editor. `cierre` permite un horario de cierre distinto por feriado.
create table if not exists public.feriados (
  fecha       date primary key,
  descripcion text not null default '',
  cierre      time not null default '22:00',
  creado_en   timestamptz default now()
);

-- Feriados nacionales de Perú para 2026.
-- Nota: lista editable; el admin puede añadir/quitar filas según calendario.
-- `on conflict (fecha) do nothing` evita duplicados al re-ejecutar.
insert into public.feriados (fecha, descripcion) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-06-07', 'Batalla de Arica y Día de la Bandera'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-23', 'Día de la Fuerza Aérea del Perú'),
  ('2026-07-28', 'Fiestas Patrias'),
  ('2026-07-29', 'Fiestas Patrias'),
  ('2026-08-06', 'Batalla de Junín'),
  ('2026-08-30', 'Santa Rosa de Lima'),
  ('2026-10-08', 'Combate de Angamos'),
  ('2026-11-01', 'Todos los Santos'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad')
on conflict (fecha) do nothing;

alter table public.feriados enable row level security;

-- Lectura pública (la landing puede mostrar horarios/cierre de feriados).
drop policy if exists "feriados_select_public" on public.feriados;
create policy "feriados_select_public" on public.feriados for select to anon, authenticated
  using (true);

-- Escritura solo admin (mismo patrón que 0001_init.sql).
drop policy if exists "feriados_admin_all" on public.feriados;
create policy "feriados_admin_all" on public.feriados for all to authenticated
  using (public.is_admin());

-- =============================================================================
-- 2. Reservas / tickets
-- =============================================================================
-- Snapshot del servicio (nombre, duración, precio) al momento de reservar:
-- si el catálogo cambia después, la reserva conserva los valores pactados.
create table if not exists public.reservas (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique
                    default ('KRAFT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  servicio_id     uuid references public.servicios (id) on delete set null,
  servicio_nombre text not null default '',
  duracion_min    integer not null default 30,
  precio          numeric(10,2) not null default 0,
  fecha           date not null,
  hora            time not null,
  silla_id        uuid references public.sillas (id) on delete set null,
  barbero         text not null default 'cualquiera',
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','confirmada','atendida','cancelada')),
  notas           text not null default '',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- Consultas por agenda del día y por cliente.
create index if not exists idx_reservas_fecha_hora on public.reservas (fecha, hora);
create index if not exists idx_reservas_profile    on public.reservas (profile_id);

-- Evita doble reserva de la misma silla en la misma fecha/hora mientras la
-- reserva siga activa. Con silla_id NULL (barbero 'cualquiera') PostgreSQL
-- considera los NULL distintos, por lo que permite varias reservas sin silla.
create unique index if not exists uq_reservas_silla_hora_activa
  on public.reservas (fecha, hora, silla_id)
  where estado in ('pendiente','confirmada');

-- Trigger genérico para `actualizado_en` (no existía en 0001).
create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists trg_reservas_actualizado_en on public.reservas;
create trigger trg_reservas_actualizado_en
  before update on public.reservas
  for each row execute function public.set_actualizado_en();

alter table public.reservas enable row level security;

-- Cliente: solo ve sus propias reservas.
drop policy if exists "reservas_select_own" on public.reservas;
create policy "reservas_select_own" on public.reservas for select to authenticated
  using (profile_id = auth.uid());

-- Cliente: solo crea reservas a su nombre (se fuerza profile_id = auth.uid()).
drop policy if exists "reservas_insert_own" on public.reservas;
create policy "reservas_insert_own" on public.reservas for insert to authenticated
  with check (profile_id = auth.uid());

-- Cliente: solo puede cancelar sus reservas activas. El WITH CHECK exige que
-- el nuevo estado sea 'cancelada'; el USING impide re-tocar una ya cancelada.
drop policy if exists "reservas_update_own_cancelar" on public.reservas;
create policy "reservas_update_own_cancelar" on public.reservas for update to authenticated
  using (profile_id = auth.uid() and estado in ('pendiente','confirmada'))
  with check (profile_id = auth.uid() and estado = 'cancelada');

-- Admin: control total (confirmar, atender, asignar silla, etc.).
drop policy if exists "reservas_admin_all" on public.reservas;
create policy "reservas_admin_all" on public.reservas for all to authenticated
  using (public.is_admin());

-- =============================================================================
-- 3. Parámetros de horario (no pisa claves existentes)
-- =============================================================================
-- public.configuracion ya tiene PRIMARY KEY (clave) en 0001_init.sql, por lo
-- que NO se agrega ninguna constraint aquí.
insert into public.configuracion (clave, valor, descripcion) values
  ('horario_apertura',       '08:30', 'Hora de apertura en días normales'),
  ('horario_cierre',         '19:00', 'Hora de cierre en días normales'),
  ('horario_cierre_feriado', '22:00', 'Hora de cierre en feriados'),
  ('intervalo_reserva_min',  '30',    'Intervalo entre slots de reserva (minutos)')
on conflict (clave) do nothing;

-- =============================================================================
-- 4. Función horario_del_dia(p_fecha)
-- =============================================================================
-- Devuelve apertura, cierre y si la fecha es feriado. Lee configuracion y
-- feriados con SECURITY DEFINER para que el front pueda calcular slots sin
-- exponer las claves privadas de configuracion (la política pública de
-- configuracion solo permite sillas_totales y tiempo_servicio_promedio_min).
create or replace function public.horario_del_dia(p_fecha date)
returns table (apertura time, cierre time, es_feriado boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_apertura       time;
  v_cierre         time;
  v_es_feriado     boolean := false;
  v_cierre_feriado time;
begin
  v_apertura := coalesce(
    (select nullif(valor, '')::time from public.configuracion where clave = 'horario_apertura'),
    '08:30'::time
  );

  select f.cierre into v_cierre_feriado
  from public.feriados f
  where f.fecha = p_fecha;

  if found then
    v_es_feriado := true;
    v_cierre := coalesce(
      v_cierre_feriado,
      (select nullif(valor, '')::time from public.configuracion where clave = 'horario_cierre_feriado'),
      '22:00'::time
    );
  else
    v_cierre := coalesce(
      (select nullif(valor, '')::time from public.configuracion where clave = 'horario_cierre'),
      '19:00'::time
    );
  end if;

  return query select v_apertura, v_cierre, v_es_feriado;
end;
$$;

-- =============================================================================
-- 5. Grants (RLS sigue gobernando; los grants definen la superficie)
-- =============================================================================
-- Reservas: NUNCA anon. Cliente autenticado puede leer/crear/actualizar;
-- DELETE queda disponible solo porque la política admin lo permite.
revoke all on public.reservas from anon;
revoke all on public.reservas from authenticated;
grant select, insert, update, delete on public.reservas to authenticated;

-- Feriados: lectura pública, escritura autenticada (RLS la limita a admin).
revoke all on public.feriados from anon;
revoke all on public.feriados from authenticated;
grant select on public.feriados to anon, authenticated;
grant insert, update, delete on public.feriados to authenticated;

-- Función de horarios: invocable desde la landing (anon) y desde la app.
grant execute on function public.horario_del_dia(date) to anon, authenticated;
