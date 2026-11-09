'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS_DIR = path.join(__dirname, '..', 'pages', 'css');
const BASE_CSS = fs.readFileSync(path.join(CSS_DIR, 'base.css'), 'utf-8');

function extraerTokens(css) {
  const re = /--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{3,8}|var\(--[\w-]+\))/g;
  const mapa = {};
  let m;
  while ((m = re.exec(css)) !== null) {
    mapa[m[1]] = m[2];
  }
  const resolver = (nombre, vistos = new Set()) => {
    if (vistos.has(nombre) || !(nombre in mapa)) return undefined;
    vistos.add(nombre);
    const valor = mapa[nombre];
    if (valor.startsWith('#')) return valor;
    const alias = valor.match(/^var\(--([\w-]+)\)$/);
    if (!alias) return undefined;
    return resolver(alias[1], vistos);
  };
  return resolver;
}

const resolver = extraerTokens(BASE_CSS);
const tokens = [
  'color-fondo',
  'color-superficie',
  'color-superficie-2',
  'color-tinta',
  'color-tinta-suave',
  'color-acento',
  'color-acento-texto',
  'color-oscuro',
  'color-vino',
  'color-exito',
  'color-peligro',
].map((n) => [n, `--${n}`, resolver(n)]);

function hexARgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length <= 4 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function canalLineal(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminanciaRelativa([r, g, b]) {
  return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

function contraste(hexA, hexB) {
  const l1 = luminanciaRelativa(hexARgb(hexA));
  const l2 = luminanciaRelativa(hexARgb(hexB));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const fmt = (n) => n.toFixed(2);
const get = (nombre) => tokens.find(([n]) => n === nombre)[2];
const BLANCO = '#FFFFFF';

test('todos los tokens de paleta existen con hex en base.css', () => {
  for (const [, nombreToken, hex] of tokens) {
    assert.ok(
      hex !== undefined && hex.startsWith('#'),
      `El token ${nombreToken} no resuelve a un hex (valor: ${hex ?? 'undefined'})`,
    );
  }
});

test(`contraste(tinta, fondo) >= 7`, () => {
  const ratio = contraste(get('color-tinta'), get('color-fondo'));
  assert.ok(
    ratio >= 7,
    `contraste(${get('color-tinta')} sobre ${get('color-fondo')}) = ${fmt(ratio)}:1 < 7`,
  );
});

test(`contraste(tinta-suave, fondo) >= 4.5`, () => {
  const ratio = contraste(get('color-tinta-suave'), get('color-fondo'));
  assert.ok(
    ratio >= 4.5,
    `contraste(${get('color-tinta-suave')} sobre ${get('color-fondo')}) = ${fmt(ratio)}:1 < 4.5`,
  );
});

test(`contraste(acento-texto, fondo) >= 4.5`, () => {
  const ratio = contraste(get('color-acento-texto'), get('color-fondo'));
  assert.ok(
    ratio >= 4.5,
    `contraste(${get('color-acento-texto')} sobre ${get('color-fondo')}) = ${fmt(ratio)}:1 < 4.5`,
  );
});

test(`contraste(#FFFFFF, acento-texto) >= 4.5`, () => {
  const ratio = contraste(BLANCO, get('color-acento-texto'));
  assert.ok(
    ratio >= 4.5,
    `contraste(${BLANCO} sobre ${get('color-acento-texto')}) = ${fmt(ratio)}:1 < 4.5`,
  );
});

test(`contraste(#FFFFFF, vino) >= 4.5`, () => {
  const ratio = contraste(BLANCO, get('color-vino'));
  assert.ok(
    ratio >= 4.5,
    `contraste(${BLANCO} sobre ${get('color-vino')}) = ${fmt(ratio)}:1 < 4.5`,
  );
});

test(`contraste(#FFFFFF, oscuro) >= 7`, () => {
  const ratio = contraste(BLANCO, get('color-oscuro'));
  assert.ok(
    ratio >= 7,
    `contraste(${BLANCO} sobre ${get('color-oscuro')}) = ${fmt(ratio)}:1 < 7`,
  );
});

test(`contraste(tinta, superficie-2) >= 7`, () => {
  const ratio = contraste(get('color-tinta'), get('color-superficie-2'));
  assert.ok(
    ratio >= 7,
    `contraste(${get('color-tinta')} sobre ${get('color-superficie-2')}) = ${fmt(ratio)}:1 < 7`,
  );
});

test(`contraste(peligro, blanco) >= 4.5`, () => {
  const ratio = contraste(get('color-peligro'), BLANCO);
  assert.ok(
    ratio >= 4.5,
    `contraste(${get('color-peligro')} sobre ${BLANCO}) = ${fmt(ratio)}:1 < 4.5`,
  );
});

test(`contraste(exito, blanco) >= 4.5`, () => {
  const ratio = contraste(get('color-exito'), BLANCO);
  assert.ok(
    ratio >= 4.5,
    `contraste(${get('color-exito')} sobre ${BLANCO}) = ${fmt(ratio)}:1 < 4.5`,
  );
});

test('ningun CSS usa var(--color-acento) como propiedad color de texto', () => {
  const re = /(?<![-\w])color\s*:\s*var\(--color-acento\)\s*;/;
  const ofensores = fs
    .readdirSync(CSS_DIR)
    .filter((f) => f.endsWith('.css'))
    .filter((f) => re.test(fs.readFileSync(path.join(CSS_DIR, f), 'utf-8')));
  assert.deepEqual(
    ofensores,
    [],
    `El acento es decorativo (usar --color-acento-texto para texto). Ofensores: ${ofensores.join(', ')}`,
  );
});
