# QUALITY.md — Plan de pruebas del Hito 1

Plan de verificación derivado de los **escenarios Gherkin de la Spec** (SDD) y de los
criterios de aceptación RF/RNF. Cada prueba indica su procedimiento y su **resultado
esperado**; la columna *Resultado obtenido* y *Estado* se llenan en cada ejecución.

**Equipo**: Grupo 6 · **Período**: Hito 1 (medición mensual para RNF01/RNF02).

---

## 1. Suite de pruebas RLS (SQL) — S-RLS-1/2/3, S-RF10-2/3, S-RF01-2, S-RF05-2

Ejecutar en **SQL Editor** de Supabase (como postgres). Cubre CA-RNF03-1, CA-RF10-4/5.

### 1.1 Anon no accede a datos personales (S-RLS-3)

```sql
reset role;
set role anon;

-- Datos personales: SIN policy → RLS las bloquea (0 filas o permission denied)
select count(*) from public.clientes;            -- ESPERADO: 0 filas o error de permisos
select count(*) from public.historial_atencion;  -- ESPERADO: 0 filas o error de permisos
select count(*) from public.profiles;            -- ESPERADO: 0 filas o error de permisos

-- Catálogo público: SOLO activos (S-RF01-2 / S-RF05-2)
select * from public.servicios where activo = false;   -- ESPERADO: 0 filas
select * from public.promociones where activo = false; -- ESPERADO: 0 filas (columna 'activo', igual que servicios)

-- Configuración: SOLO las claves públicas del cálculo de espera
select * from public.configuracion;
-- ESPERADO: únicamente 'sillas_totales' y 'tiempo_servicio_promedio_min'
-- (NUNCA 'techo_espera_min' — clave interna del cálculo)
```

### 1.2 Cliente C1 no ve datos de C2 ni escribe en tablas admin (S-RLS-1, S-RF10-2)

```sql
reset role;
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"<UUID-DE-C1>","role":"authenticated"}', true);

-- Solo SU propia fila
select * from public.clientes;            -- ESPERADO: solo la fila de C1
select * from public.historial_atencion;  -- ESPERADO: solo filas de C1 (o vacío)

-- No puede escribir en tablas admin (S-RF10-2)
insert into public.servicios (nombre, descripcion, precio_soles, duracion_min)
values ('Hack', 'x', 10, 30);             -- ESPERADO: permission denied (RLS)
update public.sillas set estado = 'ocupada'
where estado = 'libre';                   -- ESPERADO: permission denied (sin policy UPDATE para authenticated)
```

### 1.3 Admin accede a todo (S-RLS-2)

```sql
reset role;
select public.is_admin();                 -- ESPERADO: true (después de 0002_promote_admin.sql)

select * from public.clientes;            -- ESPERADO: todas las filas
select * from public.historial_atencion;  -- ESPERADO: todas las filas
insert into public.servicios (nombre, precio_soles, duracion_min)
values ('Prueba QA', 25, 30);             -- ESPERADO: 1 fila insertada (se elimina al final)
delete from public.servicios
where nombre = 'Prueba QA';               -- ESPERADO: 1 fila eliminada
```

### 1.4 Exceso de sillas ocupadas (S-RF10-3)

```sql
-- Con 4 sillas libres, ocupar 5 veces la MISMA operación da error en la 5.ª:
-- (ver §4.3 para la prueba E2E; aquí la validación a nivel SQL)
update public.sillas set estado = 'ocupada', ocupada_desde = now()
where nombre = 'Silla 1';                 -- ESPERADO: OK (una sola fila)
-- El trigger check_limite_sillas solo se activa al superar sillas_totales.
-- Para forzarlo sin 4 sillas: intentar INSERT de una silla nueva ya 'ocupada'
-- ESPERADO: errcode 23514 (constraint limite_sillas_alcanzado)
```

