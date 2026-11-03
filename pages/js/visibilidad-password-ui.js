/* =============================================================================
   Barbería Kraft — visibilidad-password-ui.js
   -----------------------------------------------------------------------------
   Monta el botón mostrar/ocultar contraseña usando la lógica pura de
   logica/visibilidad-password.js. CSP estricto (pages/_headers): SIN handlers
   ni estilos inline; solo addEventListener y atributos ARIA.
   ============================================================================= */

import { alternarVisibilidad, etiquetaBoton } from './logica/visibilidad-password.js';

/**
 * Conecta un botón con su input de contraseña.
 * @param {HTMLButtonElement|null} boton
 * @param {HTMLInputElement|null} input
 * @returns {{ aplicar: (visible: boolean) => void }|null}
 */
export function iniciarTogglePassword(boton, input) {
  if (!boton || !input) return null;

  const aplicar = (visible) => {
    input.type = visible ? 'text' : 'password';
    boton.setAttribute('aria-pressed', String(visible));
    boton.setAttribute('aria-label', etiquetaBoton(visible));
    boton.textContent = visible ? 'Ocultar' : 'Mostrar';
  };

  aplicar(false);

  boton.addEventListener('click', () => {
    const siguiente = alternarVisibilidad(input.type);
    aplicar(siguiente === 'text');
  });

  return { aplicar };
}
