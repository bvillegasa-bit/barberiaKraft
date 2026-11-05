/* =============================================================================
   Barbería Kraft — admin-reservas.js (panel · Reservas)
   -----------------------------------------------------------------------------
   Gestión de reservas desde el panel admin:
   - Carga reservas y las cruza con `profiles` (nombre/email) y `clientes`
     (teléfono) por `profile_id`. Primero intenta el embed de PostgREST
     (profiles) y, si falla, hace dos consultas y cruza en memoria.
   - Filtros por fecha (hoy/mañana/todas) y estado; contadores de hoy y
     pendientes; refresco manual y al entrar a la pestaña.
   - Acciones según estado: pendiente → Confirmar/Cancelar · confirmada →
     Atender/Cancelar. Cancelar pide confirmación nativa.
   - La lógica pura vive en logica/admin-reservas-logica.js (testeada) y los
     estados en logica/reserva-logica.js. Este módulo SOLO consulta + DOM.
   - Todo dato se pinta con textContent (nunca innerHTML con datos).
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { $ } from './ui.js';
import { mensajeErrorAdmin } from './api.js';
import { puedeCancelar, estadoReserva } from './logica/reserva-logica.js';
import {
  filtrarReservas,
  contarReservasHoy,
  contarPendientes,
  accionesDisponibles,
  ordenarReservas,
  formatearFecha,
  formatearHora
} from './logica/admin-reservas-logica.js';

const COLUMNAS = 'id, codigo, profile_id, servicio_nombre, fecha, hora, estado, creado_en';
const LIMITE = 300;

const ACCIONES = {
  confirmar: { etiqueta: 'Confirmar', estado: 'confirmada', exito: 'Reserva confirmada.' },
  atender: { etiqueta: 'Atender', estado: 'atendida', exito: 'Reserva marcada como atendida.' },
  cancelar: { etiqueta: 'Cancelar', estado: 'cancelada', exito: 'Reserva cancelada.' }
};

const TRANSICIONES = {
  confirmar: ['pendiente'],
  atender: ['confirmada'],
  cancelar: ['pendiente', 'confirmada']
};

let reservas = [];
let cargando = false;
let temporizadorAviso = null;

function claveEstado(estado) {
  return String(estado ?? '').trim().toLowerCase();
}

export async function iniciar(contenedor) {
  const botonRefrescar = $('#btn-refrescar-reservas');
  const filtroFecha = $('#filtro-fecha-reservas');
  const filtroEstado = $('#filtro-estado-reservas');
  const cuerpo = $('#cuerpo-tabla-reservas');

  if (botonRefrescar) botonRefrescar.addEventListener('click', () => cargarReservas());
  if (filtroFecha) filtroFecha.addEventListener('change', renderizar);
  if (filtroEstado) filtroEstado.addEventListener('change', renderizar);
  if (cuerpo) {
    cuerpo.addEventListener('click', manejarAccion);
  }

  // Refresco al volver a la pestaña (pagina-admin.js emite el evento).
  contenedor.addEventListener('admin:tab-activado', () => {
    if (!cargando) cargarReservas();
  });

  await cargarReservas();
}

/* -----------------------------------------------------------------------------
   Consulta: reservas + perfiles (nombre/email) + teléfonos de clientes
   ----------------------------------------------------------------------------- */
async function consultarReservas() {
  const supabase = getSupabase();

  let respuesta = await supabase
    .from('reservas')
    .select(`${COLUMNAS}, profiles(nombre, email)`)
    .order('fecha', { ascending: false })
    .limit(LIMITE);

  let perfilesPorId = null;

  if (respuesta.error) {
    // Fallback: dos consultas y cruce por profile_id.
    respuesta = await supabase
      .from('reservas')
      .select(COLUMNAS)
      .order('fecha', { ascending: false })
      .limit(LIMITE);
    if (respuesta.error) throw respuesta.error;

    const resPerfiles = await supabase.from('profiles').select('id, nombre, email');
    if (resPerfiles.error) throw resPerfiles.error;
    perfilesPorId = new Map((resPerfiles.data ?? []).map((perfil) => [perfil.id, perfil]));
  }

  const filas = respuesta.data ?? [];
  if (!perfilesPorId) {
    perfilesPorId = new Map(
      filas.filter((fila) => fila.profiles).map((fila) => [fila.profile_id, fila.profiles])
    );
  }

  const telefonos = await cargarTelefonos();

  return filas.map((fila) => {
    const perfil = perfilesPorId.get(fila.profile_id) ?? null;
    const telefono = telefonos.get(fila.profile_id) ?? '';
    return {
      id: fila.id,
      codigo: fila.codigo || '—',
      profile_id: fila.profile_id,
      cliente: perfil?.nombre || perfil?.email || 'Cliente',
      email: perfil?.email || '',
      telefono,
      servicio: fila.servicio_nombre || 'Servicio',
      fecha: fila.fecha,
      hora: fila.hora,
      estado: fila.estado
    };
  });
}

