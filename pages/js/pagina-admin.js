/* =============================================================================
   Barbería Kraft — pagina-admin.js (T24)
   Shell del panel de administración (S-RF03-6 / design §8.3.8):
   - GUARD: sin sesión → login.html · cliente → ../index.html · admin → sigue
   - <main> permanece hidden hasta que el guard confirma rol admin (CA-RF03-5)
   - Tabs: Servicios | Promociones | Ocupación | Clientes | Historial (carga
     perezosa por módulo admin-servicios.js / admin-promociones.js /
     admin-ocupacion.js / admin-clientes.js / admin-historial.js)
   - Navegación por teclado de tabs: flechas ←/→, Home/End (RNF08)
   ============================================================================= */

import { guardAdmin, cerrarSesion, obtenerRol, observarSesion } from './auth.js';
import { $, $$, estadoCarga } from './ui.js';
import { esConfigPlaceholder } from './config.js';
import { cargarServiciosActivos, cargarPromocionesActivas } from './api.js';
import { fetchOcupacion } from './ocupacion.js';
import { montarBadgeSesion } from './sesion-ui.js';
import { getSupabase } from './supabase-client.js';
import { estadoUiSesion, nombreAMostrar } from './logica/sesion-logica.js';

/* -----------------------------------------------------------------------------
   Registro de módulos por tab. Cada módulo exporta iniciar(contenedor).
   Los dynamic import() mantienen el bundle del panel pequeño y cargan solo
   el CRUD que el admin abre (CA-RNF05: rendimiento).
   ----------------------------------------------------------------------------- */
const MODULOS = {
  servicios: () => import('./admin-servicios.js'),
  promociones: () => import('./admin-promociones.js'),
  ocupacion: () => import('./admin-ocupacion.js'),
  clientes: () => import('./admin-clientes.js'),
  historial: () => import('./admin-historial.js'),
  reservas: () => import('./admin-reservas.js')
};

/** Orden de tabs navegables por teclado (←/→/↑/↓, Home/End) */
const TABS_ACTIVOS = ['servicios', 'promociones', 'ocupacion', 'clientes', 'historial', 'reservas'];
const panelesCargados = new Set();

/** Título que refleja la sección activa en la topbar */
const TITULOS_SECCION = {
  servicios: 'Servicios',
  promociones: 'Promociones',
  ocupacion: 'Ocupación del local',
  clientes: 'Clientes',
  historial: 'Historial',
  reservas: 'Reservas'
};

/** Cierre del sidebar móvil (se reasigna en configurarSidebar) */
let cerrarSidebar = () => {};

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
    if (esActivo) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
    boton.tabIndex = esActivo ? 0 : -1;
  });

  // Visibilidad de paneles
  TABS_ACTIVOS.forEach((nombreTab) => {
    $panel(nombreTab).hidden = nombreTab !== nombre;
  });

  // Título de sección en la topbar + cierre del menú móvil al elegir sección
  const titulo = $('#admin-topbar-titulo');
  if (titulo) titulo.textContent = TITULOS_SECCION[nombre] || 'Panel';
  cerrarSidebar();

  // Carga perezosa la primera vez que se abre el tab
  if (!panelesCargados.has(nombre)) {
    const panel = $panel(nombre);
    // Reservas trae su marcado estático en dashboard.html: no se debe borrar
    // con el estado de carga; el módulo gestiona su propio estado interno.
    if (nombre !== 'reservas') estadoCarga(panel, 'Cargando…');
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
  } else {
    // Tab ya montado: avisa al módulo para refrescar datos al volver a entrar.
    $panel(nombre).dispatchEvent(new CustomEvent('admin:tab-activado'));
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
        evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown' &&
        evento.key !== 'Home' && evento.key !== 'End') return;

    const actual = TABS_ACTIVOS.indexOf($('.admin-tabs__tab[aria-selected="true"]')?.dataset?.tab);
    let siguiente = actual;

    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') siguiente = (actual + 1) % TABS_ACTIVOS.length;
    else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') siguiente = (actual - 1 + TABS_ACTIVOS.length) % TABS_ACTIVOS.length;
    else if (evento.key === 'Home') siguiente = 0;
    else if (evento.key === 'End') siguiente = TABS_ACTIVOS.length - 1;

    evento.preventDefault();
    activarTab(TABS_ACTIVOS[siguiente]);
    $tab(TABS_ACTIVOS[siguiente]).focus();
  });
}

/* -----------------------------------------------------------------------------
   Sidebar adaptable (móvil/tablet): hamburguesa accesible + overlay.
   En escritorio (≥901px) CSS mantiene el sidebar fijo y oculta el toggle.
   ----------------------------------------------------------------------------- */
function configurarSidebar() {
  const sidebar = $('#admin-sidebar');
  const toggle = $('#btn-sidebar-toggle');
  const overlay = $('#admin-overlay');
  const cerrarBtn = $('#btn-cerrar-sidebar');
  if (!sidebar || !toggle) return;

  const abrir = () => {
    sidebar.classList.add('abierto');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Cerrar menú del panel');
    if (overlay) overlay.classList.add('admin-overlay--visible');
    document.body.classList.add('admin-menu-abierto');
  };

  const cerrar = ({ devolverFoco = false } = {}) => {
    sidebar.classList.remove('abierto');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú del panel');
    if (overlay) overlay.classList.remove('admin-overlay--visible');
    document.body.classList.remove('admin-menu-abierto');
    if (devolverFoco) toggle.focus();
  };

  cerrarSidebar = () => cerrar();

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('abierto')) cerrar({ devolverFoco: true });
    else abrir();
  });

  if (cerrarBtn) {
    cerrarBtn.addEventListener('click', () => cerrar({ devolverFoco: true }));
  }

  if (overlay) {
    overlay.addEventListener('click', () => cerrar({ devolverFoco: true }));
  }

  // Escape cierra el menú (navegación por teclado — RNF08)
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && sidebar.classList.contains('abierto')) {
      cerrar({ devolverFoco: true });
    }
  });

  // Al volver a escritorio se limpia el estado móvil (sin bloquear el scroll)
  try {
    const mq = window.matchMedia('(min-width: 901px)');
    const alCambiar = (evento) => { if (evento.matches) cerrar(); };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', alCambiar);
    else if (typeof mq.addListener === 'function') mq.addListener(alCambiar);
  } catch {
    // matchMedia no disponible: no bloqueante
  }
}

