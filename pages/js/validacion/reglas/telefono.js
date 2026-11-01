/* =============================================================================
   Barbería Kraft — validacion/reglas/telefono.js
   -----------------------------------------------------------------------------
   SOLID · SRP: valida y sanea el teléfono celular peruano (9 dígitos).
   SOLID · LSP: misma firma que el resto de reglas.
   Decisión: el teléfono es OPCIONAL; si se completa debe tener 9 dígitos.
   RNF03 / Ley 29733 — se persiste solo el dato mínimo necesario.
   ============================================================================= */

/**
 * Elimina todo lo que no sea dígito. Se usa en vivo mientras el usuario escribe
 * para impedir espacios, guiones, prefijo + o letras.
 * @param {*} valor
 * @returns {string} Solo dígitos (puede ser '').
 */
export function sanearTelefono(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Valida un teléfono celular de Perú.
 * - Vacío → válido (campo opcional).
 * - Solo dígitos.
 * - Exactamente 9 dígitos si se completa.
 *
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarTelefono(valor, contexto = {}) {
  void contexto;
  const telefono = String(valor ?? '').trim();

  if (telefono === '') return null;
  if (!/^\d+$/.test(telefono)) return 'El teléfono solo puede contener dígitos.';
  if (telefono.length > 9) return 'El teléfono no puede tener más de 9 dígitos.';
  if (telefono.length < 9) return 'El teléfono debe tener 9 dígitos.';

  return null;
}
