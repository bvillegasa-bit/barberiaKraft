/* =============================================================================
   Barbería Kraft — validacion.js (T13)
   Validadores de formulario con mensajes en español (RNF03, CA-RF06-4).
   Cada validador devuelve null si es válido o un mensaje de error en español.
   ============================================================================= */

/** Email con formato razonable (ej. usuario@dominio.tld) */
export function validarEmail(valor) {
  const email = String(valor ?? '').trim();
  if (email === '') return 'Ingresa tu correo electrónico.';
  // Regex simple pero práctica: algo@algo.algo
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!regex.test(email)) return 'Ingresa un correo electrónico válido (ej. nombre@correo.com).';
  return null;
}

/** Contraseña con mínimo 8 caracteres (CA-RF03-1) */
export function validarPassword(valor) {
  const pass = String(valor ?? '');
  if (pass === '') return 'Ingresa tu contraseña.';
  if (pass.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  return null;
}

/** Precio numérico estrictamente mayor a 0 (CA-RF06-4) */
export function validarPrecio(valor) {
  if (valor === '' || valor === null || valor === undefined) return 'Ingresa el precio.';
  const numero = Number(valor);
  if (Number.isNaN(numero)) return 'El precio debe ser un número.';
  if (numero <= 0) return 'El precio debe ser mayor a 0.';
  return null;
}

/** Nombre no vacío (CA-RF06-4) */
export function validarNombre(valor) {
  const nombre = String(valor ?? '').trim();
  if (nombre === '') return 'Este campo no puede estar vacío.';
  return null;
}

/** Título no vacío (promociones — CA-RF07) */
export function validarTitulo(valor) {
  return validarNombre(valor);
}

/** Entero positivo (duración en minutos, etc.) */
export function validarEnteroPositivo(valor) {
  if (valor === '' || valor === null || valor === undefined) return 'Ingresa un valor.';
  const numero = Number(valor);
  if (Number.isNaN(numero) || !Number.isInteger(numero)) return 'Debe ser un número entero.';
  if (numero <= 0) return 'Debe ser mayor a 0.';
  return null;
}