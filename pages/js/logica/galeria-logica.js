/* =============================================================================
   Barbería Kraft — galeria-logica.js
   Funciones PURAS de la galería «Nuestro trabajo»: datos de los 10 cortes,
   navegación circular del lightbox y texto del contador. Sin DOM ni efectos.
   ============================================================================= */

const CORTES = [
  { alt: 'Corte degradado con diseño', titulo: 'Degradado con diseño' },
  { alt: 'Fade clásico', titulo: 'Fade clásico' },
  { alt: 'Corte texturizado', titulo: 'Corte texturizado' },
  { alt: 'Barba perfilada', titulo: 'Barba perfilada' },
  { alt: 'Corte con línea', titulo: 'Corte con línea' },
  { alt: 'Taper fade', titulo: 'Taper fade' },
  { alt: 'Corte clásico con barba', titulo: 'Clásico con barba' },
  { alt: 'Diseño geométrico', titulo: 'Diseño geométrico' },
  { alt: 'Corte juvenil', titulo: 'Corte juvenil' },
  { alt: 'Acabado premium', titulo: 'Acabado premium' }
];

/** Devuelve los 10 cortes con rutas públicas y textos descriptivos. */
export function construirGaleria() {
  return CORTES.map((corte, indice) => ({
    src: `/assets/img/corte-${String(indice + 1).padStart(2, '0')}.jpeg`,
    alt: corte.alt,
    titulo: corte.titulo
  }));
}

function totalValido(total) {
  return Number.isInteger(total) && total > 0;
}

function indiceValido(actual, total) {
  return Number.isInteger(actual) && actual >= 0 && actual < total;
}

/**
 * Índice siguiente circular. Entradas inválidas: `total` no positivo → 0;
 * `actual` fuera de rango o no entero → 0 (arranque seguro).
 */
export function siguienteIndice(actual, total) {
  if (!totalValido(total)) return 0;
  if (!indiceValido(actual, total)) return 0;
  return (actual + 1) % total;
}

/**
 * Índice anterior circular. Entradas inválidas: `total` no positivo → 0;
 * `actual` fuera de rango o no entero → última posición (marcha atrás segura).
 */
export function anteriorIndice(actual, total) {
  if (!totalValido(total)) return 0;
  if (!indiceValido(actual, total)) return total - 1;
  return (actual - 1 + total) % total;
}

/** Texto «3 de 10» para el contador. Sin total válido → «0 de 0». */
export function textoContador(actual, total) {
  if (!totalValido(total)) return '0 de 0';
  const indice = indiceValido(actual, total) ? actual : 0;
  return `${indice + 1} de ${total}`;
}
