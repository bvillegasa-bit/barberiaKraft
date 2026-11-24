/* =============================================================================
   Barbería Kraft — logica/admin-feriados-logica.js (panel · Feriados)
   -----------------------------------------------------------------------------
   Lógica PURA de la gestión de feriados del panel admin. SIN DOM y SIN Supabase.
   - validarFeriado: fecha YYYY-MM-DD real y no pasada, descripción ≤ 120 y
     cierre dentro de la lista permitida (19:00 / 20:00 / 21:00 / 22:00).
   - ordenarFeriados: ascendente por fecha, sin mutar y sin duplicar la PK.
   - formatearFecha / etiquetaCierre: texto legible con fallback seguro.
   - esFeriado: consulta booleana sobre una lista (no depende de la TZ).
   Las fechas se comparan SIEMPRE como componentes AAAA-MM-DD, nunca con
   Date.toISOString(), para que el día no cambie según la zona horaria.
   ============================================================================= */

export const CIERRES_PERMITIDOS = ['19:00', '20:00', '21:00', '22:00'];

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^(\d{1,2}):(\d{2})/;
const MAX_DESCRIPCION = 120;

/**
 * Normaliza una fecha a 'YYYY-MM-DD'. Acepta ISO y Date (componentes locales).
 * Devuelve null si es vacía o inventada (p. ej. 2026-13-45 o 2026-02-30).
 * @param {string|Date|null|undefined} valor
 * @returns {string|null}
 */
function normalizarFecha(valor) {
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
 * Normaliza una hora SQL/HTML ('19:00:00' o '19:00') a 'HH:MM'.
 * @param {string|null|undefined} valor
 * @returns {string|null}
 */
function normalizarCierre(valor) {
  const coincidencia = String(valor ?? '').trim().match(RE_HORA);
  if (!coincidencia) return null;
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  if (horas > 23 || minutos > 59) return null;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/**
 * Valida el payload del formulario de feriados.
 * @param {{fecha?: string|Date, descripcion?: string, cierre?: string}} feriado
 * @param {string|Date} [referencia] fecha de hoy (inyectable para tests)
 * @returns {{ok: boolean, errores: string[]}}
 */
export function validarFeriado(feriado = {}, referencia = new Date()) {
  const datos = feriado && typeof feriado === 'object' ? feriado : {};
  const errores = [];

  const fecha = normalizarFecha(datos.fecha);
  if (!fecha) {
    errores.push('La fecha no es válida. Usa el formato AAAA-MM-DD.');
  } else {
    const hoy = normalizarFecha(referencia);
    if (hoy && fecha < hoy) errores.push('La fecha no puede ser pasada.');
  }

  const descripcion = String(datos.descripcion ?? '');
  if (descripcion.length > MAX_DESCRIPCION) {
    errores.push(`La descripción no puede superar los ${MAX_DESCRIPCION} caracteres.`);
  }

  const cierre = normalizarCierre(datos.cierre);
  if (!cierre || !CIERRES_PERMITIDOS.includes(cierre)) {
    errores.push('El cierre debe ser 19:00, 20:00, 21:00 o 22:00.');
  }

  return { ok: errores.length === 0, errores };
}

/**
 * Ordena por fecha ascendente sin mutar la entrada. La PK es `fecha`, por lo
 * que los duplicados se colapsan conservando la primera aparición; las fechas
 * inválidas se dejan al final sin descartarlas.
 * @param {Array<object>} lista
 * @returns {Array<object>}
 */
export function ordenarFeriados(lista) {
  const arreglo = Array.isArray(lista) ? lista : [];
  const vistos = new Set();

  return arreglo
    .map((item, indice) => {
      const fecha = normalizarFecha(item?.fecha);
      return {
        item,
        indice,
        fecha,
        clave: fecha ?? `invalida-${indice}`,
        orden: fecha ?? '9999-99-99'
      };
    })
    .filter((entrada) => {
      if (vistos.has(entrada.clave)) return false;
      vistos.add(entrada.clave);
      return true;
    })
    .sort((a, b) => {
      if (a.orden !== b.orden) return a.orden < b.orden ? -1 : 1;
      return a.indice - b.indice;
    })
    .map((entrada) => entrada.item);
}

/**
 * Fecha legible dd/mm/aaaa. Valor inválido → '—'.
 * @param {string|Date|null|undefined} fecha
 * @returns {string}
 */
export function formatearFecha(fecha) {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) return '—';
  const [anio, mes, dia] = normalizada.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Etiqueta legible de cierre: '7:00 p. m.' … '10:00 p. m.'. Inválido → '—'.
 * @param {string|null|undefined} cierre
 * @returns {string}
 */
export function etiquetaCierre(cierre) {
  const normalizado = normalizarCierre(cierre);
  if (!normalizado || !CIERRES_PERMITIDOS.includes(normalizado)) return '—';
  const [horas, minutos] = normalizado.split(':').map(Number);
  const sufijo = horas >= 12 ? 'p. m.' : 'a. m.';
  const hora12 = horas % 12 === 0 ? 12 : horas % 12;
  return `${hora12}:${String(minutos).padStart(2, '0')} ${sufijo}`;
}

/**
 * Indica si `fecha` figura en la lista de feriados.
 * @param {string|Date|null|undefined} fecha
 * @param {Array<object>} lista
 * @returns {boolean}
 */
export function esFeriado(fecha, lista) {
  const normalizada = normalizarFecha(fecha);
  if (!normalizada) return false;
  const arreglo = Array.isArray(lista) ? lista : [];
  return arreglo.some((item) => normalizarFecha(item?.fecha) === normalizada);
}
