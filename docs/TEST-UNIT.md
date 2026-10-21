# TEST-UNIT.md — Pruebas unitarias (Hito 2 · HU04/HU13/HU14)

Complemento de [`QUALITY.md`](QUALITY.md): suite de **pruebas unitarias** de la lógica de
los módulos desarrollados en el Hito 2 — badge de sesión (HU04), consulta de clientes
(HU13) e historial de atención (HU14). Todos los casos corren **sin red, sin DOM y sin
Supabase** gracias al refactor descrito en §4.

**Equipo**: Grupo 6 · **Fecha de corrida**: 20/10/2026 · **Resultado**: **14/14 OK (0 fallas)**

---

## 1. Alcance

| Módulo UI (capa DOM/eventos) | Lógica pura testeada (capa extraída) | Archivos de prueba |
|---|---|---|
| `pages/js/sesion-ui.js` (HU04) | `pages/js/logica/sesion-logica.js` → `nombreAMostrar`, `construirTextoBadge` | `tests/sesion-logica.test.js` (CP-01…CP-05) |
| `pages/js/admin-clientes.js` (HU13) | `pages/js/logica/clientes-logica.js` → `esCuentaAdmin`, `filtrarClientesNoAdmin`, `mapearClientePublico`, `ordenarClientes`, `compararFechasDesc`, `formatearFecha` | `tests/clientes-logica.test.js` (CP-06…CP-10) |
| `pages/js/admin-historial.js` (HU14) | `pages/js/logica/historial-logica.js` → `ordenarAtencionesDesc`, `formatearImporte`, `etiquetaServicio`, `formatearFechaHora` | `tests/historial-logica.test.js` (CP-11…CP-14) |

**Fuera de alcance** (cubierto en `QUALITY.md`): RLS (§1), autenticación E2E (§2),
fórmula `calcularOcupacion()` (§3), integración Supabase (§4), UI manual (§5), secretos (§9).

---

## 2. Herramientas y ejecución

| Elemento | Detalle |
|---|---|
| Runner | **Node test runner nativo** (`node:test`) — cero dependencias (el `package.json` **no** tiene `dependencies` ni `devDependencies`; no se ejecutó ningún `npm install`) |
| Aserciones | `node:assert/strict` |
| Versión de Node usada | **v24.11.1** (verificado con `node -v`; el `engines` del proyecto exige `>=18`, el runner nativo está disponible desde Node 18) |
| Comando de ejecución | `npm test` → `node --test "tests/**/*.test.js"` |
| Watch (opcional) | `npm run test:watch` → `node --test --watch "tests/**/*.test.js"` |
| Verificación de sintaxis | `node --check` sobre los 9 archivos JS creados/modificados → 0 errores |

Notas técnicas de la configuración:

- El script `test` usa el patrón **glob** `tests/**/*.test.js` y no `node --test tests/`
  porque en Windows + Node 24 pasar un **directorio** como argumento al runner termina en
  `MODULE_NOT_FOUND` (el runner trata la ruta como archivo de entrada). El glob es
  equivalente, cruzado y lo expande el propio Node (no el shell).