| ID caso | Requisito | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| RLS-01 | RNF03 / S-RLS-3 | anon: 0 filas en clientes/historial/profiles | | |
| RLS-02 | RF01 / S-RF01-2 | anon: no ve servicios inactivos | | |
| RLS-03 | RF05 / S-RF05-2 | anon: no ve promociones inactivas | | |
| RLS-04 | RNF03 / S-RLS-1 | C1: solo su fila en clientes/historial | | |
| RLS-05 | RF10 / S-RF10-2 | cliente: UPDATE sillas rechazado | | |
| RLS-06 | RNF03 / S-RLS-2 | admin: lectura/escritura total OK | | |
| RLS-07 | RF10 / S-RF10-3 | exceso de ocupadas → error 23514 | | |

---

## 2. Pruebas de autenticación — S-RF03-1..6

| ID caso | Escenario | Pasos | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| AUTH-01 | S-RF03-1 | Registrarse en `registro.html` (email válido + password ≥ 8) con consentimiento marcado | Cuenta creada; filas en `profiles` (rol cliente) y `clientes` | | |
| AUTH-02 | S-RF03-1 (var.) | Registrarse SIN marcar consentimiento | Envío bloqueado con mensaje en español (CA-RNF03-4) | | |
| AUTH-03 | S-RF03-3 | Registrar email ya existente | "El correo ya está registrado" | | |
| AUTH-04 | S-RF03-2 | Login cliente correcto | Redirige a `index.html`; sesión persiste tras recargar | | |
| AUTH-05 | S-RF03-4 | Login email inexistente Y password errónea | AMBOS muestran el mismo mensaje: "Correo o contraseña incorrectos" (CA-RNF03-5) | | |
| AUTH-06 | S-RF03-5 | Login admin (promovido) | Redirige a `admin/dashboard.html` | | |
| AUTH-07 | S-RF03-6 | Cliente autenticado abre `/admin/dashboard.html` | Redirige a `index.html`; `<main>` nunca visible | | |
| AUTH-08 | S-RF03-6 | Reiniciar y forzar URL admin vía API con token de cliente | RLS rechaza toda escritura admin | | |

---

## 3. Unit tests JS de `calcularOcupacion()` — CA-RNF06-3, fórmula spec §3.2

Función pura (sin red): `calcularOcupacion({ sillasOcupadas, sillasTotales, duracionPromedioMin, techoMin })`.

### Casos esperados (spec §3.2)

| # | Ocupadas | Totales | Duración | Techo | % esperado | Espera esperada |
|---|---|---|---|---|---|---|
| 1 | 0 | 4 | 30 | 60 | 0 | 0 |
| 2 | 1 | 4 | 30 | 60 | 25 | 8 |
| 3 | 2 | 4 | 30 | 60 | 50 | 15 |
| 4 | 3 | 4 | 30 | 60 | 75 | 23 |
| 5 | 4 | 4 | 30 | 60 | 100 | 30 |
| 6 | 4 | 4 | 70 | 60 | 100 | **60 (techo, no 70)** |
| 7 | 4 | 4 | 45 | 60 | 100 | 45 |
| 8 | 0 | 0 | 30 | 60 | 0 | 0 (sin división por cero) |

### Ejecución (Node, sin dependencias)

