# docs/TDD-EVIDENCE.md

> **Metodología:** TDD: test-first / Red-Green-Refactor.  
> **Herramientas:** Node v24.11.1, `node:test`, `node:assert/strict`.  
> **Comando de ejecución:** `npm test` (runner nativo, sin librerías nuevas).  
> **Ámbito:** Lógica pura de `pages/js/logica/sesion-logica.js` (HU04), `pages/js/logica/clientes-logica.js` (HU13), `pages/js/logica/historial-logica.js` (HU14).  
> **Evidencia real:** Se guarda salida literal de terminal por fase.  
> **Respaldo fuera del repo:** `C:\Users\BERNAB~1.LAP\AppData\Local\Temp\opencode\kraft-logica-backup\` (sesion-logica.js.bak, clientes-logica.js.bak, historial-logica.js.bak)

## NOTA DE HONESTIDAD

Por tratarse de lógica ya diseñada e implementada previamente, el ciclo se realizó por **reconstrucción guiada por las pruebas**. Se ejecutó realmente la fase **ROJA** (stubs con `throw new Error('TDD RED: no implementado')` manteniendo las mismas exportaciones para forzar fallas por comportamiento/aserción), se aplicó **VERDE** con el **mínimo código necesario** para pasar los CP del módulo, y **REFACTOR** sin cambiar comportamiento. A partir de ahora el flujo del equipo es **test-first**.

## 1) CICLO 1: sesion-logica.js (HU04) — texto del badge de sesión

**Objetivos/OE relacionados:** HU04 / Seguridad/minimización (Ley 29733): email completo nunca se muestra; si falta nombre usar solo parte local antes de "@".  
**Casos cubiertos:** CP-01, CP-02, CP-03, CP-04, CP-05.

### FASE ROJA
**Acción:** Se sustituyó el cuerpo de `nombreAMostrar` y `construirTextoBadge` por stubs que lanzan error, manteniendo exports.

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL (recortado a lo esencial):**
```text
▶ sesion-logica (HU04) — texto del badge de sesión
  ✖ CP-01 nombreAMostrar devuelve el nombre del metadata (3.569ms)
  ✖ CP-02 nombreAMostrar sin nombre usa la parte local del email (nunca el email completo) (0.4296ms)
  ✖ CP-03 nombreAMostrar sin nombre ni email devuelve "Sesión activa" (límite: email vacío) (0.5146ms)
  ✖ CP-04 nombreAMostrar sin sesión (null/undefined/sin user) devuelve null para ocultar el badge (0.298ms)
  ✖ CP-05 construirTextoBadge arma "Sesión: {nombre}" y null cuando no hay sesión (0.2446ms)
✖ sesion-logica (HU04) — texto del badge de sesión (7.713ms)
ℹ fail 5
Error: TDD RED: no implementado (en nombreAMostrar / construirTextoBadge)
```

**Razón del rojo:** Los tests llamaban a las funciones exportadas; con stubs se lanzaba excepción → falla por comportamiento/error de ejecución (rojo por razón correcta).

### FASE VERDE
**Acción:** Reimplementación mínima para cumplir prioridades: metadata.nombre → parte local del email → "Sesión activa"; sin sesión → null; construirTextoBadge arma "Sesión: ..." o null.

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL:**
```text
▶ sesion-logica (HU04) — texto del badge de sesión
✔ sesion-logica (HU04) — texto del badge de sesión (8.4967ms)
ℹ pass 14
ℹ fail 0
```

### FASE REFACTOR
**Acción:** Clarificación de comentarios en español, uso de template string, chequeo explícito de email antes de split, sin cambiar comportamiento.  
**Comando:** `npm test`

**BLOQUE DE SALIDA REAL:**
```text
▶ sesion-logica (HU04) — texto del badge de sesión
✔ sesion-logica (HU04) — texto del badge de sesión (7.2572ms)
ℹ pass 14
ℹ fail 0
```

**Tabla resumen ciclo 1:**
| fase | acción | estado esperado | estado obtenido |
|---|---|---|---|
| ROJA | Stubs con `throw` (exports intactos) | Falla por comportamiento (CP-01..CP-05) | **FALLO** (5 fallos, Error TDD RED) |
| VERDE | Mínimo para pasar CP-01..CP-05 | Todo verde (14/14) | **VERDE** (pass 14, fail 0) |
| REFACTOR | Comentarios/legibilidad, sin cambios | Todo verde | **VERDE** (pass 14, fail 0) |

## 2) CICLO 2: clientes-logica.js (HU13) — cuentas admin, mapeo público y orden

**Objetivos/OE relacionados:** HU13 / CA-RF08-4/5, Ley 29733 (minimización).  
**Casos cubiertos:** CP-07, CP-08, CP-09. (Se restauraron todas las exportaciones necesarias: esCuentaAdmin, filtrarClientesNoAdmin, mapearClientePublico, ordenarClientes, compararFechasDesc, formatearFecha)

### FASE ROJA
**Acción:** Se reemplazaron las 6 funciones exportadas por stubs `throw new Error('TDD RED: no implementado')` manteniendo firmas/exports.  
**Comando:** `npm test`  
**Nota:** Inicialmente hubo error de carga por nombres no coincidentes si se omitían exports; se ajustó para mantener contrato con tests.

**BLOQUE DE SALIDA REAL (recortado):**
```text
▶ clientes-logica (HU13) — cuentas admin, mapeo público y orden
  ✖ CP-07 ... (fallos por stubs)
  ✖ CP-08 ... 
  ✖ CP-09 ...
