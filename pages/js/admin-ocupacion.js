/* =============================================================================
   Barbería Kraft — admin-ocupacion.js (T27)
   Gestión de ocupación de sillas del panel admin (design §8.3.8):
   - Vista previa con semáforo SIEMPRE desde el rpc obtener_ocupacion
     (fuente de verdad — D4 / CA-RF02-1); si el rpc falla (ej. configuración
     pendiente), cae a calcularOcupacion() local (espejo testeable CA-RNF06-3).
   - Grid de sillas: ocupar (con servicio + barbero opcional) / liberar.
   - Límite de sillas: comprobación en la UI + trigger check_limite_sillas
     como segunda barrera (0001_init.sql → errcode 23514, mapeado en
     mensajeErrorAdmin de api.js).
   - ocupada_desde se registra en ISO al ocupar (auditoría, 0001_init.sql).
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { $, mostrarToast, estadoCarga, renderSemaforo, escaparHtml } from './ui.js';
import { calcularOcupacion, fetchOcupacion } from './ocupacion.js';
import { cargarServiciosActivos, mensajeErrorAdmin } from './api.js';
import { svgUse, estadoErrorAdmin } from './admin-ui.js';

const DEFAULTS = { sillasTotales: 4, duracionPromedioMin: 30, techoMin: 60 };

let sillas = [];
let serviciosActivos = [];
let totales = DEFAULTS.sillasTotales;

const PLANTILLA = `
  <div class="admin-panel__herramientas">
    <h2>Ocupación del local</h2>
    <button type="button" class="btn btn--secundario" id="ocupacion-refrescar">
      ${svgUse('icon-reloj')} Refrescar
    </button>
  </div>

  <div class="vista-previa">
    <h3 class="vista-previa__titulo">Estado actual</h3>
    <div id="ocupacion-semaforo" aria-live="polite"></div>
    <p class="vista-previa__resumen" id="ocupacion-resumen"></p>
  </div>

  <h3 class="vista-previa__titulo">Sillas del local</h3>
  <div id="ocupacion-grid" class="grid-sillas grid-sillas--2 grid-sillas--4" aria-live="polite"></div>
`;

export async function iniciar(contenedor) {
  contenedor.innerHTML = PLANTILLA;

  $('#ocupacion-refrescar').addEventListener('click', cargarTodo);

  // Delegación de eventos sobre el grid de sillas
  const grid = $('#ocupacion-grid');
  grid.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button');
    if (!boton) return;

    if (boton.dataset.ocupar) {
      mostrarFormularioOcupar(boton.dataset.ocupar);
    } else if (boton.dataset.liberar) {
      liberarSilla(boton.dataset.liberar);
    } else if (boton.dataset.cancelarOcupar) {
      renderizarGrid(); // descarta el mini-formulario
    }
  });
  grid.addEventListener('submit', (evento) => {
    const formulario = evento.target.closest('.ocupar-mini');
    if (!formulario) return;
    evento.preventDefault();
    ocuparSilla(formulario.dataset.silla, formulario);
  });

  await cargarTodo();
}

/* -----------------------------------------------------------------------------
   Carga global: sillas + servicios activos (para el mini-formulario)
   ----------------------------------------------------------------------------- */
async function cargarTodo() {
  const grid = $('#ocupacion-grid');
  estadoCarga(grid, 'Cargando sillas…');

  const [resultadoSillas, resultadoServicios] = await Promise.all([
    cargarSillas(),
    cargarServiciosActivos()
  ]);

  if (!resultadoSillas.ok) {
    estadoErrorAdmin(grid, mensajeErrorAdmin(resultadoSillas.error), cargarTodo);
    return;
  }
  sillas = resultadoSillas.data;
  totales = sillas.length > 0 ? sillas.length : DEFAULTS.sillasTotales;
  serviciosActivos = resultadoServicios.ok ? resultadoServicios.data : [];

  renderizarVistaPrevia();
  renderizarGrid();
}

