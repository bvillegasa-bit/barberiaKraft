/* =============================================================================
   Barbería Kraft — config.template.js (design D6 / T16 — FUENTE VERSIONADA)
   -----------------------------------------------------------------------------
   ⚠️ ESTE ARCHIVO SE VERSIONA CON TOKENS (placeholders). NO lo edites con
   valores reales: el build (`build.js` / CI) genera `pages/js/config.js` y
   `dist/js/config.js` a partir de esta plantilla, sustituyendo los tokens por
   los valores de las variables de entorno:

     SUPABASE_URL      → __SUPABASE_URL__
     SUPABASE_ANON_KEY → __SUPABASE_ANON_KEY__

   El archivo GENERADO (`js/config.js`) NO se versiona (ver .gitignore): el
   único lugar con los valores reales son los GitHub Secrets (producción) o las
   env vars locales (desarrollo). Documentado en docs/README.md.

   ⚠️ SEGURIDAD (CA-RNF03-2):
   - La anon key es PÚBLICA por diseño de Supabase: el frontend la necesita y la
     seguridad real la aporta RLS (Row Level Security), NO esta llave. Aun así,
     por política del grupo tampoco se versiona: se inyecta en el build.
   - La key `service_role` NUNCA debe colocarse aquí (ni como env, ni en el repo,
     ni en docs): da acceso total/omnisciente a la base de datos.
   ============================================================================= */

export const SUPABASE_URL = '__SUPABASE_URL__';

export const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

/**
 * True si la configuración sigue siendo la de plantilla (tokens sin reemplazar).
 * Útil para mostrar un mensaje amigable de setup en lugar de errores de red
 * confusos (RNF07: comportamiento predecible ante fallos).
 */
export function esConfigPlaceholder() {
  return (
    SUPABASE_URL.includes('__SUPABASE_URL__') ||
    SUPABASE_URL.includes('TU-PROYECTO') ||
    SUPABASE_ANON_KEY.includes('__SUPABASE_ANON_KEY__') ||
    SUPABASE_ANON_KEY.includes('TU_ANON_KEY')
  );
}