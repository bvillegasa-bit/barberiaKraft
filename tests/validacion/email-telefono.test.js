/* =============================================================================
   Barbería Kraft — tests/validacion/email-telefono.test.js (CP-V01..CP-V15)
   Pruebas TDD de las reglas de email y teléfono (SRP/LSP).
   Runner nativo node:test — SIN dependencias.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validarEmail } from '../../pages/js/validacion/reglas/email.js';
import { validarTelefono, sanearTelefono } from '../../pages/js/validacion/reglas/telefono.js';

const EMAIL_INVALIDO = 'Ingresa un correo electrónico válido (ej. nombre@correo.com).';

describe('regla email (CP-V01..CP-V08)', () => {
  test('CP-V01 acepta un email con formato correcto', () => {
    assert.equal(validarEmail('ana.torres@correo.com'), null);
    assert.equal(validarEmail('  usuario@dominio.pe  '), null);
  });

  test('CP-V02 rechaza email vacío', () => {
    assert.equal(validarEmail(''), 'Ingresa tu correo electrónico.');
    assert.equal(validarEmail('   '), 'Ingresa tu correo electrónico.');
    assert.equal(validarEmail(null), 'Ingresa tu correo electrónico.');
  });

  test('CP-V03 rechaza email sin @', () => {
    assert.equal(validarEmail('usuariocorreo.com'), EMAIL_INVALIDO);
  });

  test('CP-V04 rechaza email con dos @', () => {
    assert.equal(validarEmail('uno@dos@correo.com'), EMAIL_INVALIDO);
  });

  test('CP-V05 rechaza email sin TLD', () => {
    assert.equal(validarEmail('usuario@dominio'), EMAIL_INVALIDO);
    assert.equal(validarEmail('usuario@dominio.c'), EMAIL_INVALIDO);
  });

  test('CP-V06 rechaza email con espacios internos', () => {
    assert.equal(validarEmail('usu ario@correo.com'), 'El correo electrónico no puede contener espacios.');
  });

  test('CP-V07 rechaza email de más de 254 caracteres', () => {
    const largo = 'a'.repeat(250) + '@b.co';
    assert.equal(validarEmail(largo), 'El correo electrónico no puede superar los 254 caracteres.');
  });

  test('CP-V08 rechaza puntos consecutivos', () => {
    assert.equal(validarEmail('usuario..doble@correo.com'), EMAIL_INVALIDO);
    assert.equal(validarEmail('usuario@correo..com'), EMAIL_INVALIDO);
  });
});

describe('regla teléfono (CP-V09..CP-V15)', () => {
  test('CP-V09 acepta 9 dígitos exactos', () => {
    assert.equal(validarTelefono('999888777'), null);
    assert.equal(validarTelefono(999888777), null);
  });

  test('CP-V10 rechaza letras', () => {
    assert.equal(validarTelefono('99988877a'), 'El teléfono solo puede contener dígitos.');
  });

  test('CP-V11 rechaza espacios, guiones y prefijo +', () => {
    assert.equal(validarTelefono('999 888 777'), 'El teléfono solo puede contener dígitos.');
    assert.equal(validarTelefono('999-888-777'), 'El teléfono solo puede contener dígitos.');
    assert.equal(validarTelefono('+51999888777'), 'El teléfono solo puede contener dígitos.');
  });

  test('CP-V12 rechaza 8 dígitos (incompleto)', () => {
    assert.equal(validarTelefono('99988877'), 'El teléfono debe tener 9 dígitos.');
  });

  test('CP-V13 rechaza 10 dígitos', () => {
    assert.equal(validarTelefono('9998887771'), 'El teléfono no puede tener más de 9 dígitos.');
  });

  test('CP-V14 rechaza vacío porque el teléfono es obligatorio', () => {
    assert.equal(validarTelefono(''), 'El teléfono es obligatorio.');
    assert.equal(validarTelefono('   '), 'El teléfono es obligatorio.');
    assert.equal(validarTelefono(null), 'El teléfono es obligatorio.');
    assert.equal(validarTelefono(undefined), 'El teléfono es obligatorio.');
  });

  test('CP-V15 sanearTelefono elimina todo lo que no sea dígito', () => {
    assert.equal(sanearTelefono('999 888 777'), '999888777');
    assert.equal(sanearTelefono('(51) 999-888-777'), '51999888777');
    assert.equal(sanearTelefono('abc'), '');
    assert.equal(sanearTelefono(null), '');
  });
});
