/* =============================================================================
   Barbería Kraft — pagina-admin.js (T24)
   Shell del panel de administración (S-RF03-6 / design §8.3.8):
   - GUARD: sin sesión → login.html · cliente → ../index.html · admin → sigue
   - <main> permanece hidden hasta que el guard confirma rol admin (CA-RF03-5)
   - Tabs: Servicios | Promociones | Ocupación (carga perezosa por módulo
     admin-servicios.js / admin-promociones.js / admin-ocupacion.js)
   - Clientes | Historial → deshabilitados, badge "Hito 2" (CA-RF08-5)
   - Navegación por teclado de tabs: flechas ←/→, Home/End (RNF08)
   ============================================================================= */

import { guardAdmin, cerrarSesion, obtenerRol } from './auth.js';
import { $, $$, estadoCarga } from './ui.js';
import { esConfigPlaceholder } from './config.js';
import { configurarNavbarAdmin } from './admin-ui.js';

/* -----------------------------------------------------------------------------
   Registro de módulos por tab. Cada módulo exporta iniciar(contenedor).
   Los dynamic import() mantienen el bundle del panel pequeño y cargan solo
   el CRUD que el admin abre (CA-RNF05: rendimiento).
   ----------------------------------------------------------------------------- */
const MODULOS = {
  servicios: () => import('./admin-servicios.js'),
  promociones: () => import('./admin-promociones.js'),
  ocupacion: () => import('./admin-ocupacion.js')
};

/** Tabs navegables por teclado (los placeholders Hito 2 quedan fuera) */
const TABS_ACTIVOS = ['servicios', 'promociones', 'ocupacion'];
const panelesCargados = new Set();

const $tab = (nombre) => $(`#tab-${nombre}`);
const $panel = (nombre) => $(`#panel-${nombre}`);

/* -----------------------------------------------------------------------------
   Activación de un tab (ARIA tabs + lazy load del módulo)
   ----------------------------------------------------------------------------- */
async function activarTab(nombre) {
  if (!TABS_ACTIVOS.includes(nombre) || $tab(nombre).disabled) return;

  // Estado ARIA en los botones
  $$('.admin-tabs__tab').forEach((boton) => {
    const esActivo = boton.dataset.tab === nombre;
    boton.setAttribute('aria-selected', String(esActivo));
    boton.tabIndex = esActivo ? 0 : -1;
  });

  // Visibilidad de paneles
  TABS_ACTIVOS.forEach((nombreTab) => {
    $panel(nombreTab).hidden = nombreTab !== nombre;
  });

  // Carga perezosa la primera vez que se abre el tab
  if (!panelesCargados.has(nombre)) {
    const panel = $panel(nombre);
    estadoCarga(panel, 'Cargando…');
    try {
      const modulo = await MODULOS[nombre]();
      await modulo.iniciar(panel);
      panelesCargados.add(nombre);
    } catch (error) {
      console.error(`pagina-admin.js — fallo al iniciar tab ${nombre}:`, error);
      panel.innerHTML = '';
      const estado = document.createElement('div');
      estado.className = 'estado';
      estado.innerHTML = `
        <svg class="icono estado__icono" role="img" aria-label="Error">
          <use href="../assets/sprite.svg#icon-alerta"></use>
        </svg>
        <p class="estado__mensaje">No se pudo cargar esta sección. Recarga la página e intenta de nuevo.</p>
      `;
      panel.appendChild(estado);
    }
  }
}

/* -----------------------------------------------------------------------------
   Navegación por teclado de tabs (patrón ARIA tabs):
   ←/→ mueven entre tabs activos, Home/End van al primero/último.
   ----------------------------------------------------------------------------- */
function configurarTecladoTabs() {
  const barra = $('.admin-tabs');
  if (!barra) return;

  barra.addEventListener('keydown', (evento) => {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight' &&
        evento.key !== 'Home' && evento.key !== 'End') return;

    const actual = TABS_ACTIVOS.indexOf($('.admin-tabs__tab[aria-selected="true"]')?.dataset?.tab);
    let siguiente = actual;

    if (evento.key === 'ArrowRight') siguiente = (actual + 1) % TABS_ACTIVOS.length;
    else if (evento.key === 'ArrowLeft') siguiente = (actual - 1 + TABS_ACTIVOS.length) % TABS_ACTIVOS.length;
    else if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = TABS_ACTIVOS.length - 1;

    evento.preventDefault();
    activarTab(TABS_ACTIVOS[siguiente]);
    $tab(TABS_ACTIVOS[siguiente]).focus();
  });
}

/* -----------------------------------------------------------------------------
   Arranque del panel
   ----------------------------------------------------------------------------- */
async function iniciar() {
  // 1) GUARD de acceso (S-RF03-6): si no es admin, guardAdmin() ya redirigió.
  const resultado = await guardAdmin();
  if (resultado !== 'admin') return;

  // 2) Recién aquí se revela el shell (CA-RF03-5: nada visible sin rol)
  const main = $('#principal');
  if (main) main.hidden = false;

  // 3) Navbar y cierre de sesión
  configurarNavbarAdmin();
  const botonSalir = $('#btn-cerrar-sesion');
  if (botonSalir) {
    botonSalir.addEventListener('click', () => {
      cerrarSesion();
    });
  }

  // 4) Aviso de configuración pendiente (js/config.js sin reemplazar)
  const aviso = $('#aviso-config');
  if (aviso && esConfigPlaceholder()) {
    aviso.hidden = false;
  }

  // 5) Badge de rol (transparencia del guard — útil para auditar acceso)
  try {
    const rol = await obtenerRol();
    const etiqueta = $('#usuario-rol');
    if (etiqueta) etiqueta.textContent = `Rol verificado: ${rol}`;
  } catch {
    // no bloqueante — el guard ya validó
  }

  // 6) Clicks en tabs (delegación) + teclado
  $('.admin-tabs').addEventListener('click', (evento) => {
    const boton = evento.target.closest('.admin-tabs__tab');
    if (boton && !boton.disabled && boton.dataset.tab) {
      activarTab(boton.dataset.tab);
    }
  });
  configurarTecladoTabs();

  // 7) Default: tab Servicios
  activarTab('servicios');
}

iniciar();