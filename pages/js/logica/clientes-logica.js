/* =============================================================================
   Barbería Kraft — logica/clientes-logica.js (HU13 — lógica PURA)
   ---------------------------------------------------------------------------
   Funciones puras extraídas de admin-clientes.js para testearlas con el
   runner nativo de Node (node:test) SIN DOM ni Supabase.

   Reglas: excluir solo cuentas EXCLUSIVAMENTE administrativas (perfil con rol 'admin').
   Un cliente sin profile_id NO es admin. Minimización de datos (Ley 29733).
   ============================================================================ */

/**
 * ¿El perfil corresponde a una cuenta exclusivamente administrativa?
 * @param {{ rol?: string }|null|undefined} perfil
 * @returns {boolean}
 */
export function esCuentaAdmin(perfil) {
  return Boolean(perfil && perfil.rol === 'admin');
}

/**
 * Excluye los clientes cuyo profile_id pertenece a un perfil con rol 'admin'.
 * Conserva los clientes sin profile_id.
 * @param {Array<object>} filas
 * @param {Array<object>} perfiles
 * @returns {Array<object>} Nuevo array filtrado (no muta)
 */
export function filtrarClientesNoAdmin(filas = [], perfiles = []) {
  const perfilesArr = Array.isArray(perfiles) ? perfiles : [];
  const filasArr = Array.isArray(filas) ? filas : [];
  const idsAdministrativos = new Set(
    perfilesArr.filter(esCuentaAdmin).map((p) => p.id)
  );
  return filasArr.filter((fila) => !(fila?.profile_id && idsAdministrativos.has(fila.profile_id)));
}

/**
 * Proyecta SOLO los campos públicos permitidos.
 * NUNCA expone password, hash, profile_id ni columnas sensibles.
 * @param {object|null|undefined} fila
 * @returns {{ nombre: string, email: string, telefono: string, creado_en: string }}
 */
export function mapearClientePublico(fila) {
  return {
    nombre: fila?.nombre ?? '',
    email: fila?.email ?? '',
    telefono: fila?.telefono ?? '',
    creado_en: fila?.creado_en ?? ''
  };
}

/**
 * Ordena por fecha de registro DESC. Fechas ausentes/inválidas al final. No muta.
 * @param {Array<object>} filas
 * @returns {Array<object>}
 */
export function ordenarClientes(filas = []) {
  const filasArr = Array.isArray(filas) ? filas : [];
  return [...filasArr].sort((a, b) => compararFechasDesc(a?.creado_en, b?.creado_en));
}

/**
 * Compara dos fechas DESC. Ausentes/inválidas van al final; empate → 0.
 * @param {string|Date|null|undefined} a
 * @param {string|Date|null|undefined} b
 * @returns {number}
 */
export function compararFechasDesc(a, b) {
  const ta = Date.parse(a ?? '');
  const tb = Date.parse(b ?? '');
  const validaA = Number.isFinite(ta);
  const validaB = Number.isFinite(tb);
  if (!validaA && !validaB) return 0;
  if (!validaA) return 1;
  if (!validaB) return -1;
  return tb - ta;
}

/**
 * Fecha en formato local es-PE (dd/mm/aaaa). Ausente/inválida → "—"
 * @param {string|Date|null|undefined} valor
 * @returns {string}
 */
export function formatearFecha(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
