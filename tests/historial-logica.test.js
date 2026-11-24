/* =============================================================================
   Barbería Kraft — tests/historial-logica.test.js (HU14 · historial atención)
   -----------------------------------------------------------------------------
   Pruebas unitarias de las funciones puras de pages/js/logica/historial-logica.js.
   Runner nativo de Node (node:test) + node:assert/strict — SIN dependencias.
   Ejecución: npm test  (ver docs/TEST-UNIT.md)
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ordenarAtencionesDesc,
  formatearImporte,
  etiquetaServicio,
  formatearFechaHora,
  aCsv,
  nombreArchivoCsv
} from '../pages/js/logica/historial-logica.js';

describe('historial-logica (HU14) — orden, importe y etiqueta de servicio', () => {
  test('CP-11 ordenarAtencionesDesc ordena por fecha_atencion DESC y envía inválidas al final', () => {
    const atenciones = [
      { id: 1, fecha_atencion: '2026-01-05T10:00:00Z' },
      { id: 2, fecha_atencion: '2026-03-01T10:00:00Z' },
      { id: 3, fecha_atencion: null },
      { id: 4, fecha_atencion: '2026-02-10T10:00:00Z' },
      { id: 5, fecha_atencion: 'fecha-rota' }
    ];
    const ordenado = ordenarAtencionesDesc(atenciones);
    assert.deepEqual(
      ordenado.map((a) => a.id),
      [2, 4, 1, 3, 5] // más reciente primero; null/inválida al final
    );
    // No muta la entrada
    assert.equal(atenciones[0].id, 1);
    assert.equal(ordenarAtencionesDesc(null).length, 0);
  });

  test('CP-12 formatearImporte: null/vacío/inválido → "—", números → "S/ X.XX" y el 0 real → "S/ 0.00"', () => {
    // Sin importe registrado (nunca inventar "S/ 0.00")
    assert.equal(formatearImporte(null), '—');
    assert.equal(formatearImporte(undefined), '—');
    assert.equal(formatearImporte(''), '—');
    assert.equal(formatearImporte('no-numero'), '—');
    assert.equal(formatearImporte(NaN), '—');
    // Importe forma parte del registro
    assert.equal(formatearImporte(25.5), 'S/ 25.50');
    assert.equal(formatearImporte('30'), 'S/ 30.00');
    assert.equal(formatearImporte(0), 'S/ 0.00'); // cero explícito en el registro
  });

  test('CP-13 etiquetaServicio: sin servicio_id o sin nombre → "Servicio retirado"; con nombre → ese nombre', () => {
    // FK en NULL (ON DELETE SET NULL): la atención se conserva
    assert.equal(
      etiquetaServicio({ id: 1, servicio_id: null, servicios: null }),
      'Servicio retirado'
    );
    assert.equal(etiquetaServicio({ id: 2, servicios: { nombre: 'Corte clásico' } }), 'Servicio retirado');
    assert.equal(etiquetaServicio(null), 'Servicio retirado');
    // Servicio activo: se muestra el nombre embebido
    assert.equal(
      etiquetaServicio({ id: 3, servicio_id: 's1', servicios: { nombre: 'Corte clásico' } }),
      'Corte clásico'
    );
    // Nombre en blanco cuenta como "sin nombre"
    assert.equal(
      etiquetaServicio({ id: 4, servicio_id: 's2', servicios: { nombre: '   ' } }),
      'Servicio retirado'
    );
  });

  test('CP-14 formatearFechaHora devuelve "—" ante fecha ausente o inválida', () => {
    assert.match(formatearFechaHora('2026-03-01T10:00:00Z'), /\d{2}\/\d{2}\/\d{4}/);
    assert.equal(formatearFechaHora(null), '—');
    assert.equal(formatearFechaHora(undefined), '—');
    assert.equal(formatearFechaHora(''), '—');
    assert.equal(formatearFechaHora('fecha-rota'), '—');
  });
});

describe('historial-logica (HU14) — exportación CSV (filas ya filtradas)', () => {
  const CABECERA = '\uFEFF"Fecha";"Servicio";"Importe";"Notas"';

  const filaBase = {
    fecha_atencion: '2026-03-01T10:00:00Z',
    servicio_id: 's1',
    servicios: { nombre: 'Corte clásico' },
    importe: 25.5,
    notas: 'Atención rápida'
  };

  test('CP-15 aCsv con lista vacía (o no array) devuelve solo cabecera con BOM', () => {
    assert.equal(aCsv([]), CABECERA);
    assert.equal(aCsv(null), CABECERA);
    assert.equal(aCsv('no-array'), CABECERA);
  });

  test("CP-16 aCsv de una fila: BOM, cabecera en español, ';' y valores", () => {
    const csv = aCsv([filaBase]);
    assert.ok(csv.startsWith(CABECERA + '\r\n'));
    assert.equal(csv.split('\r\n').length, 2);
    assert.ok(csv.endsWith(';"Corte clásico";"S/ 25.50";"Atención rápida"'));
  });

  test('CP-17 aCsv escapa comillas dobles en notas', () => {
    const csv = aCsv([{ ...filaBase, notas: 'Corte "fade" especial' }]);
    assert.ok(csv.includes('"Corte ""fade"" especial"'));
    assert.equal(csv.split('\r\n').length, 2);
  });

  test('CP-18 aCsv conserva comas dentro de la celda sin romper columnas', () => {
    const csv = aCsv([{ ...filaBase, notas: 'Corte, barba y cejas' }]);
    assert.ok(csv.includes('"Corte, barba y cejas"'));
    assert.equal(csv.split('\r\n')[1].split(';').length, 4);
  });

  test('CP-19 aCsv mantiene saltos de línea dentro de la celda entre comillas', () => {
    const csv = aCsv([{ ...filaBase, notas: 'Línea 1\nLínea 2' }]);
    assert.ok(csv.includes('"Línea 1\nLínea 2"'));
    assert.equal(csv.split('\r\n').length, 2);
  });

  test('CP-20 aCsv conserva acentos y ñ (UTF-8)', () => {
    const notas = 'Añadido dueño de la ñ — café nicaragüense';
    const csv = aCsv([{ ...filaBase, notas }]);
    assert.ok(csv.includes(`"${notas}"`));
    assert.ok(csv.startsWith('\uFEFF'));
  });

  test('CP-21 aCsv incluye exactamente un BOM UTF-8 al inicio', () => {
    const csv = aCsv([filaBase, filaBase]);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.equal((csv.match(/\uFEFF/g) ?? []).length, 1);
  });

  test('CP-22 aCsv muestra importe ausente y servicio retirado sin inventar valores', () => {
    const csv = aCsv([
      { ...filaBase, importe: null, servicio_id: null, servicios: null },
      { ...filaBase, importe: 0 }
    ]);
    assert.ok(csv.includes(';"Servicio retirado";"—";'));
    assert.ok(csv.includes(';"Corte clásico";"S/ 0.00";'));
  });

  test('CP-23 aCsv respeta el orden recibido y no muta la entrada', () => {
    const filas = [{ ...filaBase, notas: 'Primera' }, { ...filaBase, notas: 'Segunda' }];
    const copia = structuredClone(filas);
    const csv = aCsv(filas);
    assert.ok(csv.indexOf('"Primera"') < csv.indexOf('"Segunda"'));
    assert.deepEqual(filas, copia);
  });

  test('CP-24 aCsv solo exporta las filas filtradas que recibe', () => {
    const filtradas = [{ ...filaBase, notas: 'Cliente A' }];
    const csv = aCsv(filtradas);
    assert.ok(csv.includes('"Cliente A"'));
    assert.ok(!csv.includes('Cliente B'));
    assert.equal(csv.split('\r\n').length, 2);
  });

  test('CP-25 nombreArchivoCsv con fecha YYYY-MM-DD', () => {
    assert.equal(nombreArchivoCsv('2026-03-01'), 'historial-atenciones-2026-03-01.csv');
    assert.equal(nombreArchivoCsv('2026-12-31'), 'historial-atenciones-2026-12-31.csv');
  });

  test('CP-26 nombreArchivoCsv con Date/ISO y fecha inválida', () => {
    assert.equal(
      nombreArchivoCsv(new Date('2026-03-01T10:00:00Z')),
      'historial-atenciones-2026-03-01.csv'
    );
    assert.equal(
      nombreArchivoCsv('2026-03-01T10:00:00Z'),
      'historial-atenciones-2026-03-01.csv'
    );
    assert.equal(nombreArchivoCsv('fecha-rota'), 'historial-atenciones-sin-fecha.csv');
    assert.equal(nombreArchivoCsv(undefined), 'historial-atenciones-sin-fecha.csv');
  });
});
