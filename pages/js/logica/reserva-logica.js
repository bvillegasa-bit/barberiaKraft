/* =============================================================================
   Barberia Kraft - logica/reserva-logica.js (Ciclo 6 - logica PURA)
   -----------------------------------------------------------------------------
   Validacion, payload y estados de una reserva. SIN DOM y SIN Supabase.

   Reutiliza los criterios de validacion ya existentes del proyecto:
   - nombre: letras Unicode/espacios/apostrofes/guiones, sin numeros (HU04/HU05).
   - telefono: obligatorio, exactamente 9 digitos (RNF03 / Ley 29733).
   - fecha y hora: se validan con las funciones puras de horario-logica.
   ============================================================================= */

import { validarNombre } from '../validacion/reglas/nombre.js';
import { validarTelefono } from '../validacion/reglas/telefono.js';
import { aHoraMinutos, esFechaValida } from './horario-logica.js';

const ESTADOS = Object.freeze({
  pendiente: { etiqueta: 'Pendiente', clase: 'estado--pendiente' },
  confirmada: { etiqueta: 'Confirmada', clase: 'estado--confirmada' },
  atendida: { etiqueta: 'Atendida', clase: 'estado--atendida' },
  cancelada: { etiqueta: 'Cancelada', clase: 'estado--cancelada' }
});

const ESTADO_DESCONOCIDO = Object.freeze({
  etiqueta: 'Desconocido',
  clase: 'estado--desconocido'
});

/**
 * Valida los datos minimos de una reserva.
 * @param {{ servicioId?: string, fecha?: string, hora?: string, nombre?: string, telefono?: string }} [datos]
 * @returns {{ ok: boolean, errores: Object<string, string> }}
 */
export function validarReserva({ servicioId, fecha, hora, nombre, telefono } = {}) {
  const errores = {};

  if (!String(servicioId ?? '').trim()) {
    errores.servicioId = 'Debes seleccionar un servicio.';
  }

  if (!String(fecha ?? '').trim()) {
    errores.fecha = 'La fecha es obligatoria.';
  } else if (!esFechaValida(fecha)) {
    errores.fecha = 'La fecha no es valida.';
  }

  if (!String(hora ?? '').trim()) {
    errores.hora = 'La hora es obligatoria.';
  } else if (aHoraMinutos(hora) === null) {
    errores.hora = 'La hora no es valida.';
  }

  const errorNombre = validarNombre(nombre);
  if (errorNombre) errores.nombre = errorNombre;

  const errorTelefono = validarTelefono(telefono);
  if (errorTelefono) errores.telefono = errorTelefono;

  return { ok: Object.keys(errores).length === 0, errores };
}

/**
 * Construye el objeto listo para `insert` en `public.reservas`.
 * Guarda un snapshot del servicio (nombre, duracion y precio) para que la
 * reserva conserve lo pactado aunque el catalogo cambie despues.
 * @param {{ perfilId?: string, servicio?: object|null, fecha?: string, hora?: string, sillaId?: string|null, barbero?: string }} [datos]
 * @returns {object}
 */
export function construirPayloadReserva({
  perfilId,
  servicio,
  fecha,
  hora,
  sillaId,
  barbero
} = {}) {
  const duracion = Number(servicio?.duracion_min ?? servicio?.duracion ?? 0);
  const precio = Number(servicio?.precio ?? servicio?.precio_soles ?? 0);

  return {
    profile_id: perfilId ?? null,
    servicio_id: servicio?.id ?? null,
    servicio_nombre: String(servicio?.nombre ?? '').trim(),
    duracion_min: Number.isFinite(duracion) && duracion > 0 ? duracion : 0,
    precio: Number.isFinite(precio) && precio >= 0 ? precio : 0,
    fecha: fecha ?? null,
    hora: hora ?? null,
    silla_id: sillaId ?? null,
    barbero: String(barbero ?? '').trim() || 'cualquiera',
    estado: 'pendiente'
  };
}

/**
 * Etiqueta legible y clase CSS de un estado de reserva.
 * Cualquier valor desconocido (incluido null) cae a un fallback seguro.
 * @param {string|null|undefined} estado
 * @returns {{ etiqueta: string, clase: string }}
 */
export function estadoReserva(estado) {
  const clave = String(estado ?? '').trim().toLowerCase();
  const encontrado = ESTADOS[clave] ?? ESTADO_DESCONOCIDO;
  return { ...encontrado };
}

/**
 * Solo las reservas pendientes o confirmadas se pueden cancelar.
 * @param {string|null|undefined} estado
 * @returns {boolean}
 */
export function puedeCancelar(estado) {
  const clave = String(estado ?? '').trim().toLowerCase();
  return clave === 'pendiente' || clave === 'confirmada';
}