```bash
node --input-type=module -e "
import { calcularOcupacion } from './pages/js/ocupacion.js';
const casos = [
  [{sillasOcupadas:0,sillasTotales:4,duracionPromedioMin:30,techoMin:60},{porcentaje:0,esperaMin:0}],
  [{sillasOcupadas:1,sillasTotales:4,duracionPromedioMin:30,techoMin:60},{porcentaje:25,esperaMin:8}],
  [{sillasOcupadas:2,sillasTotales:4,duracionPromedioMin:30,techoMin:60},{porcentaje:50,esperaMin:15}],
  [{sillasOcupadas:3,sillasTotales:4,duracionPromedioMin:30,techoMin:60},{porcentaje:75,esperaMin:23}],
  [{sillasOcupadas:4,sillasTotales:4,duracionPromedioMin:30,techoMin:60},{porcentaje:100,esperaMin:30}],
  [{sillasOcupadas:4,sillasTotales:4,duracionPromedioMin:70,techoMin:60},{porcentaje:100,esperaMin:60}],
  [{sillasOcupadas:4,sillasTotales:4,duracionPromedioMin:45,techoMin:60},{porcentaje:100,esperaMin:45}],
  [{sillasOcupadas:0,sillasTotales:0},{porcentaje:0,esperaMin:0}]
];
let fallos = 0;
for (const [entrada, esperado] of casos) {
  const r = calcularOcupacion(entrada);
  const ok = r.porcentaje === esperado.porcentaje && r.esperaMin === esperado.esperaMin;
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(entrada), '→', JSON.stringify(r), '(esperado', JSON.stringify(esperado) + ')');
  if (!ok) fallos++;
}
process.exit(fallos ? 1 : 0);
"
```

Esperado: **8 PASS y exit code 0**.

---

## 4. Pruebas de integración Supabase (panel admin ↔ público) — S-RF02-4, S-RF10-1/3, CA-RF02-6

| ID caso | Escenario | Pasos | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| INT-01 | S-RF10-1 | Con 2/4 ocupadas (50%, 15 min), el admin ocupa una 3.ª silla en el panel | Público (siguiente consulta): 75% y 23 min (S-RF02-4) | | |
| INT-02 | S-RF02-4 | El admin libera una silla (3/4 → 2/4) | Público: 50% y 15 min, sin edición manual | | |
| INT-03 | CA-RF02-6 | Cambiar `tiempo_servicio_promedio_min` a 45 en `configuracion` | Con 4/4 la espera pública pasa a 45 min | | |
| INT-04 | S-RF10-3 | Con 4/4 ocupadas intentar ocupar 5.ª silla (o insertar ocupada) | La BD rechaza (errcode 23514) y el panel muestra "Límite de sillas alcanzado…" | | |
| INT-05 | S-RF06-1 | Admin crea servicio activo | Aparece en el listado del panel y en el catálogo público sin redeploy | | |
| INT-06 | S-RF06-3 | Admin desactiva servicio | Desaparece del público; queda visible en el panel con indicador "Inactivo" | | |
| INT-07 | S-RF07-1/2 | Admin crea y luego desactiva una promoción | Aparece/desaparece del público según `activa` | | |
| INT-08 | S-RF01-3 / S-RF05-3 | Vaciar `servicios`/`promociones` activas (prueba) | El público muestra estados vacíos en español, sin spinners infinitos | | |

---

## 5. Pruebas E2E manual (recorrido completo) — CA-RNF04-1

1. Visitante abre el sitio → catálogo, promociones y semáforo visibles (S-RF01-1, S-RF05-1, S-RF02-1). **≤ 3 clics** a cada función.
2. Visita `login.html` y `registro.html`; llena con datos inválidos → errores junto al campo (CA-RNF04-3).
3. Registra un cliente nuevo (consentimiento marcado) → sesión iniciada (o aviso de confirmación según configuración).
4. Cierra sesión → `index.html`.
5. Login admin → `admin/dashboard.html` → CRUD servicio, CRUD promo, toggle sillas.
6. Cliente autenticado intenta `/admin/…` → redirigido (S-RF03-6).

---

## 6. Matriz responsive — CA-RNF05-1/2

Cada celda: sin errores de consola, sin desbordamiento horizontal, funcional.

| Página | Chrome 360 | Chrome 768 | Chrome 1280 | Edge 1280 | Firefox 1280 | Safari 1280 |
|---|---|---|---|---|---|---|
| index.html | | | | | | |
| login.html / registro.html | | | | | | |
| admin/dashboard.html (tabs) | | | | | | |
| CRUD servicios / promociones | | | | | | |
| Grid de sillas + mini-form | | | | | | |

