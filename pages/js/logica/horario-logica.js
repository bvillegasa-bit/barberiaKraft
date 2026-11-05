/* =============================================================================
   Barberia Kraft - logica/horario-logica.js (Ciclo 6 - logica PURA)
   -----------------------------------------------------------------------------
   Funciones puras de horarios de reserva. SIN DOM y SIN Supabase.

   Decisiones de zona horaria:
   - Las fechas viajan como strings 'YYYY-MM-DD' y las horas como 'HH:MM'.
   - No se usa `new Date()` con hora local en ningun punto. Para calcular el
     dia de la semana y sumar dias se usa `Date.UTC(...)`, que es determinista
     y no depende de la zona horaria del equipo.
   - Solo se aceptan horas de 00:00 a 23:59 y fechas reales del calendario
     (por ejemplo '2026-13-45' es invalida).
   - El slot igual a la hora de cierre NO se ofrece: la atencion termina al
     cerrar. El slot igual a "ahora" tampoco, porque ya no se puede reservar.

   Reglas del negocio:
   - Atencion normal Lun-Sab 08:30-19:00, reservas cada 30 min -> 21 slots.
   - Feriados: cierre 22:00 -> 27 slots.
   - Domingos cerrado (diaSemana === 0).
   ============================================================================= */

const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export const HORARIO_NORMAL = Object.freeze({
  apertura: '08:30',
  cierre: '19:00',
  intervaloMin: 30
});

export const HORARIO_FERIADO = Object.freeze({
  apertura: '08:30',
  cierre: '22:00',
  intervaloMin: 30
});

function dosDigitos(valor) {
  return String(valor).padStart(2, '0');
}

/**
 * Convierte 'HH:MM' a minutos desde medianoche.
 * @param {string|null|undefined} hora
 * @returns {number|null} Minutos (0..1439) o null si la entrada es invalida.
 */
export function aHoraMinutos(hora) {
  const texto = String(hora ?? '').trim();
  const coincide = RE_HORA.exec(texto);
  if (!coincide) return null;
  return Number(coincide[1]) * 60 + Number(coincide[2]);
}

/**
 * Convierte minutos desde medianoche a 'HH:MM'.
 * @param {number|null|undefined} minutos Entero entre 0 y 1439.
 * @returns {string} 'HH:MM' o '' si la entrada es invalida.
 */
