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
  formatearFechaHora
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
