/* =============================================================================
   Barbería Kraft — nombre-input.js (efecto en vivo, lado módulo DOM)
   ---------------------------------------------------------------------------
   Aplica `limpiarNombre` (logica/quitar-numeros.js) mientras el usuario
   teclea en los campos de NOMBRE DE PERSONA, reemplazando el valor en el
   mismo evento `input` y conservando la posición aproximada del cursor.

   Delegación en `document` (un solo addEventListener, sin handlers inline):
   - cubre inputs creados dinámicamente (p. ej. "ocupar silla" del admin);
   - NO toca nombres de SERVICIO o promoción (ahí los números pueden ser
     legítimos): se excluye #servicio-nombre explícitamente.
   Campos cubiertos:
   - registro.html  → #nombre            (form #form-registro)
   - admin (sillas) → name="barbero_nombre"  (#ocupar-barbero-<n>)
   El maxlength del HTML se respeta: limpiar solo recorta, nunca alarga.
   ============================================================================= */

import { limpiarNombre } from './logica/quitar-numeros.js';

const SELECTOR_CAMPOS_NOMBRE = [
  'input[id="nombre"]',
  'input[name="nombre"]:not(#servicio-nombre)',
  'input[name="barbero_nombre"]'
].join(', ');

document.addEventListener('input', (evento) => {
  const campo = evento.target;
  if (!(campo instanceof HTMLInputElement)) return;
  if (!campo.matches(SELECTOR_CAMPOS_NOMBRE)) return;

  const valor = campo.value;
  const limpio = limpiarNombre(valor);
  if (limpio === valor) return;

  // Posición del cursor: prefijo común entre el valor original y el limpio.
  let prefijo = 0;
  const hasta = Math.min(valor.length, limpio.length);
  while (prefijo < hasta && valor[prefijo] === limpio[prefijo]) prefijo += 1;

  campo.value = limpio;
  if (typeof campo.setSelectionRange === 'function') {
    campo.setSelectionRange(prefijo, prefijo);
  }
});
