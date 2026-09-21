/* =============================================================================
   Barbería Kraft — pagina-login.js (T22)
   Iniciar sesión (RF04): validación local (validacion.js), mensaje GENÉRICO de
   credenciales inválidas (CA-RF03-8 / CA-RNF03-5) y redirección por rol
   (cliente → index.html, admin → admin/dashboard.html — S-RF03-2/5).
   ============================================================================= */

import {
  iniciarNavbar,
  $,
  mostrarErrorCampo,
  limpiarErrorCampo,
  mostrarToast
} from './ui.js';
import { validarEmail, validarPassword } from './validacion.js';
import { iniciarSesion, redirigirPorRol } from './auth.js';
import { esConfigPlaceholder } from './config.js';

iniciarNavbar();

const avisoConfig = $('#aviso-config');
if (avisoConfig && esConfigPlaceholder()) avisoConfig.hidden = false;

const form = $('#form-login');
const btn = $('#btn-login');

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const inputEmail = $('#email');
  const inputPass = $('#password');
  const email = inputEmail.value.trim();
  const password = inputPass.value;

  limpiarErrorCampo(inputEmail);
  limpiarErrorCampo(inputPass);

  let valido = true;
  const eEmail = validarEmail(email);
  if (eEmail) {
    mostrarErrorCampo(inputEmail, eEmail);
    valido = false;
  }
  const ePass = validarPassword(password);
  if (ePass) {
    mostrarErrorCampo(inputPass, ePass);
    valido = false;
  }
  if (!valido) return;

  btn.disabled = true;
  const res = await iniciarSesion(email, password);
  btn.disabled = false;

  if (!res.ok) {
    // Mensaje genérico: no revela si el email existe (CA-RNF03-5)
    mostrarErrorCampo(inputPass, res.error || 'Correo o contraseña incorrectos.');
    mostrarToast(res.error || 'Correo o contraseña incorrectos.', 'error');
    return;
  }

  redirigirPorRol(res.rol);
});