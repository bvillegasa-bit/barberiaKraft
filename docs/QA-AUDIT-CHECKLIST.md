# QA-AUDIT-CHECKLIST.md — Checklist de auditoría por características ISO/IEC 25010

Checklist para auditar la demo del **Grupo 6 (Barbería Kraft)** — y, por rol de QA,
para auditar demos de **otros grupos** — en vivo, contra criterios observables.
Basado en la matriz de trazabilidad de `REQUIREMENTS.md`.

**Uso**: marcar ✅/❌/N/A, puntuar cada característica de 1 a 5 (1 = no cumple,
5 = cumple plenamente) y registrar hallazgos con evidencia. Total = suma / n.

**Auditor(es)**: __________  **Fecha**: __________  **Sitio auditado**: __________

---

## 1. Adecuación funcional (Functional suitability)

| # | Criterio observable | ✅/❌ | Nota / evidencia |
|---|---|---|---|
| F-01 | El catálogo público muestra servicios con nombre, descripción y precio en S/ (RF01, S-RF01-1) | | |
| F-02 | Los servicios/promociones desactivados NO aparecen al público (S-RF01-2, S-RF05-2) | | |
| F-03 | El semáforo muestra % de ocupación y tiempo de espera ("Sin espera" si 0) calculados, no digitados (RF02, CA-RF02-1) | | |
| F-04 | Al ocupar/liberar una silla, el público refleja el nuevo % y espera en la siguiente consulta (S-RF02-4, S-RF10-1) | | |
| F-05 | Registro de cliente funciona (email + password ≥ 8 + consentimiento obligatorio) (RF03, CA-RNF03-4) | | |
| F-06 | Login de cliente y de admin redirigen correctamente por rol (S-RF03-2/5) | | |
| F-07 | Un cliente NO puede entrar al panel admin; la URL forzada tampoco sirve (S-RF03-6) | | |
| F-08 | CRUD de servicios: crear, editar, desactivar, eliminar (RF06, S-RF06-1/2/3) | | |
| F-09 | CRUD de promociones: crear, editar, desactivar, eliminar (RF07, S-RF07-1/2) | | |
| F-10 | El panel de sillas permite ocupar/liberar y muestra el límite (RF10, S-RF10-3) | | |
| F-11 | Las tabs "Clientes" y "Historial" están presentes pero deshabilitadas con aviso "Hito 2" (CA-RF08-5) | | |

## 2. Usabilidad (Usability — RNF04)

| # | Criterio observable | ✅/❌ | Nota / evidencia |
|---|---|---|---|
| U-01 | Cada función principal se logra en ≤ 3 clics desde la página de inicio (CA-RNF04-1) | | |
| U-02 | En viewport 360 px el menú hamburguesa está presente y funcional (CA-RNF04-2) | | |
| U-03 | Todos los inputs tienen label visible (CA-RNF04-3, RNF08) | | |
| U-04 | Los errores de formulario aparecen en español junto al campo (CA-RNF04-3) | | |
| U-05 | El tema rojo/negro/gris es consistente en páginas públicas y admin (CA-RNF04-4) | | |
| U-06 | Los mensajes del sistema están en español y son comprensibles | | |

## 3. Accesibilidad (WCAG 2.1 AA — RNF08)

| # | Criterio observable | ✅/❌ | Nota / evidencia |
|---|---|---|---|
| A-01 | Contraste de textos contra fondo ≥ 4.5:1 (verificar rojo `#C1121F` solo en acentos; textos en `--color-rojo-texto`) (CA-RNF08-1) | | |
| A-02 | Navegación con Tab muestra foco visible en menú, tabs y formularios (CA-RNF08-2) | | |
| A-03 | El estado de cada silla se comunica con TEXTO ("Libre"/"Ocupada") y no solo color (CA-RNF08-3) | | |
| A-04 | Las tabs del panel funcionan con flechas ←/→ y Home/End (rol=tab, tabindex roving) | | |
| A-05 | Imágenes decorativas con alt vacío / role="presentation"; iconos informativos con aria-label | | |
| A-06 | Áreas táctiles ≥ 44 px en botones (incluidos iconos del CRUD) (CA-RNF05-2) | | |

