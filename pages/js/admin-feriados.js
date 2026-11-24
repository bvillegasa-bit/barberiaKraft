/* =============================================================================
   Barbería Kraft — admin-feriados.js (panel · Feriados)
   -----------------------------------------------------------------------------
   Gestión de feriados desde el panel admin. CRUD DIRECTO sobre public.feriados:
   - SELECT ordenado por fecha · UPSERT por PK fecha (alta = edición) · DELETE.
   - Sin RPC: RLS permite lectura pública y escritura solo a admin.
   - La lógica pura vive en logica/admin-feriados-logica.js (testeada); este
     módulo SOLO consulta, valida el formulario y pinta el DOM.
   - Todo dato se pinta con textContent (nunca innerHTML con datos).
   - Si la tabla no existe (42P01), avisa cómo ejecutar la migración 0003 sin
     romper el resto del panel.
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { $ } from './ui.js';
import { mensajeErrorAdmin } from './api.js';
import {
  validarFeriado,
  ordenarFeriados,
  formatearFecha,
  etiquetaCierre
} from './logica/admin-feriados-logica.js';

const AVISO_MIGRACION = 'Ejecuta la migración 0003 en Supabase SQL Editor para habilitar feriados';
const CLASES_CIERRE = {
  '19:00': 'badge-cierre--19',
  '20:00': 'badge-cierre--20',
  '21:00': 'badge-cierre--21',
  '22:00': 'badge-cierre--22'
};

let feriados = [];
let cargando = false;
let temporizadorAviso = null;

export async function iniciar(contenedor) {
  const formulario = $('#form-feriado');
  const botonRefrescar = $('#btn-refrescar-feriados');
  const cuerpo = $('#cuerpo-tabla-feriados');

  if (formulario) formulario.addEventListener('submit', guardarFeriado);
  if (botonRefrescar) botonRefrescar.addEventListener('click', () => cargarFeriados());
  if (cuerpo) cuerpo.addEventListener('click', manejarEliminacion);

  // Refresco al volver a la pestaña (pagina-admin.js emite el evento).
  contenedor.addEventListener('admin:tab-activado', () => {
    if (!cargando) cargarFeriados();
  });

  await cargarFeriados();
}

/* -----------------------------------------------------------------------------
   Consulta: única tabla, sin RPC y sin joins
   ----------------------------------------------------------------------------- */
async function consultarFeriados() {
  const { data, error } = await getSupabase()
    .from('feriados')
    .select('fecha,descripcion,cierre')
    .order('fecha');
  if (error) throw error;
  return data ?? [];
}

function esTablaInexistente(error) {
  return error?.code === '42P01' ||
    /42P01|relation\s+["']?public\.feriados["']?\s+does not exist/i.test(String(error?.message ?? ''));
}

function mensajeAmigable(error) {
  return esTablaInexistente(error) ? AVISO_MIGRACION : mensajeErrorAdmin(error);
}

/* -----------------------------------------------------------------------------
   Carga + render
   ----------------------------------------------------------------------------- */
async function cargarFeriados() {
  if (cargando) return;
  cargando = true;
  ocultarAviso();

  const cuerpo = $('#cuerpo-tabla-feriados');
  renderEstadoTabla(cuerpo, 'Cargando feriados…');

  try {
    feriados = ordenarFeriados(await consultarFeriados());
    renderizar();
  } catch (error) {
    console.error('admin-feriados.js — cargarFeriados:', error);
    const mensaje = mensajeAmigable(error);
    renderErrorTabla(cuerpo, mensaje);
    mostrarAviso(mensaje, 'error');
  } finally {
    cargando = false;
  }
}

function renderizar() {
  const cuerpo = $('#cuerpo-tabla-feriados');
  if (!cuerpo) return;

  cuerpo.replaceChildren();
  const vacio = $('#feriados-vacio');
  if (vacio) vacio.hidden = feriados.length !== 0;

  feriados.forEach((feriado) => cuerpo.appendChild(crearFila(feriado)));
}

function crearFila(feriado) {
  const fila = document.createElement('tr');

  const celdaFecha = document.createElement('td');
  celdaFecha.className = 'feriado-fecha';
  celdaFecha.textContent = formatearFecha(feriado.fecha);
  fila.appendChild(celdaFecha);

  const celdaDescripcion = document.createElement('td');
  celdaDescripcion.className = 'feriado-descripcion';
  celdaDescripcion.textContent = String(feriado.descripcion ?? '').trim() || '—';
  fila.appendChild(celdaDescripcion);

  const celdaCierre = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `badge-cierre ${claseCierre(feriado.cierre)}`;
  badge.textContent = etiquetaCierre(feriado.cierre);
  celdaCierre.appendChild(badge);
  fila.appendChild(celdaCierre);

  const celdaAcciones = document.createElement('td');
  const grupo = document.createElement('div');
  grupo.className = 'tabla-crud__acciones';

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn-icono btn-icono--peligro';
  boton.dataset.accion = 'eliminar';
  boton.dataset.fecha = String(feriado.fecha ?? '');
  boton.setAttribute('aria-label', `Quitar feriado del ${formatearFecha(feriado.fecha)}`);
  boton.appendChild(iconoBorrar());
  grupo.appendChild(boton);
  celdaAcciones.appendChild(grupo);
  fila.appendChild(celdaAcciones);

  return fila;
}

function claseCierre(valor) {
  const clave = String(valor ?? '').trim().slice(0, 5);
  return CLASES_CIERRE[clave] ?? 'badge-cierre--otro';
}

function iconoBorrar() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '../assets/sprite.svg#icon-borrar');
  svg.appendChild(use);
  return svg;
}

