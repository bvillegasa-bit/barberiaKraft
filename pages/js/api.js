/* =============================================================================
   Barbería Kraft — api.js (T19)
   Carga de datos públicos: servicios activos (RF01) y promociones activas
   (RF05), con manejo de errores/offline POR SECCIÓN (RNF07 / CA-RNF07-2):
   el fallo de una sección NUNCA bloquea las demás.

   Convención de retorno: { ok: true, data } · { ok: false, error }
   (nunca lanzan hacia el llamador; cada página decide cómo renderizar).
   ============================================================================= */

import { getSupabase } from './supabase-client.js';

/** Mensaje de error amigable según el estado de conexión (CA-RNF07-1) */
export function mensajeErrorSeccion(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'No se pudo conectar. Reintenta';
  }
  // Error de configuración pendiente (placeholders sin reemplazar)
  if (error && typeof error.message === 'string' && error.message.includes('configuración')) {
    return 'Configuración pendiente del proyecto. Revisa js/config.js.';
  }
  return 'No se pudo conectar. Reintenta';
}

/**
 * SELECT servicios con activo = true, ordenados por (orden, nombre).
 * Solo columnas públicas necesarias (CA-RF01-4); RLS excluye inactivos (S-RF01-2).
 * @returns {Promise<{ok:boolean, data?:Array, error?:Error}>}
 */
export async function cargarServiciosActivos() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('servicios')
      .select('id, nombre, descripcion, precio_soles, duracion_min')
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (error) {
    console.error('api.js — cargarServiciosActivos:', error);
    return { ok: false, error };
  }
}

/**
 * SELECT promociones con activo = true, más recientes primero.
 * RLS excluye inactivas (S-RF05-2).
 * @returns {Promise<{ok:boolean, data?:Array, error?:Error}>}
 */
export async function cargarPromocionesActivas() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('promociones')
      .select('id, titulo, descripcion, beneficio, precio_oferta_soles')
      .eq('activo', true)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (error) {
    console.error('api.js — cargarPromocionesActivas:', error);
    return { ok: false, error };
  }
}

/* -----------------------------------------------------------------------------
   Mensajes de error en español para OPERACIONES DE ESCRITURA del panel admin
   (T24–T27). Mapea códigos PostgreSQL / Supabase a textos accionables sin
   exponer detalles técnicos (RNF03, diseño centrado en el usuario):
   23514 + limite_sillas_alcanzado → trigger check_limite_sillas (sillas)
   23505 / duplicate              → unicidad (nombres duplicados)
   42501 / Row Level Security    → falta promover el rol admin
   42P01  / relation inexistente → faltan las tablas (migración 0001)
   23514 genérico                → violación de CHECK en la BD
   ----------------------------------------------------------------------------- */
export function mensajeErrorAdmin(error) {
  const mensaje = String((error && error.message) || '');
  const codigo = String((error && error.code) || '');
  const normalizado = mensaje.toLowerCase();

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  }
  if (normalizado.includes('configuración')) {
    return 'Configuración pendiente del proyecto. Revisa js/config.js.';
  }
  if (codigo === '23514' || normalizado.includes('limite_sillas')) {
    return 'Límite de sillas alcanzado. Libera una silla antes de ocupar otra.';
  }
  if (codigo === '23505' || normalizado.includes('duplicate')) {
    return 'Ya existe un registro con ese nombre. Usa otro.';
  }
  if (codigo === '42501' || normalizado.includes('row-level security')) {
    return 'No tienes permisos de administrador en la base. Aplica la migración 0002_promote_admin.sql.';
  }
  if (codigo === '42P01' || normalizado.includes('relation')) {
    return 'Faltan las tablas del sistema. Aplica la migración 0001_init.sql en Supabase.';
  }
  if (codigo === '23514') {
    return 'El valor no cumple las reglas de la base (revisa precios, duraciones y límites).';
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}