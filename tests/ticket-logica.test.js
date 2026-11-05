/* =============================================================================
   Barberia Kraft - tests/ticket-logica.test.js (Ciclo 6)
   -----------------------------------------------------------------------------
   Pruebas unitarias del ticket de reserva (sin DOM ni Supabase).
   Runner nativo de Node (node:test) + node:assert/strict - SIN dependencias.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatearCodigoTicket,
  construirTicket,
  textoTicketParaImprimir
} from '../pages/js/logica/ticket-logica.js';

const RESERVA = {
  codigo: 'KRAFT-AB12CD34',
  fecha: '2026-11-03',
  hora: '10:30',
  servicio_nombre: 'Corte clasico',
  duracion_min: 30,
  precio: 25,
  barbero: 'Luis',
  estado: 'confirmada'
};

describe('ticket-logica - codigo', () => {
  test('CP-T01 formatea codigo ya agrupado y normaliza minusculas', () => {
    assert.equal(formatearCodigoTicket('KRAFT-AB12CD34'), 'KRAFT-AB12CD34');
    assert.equal(formatearCodigoTicket('ab12cd34'), 'KRAFT-AB12CD34');
    assert.equal(formatearCodigoTicket(' kraft-ab12cd34 '), 'KRAFT-AB12CD34');
  });

  test('CP-T02 codigo nulo o vacio devuelve cadena vacia sin lanzar', () => {
    assert.equal(formatearCodigoTicket(null), '');
    assert.equal(formatearCodigoTicket(undefined), '');
    assert.equal(formatearCodigoTicket(''), '');
    assert.equal(formatearCodigoTicket('   '), '');
  });
});

describe('ticket-logica - construccion', () => {
  test('CP-T03 construye lineas con fecha, hora, servicio, duracion, precio, barbero y estado', () => {
    const ticket = construirTicket(RESERVA);

    assert.equal(ticket.codigo, 'KRAFT-AB12CD34');
    assert.equal(typeof ticket.titulo, 'string');
    assert.ok(ticket.titulo.length > 0);
    assert.ok(ticket.pie.length > 0);

    const porEtiqueta = Object.fromEntries(ticket.lineas.map((l) => [l.etiqueta, l.valor]));
    assert.equal(porEtiqueta.Fecha, '03/11/2026');
    assert.equal(porEtiqueta.Hora, '10:30');
    assert.equal(porEtiqueta.Servicio, 'Corte clasico');
    assert.equal(porEtiqueta['Duracion'], '30 min');
    assert.equal(porEtiqueta.Precio, 'S/ 25.00');
    assert.equal(porEtiqueta.Barbero, 'Luis');
    assert.equal(porEtiqueta.Estado, 'Confirmada');
  });

  test('CP-T04 formatea precios con dos decimales y fecha dd/mm/yyyy', () => {
    const ticket = construirTicket({ ...RESERVA, precio: 7.5, fecha: '2026-01-05' });
    const porEtiqueta = Object.fromEntries(ticket.lineas.map((l) => [l.etiqueta, l.valor]));
    assert.equal(porEtiqueta.Precio, 'S/ 7.50');
    assert.equal(porEtiqueta.Fecha, '05/01/2026');
  });

  test('CP-T05 ticket tolera reserva nula o campos ausentes', () => {
    const ticket = construirTicket(null);
    assert.equal(ticket.codigo, '');
    assert.ok(Array.isArray(ticket.lineas));
    assert.ok(ticket.lineas.length > 0);
    assert.ok(ticket.lineas.every((l) => typeof l.etiqueta === 'string' && typeof l.valor === 'string'));
    const porEtiqueta = Object.fromEntries(ticket.lineas.map((l) => [l.etiqueta, l.valor]));
    assert.equal(porEtiqueta.Barbero, 'cualquiera');
    assert.equal(porEtiqueta.Estado, 'Desconocido');
  });

  test('CP-T06 fecha invalida no inventa una fecha legible', () => {
    const ticket = construirTicket({ ...RESERVA, fecha: '2026-13-45' });
    const porEtiqueta = Object.fromEntries(ticket.lineas.map((l) => [l.etiqueta, l.valor]));
    assert.equal(porEtiqueta.Fecha, '-');
  });
});

describe('ticket-logica - texto para imprimir', () => {
  test('CP-T07 genera texto plano alineado con codigo, lineas y pie', () => {
    const ticket = construirTicket(RESERVA);
    const texto = textoTicketParaImprimir(ticket);

    assert.equal(typeof texto, 'string');
    assert.ok(texto.includes('KRAFT-AB12CD34'));
    assert.ok(texto.includes('Fecha'));
    assert.ok(texto.includes('03/11/2026'));
    assert.ok(texto.includes('S/ 25.00'));
    assert.ok(texto.includes(ticket.pie));

    const lineas = texto.split('\n');
    assert.ok(lineas.length > 5);
    assert.ok(lineas.every((linea) => linea.length <= 48));
  });

  test('CP-T08 texto tolera ticket nulo', () => {
    assert.equal(textoTicketParaImprimir(null), '');
    assert.equal(textoTicketParaImprimir(undefined), '');
  });
});
