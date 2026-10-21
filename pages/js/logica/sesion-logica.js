/* =============================================================================
   Barbería Kraft — logica/sesion-logica.js (HU04 — lógica PURA del badge)
   ---------------------------------------------------------------------------
   Funciones puras extraídas de sesion-ui.js para poder testearlas con el
   runner nativo de Node (node:test) SIN DOM ni Supabase.

   Seguridad/minimización (Ley 29733): el email COMPLETO nunca se muestra;
   si falta el nombre se usa solo la parte local (antes de "@").
   ============================================================================ */

/**
 * Texto del usuario a mostrar para la sesión actual.
 * Prioridad: user_metadata.nombre → parte local del email → "Sesión activa".
 * @param {object|null} sesion Sesión de Supabase Auth
 * @returns {string|null} null si no hay sesión (ocultar el badge)
 */
export function nombreAMostrar(sesion) {
  const usuario = sesion?.user;
  if (!usuario) return null;

  // 1) Prioridad: nombre en user_metadata
  const nombre = String(usuario.user_metadata?.nombre || '').trim();
  if (nombre) return nombre;

  // 2) Fallback: solo la parte antes de "@" (nunca el email completo)
  const email = String(usuario.email || '').trim();
  if (email) {
    const local = email.split('@')[0].trim();
    if (local) return local;
  }

  // 3) Último recurso
  return 'Sesión activa';
}

/**
 * Construye el texto del badge. Retorna null si no hay sesión para ocultarlo.
 * @param {object|null} sesion Sesión de Supabase Auth
 * @returns {string|null}
 */
export function construirTextoBadge(sesion) {
  const nombre = nombreAMostrar(sesion);
  if (nombre === null) return null;
  return `Sesión: ${nombre}`;
}