async function cargarSillas() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sillas')
      .select('id, nombre, estado, barbero_nombre, servicio_id, ocupada_desde')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (error) {
    console.error('admin-ocupacion.js — cargarSillas:', error);
    return { ok: false, error };
  }
}

function contarOcupadas() {
  return sillas.filter((s) => s.estado === 'ocupada').length;
}

/* -----------------------------------------------------------------------------
   Vista previa: semáforo (rpc como fuente de verdad) + resumen de contadores
   ----------------------------------------------------------------------------- */
async function renderizarVistaPrevia() {
  const ocupadas = contarOcupadas();
  const resumen = $('#ocupacion-resumen');
  resumen.textContent = `Ocupadas: ${ocupadas} de ${totales}`;

  const semaforoEl = $('#ocupacion-semaforo');
  try {
    const datos = await fetchOcupacion();
    renderSemaforo(semaforoEl, { porcentaje: datos.porcentaje, esperaMin: datos.espera_min });
  } catch (error) {
    // Fallback local (espejo de la fórmula spec §3.2) si el rpc no responde
    console.warn('admin-ocupacion.js — rpc no disponible, cálculo local:', error);
    const estimado = calcularOcupacion({
      sillasOcupadas: ocupadas,
      sillasTotales: totales,
      duracionPromedioMin: DEFAULTS.duracionPromedioMin,
      techoMin: DEFAULTS.techoMin
    });
    renderSemaforo(semaforoEl, estimado);
    resumen.textContent += ' (estimación local)';
  }
}

/* -----------------------------------------------------------------------------
   Grid de sillas
   ----------------------------------------------------------------------------- */
function renderizarGrid() {
  const grid = $('#ocupacion-grid');
  grid.innerHTML = '';

  if (sillas.length === 0) {
    estadoErrorAdmin(
      grid,
      'No se encontraron sillas. Verifica la migración 0001_init.sql (tabla sillas con 4 registros).',
      cargarTodo
    );
    return;
  }

  const ocupadas = contarOcupadas();
  const limiteAlcanzado = ocupadas >= totales;

  sillas.forEach((silla) => {
    const ocupada = silla.estado === 'ocupada';
    const tarjeta = document.createElement('article');
    tarjeta.className = `tarjeta card-silla ${ocupada ? 'card-silla--ocupada' : 'card-silla--libre'}`;

    let detalle = '';
    if (ocupada) {
      const partes = [];
      if (silla.barbero_nombre) partes.push(`Barbero: ${escaparHtml(silla.barbero_nombre)}`);
      const servicio = serviciosActivos.find((s) => s.id === silla.servicio_id);
      partes.push(`Servicio: ${servicio ? escaparHtml(servicio.nombre) : '—'}`);
      if (silla.ocupada_desde) {
        const desde = new Date(silla.ocupada_desde);
        if (!Number.isNaN(desde.getTime())) {
          partes.push(`Desde: ${desde.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`);
        }
      }
      detalle = `<p class="card-silla__meta">${partes.join('<br>')}</p>`;
    }

    tarjeta.innerHTML = `
      <h4 class="card-silla__titulo">${svgUse('icon-silla')} ${escaparHtml(silla.nombre)}</h4>
      <span class="card-silla__estado">${ocupada ? 'Ocupada' : 'Libre'}</span>
      ${detalle}
      <div class="card-silla__acciones">…</div>
    `;

    const acciones = tarjeta.querySelector('.card-silla__acciones');
    if (ocupada) {
      const botonLiberar = document.createElement('button');
      botonLiberar.type = 'button';
      botonLiberar.className = 'btn btn--peligro btn--sm';
      botonLiberar.dataset.liberar = silla.id;
      botonLiberar.textContent = 'Liberar';
      acciones.appendChild(botonLiberar);
    } else if (limiteAlcanzado) {
      const botonBloqueado = document.createElement('button');
      botonBloqueado.type = 'button';
      botonBloqueado.className = 'btn btn--secundario btn--sm';
      botonBloqueado.disabled = true;
      botonBloqueado.title = 'Límite de sillas alcanzado: libera una silla primero.';
      botonBloqueado.textContent = 'Ocupar (límite)';
      acciones.appendChild(botonBloqueado);
    } else {
      const botonOcupar = document.createElement('button');
      botonOcupar.type = 'button';
      botonOcupar.className = 'btn btn--primario btn--sm';
      botonOcupar.dataset.ocupar = silla.id;
      botonOcupar.textContent = 'Ocupar';
      acciones.appendChild(botonOcupar);
    }

    grid.appendChild(tarjeta);
  });
}

