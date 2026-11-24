/* =============================================================================
   Barbería Kraft — logica/quitar-numeros.js (lógica PURA)
   ---------------------------------------------------------------------------
   Supresión en vivo de dígitos y símbolos en campos de NOMBRE DE PERSONA.
   Complementa la regla `validarNombre` (que rechaza "El nombre no debe
   contener números.") limpiando el texto ANTES de validar.

   Compatibilidad con validarNombre (reglas/nombre.js): conserva exactamente
   el mismo juego de caracteres permitido — letras Unicode (\p{L}), marcas de
   acento (\p{M}), espacios, apóstrofes (' ’) y guiones (- ‐–—―). Excluye
   TODO lo demás: dígitos 0-9 (y cualquier símbolo), que ilegítimos en un
   nombre de persona.

   DECISIÓN DE TRIM (documentada): se trimea SOLO el INICIO del texto.
   NO se trimea el final ni se elimina el espacio aislado de una palabra:
   al teclear "Juan Pérez", el usuario necesita "Juan " (espacio final
   temporal) para poder escribir la segunda palabra. Solo se CONTRACTURA
   la repetition de espacios internos (2+ → 1).
   ============================================================================= */

/**
 * Caracteres permitidos en un nombre de persona. Todo lo demás se elimina.
 * Nota: el espacio tab/salto se conserva solo para contracturarlo después.
 * @type {RegExp}
 */
const PROHIBIDOS_EN_NOMBRE =
  /[^\p{L}\p{M}\u0020\u0009\u000A\u000D'’\u002D\u2010\u2011\u2012\u2013\u2014\u2015]/gu;

/**
 * Contratura de espacios en blanco (espacios, tabs, saltos) a UN espacio.
 * @type {RegExp}
 */
const BLANCO_REPETIDO = /\s+/g;

/**
 * Espacios al INICIO del texto (se eliminan; el final NO — ver decisión arriba).
 * @type {RegExp}
 */
const BLANCO_INICIAL = /^ +/;

const GUION_REPETIDO = /([-\u2010-\u2015])\1+/gu;

/**
 * Limpia el texto de un campo de nombre de persona:
 * - elimina TODOS los dígitos (0-9, incl. fullwidth) y símbolos no permitidos;
 * - conserva letras (con acentos, ñ, ü), espacios, apóstrofe y guion;
 * - contractura repetición de espacios en blanco (2+ → 1 solo espacio);
 * - trimea espacios del INICIO (no del final — permite teclear "Juan Pérez").
 * @param {*} texto Valor arbitrario del input (string|number|null|…).
 * @returns {string} Texto limpio; '' si no llega un string.
 */
export function limpiarNombre(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(PROHIBIDOS_EN_NOMBRE, '')
    .replace(BLANCO_REPETIDO, '\u0020')
    .replace(GUION_REPETIDO, '$1')
    .replace(BLANCO_INICIAL, '');
}
