/* =============================================================================
   Barbería Kraft — pagina-registro.js (T23 · T27)
   Registro de cliente (RF03): nombre, teléfono OBLIGATORIO, email, contraseña
   con fortaleza + confirmación y consentimiento OBLIGATORIO (Ley 29733).
   - Validación por capas: reglas puras inyectadas en el motor (SOLID · TDD).
   - Errores accesibles junto al campo (aria-describedby/aria-invalid).
   - Checklist de contraseña en vivo con aria-live="polite".
   - El payload del registro NUNCA transporta rol (CA-RF03-6).
   ============================================================================= */

import { iniciarNavbar, $, mostrarToast } from './ui.js';
import {
  REGLAS_REGISTRO,
  validarCampo,
  validarFormulario,
  presentadorDOM,
  estadoChecklistPassword,
  sanearTelefono
} from './validacion/index.js';
import { registrarCliente, redirigirPorRol } from './auth.js';
import { esConfigPlaceholder } from './config.js';
import { iniciarTogglePassword } from './visibilidad-password-ui.js';
import { configurarNavbarSesion } from './navbar-sesion.js';

iniciarNavbar();
configurarNavbarSesion();

const avisoConfig = $('#aviso-config');
if (avisoConfig && esConfigPlaceholder()) avisoConfig.hidden = false;

const form = $('#form-registro');
const btn = $('#btn-registro');
const checklist = $('#checklist-password');

const CAMPOS = {
  nombre: $('#nombre'),
  telefono: $('#telefono'),
  email: $('#email'),
  password: $('#password'),
  confirmar_password: $('#confirmar-password')
};
const checkboxConsentimiento = $('#consentimiento');

const togglePassword = iniciarTogglePassword($('#btn-toggle-password'), CAMPOS.password);
const toggleConfirmar = iniciarTogglePassword(
  $('#btn-toggle-confirmar-password'),
  CAMPOS.confirmar_password
);

/* -----------------------------------------------------------------------------
   Checklist vivo de contraseña (RF03 · T27)
   ----------------------------------------------------------------------------- */
function renderChecklistPassword(valor) {
  if (!checklist) return;
  checklist.replaceChildren();

  estadoChecklistPassword(valor).forEach(({ id, etiqueta, cumple }) => {
    const item = document.createElement('li');
    item.className = `checklist-password__item${cumple ? ' checklist-password__item--cumple' : ''}`;
    item.dataset.requisito = id;
    item.textContent = etiqueta;
    checklist.appendChild(item);
  });
}

/* -----------------------------------------------------------------------------
   Saneado en vivo del teléfono: solo dígitos (T27)
   ----------------------------------------------------------------------------- */
CAMPOS.telefono.addEventListener('input', () => {
  const limpio = sanearTelefono(CAMPOS.telefono.value);
  if (CAMPOS.telefono.value !== limpio) CAMPOS.telefono.value = limpio;
  presentadorDOM.limpiar(CAMPOS.telefono);
});

CAMPOS.telefono.addEventListener('blur', () => {
  const mensaje = validarCampo('telefono', CAMPOS.telefono.value, {}, null, REGLAS_REGISTRO);
  if (mensaje) presentadorDOM.mostrar(CAMPOS.telefono, mensaje);
});

CAMPOS.password.addEventListener('input', () => {
  renderChecklistPassword(CAMPOS.password.value);
  presentadorDOM.limpiar(CAMPOS.password);
});

CAMPOS.confirmar_password.addEventListener('input', () => {
  presentadorDOM.limpiar(CAMPOS.confirmar_password);
});

/* Estado inicial del checklist: todos los requisitos pendientes */
renderChecklistPassword('');

/* -----------------------------------------------------------------------------
   Submit
   ----------------------------------------------------------------------------- */
form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const datos = {
    nombre: CAMPOS.nombre.value.trim(),
    telefono: sanearTelefono(CAMPOS.telefono.value),
    email: CAMPOS.email.value.trim(),
    password: CAMPOS.password.value,
    confirmar_password: CAMPOS.confirmar_password.value
  };

  // Limpia errores anteriores de todos los campos gestionados
  [...Object.values(CAMPOS), checkboxConsentimiento].forEach(presentadorDOM.limpiar);

  const resultado = validarFormulario(datos, REGLAS_REGISTRO, { password: datos.password });

  if (!resultado.ok) {
    Object.entries(resultado.errores).forEach(([campo, mensaje]) => {
      presentadorDOM.mostrar(CAMPOS[campo], mensaje);
    });
    if (CAMPOS[resultado.primero]) CAMPOS[resultado.primero].focus();
    return;
  }

  // Ley 29733 (RNF03 / CA-RNF03-4): sin consentimiento el registro NO procede
  if (!checkboxConsentimiento.checked) {
    presentadorDOM.mostrar(
      checkboxConsentimiento,
      'Debes aceptar el tratamiento de tus datos personales para continuar.'
    );
    checkboxConsentimiento.focus();
    return;
  }

  btn.disabled = true;
  const res = await registrarCliente(datos.nombre, datos.email, datos.password, datos.telefono);
  btn.disabled = false;

  if (!res.ok) {
    // Email duplicado → "El correo ya está registrado" (CA-RF03-7)
    const mensaje = res.error || 'No se pudo completar el registro.';
    presentadorDOM.mostrar(CAMPOS.email, mensaje);
    mostrarToast(mensaje, 'error');
    return;
  }

  if (res.necesitaConfirmacion) {
    // Verificación de email activada en Supabase
    mostrarToast('Revisa tu correo para confirmar tu cuenta.', 'info', 6000);
    form.reset();
    renderChecklistPassword('');
    if (togglePassword) togglePassword.aplicar(false);
    if (toggleConfirmar) toggleConfirmar.aplicar(false);
  } else {
    mostrarToast('Cuenta creada. ¡Bienvenido a Barbería Kraft!', 'exito');
    setTimeout(() => redirigirPorRol('cliente'), 1200);
  }
});
