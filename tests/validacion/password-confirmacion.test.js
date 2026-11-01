/* =============================================================================
   Barbería Kraft — tests/validacion/password-confirmacion.test.js
   Pruebas TDD de fortaleza de contraseña, login y confirmación (CP-V16..CP-V29).
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  validarPassword,
  validarPasswordLogin
} from '../../pages/js/validacion/reglas/password.js';
import { validarConfirmacion } from '../../pages/js/validacion/reglas/confirmacion.js';

describe('regla password de registro (CP-V16..CP-V22)', () => {
  test('CP-V16 acepta contraseña que cumple todos los requisitos', () => {
    assert.equal(validarPassword('Kraft2026!'), null);
    assert.equal(validarPassword('Abcdef1!'), null);
  });

  test('CP-V17 rechaza contraseña sin mayúscula', () => {
    assert.equal(validarPassword('kraft2026!'), 'La contraseña debe incluir al menos una mayúscula.');
  });

  test('CP-V18 rechaza contraseña sin minúscula', () => {
    assert.equal(validarPassword('KRAFT2026!'), 'La contraseña debe incluir al menos una minúscula.');
  });

  test('CP-V19 rechaza contraseña sin número', () => {
    assert.equal(validarPassword('KraftPassword!'), 'La contraseña debe incluir al menos un número.');
  });

  test('CP-V20 rechaza contraseña sin carácter especial', () => {
    assert.equal(validarPassword('Kraft2026'), 'La contraseña debe incluir al menos un carácter especial.');
  });

  test('CP-V21 rechaza contraseña más corta que 8', () => {
    assert.equal(validarPassword('Ab1!'), 'La contraseña debe tener al menos 8 caracteres.');
    assert.equal(validarPassword(''), 'Ingresa tu contraseña.');
  });

  test('CP-V22 rechaza contraseña de más de 64 caracteres', () => {
    const larga = 'A1!' + 'a'.repeat(62);
    assert.equal(validarPassword(larga), 'La contraseña no puede superar los 64 caracteres.');
  });
});

describe('regla password de login (CP-V23..CP-V25)', () => {
  test('CP-V23 rechaza contraseña vacía', () => {
    assert.equal(validarPasswordLogin(''), 'Ingresa tu contraseña.');
  });

  test('CP-V24 rechaza contraseña de más de 64 caracteres', () => {
    assert.equal(
      validarPasswordLogin('a'.repeat(65)),
      'La contraseña no puede superar los 64 caracteres.'
    );
  });

  test('CP-V25 login NO exige fortaleza (solo no vacía y máximo 64)', () => {
    assert.equal(validarPasswordLogin('abcdefgh'), null);
    assert.equal(validarPasswordLogin('sinmayusculas1'), null);
  });
});

describe('regla confirmación (CP-V26..CP-V29)', () => {
  test('CP-V26 acepta cuando ambas contraseñas coinciden', () => {
    assert.equal(validarConfirmacion('Kraft2026!', { password: 'Kraft2026!' }), null);
  });

  test('CP-V27 rechaza cuando no coinciden', () => {
    assert.equal(
      validarConfirmacion('Kraft2026!', { password: 'Kraft2027!' }),
      'Las contraseñas no coinciden.'
    );
  });

  test('CP-V28 los espacios finales cuentan como diferencia', () => {
    assert.equal(
      validarConfirmacion('Kraft2026! ', { password: 'Kraft2026!' }),
      'Las contraseñas no coinciden.'
    );
  });

  test('CP-V29 exige escribir la confirmación', () => {
    assert.equal(validarConfirmacion('', { password: 'Kraft2026!' }), 'Confirma tu contraseña.');
    assert.equal(validarConfirmacion('   ', { password: 'Kraft2026!' }), 'Confirma tu contraseña.');
  });
});