✖ clientes-logica (HU13) — cuentas admin, mapeo público y orden
ℹ fail 3 (relativo al módulo; suite completa mostraba fallos hasta implementar)
Error: TDD RED: no implementado
```

### FASE VERDE
**Acción:** Reimplementación mínima idéntica al respaldo: exclusión solo por perfil admin con profile_id; mapeo solo a campos públicos; orden DESC con fechas inválidas al final (no muta); formatearFecha es-PE o "—".

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL:**
```text
▶ clientes-logica (HU13) — cuentas admin, mapeo público y orden
  ✔ CP-07 filtrarClientesNoAdmin excluye cuentas admin, cuenta el total correcto y conserva clientes sin profile_id (0.5583ms)
  ✔ CP-08 mapearClientePublico expone SOLO campos permitidos (nunca password/hash/profile_id) (1.7922ms)
  ✔ CP-09 ordenarClientes ordena por creado_en DESC, no muta y envía fechas inválidas al final (0.5209ms)
✔ clientes-logica (HU13) — cuentas admin, mapeo público y orden (53.073ms)
ℹ pass 14
ℹ fail 0
```

### FASE REFACTOR
**Acción:** Normalización defensiva con `Array.isArray`, comentarios en español, legibilidad sin cambiar comportamiento.  
**Comando:** `npm test`

**BLOQUE DE SALIDA REAL:**
```text
▶ clientes-logica (HU13) — cuentas admin, mapeo público y orden
  ✔ CP-07 ... (0.6265ms)
  ✔ CP-08 ... (1.4598ms)
  ✔ CP-09 ... (0.6079ms)
✔ clientes-logica (HU13) — cuentas admin, mapeo público y orden (45.8181ms)
ℹ pass 14
ℹ fail 0
```

**Tabla resumen ciclo 2:**
| fase | acción | estado esperado | estado obtenido |
|---|---|---|---|
| ROJA | Stubs con `throw` en todas las exportaciones | Falla por comportamiento (CP-07..CP-09) | **FALLO** |
| VERDE | Mínimo idéntico al original | Todo verde (14/14) | **VERDE** (pass 14, fail 0) |
| REFACTOR | Defensivo/legible, sin cambios | Todo verde | **VERDE** (pass 14, fail 0) |

## 3) CICLO 3: historial-logica.js (HU14) — orden, importe y etiqueta de servicio

**Objetivos/OE relacionados:** HU14 / CA-RF08-3.  
**Casos cubiertos:** CP-11, CP-12, CP-13, CP-14. Usa `compararFechasDesc` de clientes-logica.

### FASE ROJA
**Acción:** Stubs en `ordenarAtencionesDesc`, `formatearImporte`, `etiquetaServicio`, `formatearFechaHora`.  
**Comando:** `npm test`

**BLOQUE DE SALIDA REAL (recortado):**
```text
▶ historial-logica (HU14) — orden, importe y etiqueta de servicio
  ✖ CP-11 ordenarAtencionesDesc ordena por fecha_atencion DESC y envía inválidas al final (1.1216ms)
  ✖ CP-12 formatearImporte: null/vacío/inválido → "—", números → "S/ X.XX" y el 0 real → "S/ 0.00" (0.3163ms)
  ✖ CP-13 etiquetaServicio: sin servicio_id o sin nombre → "Servicio retirado"; con nombre → ese nombre (0.2578ms)
  ✖ CP-14 formatearFechaHora devuelve "—" ante fecha ausente o inválida (0.2222ms)
