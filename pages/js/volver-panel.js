/* =============================================================================
   Barbería Kraft - volver-panel.js
   Enlace fijo "← Volver al panel" visible SOLO con sesión de rol admin.
   -----------------------------------------------------------------------------
   - Reutiliza observarSesion()/obtenerRol() de auth.js y getSupabase().
   - Alterna únicamente el atributo `hidden` (global [hidden] fuerza display:none).
   - Sin estilos ni handlers inline (CSP estricto).
   - La decisión vive en logica/volver-panel-logica.js (función pura, testeada).
   ============================================================================ */

import { observarSesion, obtenerRol } from './auth.js';
import { getSupabase } from './supabase-client.js';
import { debeMostrarVolverPanel } from './logica/volver-panel-logica.js';

/**
 * Aplica la visibilidad calculada al enlace.
 * @param {HTMLElement|null} enlace
 * @param {object|null} sesion
 * @param {string|null} rol
 */
export function aplicarEstadoVolverPanel(enlace, sesion, rol) {
  if (!enlace) return;
  enlace.hidden = !debeMostrarVolverPanel(sesion, rol);
}

/**
 * Conecta el enlace #volver-panel con la sesión y el rol actuales.
 * Reactivo ante INITIAL_SESSION / SIGNED_IN / SIGNED_OUT, más una comprobación
 * puntual al montar por si INITIAL_SESSION no llega.
 * @param {Document} [doc]
 */
export function configurarVolverPanel(doc = document) {
  const enlace = doc.getElementById('volver-panel');
  if (!enlace) return;

  const aplicar = async (sesion) => {
    if (!sesion || !sesion.user) {
      aplicarEstadoVolverPanel(enlace, null, null);
      return;
    }

    const usuarioId = sesion.user.id || null;
    let rol = null;
    try {
      rol = await obtenerRol();
    } catch {
      rol = null;
    }

    // Evita mostrar el enlace si la sesión cambió mientras se consultaba el rol.
    try {
      const { data } = await getSupabase().auth.getSession();
      if ((data?.session?.user?.id || null) !== usuarioId) return;
    } catch {
      aplicarEstadoVolverPanel(enlace, null, null);
      return;
    }

    aplicarEstadoVolverPanel(enlace, sesion, rol);
  };

  observarSesion((_evento, sesion) => aplicar(sesion));

  try {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => aplicar(data?.session))
      .catch(() => aplicarEstadoVolverPanel(enlace, null, null));
  } catch {
    // SDK no disponible: el enlace nace `hidden` (fail-safe).
    aplicarEstadoVolverPanel(enlace, null, null);
  }
}
