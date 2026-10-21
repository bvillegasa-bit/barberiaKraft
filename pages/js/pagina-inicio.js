/* =============================================================================
   Barbería Kraft — pagina-inicio.js (T21)
   Punto de entrada de index.html: navbar, hero, ocupación (RF02), catálogo de
   servicios (RF01) y promociones (RF05). Render PROGRESIVO e independiente por
   sección (RNF07 / CA-RNF07-2): el fallo de una sección no bloquea las demás.
   ============================================================================= */

import {
  iniciarNavbar,
  estadoCarga,
  estadoError,
  estadoVacio,
  cardServicio,
  cardPromo,
  $
} from './ui.js';
import { cargarServiciosActivos, cargarPromocionesActivas, mensajeErrorSeccion } from './api.js';
import { cargarOcupacion } from './ocupacion.js';
import { esConfigPlaceholder } from './config.js';
import { cerrarSesion, observarSesion } from './auth.js';
import { getSupabase } from './supabase-client.js';
import { montarBadgeSesion } from './sesion-ui.js';
import { estadoUiSesion } from './logica/sesion-logica.js';

iniciarNavbar();

/* -----------------------------------------------------------------------------
   Botón "Cerrar sesión" (CA-RF03-3): oculto sin sesión, visible con sesión.
   Contrato único estadoUiSesion() (logica/sesion-logica.js, testeado CP-15..18):
   decide visibilidad de botón y texto de badge a partir de la sesión.

   Doble fuente de sincronización (a prueba de fallos):
     1) observarSesion() → INITIAL_SESSION / SIGNED_IN / SIGNED_OUT en vivo.
     2) getSession() puntual al montar → cubre el caso en que INITIAL_SESSION
        no llegue (p. ej. SDK/cliente aún no listo), sin mostrar un control
        inútil. El botón nace `hidden` en el HTML: si todo falla, permanece
        oculto (fail-safe).
   ----------------------------------------------------------------------------- */
function aplicarEstadoBotonSesion(botonSalir, sesion) {
  const { mostrarCerrarSesion } = estadoUiSesion(sesion);
  botonSalir.hidden = !mostrarCerrarSesion; // atributo `hidden`, no estilos inline
}

function configurarCierreDeSesion() {
  const botonSalir = $('#btn-cerrar-sesion');
  if (!botonSalir) return;
  observarSesion((_evento, sesion) => aplicarEstadoBotonSesion(botonSalir, sesion));
  botonSalir.addEventListener('click', () => cerrarSesion());

  // Comprobación puntual: aunque no llegue INITIAL_SESSION, sincronizamos una vez.
  try {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => aplicarEstadoBotonSesion(botonSalir, data?.session))
      .catch(() => aplicarEstadoBotonSesion(botonSalir, null));
  } catch {
    // SDK no disponible: el botón ya nace `hidden` (fail-safe, sin sesión).
    aplicarEstadoBotonSesion(botonSalir, null);
  }
}

configurarCierreDeSesion();

/* Badge "Sesión: {nombre}" (HU04 · usabilidad): esquina inferior derecha,
   se muestra/oculta en vivo con observarSesion() y convive con el botón
   de cerrar sesión del navbar (esquina superior). */
montarBadgeSesion();

// Año del footer
const anioFooter = $('#anio');
if (anioFooter) anioFooter.textContent = String(new Date().getFullYear());

const contOcupacion = $('#contenedor-ocupacion');
const contServicios = $('#contenedor-servicios');
const contPromos = $('#contenedor-promociones');

const MSG_CONFIG =
  'Configuración pendiente: agrega la URL y la anon key de tu proyecto Supabase en js/config.js';

function cargarSeccionOcupacion() {
  estadoCarga(contOcupacion, 'Consultando ocupación…');
  cargarOcupacion(contOcupacion).then((datos) => {
    if (!datos) {
      estadoError(contOcupacion, mensajeErrorSeccion({}), cargarSeccionOcupacion);
    }
  });
}

function cargarSeccionServicios() {
  estadoCarga(contServicios, 'Cargando servicios…');
  cargarServiciosActivos().then(({ ok, data, error }) => {
    if (!ok) {
      estadoError(contServicios, mensajeErrorSeccion(error), cargarSeccionServicios);
      return;
    }
    if (data.length === 0) {
      estadoVacio(contServicios, 'No hay servicios disponibles');
      return;
    }
    contServicios.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid-tarjetas grid-tarjetas--2 grid-tarjetas--3';
    data.forEach((servicio) => grid.appendChild(cardServicio(servicio)));
    contServicios.appendChild(grid);
  });
}

function cargarSeccionPromos() {
  estadoCarga(contPromos, 'Cargando promociones…');
  cargarPromocionesActivas().then(({ ok, data, error }) => {
    if (!ok) {
      estadoError(contPromos, mensajeErrorSeccion(error), cargarSeccionPromos);
      return;
    }
    if (data.length === 0) {
      estadoVacio(contPromos, 'No hay promociones activas', 'icon-estrella');
      return;
    }
    contPromos.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid-tarjetas grid-tarjetas--2 grid-tarjetas--3';
    data.forEach((promo) => grid.appendChild(cardPromo(promo)));
    contPromos.appendChild(grid);
  });
}

// Arranque: layout ya visible; datos llegan de forma asíncrona (CA-RNF01-3).
if (esConfigPlaceholder()) {
  estadoVacio(contOcupacion, MSG_CONFIG);
  estadoVacio(contServicios, MSG_CONFIG);
  estadoVacio(contPromos, MSG_CONFIG);
} else {
  cargarSeccionOcupacion();
  cargarSeccionServicios();
  cargarSeccionPromos();
}