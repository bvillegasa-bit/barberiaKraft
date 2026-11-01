/* =============================================================================
   Barbería Kraft — auth.js (design §9 / T20)
   Registro, login, logout, sesión persistente, guard admin y consentimiento
   Ley 29733. Seguridad: mensajes genéricos de login (CA-RF03-8 / CA-RNF03-5),
   rol NUNCA en el payload del registro (CA-RF03-6), hashing delegado a
   Supabase Auth (RNF03). RLS como segunda barrera en cada operación.
   ============================================================================= */

import { getSupabase } from './supabase-client.js';

/**
 * Mapea errores de Supabase Auth a mensajes en español sin filtrar
 * información sensible (CA-RF03-7/8).
 */
function mensajeErrorAuth(error) {
  const msg = String((error && error.message) || '').toLowerCase();
  if (msg.includes('already') || error?.code === 'user_already_exists') {
    return 'El correo ya está registrado.';
  }
  if (msg.includes('password')) {
    return 'La contraseña no cumple los requisitos (mínimo 8 caracteres).';
  }
  if (msg.includes('email') || msg.includes('correo')) {
    return 'Ingresa un correo electrónico válido.';
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}

/**
 * Registro de cliente (RF03 / S-RF03-1).
 * ⚠️ El payload NUNCA transporta rol (CA-RF03-6): Supabase crea profiles.rol
 * = 'cliente' vía trigger handle_new_user.
 * @param {string} nombre
 * @param {string} email
 * @param {string} password
 * @param {string} [telefono] Teléfono opcional (9 dígitos, ya saneado).
 * @returns {Promise<{ok:boolean, necesitaConfirmacion?:boolean, error?:string}>}
 */
export async function registrarCliente(nombre, email, password, telefono = '') {
  const supabase = getSupabase();
  const emailLimpio = normalizarEmail(email);
  const telefonoLimpio = normalizarTelefono(telefono);
  const datosUsuario = { nombre }; // minimización Ley 29733: sin rol
  if (telefonoLimpio) datosUsuario.telefono = telefonoLimpio;

  const { data, error } = await supabase.auth.signUp({
    email: emailLimpio,
    password,
    options: {
      data: datosUsuario
    }
  });

  if (error) {
    return { ok: false, error: mensajeErrorAuth(error) };
  }

  const session = data?.session;
  if (session) {
    // Verificación de email DESACTIVADA: sesión inmediata → aplica el
    // consentimiento Ley 29733 y sincroniza el teléfono (T27).
    await aplicarConsentimientoPendiente();
    await sincronizarTelefonoCliente(telefonoLimpio);
    return { ok: true, necesitaConfirmacion: false };
  }

  // Verificación de email ACTIVADA: Supabase envía correo de confirmación.
  // El teléfono queda en user_metadata; se sincronizará en el primer login.
  return { ok: true, necesitaConfirmacion: true };
}

/**
 * Inicio de sesión (RF04). Mensaje GENÉRICO para credenciales inválidas
 * (CA-RF03-8 / CA-RNF03-5): igual para email inexistente y password errónea.
 * @returns {Promise<{ok:boolean, rol?:string, error?:string}>}
 */
export async function iniciarSesion(email, password) {
  const supabase = getSupabase();
  const emailLimpio = normalizarEmail(email);
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailLimpio, password });

  if (error || !data?.session) {
    return { ok: false, error: 'Correo o contraseña incorrectos.' };
  }

  // Consumo pendiente de consentimiento Ley 29733 (si aplica) + teléfono
  // registrado en metadata (primer login tras confirmar email) + rol.
  await aplicarConsentimientoPendiente();
  await sincronizarTelefonoCliente();
  const rol = await obtenerRol();
  return { ok: true, rol };
}

/**
 * Rol del usuario actual desde la base (profiles) vía rpc get_my_role.
 * Sin sesión o sin fila de perfil → 'cliente' (default seguro).
 */
export async function obtenerRol() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_my_role');
    if (error) throw error;
    return data === 'admin' ? 'admin' : 'cliente';
  } catch {
    return 'cliente'; // fallback seguro: nunca asume admin (CA-RF03-6)
  }
}

/** Redirige según el rol tras login (S-RF03-2 / S-RF03-5). */
export function redirigirPorRol(rol) {
  window.location.href = rol === 'admin' ? 'admin/dashboard.html' : 'index.html';
}

