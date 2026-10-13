/* =============================================================================
   Barbería Kraft — admin-clientes.js (HU13)
   Consulta de clientes registrados del panel admin:
   - Lista y cuenta los clientes registrados (nombre + correo como mínimo).
   - Excluye cuentas EXCLUSIVAMENTE administrativas: el trigger handle_new_user
     (0001_init.sql) crea una fila en `clientes` para TODO usuario, así que se
     cruza con `profiles.rol` y se descartan los perfiles con rol 'admin'.
   - RLS de 0001_init.sql: `clientes_admin_all` y `profiles_admin_all` ya
     permiten al admin leer ambas tablas → NO requiere migración adicional.
   - Nunca expone columnas sensibles: el hash de contraseña vive en auth.users
     (inaccesible desde el cliente); aquí se seleccionan columnas explícitas.
   - Si la consulta falla: estado de error + reintento y NINGÚN total, para no
     mostrar un "0" que se lea como resultado válido (CA HU13-6).
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { $, estadoCarga, escaparHtml } from './ui.js';
import { mensajeErrorAdmin } from './api.js';
import { svgUse, estadoVacioAdmin, estadoErrorAdmin } from './admin-ui.js';

let clientes = [];

const PLANTILLA = `
  <div class="admin-panel__herramientas">
    <h2>Clientes registrados</h2>
    <button type="button" class="btn btn--secundario" id="clientes-refrescar">
      ${svgUse('icon-reloj')} Refrescar
    </button>
  </div>

  <p class="admin-panel__total" id="clientes-total" aria-live="polite"></p>
  <div id="clientes-listado" aria-live="polite"></div>
`;

export async function iniciar(contenedor) {
  contenedor.innerHTML = PLANTILLA;

  $('#clientes-refrescar').addEventListener('click', cargarClientes);

  await cargarClientes();
}

/* -----------------------------------------------------------------------------
   Lectura: clientes (todos) + perfiles (rol) para excluir cuentas admin
   ----------------------------------------------------------------------------- */
async function cargarClientes() {
  const zona = $('#clientes-listado');
  const totalEl = $('#clientes-total');

  // Sin total mientras consultamos: si falla, jamás se muestra un 0 falso
  totalEl.textContent = '';
  estadoCarga(zona, 'Cargando clientes…');

  try {
    const supabase = getSupabase();
    // Columnas explícitas y públicas: nombre y correo (mínimo HU13-2). RLS
    // admin permite leer `clientes` y `profiles`.
    const [resClientes, resProfiles] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, nombre, email, telefono, creado_en, profile_id')
        .order('creado_en', { ascending: false }),
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

    // Filtro en cliente: un cliente sin profile_id (perfil borrado → SET NULL)
    // NO es admin, por lo que se conserva.
    clientes = (resClientes.data ?? []).filter(
      (cliente) => !(cliente.profile_id && idsAdministrativos.has(cliente.profile_id))
    );

    renderizarLista();
  } catch (error) {
    console.error('admin-clientes.js — cargarClientes:', error);
    totalEl.textContent = ''; // error: sin total (no un 0 como resultado válido)
    estadoErrorAdmin(zona, mensajeErrorAdmin(error), cargarClientes);
  }
}

/* -----------------------------------------------------------------------------
   Render del total + tabla (mínimo nombre y correo electrónico)
   ----------------------------------------------------------------------------- */
function renderizarLista() {
  const zona = $('#clientes-listado');
  const totalEl = $('#clientes-total');
  zona.innerHTML = '';

  // Total informado = número de clientes tras excluir cuentas admin (HU13-3)
  totalEl.textContent = `Total de clientes registrados: ${clientes.length}`;

  if (clientes.length === 0) {
    estadoVacioAdmin(zona, 'Aún no hay clientes registrados.', 'icon-usuario');
    return;
  }

  const tabla = document.createElement('table');
  tabla.className = 'tabla-crud';
  tabla.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Cliente</th>
        <th scope="col">Correo electrónico</th>
        <th scope="col">Teléfono</th>
        <th scope="col">Registrado</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const cuerpo = tabla.querySelector('tbody');
  clientes.forEach((cliente) => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td><span class="tabla-crud__nombre">${escaparHtml(cliente.nombre || 'Sin nombre')}</span></td>
      <td>${escaparHtml(cliente.email || '—')}</td>
      <td>${cliente.telefono ? escaparHtml(cliente.telefono) : '—'}</td>
      <td>${formatearFecha(cliente.creado_en)}</td>
    `;
    cuerpo.appendChild(fila);
  });

  zona.appendChild(tabla);
}

/* Fecha de registro en formato local es-PE (o "—" si no es válida) */
function formatearFecha(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
