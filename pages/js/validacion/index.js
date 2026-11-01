/* =============================================================================
   Barbería Kraft — validacion/index.js (T27)
   -----------------------------------------------------------------------------
   Fachada pública de la capa de validación. Punto único de importación para
   páginas y formularios; oculta la estructura interna de reglas.

   Uso típico:
     import { REGLAS_REGISTRO, validarFormulario, presentadorDOM }
       from './validacion/index.js';
   ============================================================================= */

export { esValido, sinErrores } from './contrato.js';

export { validarEmail } from './reglas/email.js';
export { validarTelefono, sanearTelefono } from './reglas/telefono.js';
export {
  REQUISITOS_PASSWORD,
  evaluarRequisitosPassword,
  validarPassword,
  validarPasswordLogin
} from './reglas/password.js';
export { validarConfirmacion } from './reglas/confirmacion.js';
export {
  validarNombre,
  validarTitulo,
  validarDescripcion,
  validarBeneficio
} from './reglas/nombre.js';
export {
  validarPrecio,
  validarPrecioOpcional,
  validarEnteroPositivo
} from './reglas/numero.js';

export {
  crearRegistro,
  registrarRegla,
  obtenerReglas,
  REGLAS_REGISTRO,
  REGLAS_LOGIN,
  REGLAS_SERVICIO,
  REGLAS_PROMOCION
} from './registro-reglas.js';

export { validarCampo, validarFormulario } from './validador-formulario.js';
export { presentadorDOM, presentadorNulo } from './presentador-errores.js';
export { estadoChecklistPassword } from './checklist-password.js';
