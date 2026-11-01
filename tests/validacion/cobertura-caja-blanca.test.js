/* =============================================================================
   Barbería Kraft — tests/validacion/cobertura-caja-blanca.test.js
   -----------------------------------------------------------------------------
   Pruebas de CAJA BLANCA de la capa de validación (T27 · SOLID).
   Objetivo: ejercitar RAMAS y CONDICIONES internas de cada regla y del motor:
   - entradas nulas, undefined, no-string, números, booleanos, objetos y arrays;
   - límites exactos (7/8 y 64/65 de contraseña; 254/255 de email; 8/9/10 del
     teléfono; 80/81, 100/101, 120/121 y 300/301 de textos);
   - orden de evaluación de reglas y de campos (`primero` respeta el mapa);
   - adaptadores de presentación sin DOM y checklist con entradas vacías.

   Ejecuta con `npm test` (node:test nativo, SIN dependencias).
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { esValido, sinErrores } from '../../pages/js/validacion/contrato.js';
import { validarEmail } from '../../pages/js/validacion/reglas/email.js';
import { validarTelefono, sanearTelefono } from '../../pages/js/validacion/reglas/telefono.js';
import {
  validarPassword,
  validarPasswordLogin,
  evaluarRequisitosPassword
} from '../../pages/js/validacion/reglas/password.js';
import { validarConfirmacion } from '../../pages/js/validacion/reglas/confirmacion.js';
import {
  validarNombre,
  validarTitulo,
  validarDescripcion,
  validarBeneficio
} from '../../pages/js/validacion/reglas/nombre.js';
import {
  validarPrecio,
  validarPrecioOpcional,
  validarEnteroPositivo
} from '../../pages/js/validacion/reglas/numero.js';
import {
  crearRegistro,
  registrarRegla,
  obtenerReglas,
  REGLAS_REGISTRO
} from '../../pages/js/validacion/registro-reglas.js';
import { validarCampo, validarFormulario } from '../../pages/js/validacion/validador-formulario.js';
import { presentadorDOM, presentadorNulo } from '../../pages/js/validacion/presentador-errores.js';
import { estadoChecklistPassword } from '../../pages/js/validacion/checklist-password.js';
import * as fachada from '../../pages/js/validacion/index.js';
import * as compatibilidad from '../../pages/js/validacion.js';

const EMAIL_GENERICO = 'Ingresa un correo electrónico válido (ej. nombre@correo.com).';
const EMAIL_CARACTERES = 'El correo electrónico contiene caracteres no permitidos.';
const EMAIL_LARGO = 'El correo electrónico no puede superar los 254 caracteres.';
const EMAIL_ESPACIOS = 'El correo electrónico no puede contener espacios.';
const EMAIL_VACIO = 'Ingresa tu correo electrónico.';

const TEL_DIGITOS = 'El teléfono solo puede contener dígitos.';
const TEL_LARGO = 'El teléfono no puede tener más de 9 dígitos.';
const TEL_CORTO = 'El teléfono debe tener 9 dígitos.';

const PASS_VACIA = 'Ingresa tu contraseña.';
const PASS_CORTA = 'La contraseña debe tener al menos 8 caracteres.';
const PASS_LARGA = 'La contraseña no puede superar los 64 caracteres.';
const PASS_MAYUS = 'La contraseña debe incluir al menos una mayúscula.';
const PASS_MINUS = 'La contraseña debe incluir al menos una minúscula.';
const PASS_NUMERO = 'La contraseña debe incluir al menos un número.';
const PASS_ESPECIAL = 'La contraseña debe incluir al menos un carácter especial.';

const CONFIRMA_VACIA = 'Confirma tu contraseña.';
const CONFIRMA_DISTINTA = 'Las contraseñas no coinciden.';

const TEXTO_VACIO = 'Este campo no puede estar vacío.';

describe('CAJA BLANCA · contrato (condiciones de éxito)', () => {
  test('CB-C01 esValido cubre null, undefined y valores no nulos', () => {
    assert.equal(esValido(null), true);
    assert.equal(esValido(undefined), true);
    assert.equal(esValido(''), false);
    assert.equal(esValido(0), false);
    assert.equal(esValido(false), false);
  });

  test('CB-C02 sinErrores cubre null, undefined, mapa vacío y mapa con error', () => {
    assert.equal(sinErrores(null), true);
    assert.equal(sinErrores(undefined), true);
    assert.equal(sinErrores({}), true);
    assert.equal(sinErrores({ email: EMAIL_GENERICO }), false);
  });
});

describe('CAJA BLANCA · regla email: entradas no-string y ramas internas', () => {
  test('CB-E01 valor vacío/null/undefined devuelve el mensaje de faltante', () => {
    assert.equal(validarEmail(''), EMAIL_VACIO);
    assert.equal(validarEmail('   '), EMAIL_VACIO);
    assert.equal(validarEmail(null), EMAIL_VACIO);
    assert.equal(validarEmail(undefined), EMAIL_VACIO);
  });

  test('CB-E02 números, booleanos, objetos y arrays no lanzan y se rechazan', () => {
    assert.equal(validarEmail(0), EMAIL_GENERICO);
    assert.equal(validarEmail(123), EMAIL_GENERICO);
    assert.equal(validarEmail(true), EMAIL_GENERICO);
    assert.equal(validarEmail(false), EMAIL_GENERICO);
    // String({}) === '[object Object]' contiene un espacio interior → gana la
    // rama de espacios; String([]) === '' → cae en la rama de valor vacío.
    assert.equal(validarEmail({}), EMAIL_ESPACIOS);
    assert.equal(validarEmail({ a: 1 }), EMAIL_ESPACIOS);
    assert.equal(validarEmail([]), EMAIL_VACIO);
    assert.equal(validarEmail([1, 2]), EMAIL_GENERICO);
    assert.equal(validarEmail(['ana@correo.com']), null);
  });

  test('CB-E03 límite exacto 254 válido y 255 rechazado', () => {
    const valido254 = 'a'.repeat(242) + '@' + 'b'.repeat(7) + '.com';
    assert.equal(valido254.length, 254);
    assert.equal(validarEmail(valido254), null);

    const invalido255 = 'a' + valido254;
    assert.equal(invalido255.length, 255);
    assert.equal(validarEmail(invalido255), EMAIL_LARGO);
  });

  test('CB-E04 recorta espacios antes y después', () => {
    assert.equal(validarEmail('  usuario@dominio.pe  '), null);
    assert.equal(validarEmail('\tusuario@dominio.pe\n'), null);
  });

  test('CB-E05 espacios internos y saltos de línea se rechazan', () => {
    assert.equal(validarEmail('usu ario@correo.com'), EMAIL_ESPACIOS);
    assert.equal(validarEmail('a\nb@correo.com'), EMAIL_ESPACIOS);
    assert.equal(validarEmail('a\tb@correo.com'), EMAIL_ESPACIOS);
  });

  test('CB-E06 exige exactamente un @, local y dominio no vacíos', () => {
    assert.equal(validarEmail('sin-arroba.com'), EMAIL_GENERICO);
    assert.equal(validarEmail('uno@dos@correo.com'), EMAIL_GENERICO);
    assert.equal(validarEmail('@correo.com'), EMAIL_GENERICO);
    assert.equal(validarEmail('usuario@'), EMAIL_GENERICO);
    assert.equal(validarEmail('usuario@dominio'), EMAIL_GENERICO);
  });

  test('CB-E07 dominio con punto, etiquetas no vacías y TLD de 2+ caracteres', () => {
    assert.equal(validarEmail('usuario@dominio.c'), EMAIL_GENERICO);
    assert.equal(validarEmail('usuario@.com'), EMAIL_GENERICO);
    assert.equal(validarEmail('usuario@dominio..com'), EMAIL_GENERICO);
    assert.equal(validarEmail('usuario@dominio.com.'), EMAIL_GENERICO);
    assert.equal(validarEmail('usuario@dominio.co'), null);
  });

  test('CB-E08 puntos consecutivos en local o dominio se rechazan', () => {
    assert.equal(validarEmail('usuario..doble@correo.com'), EMAIL_GENERICO);
    assert.equal(validarEmail('usuario@correo..com'), EMAIL_GENERICO);
  });

  test('CB-E09 unicode/acentos se aceptan; emojis y byte nulo se rechazan', () => {
    assert.equal(validarEmail('josé.núñez@correo.com'), null);
    assert.equal(validarEmail('😀@correo.com'), EMAIL_CARACTERES);
    assert.equal(validarEmail('a\u0000b@correo.com'), EMAIL_CARACTERES);
    assert.equal(validarEmail('a\u001fb@correo.com'), EMAIL_CARACTERES);
  });

  test('CB-E10 prioridad de mensajes: longitud > espacio > control > estructura', () => {
    // 255 caracteres (incluye un espacio interior, sin espacios exteriores que
    // el trim pueda recortar) → gana la rama de longitud.
    const largoConEspacios = 'a'.repeat(251) + ' bcd';
    assert.equal(largoConEspacios.length, 255);
    assert.equal(validarEmail(largoConEspacios), EMAIL_LARGO);

    // Longitud correcta + espacio + byte nulo → gana la rama de espacio.
    assert.equal(validarEmail('a\u0000 b@correo.com'), EMAIL_ESPACIOS);

    // Sin espacios pero con byte nulo y estructura inválida → gana control.
    assert.equal(validarEmail('a\u0000b'), EMAIL_CARACTERES);

    // Emoji antes que cualquier problema estructural → gana caracteres.
    assert.equal(validarEmail('😀sin-arroba'), EMAIL_CARACTERES);
  });
});

describe('CAJA BLANCA · regla teléfono: ramas y límites 8/9/10', () => {
  test('CB-T01 vacío/null/undefined sigue siendo válido (campo opcional)', () => {
    assert.equal(validarTelefono(''), null);
    assert.equal(validarTelefono('   '), null);
    assert.equal(validarTelefono(null), null);
    assert.equal(validarTelefono(undefined), null);
  });

  test('CB-T02 números, booleanos, objetos y arrays no lanzan', () => {
    assert.equal(validarTelefono(999888777), null);
    assert.equal(validarTelefono(true), TEL_DIGITOS);
    assert.equal(validarTelefono(false), TEL_DIGITOS);
    assert.equal(validarTelefono({}), TEL_DIGITOS);
    // String([999888777]) === '999888777' → el array de un solo número se
    // convierte a texto y resulta válido (documentado).
    assert.equal(validarTelefono([999888777]), null);
    assert.equal(validarTelefono([1, 2]), TEL_DIGITOS);
    assert.equal(validarTelefono([9998887771]), TEL_LARGO);
  });

  test('CB-T03 límites exactos 8, 9 y 10 dígitos', () => {
    assert.equal(validarTelefono('99988877'), TEL_CORTO);
    assert.equal(validarTelefono('999888777'), null);
    assert.equal(validarTelefono('9998887771'), TEL_LARGO);
  });

  test('CB-T04 primero se exige "solo dígitos": mezcla con letras/símbolos gana', () => {
    assert.equal(validarTelefono('9998887a'), TEL_DIGITOS);
    assert.equal(validarTelefono('99988877a'), TEL_DIGITOS);
    assert.equal(validarTelefono('999888777a'), TEL_DIGITOS);
    assert.equal(validarTelefono('999 888 777'), TEL_DIGITOS);
    assert.equal(validarTelefono('+51999888777'), TEL_DIGITOS);
  });

  test('CB-T05 recorta espacios exteriores antes de contar', () => {
    assert.equal(validarTelefono(' 999888777 '), null);
    assert.equal(validarTelefono('\n999888777\t'), null);
  });

  test('CB-T06 unicode, acentos y emojis se rechazan como no numéricos', () => {
    assert.equal(validarTelefono('９９９８８８７７７'), TEL_DIGITOS);
    assert.equal(validarTelefono('número'), TEL_DIGITOS);
    assert.equal(validarTelefono('999😀777'), TEL_DIGITOS);
  });

  test('CB-T07 sanearTelefono neutraliza cualquier entrada no numérica', () => {
    assert.equal(sanearTelefono('999 888 777'), '999888777');
    assert.equal(sanearTelefono('(51) 999-888-777'), '51999888777');
    assert.equal(sanearTelefono('abc'), '');
    assert.equal(sanearTelefono(null), '');
    assert.equal(sanearTelefono(undefined), '');
    assert.equal(sanearTelefono(999888777), '999888777');
    assert.equal(sanearTelefono(true), '');
    assert.equal(sanearTelefono({}), '');
    assert.equal(sanearTelefono('😀1ñ2'), '12');
  });

  test('CB-T08 prioridad de mensajes y mezcla exacta en los límites', () => {
    // No numérico gana antes que la longitud, incluso con 10 caracteres.
    assert.equal(validarTelefono('9998887770a'), TEL_DIGITOS);
    assert.equal(validarTelefono('a99988877'), TEL_DIGITOS);

    // 8 dígitos + 1 letra = 9 caracteres, pero no es numérico.
    assert.equal(validarTelefono('99988877a'), TEL_DIGITOS);

    // 8 dígitos con un espacio interior → no numérico.
    assert.equal(validarTelefono('9998 8877'), TEL_DIGITOS);

    // Espacios exteriores no cuentan para el límite.
    assert.equal(validarTelefono('  9998887771  '), TEL_LARGO);
    assert.equal(validarTelefono('  99988877  '), TEL_CORTO);
  });
});

describe('CAJA BLANCA · regla password: orden de mensajes y límites 7/8, 64/65', () => {
  test('CB-P01 entradas nulas/no-string devuelven mensaje sin lanzar', () => {
    assert.equal(validarPassword(''), PASS_VACIA);
    assert.equal(validarPassword(null), PASS_VACIA);
    assert.equal(validarPassword(undefined), PASS_VACIA);
    assert.equal(validarPassword(12345678), PASS_MAYUS);
    assert.equal(validarPassword(true), PASS_CORTA);
    assert.equal(validarPassword({}), PASS_NUMERO);
    assert.equal(validarPassword([]), PASS_VACIA);
  });

  test('CB-P02 límite 7 rechazado y 8 aceptado', () => {
    assert.equal(validarPassword('Abcde1!'), PASS_CORTA);
    assert.equal(validarPassword('Abcdef1!'), null);
  });

  test('CB-P03 límite 64 aceptado y 65 rechazado', () => {
    const largo64 = 'Ab1!' + 'a'.repeat(60);
    assert.equal(largo64.length, 64);
    assert.equal(validarPassword(largo64), null);

    const largo65 = 'Ab1!' + 'a'.repeat(61);
    assert.equal(largo65.length, 65);
    assert.equal(validarPassword(largo65), PASS_LARGA);
  });

  test('CB-P04 orden de evaluación: mayúscula antes que minúscula/número/especial', () => {
    assert.equal(validarPassword('abcdefgh'), PASS_MAYUS);
    assert.equal(validarPassword('ABCDEFGH'), PASS_MINUS);
    assert.equal(validarPassword('Abcdefgh'), PASS_NUMERO);
    assert.equal(validarPassword('Abcdefg1'), PASS_ESPECIAL);
  });

  test('CB-P05 unicode y acentos: solo A-Z cuenta como mayúscula (documentado)', () => {
    assert.equal(validarPassword('Ábcdef1!'), PASS_MAYUS);
    assert.equal(validarPassword('Abcdef1!ñ'), null);
    assert.equal(validarPassword('Abcdef1!😀'), null);
  });

  test('CB-P06 login: vacío, nulo, >64 y contraseñas débiles', () => {
    assert.equal(validarPasswordLogin(''), PASS_VACIA);
    assert.equal(validarPasswordLogin(null), PASS_VACIA);
    assert.equal(validarPasswordLogin(undefined), PASS_VACIA);
    assert.equal(validarPasswordLogin('a'.repeat(64)), null);
    assert.equal(validarPasswordLogin('a'.repeat(65)), PASS_LARGA);
    assert.equal(validarPasswordLogin('abcdefgh'), null);
  });

  test('CB-P07 checklist evalúa las 5 ramas de requisitos', () => {
    const ids = evaluarRequisitosPassword('Kraft2026!').map((item) => item.id);
    assert.deepEqual(ids, ['longitud', 'mayuscula', 'minuscula', 'numero', 'especial']);
    assert.ok(evaluarRequisitosPassword('Kraft2026!').every((item) => item.cumple));
    assert.ok(evaluarRequisitosPassword('').every((item) => item.cumple === false));
  });

  test('CB-P08 los espacios NO se recortan en la contraseña (comparación literal)', () => {
    // 7 espacios → corta (no vacía y no alcanza el mínimo).
    assert.equal(validarPassword('       '), PASS_CORTA);
    // 8 espacios → cumple longitud, pero no tiene mayúscula.
    assert.equal(validarPassword('        '), PASS_MAYUS);
    // Espacios interiores cuentan como longitud y como carácter especial.
    assert.equal(validarPassword('Ab 1!xyz'), null);
    assert.equal(validarPassword(' Abcdef1'), null);
    assert.equal(validarPassword('Abcdef1 '), null);
    // Al superar 64 con espacios también se rechaza.
    assert.equal(validarPassword('Ab1!' + ' '.repeat(61)), PASS_LARGA);
  });

  test('CB-P09 login tolera números, booleanos, objetos y arrays sin lanzar', () => {
    assert.equal(validarPasswordLogin(12345678), null);
    assert.equal(validarPasswordLogin(true), null);
    assert.equal(validarPasswordLogin({}), null);
    assert.equal(validarPasswordLogin([1, 2]), null);
    assert.doesNotThrow(() => validarPasswordLogin(Symbol('x')));
  });
});

describe('CAJA BLANCA · regla confirmación: comparación exacta y contexto nulo', () => {
  test('CB-F01 valor vacío/nulo devuelve "Confirma tu contraseña."', () => {
    assert.equal(validarConfirmacion('', { password: 'Kraft2026!' }), CONFIRMA_VACIA);
    assert.equal(validarConfirmacion('   ', { password: 'Kraft2026!' }), CONFIRMA_VACIA);
    assert.equal(validarConfirmacion(null, { password: 'Kraft2026!' }), CONFIRMA_VACIA);
    assert.equal(validarConfirmacion(undefined, { password: 'Kraft2026!' }), CONFIRMA_VACIA);
  });

  test('CB-F02 coincidencia exacta y diferencia por espacios finales', () => {
    assert.equal(validarConfirmacion('Kraft2026!', { password: 'Kraft2026!' }), null);
    assert.equal(validarConfirmacion('Kraft2026! ', { password: 'Kraft2026!' }), CONFIRMA_DISTINTA);
    assert.equal(validarConfirmacion(' Kraft2026!', { password: 'Kraft2026!' }), CONFIRMA_DISTINTA);
  });

  test('CB-F03 números, booleanos y objetos se comparan como texto sin lanzar', () => {
    assert.equal(validarConfirmacion(123, { password: '123' }), null);
    assert.equal(validarConfirmacion(true, { password: 'true' }), null);
    assert.equal(validarConfirmacion({}, { password: '[object Object]' }), null);
    assert.equal(validarConfirmacion({}, { password: 'otra' }), CONFIRMA_DISTINTA);
  });

  test('CB-F04 contexto undefined/null no lanza y se trata como contraseña vacía', () => {
    assert.equal(validarConfirmacion('algo', undefined), CONFIRMA_DISTINTA);
    assert.equal(validarConfirmacion('', undefined), CONFIRMA_VACIA);
    assert.doesNotThrow(() => validarConfirmacion('algo', null));
    assert.equal(validarConfirmacion('algo', null), CONFIRMA_DISTINTA);
    assert.equal(validarConfirmacion('', null), CONFIRMA_VACIA);
  });

  test('CB-F05 arrays y objetos con contexto vacío no lanzan', () => {
    assert.equal(validarConfirmacion([], {}), CONFIRMA_VACIA);
    assert.equal(validarConfirmacion([1], {}), CONFIRMA_DISTINTA);
    assert.equal(validarConfirmacion({}, {}), CONFIRMA_DISTINTA);
    // Contexto con password no-string se convierte a texto.
    assert.equal(validarConfirmacion(123, { password: 123 }), null);
  });
});

describe('CAJA BLANCA · reglas de texto: límites y caracteres de control', () => {
  test('CB-N01 nombre: nulos, espacios y límite 80/81', () => {
    assert.equal(validarNombre(''), TEXTO_VACIO);
    assert.equal(validarNombre('   '), TEXTO_VACIO);
    assert.equal(validarNombre(null), TEXTO_VACIO);
    assert.equal(validarNombre(undefined), TEXTO_VACIO);
    assert.equal(validarNombre('a'.repeat(80)), null);
    assert.equal(validarNombre('a'.repeat(81)), 'El nombre no puede superar los 80 caracteres.');
  });

  test('CB-N02 nombre: números, booleanos, objetos y unicode se convierten a texto', () => {
    assert.equal(validarNombre(123), null);
    assert.equal(validarNombre(true), null);
    assert.equal(validarNombre({}), null);
    assert.equal(validarNombre('José Núñez'), null);
    assert.equal(validarNombre('  Ana  '), null);
    assert.equal(validarNombre('😀'), null);
  });

  test('CB-N03 nombre: byte nulo y saltos internos se rechazan', () => {
    assert.equal(validarNombre('a\u0000b'), 'El nombre contiene caracteres no válidos.');
    assert.equal(validarNombre('a\nb'), 'El nombre contiene caracteres no válidos.');
  });

  test('CB-N04 título: límite 100/101', () => {
    assert.equal(validarTitulo('a'.repeat(100)), null);
    assert.equal(validarTitulo('a'.repeat(101)), 'El título no puede superar los 100 caracteres.');
    assert.equal(validarTitulo(null), TEXTO_VACIO);
  });

  test('CB-N05 descripción: opcional, límite 300/301 y control', () => {
    assert.equal(validarDescripcion(''), null);
    assert.equal(validarDescripcion(null), null);
    assert.equal(validarDescripcion('a'.repeat(300)), null);
    assert.equal(validarDescripcion('a'.repeat(301)), 'La descripción no puede superar los 300 caracteres.');
    assert.equal(validarDescripcion('a\u0000b'), 'La descripción contiene caracteres no válidos.');
  });

  test('CB-N06 beneficio: opcional, límite 120/121 y control', () => {
    assert.equal(validarBeneficio(''), null);
    assert.equal(validarBeneficio(null), null);
    assert.equal(validarBeneficio('a'.repeat(120)), null);
    assert.equal(validarBeneficio('a'.repeat(121)), 'El beneficio no puede superar los 120 caracteres.');
    assert.equal(validarBeneficio('a\u0000b'), 'El beneficio contiene caracteres no válidos.');
  });

  test('CB-N07 título/descripción/beneficio con números, booleanos, objetos y arrays', () => {
    // Título (obligatorio): cualquier valor truthy se convierte a texto.
    assert.equal(validarTitulo(123), null);
    assert.equal(validarTitulo(true), null);
    assert.equal(validarTitulo({}), null);
    assert.equal(validarTitulo([]), TEXTO_VACIO);
    assert.equal(validarTitulo([2026]), null);

    // Descripción y beneficio (opcionales): vacío lógico → null; contenido → null.
    assert.equal(validarDescripcion(false), null);
    assert.equal(validarDescripcion(0), null);
    assert.equal(validarDescripcion({}), null);
    assert.equal(validarDescripcion([1, 2]), null);
    assert.equal(validarBeneficio(false), null);
    assert.equal(validarBeneficio(0), null);
    assert.equal(validarBeneficio({}), null);
    assert.equal(validarBeneficio([1, 2]), null);
  });
});

describe('CAJA BLANCA · reglas numéricas: tipos, NaN, infinito y límites', () => {
  test('CB-NU01 precio: faltantes y tipos no numéricos', () => {
    assert.equal(validarPrecio(''), 'Ingresa el precio.');
    assert.equal(validarPrecio(null), 'Ingresa el precio.');
    assert.equal(validarPrecio(undefined), 'Ingresa el precio.');
    assert.equal(validarPrecio(true), 'El precio debe ser un número.');
    assert.equal(validarPrecio(false), 'El precio debe ser un número.');
    assert.equal(validarPrecio({}), 'El precio debe ser un número.');
    assert.equal(validarPrecio([]), 'El precio debe ser un número.');
    assert.equal(validarPrecio('abc'), 'El precio debe ser un número.');
  });

  test('CB-NU02 precio: NaN, Infinity, cero y negativos', () => {
    assert.equal(validarPrecio(NaN), 'El precio debe ser un número.');
    assert.equal(validarPrecio(Infinity), 'El precio debe ser un número válido.');
    assert.equal(validarPrecio('Infinity'), 'El precio debe ser un número válido.');
    assert.equal(validarPrecio('0'), 'El precio debe ser mayor a 0.');
    assert.equal(validarPrecio('-1'), 'El precio debe ser mayor a 0.');
    assert.equal(validarPrecio('   '), 'El precio debe ser mayor a 0.');
  });

  test('CB-NU03 precio: valores válidos (string y number)', () => {
    assert.equal(validarPrecio('0.01'), null);
    assert.equal(validarPrecio(10), null);
    assert.equal(validarPrecio('1e3'), null);
  });

  test('CB-NU04 precio opcional: vacío válido; no vacío delega', () => {
    assert.equal(validarPrecioOpcional(''), null);
    assert.equal(validarPrecioOpcional(null), null);
    assert.equal(validarPrecioOpcional(undefined), null);
    assert.equal(validarPrecioOpcional('0'), 'El precio debe ser mayor a 0.');
    assert.equal(validarPrecioOpcional('abc'), 'El precio debe ser un número.');
  });

  test('CB-NU05 entero positivo: faltantes, tipos y decimales', () => {
    assert.equal(validarEnteroPositivo(''), 'Ingresa un valor.');
    assert.equal(validarEnteroPositivo(null), 'Ingresa un valor.');
    assert.equal(validarEnteroPositivo(undefined), 'Ingresa un valor.');
    assert.equal(validarEnteroPositivo(true), 'Debe ser un número entero.');
    assert.equal(validarEnteroPositivo({}), 'Debe ser un número entero.');
    assert.equal(validarEnteroPositivo('abc'), 'Debe ser un número entero.');
    assert.equal(validarEnteroPositivo('1.5'), 'Debe ser un número entero.');
    assert.equal(validarEnteroPositivo(Infinity), 'Debe ser un número entero.');
  });

  test('CB-NU06 entero positivo: cero/negativo rechazados y positivos aceptados', () => {
    assert.equal(validarEnteroPositivo('0'), 'Debe ser mayor a 0.');
    assert.equal(validarEnteroPositivo('-3'), 'Debe ser mayor a 0.');
    assert.equal(validarEnteroPositivo('1'), null);
    assert.equal(validarEnteroPositivo(30), null);
  });

  test('CB-NU07 precio opcional y entero con booleanos, objetos, arrays y unicode', () => {
    // Precio opcional: true/false/objetos/arrays delegan a validarPrecio.
    assert.equal(validarPrecioOpcional(true), 'El precio debe ser un número.');
    assert.equal(validarPrecioOpcional(false), 'El precio debe ser un número.');
    assert.equal(validarPrecioOpcional({}), 'El precio debe ser un número.');
    assert.equal(validarPrecioOpcional([]), 'El precio debe ser un número.');
    assert.equal(validarPrecioOpcional(Infinity), 'El precio debe ser un número válido.');
    assert.equal(validarPrecioOpcional('😀'), 'El precio debe ser un número.');

    // Entero positivo: booleanos/objetos/arrays no lanzan.
    assert.equal(validarEnteroPositivo(false), 'Debe ser un número entero.');
    assert.equal(validarEnteroPositivo([]), 'Debe ser un número entero.');
    assert.equal(validarEnteroPositivo([5]), 'Debe ser un número entero.');
    assert.equal(validarEnteroPositivo('😀'), 'Debe ser un número entero.');
  });
});

describe('CAJA BLANCA · registro de reglas (OCP) y motor (orden/primero)', () => {
  test('CB-R01 crearRegistro tolera null, valores no-array y clona los arrays', () => {
    assert.deepEqual(crearRegistro(null), {});
    assert.deepEqual(crearRegistro({ a: null, b: 'x', c: [validarEmail] }), {
      a: [],
      b: [],
      c: [validarEmail]
    });

    const original = { email: [validarEmail] };
    const mapa = crearRegistro(original);
    mapa.email.push(() => 'extra');
    assert.equal(original.email.length, 1);
    assert.equal(mapa.email.length, 2);
  });

  test('CB-R02 registrarRegla ignora mapa/campo inválidos y funciones no válidas', () => {
    assert.equal(registrarRegla(null, 'x', validarEmail), null);
    assert.deepEqual(registrarRegla({}, '', validarEmail), {});
    assert.deepEqual(registrarRegla({}, 123, validarEmail), {});

    const mapa = {};
    registrarRegla(mapa, 'codigo', 'no-funcion', validarEmail, null);
    assert.equal(mapa.codigo.length, 1);
    assert.equal(mapa.codigo[0], validarEmail);
  });

  test('CB-R03 obtenerReglas cubre mapa nulo, campo ausente y campo presente', () => {
    assert.deepEqual(obtenerReglas(null, 'email'), []);
    assert.deepEqual(obtenerReglas({}, 'email'), []);
    assert.deepEqual(obtenerReglas({ email: [validarEmail] }, 'email'), [validarEmail]);
  });

  test('CB-R04 validarCampo usa reglas inyectadas y respeta su orden', () => {
    const llamadas = [];
    const reglaA = () => {
      llamadas.push('A');
      return 'Error A';
    };
    const reglaB = () => {
      llamadas.push('B');
      return 'Error B';
    };

    assert.equal(validarCampo('x', 'valor', {}, [reglaA, reglaB], {}), 'Error A');
    assert.deepEqual(llamadas, ['A']);
    assert.equal(validarCampo('x', 'valor', {}, [], {}), null);
    assert.equal(validarCampo('desconocido', 'valor', {}, null, {}), null);
    assert.equal(validarCampo('email', 'ana@correo.com', {}, null, null), null);
  });

  test('CB-R05 validarFormulario respeta el orden del mapa, no el de los datos', () => {
    const mapa = crearRegistro({
      segundo: [() => 'Falla segundo'],
      primero: [() => 'Falla primero'],
      valido: [() => null]
    });

    const resultado = validarFormulario(
      { primero: 'x', segundo: 'y', valido: 'z' },
      mapa
    );

    assert.equal(resultado.ok, false);
    assert.equal(resultado.primero, 'segundo');
    assert.deepEqual(Object.keys(resultado.errores), ['segundo', 'primero']);
  });

  test('CB-R06 validarFormulario tolera datos/mapa nulos y mapas vacíos', () => {
    const sinDatos = validarFormulario(null, crearRegistro({ nombre: [validarNombre] }));
    assert.equal(sinDatos.ok, false);
    assert.equal(sinDatos.primero, 'nombre');

    const sinMapa = validarFormulario({ nombre: 'Ana' }, null);
    assert.deepEqual(sinMapa, { ok: true, errores: {}, primero: null });

    const vacio = validarFormulario({}, {});
    assert.deepEqual(vacio, { ok: true, errores: {}, primero: null });
  });

  test('CB-R07 formulario completo del registro: mensajes y primer campo', () => {
    const resultado = validarFormulario(
      {
        nombre: '',
        email: 'sin-arroba',
        password: 'corta',
        confirmar_password: 'otra',
        telefono: '999'
      },
      REGLAS_REGISTRO,
      { password: 'corta' }
    );

    assert.equal(resultado.ok, false);
    assert.equal(resultado.primero, 'nombre');
    assert.equal(resultado.errores.nombre, TEXTO_VACIO);
    assert.equal(resultado.errores.email, EMAIL_GENERICO);
    assert.equal(resultado.errores.password, PASS_CORTA);
    assert.equal(resultado.errores.confirmar_password, CONFIRMA_DISTINTA);
    assert.equal(resultado.errores.telefono, TEL_CORTO);
  });
});

describe('CAJA BLANCA · presentadores y checklist con entradas vacías', () => {
  test('CB-PR01 presentadorNulo nunca lanza (null, undefined, objetos y primitivos)', () => {
    assert.equal(presentadorNulo.mostrar(), undefined);
    assert.equal(presentadorNulo.mostrar(null, null), undefined);
    assert.equal(presentadorNulo.mostrar(undefined, undefined), undefined);
    assert.equal(presentadorNulo.mostrar({}, 'x'), undefined);
    assert.equal(presentadorNulo.mostrar('texto', 123), undefined);
    assert.equal(presentadorNulo.limpiar(), undefined);
    assert.equal(presentadorNulo.limpiar(null), undefined);
    assert.equal(presentadorNulo.limpiar({}), undefined);
  });

  test('CB-PR02 presentadorDOM tolera elementos nulos/falsy (rama de guarda)', () => {
    assert.doesNotThrow(() => presentadorDOM.mostrar(null, 'x'));
    assert.doesNotThrow(() => presentadorDOM.mostrar(undefined, 'x'));
    assert.doesNotThrow(() => presentadorDOM.limpiar(null));
    assert.doesNotThrow(() => presentadorDOM.limpiar(undefined));
  });

  test('CB-PR03 presentadorDOM delega a ui.js y retorna sin DOM (rama real)', () => {
    // Elemento mínimo: closest() devuelve null → ui.js sale antes de tocar el DOM.
    const elementoFalso = { closest: () => null };
    assert.doesNotThrow(() => presentadorDOM.mostrar(elementoFalso, 'mensaje'));
    assert.doesNotThrow(() => presentadorDOM.limpiar(elementoFalso));
  });

  test('CB-CL01 checklist con vacíos/null/undefined: 5 requisitos pendientes', () => {
    for (const valor of ['', null, undefined]) {
      const estado = estadoChecklistPassword(valor);
      assert.equal(estado.length, 5);
      assert.ok(estado.every((item) => item.cumple === false));
    }
  });

  test('CB-CL02 checklist con no-string no lanza y devuelve booleanos', () => {
    for (const valor of [0, 1, true, false, {}, []]) {
      const estado = estadoChecklistPassword(valor);
      assert.equal(estado.length, 5);
      assert.ok(estado.every((item) => typeof item.cumple === 'boolean'));
    }
    const conCero = estadoChecklistPassword(0);
    assert.equal(conCero.find((item) => item.id === 'numero').cumple, true);
  });

  test('CB-CL03 cada llamada devuelve objetos nuevos (sin estado compartido)', () => {
    const a = estadoChecklistPassword('Kraft2026!');
    const b = estadoChecklistPassword('Kraft2026!');
    assert.notEqual(a, b);
    assert.notEqual(a[0], b[0]);
  });
});

describe('CAJA BLANCA · fachadas pública y de compatibilidad', () => {
  test('CB-FA01 index.js expone todo el contrato público', () => {
    const funciones = [
      'esValido',
      'sinErrores',
      'validarEmail',
      'validarTelefono',
      'sanearTelefono',
      'evaluarRequisitosPassword',
      'validarPassword',
      'validarPasswordLogin',
      'validarConfirmacion',
      'validarNombre',
      'validarTitulo',
      'validarDescripcion',
      'validarBeneficio',
      'validarPrecio',
      'validarPrecioOpcional',
      'validarEnteroPositivo',
      'crearRegistro',
      'registrarRegla',
      'obtenerReglas',
      'validarCampo',
      'validarFormulario',
      'estadoChecklistPassword'
    ];
    for (const nombre of funciones) {
      assert.equal(typeof fachada[nombre], 'function', nombre);
    }
    assert.equal(typeof fachada.presentadorDOM.mostrar, 'function');
    assert.equal(typeof fachada.presentadorNulo.limpiar, 'function');
    assert.equal(Object.keys(fachada.REGLAS_REGISTRO).length, 5);
  });

  test('CB-FA02 validacion.js mantiene los exports históricos', () => {
    assert.equal(compatibilidad.validarEmail, fachada.validarEmail);
    assert.equal(compatibilidad.validarPasswordLogin, fachada.validarPasswordLogin);
    assert.equal(compatibilidad.validarFormulario, fachada.validarFormulario);
    assert.equal(compatibilidad.presentadorDOM, fachada.presentadorDOM);
  });
});