async function cargarTelefonos() {
  try {
    const { data, error } = await getSupabase()
      .from('clientes')
      .select('profile_id, telefono');
    if (error) return new Map();
    return new Map(
      (data ?? [])
        .filter((cliente) => cliente.profile_id)
        .map((cliente) => [cliente.profile_id, cliente.telefono])
    );
  } catch {
    // El teléfono es complementario: si falla, la tabla sigue mostrando '—'.
    return new Map();
  }
}

/* -----------------------------------------------------------------------------
   Carga + render
   ----------------------------------------------------------------------------- */
async function cargarReservas() {
  if (cargando) return;
  cargando = true;
  ocultarAviso();

  const cuerpo = $('#cuerpo-tabla-reservas');
  renderEstadoTabla(cuerpo, 'Cargando reservas…');

  try {
    reservas = ordenarReservas(await consultarReservas());
    renderizar();
  } catch (error) {
    console.error('admin-reservas.js — cargarReservas:', error);
    renderErrorTabla(cuerpo, mensajeErrorAdmin(error));
  } finally {
    cargando = false;
  }
}

function renderizar() {
  const cuerpo = $('#cuerpo-tabla-reservas');
  const vacio = $('#reservas-vacio');
  if (!cuerpo) return;

  const filtroFecha = $('#filtro-fecha-reservas');
  const filtroEstado = $('#filtro-estado-reservas');
  const lista = filtrarReservas(reservas, {
    fecha: filtroFecha?.value || 'todas',
    estado: filtroEstado?.value || 'todos',
    hoy: new Date()
  });

  cuerpo.innerHTML = '';

  if (vacio) vacio.hidden = lista.length !== 0;

  lista.forEach((reserva) => {
    cuerpo.appendChild(crearFila(reserva));
  });

  actualizarContadores();
}

function crearFila(reserva) {
  const fila = document.createElement('tr');
  fila.dataset.id = reserva.id;

  fila.appendChild(celda(reserva.codigo, 'reserva-codigo'));

  const cliente = document.createElement('td');
  const nombre = document.createElement('span');
  nombre.className = 'tabla-crud__nombre';
  nombre.textContent = reserva.cliente || 'Cliente';
  cliente.appendChild(nombre);
  if (reserva.email) {
    const email = document.createElement('div');
    email.className = 'tabla-crud__detalle';
    email.textContent = reserva.email;
    cliente.appendChild(email);
  }
  fila.appendChild(cliente);

  fila.appendChild(celda(reserva.telefono || '—', 'reserva-telefono'));
  fila.appendChild(celda(reserva.servicio || 'Servicio', 'reserva-servicio'));
  fila.appendChild(celda(formatearFecha(reserva.fecha), 'reserva-fecha'));
  fila.appendChild(celda(formatearHora(reserva.hora), 'reserva-hora'));

  const celdaEstado = document.createElement('td');
  const info = estadoReserva(reserva.estado);
  const badge = document.createElement('span');
  badge.className = `badge-estado ${info.clase}`;
  badge.textContent = info.etiqueta;
  celdaEstado.appendChild(badge);
  fila.appendChild(celdaEstado);

  const celdaAcciones = document.createElement('td');
  const acciones = accionesDisponibles(reserva.estado);
  if (acciones.length === 0) {
    celdaAcciones.textContent = '—';
  } else {
    const grupo = document.createElement('div');
    grupo.className = 'tabla-crud__acciones';
    acciones.forEach((accion) => {
      const config = ACCIONES[accion];
      if (!config) return;
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = `btn btn--sm btn--secundario${accion === 'cancelar' ? ' btn--cancelar' : ''}`;
      boton.dataset.accion = accion;
      boton.dataset.id = reserva.id;
      boton.textContent = config.etiqueta;
      if (accion === 'cancelar') {
        boton.setAttribute('aria-label', `Cancelar reserva ${reserva.codigo}`);
      }
      grupo.appendChild(boton);
    });
    celdaAcciones.appendChild(grupo);
  }
  fila.appendChild(celdaAcciones);

  return fila;
}

