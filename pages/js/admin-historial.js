/* =============================================================================
   Barbería Kraft — admin-historial.js (HU14)
   Historial básico de atención por cliente del panel admin:
   - El admin elige un cliente y ve SOLO sus atenciones (RLS
     `historial_admin_all` de 0001_init.sql ya permite leer todo → NO requiere
     migración adicional).
   - Cada atención muestra fecha y servicio; el importe solo cuando forma parte
     del registro (null → '—', NUNCA 'S/ 0.00' como valor inventado).
   - Ordenadas de la más reciente a la más antigua (fecha_atencion DESC).
    - FK historial_atencion.servicio_id ON DELETE SET NULL: si el servicio fue
      retirado del catálogo, la atención NO desaparece y se muestra como
      "Servicio retirado".
    - Si el cliente no tiene atenciones → estado vacío; si falla la consulta →
      estado de error con reintento.
    - Arquitectura testeable: la lógica pura (filtrarClientesNoAdmin,
      ordenarAtencionesDesc, formatearImporte, etiquetaServicio,
      formatearFechaHora) vive en logica/*-logica.js y se testea con
      node:test (docs/TEST-UNIT.md). Este módulo SOLO hace consultas + DOM.
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { $, mostrarToast, estadoCarga, escaparHtml } from './ui.js';
import { mensajeErrorAdmin } from './api.js';
import { svgUse, estadoVacioAdmin, estadoErrorAdmin } from './admin-ui.js';
import { filtrarClientesNoAdmin } from './logica/clientes-logica.js';
import {
  ordenarAtencionesDesc,
  formatearImporte,
  etiquetaServicio,
  formatearFechaHora,
  aCsv,
  nombreArchivoCsv
} from './logica/historial-logica.js';

let clientes = [];
let atencionesVisibles = [];
let clienteActualId = '';

const PLANTILLA = `
  <div class="admin-panel__herramientas">
    <h2>Historial de atención</h2>
    <button type="button" class="btn btn--secundario" id="historial-refrescar">
      ${svgUse('icon-reloj')} Refrescar
    </button>
    <button type="button" class="btn btn--secundario" id="btn-exportar-historial">
      Exportar CSV
    </button>
  </div>

  <div class="campo admin-historial__selector">
    <label for="historial-cliente">Cliente</label>
    <select id="historial-cliente" disabled>
      <option value="">Cargando clientes…</option>
    </select>
  </div>

  <p class="admin-historial__cliente" id="historial-cliente-actual" aria-live="polite"></p>
  <div id="historial-listado" aria-live="polite"></div>
`;

export async function iniciar(contenedor) {
  contenedor.innerHTML = PLANTILLA;

  $('#historial-refrescar').addEventListener('click', cargarClientes);
  $('#btn-exportar-historial').addEventListener('click', exportarCsv);
  $('#historial-cliente').addEventListener('change', (evento) => {
    const id = evento.target.value;
    if (id) cargarHistorial(id);
    else limpiarHistorial();
  });

  await cargarClientes();
}

/* -----------------------------------------------------------------------------
   Selector de clientes (mismo criterio que HU13: excluye cuentas admin)
   ----------------------------------------------------------------------------- */
async function cargarClientes() {
  const select = $('#historial-cliente');
  const zona = $('#historial-listado');

  atencionesVisibles = [];
  clienteActualId = '';
  select.disabled = true;
  select.innerHTML = '<option value="">Cargando clientes…</option>';
  $('#historial-cliente-actual').textContent = '';
  estadoCarga(zona, 'Cargando clientes…');

  try {
    const supabase = getSupabase();
    const [resClientes, resProfiles] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, nombre, email, profile_id')
        .order('nombre', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, rol')
    ]);

    if (resClientes.error) throw resClientes.error;
    if (resProfiles.error) throw resProfiles.error;

    // Mismo criterio HU13 (lógica pura testeada — CP-07): excluye cuentas
    // admin; conserva clientes sin profile_id (perfil borrado → SET NULL).
    clientes = filtrarClientesNoAdmin(resClientes.data ?? [], resProfiles.data ?? []);

    poblarSelector(select);

    if (clientes.length === 0) {
      select.disabled = true;
      estadoVacioAdmin(zona, 'Aún no hay clientes registrados para consultar.', 'icon-usuario');
      return;
    }

    // Identifica al primer cliente y carga su historial por defecto
    select.value = clientes[0].id;
    select.disabled = false;
    await cargarHistorial(clientes[0].id);
  } catch (error) {
    console.error('admin-historial.js — cargarClientes:', error);
    select.disabled = true;
    select.innerHTML = '<option value="">No disponible</option>';
    $('#historial-cliente-actual').textContent = '';
    estadoErrorAdmin(zona, mensajeErrorAdmin(error), cargarClientes);
  }
}

function poblarSelector(select) {
  select.innerHTML = clientes
    .map((cliente) => {
      const etiqueta = cliente.nombre ? `${cliente.nombre} — ${cliente.email}` : cliente.email;
      return `<option value="${escaparHtml(cliente.id)}">${escaparHtml(etiqueta)}</option>`;
    })
    .join('');
}

/* -----------------------------------------------------------------------------
   Historial del cliente seleccionado (más reciente → más antigua)
   ----------------------------------------------------------------------------- */