- La corrida emite el aviso `MODULE_TYPELESS_PACKAGE_JSON` ("Reparsing as ES module
  because module syntax was detected"). Es **esperado y benigno**: los tests y los
  módulos `logica/` son ES modules nativos como todo el JS del proyecto, pero el
  `package.json` **no** puede llevar `"type": "module"` porque `build.js` es CommonJS.
  El aviso solo indica un reparsing con overhead mínimo (~0 s en esta suite).

---

## 3. Estrategia y cobertura

- **Nivel**: unitario puro (funciones sin I/O). Cada caso ejercita una función con
  datos de entrada controlados y compara el resultado exacto con `assert`.
- **Cobertura por función exportada**: 14/14 funciones de los 3 módulos `logica/`
  tienen al menos un caso.
- **Tipos de caso**: happy path, edge cases/límites (email vacío, fecha inválida,
  `null`/`undefined`/`''`, número `0`) y casos de seguridad (no exponer campos
  sensibles; nunca el email completo).
- **Trazabilidad**: HU04 → CP-01…CP-05 · HU13 → CP-06…CP-10 · HU14 → CP-11…CP-14;
  RF08/RF09 y criterios CA-RF08-3/4/5 (ver `docs/REQUIREMENTS.md` §3).

---

## 4. Optimización del código testeado (refactor previo a los tests)

Para poder testear la lógica con `node:test` (y no solo a mano en el navegador) se
aplicó una **separación de capas**: la lógica de negocio embebida en los módulos UI se
extrajo a **módulos puros**, y los módulos UI quedaron "finos" (solo consultas,
DOM/eventos y render). **No cambia ningún texto visible ni el comportamiento de las HUs**;
es el mismo código, reubicado y exportado.

| # | Antes (en el módulo UI) | Después (lógica pura exportada) | Beneficio |
|---|---|---|---|
| 1 | `nombreAMostrar()` definida *dentro* de `sesion-ui.js` (no exportada, no testeable) | `logica/sesion-logica.js` → `nombreAMostrar()` + `construirTextoBadge()`; `sesion-ui.js` solo monta el badge y escucha `observarSesion` | El texto del badge (HU04) se verifica sin navegador; una sola fuente de verdad para el formato `"Sesión: {nombre}"` |
| 2 | Cruce `Set` de admins + `filter` de clientes **duplicado** en `admin-clientes.js` y `admin-historial.js` | `logica/clientes-logica.js` → `esCuentaAdmin()` + `filtrarClientesNoAdmin()`; ambos módulos UI importan la misma función | Elimina duplicación: HU13 y HU14 no pueden divergir en el criterio "excluir cuentas admin"; se testea una sola vez (CP-07) |
| 3 | Filas de `clientes` crudas pasaban al render (con `profile_id`, `id`, etc. en memoria de la UI) | `mapearClientePublico()` proyecta **solo** nombre/email/teléfono/fecha antes del render | La minimización de datos (Ley 29733, CA-RF08-4) queda garantizada por construcción y es verificable (CP-08: ningún hash/campo sensible llega al array que se renderiza) |
| 4 | Orden dependiente solo del `.order()` de Supabase (si cambia la query, se rompe en silencio) | `ordenarClientes()` / `ordenarAtencionesDesc()` ordenan en cliente por fecha DESC (inválidas al final, sin mutar la entrada) | El orden más reciente→antiguo (HU14) es una regla testeada (CP-09/CP-11), no un efecto colateral de la BD |
| 5 | `importe != null ? formatoSoles(importe) : '—'` en `admin-historial.js` → un `importe` vacío o no numérico mostraba **"S/ 0.00" inventado** | `formatearImporte()`: `null`/`undefined`/`''`/no numérico → `"—"`; solo números (incluido el 0 real) → `"S/ X.XX"` | Endurece el criterio documentado en el propio módulo ("NUNCA 'S/ 0.00' como valor inventado") y queda fijado por CP-12 |
| 6 | `formatearFecha`/`formatearFechaHora` privadas en cada UI | Exportadas desde `logica/` | Fechas inválidas → `"—"` cubiertas por CP-10/CP-14 |

**Impacto en mantenibilidad y cobertura (RNF06 / CA-RNF06-3, y objetivos OE1/OE5 del
informe)**: el patrón ya usado con `calcularOcupacion()` (lógica pura + `node:test`,
documentado en `QUALITY.md` §3) se extiende a los módulos del Hito 2. Al separar
lógica de presentación:

- la lógica se puede **verificar automáticamente** en cada cambio (`npm test`, en local
  y potencialmente en CI) en lugar de solo con la demo manual del panel admin;
- **cae la barrera de entrada de las pruebas**: cero librerías (sin Jest/Vitest), cero
  instalación, corre en el mismo Node del build;
- **disminuye el riesgo de regresión** en reglas críticas (excluir admins, no exponer
  datos sensibles, no inventar importes) al quedar escritas como asserts;
- los módulos UI se vuelven más **fáciles de leer y cambiar** (responsabilidad única).

Relación con los objetivos del informe: **OE1** (desarrollo de la plataforma web de la
barbería — se entrega código modular y verificado) y **OE5** (aseguramiento de la
calidad — se instrumenta verificación automatizada y trazable a HUs y a ISO 25010).

---

## 5. Casos de prueba — definición (Tabla A)

| CP | Módulo / función | Objetivo | Precondiciones | Datos de entrada | Pasos de ejecución | Resultado esperado | Trazabilidad |
|---|---|---|---|---|---|---|---|
| CP-01 | `logica/sesion-logica.js` → `nombreAMostrar` | Verificar prioridad de `user_metadata.nombre` | Función importada; sin DOM | `{ user: { user_metadata: { nombre: 'Ana Torres' }, email: 'ana.torres@correo.com' } }` | `npm test` → suite sesion-logica → CP-01; llamar `nombreAMostrar(sesion)` | `"Ana Torres"` (nombre completo, sin tocar el email) | HU04 · RF04 · OE1/OE5 |
| CP-02 | `logica/sesion-logica.js` → `nombreAMostrar` | Sin nombre, usar **solo** la parte local del email (nunca el email completo — Ley 29733) | Igual que CP-01 | `{ user: { user_metadata: {}, email: 'ana.torres@correo.com' } }` | CP-02; llamar `nombreAMostrar(sesion)` y verificar que el resultado no contiene `@` | `"ana.torres"` | HU04 · RNF03 (minimización) · OE5 |
| CP-03 | `logica/sesion-logica.js` → `nombreAMostrar` | Sin nombre ni email → texto genérico (límite: **email vacío**/blanco/ausente) | Igual que CP-01 | 3 variantes: `email: ''`, `email: '   '`, `user: {}` | CP-03; llamar la función con cada variante | `"Sesión activa"` en las 3 variantes | HU04 · OE1/OE5 |
| CP-04 | `logica/sesion-logica.js` → `nombreAMostrar` | Sin sesión → `null` (el badge se oculta) | Igual que CP-01 | `null`, `undefined`, `{}`, `{ user: null }` | CP-04; llamar la función con cada entrada | `null` en las 4 variantes | HU04 · OE1/OE5 |
| CP-05 | `logica/sesion-logica.js` → `construirTextoBadge` | Texto completo del badge `"Sesión: {nombre}"` y ocultado sin sesión | Igual que CP-01 | Sesión con nombre; sesión solo con email; `{ user: {} }`; `null` | CP-05; llamar `construirTextoBadge` con cada entrada | `"Sesión: Ana Torres"`, `"Sesión: carlos.ruiz"`, `"Sesión: Sesión activa"`, `null` | HU04 · OE1/OE5 |
| CP-06 | `logica/clientes-logica.js` → `esCuentaAdmin` | Detectar cuentas exclusivamente administrativas | Función importada | Perfil `rol: 'admin'`, `rol: 'cliente'`, `null`, `undefined`, `{}` | CP-06; llamar con cada perfil | `true`, `false`, `false`, `false`, `false` | HU13 · RF08 (CA-RF08-5) · OE1/OE5 |
| CP-07 | `logica/clientes-logica.js` → `filtrarClientesNoAdmin` | **Excluir cuentas admin**, conteo correcto y conservar clientes sin `profile_id` | Arreglos simulados de `clientes` (4 filas) y `profiles` (1 admin + 2 clientes) | `CLIENTES` (c2 es admin) + `PERFILES`; además `perfiles=[]` y `filas=null` | CP-07; llamar la función y contar/verificar resultados y no-mutación | Filas = 3 (excluida 1 admin); `c4` (sin `profile_id`) conservado; entrada intacta (4); sin perfiles → 4; `null` → 0 | HU13 · RF08/RF09 · OE5 |
| CP-08 | `logica/clientes-logica.js` → `mapearClientePublico` | **No exponer campos sensibles** (password/hash/profile_id) al render | Fila simulada con campos sensibles (`password_hash`, `encrypted_password`, `auth_uid`, `profile_id`, `id`) | Fila completa de ejemplo | CP-08; mapear y verificar claves exactas y ausencia de secretos | Claves exactas `['creado_en','email','nombre','telefono']`; serializado sin "SECRETO"; sin `profile_id`/`id`; fila `null` → todo `''` | HU13 · RF08 · RNF03/Ley 29733 · OE5 |
| CP-09 | `logica/clientes-logica.js` → `ordenarClientes` | Orden por `creado_en` DESC; **no mutar**; **fechas inválidas** al final | 5 filas desordenadas (2 válidas, 1 `null`, 1 inválida, 1 válida) | Ver `tests/clientes-logica.test.js` (CP-09) | CP-09; ordenar y comparar la secuencia de nombres; revisar el array original | `['Carlos','Diana','Ana','SinFecha','Invalida']`; entrada intacta; `null` → `[]` | HU13 · RF08 · OE1/OE5 |
| CP-10 | `logica/clientes-logica.js` → `formatearFecha` | Fecha válida en es-PE; `"—"` ante inválida/ausente | Función importada | ISO válido, `null`, `undefined`, `''`, `'no-es-fecha'` | CP-10; llamar con cada valor | Formato `dd/mm/aaaa` (regex); `"—"` ×4 | HU13 · RF08 · OE1/OE5 |
| CP-11 | `logica/historial-logica.js` → `ordenarAtencionesDesc` | Atenciones ordenadas por `fecha_atencion` DESC (más reciente primero); inválidas al final | 5 atenciones simuladas (3 con fecha válida, 1 `null`, 1 inválida) | Ver `tests/historial-logica.test.js` (CP-11) | CP-11; ordenar y comparar ids; revisar el array original | ids `2, 4, 1, 3, 5`; entrada intacta; `null` → `[]` | HU14 · RF09 (CA-RF08-3) · OE1/OE5 |
| CP-12 | `logica/historial-logica.js` → `formatearImporte` | Importe solo si forma parte del registro: `null`/vacío/inválido → `"—"`; números → `"S/ X.XX"` (límite: **número 0**) | Función importada | `null`, `undefined`, `''`, `'no-numero'`, `NaN`, `25.5`, `'30'`, `0` | CP-12; llamar con cada valor | `"—"` ×5; `"S/ 25.50"`; `"S/ 30.00"`; `"S/ 0.00"` (0 explícito) | HU14 · RF09 · OE5 |
| CP-13 | `logica/historial-logica.js` → `etiquetaServicio` | Servicio retirado (FK NULL) → `"Servicio retirado"`; con nombre embebido → ese nombre | 5 atenciones simuladas | `servicio_id: null` + embed `null`; sin `servicio_id`; `null`; con nombre; nombre en blanco | CP-13; llamar con cada atención | `"Servicio retirado"` ×4; `"Corte clásico"` | HU14 · RF09 (ON DELETE SET NULL) · OE1/OE5 |
| CP-14 | `logica/historial-logica.js` → `formatearFechaHora` | `"—"` ante fecha ausente o **inválida** (límite) | Función importada | ISO válido, `null`, `undefined`, `''`, `'fecha-rota'` | CP-14; llamar con cada valor | Fecha local es-PE (contiene `dd/mm/aaaa`); `"—"` ×4 | HU14 · RF09 · OE1/OE5 |

---

## 6. Resultados de la corrida real (Tabla B) — `npm test` del 20/10/2026

Resumen del runner (Node v24.11.1):

```
ℹ tests 14
ℹ suites 3
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~128
```

| CP | Función | Resultado obtenido (corrida real) | Estado |
|---|---|---|---|
| CP-01 | `nombreAMostrar` | Devolvió `"Ana Torres"`; assert exacto superado | **OK** |
| CP-02 | `nombreAMostrar` | Devolvió `"ana.torres"`; sin `@` en el resultado | **OK** |
| CP-03 | `nombreAMostrar` | Devolvió `"Sesión activa"` en email vacío, en blanco y ausente | **OK** |
| CP-04 | `nombreAMostrar` | Devolvió `null` en las 4 variantes sin sesión | **OK** |
| CP-05 | `construirTextoBadge` | `"Sesión: Ana Torres"`, `"Sesión: carlos.ruiz"`, `"Sesión: Sesión activa"`, `null` | **OK** |
| CP-06 | `esCuentaAdmin` | `true` solo para `rol: 'admin'`; `false` ×4 | **OK** |
| CP-07 | `filtrarClientesNoAdmin` | 3 de 4 filas (1 admin excluida); `c4` conservado; no muta; casos límite OK | **OK** |
| CP-08 | `mapearClientePublico` | Solo `['creado_en','email','nombre','telefono']`; ningún hash ni `profile_id` en la salida | **OK** |
| CP-09 | `ordenarClientes` | Orden `Carlos, Diana, Ana, SinFecha, Invalida`; entrada intacta | **OK** |
| CP-10 | `formatearFecha` | Formato `dd/mm/aaaa` OK; `"—"` ×4 (incluye fecha inválida) | **OK** |
| CP-11 | `ordenarAtencionesDesc` | Orden de ids `2, 4, 1, 3, 5`; no muta | **OK** |
| CP-12 | `formatearImporte` | `"—"` ×5; `"S/ 25.50"`; `"S/ 30.00"`; `"S/ 0.00"` | **OK** |
| CP-13 | `etiquetaServicio` | `"Servicio retirado"` ×4; `"Corte clásico"` ×1 | **OK** |
| CP-14 | `formatearFechaHora` | Fecha es-PE OK; `"—"` ×4 | **OK** |

> **Nota de TDD (evidencia de rigor)**: la primera corrida dio **13 pass / 1 fail**: el
> fallo estaba en la *expectativa* del CP-05 (se esperaba `null` para `{ user: {} }`,
> pero hay sesión → corresponde `"Sesión: Sesión activa"`). Se corrigió el **caso de
> prueba** (no la función) y la suite quedó 14/14. Esto documenta que los tests
> distinguen comportamiento real y se ajustaron contra la especificación de la HU.

Verificaciones complementarias de la misma corrida:

- `node --check` → **OK** en los 9 archivos JS creados/modificados (0 errores de sintaxis).
- `npm run dev` → build OK: *"Build completado … Archivos copiados: 41"* (incluye
  `dist/js/logica/*.js`; el pipeline copia `pages/` → `dist/` sin cambios en `build.js`).

---

## 7. Cómo reproducir

```bash
# desde la raíz del repo (sin instalar nada)
npm test              # corre los 14 casos
npm run test:watch    # modo watch (opcional)

# verificación de sintaxis (los archivos tocados)
node --check pages/js/logica/sesion-logica.js
node --check pages/js/logica/clientes-logica.js
node --check pages/js/logica/historial-logica.js
node --check pages/js/sesion-ui.js
node --check pages/js/admin-clientes.js
node --check pages/js/admin-historial.js
node --check tests/sesion-logica.test.js
node --check tests/clientes-logica.test.js
node --check tests/historial-logica.test.js
```

---

## 8. Relación con `QUALITY.md` y trazabilidad

| Este documento | `QUALITY.md` | Requisitos (`REQUIREMENTS.md`) |
|---|---|---|
| §4 refactor y funciones puras | Extiende el patrón de §3 (`calcularOcupacion()`, CA-RNF06-3) | RNF06 mantenibilidad (modularidad/analizabilidad) |
| CP-01…CP-05 (HU04) | §2 (auth) y §5 (E2E) cubren el flujo; aquí la lógica del badge | RF04 · RNF03 (minimización del email) |
| CP-06…CP-10 (HU13) | §1 (RLS) cubre el acceso; aquí la exclusión de admins y el mapeo público | RF08 · CA-RF08-4/5 · Ley 29733 |
| CP-11…CP-14 (HU14) | §1 (RLS) cubre el acceso; aquí orden, importe y servicio retirado | RF09 · CA-RF08-3 |
| §6 evidencia de corrida | §10 "Resultados del período" (total/aprobados/fallidos) | — |

**Matriz resumen de trazabilidad HU ↔ casos**: HU04 → CP-01…CP-05 · HU13 → CP-06…CP-10 ·
HU14 → CP-11…CP-14 (14 casos, 14 OK, 0 pendientes).
## 9. Evidencia TDD (Red → Green → Refactor)

La reconstrucción guiada por las pruebas se documenta en [docs/TDD-EVIDENCE.md](./TDD-EVIDENCE.md), que incluye:

- Ciclos TDD independientes por módulo (sesion-logica HU04, clientes-logica HU13, historial-logica HU14)
- Salida literal de terminal por fase (ROJA/VERDE/REFACTOR) para cada ciclo
- Tablas resumen fase | acción | estado esperado | estado obtenido
- Nota de honestidad sobre reconstrucción guiada por pruebas y compromiso a test-first

El flujo se realizó con runner nativo (`node:test`) y sin librerías nuevas, manteniendo el contrato de CP-01..CP-14 inalterado.
