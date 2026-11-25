/* =============================================================================
   Barbería Kraft — pages/js/logica/ocupacion-logica.js
   Construcción PURA de los payloads PATCH de public.sillas (bug 23502 / T27).
   ============================================================================= */

import { limpiarNombre } from './quitar-numeros.js';
import { validarNombre } from '../validacion/reglas/nombre.js';

/*
  Decisión de defaults según 0001_init.sql: `nombre` es la única columna NOT NULL SIN
  default (y además UNIQUE + check char_length > 0), por eso NUNCA se inventa con '—':
  se envía solo cuando el llamador aporta el valor real de la fila; si no, se omite y
  Postgres conserva el valor. `barbero_nombre` es NOT NULL con default '', pero un null
  EXPLÍCITO en el PATCH anula ese default y dispara 23502: se exige validado al ocupar y
  se limpia con '' (cadena vacía) al liberar. `estado` es NOT NULL con default ('libre')
  y se envía siempre de forma explícita. `servicio_id` y `ocupada_desde` son nullable,
  así que null explícito es válido. No existe columna `cliente_nombre` en sillas: claves
  extra como `clienteNombre` se ignoran.
*/

export function payloadOcuparSilla({
  barberoNombre,
  nombreSilla,
  servicioId = null,
  ocupadaDesde = null,
  estado = 'ocupada'
} = {}) {
  const nombreLimpio = limpiarNombre(barberoNombre);
  const error = validarNombre(nombreLimpio);
  if (error) return { ok: false, payload: null, errores: [error] };

  const payload = {
    estado,
    servicio_id: servicioId ?? null,
    barbero_nombre: nombreLimpio.trim(),
    ocupada_desde: ocupadaDesde ?? null
  };
  if (nombreSilla) payload.nombre = nombreSilla;

  return { ok: true, payload, errores: [] };
}

export function payloadLiberarSilla({ nombreSilla } = {}) {
  const payload = {
    estado: 'libre',
    servicio_id: null,
    barbero_nombre: '',
    ocupada_desde: null
  };
  if (nombreSilla) payload.nombre = nombreSilla;

  return { ok: true, payload, errores: [] };
}
