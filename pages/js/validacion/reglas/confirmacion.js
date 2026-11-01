/* =============================================================================
   Barbería Kraft — validacion/reglas/confirmacion.js
   -----------------------------------------------------------------------------
   SOLID · SRP: solo compara la confirmación con la contraseña original.
   SOLID · DIP: lee la contraseña desde el contexto inyectado; no conoce el DOM
   ni consulta inputs directamente.
   T27: la comparación es EXACTA (los espacios finales cuentan como diferencia).
   ============================================================================= */

/**
 * Valida que la confirmación coincida con la contraseña.
 * @param {*} valor Texto del campo "confirmar contraseña".
 * @param {import('../contrato.js').ContextoValidacion} [contexto]
 * @param {string} [contexto.password] Contraseña original.
 * @returns {string|null}
 */
export function validarConfirmacion(valor, contexto = {}) {
  const confirmacion = String(valor ?? '');
  // `contexto?.` tolera null/undefined: la regla nunca lanza por un contexto mal formado.
  const password = String(contexto?.password ?? '');

  // Vacío (o solo espacios) se reporta como faltante; luego se compara exacto.
  if (confirmacion.trim() === '') return 'Confirma tu contraseña.';
  if (confirmacion !== password) return 'Las contraseñas no coinciden.';

  return null;
}
