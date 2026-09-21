/* =============================================================================
   Barbería Kraft — ui.js (design §7 / T12)
   Helpers DOM compartidos: navbar hamburguesa, toast, estados carga/error/vacío,
   formato soles y tarjetas de render. ES module sin dependencias externas.
   ============================================================================= */

/* -----------------------------------------------------------------------------
   Selectores rápidos
   ----------------------------------------------------------------------------- */
export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));

/* -----------------------------------------------------------------------------
   Formato de precios en soles peruanos (CA-RF01-3): "S/ 30.00"
   ----------------------------------------------------------------------------- */
export function formatoSoles(valor) {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return 'S/ 0.00';
  return 'S/ ' + numero.toFixed(2);
}

/* -----------------------------------------------------------------------------
   Toast (design §8.3.9): mostrarToast(mensaje, tipo) con tipos exito|error|info
   ----------------------------------------------------------------------------- */
export function mostrarToast(mensaje, tipo = 'info', duracionMs = 3500) {
  // Reutiliza un toast existente si lo hay (evita apilar varios)
  let toast = $('#toast-global');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-global';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.className = `toast toast--${tipo} visible`;
  toast.textContent = mensaje;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('visible');
  }, duracionMs);
}

/* -----------------------------------------------------------------------------
   Estados de sección (RNF07): carga, error con reintento, vacío
   ----------------------------------------------------------------------------- */
export function estadoCarga(contenedor, mensaje = 'Cargando…') {
  contenedor.innerHTML = '';
  const estado = document.createElement('div');
  estado.className = 'estado';
  estado.setAttribute('role', 'status');
  estado.innerHTML = `
    <div class="spinner" aria-hidden="true"></div>
    <p class="estado__mensaje">${mensaje}</p>
  `;
  contenedor.appendChild(estado);
}

