/* =============================================================================
   Barbería Kraft — tests/sesion-logica.test.js (HU04 · badge de sesión)
   -----------------------------------------------------------------------------
   Pruebas unitarias de las funciones puras de pages/js/logica/sesion-logica.js.
   Runner nativo de Node (node:test) + node:assert/strict — SIN dependencias.
   Ejecución: npm test  (ver docs/TEST-UNIT.md)
   ============================================================================= */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  nombreAMostrar,
  construirTextoBadge,
  estadoUiSesion
} from '../pages/js/logica/sesion-logica.js';

describe('sesion-logica (HU04) — texto del badge de sesión', () => {
  test('CP-01 nombreAMostrar devuelve el nombre del metadata', () => {
    const sesion = {
      user: {
        user_metadata: { nombre: 'Ana Torres' },
        email: 'ana.torres@correo.com'
      }
    };
    assert.equal(nombreAMostrar(sesion), 'Ana Torres');
  });

  test('CP-02 nombreAMostrar sin nombre usa la parte local del email (nunca el email completo)', () => {
    const sesion = {
      user: { user_metadata: {}, email: 'ana.torres@correo.com' }
    };
    const resultado = nombreAMostrar(sesion);
    assert.equal(resultado, 'ana.torres');
    assert.ok(!resultado.includes('@'), 'no debe contener "@" ni el dominio');
  });

  test('CP-03 nombreAMostrar sin nombre ni email devuelve "Sesión activa" (límite: email vacío)', () => {
    // Sin user_metadata.nombre y con email vacío / en blanco / ausente
    assert.equal(nombreAMostrar({ user: { user_metadata: {}, email: '' } }), 'Sesión activa');
    assert.equal(nombreAMostrar({ user: { email: '   ' } }), 'Sesión activa');
    assert.equal(nombreAMostrar({ user: {} }), 'Sesión activa');
  });

  test('CP-04 nombreAMostrar sin sesión (null/undefined/sin user) devuelve null para ocultar el badge', () => {
    assert.equal(nombreAMostrar(null), null);
    assert.equal(nombreAMostrar(undefined), null);
    assert.equal(nombreAMostrar({}), null);
    assert.equal(nombreAMostrar({ user: null }), null);
  });

  test('CP-05 construirTextoBadge arma "Sesión: {nombre}" y null cuando no hay sesión', () => {
    assert.equal(
      construirTextoBadge({
        user: { user_metadata: { nombre: 'Ana Torres' }, email: 'ana@correo.com' }
      }),
      'Sesión: Ana Torres'
    );
    // Fallback a la parte local del email
    assert.equal(
      construirTextoBadge({ user: { email: 'carlos.ruiz@correo.com' } }),
      'Sesión: carlos.ruiz'
    );
    // Sesión activa sin nombre ni email → texto genérico (CP-03)
    assert.equal(construirTextoBadge({ user: {} }), 'Sesión: Sesión activa');
    // Sin sesión (sin user) → null (el badge se oculta; CP-04)
    assert.equal(construirTextoBadge(null), null);
    assert.equal(construirTextoBadge({ user: null }), null);
  });
});

describe('sesion-logica (HU04) — estadoUiSesion: visibilidad del botón y del badge', () => {
  test('CP-15 sin sesión → NO mostrar botón y badge null (control oculto por defecto)', () => {
    assert.deepEqual(estadoUiSesion(null), {
      mostrarCerrarSesion: false,
      textoBadge: null
    });
    assert.deepEqual(estadoUiSesion(undefined), {
      mostrarCerrarSesion: false,
      textoBadge: null
    });
    assert.deepEqual(estadoUiSesion({}), {
      mostrarCerrarSesion: false,
      textoBadge: null
    });
    assert.deepEqual(estadoUiSesion({ user: null }), {
      mostrarCerrarSesion: false,
      textoBadge: null
    });
  });

  test('CP-16 con sesión → SÍ mostrar botón y texto "Sesión: {nombre}"', () => {
    assert.deepEqual(
      estadoUiSesion({
        user: { user_metadata: { nombre: 'Ana Torres' }, email: 'ana@correo.com' }
      }),
      { mostrarCerrarSesion: true, textoBadge: 'Sesión: Ana Torres' }
    );
  });

  test('CP-17 con sesión sin nombre usa la parte local del email y mostrar=true', () => {
    assert.deepEqual(
      estadoUiSesion({ user: { user_metadata: {}, email: 'carlos.ruiz@correo.com' } }),
      { mostrarCerrarSesion: true, textoBadge: 'Sesión: carlos.ruiz' }
    );
  });

  test('CP-18 el contrato es estable: la forma de retorno siempre tiene ambos campos boolean/string', () => {
    const sin = estadoUiSesion(null);
    const con = estadoUiSesion({ user: { email: 'a@b.com' } });
    assert.equal(typeof sin.mostrarCerrarSesion, 'boolean');
    assert.equal(typeof con.mostrarCerrarSesion, 'boolean');
    assert.equal(sin.textoBadge, null);
    assert.equal(typeof con.textoBadge, 'string');
    // El botón y el badge comparten SIEMPRE el mismo criterio de sesión:
    // hay badge ⇔ hay botón de cerrar sesión.
    assert.equal(con.mostrarCerrarSesion, Boolean(con.textoBadge));
    assert.equal(sin.mostrarCerrarSesion, Boolean(sin.textoBadge));
  });
});
