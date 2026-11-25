/* =============================================================================
   Barbería Kraft — tests/ocupacion-logica.test.js
   TDD del bug 23502: el PATCH de sillas enviaba barbero_nombre: null.
   Cubre payloadOcuparSilla (pura) y payloadLiberarSilla (pura).
   ============================================================================= */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payloadOcuparSilla, payloadLiberarSilla } from '../pages/js/logica/ocupacion-logica.js';

const COLUMNAS_NOT_NULL = ['nombre', 'barbero_nombre', 'estado'];

test('CP-27: nombre válido → ok y barbero_nombre limpio en el payload', () => {
  const resultado = payloadOcuparSilla({ barberoNombre: 'Juan Pérez', nombreSilla: 'Silla 1' });
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.errores, []);
  assert.equal(resultado.payload.barbero_nombre, 'Juan Pérez');
  assert.equal(resultado.payload.estado, 'ocupada');
});

test('CP-28: nombre vacío → ok:false, sin payload (no se debe llamar a Supabase)', () => {
  const resultado = payloadOcuparSilla({ barberoNombre: '', nombreSilla: 'Silla 1' });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.payload, null);
  assert.ok(resultado.errores.length > 0);
});

test('nombre con solo espacios → error de validación', () => {
  const resultado = payloadOcuparSilla({ barberoNombre: '     ' });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.payload, null);
});

test('nombre null / undefined → error, nunca null en el payload', () => {
  assert.equal(payloadOcuparSilla({ barberoNombre: null }).ok, false);
  assert.equal(payloadOcuparSilla({ barberoNombre: undefined }).ok, false);
  assert.equal(payloadOcuparSilla().ok, false);
});

test('nombre con números: Juan123 se limpia a Juan', () => {
  const resultado = payloadOcuparSilla({ barberoNombre: 'Juan123' });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.payload.barbero_nombre, 'Juan');
});

test('números intercalados también se eliminan antes de validar', () => {
  const resultado = payloadOcuparSilla({ barberoNombre: 'A1B2C3' });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.payload.barbero_nombre, 'ABC');
});

test('acentos, ñ y ü se conservan', () => {
  const resultado = payloadOcuparSilla({ barberoNombre: 'José María Günter Ñuñoa' });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.payload.barbero_nombre, 'José María Günter Ñuñoa');
});

test('apóstrofo y guion simple son nombres válidos', () => {
  assert.equal(payloadOcuparSilla({ barberoNombre: "O'Connor" }).payload.barbero_nombre, "O'Connor");
  assert.equal(payloadOcuparSilla({ barberoNombre: 'Jean-Pierre' }).payload.barbero_nombre, 'Jean-Pierre');
});

test('doble/múltiple guion sin letras se rechaza', () => {
  for (const nombre of ['--', '---', '- -']) {
    const resultado = payloadOcuparSilla({ barberoNombre: nombre });
    assert.equal(resultado.ok, false, nombre);
    assert.equal(resultado.payload, null, nombre);
  }
});

test('doble guion dentro de un nombre con letras no produce null', () => {
  const resultado = payloadOcuparSilla({ barberoNombre: 'Ana--Luis' });
  assert.equal(resultado.ok, true);
  assert.notEqual(resultado.payload.barbero_nombre, null);
  assert.equal(resultado.payload.barbero_nombre.length > 0, true);
});

test('símbolos y números mezclados se limpian', () => {
  const resultado = payloadOcuparSilla({ barberoNombre: 'Ana#1$Luís!' });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.payload.barbero_nombre, 'AnaLuís');
});

test('el payload no contiene ningún valor null en columnas NOT NULL', () => {
  const { payload } = payloadOcuparSilla({ barberoNombre: 'Ana', nombreSilla: 'Silla 2' });
  for (const columna of COLUMNAS_NOT_NULL) {
    assert.ok(Object.hasOwn(payload, columna), columna);
    assert.notEqual(payload[columna], null, columna);
    assert.notEqual(payload[columna], '', columna);
  }
});

test('barbero_nombre nunca es null/vacío aunque el input tenga espacio final', () => {
  const { payload } = payloadOcuparSilla({ barberoNombre: '  Juan   ' });
  assert.equal(payload.barbero_nombre, 'Juan');
});

test('nombre (NOT NULL sin default) se envía solo si se conoce el valor real de la fila', () => {
  const conNombre = payloadOcuparSilla({ barberoNombre: 'Ana', nombreSilla: 'Silla 3' });
  assert.equal(conNombre.payload.nombre, 'Silla 3');
  const sinNombre = payloadOcuparSilla({ barberoNombre: 'Ana' });
  assert.equal(Object.hasOwn(sinNombre.payload, 'nombre'), false);
});

test('servicio_id nullable: null por defecto, conservado si se aporta', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  assert.equal(payloadOcuparSilla({ barberoNombre: 'Ana' }).payload.servicio_id, null);
  assert.equal(payloadOcuparSilla({ barberoNombre: 'Ana', servicioId: uuid }).payload.servicio_id, uuid);
});

test('ocupada_desde se recibe como parámetro (función pura, sin new Date interno)', () => {
  const iso = '2026-11-24T10:30:00.000Z';
  assert.equal(payloadOcuparSilla({ barberoNombre: 'Ana', ocupadaDesde: iso }).payload.ocupada_desde, iso);
  assert.equal(payloadOcuparSilla({ barberoNombre: 'Ana' }).payload.ocupada_desde, null);
});

test('clienteNombre no inventa columnas inexistentes en public.sillas', () => {
  const { payload } = payloadOcuparSilla({ barberoNombre: 'Ana', clienteNombre: 'Cliente X' });
  assert.equal(Object.hasOwn(payload, 'cliente_nombre'), false);
});

test('función pura: no muta la entrada y es determinista', () => {
  const entrada = Object.freeze({ barberoNombre: 'Juan123', nombreSilla: 'Silla 1' });
  const a = payloadOcuparSilla(entrada);
  const b = payloadOcuparSilla(entrada);
  assert.deepEqual(a, b);
  assert.deepEqual(entrada, { barberoNombre: 'Juan123', nombreSilla: 'Silla 1' });
});

test('liberar silla: barbero_nombre se limpia con cadena vacía, nunca null', () => {
  const { payload } = payloadLiberarSilla({ nombreSilla: 'Silla 1' });
  assert.equal(payload.estado, 'libre');
  assert.equal(payload.barbero_nombre, '');
  assert.equal(payload.servicio_id, null);
  assert.equal(payload.ocupada_desde, null);
  assert.equal(payload.nombre, 'Silla 1');
  for (const columna of COLUMNAS_NOT_NULL) {
    assert.notEqual(payload[columna], null, columna);
  }
});

test('liberar silla sin nombre conocido no sobreescribe la columna NOT NULL', () => {
  const { payload } = payloadLiberarSilla();
  assert.equal(Object.hasOwn(payload, 'nombre'), false);
  assert.equal(payload.barbero_nombre, '');
  assert.equal(payload.estado, 'libre');
});
