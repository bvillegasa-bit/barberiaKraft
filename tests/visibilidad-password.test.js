/* =============================================================================
   Barbería Kraft — tests/visibilidad-password.test.js (CP-V54)
   -----------------------------------------------------------------------------
   Pruebas de la lógica PURA del botón mostrar/ocultar contraseña.
   Sin DOM ni Supabase: node:test + node:assert/strict.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  alternarVisibilidad,
  etiquetaBoton
} from '../pages/js/logica/visibilidad-password.js';

describe('visibilidad-password (CP-V54) — alternar y etiquetar', () => {
  test('CP-V54 alterna password → text → password', () => {
    assert.equal(alternarVisibilidad('password'), 'text');
    assert.equal(alternarVisibilidad('text'), 'password');
    assert.equal(alternarVisibilidad(alternarVisibilidad('password')), 'password');
  });

  test('CP-V54 un tipo ausente o inválido vuelve a ocultar (fail-safe)', () => {
    assert.equal(alternarVisibilidad(undefined), 'password');
    assert.equal(alternarVisibilidad(null), 'password');
    assert.equal(alternarVisibilidad(''), 'password');
    assert.equal(alternarVisibilidad('PASSWORD'), 'password');
  });

  test('CP-V54 la etiqueta accesible cambia entre Mostrar/Ocultar', () => {
    assert.equal(etiquetaBoton(false), 'Mostrar contraseña');
    assert.equal(etiquetaBoton(true), 'Ocultar contraseña');
  });
});
