/* =============================================================================
   Barbería Kraft - tests/assets-integridad.test.js
   Verifica que toda referencia local a assets en HTML/CSS exista en pages/.
   Runner nativo de Node (node:test) + node:assert/strict - SIN dependencias.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { construirGaleria } from '../pages/js/logica/galeria-logica.js';

const DIR_TEST = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(DIR_TEST, '..');
const PAGES_DIR = path.join(RAIZ, 'pages');
const INDEX_HTML = path.join(PAGES_DIR, 'index.html');
const GALERIA_MODULO = path.join(PAGES_DIR, 'js', 'logica', 'galeria-logica.js');

/* `pages/` contiene 7 HTML versionados (no existe un 8.º). */
const MIN_HTML = 7;
const MIN_CSS = 5;
const MIN_REFERENCIAS = 30;

const EXTENSIONES_ASSET = new Set([
  '.jpg', '.jpeg', '.png', '.svg', '.webp', '.avif',
  '.mp4', '.webm', '.css', '.js', '.woff2', '.ico', '.txt'
]);

const REFERENCIAS_ESPERADAS = [
  'assets/img/logo.jpg',
  'assets/img/catalogo.jpeg',
  'assets/img/corte-01.jpeg',
  'assets/img/corte-10.jpeg',
  'assets/video/principal.mp4',
  'assets/video/modelo-01.mp4',
  'assets/video/modelo-03.mp4'
];

function listarArchivos(dir, filtro, acumulado = []) {
  const entradas = fs.readdirSync(dir, { withFileTypes: true });
  for (const entrada of entradas) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      listarArchivos(ruta, filtro, acumulado);
    } else if (entrada.isFile() && filtro(entrada.name)) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

function rutaRelativa(archivo) {
  return path.relative(RAIZ, archivo).split(path.sep).join('/');
}

