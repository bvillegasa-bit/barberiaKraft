/* =============================================================================
   Barbería Kraft — tests/validacion/seguridad-inputs.test.js
   -----------------------------------------------------------------------------
   Pruebas de SEGURIDAD de entradas adversariales sobre la capa de validación
   (T27 · SOLID). Objetivo:
   - garantizar que NINGUNA regla lanza una excepción con cargas maliciosas;
   - verificar que los campos estructurados (email, teléfono, contraseña,
     precio, enteros) RECHAZAN la carga con un mensaje en español;
   - documentar que los campos de texto libre aceptan la carga como texto
     plano y que la neutralización final ocurre al renderizar (escape/atributos),
     no mutilando el dato del usuario;
   - comprobar que `sanearTelefono` neutraliza por lista blanca de dígitos.

   Payloads: XSS, inyección SQL, path traversal, codificaciones (`%00`), byte
   nulo, saltos de línea, tabs, emojis y cadena de 10.000 caracteres.

   Ejecuta con `npm test` (node:test nativo, SIN dependencias).
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validarEmail } from '../../pages/js/validacion/reglas/email.js';
import { validarTelefono, sanearTelefono } from '../../pages/js/validacion/reglas/telefono.js';
import { validarPassword } from '../../pages/js/validacion/reglas/password.js';
import {
  validarNombre,
  validarTitulo,
  validarDescripcion,
  validarBeneficio
} from '../../pages/js/validacion/reglas/nombre.js';
import { validarPrecio, validarEnteroPositivo } from '../../pages/js/validacion/reglas/numero.js';

const XSS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "'><svg/onload=alert(1)>",
  'javascript:alert(1)',
  '<a href="javascript:alert(1)">x</a>'
];

const SQL = [
  "'; DROP TABLE clientes;--",
  "' OR 1=1 --",
  "admin'--",
  "1; EXEC xp_cmdshell('dir')"
];

const TRAVERSAL = [
  '../../etc/passwd',
  '..\\..\\windows\\win.ini',
  '%2e%2e%2fetc%2fpasswd',
  '/etc/passwd'
];

const EXTRA = ['%00', '\u0000', 'linea1\nlinea2', 'a\r\nb', '😀😀😀', 'x'.repeat(10000), '\t\t'];

const PAYLOADS = [...XSS, ...SQL, ...TRAVERSAL, ...EXTRA];

/**
 * Verifica el contrato de mensajes: string, no vacío, sin HTML y en español
 * (inicia con mayúscula y contiene letras acentuadas o palabras del dominio).
 */
function assertMensajeEspanol(resultado, contexto) {
  assert.equal(typeof resultado, 'string', `${contexto}: debía devolver un mensaje string`);
  assert.ok(resultado.length > 0, `${contexto}: el mensaje está vacío`);
  assert.match(resultado, /^[A-ZÁÉÍÓÚÑ]/, `${contexto}: el mensaje debe iniciar en mayúscula`);
  assert.doesNotMatch(resultado, /[<>]/, `${contexto}: el mensaje no debe contener HTML`);
  assert.doesNotMatch(resultado, /\u0000/, `${contexto}: el mensaje no debe contener byte nulo`);
  assert.match(
    resultado,
    /(contrase|correo|tel[eé]fono|precio|n[uú]mero|caracteres|campo|nombre|t[ií]tulo|descripci[oó]n|beneficio|v[aá]lid|mayor|entero|valor|ingresa)/i,
    `${contexto}: el mensaje debe estar en español y describir el campo`
  );
}

function sinLanzar(fn, contexto) {
  try {
    return fn();
  } catch (error) {
    assert.fail(`${contexto}: lanzó una excepción (${error.message})`);
  }
}

function probarRechazos(payloads, validar, contexto) {
  for (const carga of payloads) {
    const resultado = sinLanzar(
      () => validar(carga),
      `${contexto}: no debe lanzar con ${JSON.stringify(carga.slice(0, 40))}`
    );
    assertMensajeEspanol(resultado, `${contexto} ${JSON.stringify(carga.slice(0, 40))}`);
  }
}

describe('SEGURIDAD · email rechaza XSS, SQL, traversal y codificaciones', () => {
  test('SG-E01 todos los payloads se rechazan sin lanzar y con mensaje español', () => {
    probarRechazos(PAYLOADS, validarEmail, 'validarEmail');
  });

  test('SG-E02 ningún mensaje reemite la carga maliciosa', () => {
    for (const carga of PAYLOADS) {
      const mensaje = validarEmail(carga);
      assert.ok(mensaje === null || !mensaje.includes('<script>'), 'SG-E02 no debe reflejar el payload');
      assert.ok(mensaje === null || !mensaje.includes('DROP TABLE'), 'SG-E02 no debe reflejar el payload');
    }
  });
});