/* -----------------------------------------------------------------------------
   Alta / edición (upsert por PK) y baja (confirmación nativa)
   ----------------------------------------------------------------------------- */
async function guardarFeriado(evento) {
  evento.preventDefault();

  const fecha = $('#feriado-fecha')?.value ?? '';
  const descripcion = $('#feriado-descripcion')?.value ?? '';
  const cierre = $('#feriado-cierre')?.value ?? '';
  const validacion = validarFeriado({ fecha, descripcion, cierre });

  if (!validacion.ok) {
    mostrarAviso(validacion.errores.join(' '), 'error');
    return;
  }

  const boton = $('#btn-guardar-feriado');
  if (boton) boton.disabled = true;

  try {
    const { error } = await getSupabase()
      .from('feriados')
      .upsert(
        { fecha, descripcion: descripcion.trim(), cierre },
        { onConflict: 'fecha' }
      );
    if (error) throw error;

    const formulario = $('#form-feriado');
    if (formulario) formulario.reset();
    await cargarFeriados();
    mostrarAviso('Feriado guardado correctamente.', 'exito');
  } catch (error) {
    console.error('admin-feriados.js — guardarFeriado:', error);
    mostrarAviso(mensajeAmigable(error), 'error');
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function manejarEliminacion(evento) {
  const boton = evento.target.closest('button[data-accion="eliminar"]');
  if (!boton) return;

  const fecha = boton.dataset.fecha;
  if (!fecha || !window.confirm(`¿Quitar el feriado del ${formatearFecha(fecha)}?`)) return;

  boton.disabled = true;

  try {
    const { error } = await getSupabase()
      .from('feriados')
      .delete()
      .eq('fecha', fecha);
    if (error) throw error;

    await cargarFeriados();
    mostrarAviso('Feriado eliminado correctamente.', 'exito');
  } catch (error) {
    console.error('admin-feriados.js — eliminar:', error);
    boton.disabled = false;
    mostrarAviso(mensajeAmigable(error), 'error');
  }
}

/* -----------------------------------------------------------------------------
   Avisos y estados de la tabla
   ----------------------------------------------------------------------------- */
function mostrarAviso(texto, tipo) {
  const aviso = $('#alerta-feriados');
  if (!aviso) return;

  aviso.textContent = String(texto ?? '');
  aviso.className = `admin-feriados__alerta admin-feriados__alerta--${tipo}`;
  aviso.hidden = false;

  if (temporizadorAviso) clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(ocultarAviso, 6000);
}

function ocultarAviso() {
  const aviso = $('#alerta-feriados');
  if (!aviso) return;
  aviso.hidden = true;
  aviso.textContent = '';
}

function renderEstadoTabla(cuerpo, mensaje) {
  if (!cuerpo) return;
  cuerpo.replaceChildren();
  const fila = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 4;
  td.className = 'admin-feriados__estado-tabla';
  td.textContent = mensaje;
  fila.appendChild(td);
  cuerpo.appendChild(fila);

  const vacio = $('#feriados-vacio');
  if (vacio) vacio.hidden = true;
}

function renderErrorTabla(cuerpo, mensaje) {
  if (!cuerpo) return;
  cuerpo.replaceChildren();
  const fila = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 4;
  td.className = 'admin-feriados__estado-tabla';

  const texto = document.createElement('p');
  texto.textContent = mensaje;
  td.appendChild(texto);

  const reintentar = document.createElement('button');
  reintentar.type = 'button';
  reintentar.className = 'btn btn--secundario btn--sm';
  reintentar.textContent = 'Reintentar';
  reintentar.addEventListener('click', () => cargarFeriados());
  td.appendChild(reintentar);

  fila.appendChild(td);
  cuerpo.appendChild(fila);

  const vacio = $('#feriados-vacio');
  if (vacio) vacio.hidden = true;
}
