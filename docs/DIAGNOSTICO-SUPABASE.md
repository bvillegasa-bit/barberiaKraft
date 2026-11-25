# Diagnóstico de Supabase: ¿faltan tablas o es la anon key?

Este diagnóstico distingue dos causas que producen avisos parecidos en el panel:

- **(a)** faltan `public.feriados` / `public.reservas` porque `0003` no terminó;
- **(b)** la anon key del repo es un placeholder y la respuesta real es **401**.

## 1. Ejecutar el script con la key real

Desde la raíz del repo (`barberia-kraft`):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\diagnosticar-supabase.ps1 -AnonKey " TU_KEY"
```

Reemplaza `TU_KEY` por la anon key de **Project Settings → API** (no uses `service_role`).
El script hace `Trim()`, así que el espacio del ejemplo no afecta. Si omites `-AnonKey`,
lee la clave del archivo local (`pages\js\config.js`, `dist\js\config.js` o
`pages\js\config.template.js`). **Nunca imprime la key completa**: solo los primeros
20 caracteres seguidos de `...`. También decodifica el payload JWT (base64url) y
muestra `ref`, `role`, `iat` y `exp`: `ref` debe ser `wrhzawuowdsfibotnhjk`.

El script consulta con `curl.exe` (headers `apikey` y `Authorization: Bearer`):

| Consulta | URL |
|---|---|
| health | `https://wrhzawuowdsfibotnhjk.supabase.co/auth/v1/health` |
| feriados | `/rest/v1/feriados?select=fecha&limit=1` |
| reservas | `/rest/v1/reservas?select=id&limit=1` |
| profiles | `/rest/v1/profiles?select=id&limit=1` |

Imprime el cuerpo truncado a 300 caracteres y una tabla final con
`nombre | HTTP | código Supabase | interpretación`.

## 2. Consultas para el SQL Editor

Tablas con su esquema (esperadas: 9 — las 7 de `0001` más `feriados` y `reservas`):

```sql
select schemaname, tablename from pg_tables where schemaname in ('public','auth','storage') order by 1,2;
```

Policies de feriados (deben aparecer `feriados_select_public` y `feriados_admin_all`):

```sql
select policyname, cmd, roles from pg_policies where tablename='feriados';
```

Si `pg_tables` devuelve solo 7 tablas, faltan `feriados` y `reservas`: ejecuta
`0001_repair_idempotente.sql` y luego `0003_reservas_horarios.sql` completos, sin
fragmentos, y vuelve a correr el `select` de arriba.

## 3. Qué significa cada respuesta

| Código | Significado | Cómo actuar |
|---|---|---|
| `401` | La anon key es inválida, placeholder, está vencida (`exp`) o pertenece a otro proyecto (`ref`). El cuerpo suele decir `Invalid API key` / `JWT invalid`. | **No** indica problema de SQL. Copia la anon key real del dashboard y repite el script. |
| `PGRST205` | PostgREST no ve la tabla en su caché de esquema: puede no existir o haberse creado después de cargar el esquema. | Verifica con `pg_tables`. Si existe, recarga el esquema de la API (o espera) y vuelve a consultar. |
| `42P01` | `undefined_table`: la tabla no existe en PostgreSQL. | La migración no se aplicó o falló antes de crearla. Ejecuta `0003` completa y revisa los logs del SQL Editor. |

Regla práctica: si `profiles` responde 401, el problema es la **key**; si `profiles`
responde 200 pero `feriados`/`reservas` responden `PGRST205` o `42P01`, el problema
es la **migración**. `/auth/v1/health` puede responder 200 incluso con una key
inválida: no lo uses como prueba de autenticación.

El panel de feriados muestra ahora el código exacto entre corchetes, por ejemplo:
`Faltan tablas base. ... [42P01] [404]` o `... [401]`, junto al botón **Reintentar**.