Adicional: hamburguesa presente y funcional en 360 px (CA-RNF04-2); botones ≥ 44 px (CA-RNF05-2).

---

## 7. Pruebas de confiabilidad offline — CA-RNF07-1/2/3

| ID caso | Procedimiento | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| OFF-01 | DevTools → Network → Offline, recargar `index.html` | Mensaje "No se pudo conectar. Reintenta" + botón de reintento; layout intacto | | |
| OFF-02 | Offline con datos parciales (una sección falla) | Las secciones restantes se renderizan (aislamiento por módulo) | | |
| OFF-03 | Paneles con tabla vacía | Estados vacíos en español ("No hay servicios…"), sin errores visibles al usuario | | |
| OFF-04 | Panel admin offline → guardar servicio | Toast de error en español, formulario intacto | | |

---

## 8. Registros mensuales (RNF01 / RNF02)

### 8.1 Rendimiento — LCP 4G (CA-RNF01-1/2)

Medir con Chrome DevTools (Throttle 4G) o WebPageTest sobre la URL pública.

| Fecha | Herramienta | LCP (s) | Transferencia inicial (KB gzip) | Umbral (2.5 s / 500 KB) | Observaciones |
|---|---|---|---|---|---|
| | | | | | |

### 8.2 Disponibilidad — monitor externo (CA-RNF02-1)

Monitor HTTP cada 5 min en horario de atención (UptimeRobot free tier).

| Fecha | Monitor | Uptime del mes (%) | Meta (≥ 99%) | Incidencias / wake-up free tier |
|---|---|---|---|---|
| | | | | |

---

## 9. Seguridad del pipeline y del repo (secretos) — Q-SEC

Modelo de secretos del proyecto: **placeholder en el repo → GitHub Secrets → el build
inyecta → deploy a CF Pages** (ver `docs/README.md` → *Publicar en Cloudflare Pages*).
El repo versiona SOLO `pages/js/config.template.js` con tokens
(`__SUPABASE_URL__` / `__SUPABASE_ANON_KEY__`); `js/config.js` y `dist/` son
artefactos **generados** por `build.js` y están en `.gitignore`. Cubre CA-RNF03-2
(ninguna clave en el repo; solo la anon key inyectada en el build).

| ID caso | Requisito | Procedimiento | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| Q-SEC-1 | CA-RNF03-2 | `git grep -nE "service_role|SUPABASE_SERVICE_KEY|PRIVATE KEY|TU_ANON_KEY|TU-PROYECTO"` sobre los archivos versionados (o activar el *secret scanning* de GitHub) | **0 hallazgos** en código versionado | | |
| Q-SEC-2 | CA-RNF03-2 / pipeline | (a) `git ls-files` NO lista `pages/js/config.js` ni `dist/` (y `git check-ignore pages/js/config.js dist/` los marca como ignorados); (b) `git grep -nE "__SUPABASE_URL__|__SUPABASE_ANON_KEY__|SUPABASE_ANON_KEY"` solo aparece en `pages/js/config.template.js`, `build.js`, `.github/workflows/deploy.yml`, `.env.example` y `docs/` — nunca valores reales; (c) en CI: el job `deploy.yml` no imprime los secrets (GitHub los enmascara; no hay `echo` de env vars) | Config generada ausente del repo: 0 secretos en `git grep`; `pages/js/config.js` y `dist/` ignorados; el único archivo con tokens versionado es `config.template.js` | | |

> La anon key es **pública por diseño** de Supabase (RLS protege los datos), pero por
> política del grupo tampoco se versiona: se inyecta solo en el build. La `service_role`
> NUNCA (solo entorno controlado del líder).

---

## 10. Resultados del período

> Rellenar al cierre del hito: total de casos, aprobados, fallidos, pendientes y
> resumen de hallazgos con acciones correctivas.