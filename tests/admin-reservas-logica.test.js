/* =============================================================================
   Barbería Kraft — tests/admin-reservas-logica.test.js
   -----------------------------------------------------------------------------
   Pruebas unitarias de pages/js/logica/admin-reservas-logica.js.
   Runner nativo de Node (node:test) + node:assert/strict — SIN dependencias.
   Ejecución: npm test
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  filtrarReservas,
  contarReservasHoy,
  contarPendientes,
  accionesDisponibles,
  ordenarReservas,
  normalizarFecha,
  normalizarHora,
  formatearFecha,
  formatearHora
} from '../pages/js/logica/admin-reservas-logica.js';

const HOY = '2026-11-04';

const RESERVAS = [
  { id: 'r1', codigo: 'KRAFT-1', fecha: '2026-11-04', hora: '11:00', estado: 'pendiente' },
  { id: 'r2', codigo: 'KRAFT-2', fecha: '2026-11-04', hora: '09:30', estado: 'confirmada' },
  { id: 'r3', codigo: 'KRAFT-3', fecha: '2026-11-04', hora: '10:00', estado: 'atendida' },
  { id: 'r4', codigo: 'KRAFT-4', fecha: '2026-11-05', hora: '08:00', estado: 'pendiente' },
  { id: 'r5', codigo: 'KRAFT-5', fecha: '2026-11-05', hora: '12:00', estado: 'cancelada' },
  { id: 'r6', codigo: 'KRAFT-6', fecha: '2026-11-06', hora: '15:00', estado: 'pendiente' }
];

describe('admin-reservas-logica — filtros por fecha y estado', () => {
  test('CP-R01 filtro "todas" + "todos" devuelve la lista completa', () => {
    const resultado = filtrarReservas(RESERVAS, { fecha: 'todas', estado: 'todos', hoy: HOY });
    assert.equal(resultado.length, RESERVAS.length);
  });

  test('CP-R02 filtro "hoy" devuelve solo las reservas del día indicado', () => {
    const resultado = filtrarReservas(RESERVAS, { fecha: 'hoy', estado: 'todos', hoy: HOY });
    assert.deepEqual(resultado.map((r) => r.id), ['r1', 'r2', 'r3']);
  });

  test('CP-R03 filtro "manana" cruza correctamente el cambio de mes', () => {
    const lista = [
      { id: 'a', fecha: '2026-11-30', hora: '10:00', estado: 'pendiente' },
      { id: 'b', fecha: '2026-12-01', hora: '10:00', estado: 'pendiente' },
      { id: 'c', fecha: '2026-12-02', hora: '10:00', estado: 'pendiente' }
    ];
    const resultado = filtrarReservas(lista, { fecha: 'manana', estado: 'todos', hoy: '2026-11-30' });
    assert.deepEqual(resultado.map((r) => r.id), ['b']);
  });

  test('CP-R04 filtro por estado "pendiente" ignora los demás estados', () => {
    const resultado = filtrarReservas(RESERVAS, { fecha: 'todas', estado: 'pendiente', hoy: HOY });
    assert.deepEqual(resultado.map((r) => r.id), ['r1', 'r4', 'r6']);
  });

  test('CP-R05 combinación fecha + estado aplica ambos filtros', () => {
    const resultado = filtrarReservas(RESERVAS, { fecha: 'hoy', estado: 'confirmada', hoy: HOY });
    assert.deepEqual(resultado.map((r) => r.id), ['r2']);
  });

  test('CP-R06 estado de filtro desconocido no devuelve resultados', () => {
    const resultado = filtrarReservas(RESERVAS, { fecha: 'todas', estado: 'archivada', hoy: HOY });
    assert.deepEqual(resultado, []);
  });

  test('CP-R07 fechas inválidas se excluyen de hoy/mañana pero se ven en "todas"', () => {
    const lista = [
      { id: 'ok', fecha: '2026-11-04', hora: '10:00', estado: 'pendiente' },
      { id: 'mala', fecha: '2026-02-30', hora: '10:00', estado: 'pendiente' },
      { id: 'vacia', fecha: null, hora: '10:00', estado: 'pendiente' }
    ];
    assert.deepEqual(
      filtrarReservas(lista, { fecha: 'hoy', estado: 'todos', hoy: HOY }).map((r) => r.id),
      ['ok']
    );
    assert.equal(filtrarReservas(lista, { fecha: 'todas', estado: 'todos', hoy: HOY }).length, 3);
    assert.deepEqual(filtrarReservas(lista, { fecha: 'manana', estado: 'todos', hoy: HOY }), []);
  });

  test('CP-R08 lista nula o no-array no rompe el filtro', () => {
    assert.deepEqual(filtrarReservas(null, { fecha: 'hoy', hoy: HOY }), []);
    assert.deepEqual(filtrarReservas(undefined, { fecha: 'todas', hoy: HOY }), []);
  });
});

describe('admin-reservas-logica — contadores', () => {
  test('CP-R09 contarReservasHoy cuenta todas las reservas del día (incluye canceladas)', () => {
    assert.equal(contarReservasHoy(RESERVAS, HOY), 3);
  });

  test('CP-R10 contarReservasHoy con fecha de referencia inválida devuelve 0', () => {
    assert.equal(contarReservasHoy(RESERVAS, 'no-es-fecha'), 0);
  });

  test('CP-R11 contarPendientes cuenta solo pendientes e ignora desconocidos', () => {
    const lista = [
      ...RESERVAS,
      { id: 'x', fecha: '2026-11-07', hora: '10:00', estado: 'en-proceso' },
      { id: 'y', fecha: '2026-11-07', hora: '11:00', estado: null }
    ];
    assert.equal(contarPendientes(lista), 3);
    assert.equal(contarPendientes([]), 0);
  });
});

describe('admin-reservas-logica — acciones y orden', () => {
  test('CP-R12 accionesDisponibles respeta las transiciones y estados desconocidos', () => {
    assert.deepEqual(accionesDisponibles('pendiente'), ['confirmar', 'cancelar']);
    assert.deepEqual(accionesDisponibles('confirmada'), ['atender', 'cancelar']);
    assert.deepEqual(accionesDisponibles('atendida'), []);
    assert.deepEqual(accionesDisponibles('cancelada'), []);
    assert.deepEqual(accionesDisponibles('desconocido'), []);
    assert.deepEqual(accionesDisponibles(null), []);
    assert.deepEqual(accionesDisponibles('PENDIENTE'), ['confirmar', 'cancelar']);
  });

  test('CP-R13 ordenarReservas coloca activas primero por fecha/hora ascendente', () => {
    const resultado = ordenarReservas(RESERVAS);
    assert.deepEqual(resultado.map((r) => r.id), ['r2', 'r1', 'r4', 'r6', 'r3', 'r5']);
  });

  test('CP-R14 ordenarReservas envía fechas/horas inválidas al final sin mutar la lista', () => {
    const lista = [
      { id: 'mala', fecha: '2026-13-40', hora: '99:99', estado: 'pendiente' },
      { id: 'sin-hora', fecha: '2026-11-04', hora: 'no', estado: 'pendiente' },
      { id: 'ok', fecha: '2026-11-04', hora: '08:00', estado: 'confirmada' }
    ];
    const copia = [...lista];
    const resultado = ordenarReservas(lista);
    assert.deepEqual(resultado.map((r) => r.id), ['ok', 'sin-hora', 'mala']);
    assert.deepEqual(lista, copia);
  });

  test('CP-R15 normalizadores y formateadores toleran valores inválidos', () => {
    assert.equal(normalizarFecha('2026-11-04T10:00:00Z'), '2026-11-04');
    assert.equal(normalizarFecha('2026-02-30'), null);
    assert.equal(normalizarFecha(''), null);
    assert.equal(normalizarHora('9:05:00'), '09:05');
    assert.equal(normalizarHora('24:00'), null);
    assert.equal(formatearFecha('2026-11-04'), '04/11/2026');
    assert.equal(formatearFecha('mala'), '—');
    assert.equal(formatearHora('9:05'), '09:05');
    assert.equal(formatearHora('09:05:00'), '09:05');
  });
});
