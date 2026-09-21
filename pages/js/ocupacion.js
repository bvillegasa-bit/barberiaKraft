/* =============================================================================
   Barbería Kraft — ocupacion.js (design D4 / T18)
   Ocupación del local: función JS PURA `calcularOcupacion` (espejo testeable de
   la fórmula spec §3.2 — CA-RNF06-3) + `fetchOcupacion`/`cargarOcupacion` que
   SIEMPRE consultan la función SQL `obtener_ocupacion` (fuente de verdad — D4).

   Fórmula (spec §3.2):
     porcentaje = REDONDEAR(sillas_ocupadas / sillas_totales × 100, 0)
     espera     = REDONDEAR.MAS(tiempo_promedio × sillas_ocupadas / sillas_totales, 0)
     espera     = MIN(espera, techo_espera_min)   → techo 60

   Casos de la tabla spec: 0/4→0%,0 · 1/4→25%,8 · 2/4→50%,15 · 3/4→75%,23 ·
   4/4→100%,30 · duración 70 con 4/4 → techo 60 min.
   ============================================================================= */

import { getSupabase } from './supabase-client.js';
import { renderSemaforo } from './ui.js';

/**
 * Cálculo de ocupación (función PURA — testeable sin red, CA-RNF06-3).
 * @param {object} p
 * @param {number} p.sillasOcupadas        Sillas con estado 'ocupada'
 * @param {number} p.sillasTotales         Capacidad del local (default 4)
 * @param {number} [p.duracionPromedioMin] Duración promedio (default 30)
 * @param {number} [p.techoMin]            Techo de espera mostrada (default 60)
 * @returns {{ porcentaje: number, esperaMin: number }}
 */
export function calcularOcupacion({ sillasOcupadas, sillasTotales, duracionPromedioMin, techoMin }) {
  const ocupadas = Number(sillasOcupadas) || 0;
  const totales = Number(sillasTotales) || 0;
  const duracion = Number(duracionPromedioMin) || 30;
  const techo = Number(techoMin) || 60;

  // Evita división por cero: sin capacidad configurada se muestra 0% sin espera.
  if (totales <= 0) {
    return { porcentaje: 0, esperaMin: 0 };
  }

  const porcentaje = Math.round((ocupadas / totales) * 100);
  const esperaBruta = (duracion * ocupadas) / totales;
  const espera = Math.min(Math.ceil(esperaBruta), techo);

  return { porcentaje, esperaMin: espera };
}

/**
 * Consulta la ocupación SIEMPRE desde el servidor: rpc('obtener_ocupacion')
 * (fuente de verdad — D4, CA-RF02-1). Devuelve el primer registro:
 * { sillas_totales, sillas_ocupadas, porcentaje, espera_min }.
 * @returns {Promise<{sillas_totales:number, sillas_ocupadas:number, porcentaje:number, espera_min:number}>}
 */
export async function fetchOcupacion() {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('obtener_ocupacion');
  if (error) {
    throw error; // el llamador (sección) decide cómo renderizar (RNF07)
  }
  if (!data || data.length === 0) {
    throw new Error('La función obtener_ocupacion no devolvió datos.');
  }
  return data[0];
}

/**
 * Carga la ocupación desde el rpc y renderiza el semáforo en el contenedor.
 * El público SIEMPRE renderiza desde el servidor (nunca con calcularOcupacion).
 * @param {HTMLElement} contenedor  Elemento donde mostrar el semáforo
 * @returns {Promise<object|null>}  Datos renderizados o null si falló
 */
export async function cargarOcupacion(contenedor) {
  try {
    const datos = await fetchOcupacion();
    renderSemaforo(contenedor, {
      porcentaje: datos.porcentaje,
      esperaMin: datos.espera_min
    });
    return datos;
  } catch (error) {
    console.error('No se pudo cargar la ocupación:', error);
    return null;
  }
}