/* -----------------------------------------------------------------------------
   Mini-formulario inline para ocupar una silla
   ----------------------------------------------------------------------------- */
function mostrarFormularioOcupar(id) {
  const tarjeta = document.querySelector(`.card-silla [data-ocupar="${id}"]`)?.closest('.card-silla');
  if (!tarjeta) return;

  const acciones = tarjeta.querySelector('.card-silla__acciones');
  acciones.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'ocupar-mini';
  form.dataset.silla = id;
  form.setAttribute('novalidate', '');

  const opcionesServicio = serviciosActivos.length
    ? serviciosActivos
        .map((s) => `<option value="${s.id}">${escaparHtml(s.nombre)}</option>`)
        .join('')
    : '<option value="">— Sin servicios activos —</option>';

  form.innerHTML = `
    <div class="campo">
      <label for="ocupar-servicio-${id}">Servicio</label>
      <select id="ocupar-servicio-${id}" name="servicio_id">
        <option value="">— Sin servicio —</option>
        ${opcionesServicio}
      </select>
    </div>
    <div class="campo">
      <label for="ocupar-barbero-${id}">Barbero (opcional)</label>
      <input type="text" id="ocupar-barbero-${id}" name="barbero_nombre" maxlength="80" autocomplete="off">
    </div>
    <div class="panel-form__acciones">
      <button type="submit" class="btn btn--primario btn--sm">Ocupar</button>
      <button type="button" class="btn btn--secundario btn--sm" data-cancelar-ocupar="${id}">Cancelar</button>
    </div>
  `;

  acciones.appendChild(form);
  const selectServicio = form.querySelector('select');
  selectServicio.focus();
}

/* -----------------------------------------------------------------------------
   Ocupar silla (UI: límite previo · BD: trigger check_limite_sillas)
   ----------------------------------------------------------------------------- */
async function ocuparSilla(id, formulario) {
  const ocupadas = contarOcupadas();
  if (ocupadas >= totales) {
    mostrarToast('Límite de sillas alcanzado. Libera una silla antes de ocupar otra.', 'error', 5000);
    return;
  }

  const datos = new FormData(formulario);
  const servicioId = datos.get('servicio_id') || null;
  const barbero = String(datos.get('barbero_nombre') || '').trim() || null;

  const boton = formulario.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('sillas')
      .update({
        estado: 'ocupada',
        servicio_id: servicioId,
        barbero_nombre: barbero,
        ocupada_desde: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    mostrarToast('Silla ocupada.', 'exito');
    await cargarTodo();
  } catch (error) {
    console.error('admin-ocupacion.js — ocuparSilla:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
    renderizarGrid(); // restaura la tarjeta si el trigger rechazó
  }
}

/* -----------------------------------------------------------------------------
   Liberar silla
   ----------------------------------------------------------------------------- */
async function liberarSilla(id) {
  const silla = sillas.find((s) => s.id === id);
  if (!silla) return;

  const confirmado = confirm(`¿Liberar la silla "${silla.nombre}"?`);
  if (!confirmado) return;

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('sillas')
      .update({
        estado: 'libre',
        servicio_id: null,
        barbero_nombre: null,
        ocupada_desde: null
      })
      .eq('id', id);

    if (error) throw error;
    mostrarToast('Silla liberada.', 'exito');
    await cargarTodo();
  } catch (error) {
    console.error('admin-ocupacion.js — liberarSilla:', error);
    mostrarToast(mensajeErrorAdmin(error), 'error', 5000);
  }
}