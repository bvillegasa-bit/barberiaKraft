# Sistema de diseño — Barbería Kraft

Documento de referencia del rediseño **A1: claro, minimalista y editorial**
(inspiración en marketplaces de servicios como Fresha). Cubre la página
pública (`pages/index.html`) y el panel de administración
(`pages/admin/dashboard.html`).

## 1. Principios

1. **Claro antes que decorativo.** Fondo cálido casi blanco, superficies
   blancas y un solo acento dorado. El contenido (servicios, ocupación,
   horarios) es el protagonista.
2. **Jerarquía tipográfica fuerte.** Titulares grandes con Inter; Oswald
   reservado exclusivamente para la marca y la identidad de barbería.
3. **Acción evidente.** Un CTA principal tipo pill (“Reservar”) siempre
   visible en el navbar y repetido al final de cada tarjeta de servicio.
4. **Accesible por defecto.** Foco visible de 3 px, objetivos táctiles de
   al menos 44×44 px, estados que no dependen solo del color y soporte de
   `prefers-reduced-motion`.
5. **Contratos intactos.** El rediseño no cambia ids, `data-*`, módulos ES ni
   la CSP: solo presentación y estructura visual.

## 2. Tokens

Definidos en `pages/css/base.css` dentro de `:root`.

### Color

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-fondo` | `#FAFAF8` | Fondo general |
| `--color-superficie` | `#FFFFFF` | Tarjetas, paneles, sidebar |
| `--color-superficie-2` | `#F4F1EA` | Bloques alternos, formularios |
| `--color-borde` | `#E7E2D8` | Bordes y divisores |
| `--color-borde-fuerte` | `#D6CFC1` | Bordes de controles |
| `--color-tinta` | `#111111` | Texto principal y CTAs |
| `--color-texto-sec` | `#57544D` | Texto secundario |
| `--color-acento` | `#B98A2E` | Detalles, iconos, focos |
| `--color-acento-texto` | `#7A5A16` | Texto sobre fondos dorados suaves |
| `--color-acento-suave` | `#F6EEDC` | Fondos de estado activo |
| `--color-exito` | `#1B7F4B` | Silla libre, éxito |
| `--color-alerta` | `#A96208` | Avisos |
| `--color-ocupado` / `--color-peligro` | `#B42318` | Silla ocupada, acciones destructivas |

Los alias heredados (`--color-negro`, `--color-rojo`, `--color-rojo-texto`,
`--color-plomo`) se conservan mapeados a los tokens nuevos para no romper
componentes existentes.

### Tipografía

- `--font-cuerpo` y `--font-titulos`: **Inter**, con fallback de sistema.
- `--font-marca`: **Oswald**, solo para logotipo/marca.
- Escala: `--texto-xs` a `--texto-2xl`; titulares con `letter-spacing`
  negativo leve y `line-height` compacto.

### Forma y profundidad

- Radios: `--radius-sm` (10–12 px), `--radius` (16 px), `--radius-lg`
  (24 px) y `--radius-pill`.
- Sombras suaves de baja opacidad (`--shadow-xs`, `--shadow-md`,
  `--shadow-lg`); nunca sombras duras.
- Espaciado en múltiplos de 4 px (`--sp-1` … `--sp-9`).
- `--sidebar-w: 260px` para el panel.

## 3. Página pública

### Estructura

1. **Navbar sticky** clara: marca, navegación y acciones. El CTA “Reservar”
   se mantiene visible incluso en móvil; login/registro y “Cerrar sesión”
   siguen alternándose con `hidden`.
2. **Hero a dos columnas**: mensaje + CTA + señal de confianza; a la derecha,
   un panel con la ocupación en vivo (`#contenedor-ocupacion`).
3. **Servicios**: grilla de tarjetas con precio, duración y CTA “Reservar”
   por servicio (lleva a `login.html`, `data-reserva="servicio"`).
4. **Galería** (`#galeria`): grid de 10 cortes generado por `galeria.js` y un
   `<dialog>` de lightbox accesible.
5. **Catálogo** (`#catalogo`): imagen del catálogo de precios como `<img>`
   simple, lista de ventajas y CTA primario de reserva (sin enlace secundario).
6. **Videos** (`#videos`): tres tarjetas con autoplay silencioso y en bucle,
   `poster`, `preload="none"` y sin controles.
7. **Promociones**: bloque alterno con acento dorado suave.
8. **Horarios**: grilla clara con días, horas y festivos.
9. **Barbería**: historia, valores y datos de contacto.
10. **Franja CTA final** y **footer** con dirección, horarios y leyenda.

### Botón “Volver al panel”

- Elemento `#volver-panel`, `hidden` por defecto.
- `pagina-inicio.js` consulta `obtenerRol()` y solo lo muestra a administradores
  con sesión vigente.
- Posición fija arriba a la derecha, debajo del navbar; en pantallas pequeñas
  se compacta para no tapar el CTA de reserva.

## 4. Panel de administración

### Layout

- **Escritorio (≥1024 px):** sidebar fijo de 260 px a la izquierda; contenido
  con topbar sticky, KPIs y panel de la sección activa.
