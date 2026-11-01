/* =============================================================================
   Barbería Kraft — admin-ui.js (T24, helper del panel admin)
   Variantes ADMIN de los estados de ui.js con rutas CORREGIDAS al sprite:
   desde pages/admin/dashboard.html el sprite vive en ../assets/sprite.svg.

   ⚠️ DESVIACIÓN documentada (T24): los helpers estadoError/estadoVacio de
   ui.js embeben "assets/sprite.svg#…" que se resuelve relativo al DOCUMENTO;
   desde /admin/… apuntarían a /admin/assets/sprite.svg (404). Por eso este
   módulo existe con rutas ../assets. renderSemaforo y estadoCarga de ui.js NO
   usan sprite y son seguros de reutilizar tal cual.
   ============================================================================= */

/** Margen de icono reutilizable para plantillas del panel (ruta ../assets). */
export function svgUse(nombre) {
  return `<svg class="icono" role="img" aria-hidden="true" focusable="false">
      <use href="../assets/sprite.svg#${nombre}"></use>
    </svg>`;
}

/* -----------------------------------------------------------------------------
   Estado de ERROR con reintento (variante admin — ruta ../assets)
   ----------------------------------------------------------------------------- */
export function estadoErrorAdmin(contenedor, mensaje = 'No se pudo conectar. Reintenta', alReintentar) {
  contenedor.innerHTML = '';
  const estado = document.createElement('div');
  estado.className = 'estado';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'icono estado__icono');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Error');
  const uso = document.createElementNS(svgNS, 'use');
  uso.setAttribute('href', '../assets/sprite.svg#icon-alerta');
  svg.appendChild(uso);

  const texto = document.createElement('p');
  texto.className = 'estado__mensaje';
  texto.textContent = String(mensaje ?? '');

  estado.append(svg, texto);
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn btn--secundario btn--sm';
  boton.textContent = 'Reintenta';
  if (typeof alReintentar === 'function') {
    boton.addEventListener('click', alReintentar);
  }
  estado.appendChild(boton);
  contenedor.appendChild(estado);
}

/* -----------------------------------------------------------------------------
   Estado de VACÍO (variante admin — ruta ../assets)
   ----------------------------------------------------------------------------- */
export function estadoVacioAdmin(contenedor, mensaje, icono = 'icon-alerta') {
  contenedor.innerHTML = '';
  const estado = document.createElement('div');
  estado.className = 'estado';

  const texto = String(mensaje ?? '');
  const iconoValido = String(icono ?? '').replace(/[^a-z0-9-]/gi, '') || 'icon-alerta';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'icono estado__icono');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', texto || 'Estado');
  const uso = document.createElementNS(svgNS, 'use');
  uso.setAttribute('href', `../assets/sprite.svg#${iconoValido}`);
  svg.appendChild(uso);

  const parrafo = document.createElement('p');
  parrafo.className = 'estado__mensaje';
  parrafo.textContent = texto;

  estado.append(svg, parrafo);
  contenedor.appendChild(estado);
}

/* -----------------------------------------------------------------------------
   Navbar hamburguesa del panel (variante admin).
   Espejo de iniciarNavbar() (ui.js) pero con rutas ../assets/sprite.svg,
   porque iniciarNavbar() embebe "assets/sprite.svg#icon-menu" (incorrecto
   desde /admin/). Misma accesibilidad: aria-expanded, Escape, clic fuera.
   ----------------------------------------------------------------------------- */
export function configurarNavbarAdmin() {
  const boton = document.querySelector('.navbar__hamburguesa');
  const menu = document.querySelector('.navbar__menu');
  if (!boton || !menu) return;

  const aplicarIcono = (abierto) => {
    const uso = boton.querySelector('use');
    if (uso) uso.setAttribute('href', abierto ? '../assets/sprite.svg#icon-x' : '../assets/sprite.svg#icon-menu');
  };

  const cerrar = () => {
    menu.classList.remove('abierto');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Abrir menú');
    aplicarIcono(false);
  };

  boton.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', String(abierto));
    boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    aplicarIcono(abierto);
  });

  // Cierre con Escape (navegación por teclado — RNF08)
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && menu.classList.contains('abierto')) {
      cerrar();
      boton.focus();
    }
  });

  // Cierre con clic fuera
  document.addEventListener('click', (evento) => {
    if (menu.classList.contains('abierto') && !menu.contains(evento.target) && !boton.contains(evento.target)) {
      cerrar();
    }
  });

  // Cierre al pulsar un enlace (móvil)
  menu.querySelectorAll('a').forEach((enlace) => {
    enlace.addEventListener('click', cerrar);
  });
}