/**
 * Cierre de sesión: signOut limpia la sesión (localStorage) y redirige al
 * inicio (CA-RF03-3).
 */
export async function cerrarSesion() {
  try {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  } finally {
    // ../index.html: desde /admin/* se sube al público; desde la raíz también
    // resuelve bien (el padre de la raíz es la raíz).
    window.location.href = '../index.html';
  }
}

/**
 * Suscripción a cambios de sesión (onAuthStateChange) para UI reactiva.
 * @param {(evento: string, sesion: object|null) => void} alCambiar
 * @returns {Function|null} función para desuscribirse (o null)
 */
export function observarSesion(alCambiar) {
  try {
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (typeof alCambiar === 'function') alCambiar(evento, sesion);
    });
    return data?.subscription || null;
  } catch {
    return null;
  }
}

/**
 * GUARD del panel admin (S-RF03-6 / CA-RF03-5):
 * - Sin sesión        → redirige a ../login.html
 * - Sesión de cliente → redirige a index público
 * - Sesión de admin   → permite continuar
 * @returns {Promise<string>} 'admin' | 'cliente' | 'sin-sesion'
 */
export async function guardAdmin() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const sesion = data?.session;

  if (!sesion) {
    // ../login.html: desde /admin/dashboard.html resuelve a /login.html
    window.location.replace('../login.html');
    return 'sin-sesion';
  }

  const rol = await obtenerRol();
  if (rol !== 'admin') {
    // Desde pages/admin/dashboard.html se sube un nivel al público
    window.location.replace('../index.html');
    return 'cliente';
  }
  return 'admin';
}

/* -----------------------------------------------------------------------------
   Teléfono del cliente (T27)
   El teléfono es OPCIONAL. Se envía en user_metadata del signUp; la tabla
   `clientes` lo recibe al primer inicio con sesión (si el proyecto exige
   confirmar email, el metadata sobrevive y se sincroniza en el primer login).
   Best-effort: un fallo NUNCA rompe el registro/login (RNF07).
   ----------------------------------------------------------------------------- */

/** Deja solo dígitos del teléfono; '' si no hay valor. */
function normalizarTelefono(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/** Normaliza el email para almacenarlo/consultarlo: sin espacios y minúsculas. */
function normalizarEmail(valor) {
  return String(valor ?? '').trim().toLowerCase();
}

/**
 * Sincroniza clientes.telefono desde el argumento o desde user_metadata.
 * Solo actualiza si la fila está vacía o si el número cambió.
 * @param {string} [telefono] Teléfono ya saneado (opcional).
 * @returns {Promise<boolean>} true si se actualizó una fila.
 */
export async function sincronizarTelefonoCliente(telefono = null) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false; // sin sesión (p. ej. confirmación de email pendiente)

    const deseado = normalizarTelefono(
      telefono !== null && telefono !== undefined ? telefono : user.user_metadata?.telefono
    );
    if (!deseado) return false; // no hay teléfono que sincronizar

    const { data: fila, error: errorLectura } = await supabase
      .from('clientes')
      .select('telefono')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (errorLectura) throw errorLectura;

    if (fila && fila.telefono === deseado) return false; // ya está al día

    const { error } = await supabase
      .from('clientes')
      .update({ telefono: deseado })
      .eq('profile_id', user.id);
    if (error) throw error;

    return true;
  } catch (e) {
    console.warn('auth.js — sincronizarTelefonoCliente:', e);
    return false;
  }
}

/* -----------------------------------------------------------------------------
   Consentimiento Ley 29733 (RNF03 / CA-RNF03-4)
   El checkbox OBLIGATORIO se marca en registro.html (T23). Aquí se PERSISTE
   el consentimiento en la fila `clientes.consentimiento_datos = true` en el
   primer inicio de sesión (design §9). Idempotente y no bloqueante: si el
   UPDATE falla, el flujo de auth continúa (RNF07).
   ----------------------------------------------------------------------------- */
export async function aplicarConsentimientoPendiente() {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('clientes')
      .update({ consentimiento_datos: true })
      .eq('profile_id', user.id);

    if (error) {
      console.warn('auth.js — no se pudo registrar el consentimiento:', error.message);
    }
  } catch (e) {
    console.warn('auth.js — aplicarConsentimientoPendiente:', e);
  }
}