- **Móvil/tablet (<1024 px):** sidebar off-canvas (`transform: translateX`),
  overlay oscuro y botón hamburguesa en la topbar. Se cierra con el botón X,
  al tocar el overlay, con `Escape` o al elegir una sección. Mientras está
  abierto se bloquea el scroll (`body.admin-menu-abierto`).

### Sidebar

1. Marca y enlace al sitio público.
2. Navegación vertical con los mismos `id`/`data-tab`/ARIA de las tabs
   originales (`#tab-servicios` … `#tab-historial`).
3. Enlace “Ver sitio público” (`target="_blank"`).
4. Pie con avatar, nombre (`#usuario-nombre`), rol (`#usuario-rol`) y
   “Cerrar sesión” (`#btn-cerrar-sesion`).

### Contenido

- **Topbar:** toggle móvil, título de sección (`#admin-topbar-titulo`) y
  acceso directo al sitio.
- **KPIs:** ocupación actual, servicios activos y promociones activas.
  Son *best-effort*: si faltan datos o la configuración, muestran `—`.
- **Paneles:** tarjetas blancas con las tablas CRUD, formularios y vistas
  previas existentes. Las clases `.tabla-crud`, `.panel-form`, `.vista-previa`,
  `.card-silla`, `.badge-estado`, `.btn-icono`, `.ocupar-mini` y `.inactivo`
  se mantienen y se reestilizan en `admin.css`.

## 5. Componentes de media

### Hero con video

- `<video class="hero__video">` decorativo: `src="/assets/video/principal.mp4"`,
  `poster="/assets/img/corte-01.jpeg"`, `autoplay muted loop playsinline`,
  `preload="metadata"`, `aria-hidden="true"` y `tabindex="-1"` (sin controles).
- `.hero__media` fija `aspect-ratio: 4 / 5` y `max-height: 560px`; el video usa
  `object-fit: cover`, así el encuadre se recorta sin deformarse.
- Con `prefers-reduced-motion: reduce` el video se oculta y `.hero__media`
  muestra `corte-01.jpeg` como fondo.

### Galería y lightbox

- Grid responsive: 2 columnas en móvil, 3 desde `768 px` y 5 desde `1024 px`.
- Cada celda es un `<button>` con `aspect-ratio: 9 / 16`; la imagen lleva
  `loading="lazy"`, `decoding="async"` y `width`/`height` (720×1280) para evitar CLS.
- Lightbox: `<dialog id="lightbox">` con botones anterior/siguiente/cerrar;
  navegación circular (←/→) y `Esc`; al cerrar, el foco vuelve al botón de origen.

### Catálogo

- `.catalogo__grid` usa una columna hasta `900 px` y dos columnas desde
  `900 px` (imagen + texto).
- La imagen respeta su proporción, limita a `max-height: 480 px` en móvil y
  usa `loading="lazy"`. Es un `<img>` simple: sin enlace, sin `target="_blank"`
  y sin cursor/hover de elemento clicable.

### Video cards

- `.videos__grid` usa 1 columna hasta `900 px` y 3 columnas desde `900 px`.
- Cada `<video>` declara `width="720"`, `height="1280"`, `aspect-ratio: 9 / 16`,
  `autoplay muted loop playsinline`, `preload="none"`,
  `disablepictureinpicture` y `aria-hidden="true"`; no usa `controls`.
- `pages/js/videos-autoplay.js` fuerza `muted` y reproduce con
  `IntersectionObserver` (`threshold: 0.35`) solo al estar visible; pausa al
  salir de pantalla y captura el rechazo de `play()`.
- El `poster` (corte-02/05/08) mantiene el encuadre vertical y evita un bloque
  negro mientras el video no se ha cargado. Con
  `prefers-reduced-motion: reduce` no se reproduce y queda el poster.

## 6. Componentes clave

| Componente | Reglas |
| --- | --- |
| Botón primario | Fondo tinta, texto blanco, pill, altura mínima 44 px, hover eleva sombra |
| Botón secundario | Fondo blanco, borde fuerte, texto tinta |
| Tarjeta de servicio | Superficie blanca, borde cálido, radio 16 px, hover con sombra media |
| Badge de estado | Pill; verde suave para activo, gris para inactivo (siempre con texto) |
| Tabla CRUD | Cabecera en mayúsculas pequeñas sobre `--color-superficie-2`; filas con hover sutil |
| Formularios | Etiquetas visibles, errores junto al campo, fondo `--color-superficie-2` |
| Toast / avisos | Borde de acento, texto legible, cierre accesible |
| Ocupación | Semáforo con color + texto; sillas con borde izquierdo verde/rojo |

## 7. Accesibilidad

- `:focus-visible` global de 3 px con `--color-acento` y `offset` de 2 px.
- Contraste mínimo AA para texto; el acento dorado no se usa para texto
  pequeño sobre blanco (se usa `--color-acento-texto`).
