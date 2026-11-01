/* =============================================================================
   Barbería Kraft — validacion/reglas/nombre.js
   -----------------------------------------------------------------------------
   SOLID · SRP: reglas de campos de texto (nombre, título, descripción,
   beneficio). Cada una tiene una única responsabilidad y la misma firma.
   SOLID · LSP: todas devuelven null o un string y son intercambiables.
   RF06 / RF07 / T27: longitudes máximas (nombre ≤80, título ≤100,
   descripción ≤300, beneficio ≤120) sin romper los mensajes históricos.
   ============================================================================= */

/**
 * Texto obligatorio con longitud máxima.
 * @param {*} valor
 * @param {number} max
 * @param {string} etiqueta Nombre legible del campo ("nombre", "título", ...).
 * @returns {string|null}
 */
function contieneCaracteresControl(texto) {
  return /[\u0000-\u001F\u007F]/.test(texto);
}

function validarTextoObligatorio(valor, max, etiqueta) {
  const texto = String(valor ?? '').trim();
  if (texto === '') return 'Este campo no puede estar vacío.';
  if (contieneCaracteresControl(texto)) return `El ${etiqueta} contiene caracteres no válidos.`;
  if (texto.length > max) return `El ${etiqueta} no puede superar los ${max} caracteres.`;
  return null;
}

/**
 * Variante con artículo configurable ("El/La") para mensajes naturales.
 * @param {*} valor
 * @param {number} max
 * @param {string} etiqueta
 * @param {string} articulo
 * @returns {string|null}
 */
function validarTextoOpcionalConArticulo(valor, max, etiqueta, articulo) {
  const texto = String(valor ?? '').trim();
  if (texto === '') return null;
  if (contieneCaracteresControl(texto)) return `${articulo} ${etiqueta} contiene caracteres no válidos.`;
  if (texto.length > max) return `${articulo} ${etiqueta} no puede superar los ${max} caracteres.`;
  return null;
}

/**
 * Nombre obligatorio (máximo 80 caracteres — CA-RF06-4).
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarNombre(valor, contexto = {}) {
  void contexto;
  return validarTextoObligatorio(valor, 80, 'nombre');
}

/**
 * Título obligatorio de promoción (máximo 100 caracteres — CA-RF07).
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarTitulo(valor, contexto = {}) {
  void contexto;
  return validarTextoObligatorio(valor, 100, 'título');
}

/**
 * Descripción opcional (máximo 300 caracteres — T27).
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarDescripcion(valor, contexto = {}) {
  void contexto;
  return validarTextoOpcionalConArticulo(valor, 300, 'descripción', 'La');
}

/**
 * Beneficio opcional de promoción (máximo 120 caracteres — T27).
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarBeneficio(valor, contexto = {}) {
  void contexto;
  return validarTextoOpcionalConArticulo(valor, 120, 'beneficio', 'El');
}
