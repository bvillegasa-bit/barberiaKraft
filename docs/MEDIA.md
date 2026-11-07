# Media de la landing — Barbería Kraft

Inventario, estructura, rendimiento, accesibilidad y aspectos legales de las
imágenes y videos de `pages/index.html`. Todos los assets se publican desde
`pages/assets/` (el build los copia a `dist/assets/`).

---

## 1. Inventario

### Imágenes (12)

| Archivo | Dimensiones | Peso aprox. | Uso |
|---|---|---|---|
| `img/logo.jpg` | 1408×768 | — | Logo en navbar y footer |
| `img/catalogo.jpeg` | 1024×1536 | — | Sección catálogo (`#catalogo`) |
| `img/corte-01.jpeg` | 720×1280 | — | Galería + `poster` del hero |
| `img/corte-02.jpeg` | 720×1280 | — | Galería + `poster` video `modelo-01` |
| `img/corte-03.jpeg` | 720×1280 | — | Galería |
| `img/corte-04.jpeg` | 720×1280 | — | Galería |
| `img/corte-05.jpeg` | 720×1280 | — | Galería + `poster` video `modelo-02` |
| `img/corte-06.jpeg` | 720×1280 | — | Galería |
| `img/corte-07.jpeg` | 720×1280 | — | Galería |
| `img/corte-08.jpeg` | 720×1280 | — | Galería + `poster` video `modelo-03` |
| `img/corte-09.jpeg` | 720×1280 | — | Galería |
| `img/corte-10.jpeg` | 720×1280 | — | Galería |

### Videos (4)

| Archivo | Duración | Peso aprox. | Uso |
|---|---|---|---|
| `video/principal.mp4` | 10 s | 2.1 MB | Fondo del hero (`hero__media`) |
| `video/modelo-01.mp4` | 15 s | 0.6 MB | Tarjeta de video 1 |
| `video/modelo-02.mp4` | 10 s | 2.0 MB | Tarjeta de video 2 |
| `video/modelo-03.mp4` | 20 s | 4.2 MB | Tarjeta de video 3 |

---

## 2. Secciones de la landing

### Hero con video — `.hero__media`

- `<video class="hero__video" src="/assets/video/principal.mp4">` con
  `poster="/assets/img/corte-01.jpeg"`, `autoplay muted loop playsinline`,
  `preload="metadata"`, `aria-hidden="true"` y `tabindex="-1"` (decorativo,
  sin controles).
- Contenedor con `aspect-ratio: 4 / 5` y `max-height: 560px`; el video usa
  `object-fit: cover`.

### `#galeria` — Nuestro trabajo

- Grid responsive de 10 cortes: **2 columnas** en móvil, **3** desde 768 px,
  **5** desde 1024 px.
- Cada celda es un `<button>` que abre el `<dialog id="lightbox">`; el grid se
  genera desde `pages/js/logica/galeria-logica.js`.
- Lightbox con navegación circular ←/→, cierre con `Esc` y contador “N de 10”.

### `#catalogo` — Catálogo y precios

- `.catalogo__grid`: una columna hasta 900 px, dos columnas (imagen + texto)
  desde 900 px.
- Imagen `catalogo.jpeg` como `<img>` simple (sin enlace ni `target="_blank"`),
  lista de ventajas y CTA primario “Reservar cita”. El enlace secundario
  “Ver catálogo completo” se retiró por redundante: la imagen ya es legible.

### `#videos` — Clientes satisfechos

- `.videos__grid`: 1 columna hasta 900 px, 3 columnas desde 900 px.
- Tres tarjetas con `<video autoplay muted loop playsinline preload="none">`,
  `disablepictureinpicture`, `aria-hidden="true"`, `width="720"`,
  `height="1280"`, `aspect-ratio: 9 / 16` y `poster` propio. Sin `controls`.
- `pages/js/videos-autoplay.js` (importado por `pagina-inicio.js`) fuerza
  `video.muted = true` y usa `IntersectionObserver` con `threshold: 0.35`:
  reproduce solo cuando la tarjeta está visible y pausa al salir de pantalla.
  `play()` se protege con `catch()` para no romper si el navegador bloquea el
  autoplay. Con `prefers-reduced-motion: reduce` no se reproduce: queda el
  poster visible.

---

## 3. Rendimiento

- Peso total de media ≈ **12 MB** (imágenes + videos).
- **Hero**: `preload="metadata"` + `autoplay muted loop playsinline` + `poster`
  para pintar el primer frame sin bloquear.
- **Videos secundarios**: `preload="none"`; no descargan hasta que el
  `IntersectionObserver` los reproduce al entrar en pantalla. Autoplay
  silencioso y en bucle, sin controles nativos.
- **Galería**: `loading="lazy"` + `decoding="async"` + `width`/`height`
  (720×1280) para evitar CLS; el logo del footer también es lazy.
- **Recomendaciones futuras**:
  - Servir imágenes en **WebP/AVIF** con fallback JPEG.
  - Recomprimir videos con **ffmpeg H.264** (`-crf 23`–`28`, `-movflags +faststart`).
  - Comprimir especialmente **`modelo-03.mp4`** (4.2 MB) y evaluar un poster
    más liviano para el hero.

---

## 4. Accesibilidad

- **Alt descriptivo** en los 10 cortes de la galería (p. ej. “Degradado con
  líneas de diseño”); el lightbox actualiza `alt` y título.
- **Hero decorativo**: `aria-hidden="true"`, `tabindex="-1"`, sin controles.
- **Videos de clientes**: autoplay silencioso (`muted`) y en bucle, sin
  `controls`; el título y la descripción de la tarjeta describen el contenido.
  `disablepictureinpicture` y `aria-hidden="true"` evitan interacción y
  duplicidad con el texto. El usuario **no puede activar el sonido**: es una
  decisión de diseño y de derechos sobre el audio original.
- **`prefers-reduced-motion: reduce`**: el hero oculta el video y muestra
  `corte-01.jpeg` como fondo; los videos de clientes no se reproducen
  automáticamente y queda su poster. Se reducen transiciones.
- **Lightbox**: ←/→ navegan, `Esc` cierra y el foco vuelve al botón de origen.
- **Contador “N de 10”** visible en el pie del lightbox y anunciado con
  `aria-live` cuando cambia la imagen.

---

## 5. Seguridad y legal

- **CSP**: `media-src` queda cubierto por `default-src 'self'` en
  `pages/_headers`; no se permiten orígenes externos de media.
- **Consentimiento de imagen**: si los videos muestran personas identificables,
  se requiere autorización escrita de los clientes antes de publicarlos
  (Ley 29733 de protección de datos personales).
- **Audio desactivado por diseño**: los videos se reproducen siempre en silencio
  y la interfaz no ofrece forma de activar el sonido. Esto responde tanto a la
  experiencia (autoplay no intrusivo) como a los derechos del audio original.
- **Repositorio**: `resources/` (material original sin editar) está ignorado en
  git; solo se versionan los assets optimizados de `pages/assets/`.
- **Publicación**: los assets se sirven desde `pages/assets/` y el build los
  copia a `dist/assets/`.

---

## 6. Cómo añadir contenido

1. Copia el archivo optimizado a `pages/assets/img/` o `pages/assets/video/`
   con nombre en kebab-case (`corte-11.jpeg`, `modelo-04.mp4`).
2. Registra el corte en `pages/js/logica/galeria-logica.js` (o actualiza el
   HTML de `#videos` / `#catalogo` si corresponde).
3. Ejecuta `npm test` para validar la lógica de la galería y los módulos.
4. Verifica con `npm run dev` en `http://localhost:8788` (build + `dist/`).