- Objetivos táctiles ≥44 px en navegación, tabs, iconos de acción y botones.
- Navegación de tabs con flechas (incluye ↑/↓ en el sidebar), `Home`/`End`.
- `aria-expanded`, `aria-controls`, `aria-selected` y `role="tablist"`
  sincronizados desde `pagina-admin.js`.
- Respeto de `prefers-reduced-motion` para transiciones y animaciones.
- El estado nunca se comunica solo por color (texto “Libre/Ocupada”,
  “Activo/Inactivo”).

## 7. Responsive

| Breakpoint | Cambios |
| --- | --- |
| `<560 px` | Acciones del navbar apiladas; hero a una columna; CTAs a ancho completo |
| `≥640 px` | KPIs en tres columnas |
| `≥768 px` | Formularios a dos columnas; tablas con scroll horizontal si hace falta |
| `<1024 px` | Sidebar off-canvas + overlay + hamburguesa |
| `≥1024 px` | Sidebar fijo, sin overlay, contenido desplazado 260 px |

## 8. Restricciones respetadas

- **Sin estilos ni handlers inline** (CSP de `pages/_headers`).
- Módulos ES y `import()` dinámicos intactos.
- Ids y `data-*` consumidos por JS sin cambios.
- Iconos tomados de `pages/assets/sprite.svg` (chevron, estrella, silla,
  usuario, x, candado, reloj, bigote, barber-pole, navaja, menú, tijeras).
- Sin dependencias nuevas ni cambios en `package.json`.

## 9. Media y nuevas secciones

### Hero con video

- `.hero__cont` a dos columnas en escritorio y una sola columna por debajo de
  **900 px**; en móvil (<600 px) el texto y los CTAs ocupan todo el ancho.
- `.hero__media` con `aspect-ratio: 4 / 5` y `max-height: 560px`; el
  `<video class="hero__video">` usa `object-fit: cover` y queda recortado sin
  deformarse. Poster `corte-01.jpeg` visible antes de la carga.
- Estados: en `:hover`/`:focus-within` no hay controles (es decorativo); el
  foco visible de 3 px aplica solo a los CTAs del hero.
- Con `prefers-reduced-motion: reduce` el video se oculta y `.hero__media`
  muestra `corte-01.jpeg` como fondo estático.

### `#galeria` — Nuestro trabajo

- `.galeria__grid`: 2 columnas en móvil, 3 desde 768 px y 5 desde 1024 px;
  cada celda `<button>` con `aspect-ratio: 9 / 16` y `gap` de 12–16 px.
- Hover: leve elevación y borde de acento. Focus: anillo de 3 px con
  `--color-acento` y `offset` de 2 px sobre toda la celda.
- `<dialog id="lightbox">` centrado, fondo oscurecido; botones anterior,
  siguiente y cerrar con objetivos ≥44 px, navegación ←/→ y `Esc`.

### `#catalogo` — Catálogo y precios

- `.catalogo__grid`: una columna centrada hasta **900 px**; dos columnas
  (imagen + texto) desde 900 px. Imagen con `max-height: 480px` en móvil y
  proporción original 1024×1536.
- Ventajas en lista con separadores suaves; solo CTA principal “Reservar cita”
  (se retiró el enlace secundario “Ver catálogo completo”).
- La imagen no tiene hover ni foco de enlace: es contenido estático, con
  `cursor: default` y radio de tarjeta.

### `#videos` — Clientes satisfechos

- `.videos__grid`: 1 columna hasta **900 px** y 3 columnas desde 900 px; en
  <600 px las tarjetas se apilan a ancho completo.
- `.video-card`: superficie blanca, radio 16 px, `overflow: hidden`; el video
  declara `aspect-ratio: 9 / 16`, `autoplay muted loop playsinline`,
  `preload="none"`, sin `controls` y con `pointer-events: none`.
- Sin hover de “clicable” en la tarjeta: el video se reproduce solo cuando está
  visible (`IntersectionObserver`, `threshold: 0.35`) y se pausa al salir.
  El `poster` evita el bloque negro inicial.
- El sonido no se puede activar desde la interfaz: decisión de diseño y de
  derechos sobre el audio.

### Estados y movimiento

- Transiciones de 150–250 ms en sombras y elevación; se anulan con
  `prefers-reduced-motion: reduce`.
- Ningún estado depende solo del color: siempre hay texto o icono asociado.

## 10. Archivos

- `pages/css/base.css` — tokens, reset, tipografía, foco, utilidades.
- `pages/css/components.css` — landing, navbar, hero, tarjetas, footer,
  botón “Volver al panel” y ajustes de componentes compartidos.
- `pages/css/admin.css` — shell del panel, sidebar, topbar, KPIs, tablas,
  formularios y responsive del admin.
- `pages/index.html` — estructura de la landing.
- `pages/admin/dashboard.html` — estructura del panel.
- `pages/js/pagina-inicio.js` — botón “Volver al panel”.
- `pages/js/pagina-admin.js` — revelado del shell, sidebar, títulos y KPIs.
- `pages/js/ui.js` — CTA “Reservar” en las tarjetas de servicio.
