/* =============================================================================
   Barbería Kraft — validacion/reglas/email.js
   -----------------------------------------------------------------------------
   SOLID · SRP: esta regla solo valida el formato del correo electrónico.
   SOLID · LSP: firma (valor, contexto) => string|null, sustituible por otra
   regla del registro.
   RNF03 / CA-RF03-7 — mensaje claro y genérico en español.
   ============================================================================= */

const MENSAJE_GENERICO = 'Ingresa un correo electrónico válido (ej. nombre@correo.com).';
const MENSAJE_CARACTERES = 'El correo electrónico contiene caracteres no permitidos.';

/**
 * Valida un correo electrónico.
 * Reglas: no vacío, sin espacios, exactamente un @, dominio con punto, TLD de
 * al menos 2 caracteres, máximo 254 caracteres y sin puntos consecutivos.
 *
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarEmail(valor, contexto = {}) {
  void contexto;
  const email = String(valor ?? '').trim();

  if (email === '') return 'Ingresa tu correo electrónico.';
  if (email.length > 254) return 'El correo electrónico no puede superar los 254 caracteres.';
  if (/\s/.test(email)) return 'El correo electrónico no puede contener espacios.';

  // Defensa en profundidad: rechaza caracteres de control (incluye byte nulo)
  // y emojis. Nunca lanza: devuelve un mensaje en español.
  if (/[\u0000-\u001F\u007F]/.test(email)) return MENSAJE_CARACTERES;
  if (/\p{Extended_Pictographic}/u.test(email)) return MENSAJE_CARACTERES;

  const partes = email.split('@');
  if (partes.length !== 2) return MENSAJE_GENERICO;

  const [local, dominio] = partes;
  if (local === '' || dominio === '') return MENSAJE_GENERICO;
  if (email.includes('..')) return MENSAJE_GENERICO;
  if (!dominio.includes('.')) return MENSAJE_GENERICO;

  const etiquetas = dominio.split('.');
  if (etiquetas.some((etiqueta) => etiqueta === '')) return MENSAJE_GENERICO;

  const tld = etiquetas[etiquetas.length - 1];
  if (tld.length < 2) return MENSAJE_GENERICO;

  return null;
}
