/* =============================================================================
   Barberia Kraft - tests/galeria-logica.test.js
   Pruebas unitarias de las funciones puras de la galeria «Nuestro trabajo».
   Runner nativo de Node (node:test) + node:assert/strict - SIN dependencias.
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  construirGaleria,
  siguienteIndice,
  anteriorIndice,
  textoContador
} from '../pages/js/logica/galeria-logica.js';

describe('galeria-logica - datos de la galeria', () => {
  test('construirGaleria devuelve exactamente 10 elementos', () => {
    assert.equal(construirGaleria().length, 10);
  });

  test('las rutas apuntan a corte-01.jpeg ... corte-10.jpeg', () => {
    const galeria = construirGaleria();
    assert.equal(galeria[0].src, '/assets/img/corte-01.jpeg');
    assert.equal(galeria[8].src, '/assets/img/corte-09.jpeg');
    assert.equal(galeria[9].src, '/assets/img/corte-10.jpeg');
    galeria.forEach((item, indice) => {
      const numero = String(indice + 1).padStart(2, '0');
      assert.equal(item.src, `/assets/img/corte-${numero}.jpeg`);
    });
  });

  test('alt y titulo son textos no vacios y el alt es descriptivo', () => {
    const galeria = construirGaleria();
    galeria.forEach((item) => {
      assert.equal(typeof item.alt, 'string');
      assert.equal(typeof item.titulo, 'string');
      assert.ok(item.alt.trim().length > 0);
      assert.ok(item.titulo.trim().length > 0);
    });
    assert.equal(galeria[0].alt, 'Corte degradado con diseño');
  });

  test('cada llamada devuelve objetos nuevos (sin estado compartido)', () => {
    const primera = construirGaleria();
    primera[0].alt = 'mutado';
    assert.notEqual(construirGaleria()[0].alt, 'mutado');
  });
});

describe('galeria-logica - navegacion circular', () => {
  test('siguienteIndice avanza y vuelve al inicio al pasar del final', () => {
    assert.equal(siguienteIndice(0, 10), 1);
    assert.equal(siguienteIndice(3, 10), 4);
    assert.equal(siguienteIndice(9, 10), 0);
  });

  test('anteriorIndice retrocede y salta al final desde el inicio', () => {
    assert.equal(anteriorIndice(0, 10), 9);
    assert.equal(anteriorIndice(5, 10), 4);
    assert.equal(anteriorIndice(1, 10), 0);
  });

  test('con total 1 siguiente y anterior se quedan en 0', () => {
    assert.equal(siguienteIndice(0, 1), 0);
    assert.equal(anteriorIndice(0, 1), 0);
  });

  test('siguienteIndice es seguro con total invalido (0, negativo, NaN)', () => {
    assert.equal(siguienteIndice(0, 0), 0);
    assert.equal(siguienteIndice(2, -5), 0);
    assert.equal(siguienteIndice(2, NaN), 0);
    assert.equal(siguienteIndice(2, 2.5), 0);
  });

  test('anteriorIndice es seguro con total invalido (0, negativo, NaN)', () => {
    assert.equal(anteriorIndice(0, 0), 0);
    assert.equal(anteriorIndice(2, -5), 0);
    assert.equal(anteriorIndice(2, NaN), 0);
    assert.equal(anteriorIndice(2, 2.5), 0);
  });

  test('siguienteIndice normaliza un indice actual invalido a 0', () => {
    assert.equal(siguienteIndice(-1, 10), 0);
    assert.equal(siguienteIndice(10, 10), 0);
    assert.equal(siguienteIndice(1.5, 10), 0);
    assert.equal(siguienteIndice(undefined, 10), 0);
  });

  test('anteriorIndice con indice actual invalido usa la ultima posicion', () => {
    assert.equal(anteriorIndice(-1, 10), 9);
    assert.equal(anteriorIndice(10, 10), 9);
    assert.equal(anteriorIndice(1.5, 10), 9);
    assert.equal(anteriorIndice(undefined, 10), 9);
  });
});

describe('galeria-logica - contador', () => {
  test('textoContador muestra la posicion humana (1-based)', () => {
    assert.equal(textoContador(0, 10), '1 de 10');
    assert.equal(textoContador(2, 10), '3 de 10');
    assert.equal(textoContador(9, 10), '10 de 10');
  });

  test('textoContador con un solo elemento', () => {
    assert.equal(textoContador(0, 1), '1 de 1');
  });

  test('textoContador sin total valido devuelve 0 de 0', () => {
    assert.equal(textoContador(0, 0), '0 de 0');
    assert.equal(textoContador(0, -3), '0 de 0');
    assert.equal(textoContador(0, NaN), '0 de 0');
  });

  test('textoContador con indice actual invalido arranca en 1', () => {
    assert.equal(textoContador(-2, 10), '1 de 10');
    assert.equal(textoContador(99, 10), '1 de 10');
    assert.equal(textoContador(undefined, 10), '1 de 10');
  });
});
