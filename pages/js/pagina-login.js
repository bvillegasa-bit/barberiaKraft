/* =============================================================================
   Barbería Kraft — pagina-login.js (T22 · T27)
   Iniciar sesión (RF04): validación local SOLO de email (formato) y contraseña
   no vacía/≤64. NO se exige fortaleza ni confirmación en login.
   Mensaje GENÉRICO de credenciales inválidas (CA-RF03-8 / CA-RNF03-5) y
   redirección por rol (S-RF03-2 / S-RF03-5).
   ============================================================================= */

import { iniciarNavbar, $, mostrarToast } from './ui.js';
import {
  REGLAS_LOGIN,
  validarFormulario,
  presentadorDOM
} from './validacion/index.js';
import { iniciarSesion, redirigirPorRol } from './auth.js';
import { esConfigPlaceholder } from './config.js';

iniciarNavbar();

const avisoConfig = $('#aviso-config');
if (avisoConfig && esConfigPlaceholder()) avisoConfig.hidden = false;

const form = $('#form-login');
const btn = $('#btn-login');

const CAMPOS = {
  email: $('#email'),
  password: $('#password')
};

CAMPOS.email.addEventListener('input', () => presentadorDOM.limpiar(CAMPOS.email));
CAMPOS.password.addEventListener('input', () => presentadorDOM.limpiar(CAMPOS.password));

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const datos = {
    email: CAMPOS.email.value.trim(),
    password: CAMPOS.password.value
  };

  Object.values(CAMPOS).forEach(presentadorDOM.limpiar);

  const resultado = validarFormulario(datos, REGLAS_LOGIN);
  if (!resultado.ok) {
    Object.entries(resultado.errores).forEach(([campo, mensaje]) => {
      presentadorDOM.mostrar(CAMPOS[campo], mensaje);
    });
    if (CAMPOS[resultado.primero]) CAMPOS[resultado.primero].focus();
    return;
  }

  btn.disabled = true;
  const res = await iniciarSesion(datos.email, datos.password);
  btn.disabled = false;

  if (!res.ok) {
    // Mensaje genérico: no revela si el email existe (CA-RNF03-5)
    const mensaje = res.error || 'Correo o contraseña incorrectos.';
    presentadorDOM.mostrar(CAMPOS.password, mensaje);
    mostrarToast(mensaje, 'error');
    return;
  }

  redirigirPorRol(res.rol);
});
