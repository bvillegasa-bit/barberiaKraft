/* =============================================================================
   Barbería Kraft — validacion/reglas/numero.js
   -----------------------------------------------------------------------------
   SOLID · SRP: reglas numéricas de precios y duraciones.
   SOLID · LSP: misma firma y mismo contrato de retorno que el resto.
   CA-RF06-4 / CA-RF07 — precio > 0 y entero positivo.
   ============================================================================= */

/**
 * Precio numérico estrictamente mayor a 0.
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarPrecio(valor, contexto = {}) {
  void contexto;
  if (valor === '' || valor === null || valor === undefined) return 'Ingresa el precio.';
  if (typeof valor !== 'string' && typeof valor !== 'number') return 'El precio debe ser un número.';
  const numero = Number(valor);
  if (Number.isNaN(numero)) return 'El precio debe ser un número.';
  if (!Number.isFinite(numero)) return 'El precio debe ser un número válido.';
  if (numero <= 0) return 'El precio debe ser mayor a 0.';
  return null;
}

/**
 * Precio OPCIONAL: vacío es válido (promoción sin precio de oferta).
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarPrecioOpcional(valor, contexto = {}) {
  void contexto;
  if (valor === '' || valor === null || valor === undefined) return null;
  return validarPrecio(valor);
}

/**
 * Entero positivo (duración en minutos).
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarEnteroPositivo(valor, contexto = {}) {
  void contexto;
  if (valor === '' || valor === null || valor === undefined) return 'Ingresa un valor.';
  if (typeof valor !== 'string' && typeof valor !== 'number') return 'Debe ser un número entero.';
  const numero = Number(valor);
  if (Number.isNaN(numero) || !Number.isInteger(numero)) return 'Debe ser un número entero.';
  if (numero <= 0) return 'Debe ser mayor a 0.';
  return null;
}
