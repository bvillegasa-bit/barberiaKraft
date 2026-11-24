/* =============================================================================
   Barbería Kraft — logica/historial-logica.js (HU14 — lógica PURA)
   ---------------------------------------------------------------------------
   Funciones puras extraídas de admin-historial.js para testearlas con el
   runner nativo de Node (node:test) SIN DOM ni Supabase.

   Reglas (CA-RF08-3):
   - Atenciones por fecha_atencion DESC; fechas inválidas al final.
   - Importe: solo cuando registrado. null/undefined/vacío/no numérico → "—".
     0 real → "S/ 0.00".
   - FK servicio_id ON DELETE SET NULL: sin servicio_id o sin nombre → "Servicio retirado".
   ============================================================================= */

import { compararFechasDesc } from './clientes-logica.js';

/**
 * Ordena las atenciones por fecha_atencion DESC. Fechas ausentes/inválidas al final.
 * @param {Array<object>} filas Filas de historial_atencion
 * @returns {Array<object>}
 */
export function ordenarAtencionesDesc(filas = []) {
  const filasArr = Array.isArray(filas) ? filas : [];
  return [...filasArr].sort((a, b) =>
    compararFechasDesc(a?.fecha_atencion, b?.fecha_atencion)
  );
}

/**
 * Importe formateado en soles. null/undefined/vacío/no numérico → "—".
 * 0 explícito → "S/ 0.00".
 * @param {number|string|null|undefined} valor
 * @returns {string}
 */
export function formatearImporte(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  const importe = Number(valor);
  if (!Number.isFinite(importe)) return '—';
  return 'S/ ' + importe.toFixed(2);
}

/**
 * Etiqueta del servicio. Sin servicio_id o sin nombre → "Servicio retirado".
 * Con nombre → ese nombre (trim). El escape HTML corresponde a capa UI.
 * @param {object|null|undefined} atencion
 * @returns {string}
 */
export function etiquetaServicio(atencion) {
  if (!atencion || !atencion.servicio_id) return 'Servicio retirado';
  const nombre = atencion.servicios?.nombre;
  if (typeof nombre === 'string' && nombre.trim()) return nombre.trim();
  return 'Servicio retirado';
}

/**
 * Fecha/hora local es-PE (dd/mm/aaaa HH:mm). Ausente/inválida → "—".
 * @param {string|Date|null|undefined} valor
 * @returns {string}
 */
export function formatearFechaHora(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const CABECERA_CSV = ['Fecha', 'Servicio', 'Importe', 'Notas'];

function celdaCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/**
 * Convierte filas YA filtradas a CSV con BOM UTF-8, separador ';' y
 * comillas dobles escapadas (las nuevas líneas quedan dentro de la celda).
 * @param {Array<object>} historial Filas ya filtradas por la capa UI
 * @returns {string}
 */
export function aCsv(historial = []) {
  const filas = Array.isArray(historial) ? historial : [];
  const lineas = [CABECERA_CSV.map(celdaCsv).join(';')];

  filas.forEach((atencion) => {
    lineas.push(
      [
        formatearFechaHora(atencion?.fecha_atencion),
        etiquetaServicio(atencion),
        formatearImporte(atencion?.importe),
        atencion?.notas ?? ''
      ]
        .map(celdaCsv)
        .join(';')
    );
  });

  return '\uFEFF' + lineas.join('\r\n');
}

/**
 * Nombre del archivo CSV: historial-atenciones-YYYY-MM-DD.csv.
 * Acepta 'YYYY-MM-DD', ISO con hora o Date; fecha inválida → sin-fecha.
 * @param {string|Date|null|undefined} fecha
 * @returns {string}
 */
export function nombreArchivoCsv(fecha) {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return `historial-atenciones-${fecha}.csv`;
  }
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(valor.getTime())) return 'historial-atenciones-sin-fecha.csv';
  const anio = valor.getUTCFullYear();
  const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(valor.getUTCDate()).padStart(2, '0');
  return `historial-atenciones-${anio}-${mes}-${dia}.csv`;
}