/** Quita query string y hash de una referencia. */
function rutaLimpia(referencia) {
  const corte = referencia.search(/[?#]/);
  return (corte === -1 ? referencia : referencia.slice(0, corte)).trim();
}

/**
 * Solo assets locales con extensión conocida. Descarta externos, anclas,
 * data URIs y rutas de página sin extensión (`/`, `/login`, `/reservar`, ...).
 */
function esReferenciaAsset(referencia) {
  if (typeof referencia !== 'string') return false;
  const valor = referencia.trim();
  if (!valor) return false;
  if (/^(?:https?:)?\/\//i.test(valor)) return false;
  if (/^(?:mailto:|tel:|data:|blob:|#)/i.test(valor)) return false;

  const limpia = rutaLimpia(valor);
  if (!limpia || limpia === '/') return false;

  const ultimoSegmento = limpia.split('/').pop() || '';
  const punto = ultimoSegmento.lastIndexOf('.');
  if (punto <= 0 || punto === ultimoSegmento.length - 1) return false;
  return EXTENSIONES_ASSET.has(ultimoSegmento.slice(punto).toLowerCase());
}

function extraerHtml(contenido) {
  const referencias = [];
  const patrones = [
    /(?:src|href|poster)\s*=\s*"([^"]+)"/gi,
    /(?:src|href|poster)\s*=\s*'([^']+)'/gi
  ];
  for (const patron of patrones) {
    let coincidencia;
    while ((coincidencia = patron.exec(contenido)) !== null) {
      referencias.push(coincidencia[1]);
    }
  }
  return referencias;
}

function extraerCss(contenido) {
  const referencias = [];
  const patron = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  let coincidencia;
  while ((coincidencia = patron.exec(contenido)) !== null) {
    referencias.push(coincidencia[1]);
  }
  return referencias;
}

/** Resuelve `/x/y.ext` contra pages/ y `../x` contra la carpeta del archivo. */
function resolverDestino(archivo, referencia) {
  const limpia = rutaLimpia(referencia);
  if (limpia.startsWith('/')) {
    return path.join(PAGES_DIR, ...limpia.split('/').filter(Boolean));
  }
  return path.resolve(path.dirname(archivo), limpia);
}

function esArchivo(destino) {
  return fs.existsSync(destino) && fs.statSync(destino).isFile();
}

function recolectar() {
  const archivos = listarArchivos(PAGES_DIR, (nombre) => /\.(html|css)$/i.test(nombre));
  const archivosHtml = archivos.filter((archivo) => /\.html$/i.test(archivo));
  const archivosCss = archivos.filter((archivo) => /\.css$/i.test(archivo));
  const contenidos = [];
  const referencias = [];

  for (const archivo of archivos) {
    const contenido = fs.readFileSync(archivo, 'utf8');
    contenidos.push({ archivo, contenido });

    const esHtml = /\.html$/i.test(archivo);
    const crudas = esHtml ? extraerHtml(contenido) : extraerCss(contenido);

    for (const cruda of crudas) {
      if (!esReferenciaAsset(cruda)) continue;
      const destino = resolverDestino(archivo, cruda);
      referencias.push({
        archivo,
        origen: rutaRelativa(archivo),
        referencia: cruda,
        destino,
        existe: esArchivo(destino)
      });
    }
  }

  return {
    archivos,
    archivosHtml,
    archivosCss,
    contenidos,
    referencias,
    faltantes: referencias.filter((item) => !item.existe)
  };
}

const ESCANEO = recolectar();

describe('assets-integridad - inventario escaneado', () => {
  test('se escanearon los HTML/CSS y las referencias locales mínimas', () => {
    assert.ok(
      ESCANEO.archivosHtml.length >= MIN_HTML,
      `HTML escaneados: ${ESCANEO.archivosHtml.length} (mínimo ${MIN_HTML})`
    );
    assert.ok(
      ESCANEO.archivosCss.length >= MIN_CSS,
      `CSS escaneados: ${ESCANEO.archivosCss.length} (mínimo ${MIN_CSS})`
    );
    assert.ok(
      ESCANEO.referencias.length >= MIN_REFERENCIAS,
      `Referencias locales revisadas: ${ESCANEO.referencias.length} (mínimo ${MIN_REFERENCIAS})`
    );
  });
});

describe('assets-integridad - referencias existentes', () => {
  test('todas las referencias locales a assets existen', () => {
    const detalle = ESCANEO.faltantes
      .map((item) => `- ${item.referencia}  (origen: ${item.origen})`)
      .join('\n');

    assert.equal(
      ESCANEO.faltantes.length,
      0,
      `Referencias locales inexistentes (${ESCANEO.faltantes.length}):\n${detalle}`
    );
  });

  test('existen los assets base del sitio', () => {
    const ausentes = REFERENCIAS_ESPERADAS.filter((relativa) => {
      return !esArchivo(path.join(PAGES_DIR, ...relativa.split('/')));
    });

    assert.equal(
      ausentes.length,
      0,
      `Assets base ausentes (${ausentes.length}):\n${ausentes.map((r) => `- pages/${r}`).join('\n')}`
    );
  });

  test('ningún HTML/CSS contiene /resources/', () => {
    const infractores = ESCANEO.contenidos
      .filter((item) => item.contenido.includes('/resources/'))
      .map((item) => `- ${rutaRelativa(item.archivo)}`);

    assert.equal(
      infractores.length,
      0,
      `Archivos que aún referencian /resources/ (${infractores.length}):\n${infractores.join('\n')}`
    );
  });

  test('index.html conserva hero, anclas y la galería corte-01..corte-10', () => {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');

    assert.match(html, /principal\.mp4/, 'index.html no referencia principal.mp4');
    assert.match(html, /preload="metadata"/, 'index.html no declara preload="metadata"');
    assert.match(html, /id="galeria"/, 'index.html no tiene id="galeria"');
    assert.match(html, /id="catalogo"/, 'index.html no tiene id="catalogo"');
    assert.match(html, /id="videos"/, 'index.html no tiene id="videos"');

    const modulo = fs.readFileSync(GALERIA_MODULO, 'utf8');
    assert.match(modulo, /corte-/, 'galeria-logica.js no construye rutas de cortes');

    const galeria = construirGaleria();
    assert.equal(galeria.length, 10, 'construirGaleria() no devuelve 10 cortes');
    galeria.forEach((item, indice) => {
      const numero = String(indice + 1).padStart(2, '0');
      assert.ok(
        item.src.endsWith(`corte-${numero}.jpeg`),
        `corte ${numero} inesperado: ${item.src}`
      );
    });
  });

  test('todas las <img> de index.html declaran alt (incluye alt="")', () => {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    const etiquetas = html.match(/<img\b[^>]*>/gi) || [];

    assert.ok(etiquetas.length > 0, 'index.html no contiene etiquetas <img>');

    const sinAlt = etiquetas.filter((etiqueta) => !/\balt\s*=/i.test(etiqueta));
    assert.equal(
      sinAlt.length,
      0,
      `Imágenes sin atributo alt (${sinAlt.length}):\n${sinAlt.join('\n')}`
    );
  });
});
