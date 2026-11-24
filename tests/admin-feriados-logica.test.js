/* =============================================================================
   Barbería Kraft — tests/admin-feriados-logica.test.js
   -----------------------------------------------------------------------------
   Pruebas unitarias de pages/js/logica/admin-feriados-logica.js.
   Runner nativo de Node (node:test) + node:assert/strict — SIN dependencias.
   La fecha de referencia se inyecta: las pruebas NO dependen del día actual
   ni de la zona horaria de la máquina que ejecuta npm test.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarFeriado,
  ordenarFeriados,
  formatearFecha,
  etiquetaCierre,
  esFeriado,
  CIERRES_PERMITIDOS
} from '../pages/js/logica/admin-feriados-logica.js';

const HOY = new Date(2026, 10, 24, 12, 0, 0);

const valido = {
  fecha: '2026-12-25',
  descripcion: 'Navidad',
  cierre: '22:00'
};

describe('admin-feriados-logica — validación', () => {
  test('CP-F01 un feriado completo y válido devuelve ok sin errores', () => {
    assert.deepEqual(validarFeriado(valido, HOY), { ok: true, errores: [] });
  });

  test('CP-F02 fecha inventada 2026-13-45 se rechaza', () => {
    const resultado = validarFeriado({ ...valido, fecha: '2026-13-45' }, HOY);
    assert.equal(resultado.ok, false);
    assert.ok(resultado.errores.some((error) => error.includes('fecha')));
  });

  test('CP-F03 fecha pasada se rechaza; hoy y futura se aceptan', () => {
    assert.equal(validarFeriado({ ...valido, fecha: '2026-11-23' }, HOY).ok, false);
    assert.equal(validarFeriado({ ...valido, fecha: '2026-11-24' }, HOY).ok, true);
    assert.equal(validarFeriado({ ...valido, fecha: '2026-11-25' }, HOY).ok, true);
  });

  test('CP-F04 30 de febrero y formatos no ISO se rechazan', () => {
    assert.equal(validarFeriado({ ...valido, fecha: '2026-02-30' }, HOY).ok, false);
    assert.equal(validarFeriado({ ...valido, fecha: '25/12/2026' }, HOY).ok, false);
  });

  test('CP-F05 descripción de 120 caracteres pasa; 121 se rechaza', () => {
    assert.equal(validarFeriado({ ...valido, descripcion: 'a'.repeat(120) }, HOY).ok, true);
    const resultado = validarFeriado({ ...valido, descripcion: 'a'.repeat(121) }, HOY);
    assert.equal(resultado.ok, false);
    assert.ok(resultado.errores.some((error) => error.includes('120')));
  });

  test('CP-F06 cierre fuera de la lista permitida se rechaza', () => {
    for (const cierre of ['18:00', '23:00', '22:30', '', null]) {
      assert.equal(validarFeriado({ ...valido, cierre }, HOY).ok, false);
    }
    assert.deepEqual(CIERRES_PERMITIDOS, ['19:00', '20:00', '21:00', '22:00']);
  });

  test('CP-F07 cierre SQL con segundos se normaliza y acepta', () => {
    assert.equal(validarFeriado({ ...valido, cierre: '22:00:00' }, HOY).ok, true);
  });

  test('CP-F08 campos ausentes devuelven errores sin lanzar', () => {
    const resultado = validarFeriado({}, HOY);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.errores.length, 2);
    assert.equal(validarFeriado(null, HOY).ok, false);
    assert.equal(validarFeriado(undefined, HOY).ok, false);
  });

  test('CP-F09 la validación no depende de la zona horaria', () => {
    const referenciaTarde = new Date(2026, 11, 24, 23, 30, 0);
    assert.equal(validarFeriado({ ...valido, fecha: '2026-12-25' }, referenciaTarde).ok, true);
    const referenciaTexto = '2026-12-24';
    assert.equal(validarFeriado({ ...valido, fecha: '2026-12-23' }, referenciaTexto).ok, false);
  });
});

describe('admin-feriados-logica — orden, formato y consulta', () => {
  test('CP-F10 ordenarFeriados ordena ascendente sin mutar la entrada', () => {
    const lista = [{ fecha: '2026-12-25' }, { fecha: '2026-07-28' }, { fecha: '2026-01-01' }];
    const copia = lista.slice();
    const resultado = ordenarFeriados(lista);
    assert.deepEqual(resultado.map((item) => item.fecha), ['2026-01-01', '2026-07-28', '2026-12-25']);
    assert.deepEqual(lista, copia);
  });

  test('CP-F11 fechas duplicadas (PK) se colapsan conservando la primera', () => {
    const lista = [
      { fecha: '2026-12-25', descripcion: 'Primero' },
      { fecha: '2026-12-25', descripcion: 'Segundo' },
      { fecha: '2026-01-01' }
    ];
    const resultado = ordenarFeriados(lista);
    assert.equal(resultado.length, 2);
    assert.equal(resultado[1].descripcion, 'Primero');
  });

  test('CP-F12 listas vacías, nulas o no-array no rompen', () => {
    assert.deepEqual(ordenarFeriados([]), []);
    assert.deepEqual(ordenarFeriados(null), []);
    assert.deepEqual(ordenarFeriados(undefined), []);
    assert.deepEqual(ordenarFeriados('no-array'), []);
  });

  test('CP-F13 fechas inválidas van al final sin descartarse', () => {
    const resultado = ordenarFeriados([
      { fecha: 'mala' },
      { fecha: '2026-05-01' },
      { fecha: '2026-13-45' }
    ]);
    assert.deepEqual(resultado.map((item) => item.fecha), ['2026-05-01', 'mala', '2026-13-45']);
  });

  test('CP-F14 formatearFecha devuelve dd/mm/yyyy y "—" si es inválida', () => {
    assert.equal(formatearFecha('2026-12-25'), '25/12/2026');
    assert.equal(formatearFecha(new Date(2026, 0, 1, 0, 0)), '01/01/2026');
    assert.equal(formatearFecha('2026-13-45'), '—');
    assert.equal(formatearFecha(null), '—');
  });

  test('CP-F15 etiquetaCierre es legible para todos los valores permitidos', () => {
    assert.equal(etiquetaCierre('19:00'), '7:00 p. m.');
    assert.equal(etiquetaCierre('20:00'), '8:00 p. m.');
    assert.equal(etiquetaCierre('21:00'), '9:00 p. m.');
    assert.equal(etiquetaCierre('22:00'), '10:00 p. m.');
    assert.equal(etiquetaCierre('22:00:00'), '10:00 p. m.');
  });

  test('CP-F16 etiquetaCierre con valor inválido devuelve "—"', () => {
    assert.equal(etiquetaCierre('23:00'), '—');
    assert.equal(etiquetaCierre(null), '—');
  });

  test('CP-F17 esFeriado detecta la fecha incluso con duplicados', () => {
    const lista = [{ fecha: '2026-12-25' }, { fecha: '2026-12-25' }, { fecha: '2026-01-01' }];
    assert.equal(esFeriado('2026-12-25', lista), true);
    assert.equal(esFeriado('2026-07-28', lista), false);
  });

  test('CP-F18 esFeriado tolera lista vacía, nula y fecha inválida', () => {
    assert.equal(esFeriado('2026-12-25', []), false);
    assert.equal(esFeriado('2026-12-25', null), false);
    assert.equal(esFeriado('2026-13-45', [{ fecha: '2026-12-25' }]), false);
  });
});