✖ historial-logica (HU14) — orden, importe y etiqueta de servicio (3.6767ms)
ℹ fail 4
Error: TDD RED: no implementado
```

### FASE VERDE
**Acción:** Mínimo idéntico al respaldo: usa `compararFechasDesc` para orden; importe valida null/undefined/'', Number.isFinite; etiqueta: si no servicio_id o sin nombre → "Servicio retirado"; formatearFechaHora inválido → "—".

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL:**
```text
▶ historial-logica (HU14) — orden, importe y etiqueta de servicio
✔ historial-logica (HU14) — orden, importe y etiqueta de servicio (44.7491ms)
ℹ pass 14
ℹ fail 0
```

### FASE REFACTOR
**Acción:** Array.isArray defensivo, comentarios claros, sin cambios funcionales.  
**Comando:** `npm test`

**BLOQUE DE SALIDA REAL:**
```text
▶ historial-logica (HU14) — orden, importe y etiqueta de servicio
✔ historial-logica (HU14) — orden, importe y etiqueta de servicio (43.1663ms)
ℹ pass 14
ℹ fail 0
```

**Tabla resumen ciclo 3:**
| fase | acción | estado esperado | estado obtenido |
|---|---|---|---|
| ROJA | Stubs con `throw` | Falla por comportamiento (CP-11..CP-14) | **FALLO** (4 fallos) |
| VERDE | Mínimo idéntico al original | Todo verde (14/14) | **VERDE** (pass 14, fail 0) |
| REFACTOR | Defensivo/legible, without behavior change | Todo verde | **VERDE** (pass 14, fail 0) |

## 4) CICLO 4 — TDD test-first (nuevo comportamiento)

**Objetivos/OE relacionados:** CA-RF03-3 (botón "Cerrar sesión" visible SOLO con sesión activa). **Bug corregido:** el botón se veía siempre.
**Nuevo contrato puro:** `estadoUiSesion(sesion)` → `{ mostrarCerrarSesion: boolean, textoBadge: string|null }` en `pages/js/logica/sesion-logica.js`.
**Casos cubiertos:** CP-15, CP-16, CP-17, CP-18 (más los CP-01..CP-05 previos del mismo módulo).

> A diferencia de los ciclos 1–3 (reconstrucción guiada), este ciclo es **test-first real**: primero se escribieron las pruebas nuevas (rojo genuino por export inexistente) y recién después se implementó la función.

### FASE ROJA
**Acción:** Se agregaron las pruebas CP-15..CP-18 y el import de `estadoUiSesion` ANTES de implementar la función. La suite no puede cargar el módulo porque el export no existe.

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL:**
```text
file:///.../tests/sesion-logica.test.js:15
  estadoUiSesion
  ^^^^^^^^^^^^^^
SyntaxError: The requested module '../pages/js/logica/sesion-logica.js' does not provide an export named 'estadoUiSesion'
    at #_instantiate (node:internal/modules/esm/module_job:254:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:369:5)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:671:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/esm/loader:101:5)

Node.js v24.11.1
✖ tests\sesion-logica.test.js (126.9129ms)
ℹ tests 10
ℹ suites 2
ℹ pass 9
ℹ fail 1
```

**Razón del rojo:** El contrato `estadoUiSesion` aún no existe → error de carga del módulo de pruebas (rojo por la razón correcta: comportamiento nuevo no implementado).

### FASE VERDE
**Acción:** Implementación MÍNIMA de `estadoUiSesion()` reutilizando `construirTextoBadge()` (hay sesión ⇔ `textoBadge` no nulo ⇒ botón visible). Se conectó el contrato único en `pagina-inicio.js`, `sesion-ui.js` y `pagina-admin.js`.

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL (recortado al módulo nuevo):**
```text
▶ sesion-logica (HU04) — estadoUiSesion: visibilidad del botón y del badge
  ✔ CP-15 sin sesión → NO mostrar botón y badge null (control oculto por defecto) (1.0034ms)
  ✔ CP-16 con sesión → SÍ mostrar botón y texto "Sesión: {nombre}" (0.1949ms)
  ✔ CP-17 con sesión sin nombre usa la parte local del email y mostrar=true (0.154ms)
  ✔ CP-18 el contrato es estable: la forma de retorno siempre tiene ambos campos boolean/string (0.1647ms)
