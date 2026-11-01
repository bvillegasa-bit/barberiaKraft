# QA-REPORT-VALIDACION.md — Informe de QA de la capa de validación (T27)

**Proyecto**: Barbería Kraft — Hito 1 · **Curso**: Calidad de Software (VIII ciclo, UCV)
**Alcance**: `pages/js/validacion/`, sus integraciones en registro/login/admin, pruebas
unitarias, benchmark y auditorías de seguridad y usabilidad.
**Fecha de ejecución**: 31/10/2026
**Entorno**: Node.js **v24.11.1** · Windows (win32) · sin dependencias externas
**Ejecutor**: Grupo 6

---

## 1. Resumen ejecutivo

| Dimensión | Resultado | Estado |
|---|---|---|
| Pruebas unitarias | **134/134 aprobadas**, 29 suites, 0 fallos (~1.25 s) | Aprobado |
| Caja blanca (ramas/límites) | 63 casos en `cobertura-caja-blanca.test.js` | Aprobado |
| Entradas adversariales | 9 casos en `seguridad-inputs.test.js` | Aprobado |
| Rendimiento (formulario completo) | **0.0033 ms** (3.267 µs) por validación | Aprobado |
| Criterio «validar un formulario < 1 ms» | Cumple con margen de ~300× | Aprobado |
| Tamaño de la capa de validación | **26 173 B (25.6 KB)** en 12 archivos | Aprobado |
| Build de desarrollo | 53 archivos, 527.2 KB, placeholders correctos | Aprobado |
| Hallazgos de seguridad corregidos | 3 (XSS en estados, normalización de email, atributo sin escapar) | Corregido |
| Hallazgos críticos/altos abiertos | 0 | Aprobado |

Riesgos residuales: los campos de texto libre aceptan HTML **como dato** (se
neutraliza al renderizar); las pruebas son de unidad/estático, no E2E de navegador;
el CSP contiene `<TU-PROYECTO>` hasta que el build inyecta el host real.

---

## 2. Evidencia de pruebas (`npm test`)

```
ℹ tests 134
ℹ suites 29
ℹ pass 134
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1247.4528
```

### 2.1 Distribución por archivo

| Archivo | Casos | Cobertura funcional |
|---|---:|---|
| `tests/clientes-logica.test.js` | 5 | HU13: cuentas admin, mapeo público, orden |
| `tests/historial-logica.test.js` | 4 | HU14: orden, importe, servicio retirado |
| `tests/sesion-logica.test.js` | 9 | HU04: badge de sesión, visibilidad |
| `tests/validacion/email-telefono.test.js` | 15 | CP-V01…CP-V15 |
| `tests/validacion/password-confirmacion.test.js` | 14 | CP-V16…CP-V29 |
| `tests/validacion/validador-formulario.test.js` | 10 | CP-V30…CP-V34, CP-V39…CP-V43 |
| `tests/validacion/checklist-presentador.test.js` | 5 | CP-V44…CP-V48 |
| `tests/validacion/cobertura-caja-blanca.test.js` | 63 | CB-C, CB-E, CB-T, CB-P, CB-F, CB-N, CB-NU, CB-R, CB-PR, CB-CL, CB-FA |
| `tests/validacion/seguridad-inputs.test.js` | 9 | SG-E, SG-T, SG-P, SG-N, SG-NU |
| **Total** | **134** | |

### 2.2 Caja blanca — puntos verificados

- **Límites exactos**: email 254/255, teléfono 8/9/10, password 7/8 y 64/65,
  nombre 80/81, título 100/101, descripción 300/301, beneficio 120/121.
- **Orden de mensajes**: longitud > espacios > control > estructura (email);
  mayúscula > minúscula > número > especial (password).
- **Tipos no-string**: `null`, `undefined`, números, booleanos, objetos, arrays,
  `Symbol` y `NaN` no lanzan excepción.
- **Motor**: `validarCampo`/`validarFormulario` respetan el orden del registro,
  devuelven el primer error y toleran mapas/datos nulos.
- **OCP**: `crearRegistro`/`registrarRegla` permiten añadir reglas sin modificar
  el motor.
- **Presentadores**: `presentadorNulo` nunca lanza; `presentadorDOM` tolera
  elementos nulos.
- **Fachadas**: `index.js` expone el contrato público y `validacion.js` conserva
  los exports históricos.

### 2.3 Suite adversarial — hallazgos de comportamiento

