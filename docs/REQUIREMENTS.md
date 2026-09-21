# REQUIREMENTS.md — Trazabilidad de requisitos

Documento de trazabilidad del **Hito 1** de Barbería Kraft: cada requisito funcional
(RF) y no funcional (RNF) se mapea a su característica **ISO/IEC 25010**, al **estándar**
aplicable y al **artefacto de verificación** que lo demuestra. Fuente de verdad:
Spec del cambio `plataforma-barberia-kraft` (§3–§6).

---

## 1. Índice de escenarios (consolidado)

| ID | Escenario | Requisito | Tipo |
|---|---|---|---|
| S-RF01-1 | Cliente ve catálogo | RF01 | Happy path |
| S-RF01-2 | Servicio inactivo oculto | RF01 | Edge case |
| S-RF01-3 | Catálogo vacío | RF01 | Error state |
| S-RF02-1 | Cliente consulta ocupación y tiempo de espera | RF02 | Happy path |
| S-RF02-2 | Local vacío → 0% / sin espera | RF02 | Edge case |
| S-RF02-3 | Local lleno con duración alta → techo 60 | RF02 | Edge case |
| S-RF02-4 | Actualización de silla recalcula (decisión B) | RF02/RF10 | Happy path |
| S-RF03-1 | Cliente se registra | RF03 | Happy path |
| S-RF03-2 | Login de cliente | RF03/RF04 | Happy path |
| S-RF03-3 | Registro email duplicado | RF03 | Error state |
| S-RF03-4 | Login credenciales inválidas (mensaje genérico) | RF03/RF04 | Error state |
| S-RF03-5 | Admin inicia sesión | RF03/RF04 | Happy path |
| S-RF03-6 | Cliente intenta entrar al panel admin | RNF03 | Edge case / seguridad |
| S-RF05-1 | Cliente ve promociones activas | RF05 | Happy path |
| S-RF05-2 | Promoción desactivada no visible | RF05 | Edge case |
| S-RF06-1 | Admin crea servicio | RF06 | Happy path |
| S-RF06-2 | Admin crea servicio con precio inválido | RF06 | Error state |
| S-RF06-3 | Admin desactiva servicio | RF06 | Edge case |
| S-RF07-1 | Admin crea promoción activa | RF07 | Happy path |
| S-RF07-2 | Admin desactiva promoción | RF07 | Edge case |
| S-RF10-1 | Admin actualiza estado de silla → recálculo | RF10 | Happy path |
| S-RF10-2 | Cliente intenta modificar ocupación | RF10 | Edge case / seguridad |
| S-RF10-3 | Exceso de sillas ocupadas | RF10 | Error state |
| S-RLS-1 | Cliente NO puede ver clientes de otros ni tabla admin | RNF03/RF08 | Seguridad |
| S-RLS-2 | Admin accede a todo | RNF03 | Happy path |
| S-RLS-3 | Anon no accede a datos personales | RNF03 | Edge case / seguridad |

---

## 2. Matriz de trazabilidad: requisito → ISO/IEC 25010 → estándar → verificación

| Requisito | Característica ISO/IEC 25010 (sub-característica) | Estándar aplicable | Artefacto de verificación |
|---|---|---|---|
| RF01 catálogo público | Functional suitability (completeness, correctness) | ISO/IEC 12207 (desarrollo), ISO/IEC 15504 | E2E manual (QUALITY.md §5), QA-AUDIT-CHECKLIST.md |
| RF02 ocupación + espera | Functional correctness; Performance efficiency | ISO/IEC 12207 | Unit tests JS de `calcularOcupacion()` (QUALITY.md §3), prueba 4G (RNF01) |
| RF03/RF04 registro + login | Security (authenticity, confidentiality) | ISO/IEC 27001 (ref.), Ley 29733 | Pruebas de auth (QUALITY.md §2), checklist seguridad, revisión de repo |
| RF05 promociones activas | Functional suitability (completeness) | ISO/IEC 12207 | E2E manual (QUALITY.md §5) |
| RF06/RF07 CRUD admin | Functional suitability; Maintainability | ISO/IEC 15504 (proceso) | E2E manual, pruebas RLS (QUALITY.md §1) |
| RF08/RF09 esquema clientes/historial (UI diferida) | Functional suitability; Security (confidentiality) | Ley 29733, ISO/IEC 27001 (ref.) | Pruebas RLS SQL (QUALITY.md §1), revisión de migrations |
| RF10 ocupación automática | Functional correctness | ISO/IEC 12207 | Unit tests + prueba de RLS + E2E (QUALITY.md §1/§3/§4) |
| RNF01 rendimiento | Performance efficiency (time behaviour) | ISO/IEC 25010, ISO/IEC 15504 | Medición LCP mensual 4G registrada en QUALITY.md §8.1 |
| RNF02 disponibilidad | Reliability (availability) | ISO/IEC 25010, ISO/IEC 15504 | Monitor externo, registro mensual en QUALITY.md §8.2 |
| RNF03 seguridad | Security (confidentiality, integrity, authenticity) | ISO/IEC 27001 (ref.), Ley 29733 | Suite pruebas RLS (QUALITY.md §1), escaneo de secretos, QA-AUDIT-CHECKLIST.md §6 |
| RNF04 usabilidad | Usability (operability, learnability) | ISO/IEC 25010 | Checklist manual ≤3 clics (QA-AUDIT-CHECKLIST.md §2) |
| RNF05 compatibilidad | Compatibility (co-existence) | ISO/IEC 25010 | Matriz navegadores/viewports (QUALITY.md §6) |
| RNF06 mantenibilidad | Maintainability (modularity, analyzability) | ISO/IEC 15504, ISO/IEC 12207 | Revisión de estructura (README.md §3), migrations versionadas |
| RNF07 confiabilidad | Reliability (fault tolerance, recoverability) | ISO/IEC 25010 | Pruebas de fallo offline (QUALITY.md §7) |
| RNF08 accesibilidad | Usability (accessibility) | WCAG 2.1 AA, ISO/IEC 25010 | Checklist de contraste/teclado (QA-AUDIT-CHECKLIST.md §3) |

