/* =============================================================================
   Barbería Kraft — validacion/validador-formulario.js (T27)
   -----------------------------------------------------------------------------
   SOLID · SRP: este módulo SOLO ejecuta reglas y agrega resultados. No conoce el
   DOM, ui.js, Supabase ni los textos concretos de cada regla.
   SOLID · DIP: las reglas se INYECTAN (parámetro `mapaReglas` /
   `reglasDelCampo`). Por defecto usa el registro de cliente, pero cualquier
   mapa compatible es válido.
   ============================================================================= */

import { REGLAS_REGISTRO, obtenerReglas } from './registro-reglas.js';

/**
 * Ejecuta las reglas de un campo en orden y devuelve el primer error.
 * @param {string} campo Nombre lógico del campo (clave del registro).
 * @param {*} valor Valor actual.
 * @param {import('./contrato.js').ContextoValidacion} [contexto]
 * @param {import('./contrato.js').Validador[]|null} [reglasDelCampo] Reglas inyectadas.
 * @param {Object<string, import('./contrato.js').Validador[]>} [mapaReglas]
 * @returns {string|null}
 */
export function validarCampo(
  campo,
  valor,
  contexto = {},
  reglasDelCampo = null,
  mapaReglas = REGLAS_REGISTRO
) {
  const reglas = Array.isArray(reglasDelCampo)
    ? reglasDelCampo
    : obtenerReglas(mapaReglas, campo);

  for (const regla of reglas) {
    const mensaje = regla(valor, contexto);
    if (mensaje) return mensaje;
  }
  return null;
}

/**
 * Valida un formulario completo.
 * @param {Object<string, *>} [datos] Valores por campo.
 * @param {Object<string, import('./contrato.js').Validador[]>} [mapaReglas]
 * @param {import('./contrato.js').ContextoValidacion} [contexto]
 * @returns {{ok: boolean, errores: Object<string, string>, primero: string|null}}
 *   `primero` es el nombre del primer campo con error (orden del mapa), útil
 *   para enfocar el input; null cuando todo es válido.
 */
export function validarFormulario(datos = {}, mapaReglas = REGLAS_REGISTRO, contexto = {}) {
  const errores = {};
  // Tolerancia a entradas nulas: el motor nunca lanza por datos o mapas mal formados.
  const valores = datos && typeof datos === 'object' ? datos : {};
  const mapa = mapaReglas && typeof mapaReglas === 'object' ? mapaReglas : {};
  const campos = Object.keys(mapa);

  for (const campo of campos) {
    const mensaje = validarCampo(campo, valores[campo], contexto, null, mapa);
    if (mensaje) errores[campo] = mensaje;
  }

  const primero = campos.find((campo) => Boolean(errores[campo])) ?? null;
  return { ok: primero === null, errores, primero };
}
