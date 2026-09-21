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

iniciarNavbar();

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