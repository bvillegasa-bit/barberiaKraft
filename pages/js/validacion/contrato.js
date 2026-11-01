/* =============================================================================
   Barbería Kraft — validacion/contrato.js (T27 · SOLID: DIP / ISP)
   -----------------------------------------------------------------------------
   Contrato único de la capa de validación. Ninguna regla conoce el DOM, los
   formularios ni Supabase: solo recibe un valor y devuelve null (válido) o un
   mensaje en español.

   Principios:
   - DIP: el motor y los formularios dependen de esta abstracción (Validador),
     no de implementaciones concretas.
   - ISP: la interfaz es mínima (una sola operación). Cualquier regla puede
     usarse sin arrastrar dependencias que no necesita.

   RNF03 / CA-RNF04-3 — mensajes claros y validación consistente en cliente.
   ============================================================================= */

/**
 * Contexto opcional que algunas reglas necesitan (p. ej. la confirmación de
 * contraseña recibe `password`). Siempre es un objeto plano.
 * @typedef {Object} ContextoValidacion
 * @property {string} [password] Contraseña original para comparar.
 * @property {number} [max] Longitud máxima para reglas de texto.
 * @property {boolean} [opcional] Permite vacío en reglas numéricas.
 */

/**
 * Contrato de un validador de campo.
 * Debe ser una función pura y sustituible (LSP):
 *   (valor, contexto) => string | null
 *
 * @callback Validador
 * @param {*} valor Valor actual del campo.
 * @param {ContextoValidacion} [contexto] Datos auxiliares de la validación.
 * @returns {string|null} null si es válido; mensaje en español si no lo es.
 */

/**
 * Indica si el resultado de un validador representa éxito.
 * @param {string|null|undefined} resultado
 * @returns {boolean}
 */
export function esValido(resultado) {
  return resultado === null || resultado === undefined;
}

/**
 * Indica si un mapa de errores no contiene ningún campo con error.
 * @param {Object<string, string>|null|undefined} errores
 * @returns {boolean}
 */
export function sinErrores(errores) {
  return !errores || Object.keys(errores).length === 0;
}
