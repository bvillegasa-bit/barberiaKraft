#!/usr/bin/env node
/* =============================================================================
   Barbería Kraft — build.js (pipeline de build estático + inyección de secrets)
   -----------------------------------------------------------------------------
   Node puro, SIN dependencias externas (solo fs/path nativos).

   USO:
     node build.js          → build de PRODUCCIÓN:
                              requiere SUPABASE_URL y SUPABASE_ANON_KEY
                              (GitHub Secrets en CI, env vars en local).
     node build.js --dev    → build de DESARROLLO local:
                              genera config con tokens (__SUPABASE_URL__ /
                              __SUPABASE_ANON_KEY__) y banner de aviso; no
                              requiere env vars.

   QUÉ HACE:
   1. Limpia dist/ y copia recursivamente pages/ → dist/
      (excluye .env*, js/config.js original y js/config.template.js).
   2. Genera dist/js/config.js a partir de pages/js/config.template.js
      sustituyendo los tokens por los valores reales (o dejándolos en --dev).
   3. Reescribe dist/_headers: reemplaza <TU-PROYECTO> por el host real
      extraído de SUPABASE_URL (connect-src del CSP).
   4. Imprime un resumen (archivos, tamaño, host detectado) SIN imprimir el
      valor de las claves.

   SEGURIDAD (CA-RNF03-2): este script NUNCA imprime SUPABASE_ANON_KEY ni la
   URL completa; el repo solo contiene placeholders (config.template.js).
   ============================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PAGES_DIR = path.join(ROOT, 'pages');
const DIST_DIR = path.join(ROOT, 'dist');
const TEMPLATE_CONFIG = path.join(PAGES_DIR, 'js', 'config.template.js');

const MODO_DEV = process.argv.includes('--dev');

// Estadísticas del build (para el resumen final)
const stats = { archivos: 0, bytes: 0, excluidos: [] };

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function errorYSalir(mensaje) {
  console.error('\n[build.js] ERROR: ' + mensaje);
  console.error('[build.js] Uso: node build.js            (producción, requiere SUPABASE_URL y SUPABASE_ANON_KEY)');
  console.error('[build.js]       node build.js --dev     (desarrollo local, genera placeholders)');
  process.exit(1);
}

/** Imprime un diagnóstico del entorno. NUNCA imprime valores de secretos: solo nombres/presencia. */
function diagnosticarEnv() {
  /** Devuelve los nombres de variables de entorno que empiecen con el prefijo dado. */
  function nombresConPrefijo(prefijo) {
    return Object.keys(process.env).filter(function (k) {
      return k.indexOf(prefijo) === 0;
    });
  }
  const primeraKey = Object.keys(process.env).sort(function (a, b) {
    return a.localeCompare(b);
  })[0];

  console.error('[build.js] DIAG cwd: ' + process.cwd());
  console.error('[build.js] DIAG node: ' + process.version);
  console.error('[build.js] DIAG total env vars: ' + Object.keys(process.env).length);
  console.error('[build.js] DIAG SUPABASE_URL presente: ' + (process.env.SUPABASE_URL ? 'si' : 'no'));
  console.error('[build.js] DIAG SUPABASE_ANON_KEY presente: ' + (process.env.SUPABASE_ANON_KEY ? 'si' : 'no'));
  console.error('[build.js] DIAG CF_PAGES presente: ' + (process.env.CF_PAGES ? 'si' : 'no') + ' (valor: ' + (process.env.CF_PAGES || '(vacio)') + ')');
  console.error('[build.js] DIAG CF_PAGES_BRANCH: ' + (process.env.CF_PAGES_BRANCH || '(vacio)'));
  console.error('[build.js] DIAG names_SUPABASE_* : ' + (nombresConPrefijo('SUPABASE').join(',') || '(ninguna)'));
  console.error('[build.js] DIAG names_CF_PAGES* : ' + (nombresConPrefijo('CF_PAGES').join(',') || '(ninguna)'));
  console.error('[build.js] DIAG names_TEST* : ' + (nombresConPrefijo('TEST').join(',') || '(ninguna)'));
  console.error('[build.js] DIAG primera key del env (ordinal alfabetico): ' + (primeraKey || '(vacio)'));
}

/** True si el nombre corresponde a un archivo de entorno (.env, .env.*, *.env). */
function esArchivoEnv(nombre) {
  return nombre.startsWith('.env') || nombre.endsWith('.env');
}

/**
 * Decide si una ruta relativa a pages/ NO debe copiarse a dist/.
 * - archivos .env*            → nunca viajan al deploy
 * - js/config.js              → el original/generado NO se copia: se regenera
 * - js/config.template.js     → es insumo del build, no se sirve
 */
