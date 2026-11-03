/* =============================================================================
   Barbería Kraft — navbar-sesion.js
   -----------------------------------------------------------------------------
   Oculta "Iniciar sesión" y "Registrarse" cuando hay sesión activa.
   Usa el contrato puro estadoUiSesion() (logica/sesion-logica.js) y alterna
   SOLO el atributo `hidden` (sin estilos ni handlers inline; CSP estricto).
   ============================================================================= */

import { observarSesion } from './auth.js';
import { getSupabase } from './supabase-client.js';
import { estadoUiSesion } from './logica/sesion-logica.js';

const SELECTORES_ACCESO = ['#nav-login', '#nav-registro'];

/**
 * Aplica la visibilidad de los accesos públicos según la sesión.
 * @param {object|null} sesion
 */
export function aplicarAccesoNavbar(sesion) {
  const { mostrarAcceso } = estadoUiSesion(sesion);
  for (const selector of SELECTORES_ACCESO) {
    const elemento = document.querySelector(selector);
    if (elemento) elemento.hidden = !mostrarAcceso;
  }
}

/**
 * Conecta el navbar con la sesión (reactivo + comprobación puntual).
 * Idempotente por página: si no hay enlaces de acceso, no hace nada.
 */
export function configurarNavbarSesion() {
  if (!document.querySelector(SELECTORES_ACCESO.join(','))) return;

  observarSesion((_evento, sesion) => aplicarAccesoNavbar(sesion));

  try {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => aplicarAccesoNavbar(data?.session))
      .catch(() => aplicarAccesoNavbar(null));
  } catch {
    // SDK no disponible: se muestran los accesos (sin sesión confirmada).
    aplicarAccesoNavbar(null);
  }
}
