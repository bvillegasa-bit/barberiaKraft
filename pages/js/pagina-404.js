/* =============================================================================
   Barbería Kraft — pagina-404.js (T06)
   Inicializa la navbar y el año del footer de la página 404 (script externo
   para cumplir el CSP: script-src 'self', sin inline).
   ============================================================================= */

import { iniciarNavbar, $ } from './ui.js';

iniciarNavbar();

const anio = $('#anio');
if (anio) anio.textContent = String(new Date().getFullYear());