| Caso | Resultado esperado | Resultado |
|---|---|---|
| SG-E01/E02 | Email rechaza XSS, SQLi, traversal, `%00`, NUL, saltos y emoji; ningún mensaje reemite la carga | Aprobado |
| SG-T01/T02 | Teléfono rechaza todo lo no numérico; `sanearTelefono` solo conserva dígitos | Aprobado |
| SG-P01/P02 | Password rechaza payloads inválidos; una cadena fuerte con forma de inyección se **acepta como contraseña** | Aprobado (seguro: se hashea y nunca se renderiza) |
| SG-N01/N02 | Textos libres aceptan XSS **como texto plano** sin mutarlo; caracteres de control y >límite se rechazan | Aprobado |
| SG-NU01 | Precio/entero rechazan toda carga con mensaje en español | Aprobado |

> Decisión documentada: no se «sanea» el texto libre en la capa de validación
> porque el dato debe conservarse íntegro; la neutralización es responsabilidad
> del render (`textContent`/`escaparHtml`), auditada en la sección 4.

---

## 3. Benchmark (`npm run bench`)

Script propio sin dependencias: `scripts/bench-validacion.mjs`.
Metodología: calentamiento + 1 000 muestras; 100 000 iteraciones para reglas
sueltas y 10 000 para formulario/checklist; percentiles por muestra.

| Operación | Iteraciones | Tiempo total | Throughput | µs/op | p50 | p95 | p99 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `validarEmail` | 100 000 | 86.0 ms | 1 163 159 ops/s | 0.860 | 1.100 | 1.800 | 4.000 |
| `validarTelefono` | 100 000 | 17.9 ms | 5 601 456 ops/s | 0.179 | 0.500 | 0.900 | 1.300 |
| `validarPassword` | 100 000 | 32.4 ms | 3 083 755 ops/s | 0.324 | 0.500 | 0.800 | 1.600 |
| `validarFormulario` (registro) | 10 000 | 32.7 ms | 306 122 ops/s | 3.267 | 2.400 | 4.000 | 13.000 |
| `estadoChecklistPassword` | 10 000 | 10.5 ms | 955 219 ops/s | 1.047 | 0.900 | 1.300 | 16.200 |

**Criterio**: validar un formulario completo en menos de 1 ms.

- Medición: **3.267 µs/op = 0.0033 ms** → **CUMPLE** (≈300 veces por debajo del umbral).
- Sink de verificación: 225 000 resultados consumidos (evita optimización muerta).

**Lectura**: el costo está dominado por la orquestación de los 5 campos del
registro; las reglas individuales están por debajo de 1 µs. El p99 del formulario
(13.0 µs) sigue muy por debajo de 1 ms. Son mediciones micro: los valores varían
entre corridas, pero el orden de magnitud se mantiene lejos del umbral.

---

## 4. Auditoría de seguridad

### 4.1 Hallazgos corregidos

| # | Severidad | Hallazgo | Corrección | Ubicación |
|---|---|---|---|---|
| S-01 | Media | Los estados de UI (`estadoCarga`, `estadoError`, `estadoVacio`, `estadoErrorAdmin`, `estadoVacioAdmin`) construían HTML por interpolación; un mensaje/ícono proveniente de datos podía inyectar markup | Se reescribieron con `createElement`/`createElementNS`, `textContent` y `setAttribute`; el ícono se sanea con `.replace(/[^a-z0-9-]/gi,'')` y fallback `icon-alerta` | `pages/js/ui.js:48`, `:66`, `:95`; `pages/js/admin-ui.js:23`, `:55` |
| S-02 | Baja | `registrarCliente` e `iniciarSesion` enviaban el email sin normalizar (espacios/capitalización), lo que podía producir duplicados o fallos de login | Se añadió `normalizarEmail()` (`trim` + `toLowerCase`) y se usa en ambos flujos | `pages/js/auth.js:187`, usado en `registrarCliente` (`:39`) e `iniciarSesion` (`:77`) |
| S-03 | Baja | El `value` del selector de clientes se interpolaba sin escapar en un atributo HTML | Se aplicó `escaparHtml(cliente.id)` | `pages/js/admin-historial.js:123` |

### 4.2 Controles verificados sin hallazgo

| Control | Evidencia |
|---|---|
| Mensajes de error por campo se muestran con `textContent` | `pages/js/ui.js:273` (`mostrarErrorCampo`, `error.textContent`) |
| Tablas admin escapan nombre, email, teléfono y notas | `pages/js/admin-clientes.js:133-135`; `pages/js/admin-historial.js:187-189` |
| Sin claves versionadas | Solo `pages/js/config.template.js` con tokens; `dist/js/config.js` es generado y está ignorado |
| Sin PII en consola | No hay `console.log` de email/teléfono/password en los flujos auditados |
| Operaciones de red con manejo de error | `sincronizarTelefonoCliente` envuelto en `try/catch` (`pages/js/auth.js:197`) |
| CSP estricto | `pages/_headers`: `script-src 'self'; style-src 'self';`, sin handlers ni estilos inline |
| Contraseñas nunca se renderizan | Se envían a Supabase Auth (hash gestionado por el proveedor) |