function debeExcluir(relativa) {
  const segmentos = relativa.split(path.sep);
  for (const seg of segmentos) {
    if (esArchivoEnv(seg)) {
      stats.excluidos.push(relativa);
      return true;
    }
  }
  const rutaNormalizada = relativa.split(path.sep).join('/');
  if (rutaNormalizada === 'js/config.js' || rutaNormalizada.endsWith('/js/config.js')) {
    stats.excluidos.push(relativa);
    return true;
  }
  if (rutaNormalizada === 'js/config.template.js' || rutaNormalizada.endsWith('/js/config.template.js')) {
    stats.excluidos.push(relativa);
    return true;
  }
  return false;
}

/** Copia recursiva de pages/ → dist/ aplicando los filtros de exclusión. */
function copiarArbol(origen, destino) {
  let entradas;
  try {
    entradas = fs.readdirSync(origen, { withFileTypes: true });
  } catch (err) {
    errorYSalir('No se pudo leer ' + origen + ' (' + err.message + ')');
  }
  for (const entrada of entradas) {
    const rutaOrigen = path.join(origen, entrada.name);
    const relativa = path.relative(PAGES_DIR, rutaOrigen);
    if (debeExcluir(relativa)) continue;

    const rutaDestino = path.join(destino, relativa);
    if (entrada.isDirectory()) {
      fs.mkdirSync(rutaDestino, { recursive: true });
      copiarArbol(rutaOrigen, destino);
    } else {
      fs.mkdirSync(path.dirname(rutaDestino), { recursive: true });
      fs.copyFileSync(rutaOrigen, rutaDestino);
      stats.archivos += 1;
      stats.bytes += fs.statSync(rutaOrigen).size;
    }
  }
}

/**
 * Genera dist/js/config.js a partir de config.template.js.
 * IMPORTANTE: la sustitución es SOLO sobre las líneas de export (regex anclada),
 * NO sobre todo el archivo: los literales de esConfigPlaceholder() y los
 * comentarios contienen la cadena "__SUPABASE_URL__"/"__SUPABASE_ANON_KEY__"
 * y deben conservarse como tokens para que la detección siga funcionando.
 */
function generarConfig(supabaseUrl, anonKey) {
  const plantilla = fs.readFileSync(TEMPLATE_CONFIG, 'utf8');

  let banner;
  let contenido;
  if (MODO_DEV) {
    banner =
      '/* =============================================================================\n' +
      '   ARCHIVO GENERADO por `node build.js --dev` (MODO DESARROLLO local)\n' +
      '   ⚠️ Contiene placeholders: la app mostrará el aviso "Configuración pendiente".\n' +
      '   Para producción: ejecuta `npm run build` con las env vars SUPABASE_URL y\n' +
      '   SUPABASE_ANON_KEY (en CI las inyecta GitHub Actions desde los Secrets).\n' +
      '   NO edites este archivo a mano: se regenera en cada build. Ver docs/README.md\n' +
      '   ============================================================================= */\n\n';
    contenido = plantilla;
  } else {
    banner =
      '/* =============================================================================\n' +
      '   ARCHIVO GENERADO por `npm run build` (node build.js) — NO versionar.\n' +
      '   Fuente: pages/js/config.template.js + env vars (GitHub Secrets en CI).\n' +
      '   ============================================================================= */\n\n';
    contenido = plantilla
      .replace(
        /^export const SUPABASE_URL = '[^']*';/m,
        () => "export const SUPABASE_URL = " + JSON.stringify(supabaseUrl) + ";"
      )
      .replace(
        /^export const SUPABASE_ANON_KEY = '[^']*';/m,
        () => "export const SUPABASE_ANON_KEY = " + JSON.stringify(anonKey) + ";"
      );
  }

  const rutaSalida = path.join(DIST_DIR, 'js', 'config.js');
  fs.mkdirSync(path.dirname(rutaSalida), { recursive: true });
  fs.writeFileSync(rutaSalida, banner + contenido);
  return rutaSalida;
}

/**
 * Reescribe dist/_headers: sustituye el token <TU-PROYECTO> del connect-src por
 * el host real de SUPABASE_URL (ej. https://xyzcompany.supabase.co →
 * xyzcompany.supabase.co). El reemplazo es por línea para no alterar comentarios.
 */
