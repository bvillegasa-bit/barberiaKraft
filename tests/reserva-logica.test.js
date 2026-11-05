/* =============================================================================
   Barberia Kraft - tests/reserva-logica.test.js (Ciclo 6)
   -----------------------------------------------------------------------------
   Pruebas unitarias de validacion, payload y estados de una reserva.
   Runner nativo de Node (node:test) + node:assert/strict - SIN DOM ni Supabase.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  validarReserva,
  construirPayloadReserva,
  estadoReserva,
  puedeCancelar
} from '../pages/js/logica/reserva-logica.js';

const RESERVA_VALIDA = {
  servicioId: 's-corte',
  fecha: '2026-11-10',
  hora: '10:00',
  nombre: 'Ana Torres',
  telefono: '999111222'
};

const SERVICIO = {
  id: 's-corte',
  nombre: 'Corte clasico',
  duracion_min: 45,
  precio: 35.5
};

describe('reserva-logica - validacion', () => {
  test('CP-R01 reserva completa y valida devuelve ok sin errores', () => {
    const resultado = validarReserva(RESERVA_VALIDA);
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.errores, {});
  });

  test('CP-R02 todos los campos son obligatorios', () => {
    const resultado = validarReserva({});
    assert.equal(resultado.ok, false);
    assert.deepEqual(
      Object.keys(resultado.errores).sort(),
      ['fecha', 'hora', 'nombre', 'servicioId', 'telefono']
    );
  });

  test('CP-R03 nombre con numeros y telefono distinto de 9 digitos se rechazan', () => {
    const conNumeros = validarReserva({ ...RESERVA_VALIDA, nombre: 'Ana 123' });
    assert.equal(conNumeros.ok, false);
    assert.ok(conNumeros.errores.nombre);

    const telefonoCorto = validarReserva({ ...RESERVA_VALIDA, telefono: '123' });
    assert.equal(telefonoCorto.ok, false);
    assert.ok(telefonoCorto.errores.telefono);

    const telefonoConLetras = validarReserva({ ...RESERVA_VALIDA, telefono: '99911122A' });
    assert.equal(telefonoConLetras.ok, false);
    assert.ok(telefonoConLetras.errores.telefono);
  });

  test('CP-R04 fecha y hora invalidas se rechazan', () => {
    const fechaMala = validarReserva({ ...RESERVA_VALIDA, fecha: '2026-13-45' });
    assert.equal(fechaMala.ok, false);
    assert.ok(fechaMala.errores.fecha);

    const horaMala = validarReserva({ ...RESERVA_VALIDA, hora: '25:99' });
    assert.equal(horaMala.ok, false);
    assert.ok(horaMala.errores.hora);
  });
});

describe('reserva-logica - payload para insert', () => {
  test('CP-R05 construye el payload con snapshot y defaults', () => {
    const payload = construirPayloadReserva({
      perfilId: 'p-1',
      servicio: SERVICIO,
      fecha: '2026-11-10',
      hora: '10:00',
      sillaId: null,
      barbero: '   '
    });

    assert.deepEqual(payload, {
      profile_id: 'p-1',
      servicio_id: 's-corte',
      servicio_nombre: 'Corte clasico',
      duracion_min: 45,
      precio: 35.5,
      fecha: '2026-11-10',
      hora: '10:00',
      silla_id: null,
      barbero: 'cualquiera',
      estado: 'pendiente'
    });
  });

  test('CP-R06 conserva barbero y silla cuando vienen informados', () => {
    const payload = construirPayloadReserva({
      perfilId: 'p-1',
      servicio: SERVICIO,
      fecha: '2026-11-10',
      hora: '10:00',
      sillaId: 'silla-2',
      barbero: 'Luis'
    });
    assert.equal(payload.barbero, 'Luis');
    assert.equal(payload.silla_id, 'silla-2');
  });

  test('CP-R07 payload tolera servicio nulo sin lanzar', () => {
    const payload = construirPayloadReserva({
      perfilId: 'p-1',
      servicio: null,
      fecha: '2026-11-10',
      hora: '10:00'
    });
    assert.equal(payload.servicio_id, null);
    assert.equal(payload.servicio_nombre, '');
    assert.equal(payload.duracion_min, 0);
    assert.equal(payload.precio, 0);
    assert.equal(payload.estado, 'pendiente');
  });
});

describe('reserva-logica - estados', () => {
  test('CP-R08 estados conocidos devuelven etiqueta y clase CSS', () => {
    assert.deepEqual(estadoReserva('pendiente'), {
      etiqueta: 'Pendiente',
      clase: 'estado--pendiente'
    });
    assert.deepEqual(estadoReserva('confirmada'), {
      etiqueta: 'Confirmada',
      clase: 'estado--confirmada'
    });
    assert.deepEqual(estadoReserva('atendida'), {
      etiqueta: 'Atendida',
      clase: 'estado--atendida'
    });
    assert.deepEqual(estadoReserva('cancelada'), {
      etiqueta: 'Cancelada',
      clase: 'estado--cancelada'
    });
  });

  test('CP-R09 estado desconocido o nulo tiene fallback seguro', () => {
    const desconocido = estadoReserva('en-limbo');
    assert.equal(desconocido.etiqueta, 'Desconocido');
    assert.equal(desconocido.clase, 'estado--desconocido');
    assert.deepEqual(estadoReserva(null), desconocido);
    assert.deepEqual(estadoReserva(undefined), desconocido);
    assert.deepEqual(estadoReserva(''), desconocido);
  });

  test('CP-R10 solo pendiente y confirmada se pueden cancelar', () => {
    assert.equal(puedeCancelar('pendiente'), true);
    assert.equal(puedeCancelar('confirmada'), true);
    assert.equal(puedeCancelar('atendida'), false);
    assert.equal(puedeCancelar('cancelada'), false);
    assert.equal(puedeCancelar('en-limbo'), false);
    assert.equal(puedeCancelar(null), false);
  });
});
