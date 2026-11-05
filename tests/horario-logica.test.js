/* =============================================================================
   Barberia Kraft - tests/horario-logica.test.js (Ciclo 6)
   -----------------------------------------------------------------------------
   Pruebas unitarias de las funciones puras de horarios de reserva.
   Runner nativo de Node (node:test) + node:assert/strict - SIN dependencias.
   Zonas horarias: TODO se compara con strings 'YYYY-MM-DD' y 'HH:MM'.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  aHoraMinutos,
  aTextoHora,
  generarSlots,
  filtrarSlotsDisponibles,
  esFechaReservable,
  horarioDeFecha,
  siguienteFechaReservable
} from '../pages/js/logica/horario-logica.js';

const NORMAL = { apertura: '08:30', cierre: '19:00', intervaloMin: 30 };
const FERIADO = { apertura: '08:30', cierre: '22:00', intervaloMin: 30 };

describe('horario-logica - conversion de horas', () => {
  test('CP-H01 aHoraMinutos convierte HH:MM valido y devuelve null en entradas invalidas', () => {
    assert.equal(aHoraMinutos('08:30'), 510);
    assert.equal(aHoraMinutos('00:00'), 0);
    assert.equal(aHoraMinutos('23:59'), 1439);
    assert.equal(aHoraMinutos(' 09:15 '), 555);
    assert.equal(aHoraMinutos('25:99'), null);
    assert.equal(aHoraMinutos('8:30'), null);
    assert.equal(aHoraMinutos('12:60'), null);
    assert.equal(aHoraMinutos(''), null);
    assert.equal(aHoraMinutos(null), null);
    assert.equal(aHoraMinutos(undefined), null);
  });

  test('CP-H02 aTextoHora convierte minutos validos y devuelve cadena vacia si no lo son', () => {
    assert.equal(aTextoHora(510), '08:30');
    assert.equal(aTextoHora(0), '00:00');
    assert.equal(aTextoHora(1439), '23:59');
    assert.equal(aTextoHora(-1), '');
    assert.equal(aTextoHora(1440), '');
    assert.equal(aTextoHora(30.5), '');
    assert.equal(aTextoHora(null), '');
    assert.equal(aTextoHora('90'), '');
  });
});

describe('horario-logica - generacion de slots', () => {
  test('CP-H03 dia normal 08:30..19:00 genera 21 slots y excluye el cierre', () => {
    const slots = generarSlots(NORMAL);
    assert.equal(slots.length, 21);
    assert.equal(slots[0], '08:30');
    assert.equal(slots[slots.length - 1], '18:30');
    assert.ok(!slots.includes('19:00'), 'el slot igual al cierre no se ofrece');
    assert.equal(slots[1], '09:00');
  });

  test('CP-H04 feriado 08:30..22:00 genera 27 slots y excluye el cierre', () => {
    const slots = generarSlots(FERIADO);
    assert.equal(slots.length, 27);
    assert.equal(slots[slots.length - 1], '21:30');
    assert.ok(!slots.includes('22:00'));
  });

  test('CP-H05 generarSlots tolera parametros invalidos sin bucles infinitos', () => {
    assert.deepEqual(generarSlots({ apertura: '19:00', cierre: '08:30', intervaloMin: 30 }), []);
    assert.deepEqual(generarSlots({ apertura: '08:30', cierre: '19:00', intervaloMin: 0 }), []);
    assert.deepEqual(generarSlots({ apertura: 'xx', cierre: '19:00', intervaloMin: 30 }), []);
    assert.deepEqual(generarSlots({}), []);
    assert.deepEqual(generarSlots(), []);
  });
});

describe('horario-logica - disponibilidad de slots', () => {
  test('CP-H06 hoy elimina slots ya pasados y los ocupados; deja los futuros', () => {
    const slots = generarSlots(NORMAL);
    const disponibles = filtrarSlotsDisponibles(slots, {
      fecha: '2026-11-03',
      hoy: '2026-11-03',
      ahora: '10:00',
      ocupadas: ['11:00', '12:30']
    });
    assert.ok(!disponibles.includes('08:30'));
    assert.ok(!disponibles.includes('09:30'));
    assert.ok(!disponibles.includes('10:00'), 'el slot igual a la hora actual ya no sirve');
    assert.ok(!disponibles.includes('11:00'));
    assert.ok(!disponibles.includes('12:30'));
    assert.ok(disponibles.includes('10:30'));
    assert.ok(disponibles.includes('18:30'));
  });

  test('CP-H07 fecha futura conserva todos los slots salvo los ocupados', () => {
    const slots = generarSlots(NORMAL);
    const disponibles = filtrarSlotsDisponibles(slots, {
      fecha: '2026-11-10',
      hoy: '2026-11-03',
      ahora: '18:00',
      ocupadas: ['09:00']
    });
    assert.equal(disponibles.length, slots.length - 1);
    assert.ok(disponibles.includes('08:30'));
    assert.ok(!disponibles.includes('09:00'));
  });

  test('CP-H08 filtrarSlotsDisponibles tolera listas nulas o invalidas', () => {
    assert.deepEqual(filtrarSlotsDisponibles(null, { fecha: '2026-11-10' }), []);
    assert.deepEqual(
      filtrarSlotsDisponibles(['10:00'], { fecha: '2026-11-10', ocupadas: null }),
      ['10:00']
    );
  });
});

describe('horario-logica - fechas reservables', () => {
  test('CP-H09 domingo no es reservable y la fecha pasada tampoco', () => {
    assert.equal(esFechaReservable('2026-11-08', { hoy: '2026-11-08', diaSemana: 0 }), false);
    assert.equal(esFechaReservable('2026-11-01', { hoy: '2026-11-03' }), false);
    assert.equal(esFechaReservable('2026-13-45', { hoy: '2026-11-03' }), false);
    assert.equal(esFechaReservable('', { hoy: '2026-11-03' }), false);
  });

  test('CP-H10 hoy y fechas futuras son reservables; hoy deja de serlo si ya cerro', () => {
    assert.equal(esFechaReservable('2026-11-03', { hoy: '2026-11-03', diaSemana: 2 }), true);
    assert.equal(esFechaReservable('2026-11-10', { hoy: '2026-11-03', diaSemana: 3 }), true);
    assert.equal(
      esFechaReservable('2026-11-03', {
        hoy: '2026-11-03',
        diaSemana: 2,
        ahora: '19:00',
        cierre: '19:00'
      }),
      false
    );
  });

  test('CP-H11 horarioDeFecha aplica cierre de feriado con array o Set', () => {
    assert.deepEqual(horarioDeFecha('2026-11-03', { feriados: [] }), {
      apertura: '08:30',
      cierre: '19:00',
      esFeriado: false
    });
    assert.deepEqual(horarioDeFecha('2026-12-25', { feriados: ['2026-12-25'] }), {
      apertura: '08:30',
      cierre: '22:00',
      esFeriado: true
    });
    assert.deepEqual(horarioDeFecha('2026-12-25', { feriados: new Set(['2026-12-25']) }), {
      apertura: '08:30',
      cierre: '22:00',
      esFeriado: true
    });
    assert.equal(horarioDeFecha('2026-07-28', { feriados: ['2026-07-28'], cierre: '20:00' }).cierre, '20:00');
  });
});

describe('horario-logica - siguiente fecha reservable', () => {
  test('CP-H12 domingo salta a lunes habil', () => {
    assert.equal(siguienteFechaReservable('2026-11-08'), '2026-11-09');
  });

  test('CP-H13 hoy con horas disponibles se mantiene; sin horas pasa al siguiente habil', () => {
    assert.equal(siguienteFechaReservable('2026-11-03'), '2026-11-03');
    assert.equal(
      siguienteFechaReservable('2026-11-03', { ahora: '19:00', cierre: '19:00' }),
      '2026-11-04'
    );
  });

  test('CP-H14 sabado sin horas salta el domingo y cae en lunes; entrada invalida devuelve cadena vacia', () => {
    assert.equal(
      siguienteFechaReservable('2026-11-07', { ahora: '23:00', cierre: '19:00' }),
      '2026-11-09'
    );
    assert.equal(siguienteFechaReservable(''), '');
    assert.equal(siguienteFechaReservable(null), '');
    assert.equal(siguienteFechaReservable('2026-13-45'), '');
  });
});