describe('SEGURIDAD · teléfono rechaza todo lo no numérico', () => {
  test('SG-T01 payloads no numéricos se rechazan; solo tabs/vacío son válidos', () => {
    probarRechazos(PAYLOADS.filter((carga) => carga !== '\t\t'), validarTelefono, 'validarTelefono');
    assert.equal(validarTelefono('\t\t'), null, 'SG-T01 los tabs se recortan y el campo es opcional');
  });

  test('SG-T02 sanearTelefono neutraliza por lista blanca de dígitos', () => {
    for (const carga of [...XSS, ...SQL, ...TRAVERSAL, '%00', '\u0000', '\n', '😀']) {
      const soloDigitos = carga.replace(/[^0-9]/g, '');
      assert.equal(
        sanearTelefono(carga),
        soloDigitos,
        `SG-T02 debía conservar solo dígitos de ${JSON.stringify(carga)}`
      );
    }
    assert.equal(sanearTelefono('999<script>888</script>777'), '999888777');
    assert.equal(sanearTelefono('999\u0000888'), '999888');
    assert.equal(sanearTelefono('../../etc/passwd999888777'), '999888777');
  });
});

describe('SEGURIDAD · contraseña rechaza payloads largos o inválidos', () => {
  // "1; EXEC xp_cmdshell('dir')" cumple mayúscula+minúscula+número+especial y
  // 8+ caracteres, por lo que la POLÍTICA lo acepta como contraseña. No es un
  // riesgo de inyección: la contraseña nunca se renderiza ni se concatena en
  // HTML/SQL (Supabase la hashea).
  const PAYLOADS_PASSWORD = PAYLOADS.filter((carga) => carga !== "1; EXEC xp_cmdshell('dir')");

  test('SG-P01 payloads inválidos se rechazan sin lanzar y con mensaje español', () => {
    probarRechazos(PAYLOADS_PASSWORD, validarPassword, 'validarPassword');
  });

  test('SG-P02 una cadena fuerte con forma de inyección se acepta sin lanzar (no se renderiza)', () => {
    assert.equal(validarPassword("1; EXEC xp_cmdshell('dir')"), null);
    assert.doesNotThrow(() => validarPassword('\' OR 1=1 --Abc1!'), 'SG-P02 no debe lanzar');
  });
});

describe('SEGURIDAD · textos libres: no lanzan y no se mutilan', () => {
  test('SG-N01 nombre/título/descripción/beneficio aceptan XSS como texto plano', () => {
    for (const carga of [...XSS, ...SQL, ...TRAVERSAL, '%00', '😀😀😀']) {
      for (const validar of [validarNombre, validarTitulo, validarDescripcion, validarBeneficio]) {
        assert.doesNotThrow(() => validar(carga), `SG-N01 no debe lanzar con ${JSON.stringify(carga)}`);
      }
    }
    assert.equal(validarNombre('<script>alert(1)</script>'), null);
    assert.equal(validarDescripcion('"><img src=x onerror=alert(1)>'), null);
  });

  test('SG-N02 caracteres de control y límites sí se rechazan con mensaje español', () => {
    const control = ['linea1\nlinea2', 'a\r\nb', '\u0000', 'a\u001fb', 'x'.repeat(10000)];
    for (const carga of control) {
      for (const validar of [validarNombre, validarTitulo, validarDescripcion, validarBeneficio]) {
        const resultado = sinLanzar(() => validar(carga), 'SG-N02 no debe lanzar');
        assertMensajeEspanol(resultado, 'SG-N02 texto de control');
      }
    }
  });
});

describe('SEGURIDAD · reglas numéricas rechazan payloads sin lanzar', () => {
  test('SG-NU01 precio y entero positivo rechazan toda carga con mensaje español', () => {
    for (const carga of PAYLOADS) {
      const precio = sinLanzar(() => validarPrecio(carga), 'SG-NU01 precio no debe lanzar');
      assertMensajeEspanol(precio, `SG-NU01 precio ${JSON.stringify(carga.slice(0, 40))}`);
      const entero = sinLanzar(() => validarEnteroPositivo(carga), 'SG-NU01 entero no debe lanzar');
      assertMensajeEspanol(entero, `SG-NU01 entero ${JSON.stringify(carga.slice(0, 40))}`);
    }
  });
});
