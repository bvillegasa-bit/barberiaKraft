/* =============================================================================
   Barbería Kraft — validacion/presentador-errores.js (T27)
   -----------------------------------------------------------------------------
   SOLID · DIP / ISP: el motor de validación no conoce el DOM. La presentación
   se resuelve con un adaptador de interfaz mínima:
     mostrar(campoElemento, mensaje) · limpiar(campoElemento)

   Implementaciones:
   - presentadorDOM  → usa mostrarErrorCampo/limpiarErrorCampo de ui.js.
   - presentadorNulo → no hace nada (tests, entornos sin DOM).
   ============================================================================= */

import { mostrarErrorCampo, limpiarErrorCampo } from '../ui.js';

/** Adaptador real: pinta el error accesible junto al campo. */
export const presentadorDOM = {
  /**
   * @param {HTMLElement} campoElemento
   * @param {string} mensaje
   */
  mostrar(campoElemento, mensaje) {
    if (campoElemento) mostrarErrorCampo(campoElemento, mensaje);
  },

  /**
   * @param {HTMLElement} campoElemento
   */
  limpiar(campoElemento) {
    if (campoElemento) limpiarErrorCampo(campoElemento);
  }
};

/** Adaptador nulo: cumple la interfaz sin tocar el DOM (tests). */
export const presentadorNulo = {
  mostrar() {},
  limpiar() {}
};
