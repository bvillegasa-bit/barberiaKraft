/* =============================================================================
   Barbería Kraft — validacion.js (FACHADA DE COMPATIBILIDAD · T27)
   -----------------------------------------------------------------------------
   La implementación vive ahora en `pages/js/validacion/` (SOLID · TDD).
   Este archivo conserva los exports históricos para no romper imports viejos
   (admin-servicios.js, admin-promociones.js, pagina-registro.js, pagina-login.js)
   mientras se migran a `./validacion/index.js`.

   ⚠️ `validarPassword` ahora exige FORTALEZA (mayúscula, minúscula, número y
   carácter especial). El login debe usar `validarPasswordLogin` o, mejor, el
   mapa REGLAS_LOGIN.
   ============================================================================= */

export { validarEmail } from './validacion/reglas/email.js';
export { validarTelefono, sanearTelefono } from './validacion/reglas/telefono.js';
export { validarPassword, validarPasswordLogin } from './validacion/reglas/password.js';
export { validarConfirmacion } from './validacion/reglas/confirmacion.js';
export {
  validarNombre,
  validarTitulo,
  validarDescripcion,
  validarBeneficio
} from './validacion/reglas/nombre.js';
export {
  validarPrecio,
  validarPrecioOpcional,
  validarEnteroPositivo
} from './validacion/reglas/numero.js';

export { validarCampo, validarFormulario } from './validacion/validador-formulario.js';
export {
  REGLAS_REGISTRO,
  REGLAS_LOGIN,
  REGLAS_SERVICIO,
  REGLAS_PROMOCION
} from './validacion/registro-reglas.js';
export { presentadorDOM, presentadorNulo } from './validacion/presentador-errores.js';
export { estadoChecklistPassword } from './validacion/checklist-password.js';