function celda(texto, clase) {
  const td = document.createElement('td');
  if (clase) td.className = clase;
  td.textContent = String(texto ?? '—');
  return td;
}

/* -----------------------------------------------------------------------------
   Acciones por fila con transiciones controladas
   ----------------------------------------------------------------------------- */
async function manejarAccion(evento) {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;

  const { accion, id } = boton.dataset;
  const config = ACCIONES[accion];
  const reserva = reservas.find((item) => item.id === id);

  if (!config || !reserva) return;
  if (!(TRANSICIONES[accion] ?? []).includes(claveEstado(reserva.estado))) return;
  if (accion === 'cancelar') {
    if (!puedeCancelar(reserva.estado)) return;
    if (!window.confirm(`¿Cancelar la reserva ${reserva.codigo || ''}?`)) return;
  }

  boton.disabled = true;

  try {
    const { error } = await getSupabase()
      .from('reservas')
      .update({ estado: config.estado })
      .eq('id', id);
    if (error) throw error;

    reserva.estado = config.estado;
    renderizar();
    mostrarAviso(config.exito, 'exito');
  } catch (error) {
    console.error(`admin-reservas.js — acción ${accion}:`, error);
    boton.disabled = false;
    mostrarAviso(mensajeErrorAdmin(error), 'error');
  }
}

/* -----------------------------------------------------------------------------
   Contadores (KPIs) y avisos
   ----------------------------------------------------------------------------- */
function actualizarContadores() {
  const hoy = new Date();
  const kpiHoy = $('#kpi-reservas-hoy');
  const kpiPendientes = $('#kpi-reservas-pendientes');
  if (kpiHoy) kpiHoy.textContent = String(contarReservasHoy(reservas, hoy));
  if (kpiPendientes) kpiPendientes.textContent = String(contarPendientes(reservas));
}

function mostrarAviso(texto, tipo) {
  const aviso = $('#alerta-reservas');
  if (!aviso) return;

  aviso.textContent = String(texto ?? '');
  aviso.className = `admin-reservas__alerta admin-reservas__alerta--${tipo}`;
  aviso.hidden = false;

  if (temporizadorAviso) clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(ocultarAviso, 4500);
}

function ocultarAviso() {
  const aviso = $('#alerta-reservas');
  if (!aviso) return;
  aviso.hidden = true;
  aviso.textContent = '';
}

/* -----------------------------------------------------------------------------
   Estados de la tabla (carga / error)
   ----------------------------------------------------------------------------- */
function renderEstadoTabla(cuerpo, mensaje) {
  if (!cuerpo) return;
  cuerpo.innerHTML = '';
  const fila = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 8;
  td.className = 'admin-reservas__estado-tabla';
  td.textContent = mensaje;
  fila.appendChild(td);
  cuerpo.appendChild(fila);

  const vacio = $('#reservas-vacio');
  if (vacio) vacio.hidden = true;
}

function renderErrorTabla(cuerpo, mensaje) {
  if (!cuerpo) return;
  cuerpo.innerHTML = '';
  const fila = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 8;
  td.className = 'admin-reservas__estado-tabla';

  const texto = document.createElement('p');
  texto.textContent = mensaje;
  td.appendChild(texto);

  const reintentar = document.createElement('button');
  reintentar.type = 'button';
  reintentar.className = 'btn btn--secundario btn--sm';
  reintentar.textContent = 'Reintentar';
  reintentar.addEventListener('click', cargarReservas);
  td.appendChild(reintentar);

  fila.appendChild(td);
  cuerpo.appendChild(fila);

  const vacio = $('#reservas-vacio');
  if (vacio) vacio.hidden = true;
}
