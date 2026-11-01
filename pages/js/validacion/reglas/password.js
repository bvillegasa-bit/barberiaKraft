/* =============================================================================
   Barbería Kraft — validacion/reglas/password.js
   -----------------------------------------------------------------------------
   SOLID · SRP: concentra únicamente las reglas de contraseña.
   SOLID · LSP: expone validadores con la firma común (valor, contexto).
   RF03 / CA-RF03-1: mínimo 8 caracteres.
   T27: fortaleza obligatoria en registro (mayúscula, minúscula, número,
   carácter especial) y máximo 64. El LOGIN solo exige no vacía y ≤64.
   ============================================================================= */

const MAX_LONGITUD = 64;

/**
 * Requisitos visibles del checklist de contraseña (RF03 · T27).
 * Cada entrada es pura: `probar` recibe el texto y devuelve boolean.
 * @type {Array<{id: string, etiqueta: string, probar: (valor: string) => boolean}>}
 */
export const REQUISITOS_PASSWORD = [
  { id: 'longitud', etiqueta: 'Mínimo 8 caracteres', probar: (valor) => valor.length >= 8 },
  { id: 'mayuscula', etiqueta: 'Una mayúscula', probar: (valor) => /[A-Z]/.test(valor) },
  { id: 'minuscula', etiqueta: 'Una minúscula', probar: (valor) => /[a-z]/.test(valor) },
  { id: 'numero', etiqueta: 'Un número', probar: (valor) => /[0-9]/.test(valor) },
  { id: 'especial', etiqueta: 'Un carácter especial', probar: (valor) => /[^A-Za-z0-9]/.test(valor) }
];

/**
 * Evalúa cada requisito de fortaleza. Lo consume el checklist en vivo.
 * @param {*} valor
 * @returns {Array<{id: string, etiqueta: string, cumple: boolean}>}
 */
export function evaluarRequisitosPassword(valor) {
  const password = String(valor ?? '');
  return REQUISITOS_PASSWORD.map(({ id, etiqueta, probar }) => ({
    id,
    etiqueta,
    cumple: probar(password)
  }));
}

/**
 * Valida la fortaleza de la contraseña en el REGISTRO.
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarPassword(valor, contexto = {}) {
  void contexto;
  const password = String(valor ?? '');

  if (password === '') return 'Ingresa tu contraseña.';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password.length > MAX_LONGITUD) return 'La contraseña no puede superar los 64 caracteres.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una mayúscula.';
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir al menos una minúscula.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'La contraseña debe incluir al menos un carácter especial.';

  return null;
}

/**
 * Valida la contraseña en el LOGIN: NO exige fortaleza ni confirmación.
 * Solo no vacía y máximo 64 (RF04 / T27).
 * @param {*} valor
 * @param {import('../contrato.js').ContextoValidacion} [contexto] No se usa.
 * @returns {string|null}
 */
export function validarPasswordLogin(valor, contexto = {}) {
  void contexto;
  const password = String(valor ?? '');

  if (password === '') return 'Ingresa tu contraseña.';
  if (password.length > MAX_LONGITUD) return 'La contraseña no puede superar los 64 caracteres.';

  return null;
}
