/* =============================================================================
   Barbería Kraft - tests/media-videos.test.js
   Contrato de medios de la landing: videos de clientes en autoplay silencioso,
   hero sin sonido y catálogo sin enlace secundario redundante.
   Runner nativo de Node (node:test) + node:assert/strict - SIN dependencias.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_TEST = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(DIR_TEST, '..');
const INDEX_HTML = path.join(RAIZ, 'pages', 'index.html');

const HTML = fs.readFileSync(INDEX_HTML, 'utf8');

function extraerSeccion(id) {
  const patron = new RegExp(
    `<section[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)<\\/section>`,
    'i'
  );
  const coincidencia = HTML.match(patron);
  return coincidencia ? coincidencia[1] : '';
}

function extraerVideos(contenido) {
  return contenido.match(/<video\b[^>]*>/gi) || [];
}

describe('media-videos - videos de clientes (#videos)', () => {
  const seccion = extraerSeccion('videos');
  const videos = extraerVideos(seccion);

  test('la sección #videos contiene al menos un video', () => {
    assert.ok(videos.length > 0, 'No se encontraron <video> dentro de #videos');
  });

  test('cada video es autoplay silencioso, en bucle y sin controles', () => {
    videos.forEach((video, indice) => {
      const etiqueta = `#videos video[${indice}]`;
      assert.match(video, /\bmuted\b/i, `${etiqueta} no declara muted`);
      assert.match(video, /\bautoplay\b/i, `${etiqueta} no declara autoplay`);
      assert.match(video, /\bloop\b/i, `${etiqueta} no declara loop`);
      assert.match(video, /\bplaysinline\b/i, `${etiqueta} no declara playsinline`);
      assert.match(
        video,
        /\bpreload\s*=\s*"none"/i,
        `${etiqueta} no declara preload="none"`
      );
      assert.match(video, /\bposter\s*=\s*"[^"]+"/i, `${etiqueta} no declara poster`);
      assert.doesNotMatch(video, /\bcontrols\b/i, `${etiqueta} no debe tener controls`);
      assert.match(
        video,
        /\bdisablepictureinpicture\b/i,
        `${etiqueta} no declara disablepictureinpicture`
      );
      assert.match(
        video,
        /\baria-hidden\s*=\s*"true"/i,
        `${etiqueta} no declara aria-hidden="true"`
      );
    });
  });
});

describe('media-videos - video del hero', () => {
  const hero = extraerVideos(extraerSeccion('hero') || HTML);
  const videoHero = hero.find((video) => /hero__video/i.test(video)) || hero[0];

  test('el video del hero está silenciado y precarga metadata', () => {
    assert.ok(videoHero, 'No se encontró el <video> del hero');
    assert.match(videoHero, /\bmuted\b/i, 'El video del hero no declara muted');
    assert.match(
      videoHero,
      /\bpreload\s*=\s*"metadata"/i,
      'El video del hero no declara preload="metadata"'
    );
  });
});

describe('media-videos - catálogo sin enlace secundario', () => {
  const catalogo = extraerSeccion('catalogo');

  test('conserva la imagen del catálogo', () => {
    assert.match(
      catalogo,
      /class="[^"]*\bcatalogo__img\b[^"]*"/i,
      'No se encontró la imagen .catalogo__img'
    );
  });

  test('ya no contiene el texto ni el enlace "Ver catálogo completo"', () => {
    assert.doesNotMatch(
      catalogo,
      /Ver\s+catálogo\s+completo/i,
      'Sigue apareciendo "Ver catálogo completo"'
    );
  });

  test('la imagen del catálogo no está envuelta en un <a>', () => {
    assert.doesNotMatch(
      catalogo,
      /<a\b[^>]*>[\s\S]*?<img\b[^>]*class="[^"]*\bcatalogo__img\b/i,
      'La imagen .catalogo__img sigue envuelta en un enlace'
    );
  });
});
