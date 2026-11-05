/* =============================================================================
   Barbería Kraft — logica/admin-reservas-logica.js (panel · Reservas)
   -----------------------------------------------------------------------------
   Lógica PURA del listado de reservas del panel admin. SIN DOM y SIN Supabase.
   - filtrarReservas: filtra por fecha (hoy | manana | todas) y estado.
   - contarReservasHoy / contarPendientes: KPIs del panel.
   - accionesDisponibles: transiciones permitidas según el estado actual.
   - ordenarReservas: activas por fecha/hora ascendente; resto después.
   Las fechas inválidas nunca rompen: se excluyen de los filtros por día y se
   envían al final del orden.
   ============================================================================= */

const ACTIVOS = ['pendiente', 'confirmada'];
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;
const RE_HORA = /^(\d{1,2}):(\d{2})/;

function claveEstado(estado) {
  return String(estado ?? '').trim().toLowerCase();
}

/**
 * Normaliza una fecha a 'YYYY-MM-DD'. Date → componentes locales; string →
 * prefijo ISO. Devuelve null si es vacía o inválida (incluye 2026-02-30).
 * @param {string|Date|null|undefined} valor
 * @returns {string|null}
 */
export function normalizarFecha(valor) {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    const anio = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  const texto = String(valor ?? '').trim();
  const coincidencia = texto.match(RE_FECHA);
  if (!coincidencia) return null;

  const [, anio, mes, dia] = coincidencia;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  if (
    fecha.getUTCFullYear() !== Number(anio) ||
    fecha.getUTCMonth() !== Number(mes) - 1 ||
    fecha.getUTCDate() !== Number(dia)
  ) {
    return null;
  }
  return `${anio}-${mes}-${dia}`;
}

/**
 * Fecha local actual en formato 'YYYY-MM-DD'.
 * @param {Date} [referencia]
 * @returns {string|null}
 */
export function hoyISO(referencia = new Date()) {
  return normalizarFecha(referencia);
}

/**
 * Suma días a una fecha ISO 'YYYY-MM-DD' (sin desfase de zona horaria).
 * @param {string} fechaISO
 * @param {number} dias
 * @returns {string|null}
 */
export function sumarDias(fechaISO, dias) {
  const normalizada = normalizarFecha(fechaISO);
  if (!normalizada) return null;
  const [anio, mes, dia] = normalizada.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + Number(dias || 0)));
  if (Number.isNaN(fecha.getTime())) return null;
  const anioFinal = fecha.getUTCFullYear();
  const mesFinal = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const diaFinal = String(fecha.getUTCDate()).padStart(2, '0');
  return `${anioFinal}-${mesFinal}-${diaFinal}`;
}

/**
 * Normaliza una hora a 'HH:MM'. Devuelve null si no es válida.
 * @param {string|null|undefined} valor
 * @returns {string|null}
 */
export function normalizarHora(valor) {
  const coincidencia = String(valor ?? '').trim().match(RE_HORA);
  if (!coincidencia) return null;
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return null;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/**
 * Fecha legible dd/mm/yyyy. Valor inválido → '—'.
 * @param {string|null|undefined} valor
 * @returns {string}
 */
export function formatearFecha(valor) {
  const normalizada = normalizarFecha(valor);
  if (!normalizada) return '—';
  const [anio, mes, dia] = normalizada.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Hora legible HH:MM. Valor inválido → '—'.
 * @param {string|null|undefined} valor
 * @returns {string}
 */
export function formatearHora(valor) {
  return normalizarHora(valor) ?? '—';
}

/**
 * Filtra reservas por día y estado.
 * @param {Array<object>} lista
 * @param {{ fecha?: 'hoy'|'manana'|'todas', estado?: string, hoy?: string|Date }} [opciones]
 * @returns {Array<object>}
 */
export function filtrarReservas(lista, { fecha = 'todas', estado = 'todos', hoy = new Date() } = {}) {
  const arreglo = Array.isArray(lista) ? lista : [];
  const claveFecha = String(fecha ?? 'todas').trim().toLowerCase();
  const claveEstadoFiltro = String(estado ?? 'todos').trim().toLowerCase();

  const hoyNormalizado = normalizarFecha(hoy);
  const mananaNormalizado = hoyNormalizado ? sumarDias(hoyNormalizado, 1) : null;

  return arreglo.filter((reserva) => {
    const fechaReserva = normalizarFecha(reserva?.fecha);
    let cumpleFecha = false;

    if (claveFecha === 'todas') {
      cumpleFecha = true;
    } else if (claveFecha === 'hoy') {
      cumpleFecha = Boolean(hoyNormalizado) && fechaReserva === hoyNormalizado;
    } else if (claveFecha === 'manana') {
      cumpleFecha = Boolean(mananaNormalizado) && fechaReserva === mananaNormalizado;
    }

    const cumpleEstado =
      claveEstadoFiltro === 'todos' || claveEstado(reserva?.estado) === claveEstadoFiltro;

    return cumpleFecha && cumpleEstado;
  });
}

/**
 * Total de reservas del día indicado (todas, incluidas canceladas).
 * @param {Array<object>} lista
 * @param {string|Date} [hoy]
 * @returns {number}
 */
export function contarReservasHoy(lista, hoy = new Date()) {
  const arreglo = Array.isArray(lista) ? lista : [];
  const hoyNormalizado = normalizarFecha(hoy);
  if (!hoyNormalizado) return 0;
  return arreglo.filter((reserva) => normalizarFecha(reserva?.fecha) === hoyNormalizado).length;
}

/**
 * Total de reservas en estado 'pendiente' (estados desconocidos no cuentan).
 * @param {Array<object>} lista
 * @returns {number}
 */
export function contarPendientes(lista) {
  const arreglo = Array.isArray(lista) ? lista : [];
  return arreglo.filter((reserva) => claveEstado(reserva?.estado) === 'pendiente').length;
}

/**
 * Acciones permitidas según el estado actual.
 * pendiente → confirmar/cancelar · confirmada → atender/cancelar · resto → [].
 * @param {string|null|undefined} estado
 * @returns {Array<'confirmar'|'atender'|'cancelar'>}
 */
export function accionesDisponibles(estado) {
  const clave = claveEstado(estado);
  if (clave === 'pendiente') return ['confirmar', 'cancelar'];
  if (clave === 'confirmada') return ['atender', 'cancelar'];
  return [];
}

/**
 * Ordena: activas (pendiente/confirmada) por fecha/hora ascendente primero;
 * después el resto (más reciente primero). Fechas/horas inválidas al final.
 * No muta la lista original.
 * @param {Array<object>} lista
 * @returns {Array<object>}
 */
export function ordenarReservas(lista) {
  const arreglo = Array.isArray(lista) ? lista : [];

  const decorada = arreglo.map((item, indice) => ({
    item,
    indice,
    activa: ACTIVOS.includes(claveEstado(item?.estado)),
    fecha: normalizarFecha(item?.fecha) ?? '9999-99-99',
    hora: normalizarHora(item?.hora) ?? '99:99'
  }));

  decorada.sort((a, b) => {
    if (a.activa !== b.activa) return a.activa ? -1 : 1;
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    if (a.hora !== b.hora) return a.hora < b.hora ? -1 : 1;
    return a.activa ? a.indice - b.indice : b.indice - a.indice;
  });

  return decorada.map((entrada) => entrada.item);
}
