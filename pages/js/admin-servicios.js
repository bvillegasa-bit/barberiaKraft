/* =============================================================================
   Barbería Kraft — admin-servicios.js (T25)
   CRUD de servicios del panel admin (design §8.3.8):
   listar (incluye inactivos — el público solo ve activos, S-RF01-2),
   crear, editar, activar/desactivar y eliminar.
   - Validación en el cliente con validacion.js (RNF03) + mensajes junto al
     campo (CA-RNF04-3); la BD revalida (CHECK precio > 0, duración > 0).
   - Errores de BD en español vía mensajeErrorAdmin (api.js).
   - El DELETE respeta la FK: sillas.servicio_id → SET NULL (0001_init.sql).
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { $, mostrarToast, mostrarErrorCampo, limpiarErrorCampo, estadoCarga, escaparHtml, formatoSoles } from './ui.js';
import { validarNombre, validarPrecio, validarEnteroPositivo } from './validacion.js';
import { mensajeErrorAdmin } from './api.js';
import { svgUse, estadoVacioAdmin, estadoErrorAdmin } from './admin-ui.js';

let registros = [];
let editandoId = null;

const PLANTILLA = `
  <div class="admin-panel__herramientas">
    <h2>Servicios</h2>
    <button type="button" class="btn btn--primario" id="servicios-nuevo">
      ${svgUse('icon-editar')} Nuevo servicio
    </button>
  </div>

  <form id="form-servicio" class="panel-form" novalidate hidden>
    <h3 class="panel-form__titulo" id="titulo-form-servicio">Nuevo servicio</h3>
    <div class="panel-form__fila panel-form__fila--2">
      <div class="campo campo--completo">
        <label for="servicio-nombre">Nombre *</label>
        <input type="text" id="servicio-nombre" name="nombre" maxlength="80" autocomplete="off" required>
      </div>
      <div class="campo">
        <label for="servicio-precio">Precio (S/) *</label>
        <input type="number" id="servicio-precio" name="precio_soles" min="0.01" step="0.01" inputmode="decimal" required>
      </div>
      <div class="campo">
        <label for="servicio-duracion">Duración (min) *</label>
        <input type="number" id="servicio-duracion" name="duracion_min" min="1" step="1" inputmode="numeric" required>
      </div>
    </div>
    <div class="campo">
      <label for="servicio-descripcion">Descripción</label>
      <textarea id="servicio-descripcion" name="descripcion" rows="3" maxlength="300"></textarea>
    </div>
    <div class="panel-form__acciones">
      <button type="submit" class="btn btn--primario">Guardar</button>
      <button type="button" class="btn btn--secundario" id="servicio-cancelar">Cancelar</button>
    </div>
  </form>

  <div id="servicios-listado" aria-live="polite"></div>
`;

export async function iniciar(contenedor) {
  contenedor.innerHTML = PLANTILLA;

  const form = $('#form-servicio');
  const botonNuevo = $('#servicios-nuevo');

  // Limpia el error del campo apenas el admin corrige (CA-RNF04-3)
  ['#servicio-nombre', '#servicio-precio', '#servicio-duracion'].forEach((selector) => {
    $(selector).addEventListener('input', () => limpiarErrorCampo($(selector)));
  });

  botonNuevo.addEventListener('click', abrirFormularioNuevo);
  $('#servicio-cancelar').addEventListener('click', cerrarFormulario);
  form.addEventListener('submit', guardarServicio);

  await cargarServicios();
}

/* -----------------------------------------------------------------------------
   Lectura (admin: TODOS los servicios, activos e inactivos)
   ----------------------------------------------------------------------------- */
async function cargarServicios() {
  const zona = $('#servicios-listado');
  estadoCarga(zona, 'Cargando servicios…');
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('servicios')
      .select('id, nombre, descripcion, precio_soles, duracion_min, activo')
      .order('nombre', { ascending: true });

    if (error) throw error;
    registros = data ?? [];
    renderizarLista();
  } catch (error) {
    console.error('admin-servicios.js — cargarServicios:', error);
    estadoErrorAdmin(zona, mensajeErrorAdmin(error), cargarServicios);
  }
}

/* -----------------------------------------------------------------------------
   Render de tabla (el estado lleva texto + badge, no solo color — RNF08)
   ----------------------------------------------------------------------------- */
function renderizarLista() {
  const zona = $('#servicios-listado');
  zona.innerHTML = '';

  if (registros.length === 0) {
    estadoVacioAdmin(zona, 'Aún no hay servicios. Crea el primero.', 'icon-navaja');
    return;
  }

  const tabla = document.createElement('table');
  tabla.className = 'tabla-crud';
  tabla.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Servicio</th>
        <th scope="col">Precio</th>
        <th scope="col">Duración</th>
        <th scope="col">Estado</th>
        <th scope="col">Acciones</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const cuerpo = tabla.querySelector('tbody');
  registros.forEach((servicio) => {
    const fila = document.createElement('tr');
    if (!servicio.activo) fila.classList.add('inactivo');
    fila.innerHTML = `
      <td>
        <span class="tabla-crud__nombre">${escaparHtml(servicio.nombre)}</span>
        ${servicio.descripcion ? `<div class="tabla-crud__detalle">${escaparHtml(servicio.descripcion)}</div>` : ''}
      </td>
      <td>${formatoSoles(servicio.precio_soles)}</td>
      <td>${Number(servicio.duracion_min) || 30} min</td>
      <td><span class="badge-estado ${servicio.activo ? 'badge-estado--activo' : 'badge-estado--inactivo'}">${servicio.activo ? 'Activo' : 'Inactivo'}</span></td>
    `;

    const celdaAcciones = document.createElement('td');
    const acciones = document.createElement('div');
    acciones.className = 'tabla-crud__acciones';

    acciones.appendChild(botonIcono('icon-editar', `Editar ${servicio.nombre}`, () => editarServicio(servicio.id)));
    acciones.appendChild(botonIcono(
      servicio.activo ? 'icon-candado' : 'icon-check',
      servicio.activo ? `Desactivar ${servicio.nombre}` : `Activar ${servicio.nombre}`,
      () => alternarServicio(servicio.id)
    ));
    acciones.appendChild(botonIcono('icon-borrar', `Eliminar ${servicio.nombre}`, () => eliminarServicio(servicio.id), true));

    celdaAcciones.appendChild(acciones);
    fila.appendChild(celdaAcciones);
    cuerpo.appendChild(fila);
  });

  zona.appendChild(tabla);
}

