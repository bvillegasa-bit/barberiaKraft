/* =============================================================================
   Barbería Kraft — supabase-client.js (design D6/D7 / T17)
   Cliente Supabase SINGLETON con sesión persistente (localStorage).

   El SDK @supabase/supabase-js se carga como bundle UMD/IIFE self-host
   (js/vendor/supabase.js) — descargado al repo para cumplir el CSP estricto
   (script-src 'self', sin CDN de terceros; design D2/D3/RNF01).
   El bundle expone el global `window.supabase` con createClient().

   Persistencia de sesión: supabase-js con persistSession:true guarda la sesión
   en localStorage → sobrevive a recargas (CA-RF03-3).
   ============================================================================= */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let cliente = null;

/**
 * Devuelve la instancia única del cliente Supabase (singleton).
 * Se crea de forma perezosa (lazy) la primera vez que se pide.
 */
export function getSupabase() {
  const sdk = window.supabase;
  if (!sdk || typeof sdk.createClient !== 'function') {
    throw new Error(
      'El SDK de Supabase no está cargado. Verifica que js/vendor/supabase.js se incluya antes que este módulo.'
    );
  }
  if (!cliente) {
    cliente = sdk.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,        // sesión en localStorage (CA-RF03-3)
        autoRefreshToken: true,      // refresco automático del JWT
        detectSessionInUrl: true     // detecta tokens de confirmación en la URL
      }
    });
  }
  return cliente;
}