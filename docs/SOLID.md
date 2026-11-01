# SOLID.md — Principios SOLID en la capa de validación (T27)

Documento de trazabilidad entre los principios **SOLID** y las decisiones de diseño
de `pages/js/validacion/`. La capa es JavaScript vanilla (ES modules), sin
dependencias externas, y se integra en registro, login y formularios del panel
admin.

---

## 1. Mapa de la capa

```
pages/js/validacion/
├── contrato.js            # Tipos/contratos y helpers de éxito (esValido, sinErrores)
├── index.js               # Fachada pública (único punto de importación)
├── registro-reglas.js     # Composición: REGLAS_REGISTRO/LOGIN/SERVICIO/PROMOCION
├── validador-formulario.js# Motor: validarCampo + validarFormulario (sin DOM)
├── presentador-errores.js # Adaptadores: presentadorDOM / presentadorNulo
├── checklist-password.js  # Estado del checklist en vivo
└── reglas/
    ├── email.js
    ├── telefono.js
    ├── password.js
    ├── confirmacion.js
    ├── nombre.js
    └── numero.js
```

Flujo: **datos → motor (`validarFormulario`) → mapa de mensajes → adaptador
(`presentadorDOM`) → UI**. `pages/js/validacion.js` es una fachada de
compatibilidad que reexporta la API histórica sin acoplar a los consumidores
antiguos.

---

## 2. SRP — Single Responsibility Principle

| Módulo | Responsabilidad única | Evidencia |
|---|---|---|
| `reglas/email.js` | Formato de correo (vacío, longitud, espacios, control, estructura, TLD) | `validarEmail` devuelve `string \| null` |
| `reglas/telefono.js` | Teléfono opcional de 9 dígitos + saneo por lista blanca | `validarTelefono`, `sanearTelefono` |
| `reglas/password.js` | Fortaleza en registro y regla mínima de login | `validarPassword`, `validarPasswordLogin`, `evaluarRequisitosPassword` |
| `reglas/confirmacion.js` | Igualdad exacta contra el contexto | `validarConfirmacion` |
| `reglas/nombre.js` | Longitudes y caracteres de control de textos | `validarNombre`, `validarTitulo`, `validarDescripcion`, `validarBeneficio` |
| `reglas/numero.js` | Precio > 0 y entero positivo | `validarPrecio`, `validarPrecioOpcional`, `validarEnteroPositivo` |
| `validador-formulario.js` | Orquestar reglas y devolver el primer error por campo | `validarCampo`, `validarFormulario` |
| `presentador-errores.js` | Traducir el mapa de errores a la UI (o a un no-op) | `presentadorDOM`, `presentadorNulo` |
| `checklist-password.js` | Derivar el estado visual del checklist | `estadoChecklistPassword` |

Ninguna regla conoce el DOM, Supabase ni el motor: se pueden probar de forma
aislada (ver `tests/validacion/`).

---

## 3. OCP — Open/Closed Principle

El motor está **cerrado** (no se modifica para agregar reglas) y la composición
está **abierta** mediante mapas de reglas:

- `crearRegistro(iniciales)` clona mapas `{ campo: [Validador, ...] }`.
- `registrarRegla(mapa, campo, ...reglas)` agrega comportamiento sin tocar
  `validador-formulario.js`.
- Los formularios declaran sus reglas en `registro-reglas.js`:
  `REGLAS_REGISTRO`, `REGLAS_LOGIN`, `REGLAS_SERVICIO`, `REGLAS_PROMOCION`.

Ejemplo de extensión sin modificar el motor:

```js
import { crearRegistro, registrarRegla, validarFormulario } from './validacion/index.js';
import { validarNombre } from './validacion/index.js';

const reglas = crearRegistro({ nombre: [validarNombre] });
registrarRegla(reglas, 'alias', (valor) => (String(valor ?? '').trim() ? null : 'Ingresa un alias.'));
const errores = validarFormulario({ nombre: 'Ana', alias: '' }, reglas);
// { alias: 'Ingresa un alias.' }
```

Esto se valida en `CB-R02`/`CB-R04` (`tests/validacion/cobertura-caja-blanca.test.js`).

---

## 4. LSP — Liskov Substitution Principle

Todos los validadores respetan el mismo contrato:

```ts
(valor: unknown, contexto?: { password?: unknown }) => string | null
```

- `null` = válido; `string` = mensaje en español listo para mostrar.
- Las reglas son intercambiables dentro de un mismo campo (por ejemplo, una
  regla de formato seguida de una regla de negocio).
- `validarFormulario` no distingue el origen de la regla: solo ejecuta el array
  en orden y corta en el primer mensaje (`primero`).
- Los presentadores también son intercambiables: `presentadorDOM` (navegador)
  y `presentadorNulo` (tests/SSR) exponen la misma interfaz (`mostrar`, `limpiar`).

Evidencia: `CB-R04`, `CB-R05`, `CB-PR01` y `CB-PR02`.

---

## 5. DIP — Dependency Inversion Principle

Las dependencias apuntan hacia abstracciones, no hacia detalles:

- `validador-formulario.js` **no importa reglas concretas**: recibe un mapa
  inyectado por el consumidor.
- Las reglas **no importan** `ui.js`, Supabase ni `document`; su salida es un
  string.
- `presentadorDOM` es el único adaptador que toca el DOM y se inyecta desde las
  páginas (`pagina-registro.js`, `pagina-login.js`, `admin-servicios.js`,
  `admin-promociones.js`).
- `pages/js/validacion.js` actúa como fachada de compatibilidad para no obligar a
  los consumidores históricos a conocer la estructura interna.

Esto permite ejecutar toda la lógica con `node:test` sin navegador.

---

## 6. ISP — Interface Segregation Principle

- `contrato.js` expone únicamente lo necesario (`esValido`, `sinErrores`).
- `index.js` es la fachada pública; los consumidores importan solo lo que usan
  (por ejemplo, el checklist importa `estadoChecklistPassword` y no todo el motor).
- Cada archivo de reglas agrupa un campo cohesivo, evitando una interfaz
  monolítica de validación.

---

## 7. Deuda técnica aceptada

| Punto | Motivo | Impacto |
|---|---|---|
| `pages/js/validacion.js` reexporta la API antigua | Compatibilidad con consumidores previos a T27 | Duplicación mínima de nombres, sin lógica duplicada |
| `admin-ui.js` replica `estadoError`/`estadoVacio` de `ui.js` | Rutas relativas distintas del sprite (`../assets/…`) | Duplicación de ~30 líneas; se mantiene por simplicidad del build estático |
| Reglas de texto libre aceptan HTML como texto | El dato del usuario no se mutila; la neutralización ocurre al renderizar (`escaparHtml`/`textContent`) | Requiere disciplina de escape en la UI (auditada en el informe QA) |

---

## 8. Evidencia de pruebas

- `tests/validacion/email-telefono.test.js`
- `tests/validacion/password-confirmacion.test.js`
- `tests/validacion/validador-formulario.test.js`
- `tests/validacion/checklist-presentador.test.js`
- `tests/validacion/cobertura-caja-blanca.test.js` (caja blanca: ramas, límites y orden)
- `tests/validacion/seguridad-inputs.test.js` (entradas adversariales)

Resultado vigente: **134 pruebas, 134 aprobadas, 0 fallidas** (`npm test`).
Ver `docs/QA-REPORT-VALIDACION.md` para métricas, benchmark y auditorías.
