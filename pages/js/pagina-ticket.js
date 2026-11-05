/* =============================================================================
   Barbería Kraft — pagina-ticket.js
   Página del ticket de una reserva. Lee `?codigo=` y consulta Supabase con RLS
   (la política ya limita las filas al dueño). Toda la vista se construye con
   textContent: nunca innerHTML con datos. Sin handlers ni estilos inline (CSP).
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { obtenerRol } from './auth.js';
import {
  construirTicket,
  formatearCodigoTicket,
  textoTicketParaImprimir
} from './logica/ticket-logica.js';
import { estadoReserva } from './logica/reserva-logica.js';

const CAMPOS = 'codigo, servicio_nombre, duracion_min, precio, fecha, hora, barbero, estado, creado_en';
const ESTADOS_TICKET = new Set(['pendiente', 'confirmada', 'atendida', 'cancelada', 'desconocido']);

const elCarga = document.getElementById('estado-carga');
const elTicket = document.getElementById('ticket');
const elCodigo = document.getElementById('ticket-codigo');
const elLineas = document.getElementById('ticket-lineas');
const elPie = document.getElementById('ticket-pie');
const elError = document.getElementById('ticket-error');
const elSesion = document.getElementById('ticket-sesion');
const elTitulo = document.getElementById('ticket-titulo');
const btnImprimir = document.getElementById('btn-imprimir');
const btnDescargar = document.getElementById('btn-descargar');

let ticketActual = null;

function ocultarCarga() {
  if (elCarga) elCarga.hidden = true;
}

function mostrarError(mensaje) {
  ocultarCarga();
  if (elTicket) elTicket.hidden = true;
  if (elError) {
    elError.textContent = mensaje;
    elError.hidden = false;
  }
}

function limpiarLineas() {
  while (elLineas.firstChild) elLineas.removeChild(elLineas.firstChild);
}

function pintarTicket(ticket, estadoCrudo) {
  ticketActual = ticket;

  elCodigo.textContent = ticket.codigo || '—';
  limpiarLineas();

  for (const linea of ticket.lineas) {
    const fila = document.createElement('div');
    fila.className = 'ticket__linea';

    const etiqueta = document.createElement('dt');
    etiqueta.className = 'ticket__etiqueta';
    etiqueta.textContent = linea.etiqueta;

    const valor = document.createElement('dd');
    valor.className = 'ticket__valor';
    valor.textContent = linea.valor;

    if (linea.etiqueta === 'Estado') {
      fila.classList.add('ticket__linea--estado');
    }

    fila.append(etiqueta, valor);
    elLineas.appendChild(fila);
  }

  elPie.textContent = ticket.pie || '';

  elTicket.classList.remove(
    ...Array.from(elTicket.classList).filter((c) => c.startsWith('ticket--'))
  );
  const info = estadoReserva(estadoCrudo);
  const sufijo = String(info.clase || '').replace(/^estado--/, '');
  const claseEstado = ESTADOS_TICKET.has(sufijo) ? sufijo : 'desconocido';
  elTicket.classList.add(`ticket--${claseEstado}`);

  ocultarCarga();
  elError.hidden = true;
  elTicket.hidden = false;
  elTitulo.focus({ preventScroll: false });
}

function mostrarCtaLogin(codigo) {
  if (!elSesion) return;
  limpiarNodo(elSesion);

  const texto = document.createElement('p');
  texto.textContent = 'Inicia sesión con la cuenta que hizo la reserva para ver todos los detalles.';

  const enlace = document.createElement('a');
  enlace.className = 'btn btn--primario btn--sm';
  const siguiente = `/ticket?codigo=${encodeURIComponent(codigo)}`;
  enlace.href = `/login?next=${encodeURIComponent(siguiente)}`;
  enlace.textContent = 'Iniciar sesión';

  elSesion.append(texto, enlace);
  elSesion.hidden = false;
}

function limpiarNodo(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
}

function descargarTicket() {
  if (!ticketActual) return;

  const texto = textoTicketParaImprimir(ticketActual);
  if (!texto) return;

  const nombre = String(ticketActual.codigo || 'ticket').replace(/[^A-Z0-9-]/gi, '');
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `ticket-${nombre || 'reserva'}.txt`;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function cargar() {
  const codigo = (new URLSearchParams(window.location.search).get('codigo') || '').trim();

  if (!codigo) {
    mostrarError('No encontramos tu ticket.');
    return;
  }

  const codigoTexto = formatearCodigoTicket(codigo);
  if (!codigoTexto) {
    mostrarError('No encontramos tu ticket.');
    return;
  }

  let sesion = null;
  try {
    const supabase = getSupabase();
    const { data: sesionData } = await supabase.auth.getSession();
    sesion = sesionData?.session || null;

    const { data, error } = await supabase
      .from('reservas')
      .select(CAMPOS)
      .eq('codigo', codigo)
      .maybeSingle();

    if (error) {
      mostrarError('No pudimos cargar tu ticket. Inténtalo de nuevo.');
      return;
    }

    if (!data) {
      if (sesion) {
        mostrarError('No pudimos cargar tu ticket. Inténtalo de nuevo.');
        return;
      }

      pintarTicket(construirTicket({ codigo }), null);
      mostrarCtaLogin(codigo);
      return;
    }

    pintarTicket(construirTicket(data), data.estado);

    if (!sesion) {
      mostrarCtaLogin(codigo);
    }
  } catch {
    mostrarError('No pudimos cargar tu ticket. Inténtalo de nuevo.');
    return;
  }

  if (sesion) {
    const rol = await obtenerRol();
    const btnPanel = document.getElementById('volver-panel');
    if (rol === 'admin' && btnPanel) btnPanel.hidden = false;
  }
}

if (btnImprimir) {
  btnImprimir.addEventListener('click', () => window.print());
}

if (btnDescargar) {
  btnDescargar.addEventListener('click', descargarTicket);
}

cargar();