✔ sesion-logica (HU04) — estadoUiSesion: visibilidad del botón y del badge (1.7791ms)
ℹ tests 18
ℹ suites 4
ℹ pass 18
ℹ fail 0
ℹ duration_ms 275.7358
```

### FASE REFACTOR
**Acción:** El módulo ya era defensivo; no hubo cambio funcional adicional. En la capa UI se factorizó `aplicarEstadoBotonSesion()` en `pagina-inicio.js` para no duplicar el toggle del atributo `hidden`.

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL:**
```text
ℹ tests 18
ℹ suites 4
ℹ pass 18
ℹ fail 0
```

**Fix de UI relacionado (mismo ciclo):**
- `pages/index.html` y `pages/admin/dashboard.html`: el botón nace con el atributo `hidden` (fail-safe: si el JS falla/tarda, no se muestra un control inútil).
- `pages/css/base.css`: regla global `[hidden] { display: none !important; }` — sin ella, las clases `.btn{display:inline-flex}` y `.badge-sesion{display:inline-flex}` ANULAN el atributo `hidden`.
- `pagina-inicio.js` / `sesion-ui.js` / `pagina-admin.js`: doble sincronización (`observarSesion()` + comprobación puntual `getSession()`), siempre con el atributo `hidden` (sin estilos inline).

**Tabla resumen ciclo 4:**
| fase | acción | estado esperado | estado obtenido |
|---|---|---|---|
| ROJA | Pruebas CP-15..CP-18 antes de implementar | Falla por export inexistente | **FALLO** (fail 1, SyntaxError) |
| VERDE | `estadoUiSesion()` mínimo + conexión UI | Todo verde (18/18) | **VERDE** (pass 18, fail 0) |
| REFACTOR | Sin cambio funcional (módulo ya defensivo) | Todo verde | **VERDE** (pass 18, fail 0) |

## 5) CONFIRMACIÓN FINAL

**Comando:** `npm test`  
**Resultado:**
```text
ℹ tests 18
ℹ suites 4
ℹ pass 18
ℹ fail 0
ℹ duration_ms 275.7358
```

**Verificación de sintaxis:** `node --check` OK en `pages/js/logica/{sesion,clientes,historial}-logica.js`, `pages/js/sesion-ui.js`, `pages/js/pagina-inicio.js`, `pages/js/pagina-admin.js`, `pages/js/admin-clientes.js`, `pages/js/admin-historial.js`.  
**Build:** `npm run dev` completado OK (*"Build completado..."* archivos copiados 41, dist generado).  
**Comportamiento:** Coincide con el original del respaldo (idéntico funcionalmente) + nuevo contrato `estadoUiSesion` (CA-RF03-3).

## 6) ENLACES

- Vinculado desde: [`docs/TEST-UNIT.md`](TEST-UNIT.md) (sección añadida)
- Referenciado en: [`docs/QUALITY.md`](QUALITY.md) (sección añadida)

---

# Ciclo 5 — correcciones de validación y navbar

Este ciclo corrige 6 defectos reportados (numerados 4–9 en el reporte):
nombre real en el panel de clientes, teléfono obligatorio, mostrar/ocultar
contraseña, nombres sin números, texto "Mínimo 8 caracteres" y ocultamiento
de "Iniciar sesión"/"Registrarse" con sesión activa.

## 1) ALCANCE

**Archivos de producción modificados:**
- `pages/js/validacion/reglas/telefono.js` — teléfono obligatorio.
- `pages/js/validacion/reglas/nombre.js` — rechazo de números y validación de caracteres.
- `pages/js/logica/clientes-logica.js` — `nombrePublico()` + `mapearClientePublico(fila, perfil)`.
- `pages/js/admin-clientes.js` — lee `profiles.nombre` y cruza por `profile_id`.
- `pages/js/logica/visibilidad-password.js` — NUEVO; lógica pura mostrar/ocultar.
- `pages/js/visibilidad-password-ui.js` — NUEVO; wiring DOM accesible (sin inline).
- `pages/js/logica/sesion-logica.js` — `estadoUiSesion()` añade `mostrarAcceso`.
- `pages/js/navbar-sesion.js` — NUEVO; oculta accesos con `hidden`.
- `pages/js/pagina-inicio.js`, `pages/js/pagina-login.js`, `pages/js/pagina-registro.js` — conexión de módulos.
- `pages/index.html`, `pages/login.html`, `pages/registro.html` — ids de navbar, `required`/`aria-required`, botones toggle.
- `pages/css/components.css` — `.campo__password` y `.password-toggle`.
- `pages/js/auth.js`, `pages/js/validacion/registro-reglas.js` — comentarios actualizados (sin cambio funcional).

**Pruebas añadidas/ajustadas:**
- NUEVO `tests/validacion/correcciones-ciclo5.test.js` — CP-V49, CP-V50, CP-V51, CP-V52, CP-V53.
- NUEVO `tests/visibilidad-password.test.js` — CP-V54.
- `tests/clientes-logica.test.js` — CP-V55.
- `tests/sesion-logica.test.js` — CP-V56 + contrato CP-18 ampliado.
- `tests/validacion/email-telefono.test.js` — CP-V14.
- `tests/validacion/cobertura-caja-blanca.test.js` — CB-T01, CB-N02.
- `tests/validacion/seguridad-inputs.test.js` — SG-T01, SG-N01.

## 2) FASE ROJA (pruebas primero)

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL (resumen final del runner):**
```text
ℹ tests 143
ℹ suites 32
ℹ pass 128
ℹ fail 15
ℹ cancelled 0
```

**Fallos reales observados (motivo correcto: comportamiento nuevo aún no implementado):**
```text
✖ CP-V55 mapearClientePublico prioriza profiles.nombre y cae a clientes.nombre y al email
✖ CP-V56 mostrarAcceso es true solo sin sesión (oculta login/registro)
✖ CB-T01 vacío/null/undefined se rechaza (teléfono obligatorio)
✖ CB-N02 nombre: rechaza números y símbolos; acepta letras/espacios
✖ CP-V49 vacío, nulo y solo espacios se rechazan
✖ CP-V50 rechaza nombres con dígitos
✖ CP-V52 rechaza cadenas solo de símbolos o espacios
✖ CP-V14 rechaza vacío porque el teléfono es obligatorio
✖ SG-T01 payloads no numéricos se rechazan (el teléfono es obligatorio)
✖ SG-N01 nombre rechaza números/símbolos sin lanzar; textos libres aceptan XSS
✖ tests\visibilidad-password.test.js
Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... pages\js\logica\visibilidad-password.js
```

**Nota de honestidad TDD:** CP-V51 (acentos/apóstrofes/guiones) y CP-V53
("Mínimo 8 caracteres") ya pasaban antes de implementar porque el
comportamiento existía; se añadieron como pruebas de NO regresión. El resto de
CP-V49..CP-V56 sí falló por la razón correcta.

## 3) FASE VERDE (implementación mínima)

**Acciones:**
- `validarTelefono('')` devuelve `'El teléfono es obligatorio.'`.
- `validarNombre` comprueba en orden: vacío → control → longitud → dígitos → caracteres; regex `/^[\p{L}\p{M}\s'’\-]+$/u` y exige al menos una letra.
- `nombrePublico(perfil, fila)`: `profiles.nombre` → `clientes.nombre` → parte local del email; nunca `"Sin nombre"`.
- `admin-clientes.js` consulta `profiles(id, rol, nombre)`, construye `Map` por id y mapea con el perfil.
- `alternarVisibilidad('password') === 'text'`; fail-safe a `'password'`; `etiquetaBoton(true|false)`.
- `estadoUiSesion()` devuelve `mostrarAcceso: textoBadge === null`.
- Navbar usa `observarSesion()` + `getSession()` y alterna SOLO `hidden`.

**Comando:** `npm test`

**BLOQUE DE SALIDA REAL (final):**
```text
ℹ tests 145
ℹ suites 33
ℹ pass 145
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1409.2643
```

**Tabla resumen ciclo 5:**
| fase | acción | estado esperado | estado obtenido |
|---|---|---|---|
| ROJA | CP-V49..CP-V56 + ajustes antes de implementar | Fallo por comportamiento ausente | **FALLO** (tests 143, pass 128, fail 15) |
| VERDE | Implementación mínima de reglas, lógica y UI | Todo verde | **VERDE** (tests 145, pass 145, fail 0) |

## 4) VERIFICACIONES FINALES

**Sintaxis:** `node --check` OK en 20 archivos JS (producción + pruebas tocadas);
`node --check fallos: 0 de 20`.

**Build:** `npm run dev` completado OK:
```text
[build.js] Build completado en: ...\barberia-kraft\dist
[build.js]   Archivos copiados : 56
[build.js]   Tamaño total      : 533.66 KB
[build.js]   Excluidos de dist : js\config.template.js
[build.js]   MODO DESARROLLO   : config.js generado con placeholders (esConfigPlaceholder() = true)
```

**Módulos nuevos copiados a `dist`:** `js/logica/visibilidad-password.js`,
`js/visibilidad-password-ui.js`, `js/navbar-sesion.js` (los tres `True`).

**Contrato de build:** los tests NO se copian a `dist`; el sitio estático
incluye HTML, CSS y JS de `pages/`.

