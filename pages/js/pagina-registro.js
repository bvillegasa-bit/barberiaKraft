/* =============================================================================
   Barbería Kraft — pagina-registro.js (T23)
   Registro de cliente (RF03): SOLO nombre, email y contraseña (minimización
   Ley 29733) + checkbox OBLIGATORIO de consentimiento (CA-RNF03-4 / S-RF03-1).
   El payload del registro NUNCA transporta rol (CA-RF03-6).
   ============================================================================= */

import {
  iniciarNavbar,
  $,
  mostrarErrorCampo,
  limpiarErrorCampo,
  mostrarToast
} from './ui.js';
import { validarEmail, validarPassword, validarNombre } from './validacion.js';
import { registrarCliente, redirigirPorRol } from './auth.js';
import { esConfigPlaceholder } from './config.js';

iniciarNavbar();

const avisoConfig = $('#aviso-config');
if (avisoConfig && esConfigPlaceholder()) avisoConfig.hidden = false;

const form = $('#form-registro');
const btn = $('#btn-registro');

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const inputNombre = $('#nombre');
  const inputEmail = $('#email');
  const inputPass = $('#password');
  const checkboxConsentimiento = $('#consentimiento');

  const nombre = inputNombre.value.trim();
  const email = inputEmail.value.trim();
  const password = inputPass.value;

  [inputNombre, inputEmail, inputPass, checkboxConsentimiento].forEach(limpiarErrorCampo);

  let valido = true;

  const eNombre = validarNombre(nombre);
  if (eNombre) {
    mostrarErrorCampo(inputNombre, eNombre);
    valido = false;
  }
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

  // Ley 29733 (RNF03 / CA-RNF03-4): sin consentimiento el registro NO procede
  if (!checkboxConsentimiento.checked) {
    mostrarErrorCampo(
      checkboxConsentimiento,
      'Debes aceptar el tratamiento de tus datos personales para continuar.'
    );
    valido = false;
  }

  if (!valido) return;

  btn.disabled = true;
  const res = await registrarCliente(nombre, email, password);
  btn.disabled = false;

  if (!res.ok) {
    // Email duplicado → "El correo ya está registrado" (CA-RF03-7)
    mostrarErrorCampo(inputEmail, res.error || 'No se pudo completar el registro.');
    mostrarToast(res.error || 'No se pudo completar el registro.', 'error');
    return;
  }

  if (res.necesitaConfirmacion) {
    // Verificación de email activada en Supabase
    mostrarToast('Revisa tu correo para confirmar tu cuenta.', 'info', 6000);
    form.reset();
  } else {
    mostrarToast('Cuenta creada. ¡Bienvenido a Barbería Kraft!', 'exito');
    setTimeout(() => redirigirPorRol('cliente'), 1200);
  }
});