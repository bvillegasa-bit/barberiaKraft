/* =============================================================================
   Barbería Kraft - tests/volver-panel.test.js
   Pruebas unitarias de pages/js/logica/volver-panel-logica.js.
   Runner nativo de Node (node:test) + node:assert/strict — SIN dependencias.
   ============================================================================ */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { debeMostrarVolverPanel } from '../pages/js/logica/volver-panel-logica.js';

const SESION_ADMIN = { user: { id: 'u-admin', email: 'admin@kraft.pe' } };
const SESION_CLIENTE = { user: { id: 'u-cliente', email: 'cliente@kraft.pe' } };

describe('volver-panel-logica — visibilidad del enlace "← Volver al panel"', () => {
  test('VP-01 sin sesión y sin rol devuelve false', () => {
    assert.equal(debeMostrarVolverPanel(null, null), false);
  });

  test('VP-02 sesión nula aunque el rol sea admin devuelve false (fail-safe)', () => {
    assert.equal(debeMostrarVolverPanel(null, 'admin'), false);
  });

  test('VP-03 rol cliente devuelve false', () => {
    assert.equal(debeMostrarVolverPanel(SESION_CLIENTE, 'cliente'), false);
  });

  test('VP-04 rol admin con sesión activa devuelve true', () => {
    assert.equal(debeMostrarVolverPanel(SESION_ADMIN, 'admin'), true);
  });

  test('VP-05 sesión sin user (indeterminada) devuelve false', () => {
    assert.equal(debeMostrarVolverPanel({}, 'admin'), false);
  });
});
