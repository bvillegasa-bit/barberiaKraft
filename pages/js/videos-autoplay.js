/* =============================================================================
   Barbería Kraft — videos-autoplay.js
   Autoplay silencioso y en bucle para los videos de clientes (#videos).
   - Fuerza video.muted = true por JS (algunos navegadores ignoran el atributo).
   - Reproduce SOLO cuando la tarjeta está visible (IntersectionObserver 0.35).
   - Pausa al salir de pantalla y evita errores de play() bloqueado.
   - Respeta prefers-reduced-motion: reduce (deja visible el poster).
   ============================================================================= */

const UMBRAL_VISIBLE = 0.35;

function reproducir(video) {
  const intento = video.play();
  if (intento && typeof intento.catch === 'function') {
    intento.catch(() => {
      /* Autoplay bloqueado por el navegador: se mantiene el poster. */
    });
  }
}

export function iniciarVideosAutoplay() {
  const videos = document.querySelectorAll('#videos video');
  if (videos.length === 0) return;

  const reducirMovimiento =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  videos.forEach((video) => {
    video.muted = true;
    video.setAttribute('muted', '');

    if (reducirMovimiento) {
      video.removeAttribute('autoplay');
      video.pause();
      return;
    }

    if (typeof IntersectionObserver !== 'function') {
      reproducir(video);
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            reproducir(video);
          } else {
            video.pause();
          }
        });
      },
      { threshold: UMBRAL_VISIBLE }
    );

    observador.observe(video);
  });
}
