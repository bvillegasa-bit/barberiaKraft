/* =============================================================================
   Barbería Kraft — tests/validacion/checklist-presentador.test.js
   Pruebas TDD del checklist vivo de contraseña y del presentador nulo
   (SRP/DIP — CP-V44..CP-V48).
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { estadoChecklistPassword } from '../../pages/js/validacion/checklist-password.js';
import { presentadorNulo } from '../../pages/js/validacion/presentador-errores.js';

describe('checklist de contraseña (CP-V44..CP-V46)', () => {
  test('CP-V44 con contraseña vacía todos los requisitos están pendientes', () => {
    const estado = estadoChecklistPassword('');
    assert.equal(estado.length, 5);
    assert.deepEqual(
      estado.map((item) => item.id),
      ['longitud', 'mayuscula', 'minuscula', 'numero', 'especial']
    );
    assert.ok(estado.every((item) => item.cumple === false));
  });

  test('CP-V45 marca todos los requisitos con una contraseña fuerte', () => {
    const estado = estadoChecklistPassword('Kraft2026!');
    assert.ok(estado.every((item) => item.cumple === true));
    assert.ok(estado.every((item) => typeof item.etiqueta === 'string' && item.etiqueta.length > 0));
  });

  test('CP-V46 marca solo los requisitos cumplidos en una contraseña parcial', () => {
    const estado = estadoChecklistPassword('abcdefgh');
    const porId = Object.fromEntries(estado.map((item) => [item.id, item.cumple]));
    assert.equal(porId.longitud, true);
    assert.equal(porId.minuscula, true);
    assert.equal(porId.mayuscula, false);
    assert.equal(porId.numero, false);
    assert.equal(porId.especial, false);
  });
});

describe('presentador nulo (CP-V47..CP-V48)', () => {
  test('CP-V47 mostrar y limpiar no rompen sin DOM', () => {
    assert.doesNotThrow(() => presentadorNulo.mostrar(null, 'mensaje'));
    assert.doesNotThrow(() => presentadorNulo.limpiar(null));
    assert.equal(presentadorNulo.mostrar({}, 'mensaje'), undefined);
    assert.equal(presentadorNulo.limpiar({}), undefined);
  });

  test('CP-V48 tolera mensajes y elementos indefinidos', () => {
    assert.doesNotThrow(() => presentadorNulo.mostrar(undefined, undefined));
    assert.doesNotThrow(() => presentadorNulo.limpiar(undefined));
  });
});
