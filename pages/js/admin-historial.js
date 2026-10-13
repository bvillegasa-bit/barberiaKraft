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
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { $, estadoCarga, escaparHtml, formatoSoles } from './ui.js';
import { mensajeErrorAdmin } from './api.js';
import { svgUse, estadoVacioAdmin, estadoErrorAdmin } from './admin-ui.js';

let clientes = [];

const PLANTILLA = `
  <div class="admin-panel__herramientas">
    <h2>Historial de atención</h2>
    <button type="button" class="btn btn--secundario" id="historial-refrescar">
      ${svgUse('icon-reloj')} Refrescar
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

    const idsAdministrativos = new Set(
      (resProfiles.data ?? [])
        .filter((perfil) => perfil.rol === 'admin')
        .map((perfil) => perfil.id)
    );
    clientes = (resClientes.data ?? []).filter(
      (cliente) => !(cliente.profile_id && idsAdministrativos.has(cliente.profile_id))
    );

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
      return `<option value="${cliente.id}">${escaparHtml(etiqueta)}</option>`;
    })
    .join('');
}

/* -----------------------------------------------------------------------------
   Historial del cliente seleccionado (más reciente → más antigua)
   ----------------------------------------------------------------------------- */
async function cargarHistorial(clienteId) {
  const zona = $('#historial-listado');
  const cliente = clientes.find((c) => c.id === clienteId);

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
    renderizarHistorial(data ?? []);
  } catch (error) {
    console.error('admin-historial.js — cargarHistorial:', error);
    estadoErrorAdmin(zona, mensajeErrorAdmin(error), () => cargarHistorial(clienteId));
  }
}

function renderizarHistorial(atenciones) {
  const zona = $('#historial-listado');
  zona.innerHTML = '';

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
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const cuerpo = tabla.querySelector('tbody');
  atenciones.forEach((atencion) => {
    const fila = document.createElement('tr');

    // Servicio: nombre embebido si existe; si el FK quedó NULL por ON DELETE
    // SET NULL, la atención se conserva y se marca como retirada.
    const nombreServicio = atencion.servicios?.nombre;
    const servicio = nombreServicio ? escaparHtml(nombreServicio) : 'Servicio retirado';
    const notas = atencion.notas
      ? `<div class="tabla-crud__detalle">${escaparHtml(atencion.notas)}</div>`
      : '';

    // Importe solo si forma parte del registro (null → '—', no 'S/ 0.00')
    const importe = atencion.importe != null ? formatoSoles(atencion.importe) : '—';

    fila.innerHTML = `
      <td>${formatearFechaHora(atencion.fecha_atencion)}</td>
      <td>${servicio}${notas}</td>
      <td>${importe}</td>
    `;
    cuerpo.appendChild(fila);
  });

  zona.appendChild(tabla);
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
  const zona = $('#historial-listado');
  zona.innerHTML = '';
  const aviso = document.createElement('p');
  aviso.className = 'nota';
  aviso.textContent = 'Selecciona un cliente para ver su historial.';
  zona.appendChild(aviso);
}

function formatearFechaHora(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-PE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}