export function estadoError(contenedor, mensaje = 'No se pudo conectar. Reintenta', alReintentar) {
  contenedor.innerHTML = '';
  const estado = document.createElement('div');
  estado.className = 'estado';
  estado.innerHTML = `
    <svg class="icono estado__icono" role="img" aria-label="Error">
      <use href="assets/sprite.svg#icon-alerta"></use>
    </svg>
    <p class="estado__mensaje">${mensaje}</p>
  `;
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

export function estadoVacio(contenedor, mensaje, icono = 'icon-alerta') {
  contenedor.innerHTML = '';
  const estado = document.createElement('div');
  estado.className = 'estado';
  estado.innerHTML = `
    <svg class="icono estado__icono" role="img" aria-label="${mensaje}">
      <use href="assets/sprite.svg#${icono}"></use>
    </svg>
    <p class="estado__mensaje">${mensaje}</p>
  `;
  contenedor.appendChild(estado);
}

/* -----------------------------------------------------------------------------
   Semáforo de ocupación (design §8.3.3): texto SIEMPRE visible (RNF08)
   Umbrales: <50% verde · 50–79% ámbar · ≥80% rojo
   ----------------------------------------------------------------------------- */
export function renderSemaforo(contenedor, { porcentaje, esperaMin }) {
  const pct = Number(porcentaje) || 0;
  const espera = Number(esperaMin) || 0;

  let clase = 'semaforo--verde';
  if (pct >= 80) clase = 'semaforo--rojo';
  else if (pct >= 50) clase = 'semaforo--ambar';

  const esperaTexto = espera === 0 ? 'Sin espera' : `${espera} min`;

  contenedor.innerHTML = '';
  const semaforo = document.createElement('div');
  semaforo.className = `semaforo ${clase}`;
  semaforo.innerHTML = `
    <span class="semaforo__bolita" aria-hidden="true"></span>
    <span class="semaforo__texto">Ocupación: ${pct}%</span>
    <span class="semaforo__detalle">Espera estimada: ${esperaTexto}</span>
  `;
  contenedor.appendChild(semaforo);
}

/* -----------------------------------------------------------------------------
   Tarjetas de catálogo (RF01/RF05)
   ----------------------------------------------------------------------------- */
export function cardServicio(servicio) {
  const articulo = document.createElement('article');
  articulo.className = 'tarjeta card-servicio';
  articulo.innerHTML = `
    <h3 class="card-servicio__nombre">${escaparHtml(servicio.nombre)}</h3>
    <p class="card-servicio__desc">${escaparHtml(servicio.descripcion || '')}</p>
    <div class="card-servicio__pie">
      <span class="card-servicio__precio">${formatoSoles(servicio.precio_soles)}</span>
      <span class="card-servicio__duracion">
        <svg class="icono" role="img" aria-hidden="true" focusable="false">
          <use href="assets/sprite.svg#icon-reloj"></use>
        </svg>
        ≈ ${Number(servicio.duracion_min) || 30} min
      </span>
    </div>
  `;
  return articulo;
}

export function cardPromo(promo) {
  const articulo = document.createElement('article');
  articulo.className = 'tarjeta card-promo';
  const oferta = promo.precio_oferta_soles
    ? `<span class="card-promo__oferta">${formatoSoles(promo.precio_oferta_soles)}</span>`
    : '';
  articulo.innerHTML = `
    <span class="card-promo__chip">PROMO</span>
    <h3 class="card-promo__titulo">${escaparHtml(promo.titulo)}</h3>
    <p class="card-promo__desc">${escaparHtml(promo.descripcion || '')}</p>
    ${promo.beneficio ? `<p class="card-promo__beneficio">${escaparHtml(promo.beneficio)}</p>` : ''}
    ${oferta}
  `;
  return articulo;
}

/* -----------------------------------------------------------------------------
   Navbar hamburguesa (CA-RNF04-2): colapsa < 768px, aria-expanded/aria-controls,
   cierre con Escape y clic fuera.
   ----------------------------------------------------------------------------- */
export function iniciarNavbar() {
  const boton = $('.navbar__hamburguesa');
  const menu = $('.navbar__menu');
  if (!boton || !menu) return;

  const cerrar = () => {
    menu.classList.remove('abierto');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Abrir menú');
    // Restaura el ícono de menú (x = cerrar)
    const uso = boton.querySelector('use');
    if (uso) uso.setAttribute('href', 'assets/sprite.svg#icon-menu');
  };

  const abrir = () => {
    menu.classList.add('abierto');
    boton.setAttribute('aria-expanded', 'true');
    boton.setAttribute('aria-label', 'Cerrar menú');
    const uso = boton.querySelector('use');
    if (uso) uso.setAttribute('href', 'assets/sprite.svg#icon-x');
  };

  boton.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', String(abierto));
    boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    const uso = boton.querySelector('use');
    if (uso) uso.setAttribute('href', abierto ? 'assets/sprite.svg#icon-x' : 'assets/sprite.svg#icon-menu');
  });

  // Cierre con Escape (RNF08 / navegación por teclado)
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && menu.classList.contains('abierto')) {
      cerrar();
      boton.focus();
    }
  });

  // Cierre con clic fuera (excepto sobre el propio botón)
  document.addEventListener('click', (evento) => {
    if (menu.classList.contains('abierto') && !menu.contains(evento.target) && !boton.contains(evento.target)) {
      cerrar();
    }
  });

  // Cierra al pulsar un enlace del menú (móvil)
  menu.querySelectorAll('a').forEach((enlace) => {
    enlace.addEventListener('click', cerrar);
  });
}

/* -----------------------------------------------------------------------------
   Utilidad de escape HTML (evita inyección en el DOM)
   ----------------------------------------------------------------------------- */
export function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto ?? '');
  return div.innerHTML;
}

/* -----------------------------------------------------------------------------
   Ayuda para errores de formulario junto al campo (CA-RNF04-3)
   ----------------------------------------------------------------------------- */
export function mostrarErrorCampo(input, mensaje) {
  const campo = input.closest('.campo');
  if (!campo) return;
  campo.querySelectorAll('.error').forEach((el) => el.remove());
  const error = document.createElement('p');
  error.className = 'error';
  error.setAttribute('role', 'alert');
  error.textContent = mensaje;
  campo.appendChild(error);
  input.classList.add('invalido');
  input.setAttribute('aria-invalid', 'true');
}

export function limpiarErrorCampo(input) {
  const campo = input.closest('.campo');
  if (!campo) return;
  campo.querySelectorAll('.error').forEach((el) => el.remove());
  input.classList.remove('invalido');
  input.removeAttribute('aria-invalid');
}