async function cargarHistorial(clienteId) {
  const zona = $('#historial-listado');
  const cliente = clientes.find((c) => c.id === clienteId);
  clienteActualId = clienteId;
  atencionesVisibles = [];

  // Identificación del cliente seleccionado (HU14-2)
  identificarCliente(cliente);
  estadoCarga(zona, 'Cargando historial…');

  try {
    const supabase = getSupabase();
    // Embed de servicios(nombre): con servicio retirado (servicio_id NULL) el
    // embed llega null y se rotula "Servicio retirado" sin perder la atención.
    const { data, error } = await supabase
      .from('historial_atencion')
      .select('id, fecha_atencion, importe, notas, servicio_id, servicios(nombre)')
      .eq('cliente_id', clienteId)
      .order('fecha_atencion', { ascending: false });

    if (error) throw error;
    // Orden garantizado por lógica pura (CP-11), no solo por el .order() SQL
    renderizarHistorial(ordenarAtencionesDesc(data ?? []));
  } catch (error) {
    console.error('admin-historial.js — cargarHistorial:', error);
    estadoErrorAdmin(zona, mensajeErrorAdmin(error), () => cargarHistorial(clienteId));
  }
}

function renderizarHistorial(atenciones) {
  const zona = $('#historial-listado');
  zona.innerHTML = '';
  atencionesVisibles = atenciones;

  if (atenciones.length === 0) {
    estadoVacioAdmin(zona, 'Este cliente aún no tiene atenciones registradas.', 'icon-reloj');
    return;
  }

  const tabla = document.createElement('table');
  tabla.className = 'tabla-crud';
  tabla.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Fecha</th>
        <th scope="col">Servicio</th>
        <th scope="col">Importe</th>
        <th scope="col">Acciones</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const cuerpo = tabla.querySelector('tbody');
  atenciones.forEach((atencion) => {
    const fila = document.createElement('tr');

    // Servicio (lógica pura CP-13): nombre embebido si existe; si el FK quedó
    // NULL por ON DELETE SET NULL, la atención se conserva y se marca como
    // retirada. El escapeo HTML sigue siendo responsabilidad de la UI.
    const servicio = escaparHtml(etiquetaServicio(atencion));
    const notas = atencion.notas
      ? `<div class="tabla-crud__detalle">${escaparHtml(atencion.notas)}</div>`
      : '';

    // Importe (lógica pura CP-12): solo si forma parte del registro
    // (null/vacío/inválido → '—', no 'S/ 0.00')
    const importe = formatearImporte(atencion.importe);

    fila.innerHTML = `
      <td>${formatearFechaHora(atencion.fecha_atencion)}</td>
      <td>${servicio}${notas}</td>
      <td>${importe}</td>
    `;

    const acciones = document.createElement('td');
    const botonEliminar = document.createElement('button');
    botonEliminar.type = 'button';
    botonEliminar.className = 'btn btn--sm btn--peligro';
    botonEliminar.textContent = 'Eliminar';
    botonEliminar.setAttribute('aria-label', `Eliminar registro ${atencion.id}`);
    botonEliminar.addEventListener('click', () => eliminarAtencion(atencion.id));
    acciones.appendChild(botonEliminar);
    fila.appendChild(acciones);

    cuerpo.appendChild(fila);
  });

  zona.appendChild(tabla);
}

/* -----------------------------------------------------------------------------
   Gestión: borrado (RLS `historial_admin_all`) y exportación de las filas
   actualmente visibles (mismo filtro por cliente que la lista).
   ----------------------------------------------------------------------------- */
async function eliminarAtencion(id) {
  const confirmado = window.confirm(
    `¿Eliminar el registro de atención ${id}? Esta acción no se puede deshacer.`
  );
  if (!confirmado) return;

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('historial_atencion')
      .delete()
      .eq('id', id);
    if (error) throw error;

    await cargarHistorial(clienteActualId);
    mostrarToast('Registro de atención eliminado.', 'exito');
  } catch (error) {
    console.error('admin-historial.js — eliminarAtencion:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
  }
}

function exportarCsv() {
  if (atencionesVisibles.length === 0) {
    mostrarToast('No hay atenciones para exportar.', 'info');
    return;
  }

  const url = URL.createObjectURL(
    new Blob([aCsv(atencionesVisibles)], { type: 'text/csv;charset=utf-8' })
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivoCsv(fechaLocalParaArchivo());
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);

  mostrarToast(`Historial exportado (${atencionesVisibles.length} registros).`, 'exito');
}

function fechaLocalParaArchivo() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/* -----------------------------------------------------------------------------
   Helpers
   ----------------------------------------------------------------------------- */
function identificarCliente(cliente) {
  const el = $('#historial-cliente-actual');
  if (!el) return;
  if (!cliente) {
    el.textContent = '';
    return;
  }
  el.innerHTML = `Historial de <strong>${escaparHtml(cliente.nombre || cliente.email)}</strong> · ${escaparHtml(cliente.email)}`;
}

function limpiarHistorial() {
  $('#historial-cliente-actual').textContent = '';
  atencionesVisibles = [];
  clienteActualId = '';
  const zona = $('#historial-listado');
  zona.innerHTML = '';
  const aviso = document.createElement('p');
  aviso.className = 'nota';
  aviso.textContent = 'Selecciona un cliente para ver su historial.';
  zona.appendChild(aviso);
}

/* Fecha/hora: la formatea la lógica pura importada
   (logica/historial-logica.js → formatearFechaHora). */
