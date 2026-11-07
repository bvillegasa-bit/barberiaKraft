/* =============================================================================
   Barbería Kraft — galeria.js
   Pinta la galería «Nuestro trabajo» y gestiona el lightbox accesible.
   Render con createElement/textContent (sin innerHTML ni handlers inline).
   Navegación con flechas ←/→ y Escape; el foco vuelve al ítem de origen.
   ============================================================================= */

import {
  construirGaleria,
  siguienteIndice,
  anteriorIndice,
  textoContador
} from './logica/galeria-logica.js';

export function iniciarGaleria() {
  const grid = document.getElementById('galeria-grid');
  const dialog = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const titulo = document.getElementById('lightbox-titulo');
  const contador = document.getElementById('lightbox-contador');
  const btnCerrar = document.getElementById('lightbox-cerrar');
  const btnAnterior = document.getElementById('lightbox-anterior');
  const btnSiguiente = document.getElementById('lightbox-siguiente');

  if (!grid || !dialog || !img || !titulo || !contador || !btnCerrar || !btnAnterior || !btnSiguiente) {
    return;
  }

  const items = construirGaleria();
  let indiceActual = 0;
  let disparador = null;

  function pintarGaleria() {
    const fragmento = document.createDocumentFragment();

    items.forEach((item, indice) => {
      const celda = document.createElement('li');
      celda.className = 'galeria__celda';

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'galeria__item';
      boton.setAttribute('aria-label', `Ver ${item.titulo}`);

      const imagen = document.createElement('img');
      imagen.src = item.src;
      imagen.alt = item.alt;
      imagen.loading = 'lazy';
      imagen.decoding = 'async';
      imagen.width = 720;
      imagen.height = 1280;

      const overlay = document.createElement('span');
      overlay.className = 'galeria__overlay';
      overlay.setAttribute('aria-hidden', 'true');

      const texto = document.createElement('span');
      texto.className = 'galeria__titulo';
      texto.textContent = item.titulo;

      overlay.appendChild(texto);
      boton.append(imagen, overlay);
      boton.addEventListener('click', () => abrirLightbox(indice, boton));

      celda.appendChild(boton);
      fragmento.appendChild(celda);
    });

    grid.appendChild(fragmento);
  }

  function actualizarLightbox() {
    const item = items[indiceActual];
    img.src = item.src;
    img.alt = item.alt;
    titulo.textContent = item.titulo;
    contador.textContent = textoContador(indiceActual, items.length);
  }

  function abrirLightbox(indice, boton) {
    indiceActual = indice;
    disparador = boton;
    actualizarLightbox();
    dialog.showModal();
    btnCerrar.focus();
  }

  function irAnterior() {
    indiceActual = anteriorIndice(indiceActual, items.length);
    actualizarLightbox();
  }

  function irSiguiente() {
    indiceActual = siguienteIndice(indiceActual, items.length);
    actualizarLightbox();
  }

  btnCerrar.addEventListener('click', () => dialog.close());
  btnAnterior.addEventListener('click', irAnterior);
  btnSiguiente.addEventListener('click', irSiguiente);

  dialog.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      irAnterior();
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      irSiguiente();
    }
  });

  dialog.addEventListener('close', () => {
    if (disparador && typeof disparador.focus === 'function') {
      disparador.focus();
    }
    disparador = null;
  });

  pintarGaleria();
}
