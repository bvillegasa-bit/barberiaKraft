# Supabase: aplicar migraciones desde el panel (paso a paso)

Este documento explica **cómo ejecutar SQL en el dashboard de Supabase** y cómo
interpretar los errores más comunes. No modifica el código fuente.

## Pasos exactos en el panel

1. Entra a **https://supabase.com/dashboard** y abre tu proyecto.
2. En el menú lateral, ve a **SQL Editor**.
3. Haz clic en **New query** (nueva consulta).
4. Abre el archivo `.sql` correspondiente en tu editor local, selecciona TODO
   (`Ctrl+A`) y cópialo (`Ctrl+C`).
5. Pega (`Ctrl+V`) en el área de consulta del SQL Editor. **No ejecutes fragmentos**:
   las migraciones están pensadas para correrse completas y en orden.
6. Haz clic en **Run** (o `Ctrl+Enter` / `F5` según el atajo del panel).
7. Revisa la pestaña **Results** (salida de los `select`, si los hay) y la pestaña
   **Logs** / el panel de mensajes inferior: ahí aparecen `Success. No rows returned`,
   los `NOTICE` (p. ej. `relation ... already exists, skipping`) y el SQLSTATE si falló.
8. Si hay error, corrige la causa, vuelve a pegar el script completo y haz **Run** de
   nuevo. Las migraciones de este repo están diseñadas para re-ejecutarse.

## Orden recomendado

- Base de datos vacía: `supabase/migrations/0001_init.sql` → `0002_promote_admin.sql`
  → `0003_reservas_horarios.sql`.
- Si `0003` se ejecutó antes y falló a mitad (puede haber creado `feriados` y parte
  de `reservas`): ejecuta `supabase/migrations/0001_repair_idempotente.sql` y luego
  **re-ejecuta `0003`**. `0003` está diseñado como idempotente (`if not exists`,
  `on conflict do nothing`, `drop policy if exists`); aun así, revisa lo que ya
  existe antes de repetir y **no dropees** `feriados` ni `reservas`.

## Qué significa cada código de error

| Código | Significado | Cómo actuar |
|---|---|---|
| `42P07` | `duplicate_table`: la tabla (o índice) **ya existe**. | En `0001_init.sql` es señal de que ya se aplicó: usa el repair idempotente. No dropees la tabla; verifica sus columnas. |
| `42710` | `duplicate_object`: ya existe una **policy**, un trigger, un rol, etc. | Vuelve a ejecutar la versión con `drop policy if exists ...; create policy ...` (o `drop trigger if exists ...`). Es el caso típico de re-ejecutar `0001` tal cual. |
| `42P01` | `undefined_table`: **falta una tabla** referenciada. | El orden de migraciones está invertido o `0003` se ejecutó sin `0001`. Ejecuta primero `0001_init.sql` o el repair, y luego `0003`. |
| `42501` | `insufficient_privilege`: **permisos** insuficientes. | Ejecuta en el SQL Editor del dashboard (corre como owner) o con un rol con privilegios; nunca con la anon key. Revisa además los `grant` de la migración. |

Otros códigos que pueden aparecer: `42P10` (no hay índice único para `on conflict`,
ver el arreglo del índice `idx_clientes_profile` en `0001_init.sql`) y `23505`
(duplicado por constraint, p. ej. una reserva repetida).

El panel de feriados muestra ahora: «Faltan tablas base. Ejecuta 0001_repair_idempotente.sql en el SQL Editor de Supabase y luego vuelve a ejecutar 0003_reservas_horarios.sql.»

## Límites de este agente y de la verificación en vivo

- **El agente NO puede hacer clic en el panel**: no puede abrir el dashboard, crear
  la query, pulsar **Run** ni leer los **Results/Logs** de tu proyecto. Solo puede
  preparar los archivos SQL y la documentación.
- La **anon key del repo es un placeholder** (`__SUPABASE_ANON_KEY__` en
  `pages/js/config.template.js`; `dist/js/config.js` queda con placeholders en
  `npm run dev`). Con esa clave, cualquier llamada al API responde **401
  (`Invalid API key` / `JWT invalid`)**: eso NO indica que el SQL esté mal.
- Por tanto, la **verificación en vivo debe hacerla el usuario** en el SQL Editor
  (bloque de `select` al final del repair y de `0003`), o un proceso que cuente con
  la **anon key real** y el Project URL real de Project Settings → API. Nunca pongas
  `service_role` en el repo ni en un script compartido.

## Chequeo rápido tras ejecutar el repair

```sql
select tablename, count(*) as policies
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
```

Se esperan policies en las 7 tablas de `0001` más `feriados` y `reservas` (si
`0003` terminó correctamente). Además:

```sql
select proname from pg_proc where proname = 'is_admin';
select proname from pg_proc where proname = 'gen_random_uuid';
```

Ambas deben devolver una fila; sin `is_admin()`, las policies de `0003` fallarán.