export function aTextoHora(minutos) {
  if (typeof minutos !== 'number' || !Number.isInteger(minutos)) return '';
  if (minutos < 0 || minutos > 1439) return '';
  return `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;
}

/**
 * Valida una fecha 'YYYY-MM-DD' contra el calendario real.
 * @param {string|null|undefined} fecha
 * @returns {boolean}
 */
export function esFechaValida(fecha) {
  const texto = String(fecha ?? '').trim();
  const coincide = RE_FECHA.exec(texto);
  if (!coincide) return false;

  const anio = Number(coincide[1]);
  const mes = Number(coincide[2]);
  const dia = Number(coincide[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;

  const utc = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    utc.getUTCFullYear() === anio &&
    utc.getUTCMonth() === mes - 1 &&
    utc.getUTCDate() === dia
  );
}

/**
 * Dia de la semana (0=domingo) calculado en UTC, sin zona horaria local.
 * @param {string} fecha Fecha valida 'YYYY-MM-DD'.
 * @returns {number}
 */
function diaSemanaDeFecha(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

/**
 * Suma dias a una fecha 'YYYY-MM-DD' usando aritmetica UTC.
 * @param {string} fecha
 * @param {number} dias
 * @returns {string}
 */
function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const utc = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return `${String(utc.getUTCFullYear()).padStart(4, '0')}-${dosDigitos(
    utc.getUTCMonth() + 1
  )}-${dosDigitos(utc.getUTCDate())}`;
}

/**
 * Genera los slots de atencion de un rango, cada `intervaloMin` minutos.
 * Excluye el slot igual al cierre. Nunca itera mas de un dia completo.
 * @param {{ apertura?: string, cierre?: string, intervaloMin?: number }} [rango]
 * @returns {string[]} Slots 'HH:MM' ordenados.
 */
export function generarSlots({ apertura, cierre, intervaloMin } = {}) {
  const inicio = aHoraMinutos(apertura);
  const fin = aHoraMinutos(cierre);
  const paso = Number(intervaloMin);

  if (inicio === null || fin === null) return [];
  if (!Number.isInteger(paso) || paso <= 0 || inicio >= fin) return [];

  const slots = [];
  const maxIteraciones = Math.floor(1440 / paso) + 1;
  for (let minutos = inicio, i = 0; minutos < fin && i < maxIteraciones; minutos += paso, i++) {
    slots.push(aTextoHora(minutos));
  }
  return slots;
}

/**
 * Normaliza el parametro `ahora`. Acepta:
 * - 'HH:MM' (se asume la fecha `hoy`, o la fecha consultada si no hay `hoy`).
 * - 'YYYY-MM-DD HH:MM' o 'YYYY-MM-DDTHH:MM'.
 * - { fecha, hora }.
 */
function interpretarAhora(ahora, fechaPorDefecto) {
  if (ahora && typeof ahora === 'object') {
    return { fechaAhora: ahora.fecha ?? fechaPorDefecto, horaAhora: ahora.hora ?? '' };
  }

  const texto = String(ahora ?? '').trim();
  if (!texto) return { fechaAhora: null, horaAhora: '' };

  const partes = texto.split(/[T ]/);
  if (partes.length > 1) {
    return { fechaAhora: partes[0], horaAhora: partes[1].slice(0, 5) };
  }
  return { fechaAhora: fechaPorDefecto, horaAhora: texto };
}

/**
 * Filtra slots no reservables.
 * - Si la fecha consultada es "hoy", elimina los slots ya pasados (<= ahora).
 * - Elimina los slots presentes en `ocupadas`.
 * Sin zonas horarias: la comparacion es de strings 'HH:MM'.
 * @param {string[]} slots
 * @param {{ fecha?: string, ahora?: string|{fecha?:string,hora?:string}, hoy?: string, ocupadas?: string[]|Set<string> }} [opciones]
 * @returns {string[]}
 */
export function filtrarSlotsDisponibles(slots, { fecha, ahora, hoy, ocupadas } = {}) {
  const lista = Array.isArray(slots) ? slots : [];
  const bloqueadas =
    ocupadas instanceof Set
      ? new Set([...ocupadas].map((h) => String(h ?? '').trim()))
      : new Set((Array.isArray(ocupadas) ? ocupadas : []).map((h) => String(h ?? '').trim()));

  const { fechaAhora, horaAhora } = interpretarAhora(ahora, hoy ?? fecha);
  const minutosAhora = aHoraMinutos(horaAhora);
  const esHoy = Boolean(fechaAhora && String(fecha ?? '').trim() === fechaAhora);

  return lista.filter((slot) => {
    const texto = String(slot ?? '').trim();
    const minutosSlot = aHoraMinutos(texto);
    if (minutosSlot === null) return false;
    if (bloqueadas.has(texto)) return false;
    if (esHoy && minutosAhora !== null && minutosSlot <= minutosAhora) return false;
    return true;
  });
}

/**
 * Indica si una fecha se puede reservar.
 * - Fecha invalida o pasada -> false.
 * - Domingo (diaSemana === 0) -> false.
 * - Hoy solo si aun quedan horas (si se informa `ahora` y `cierre`).
 * @param {string} fecha 'YYYY-MM-DD'
 * @param {{ hoy?: string, diaSemana?: number, ahora?: string, cierre?: string }} [opciones]
 * @returns {boolean}
 */
export function esFechaReservable(fecha, { hoy, diaSemana, ahora, cierre } = {}) {
  if (!esFechaValida(fecha)) return false;

  const fechaTexto = String(fecha).trim();
  const dia = Number.isInteger(diaSemana) ? diaSemana : diaSemanaDeFecha(fechaTexto);
  if (dia === 0) return false;

  const referencia = esFechaValida(hoy) ? String(hoy).trim() : null;
  if (referencia && fechaTexto < referencia) return false;

  if (referencia && fechaTexto === referencia) {
    const minutosAhora = aHoraMinutos(ahora);
    const minutosCierre = aHoraMinutos(cierre);
    if (minutosAhora !== null && minutosCierre !== null && minutosAhora >= minutosCierre) {
      return false;
    }
  }

  return true;
}

/**
 * Horario aplicable a una fecha, considerando feriados.
 * @param {string} fecha 'YYYY-MM-DD'
 * @param {{ apertura?: string, cierre?: string, feriados?: string[]|Set<string> }} [opciones]
 * @returns {{ apertura: string, cierre: string, esFeriado: boolean }}
 */
export function horarioDeFecha(fecha, { apertura, cierre, feriados } = {}) {
  const conjunto =
    feriados instanceof Set
      ? feriados
      : new Set(Array.isArray(feriados) ? feriados : []);

  const esFeriado = conjunto.has(String(fecha ?? '').trim());
  const aperturaValida = aHoraMinutos(apertura) !== null;
  const cierreValido = aHoraMinutos(cierre) !== null;

  return {
    apertura:
      aperturaValida ? String(apertura).trim() : HORARIO_NORMAL.apertura,
    cierre: cierreValido
      ? String(cierre).trim()
      : esFeriado
        ? HORARIO_FERIADO.cierre
        : HORARIO_NORMAL.cierre,
    esFeriado
  };
}

/**
 * Siguiente fecha reservable para el date picker.
 * Si `hoy` es domingo, o si ya no quedan horas (segun `ahora`/`cierre`), avanza
 * al siguiente dia habil. Maximo 14 iteraciones: nunca hay bucle infinito.
 * @param {string} hoy 'YYYY-MM-DD'
 * @param {{ ahora?: string, cierre?: string }} [opciones]
 * @returns {string} 'YYYY-MM-DD' o '' si `hoy` es invalido.
 */
export function siguienteFechaReservable(hoy, { ahora, cierre } = {}) {
  if (!esFechaValida(hoy)) return '';

  const inicio = String(hoy).trim();
  const minutosAhora = aHoraMinutos(ahora);
  const minutosCierre = aHoraMinutos(cierre);
  const sinHorasHoy =
    minutosAhora !== null && minutosCierre !== null && minutosAhora >= minutosCierre;

  let candidato = inicio;
  for (let i = 0; i < 14; i++) {
    const esDomingo = diaSemanaDeFecha(candidato) === 0;
    const quedanHoras = candidato !== inicio || !sinHorasHoy;
    if (!esDomingo && quedanHoras) return candidato;
    candidato = sumarDias(candidato, 1);
  }
  return '';
}