---

## 3. Requisitos funcionales (resumen auditable)

| ID | Requisito | Criterios de aceptación clave |
|---|---|---|
| RF01 | Catálogo público de servicios con precios (S/) | CA-RF01-1..4: solo `activo=true`, formato soles, solo columnas públicas |
| RF02 | Ocupación + espera calculadas (fórmula §3.2) | CA-RF02-1..7: % 0 decimales, espera `⌈⌉` con techo 60, recálculo automático, límite de sillas |
| RF03 | Registro de cliente (Supabase Auth) | CA-RF03-1..8: mínimo 8 car., filas `clientes`+`profiles`, sin auto-admin, mensajes claros |
| RF04 | Login cliente y admin | CA-RF03-4/5/8: redirect por rol, cliente bloqueado del panel, mensaje genérico |
| RF05 | Promociones activas visibles | CA-RF05-1..4: solo `activa=true`, título/descripción/beneficio |
| RF06 | CRUD admin de servicios | CA-RF06-1..5: crear/editar/desactivar/eliminar, validación precio>0 y nombre≠vacío, RLS |
| RF07 | CRUD admin de promociones | CA-RF07-1..4: crear/editar/desactivar/eliminar, RLS |
| RF08 | Esquema `clientes` (UI admin → Hito 2) | CA-RF08-1..5: esquema + RLS + fila al registrarse |
| RF09 | Esquema `historial_atencion` (UI admin → Hito 2) | CA-RF08-3: RLS por cliente/admin |
| RF10 | Ocupación automática (decisión B) | CA-RF10-1..5: una fila por silla, update admin, nunca `ocupadas > totales` |

---

## 4. Requisitos no funcionales con umbrales mensuales

> "Medición mensual" = se mide y registra al menos una vez durante el mes del hito.
> Los registros viven en `docs/QUALITY.md` §8.

| ID | Característica ISO 25010 | Umbral / meta |
|---|---|---|
| RNF01 | Performance efficiency | LCP `index.html` < 2.5 s en 4G (CA-RNF01-1); transferencia inicial ≤ 500 KB gzip (CA-RNF01-2); layout visible < 1 s (CA-RNF01-3) |
| RNF02 | Reliability (availability) | Uptime ≥ 99% en horario de atención (L–S 09:00–21:00, Dom 10:00–18:00); wake-up free tier documentado (CA-RNF02-2) |
| RNF03 | Security | Suite RLS SQL 100% verde (CA-RNF03-1); `git grep` sin `service_role` (CA-RNF03-2); HTTPS (CA-RNF03-3); consentimiento Ley 29733 (CA-RNF03-4); mensaje genérico de login (CA-RNF03-5) |
| RNF04 | Usability | Cualquier función en ≤ 3 clics (CA-RNF04-1); hamburguesa en 360 px (CA-RNF04-2); labels + errores junto al campo (CA-RNF04-3); tema consistente (CA-RNF04-4) |
| RNF05 | Compatibility | Sin errores en Chrome/Edge/Firefox/Safari (2 versiones recientes) y viewports 360/768/1280 (CA-RNF05-1/2) |
| RNF06 | Maintainability | Estructura de carpetas documentada (CA-RNF06-1); migraciones numeradas (CA-RNF06-2); lógica de ocupación única `calcularOcupacion()` (CA-RNF06-3) |
| RNF07 | Reliability (fault tolerance) | Offline → "No se pudo conectar. Reintenta" sin romper layout (CA-RNF07-1); fallo de una sección no bloquea las demás (CA-RNF07-2); estados vacíos con datos ausentes (CA-RNF07-3) |
| RNF08 | Accessibility (WCAG 2.1 AA) | Contraste texto ≥ 4.5:1 (CA-RNF08-1); foco visible con Tab (CA-RNF08-2); estado de silla con texto + color (CA-RNF08-3) |

---

## 5. Diferido explícito (fuera del Hito 1)

- **RF08/RF09**: pantallas admin de clientes e historial de atención → Hito 2 (tabs deshabilitadas en el panel con aviso).
- Perfil de cliente completo (edición de datos propios visible) → Hito 2.
- Cálculo de `tiempo_servicio_promedio_min` desde datos históricos (SHOULD futuro; hoy parámetro configurable).
- Pagos online, agenda de citas, módulo de barberos individuales, multi-sucursal, PWA/i18n/notificaciones.