/* =============================================================================
   Barberia Kraft - logica/ticket-logica.js (Ciclo 6 - logica PURA)
   -----------------------------------------------------------------------------
   Formato del ticket de reserva. SIN DOM, SIN Supabase y SIN `window`.
   El texto que devuelve `textoTicketParaImprimir` sirve tanto para
   `window.print()` como para descargar un .txt (la capa UI decide).
   ============================================================================= */

import { esFechaValida } from './horario-logica.js';
import { estadoReserva } from './reserva-logica.js';

const ANCHO_TICKET = 48;

function fechaLegible(fecha) {
  const texto = String(fecha ?? '').trim();
  if (!esFechaValida(texto)) return '-';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
}

function precioLegible(precio) {
  const numero = Number(precio);
  return `S/ ${(Number.isFinite(numero) ? numero : 0).toFixed(2)}`;
}

function duracionLegible(duracion) {
  const numero = Number(duracion);
  return `${Number.isFinite(numero) && numero > 0 ? numero : 0} min`;
}

function centrar(texto, ancho) {
  const limpio = String(texto ?? '');
  if (limpio.length >= ancho) return limpio.slice(0, ancho);
  const izquierda = Math.floor((ancho - limpio.length) / 2);
  return `${' '.repeat(izquierda)}${limpio}`;
}

/**
 * Normaliza un codigo de ticket a 'KRAFT-XXXXXXXX'.
 * Acepta el codigo crudo, en minusculas o con separadores. Null/vacio -> ''.
 * @param {string|null|undefined} codigo
 * @returns {string}
 */
export function formatearCodigoTicket(codigo) {
  const limpio = String(codigo ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!limpio) return '';

  const cuerpo = limpio.startsWith('KRAFT') ? limpio.slice(5) : limpio;
  if (!cuerpo) return '';

  return `KRAFT-${cuerpo}`;
}

/**
 * Construye la estructura del ticket a partir de una reserva.
 * Devuelve `{ codigo, titulo, lineas: [{etiqueta, valor}], pie }`.
 * Tolerante a `reserva` nula o con campos ausentes.
 * @param {object|null|undefined} reserva
 * @returns {{ codigo: string, titulo: string, lineas: Array<{etiqueta: string, valor: string}>, pie: string }}
 */
export function construirTicket(reserva) {
  const datos = reserva && typeof reserva === 'object' ? reserva : {};
  const estado = estadoReserva(datos.estado);

  return {
    codigo: formatearCodigoTicket(datos.codigo),
    titulo: 'Barberia Kraft',
    lineas: [
      { etiqueta: 'Fecha', valor: fechaLegible(datos.fecha) },
      { etiqueta: 'Hora', valor: String(datos.hora ?? '').trim() || '-' },
      {
        etiqueta: 'Servicio',
        valor: String(datos.servicio_nombre ?? '').trim() || '-'
      },
      { etiqueta: 'Duracion', valor: duracionLegible(datos.duracion_min) },
      { etiqueta: 'Precio', valor: precioLegible(datos.precio) },
      {
        etiqueta: 'Barbero',
        valor: String(datos.barbero ?? '').trim() || 'cualquiera'
      },
      { etiqueta: 'Estado', valor: estado.etiqueta }
    ],
    pie: 'Gracias por tu reserva.'
  };
}

/**
 * Renderiza el ticket como texto plano alineado (48 columnas).
 * @param {{ codigo?: string, titulo?: string, lineas?: Array<{etiqueta: string, valor: string}>, pie?: string }|null|undefined} ticket
 * @returns {string} Texto listo para imprimir o descargar; '' si no hay ticket.
 */
export function textoTicketParaImprimir(ticket) {
  if (!ticket || typeof ticket !== 'object') return '';

  const ancho = ANCHO_TICKET;
  const separador = (caracter) => caracter.repeat(ancho);
  const filas = [separador('=')];

  if (ticket.titulo) filas.push(centrar(ticket.titulo, ancho));
  if (ticket.codigo) filas.push(centrar(ticket.codigo, ancho));
  filas.push(separador('='));

  for (const linea of Array.isArray(ticket.lineas) ? ticket.lineas : []) {
    const texto = `${String(linea?.etiqueta ?? '')}: ${String(linea?.valor ?? '')}`;
    filas.push(texto.length > ancho ? texto.slice(0, ancho) : texto);
  }

  filas.push(separador('-'));
  if (ticket.pie) filas.push(String(ticket.pie).slice(0, ancho));
  filas.push(separador('='));

  return filas.join('\n');
}
