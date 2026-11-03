/* =============================================================================
   Barbería Kraft — validacion/registro-reglas.js (T27)
   -----------------------------------------------------------------------------
   SOLID · OCP: los formularios declaran qué reglas usan en un mapa
   `{ campo: [Validador, ...] }`. Para agregar un campo o una regla nueva basta
   con registrarla aquí (o con registrarRegla) SIN modificar el motor
   (validador-formulario.js).

   SOLID · DIP: este módulo solo compone funciones que cumplen el contrato
   Validador; no conoce DOM, ui.js ni Supabase.
   ============================================================================= */

import { validarEmail } from './reglas/email.js';
import { validarTelefono } from './reglas/telefono.js';
import { validarPassword, validarPasswordLogin } from './reglas/password.js';
import { validarConfirmacion } from './reglas/confirmacion.js';
import {
  validarNombre,
  validarTitulo,
  validarDescripcion,
  validarBeneficio
} from './reglas/nombre.js';
import { validarPrecio, validarPrecioOpcional, validarEnteroPositivo } from './reglas/numero.js';

/**
 * Crea un registro de reglas a partir de un mapa simple.
 * Clona los arrays para evitar mutaciones accidentales entre formularios.
 * @param {Object<string, import('./contrato.js').Validador[]>} [iniciales]
 * @returns {Object<string, import('./contrato.js').Validador[]>}
 */
export function crearRegistro(iniciales = {}) {
  const mapa = {};
  for (const [campo, reglas] of Object.entries(iniciales || {})) {
    mapa[campo] = Array.isArray(reglas) ? [...reglas] : [];
  }
  return mapa;
}

/**
 * Agrega una o más reglas a un campo sin tocar el motor de validación.
 * Si el campo no existe, lo crea (extensión OCP).
 * @param {Object<string, import('./contrato.js').Validador[]>} mapa
 * @param {string} campo
 * @param {...import('./contrato.js').Validador} nuevasReglas
 * @returns {Object<string, import('./contrato.js').Validador[]>} El mismo mapa.
 */
export function registrarRegla(mapa, campo, ...nuevasReglas) {
  if (!mapa || typeof campo !== 'string' || campo === '') return mapa;
  const validas = nuevasReglas.filter((regla) => typeof regla === 'function');
  mapa[campo] = [...(mapa[campo] ?? []), ...validas];
  return mapa;
}

/**
 * Devuelve las reglas de un campo (array vacío si no está registrado).
 * @param {Object<string, import('./contrato.js').Validador[]>} mapa
 * @param {string} campo
 * @returns {import('./contrato.js').Validador[]}
 */
export function obtenerReglas(mapa, campo) {
  return (mapa && mapa[campo]) || [];
}

/* -----------------------------------------------------------------------------
   Mapas de reglas por formulario
   ----------------------------------------------------------------------------- */

/** Registro de cliente (RF03 / T27): incluye confirmación y teléfono obligatorio. */
export const REGLAS_REGISTRO = crearRegistro({
  nombre: [validarNombre],
  email: [validarEmail],
  password: [validarPassword],
  confirmar_password: [validarConfirmacion],
  telefono: [validarTelefono]
});

/** Login (RF04 / T27): solo formato de email y contraseña no vacía/≤64. */
export const REGLAS_LOGIN = crearRegistro({
  email: [validarEmail],
  password: [validarPasswordLogin]
});

/** Admin · servicios (RF06 / T27): mismos mensajes + longitud de descripción. */
export const REGLAS_SERVICIO = crearRegistro({
  nombre: [validarNombre],
  precio: [validarPrecio],
  duracion: [validarEnteroPositivo],
  descripcion: [validarDescripcion]
});

/** Admin · promociones (RF07 / T27): oferta opcional + longitudes. */
export const REGLAS_PROMOCION = crearRegistro({
  titulo: [validarTitulo],
  oferta: [validarPrecioOpcional],
  beneficio: [validarBeneficio],
  descripcion: [validarDescripcion]
});
