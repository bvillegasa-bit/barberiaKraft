/* =============================================================================
   Barbería Kraft — tests/clientes-logica.test.js (HU13 · lista de clientes)
   -----------------------------------------------------------------------------
   Pruebas unitarias de las funciones puras de pages/js/logica/clientes-logica.js.
   Runner nativo de Node (node:test) + node:assert/strict — SIN dependencias.
   Ejecución: npm test  (ver docs/TEST-UNIT.md)
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  esCuentaAdmin,
  filtrarClientesNoAdmin,
  mapearClientePublico,
  ordenarClientes,
  formatearFecha
} from '../pages/js/logica/clientes-logica.js';

/* Datos de prueba comunes (filas simuladas de Supabase) */
const PERFILES = [
  { id: 'p-admin', rol: 'admin' },
  { id: 'p-cliente', rol: 'cliente' },
  { id: 'p-cliente2', rol: 'cliente' }
];

const CLIENTES = [
  { id: 'c1', nombre: 'Ana Torres', email: 'ana@correo.com', telefono: '999111222', creado_en: '2026-01-10T10:00:00Z', profile_id: 'p-cliente' },
  { id: 'c2', nombre: 'Barbero Kraft', email: 'kraft@correo.com', creado_en: '2026-01-01T10:00:00Z', profile_id: 'p-admin' },
  { id: 'c3', nombre: 'Carlos Ruiz', email: 'carlos@correo.com', telefono: '999333444', creado_en: '2026-02-01T10:00:00Z', profile_id: 'p-cliente2' },
  { id: 'c4', nombre: 'Diana Soto', email: 'diana@correo.com', creado_en: '2026-01-20T10:00:00Z', profile_id: null }
];

describe('clientes-logica (HU13) — cuentas admin, mapeo público y orden', () => {
  test('CP-06 esCuentaAdmin detecta rol admin y descarta rol cliente o perfil nulo', () => {
    assert.equal(esCuentaAdmin({ id: 'p-admin', rol: 'admin' }), true);
    assert.equal(esCuentaAdmin({ id: 'p-cliente', rol: 'cliente' }), false);
    assert.equal(esCuentaAdmin(null), false);
    assert.equal(esCuentaAdmin(undefined), false);
    assert.equal(esCuentaAdmin({}), false);
  });

  test('CP-07 filtrarClientesNoAdmin excluye cuentas admin, cuenta el total correcto y conserva clientes sin profile_id', () => {
    const resultado = filtrarClientesNoAdmin(CLIENTES, PERFILES);
    // Excluida 1 fila admin (c2): total correcto = 3
    assert.equal(resultado.length, 3);
    assert.ok(resultado.every((c) => c.profile_id !== 'p-admin'));
    // El cliente sin profile_id (perfil borrado → SET NULL) NO es admin: se conserva
    assert.ok(resultado.some((c) => c.id === 'c4'));
    // Entrada intacta (no muta el array original)
    assert.equal(CLIENTES.length, 4);
    // Sin perfiles → nadie es admin (no hay cruce posible)
    assert.equal(filtrarClientesNoAdmin(CLIENTES, []).length, 4);
    assert.equal(filtrarClientesNoAdmin(null, PERFILES).length, 0);
  });

  test('CP-08 mapearClientePublico expone SOLO campos permitidos (nunca password/hash/profile_id)', () => {
    const filaSensible = {
      id: 'c9',
      nombre: 'Eva Lopez',
      email: 'eva@correo.com',
      telefono: '999000111',
      creado_en: '2026-03-01T10:00:00Z',
      profile_id: 'p-cliente',
      password_hash: '$2b$10$SECRETO',
      encrypted_password: 'SECRETO2',
      auth_uid: 'uuid-secreto'
    };
    const publico = mapearClientePublico(filaSensible);

    // Solo los campos permitidos: nombre, email, teléfono y fecha
    assert.deepEqual(Object.keys(publico).sort(), ['creado_en', 'email', 'nombre', 'telefono']);
    // Ningún dato sensible viaja al render
    const serializado = JSON.stringify(publico);
    assert.ok(!serializado.includes('SECRETO'), 'no debe filtrarse ningún hash');
    assert.ok(!('profile_id' in publico));
    assert.ok(!('id' in publico));
    // Campos ausentes → cadena vacía (no undefined)
    const vacio = mapearClientePublico(null);
    assert.deepEqual(vacio, { nombre: '', email: '', telefono: '', creado_en: '' });
  });

  test('CP-09 ordenarClientes ordena por creado_en DESC, no muta y envía fechas inválidas al final', () => {
    const desorden = [
      { nombre: 'Ana', creado_en: '2026-01-10T10:00:00Z' },
      { nombre: 'SinFecha', creado_en: null },
      { nombre: 'Carlos', creado_en: '2026-02-01T10:00:00Z' },
      { nombre: 'Invalida', creado_en: 'no-es-fecha' },
      { nombre: 'Diana', creado_en: '2026-01-20T10:00:00Z' }
    ];
    const ordenado = ordenarClientes(desorden);
    assert.deepEqual(
      ordenado.map((c) => c.nombre),
      ['Carlos', 'Diana', 'Ana', 'SinFecha', 'Invalida']
    );
    // El array de entrada queda intacto (función pura)
    assert.equal(desorden[0].nombre, 'Ana');
    assert.equal(ordenarClientes(null).length, 0);
  });

  test('CP-10 formatearFecha devuelve dd/mm/aaaa en es-PE y "—" ante fecha inválida o ausente', () => {
    assert.match(formatearFecha('2026-01-10T10:00:00Z'), /^\d{2}\/\d{2}\/\d{4}$/);
    assert.equal(formatearFecha(null), '—');
    assert.equal(formatearFecha(undefined), '—');
    assert.equal(formatearFecha(''), '—');
    assert.equal(formatearFecha('no-es-fecha'), '—');
  });
});
