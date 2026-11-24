/* =============================================================================
   Barbería Kraft — tests/quitar-numeros.test.js
   Pruebas de `limpiarNombre` (pages/js/logica/quitar-numeros.js).
   DECISIÓN DOCUMENTADA: se trimea el INICIO del texto; el NO-final NO se
   trimea (el usuario necesita el espacio temporal para teclear "Juan Pérez");
   la repetición de espacios internos SÍ se contractura (2+ → 1).
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpiarNombre } from '../pages/js/logica/quitar-numeros.js';

test('elimina dígitos al final del nombre', () => {
  assert.equal(limpiarNombre('Juan123'), 'Juan');
});

test('conserva acentos, ñ y ü intactos', () => {
  assert.equal(limpiarNombre('José María Günter Ñuñoa'), 'José María Günter Ñuñoa');
});

test('elimina dígitos intercalados entre letras', () => {
  assert.equal(limpiarNombre('A1B2C3'), 'ABC');
});

test('elimina símbolos no permitidos (puntas/símbolo #)', () => {
  assert.equal(limpiarNombre('Ana#1$Luís!'), 'AnaLuís');
});

test('null / undefined / números → cadena vacía (no explota)', () => {
  assert.equal(limpiarNombre(null), '');
  assert.equal(limpiarNombre(undefined), '');
  assert.equal(limpiarNombre(123), '');
  assert.equal(limpiarNombre({}), '');
});

test('cadena solo de espacios → cadena vacía (trim inicial + contractura)', () => {
  assert.equal(limpiarNombre('   '), '');
  assert.equal(limpiarNombre('\t\n  '), '');
});

test('trimea el INICIO (decisión conservadora)', () => {
  assert.equal(limpiarNombre('   x'), 'x');
  assert.equal(limpiarNombre('  Ana'), 'Ana');
});

test('NO trimea el final: permite teclear "Juan Pérez" con espacio guía', () => {
  assert.equal(limpiarNombre('Juan '), 'Juan ');
});

test('contractura espacios internos repetidos (2+ → 1)', () => {
  assert.equal(limpiarNombre('Juan   Pérez'), 'Juan Pérez');
  assert.equal(limpiarNombre('Juan\tPérez'), 'Juan Pérez');
});

test('conserva apóstrofe y guion (nombres compuestos)', () => {
  assert.equal(limpiarNombre("O'Connor"), "O'Connor");
  assert.equal(limpiarNombre('Jean-Pierre'), 'Jean-Pierre');
  assert.equal(limpiarNombre('Ana-3-Luis'), 'Ana-Luis');
});

test('mezcla: entrada sucia queda lista para validarNombre (sin números)', () => {
  assert.equal(limpiarNombre('  María Fe1rnández  '), 'María Fernández ');
  // Nota: el espacio final superviviente se conserva (decisión de no trim final);
  // validarNombre haría .trim() de todos modos antes de rechazar/aceptar.
});
