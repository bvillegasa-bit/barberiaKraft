/* =============================================================================
   Barbería Kraft — tests/validacion/validador-formulario.test.js
   Pruebas TDD del motor de validación (DIP), contrato y OCP (CP-V30..CP-V33,
   CP-V39..CP-V43).
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { esValido, sinErrores } from '../../pages/js/validacion/contrato.js';
import {
  crearRegistro,
  registrarRegla,
  REGLAS_REGISTRO,
  REGLAS_LOGIN,
  REGLAS_SERVICIO,
  REGLAS_PROMOCION
} from '../../pages/js/validacion/registro-reglas.js';
import { validarFormulario } from '../../pages/js/validacion/validador-formulario.js';
import { validarEmail } from '../../pages/js/validacion/reglas/email.js';
import { validarNombre, validarTitulo, validarDescripcion } from '../../pages/js/validacion/reglas/nombre.js';

describe('contrato de validadores (CP-V39)', () => {
  test('CP-V39 esValido y sinErrores interpretan null como éxito', () => {
    assert.equal(esValido(null), true);
    assert.equal(esValido('error'), false);
    assert.equal(sinErrores({}), true);
    assert.equal(sinErrores({ email: 'Ingresa tu correo electrónico.' }), false);
  });
});

describe('validador de formulario (CP-V30..CP-V33)', () => {
  test('CP-V30 agrega errores por campo y devuelve el primero en orden del registro', () => {
    const resultado = validarFormulario(
      {
        nombre: '',
        email: 'sin-arroba',
        password: 'Abcdef1!',
        confirmar_password: 'Abcdef1!',
        telefono: '999888777'
      },
      REGLAS_REGISTRO
    );

    assert.equal(resultado.ok, false);
    assert.equal(resultado.errores.nombre, 'Este campo no puede estar vacío.');
    assert.equal(resultado.errores.email, 'Ingresa un correo electrónico válido (ej. nombre@correo.com).');
    assert.equal(resultado.errores.password, undefined);
    assert.equal(resultado.primero, 'nombre');
  });

  test('CP-V31 devuelve ok=true y primero=null cuando todo es válido', () => {
    const resultado = validarFormulario(
      {
        nombre: 'Ana Torres',
        email: 'ana@correo.com',
        password: 'Kraft2026!',
        confirmar_password: 'Kraft2026!',
        telefono: '999888777'
      },
      REGLAS_REGISTRO,
      { password: 'Kraft2026!' }
    );

    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.errores, {});
    assert.equal(resultado.primero, null);
  });

  test('CP-V32 recibe el contexto (password) para validar la confirmación', () => {
    const resultado = validarFormulario(
      {
        password: 'Kraft2026!',
        confirmar_password: 'Kraft2027!'
      },
      { password: REGLAS_REGISTRO.password, confirmar_password: REGLAS_REGISTRO.confirmar_password },
      { password: 'Kraft2026!' }
    );

    assert.equal(resultado.ok, false);
    assert.equal(resultado.errores.confirmar_password, 'Las contraseñas no coinciden.');
    assert.equal(resultado.primero, 'confirmar_password');
  });

  test('CP-V33 OCP: registrar una regla nueva no exige modificar el motor', () => {
    const mapa = crearRegistro({ email: [validarEmail] });
    registrarRegla(mapa, 'codigo', (valor) => (String(valor ?? '').trim() === '' ? 'Ingresa el código.' : null));

    const resultado = validarFormulario({ email: 'ana@correo.com', codigo: '' }, mapa);

    assert.equal(resultado.ok, false);
    assert.equal(resultado.errores.codigo, 'Ingresa el código.');
    assert.equal(resultado.primero, 'codigo');
  });

  test('CP-V34 login solo valida email y contraseña, sin fortaleza ni confirmación', () => {
    assert.deepEqual(Object.keys(REGLAS_LOGIN), ['email', 'password']);
    const resultado = validarFormulario(
      { email: 'ana@correo.com', password: 'abcdefgh' },
      REGLAS_LOGIN
    );
    assert.equal(resultado.ok, true);
  });
});

describe('longitudes de campos de texto (CP-V40..CP-V43)', () => {
  test('CP-V40 nombre admite hasta 80 caracteres', () => {
    assert.equal(validarNombre('a'.repeat(80)), null);
    assert.equal(validarNombre('a'.repeat(81)), 'El nombre no puede superar los 80 caracteres.');
  });

  test('CP-V41 título admite hasta 100 caracteres', () => {
    assert.equal(validarTitulo('a'.repeat(100)), null);
    assert.equal(validarTitulo('a'.repeat(101)), 'El título no puede superar los 100 caracteres.');
  });

  test('CP-V42 descripción es opcional y admite hasta 300 caracteres', () => {
    assert.equal(validarDescripcion(''), null);
    assert.equal(validarDescripcion('a'.repeat(300)), null);
    assert.equal(validarDescripcion('a'.repeat(301)), 'La descripción no puede superar los 300 caracteres.');
  });

  test('CP-V43 los registros de admin conservan los campos esperados', () => {
    assert.deepEqual(Object.keys(REGLAS_SERVICIO), ['nombre', 'precio', 'duracion', 'descripcion']);
    assert.deepEqual(Object.keys(REGLAS_PROMOCION), ['titulo', 'oferta', 'beneficio', 'descripcion']);
  });
});