### 4.3 Riesgos residuales

1. **Texto libre acepta HTML como dato** (por diseño). Si un render futuro usa
   `innerHTML` sin escapar, habría XSS. Mitigación actual: `textContent` y
   `escaparHtml` en todas las rutas auditadas.
2. **CSP con placeholder** `<TU-PROYECTO>` en `connect-src` hasta que `npm run build`
   inyecta el host de Supabase; en desarrollo el navegador bloquea la conexión
   real (comportamiento esperado).
3. **Sin E2E automatizado de navegador**: el foco automático del primer error y
   el checklist en vivo se verificaron por lectura de código y pruebas de las
   funciones puras, no con Playwright.
4. **`admin-historial` usa `innerHTML` con plantillas estáticas**; los datos
   insertados están escapados. Se acepta por simplicidad del build sin bundler.

---

## 5. Auditoría de usabilidad y accesibilidad

Revisión estática de formularios, estilos y flujo de error. **No se requirieron
cambios de código**: los criterios ya estaban cubiertos.

| Criterio | Evidencia | Estado |
|---|---|---|
| Etiquetas visibles y asociadas | `pages/registro.html:51,56,63,68,78,85`; `pages/login.html:51-58`; plantillas admin (`admin-servicios.js:36-49`, `admin-promociones.js:36-37`) | Cumple |
| Autocompletado correcto | `name`, `tel-national`, `email`, `new-password`, `current-password` | Cumple |
| Teclado móvil adecuado | `inputmode="numeric"` + `maxlength="9"` (teléfono); `decimal`/`numeric` (precio/duración) | Cumple |
| Ayuda contextual | `aria-describedby="ayuda-telefono"`; checklist con `aria-live="polite"` (`registro.html:73`) | Cumple |
| Errores junto al campo y en español | `presentadorDOM` + `mostrarErrorCampo`; `.campo .error` (`pages/css/components.css:468`) | Cumple |
| Estado inválido también en select/textarea | `.campo input.invalido, .campo select.invalido, .campo textarea.invalido` (`components.css:474-478`) | Cumple |
| Foco en el primer error | Integraciones de registro/login/admin enfocan el primer campo inválido | Cumple |
| Validación nativa desactivada para mensajes propios | `novalidate` en `registro.html:49` y `login.html:49` | Cumple |
| Contraste/estado no solo por color | Texto *Libre/Ocupada* además del semáforo; checklist con texto | Cumple |

Observación menor: `login.html` declara `minlength="8"`, pero al usar `novalidate`
no se aplica; el login solo exige no vacío y ≤64 (decisión de producto). No genera
conflicto funcional.

---

## 6. Tamaño y build

| Artefacto | Medición |
|---|---:|
| Capa de validación (12 archivos, incl. `reglas/`) | 26 173 B / **25.6 KB** |
| `dist/js` (incluye vendor de Supabase) | 366 981 B / 358.4 KB |
| `dist/` total (53 archivos) | 539 880 B / **527.2 KB** |
| Config generada en modo dev | `dist/js/config.js` con placeholders (`esConfigPlaceholder() = true`) |

`npm run dev` finalizó correctamente (53 archivos, placeholders, aviso de no
apto para producción). El build real inyecta `SUPABASE_URL`/`SUPABASE_ANON_KEY`
desde el entorno y reescribe el host del CSP.

---

## 7. Reproducción

```bash
npm test          # 134 pruebas, 29 suites
npm run bench     # benchmark con Node v24.11.1
npm run dev       # build de desarrollo con placeholders
```

---

## 8. Conclusión

La capa de validación queda **aprobada** para el Hito 1: contrato uniforme,
reglas puras y testeables, 134 pruebas verdes, suite adversarial sin excepciones
no controladas, rendimiento ~300× por debajo del umbral y tres hallazgos de
seguridad corregidos con regresión cubierta por pruebas. Los riesgos residuales
son de baja severidad y están acotados por el modelo de render y el CSP.

Documentos relacionados: [`SOLID.md`](./SOLID.md), [`TEST-UNIT.md`](./TEST-UNIT.md),
[`QUALITY.md`](./QUALITY.md).
