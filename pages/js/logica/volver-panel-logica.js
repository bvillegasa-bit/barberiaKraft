/* =============================================================================
   Barbería Kraft - logica/volver-panel-logica.js
   Lógica PURA de visibilidad del enlace "← Volver al panel".
   Sin DOM ni Supabase: testeable con node:test (tests/volver-panel.test.js).

   Seguridad por defecto (fail-safe): sin sesión, sin user o rol distinto de
   "admin" devuelve false → el enlace permanece `hidden` en el HTML.
   ============================================================================ */

/**
 * Decide si el enlace "← Volver al panel" debe mostrarse.
 * @param {object|null} sesion Sesión de Supabase Auth
 * @param {string|null} rol Rol resuelto con auth.js (obtenerRol)
 * @returns {boolean} true solo con sesión activa y rol "admin"
 */
export function debeMostrarVolverPanel(sesion, rol) {
  return Boolean(sesion && sesion.user && rol === 'admin');
}