/* -----------------------------------------------------------------------------
   Nombre del usuario en el pie del sidebar (minimización: nombreAMostrar).
   ----------------------------------------------------------------------------- */
function configurarUsuarioSidebar() {
  const nombre = $('#usuario-nombre');
  if (!nombre) return;

  const aplicar = (sesion) => {
    const texto = nombreAMostrar(sesion);
    if (texto) nombre.textContent = texto;
  };

  observarSesion((_evento, sesion) => aplicar(sesion));
  try {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => aplicar(data?.session))
      .catch(() => {});
  } catch {
    // SDK no disponible: se conserva el texto por defecto
  }
}

/* -----------------------------------------------------------------------------
   KPIs superiores (best-effort): si no hay datos o configuración, quedan «—».
   ----------------------------------------------------------------------------- */
function cargarKpis() {
  const ocupacion = $('#kpi-ocupacion');
  const ocupacionMeta = $('#kpi-ocupacion-meta');
  const servicios = $('#kpi-servicios');
  const promociones = $('#kpi-promociones');

  if (esConfigPlaceholder()) {
    if (ocupacionMeta) ocupacionMeta.textContent = 'Configuración pendiente';
    return;
  }

  fetchOcupacion()
    .then((datos) => {
      if (ocupacion) ocupacion.textContent = `${Number(datos.porcentaje) || 0}%`;
      if (ocupacionMeta) {
        ocupacionMeta.textContent = `${Number(datos.sillas_ocupadas) || 0} de ${Number(datos.sillas_totales) || 0} sillas ocupadas`;
      }
    })
    .catch(() => {
      if (ocupacionMeta) ocupacionMeta.textContent = 'Sin datos ahora';
    });

  cargarServiciosActivos()
    .then(({ ok, data }) => {
      if (ok && servicios) servicios.textContent = String(data.length);
      else if (servicios) servicios.textContent = '—';
    })
    .catch(() => { if (servicios) servicios.textContent = '—'; });

  cargarPromocionesActivas()
    .then(({ ok, data }) => {
      if (ok && promociones) promociones.textContent = String(data.length);
      else if (promociones) promociones.textContent = '—';
    })
    .catch(() => { if (promociones) promociones.textContent = '—'; });
}

/* -----------------------------------------------------------------------------
   Arranque del panel
   ----------------------------------------------------------------------------- */
async function iniciar() {
  // 1) GUARD de acceso (S-RF03-6): si no es admin, guardAdmin() ya redirigió.
  const resultado = await guardAdmin();
  if (resultado !== 'admin') return;

  // 2) Recién aquí se revela el shell (CA-RF03-5: nada visible sin rol)
  const shell = $('#admin-shell');
  if (shell) shell.hidden = false;
  const main = $('#principal');
  if (main) main.hidden = false;

  // 3) Sidebar (toggle móvil + overlay) y cierre de sesión (estadoUiSesion)
  configurarSidebar();
  const botonSalir = $('#btn-cerrar-sesion');
  if (botonSalir) {
    botonSalir.hidden = false; // aquí el guard ya confirmó sesión admin
    botonSalir.addEventListener('click', () => {
      cerrarSesion();
    });
    // Sincronización puntual (por si INITIAL_SESSION no llega): mantiene el
    // botón acorde al estado real; sin sesión quedaría oculto (fail-safe).
    try {
      getSupabase()
        .auth.getSession()
        .then(({ data }) => {
          botonSalir.hidden = !estadoUiSesion(data?.session).mostrarCerrarSesion;
        })
        .catch(() => { botonSalir.hidden = true; });
    } catch {
      botonSalir.hidden = true;
    }
  }

  // 3-bis) Badge "Sesión: {nombre}" (HU04 · usabilidad): esquina inferior
  // derecha, actualización en vivo vía observarSesion(). rutaSprite '../assets'
  // porque el documento vive en /admin/ (mismo criterio que admin-ui.js).
  montarBadgeSesion({ rutaSprite: '../assets/sprite.svg' });
  configurarUsuarioSidebar();

  // 4) Aviso de configuración pendiente (js/config.js sin reemplazar)
  const aviso = $('#aviso-config');
  if (aviso && esConfigPlaceholder()) {
    aviso.hidden = false;
  }
  cargarKpis();

  // 5) Badge de rol (transparencia del guard — útil para auditar acceso)
  try {
    const rol = await obtenerRol();
    const etiqueta = $('#usuario-rol');
    if (etiqueta) etiqueta.textContent = `Rol verificado: ${rol}`;
  } catch {
    // no bloqueante — el guard ya validó
  }

  // 6) Clicks en tabs (delegación) + teclado
  const tablist = $('.admin-tabs');
  if (tablist) {
    tablist.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.admin-tabs__tab');
      if (boton && !boton.disabled && boton.dataset.tab) {
        activarTab(boton.dataset.tab);
      }
    });
  }
  configurarTecladoTabs();

  // 7) Default: tab Servicios
  activarTab('servicios');
}

iniciar();