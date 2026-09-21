/* =============================================================================
   Barbería Kraft — admin-promociones.js (T26)
   CRUD de promociones del panel admin (design §8.3.8):
   listar (incluye inactivas — el público solo ve activas, S-RF05-2),
   crear, editar, activar/desactivar y eliminar.
   - precio_oferta_soles OPCIONAL: vacío se guarda como NULL (sin precio
     oferta, solo beneficio/descuento descrito) — CA-RF07.
   - Validación en cliente (validacion.js) + revalidación de la BD.
   - Errores de BD en español vía mensajeErrorAdmin (api.js).
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { $, mostrarToast, mostrarErrorCampo, limpiarErrorCampo, estadoCarga, escaparHtml, formatoSoles } from './ui.js';
import { validarTitulo, validarPrecio } from './validacion.js';
import { mensajeErrorAdmin } from './api.js';
import { svgUse, estadoVacioAdmin, estadoErrorAdmin } from './admin-ui.js';

let registros = [];
let editandoId = null;

const PLANTILLA = `
  <div class="admin-panel__herramientas">
    <h2>Promociones</h2>
    <button type="button" class="btn btn--primario" id="promos-nuevo">
      ${svgUse('icon-estrella')} Nueva promoción
    </button>
  </div>

  <form id="form-promocion" class="panel-form" novalidate hidden>
    <h3 class="panel-form__titulo" id="titulo-form-promocion">Nueva promoción</h3>
    <div class="panel-form__fila panel-form__fila--2">
      <div class="campo campo--completo">
        <label for="promo-titulo">Título *</label>
        <input type="text" id="promo-titulo" name="titulo" maxlength="100" autocomplete="off" required>
      </div>
      <div class="campo">
        <label for="promo-oferta">Precio oferta (S/) <span class="ayuda">opcional</span></label>
        <input type="number" id="promo-oferta" name="precio_oferta_soles" min="0.01" step="0.01" inputmode="decimal">
      </div>
      <div class="campo">
        <label for="promo-beneficio">Beneficio</label>
        <input type="text" id="promo-beneficio" name="beneficio" maxlength="120" autocomplete="off">
      </div>
    </div>
    <div class="campo">
      <label for="promo-descripcion">Descripción</label>
      <textarea id="promo-descripcion" name="descripcion" rows="3" maxlength="300"></textarea>
    </div>
    <div class="panel-form__acciones">
      <button type="submit" class="btn btn--primario">Guardar</button>
      <button type="button" class="btn btn--secundario" id="promo-cancelar">Cancelar</button>
    </div>
  </form>

  <div id="promos-listado" aria-live="polite"></div>
`;

export async function iniciar(contenedor) {
  contenedor.innerHTML = PLANTILLA;

  const form = $('#form-promocion');

  ['#promo-titulo', '#promo-oferta'].forEach((selector) => {
    $(selector).addEventListener('input', () => limpiarErrorCampo($(selector)));
  });

  $('#promos-nuevo').addEventListener('click', abrirFormularioNueva);
  $('#promo-cancelar').addEventListener('click', cerrarFormulario);
  form.addEventListener('submit', guardarPromocion);

  await cargarPromociones();
}

/* -----------------------------------------------------------------------------
   Lectura (admin: TODAS, activas e inactivas) — más recientes primero
   ----------------------------------------------------------------------------- */
async function cargarPromociones() {
  const zona = $('#promos-listado');
  estadoCarga(zona, 'Cargando promociones…');
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('promociones')
      .select('id, titulo, descripcion, beneficio, precio_oferta_soles, activo')
      .order('creado_en', { ascending: false });

    if (error) throw error;
    registros = data ?? [];
    renderizarLista();
  } catch (error) {
    console.error('admin-promociones.js — cargarPromociones:', error);
    estadoErrorAdmin(zona, mensajeErrorAdmin(error), cargarPromociones);
  }
}

/* -----------------------------------------------------------------------------
   Render de tabla
   ----------------------------------------------------------------------------- */
