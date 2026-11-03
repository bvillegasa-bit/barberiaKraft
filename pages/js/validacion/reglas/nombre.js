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

/* Letras Unicode (acentos/ñ incluidas), espacios, apóstrofes y guiones.
   Se excluyen dígitos, símbolos y puntuación no permitida en un nombre. */
const NOMBRE_PERMITIDO = /^[\p{L}\p{M}\s'’\-]+$/u;
const NOMBRE_CON_LETRA = /\p{L}/u;
const NOMBRE_CON_NUMERO = /[0-9]/;

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
 * - No admite números (mensaje específico).
 * - Solo letras (con acentos/ñ), espacios, apóstrofes y guiones.
 * - Rechaza cadenas formadas solo por símbolos o espacios.
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarNombre(valor, contexto = {}) {
  void contexto;
  const texto = String(valor ?? '').trim();

  if (texto === '') return 'Este campo no puede estar vacío.';
  if (contieneCaracteresControl(texto)) return 'El nombre contiene caracteres no válidos.';
  if (texto.length > 80) return 'El nombre no puede superar los 80 caracteres.';
  if (NOMBRE_CON_NUMERO.test(texto)) return 'El nombre no debe contener números.';
  if (!NOMBRE_PERMITIDO.test(texto) || !NOMBRE_CON_LETRA.test(texto)) {
    return 'El nombre contiene caracteres no válidos.';
  }
  return null;
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
