/* =============================================================================
   Barbería Kraft — tests/validacion/correcciones-ciclo5.test.js
   -----------------------------------------------------------------------------
   Pruebas TDD (test-first) de las correcciones del Ciclo 5:
   - CP-V49 teléfono OBLIGATORIO (antes opcional).
   - CP-V50/51/52 nombre sin números, con letras acentuadas/ñ, espacios,
     apóstrofes y guiones; se rechazan cadenas solo de símbolos.
   - CP-V53 el checklist muestra "Mínimo 8 caracteres".

   Runner nativo node:test — SIN dependencias.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validarTelefono } from '../../pages/js/validacion/reglas/telefono.js';
import { validarNombre } from '../../pages/js/validacion/reglas/nombre.js';
import { estadoChecklistPassword } from '../../pages/js/validacion/checklist-password.js';

const TEL_OBLIGATORIO = 'El teléfono es obligatorio.';
const NOMBRE_NUMEROS = 'El nombre no debe contener números.';
const NOMBRE_CARACTERES = 'El nombre contiene caracteres no válidos.';
const TEXTO_VACIO = 'Este campo no puede estar vacío.';

describe('Ciclo 5 — regla teléfono obligatoria (CP-V49)', () => {
  test('CP-V49 vacío, nulo y solo espacios se rechazan', () => {
    assert.equal(validarTelefono(''), TEL_OBLIGATORIO);
    assert.equal(validarTelefono('   '), TEL_OBLIGATORIO);
    assert.equal(validarTelefono('\n\t'), TEL_OBLIGATORIO);
    assert.equal(validarTelefono(null), TEL_OBLIGATORIO);
    assert.equal(validarTelefono(undefined), TEL_OBLIGATORIO);
  });

  test('CP-V49 sigue aceptando exactamente 9 dígitos y rechazando el resto', () => {
    assert.equal(validarTelefono('999888777'), null);
    assert.equal(validarTelefono('99988877'), 'El teléfono debe tener 9 dígitos.');
    assert.equal(validarTelefono('9998887771'), 'El teléfono no puede tener más de 9 dígitos.');
    assert.equal(validarTelefono('999 888 777'), 'El teléfono solo puede contener dígitos.');
  });
});

describe('Ciclo 5 — regla nombre sin números (CP-V50..CP-V52)', () => {
  test('CP-V50 rechaza nombres con dígitos', () => {
    assert.equal(validarNombre('Juan123'), NOMBRE_NUMEROS);
    assert.equal(validarNombre('123'), NOMBRE_NUMEROS);
    assert.equal(validarNombre('Ana 2'), NOMBRE_NUMEROS);
    assert.equal(validarNombre('José María 3'), NOMBRE_NUMEROS);
  });

  test('CP-V51 acepta letras con acentos/ñ, espacios, apóstrofes y guiones', () => {
    for (const nombre of [
      'José María',
      "O'Connor",
      'Ana-Lucía',
      'María José Núñez',
      'D’Angelo',
      '  Ana  '
    ]) {
      assert.equal(validarNombre(nombre), null, nombre);
    }
  });

  test('CP-V52 rechaza cadenas solo de símbolos o espacios', () => {
    assert.equal(validarNombre('   '), TEXTO_VACIO);
    assert.equal(validarNombre('---'), NOMBRE_CARACTERES);
    assert.equal(validarNombre("''"), NOMBRE_CARACTERES);
    assert.equal(validarNombre("-' -"), NOMBRE_CARACTERES);
    assert.equal(validarNombre('😀'), NOMBRE_CARACTERES);
  });
});

describe('Ciclo 5 — checklist de contraseña (CP-V53)', () => {
  test('CP-V53 el requisito de longitud dice "Mínimo 8 caracteres"', () => {
    const longitud = estadoChecklistPassword('').find((item) => item.id === 'longitud');
    assert.equal(longitud.etiqueta, 'Mínimo 8 caracteres');
  });
});
