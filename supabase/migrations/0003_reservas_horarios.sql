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

-- =============================================================================
-- 6. slots_ocupados(p_fecha) — ocupación por hora para la grilla de reservas
-- =============================================================================
-- Devuelve SOLO las horas con al menos una reserva activa. El front la combina
-- con generarSlots(horario_del_dia) y filtrarSlotsDisponibles().
-- SECURITY DEFINER: el cliente necesita ver la ocupación agregada de OTROS
-- usuarios, pero RLS solo le deja leer sus propias reservas. Solo se expone
-- (hora, cantidad), nunca datos personales.
create or replace function public.slots_ocupados(p_fecha date)
returns table (hora time, ocupadas bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.hora, count(*)::bigint as ocupadas
  from public.reservas r
  where r.fecha = p_fecha
    and r.estado in ('pendiente', 'confirmada')
  group by r.hora
  order by r.hora;
$$;

-- =============================================================================
-- 7. crear_reserva(...) — alta atómica de una reserva del cliente
-- =============================================================================
-- Validaciones (en orden):
--   1. auth.uid() no nulo                         -> no_autenticado
--   2. fecha real, hoy <= fecha <= hoy + 60 días  -> fecha_invalida
--   3. domingo (local cerrado)                    -> dia_cerrado
--   4. apertura <= hora < cierre (feriados incluidos)
--                                                 -> horario_no_permitido
--   5. hora alineada a la grilla desde apertura   -> horario_no_permitido
--   6. servicio existente y activo                -> servicio_invalido
--   7. ocupadas < sillas del local                -> sin_cupo
--   8. sin reserva activa del mismo usuario       -> reserva_duplicada
-- La fila se inserta con estado 'pendiente' y snapshot del servicio.
-- El advisory lock serializa intentos simultáneos sobre el mismo slot.
-- Zona horaria del negocio: America/Lima (UTC-5, sin DST).
create or replace function public.crear_reserva(
  p_servicio_id uuid,
  p_fecha       date,
  p_hora        time,
  p_barbero     text default 'cualquiera'
)
returns public.reservas
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_hoy        date := (now() at time zone 'America/Lima')::date;
  v_apertura   time;
  v_cierre     time;
  v_es_feriado boolean;
  v_intervalo  integer;
  v_servicio   public.servicios%rowtype;
  v_sillas     integer;
  v_ocupadas   bigint;
  v_duplicadas bigint;
  v_reserva    public.reservas%rowtype;
begin
  if v_uid is null then
    raise exception using
      message = 'Debes iniciar sesión para reservar.',
      errcode = '28000',
      hint    = 'no_autenticado';
  end if;

  if p_servicio_id is null then
    raise exception using
      message = 'Debes seleccionar un servicio.',
      errcode = '22023',
      hint    = 'servicio_invalido';
  end if;

  if p_fecha is null or p_fecha < v_hoy or p_fecha > (v_hoy + 60) then
    raise exception using
      message = 'La fecha no es válida: elige entre hoy y los próximos 60 días.',
      errcode = '22007',
      hint    = 'fecha_invalida';
  end if;

  if p_hora is null then
    raise exception using
      message = 'Debes seleccionar una hora.',
      errcode = '22007',
      hint    = 'hora_invalida';
  end if;

  -- Domingo: cerrado (regla del negocio; horario_del_dia no lo modela).
  if extract(dow from p_fecha) = 0 then
    raise exception using
      message = 'Los domingos permanecemos cerrados. Elige otro día.',
      errcode = '22023',
      hint    = 'dia_cerrado';
  end if;

  select h.apertura, h.cierre, h.es_feriado
    into v_apertura, v_cierre, v_es_feriado
  from public.horario_del_dia(p_fecha) h;

  v_apertura := coalesce(v_apertura, '08:30'::time);
  v_cierre   := coalesce(v_cierre, '19:00'::time);

  -- Se acepta [apertura, cierre): el slot igual al cierre no se ofrece.
  if p_hora < v_apertura or p_hora >= v_cierre then
    raise exception using
      message = 'La hora elegida está fuera del horario de atención.',
      errcode = '22007',
      hint    = 'horario_no_permitido';
  end if;

  select coalesce(nullif(valor, '')::integer, 30)
    into v_intervalo
  from public.configuracion
  where clave = 'intervalo_reserva_min';

  v_intervalo := coalesce(v_intervalo, 30);
  if v_intervalo <= 0 then
    v_intervalo := 30;
  end if;

  -- Alineación con la grilla: minutos desde apertura múltiplos del intervalo
  -- y hora exacta al minuto (sin segundos).
  if extract(second from p_hora) <> 0
     or (extract(epoch from (p_hora - v_apertura)) / 60)::numeric % v_intervalo <> 0 then
    raise exception using
      message = 'La hora elegida no coincide con los horarios disponibles.',
      errcode = '22007',
      hint    = 'horario_no_permitido';
  end if;

  select s.*
    into v_servicio
  from public.servicios s
  where s.id = p_servicio_id
    and s.activo = true;

  if not found then
    raise exception using
      message = 'El servicio seleccionado no está disponible.',
      errcode = '22023',
      hint    = 'servicio_invalido';
  end if;

  -- Serializa las reservas concurrentes del mismo slot.
  perform pg_advisory_xact_lock(
    hashtext(p_fecha::text || ' ' || p_hora::text)::bigint
  );

  -- Capacidad: total de sillas del local (fallback: configuración heredada).
  select greatest(
           (select count(*)::integer from public.sillas),
           coalesce(
             (select nullif(valor, '')::integer
                from public.configuracion
               where clave = 'sillas_totales'),
             0
           )
         )
    into v_sillas;

  select count(*)
    into v_ocupadas
  from public.reservas r
  where r.fecha = p_fecha
    and r.hora = p_hora
    and r.estado in ('pendiente', 'confirmada');

  if v_sillas <= 0 or v_ocupadas >= v_sillas then
    raise exception using
      message = 'No hay cupo para esa hora. Elige otro horario.',
      errcode = '23514',
      hint    = 'sin_cupo';
  end if;

  select count(*)
    into v_duplicadas
  from public.reservas r
  where r.profile_id = v_uid
    and r.fecha = p_fecha
    and r.hora = p_hora
    and r.estado in ('pendiente', 'confirmada');

  if v_duplicadas > 0 then
    raise exception using
      message = 'Ya tienes una reserva activa para esa fecha y hora.',
      errcode = '23505',
      hint    = 'reserva_duplicada';
  end if;

  insert into public.reservas (
    profile_id,
    servicio_id,
    servicio_nombre,
    duracion_min,
    precio,
    fecha,
    hora,
    silla_id,
    barbero,
    estado
  ) values (
    v_uid,
    v_servicio.id,
    v_servicio.nombre,
    v_servicio.duracion_min,
    v_servicio.precio_soles,
    p_fecha,
    p_hora,
    null,
    coalesce(nullif(btrim(p_barbero), ''), 'cualquiera'),
    'pendiente'
  )
  returning * into v_reserva;

  return v_reserva;
end;
$$;

-- =============================================================================
-- 8. Grants de las RPC de reservas
-- =============================================================================
-- crear_reserva: SOLO autenticados (inserta a nombre de auth.uid()).
-- slots_ocupados: authenticated (grilla) y anon (la landing puede mostrarla).
revoke all on function public.crear_reserva(uuid, date, time, text) from public;
revoke all on function public.crear_reserva(uuid, date, time, text) from anon;
grant execute on function public.crear_reserva(uuid, date, time, text) to authenticated;

revoke all on function public.slots_ocupados(date) from public;
grant execute on function public.slots_ocupados(date) to anon, authenticated;

-- =============================================================================
-- 9. RPC de reservas — versión definitiva (reemplaza las secciones 6 y 7)
-- =============================================================================
-- Se redefinen aquí con `create or replace function` para dejar una única
-- fuente de verdad con los códigos de error acordados. Al ejecutarse al final,
-- sobrescriben las versiones previas del mismo archivo (idempotente).

-- Ocupación agregada por hora para la grilla de reservas.
-- SECURITY DEFINER: el cliente necesita ver la ocupación de otros usuarios,
-- pero RLS solo le deja leer sus propias reservas. Solo expone (hora, cantidad).
create or replace function public.slots_ocupados(p_fecha date)
returns table (hora time, ocupadas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.hora, count(*)::bigint as ocupadas
  from public.reservas r
  where r.fecha = p_fecha
    and r.estado in ('pendiente', 'confirmada')
  group by r.hora
  order by r.hora;
$$;

grant execute on function public.slots_ocupados(date) to authenticated, anon;

-- Alta atómica de una reserva del cliente autenticado.
-- Snapshot del servicio: nombre, duración y precio se copian al reservar.
create or replace function public.crear_reserva(
  p_servicio_id uuid,
  p_fecha       date,
  p_hora        time,
  p_barbero     text default 'cualquiera'
)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_apertura   time;
  v_cierre     time;
  v_intervalo  integer;
  v_servicio   public.servicios%rowtype;
  v_capacidad  bigint;
  v_ocupadas   bigint;
  v_duplicadas bigint;
  v_reserva    public.reservas%rowtype;
begin
  -- 1. Debe haber sesión.
  if v_uid is null then
    raise exception using
      message = 'Debes iniciar sesión para reservar.',
      errcode = '28000',
      hint    = 'debes_iniciar_sesion';
  end if;

  -- 2. Fecha: no nula, no pasada, máximo 60 días.
  if p_fecha is null or p_fecha < current_date then
    raise exception using
      message = 'La fecha no es válida: elige hoy o una fecha futura.',
      errcode = '22007',
      hint    = 'fecha_invalida';
  end if;

  if p_fecha > current_date + 60 then
    raise exception using
      message = 'La fecha es demasiado lejana: máximo 60 días de anticipación.',
      errcode = '22007',
      hint    = 'fecha_muy_lejana';
  end if;

  -- 3. Hora obligatoria.
  if p_hora is null then
    raise exception using
      message = 'Debes seleccionar una hora.',
      errcode = '22007',
      hint    = 'hora_invalida';
  end if;

  -- 4. Horario del día (apertura/cierre; considera feriados).
  select h.apertura, h.cierre
    into v_apertura, v_cierre
  from public.horario_del_dia(p_fecha) h;

  v_apertura := coalesce(v_apertura, '08:30'::time);
  v_cierre   := coalesce(v_cierre, '19:00'::time);

  if p_hora < v_apertura or p_hora >= v_cierre then
    raise exception using
      message = 'La hora elegida está fuera del horario de atención.',
      errcode = '22007',
      hint    = 'horario_no_permitido';
  end if;

  -- 5. Hora alineada a la grilla desde la apertura.
  select coalesce(nullif(valor, '')::integer, 30)
    into v_intervalo
  from public.configuracion
  where clave = 'intervalo_reserva_min';

  v_intervalo := coalesce(v_intervalo, 30);
  if v_intervalo <= 0 then
    v_intervalo := 30;
  end if;

  if extract(epoch from (p_hora - v_apertura)) % (v_intervalo * 60) <> 0 then
    raise exception using
      message = 'La hora no coincide con la grilla de reservas.',
      errcode = '22007',
      hint    = 'hora_fuera_de_grilla';
  end if;

  -- 6. Servicio existente y activo (snapshot).
  select s.*
    into v_servicio
  from public.servicios s
  where s.id = p_servicio_id
    and s.activo = true;

  if not found then
    raise exception using
      message = 'El servicio seleccionado no está disponible.',
      errcode = '22023',
      hint    = 'servicio_no_disponible';
  end if;

  -- Serializa intentos concurrentes sobre el mismo slot.
  perform pg_advisory_xact_lock(
    hashtext(p_fecha::text || ' ' || p_hora::text)::bigint
  );

  -- 7. Sin reserva activa duplicada del mismo usuario.
  select count(*)
    into v_duplicadas
  from public.reservas r
  where r.profile_id = v_uid
    and r.fecha = p_fecha
    and r.hora = p_hora
    and r.estado in ('pendiente', 'confirmada');

  if v_duplicadas > 0 then
    raise exception using
      message = 'Ya tienes una reserva activa para esa fecha y hora.',
      errcode = '23505',
      hint    = 'reserva_duplicada';
  end if;

  -- 8. Capacidad: reservas activas del slot contra sillas libres.
  select count(*) into v_capacidad
  from public.sillas
  where estado = 'libre';

  select count(*)
    into v_ocupadas
  from public.reservas r
  where r.fecha = p_fecha
    and r.hora = p_hora
    and r.estado in ('pendiente', 'confirmada');

  if v_ocupadas >= v_capacidad then
    raise exception using
      message = 'No hay cupo para esa hora. Elige otro horario.',
      errcode = '23514',
      hint    = 'sin_cupo';
  end if;

  -- 9. Insertar (silla sin asignar) y devolver la fila creada.
  insert into public.reservas (
    profile_id,
    servicio_id,
    servicio_nombre,
    duracion_min,
    precio,
    fecha,
    hora,
    silla_id,
    barbero,
    estado
  ) values (
    v_uid,
    v_servicio.id,
    v_servicio.nombre,
    v_servicio.duracion_min,
    v_servicio.precio_soles,
    p_fecha,
    p_hora,
    null,
    coalesce(nullif(btrim(p_barbero), ''), 'cualquiera'),
    'pendiente'
  )
  returning * into v_reserva;

  return v_reserva;
end;
$$;

grant execute on function public.crear_reserva(uuid, date, time, text) to authenticated;

-- =============================================================================
-- 10. Códigos de error documentados (crear_reserva)
-- =============================================================================
-- hint = 'debes_iniciar_sesion'   -> auth.uid() nulo
-- hint = 'fecha_invalida'         -> fecha nula o anterior a hoy
-- hint = 'fecha_muy_lejana'       -> fecha > hoy + 60 días
-- hint = 'hora_invalida'          -> hora nula
-- hint = 'horario_no_permitido'   -> hora < apertura o >= cierre
-- hint = 'hora_fuera_de_grilla'   -> hora no alineada a intervalo_reserva_min
-- hint = 'servicio_no_disponible' -> servicio inexistente o inactivo
-- hint = 'reserva_duplicada'      -> ya hay reserva activa del usuario en el slot
-- hint = 'sin_cupo'               -> ocupadas >= sillas con estado 'libre'
-- Mensajes en español; errcode SQLSTATE estándar (28000, 22007, 22023,
-- 23505, 23514) para que el front pueda distinguir la causa sin parsear texto.
