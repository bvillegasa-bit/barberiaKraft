/* =============================================================================
   Barbería Kraft — scripts/bench-validacion.mjs (T27 · SOLID)
   -----------------------------------------------------------------------------
   Benchmark SIN dependencias de la capa de validación (Node puro).

   Carga:
   - 100.000 validaciones de email (válido / inválido 50/50);
   - 100.000 validaciones de teléfono (válido / inválido 50/50);
   - 100.000 validaciones de contraseña (fuerte / débil 50/50);
   - 10.000 validaciones de un formulario de registro completo (5 campos);
   - 10.000 evaluaciones del checklist de contraseña.

   Reporta operaciones/segundo, milisegundos totales, microsegundos por
   operación y percentiles p50/p95/p99 sobre 1.000 muestras individuales.

   Uso: `npm run bench`
   ============================================================================= */

import { performance } from 'node:perf_hooks';

import { validarEmail } from '../pages/js/validacion/reglas/email.js';
import { validarTelefono } from '../pages/js/validacion/reglas/telefono.js';
import {
  validarPassword,
  evaluarRequisitosPassword
} from '../pages/js/validacion/reglas/password.js';
import { validarFormulario } from '../pages/js/validacion/validador-formulario.js';
import { REGLAS_REGISTRO } from '../pages/js/validacion/registro-reglas.js';

const MUESTRAS = 1000;
const CALENTAMIENTO = 1000;

let sumidero = 0;

function consumir(resultado) {
  if (resultado === null || resultado === '' || resultado === false) sumidero += 1;
  else if (Array.isArray(resultado)) sumidero += resultado.length;
  else if (typeof resultado === 'object') sumidero += 1;
}

function percentil(ordenados, p) {
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[indice];
}

function medir(escenario, operacion, iteraciones) {
  for (let i = 0; i < CALENTAMIENTO; i += 1) consumir(operacion(i));

  const inicio = performance.now();
  for (let i = 0; i < iteraciones; i += 1) consumir(operacion(i));
  const ms = performance.now() - inicio;

  const muestras = [];
  for (let i = 0; i < MUESTRAS; i += 1) {
    const antes = performance.now();
    consumir(operacion(i));
    const despues = performance.now();
    muestras.push(despues - antes);
  }
  muestras.sort((a, b) => a - b);

  return {
    escenario,
    iteraciones,
    ms,
    opsPorSegundo: iteraciones / (ms / 1000),
    microsPorOperacion: (ms * 1000) / iteraciones,
    p50: percentil(muestras, 50) * 1000,
    p95: percentil(muestras, 95) * 1000,
    p99: percentil(muestras, 99) * 1000
  };
}

const EMAILS = ['ana.torres@correo.com', 'ana.torres@correo'];
const TELEFONOS = ['999888777', '99988877'];
const PASSWORDS = ['Kraft2026!', 'kraft2026'];
const FORMULARIO = {
  nombre: 'Ana Torres',
  email: 'ana.torres@correo.com',
  password: 'Kraft2026!',
  confirmar_password: 'Kraft2026!',
  telefono: '999888777'
};

const resultados = [
  medir('email (válido/inválido)', (i) => validarEmail(EMAILS[i % EMAILS.length]), 100000),
  medir('teléfono (válido/inválido)', (i) => validarTelefono(TELEFONOS[i % TELEFONOS.length]), 100000),
  medir('contraseña (fuerte/débil)', (i) => validarPassword(PASSWORDS[i % PASSWORDS.length]), 100000),
  medir('formulario registro (5 campos)', () => validarFormulario(FORMULARIO, REGLAS_REGISTRO), 10000),
  medir('checklist contraseña', () => evaluarRequisitosPassword('Kraft2026!'), 10000)
];

const cabecera = [
  'Escenario'.padEnd(31),
  'Iteraciones'.padStart(12),
  'ms total'.padStart(10),
  'ops/s'.padStart(12),
  'µs/op'.padStart(8),
  'p50 µs'.padStart(8),
  'p95 µs'.padStart(8),
  'p99 µs'.padStart(8)
].join(' ');

console.log('\nBarbería Kraft · benchmark de la capa de validación');
console.log(`Node ${process.version} · ${process.platform} · ${MUESTRAS} muestras por escenario\n`);
console.log(cabecera);
console.log('-'.repeat(cabecera.length));

for (const fila of resultados) {
  console.log(
    [
      fila.escenario.padEnd(31),
      String(fila.iteraciones).padStart(12),
      fila.ms.toFixed(1).padStart(10),
      Math.round(fila.opsPorSegundo).toLocaleString('es-PE').padStart(12),
      fila.microsPorOperacion.toFixed(3).padStart(8),
      fila.p50.toFixed(3).padStart(8),
      fila.p95.toFixed(3).padStart(8),
      fila.p99.toFixed(3).padStart(8)
    ].join(' ')
  );
}

const formulario = resultados.find((fila) => fila.escenario.startsWith('formulario'));
const msPorFormulario = formulario.ms / formulario.iteraciones;

console.log(
  `\nCriterio de aceptación (validar un formulario < 1 ms): ${msPorFormulario.toFixed(4)} ms → ` +
    (msPorFormulario < 1 ? 'CUMPLE' : 'NO CUMPLE')
);
console.log(`Sumidero anti-optimización: ${sumidero}`);

if (msPorFormulario >= 1) process.exitCode = 1;