## 4. Seguridad observable (Security — RNF03, ref. ISO/IEC 27001, Ley 29733)

| # | Criterio observable | ✅/❌ | Nota / evidencia |
|---|---|---|---|
| S-01 | Login con email inexistente y con password errónea muestran EL MISMO mensaje genérico (CA-RNF03-5) | | |
| S-02 | El registro no ofrece campo/camino de rol admin (CA-RF03-6) | | |
| S-03 | El sitio se sirve por HTTPS (candado) y redirige HTTP → HTTPS (CA-RNF03-3) | | |
| S-04 | La consola (F12) no muestra errores ni datos sensibles durante el recorrido | | |
| S-05 | El formulario de registro exige consentimiento de datos personales (Ley 29733) (CA-RNF03-4) | | |
| S-06 | Revisión de repo: `git grep` no encuentra `service_role`/claves privadas (CA-RNF03-2) | | |
| S-07 | Las migraciones 0001/0002 existen y la política RLS es auditable en SQL (CA-RNF06-2) | | |

## 5. Fiabilidad (Reliability — RNF02/RNF07)

| # | Criterio observable | ✅/❌ | Nota / evidencia |
|---|---|---|---|
| R-01 | Con red desconectada, el sitio muestra "No se pudo conectar. Reintenta" sin romper el layout (CA-RNF07-1) | | |
| R-02 | El fallo de una sección no bloquea las demás (CA-RNF07-2) | | |
| R-03 | Tablas vacías muestran estados vacíos en español, sin spinners infinitos (CA-RNF07-3, S-RF01-3) | | |
| R-04 | El wake-up del free tier de Supabase está documentado (README) (CA-RNF02-2) | | |

## 6. Rendimiento (Performance efficiency — RNF01)

| # | Criterio observable | ✅/❌ | Nota / evidencia |
|---|---|---|---|
| P-01 | El layout se pinta antes de que responda Supabase (sin pantalla en blanco > 1 s) (CA-RNF01-3) | | |
| P-02 | No hay requests a CDN de terceros (iconos/fuentes self-host) — ver Network tab | | |
| P-03 | Existe registro mensual de LCP 4G < 2.5 s y transferencia ≤ 500 KB (CA-RNF01-1/2) | | |

## 7. Compatibilidad (Compatibility — RNF05)

| # | Criterio observable | ✅/❌ | Nota / evidencia |
|---|---|---|---|
| C-01 | Sin desbordes horizontales en 360 / 768 / 1280 px (CA-RNF05-1) | | |
| C-02 | La matriz de navegadores del QUALITY.md está llena (Chrome/Edge/Firefox/Safari) | | |

## 8. Mantenibilidad (Maintainability — RNF06, ISO/IEC 15504/12207)

| # | Criterio observable | ✅/❌ | Nota / evidencia |
|---|---|---|---|
| M-01 | Estructura de carpetas documentada en README y respetada (CA-RNF06-1) | | |
| M-02 | Archivos y funciones en kebab-case / ES modules con imports relativos | | |
| M-03 | Lógica de ocupación en UNA función `calcularOcupacion()` (sin duplicados) (CA-RNF06-3) | | |
| M-04 | El esquema vive en `supabase/migrations/` versionadas, no en edición manual | | |

---

## Resumen de puntaje por característica ISO/IEC 25010

| Característica | Puntaje (1–5) | Comentario del auditor |
|---|---|---|
| Functional suitability | | |
| Usability (incl. accessibility) | | |
| Security | | |
| Reliability | | |
| Performance efficiency | | |
| Compatibility | | |
| Maintainability | | |

**Promedio general**: ____ / 5

---

## Hallazgos y recomendaciones

| Severidad (Alta/Media/Baja) | Hallazgo | Evidencia | Recomendación |
|---|---|---|---|
| | | | |
| | | | |

**Veredicto**: ☐ Aprobado  ☐ Aprobado con observaciones  ☐ No aprobado

Firma del auditor: ______________________