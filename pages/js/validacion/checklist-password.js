/* =============================================================================
   Barbería Kraft — validacion/checklist-password.js (T27)
   -----------------------------------------------------------------------------
   SOLID · SRP: transforma los requisitos de contraseña en estado visual
   (`{ id, etiqueta, cumple }`). No toca el DOM: la página decide cómo pintarlo.
   ============================================================================= */

import { evaluarRequisitosPassword } from './reglas/password.js';

/**
 * Devuelve el estado de cada requisito de la contraseña para el checklist vivo.
 * @param {*} valor Texto actual del input de contraseña.
 * @returns {Array<{id: string, etiqueta: string, cumple: boolean}>}
 */
export function estadoChecklistPassword(valor) {
  return evaluarRequisitosPassword(valor);
}