/* -----------------------------------------------------------------------------
   Crear / actualizar
   ----------------------------------------------------------------------------- */
async function guardarServicio(evento) {
  evento.preventDefault();

  const nombre = $('#servicio-nombre').value.trim();
  const descripcion = $('#servicio-descripcion').value.trim();
  const precio = $('#servicio-precio').value;
  const duracion = $('#servicio-duracion').value;

  // Validación en cliente (RNF03) — mensajes junto al campo
  const errores = {
    nombre: validarNombre(nombre),
    precio: validarPrecio(precio),
    duracion: validarEnteroPositivo(duracion)
  };
  let valido = true;
  Object.entries(errores).forEach(([campo, mensaje]) => {
    const input = $(`#servicio-${campo}`);
    if (mensaje) {
      mostrarErrorCampo(input, mensaje);
      valido = false;
    }
  });
  if (!valido) return;

  const boton = evento.target.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const supabase = getSupabase();
    const payload = {
      nombre,
      descripcion,
      precio_soles: Number(precio),
      duracion_min: Number(duracion)
    };

    let resultado;
    if (editandoId) {
      // Al editar se conserva el estado activo actual (el toggle es aparte)
      resultado = await supabase.from('servicios').update(payload).eq('id', editandoId);
      if (!resultado.error) mostrarToast('Servicio actualizado.', 'exito');
    } else {
      resultado = await supabase.from('servicios').insert({ ...payload, activo: true });
      if (!resultado.error) mostrarToast('Servicio creado.', 'exito');
    }

    if (resultado.error) throw resultado.error;

    cerrarFormulario();
    cargarServicios();
  } catch (error) {
    console.error('admin-servicios.js — guardarServicio:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
  } finally {
    boton.disabled = false;
  }
}

/* -----------------------------------------------------------------------------
   Editar / alternar estado / eliminar
   ----------------------------------------------------------------------------- */
function editarServicio(id) {
  const servicio = registros.find((r) => r.id === id);
  if (!servicio) return;

  editandoId = id;
  $('#titulo-form-servicio').textContent = 'Editar servicio';
  $('#servicio-nombre').value = servicio.nombre;
  $('#servicio-descripcion').value = servicio.descripcion || '';
  $('#servicio-precio').value = servicio.precio_soles;
  $('#servicio-duracion').value = servicio.duracion_min;

  $('#form-servicio').hidden = false;
  $('#servicio-nombre').focus();
}

async function alternarServicio(id) {
  const servicio = registros.find((r) => r.id === id);
  if (!servicio) return;
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('servicios')
      .update({ activo: !servicio.activo })
      .eq('id', id);
    if (error) throw error;
    mostrarToast(
      servicio.activo ? 'Servicio desactivado (oculto al público).' : 'Servicio activado.',
      'exito'
    );
    cargarServicios();
  } catch (error) {
    console.error('admin-servicios.js — alternarServicio:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
  }
}

async function eliminarServicio(id) {
  const servicio = registros.find((r) => r.id === id);
  if (!servicio) return;

  const confirmado = confirm(
    `¿Eliminar "${servicio.nombre}"? Esta acción no se puede deshacer. ` +
    'Las sillas que lo tengan asignado quedarán sin servicio.'
  );
  if (!confirmado) return;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('servicios').delete().eq('id', id);
    if (error) throw error;
    mostrarToast('Servicio eliminado.', 'exito');
    if (editandoId === id) cerrarFormulario();
    cargarServicios();
  } catch (error) {
    console.error('admin-servicios.js — eliminarServicio:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
  }
}

/* -----------------------------------------------------------------------------
   Helpers del formulario
   ----------------------------------------------------------------------------- */
function abrirFormularioNuevo() {
  editandoId = null;
  $('#titulo-form-servicio').textContent = 'Nuevo servicio';
  $('#form-servicio').reset();
  $('#form-servicio').hidden = false;
  $('#servicio-nombre').focus();
}

function cerrarFormulario() {
  editandoId = null;
  $('#form-servicio').reset();
  $('#form-servicio').hidden = true;
}

/* Botón de acción compacto del CRUD (≥44px — RNF05) */
function botonIcono(nombreIcono, etiqueta, alClic, peligro = false) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = `btn-icono${peligro ? ' btn-icono--peligro' : ''}`;
  boton.setAttribute('aria-label', etiqueta);
  boton.title = etiqueta;
  boton.innerHTML = svgUse(nombreIcono);
  boton.addEventListener('click', alClic);
  return boton;
}