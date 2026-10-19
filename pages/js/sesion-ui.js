/* =============================================================================
   Barbería Kraft — sesion-ui.js (HU04 · requisito de usabilidad)
   Badge reutilizable en la esquina INFERIOR DERECHA que muestra "Sesión: {nombre}"
   cuando hay sesión activa y se oculta al cerrar sesión, SIN recargar la página.
   Se monta en index.html (via pagina-inicio.js) y en admin/dashboard.html
   (via pagina-admin.js).

   Fuente de verdad: observarSesion() de auth.js (onAuthStateChange) → eventos
   INITIAL_SESSION / SIGNED_IN / SIGNED_OUT.

   Seguridad/minimización (Ley 29733): el email COMPLETO nunca se muestra;
   si falta el nombre se usa solo la parte local (antes de "@").
   CSP estricto (pages/_headers): SIN estilos ni handlers inline — solo clases
   CSS y addEventListener. El texto se escribe con textContent (anti-XSS).
   ============================================================================= */

import { observarSesion } from './auth.js';

/**
 * Texto del usuario a mostrar para la sesión actual.
 * Prioridad: user_metadata.nombre → parte local del email → "Sesión activa".
 * @param {object|null} sesion Sesión de Supabase Auth
 * @returns {string|null} null si no hay sesión (ocultar el badge)
 */
function nombreAMostrar(sesion) {
  const usuario = sesion?.user;
  if (!usuario) return null;

  const nombre = String(usuario.user_metadata?.nombre || '').trim();
  if (nombre) return nombre;

  // Fallback: solo la parte antes de "@" (nunca el email completo)
  const email = String(usuario.email || '').trim();
  const local = email.split('@')[0].trim();
  if (local) return local;

  return 'Sesión activa';
}

/**
 * Monta (idempotente — una sola vez por página) el badge fijo de sesión y lo
 * mantiene sincronizado en vivo con los cambios de autenticación.
 * No bloqueante: si Supabase/auth.js no están disponibles, el badge queda oculto.
 *
 * @param {{ rutaSprite?: string }} [opciones]
 *   rutaSprite: ruta al sprite.svg relativa al documento. Desde /admin/ debe
 *   pasar '../assets/sprite.svg' (mismo criterio documentado en admin-ui.js).
 * @returns {HTMLElement|null} el elemento #badge-sesion (o null si no se montó)
 */
export function montarBadgeSesion({ rutaSprite = 'assets/sprite.svg' } = {}) {
  let badge = document.getElementById('badge-sesion');

  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'badge-sesion';
    badge.className = 'badge-sesion';
    badge.setAttribute('role', 'status');
    badge.setAttribute('aria-live', 'polite');
    badge.hidden = true; // oculto hasta confirmar sesión (INITIAL_SESSION)

    // Icono estático (ruta provista por la página, no por el usuario) + span
    // para el texto. El contenido del span se escribe SIEMPRE con textContent.
    badge.innerHTML = `
      <svg class="icono" role="img" aria-hidden="true" focusable="false">
        <use href="${rutaSprite}#icon-usuario"></use>
      </svg>
      <span class="badge-sesion__texto"></span>
    `;
    document.body.appendChild(badge);
  }

  const texto = badge.querySelector('.badge-sesion__texto');

  /** Aplica la sesión al badge: muestra "Sesión: {nombre}" u oculta. */
  const actualizar = (sesion) => {
    const nombre = nombreAMostrar(sesion);
    if (!nombre) {
      badge.hidden = true;
      if (texto) texto.textContent = '';
      return;
    }
    if (texto) texto.textContent = `Sesión: ${nombre}`;
    badge.hidden = false;
  };

  // Reactivo: INITIAL_SESSION al cargar · SIGNED_IN tras login · SIGNED_OUT
  // tras logout. Sin necesidad de recargar la página.
  observarSesion((_evento, sesion) => actualizar(sesion));

  return badge;
}