function renderizarLista() {
  const zona = $('#promos-listado');
  zona.innerHTML = '';

  if (registros.length === 0) {
    estadoVacioAdmin(zona, 'Aún no hay promociones. Crea la primera.', 'icon-estrella');
    return;
  }

  const tabla = document.createElement('table');
  tabla.className = 'tabla-crud';
  tabla.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Promoción</th>
        <th scope="col">Beneficio</th>
        <th scope="col">Precio oferta</th>
        <th scope="col">Estado</th>
        <th scope="col">Acciones</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const cuerpo = tabla.querySelector('tbody');
  registros.forEach((promo) => {
    const fila = document.createElement('tr');
    if (!promo.activo) fila.classList.add('inactivo');
    fila.innerHTML = `
      <td>
        <span class="tabla-crud__nombre">${escaparHtml(promo.titulo)}</span>
        ${promo.descripcion ? `<div class="tabla-crud__detalle">${escaparHtml(promo.descripcion)}</div>` : ''}
      </td>
      <td>${promo.beneficio ? escaparHtml(promo.beneficio) : '—'}</td>
      <td>${promo.precio_oferta_soles ? formatoSoles(promo.precio_oferta_soles) : '—'}</td>
      <td><span class="badge-estado ${promo.activo ? 'badge-estado--activo' : 'badge-estado--inactivo'}">${promo.activo ? 'Activa' : 'Inactiva'}</span></td>
    `;

    const celdaAcciones = document.createElement('td');
    const acciones = document.createElement('div');
    acciones.className = 'tabla-crud__acciones';

    acciones.appendChild(botonIcono('icon-editar', `Editar ${promo.titulo}`, () => editarPromocion(promo.id)));
    acciones.appendChild(botonIcono(
      promo.activo ? 'icon-candado' : 'icon-check',
      promo.activo ? `Desactivar ${promo.titulo}` : `Activar ${promo.titulo}`,
      () => alternarPromocion(promo.id)
    ));
    acciones.appendChild(botonIcono('icon-borrar', `Eliminar ${promo.titulo}`, () => eliminarPromocion(promo.id), true));

    celdaAcciones.appendChild(acciones);
    fila.appendChild(celdaAcciones);
    cuerpo.appendChild(fila);
  });

  zona.appendChild(tabla);
}

/* -----------------------------------------------------------------------------
   Crear / actualizar
   ----------------------------------------------------------------------------- */
async function guardarPromocion(evento) {
  evento.preventDefault();

  const titulo = $('#promo-titulo').value.trim();
  const descripcion = $('#promo-descripcion').value.trim();
  const beneficio = $('#promo-beneficio').value.trim();
  const oferta = $('#promo-oferta').value;

  // El precio oferta es opcional: solo se valida cuando trae valor
  const errores = {
    titulo: validarTitulo(titulo),
    oferta: oferta !== '' ? validarPrecio(oferta) : null
  };
  let valido = true;
  Object.entries(errores).forEach(([campo, mensaje]) => {
    if (!mensaje) return;
    const input = $(`#promo-${campo}`);
    mostrarErrorCampo(input, mensaje);
    valido = false;
  });
  if (!valido) return;

  const boton = evento.target.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const supabase = getSupabase();
    const payload = {
      titulo,
      descripcion,
      beneficio,
      precio_oferta_soles: oferta !== '' ? Number(oferta) : null
    };

    let resultado;
    if (editandoId) {
      resultado = await supabase.from('promociones').update(payload).eq('id', editandoId);
      if (!resultado.error) mostrarToast('Promoción actualizada.', 'exito');
    } else {
      resultado = await supabase.from('promociones').insert({ ...payload, activo: true });
      if (!resultado.error) mostrarToast('Promoción creada.', 'exito');
    }

    if (resultado.error) throw resultado.error;

    cerrarFormulario();
    cargarPromociones();
  } catch (error) {
    console.error('admin-promociones.js — guardarPromocion:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
  } finally {
    boton.disabled = false;
  }
}

/* -----------------------------------------------------------------------------
   Editar / alternar estado / eliminar
   ----------------------------------------------------------------------------- */
function editarPromocion(id) {
  const promo = registros.find((r) => r.id === id);
  if (!promo) return;

  editandoId = id;
  $('#titulo-form-promocion').textContent = 'Editar promoción';
  $('#promo-titulo').value = promo.titulo;
  $('#promo-descripcion').value = promo.descripcion || '';
  $('#promo-beneficio').value = promo.beneficio || '';
  $('#promo-oferta').value = promo.precio_oferta_soles ?? '';

  $('#form-promocion').hidden = false;
  $('#promo-titulo').focus();
}

async function alternarPromocion(id) {
  const promo = registros.find((r) => r.id === id);
  if (!promo) return;
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('promociones')
      .update({ activo: !promo.activo })
      .eq('id', id);
    if (error) throw error;
    mostrarToast(
      promo.activo ? 'Promoción desactivada (oculta al público).' : 'Promoción activada.',
      'exito'
    );
    cargarPromociones();
  } catch (error) {
    console.error('admin-promociones.js — alternarPromocion:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
  }
}

async function eliminarPromocion(id) {
  const promo = registros.find((r) => r.id === id);
  if (!promo) return;

  const confirmado = confirm(`¿Eliminar "${promo.titulo}"? Esta acción no se puede deshacer.`);
  if (!confirmado) return;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('promociones').delete().eq('id', id);
    if (error) throw error;
    mostrarToast('Promoción eliminada.', 'exito');
    if (editandoId === id) cerrarFormulario();
    cargarPromociones();
  } catch (error) {
    console.error('admin-promociones.js — eliminarPromocion:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
  }
}

/* -----------------------------------------------------------------------------
   Helpers del formulario
   ----------------------------------------------------------------------------- */
function abrirFormularioNueva() {
  editandoId = null;
  $('#titulo-form-promocion').textContent = 'Nueva promoción';
  $('#form-promocion').reset();
  $('#form-promocion').hidden = false;
  $('#promo-titulo').focus();
}

function cerrarFormulario() {
  editandoId = null;
  $('#form-promocion').reset();
  $('#form-promocion').hidden = true;
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