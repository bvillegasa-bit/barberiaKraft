/* =============================================================================
   Barbería Kraft — logica/visibilidad-password.js
   -----------------------------------------------------------------------------
   SOLID · SRP: lógica PURA del control mostrar/ocultar contraseña.
   No toca el DOM ni conoce los formularios: solo decide el próximo tipo de
   input y la etiqueta accesible del botón. Testeable con node:test.
   ============================================================================= */

/**
 * Alterna el tipo de un input de contraseña.
 * Fail-safe: cualquier valor distinto de 'password' vuelve a 'password'
 * (nunca deja una contraseña visible por accidente).
 * @param {string|undefined|null} tipoActual
 * @returns {'password'|'text'}
 */
export function alternarVisibilidad(tipoActual) {
  return tipoActual === 'password' ? 'text' : 'password';
}

/**
 * Etiqueta accesible (aria-label) del botón según el estado del input.
 * @param {boolean} visible
 * @returns {string}
 */
export function etiquetaBoton(visible) {
  return visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
}