function reescribirHeaders(supabaseUrl) {
  const rutaHeaders = path.join(DIST_DIR, '_headers');
  if (!fs.existsSync(rutaHeaders)) {
    console.warn('[build.js] AVISO: no se encontró dist/_headers (¿cambió la estructura de pages/?).');
    return;
  }
  const host = new URL(supabaseUrl).hostname;
  const patronCompleto = 'https://<TU-PROYECTO>.supabase.co';

  const contenidoOriginal = fs.readFileSync(rutaHeaders, 'utf8');
  const lineas = contenidoOriginal.split(/\r?\n/).map((linea) => {
    if (linea.includes('# TODO: reemplazar <TU-PROYECTO> antes del deploy')) {
      return '# Host Supabase inyectado por `npm run build` en el deploy: ' + host;
    }
    if (linea.includes('connect-src') && linea.includes('<TU-PROYECTO>')) {
      let nueva = linea.split(patronCompleto).join('https://' + host);
      nueva = nueva.split('<TU-PROYECTO>').join(host); // respaldo si cambia el formato
      return nueva;
    }
    return linea;
  });

  const contenidoNuevo = lineas.join('\n');
  fs.writeFileSync(rutaHeaders, contenidoNuevo);

  // Solo avisa si el token quedó en la línea del CSP (los comentarios que
  // documentan el placeholder sí lo conservan a propósito).
  if (lineas.some((l) => l.includes('connect-src') && l.includes('<TU-PROYECTO>'))) {
    console.warn('[build.js] AVISO: quedó el token <TU-PROYECTO> en dist/_headers — revisa el formato del placeholder.');
  }
}

function imprimirResumen(hostDetectado) {
  const tamanoKb = (stats.bytes / 1024).toFixed(2);
  console.log('');
  console.log('[build.js] Build completado en: ' + DIST_DIR);
  console.log('[build.js]   Archivos copiados : ' + stats.archivos);
  console.log('[build.js]   Tamaño total      : ' + tamanoKb + ' KB');
  if (stats.excluidos.length > 0) {
    console.log('[build.js]   Excluidos de dist : ' + stats.excluidos.join(', '));
  }
  if (MODO_DEV) {
    console.log('[build.js]   MODO DESARROLLO   : config.js generado con placeholders (esConfigPlaceholder() = true)');
    console.log('[build.js]   ⚠️  No apto para producción: falta inyectar SUPABASE_URL / SUPABASE_ANON_KEY.');
  } else {
    console.log('[build.js]   Host Supabase     : ' + hostDetectado);
    console.log('[build.js]   (los valores de las claves NO se imprimen por seguridad)');
  }
  console.log('');
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */

function main() {
  if (!fs.existsSync(PAGES_DIR)) {
    errorYSalir('No existe el directorio pages/ (' + PAGES_DIR + '). Ejecuta el build desde la raíz del repo.');
  }
  if (!fs.existsSync(TEMPLATE_CONFIG)) {
    errorYSalir('No se encontró la plantilla de config: ' + TEMPLATE_CONFIG);
  }

  let supabaseUrl = null;
  let anonKey = null;

  if (MODO_DEV) {
    if (process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY) {
      console.warn('[build.js] AVISO: se ignoran SUPABASE_URL/SUPABASE_ANON_KEY porque se usó --dev.');
    }
  } else {
    supabaseUrl = process.env.SUPABASE_URL || '';
    anonKey = process.env.SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !anonKey) {
      diagnosticarEnv();
      errorYSalir('Faltan SUPABASE_URL o SUPABASE_ANON_KEY. Configúralas como variables de entorno (en CI: GitHub Secrets del workflow .github/workflows/deploy.yml).');
    }
    let url;
    try {
      url = new URL(supabaseUrl);
    } catch (_) {
      errorYSalir('SUPABASE_URL no es una URL válida: "' + supabaseUrl + '"');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      errorYSalir('SUPABASE_URL debe comenzar con https:// (o http:// en desarrollo local).');
    }
  }

  // 1) Limpiar dist/ y copiar pages/ → dist/
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  copiarArbol(PAGES_DIR, DIST_DIR);

  // 2) Generar dist/js/config.js desde la plantilla
  generarConfig(supabaseUrl, anonKey);
  stats.archivos += 1; // el config.js generado también cuenta en el resumen

  // 3) Reescribir dist/_headers con el host real (solo en producción)
  let hostDetectado = null;
  if (!MODO_DEV) {
    hostDetectado = new URL(supabaseUrl).hostname;
    reescribirHeaders(supabaseUrl);

    // 4) Warning opcional si el host no coincide con el esperado
    const esperado = process.env.CF_PAGES_EXPECTED_HOST;
    if (esperado && esperado !== hostDetectado) {
      console.warn('[build.js] AVISO: CF_PAGES_EXPECTED_HOST="' + esperado + '" pero el host de SUPABASE_URL es "' + hostDetectado + '". Revisa la config.');
    }
  }

  // 5) Resumen
  imprimirResumen(hostDetectado);
}

main();