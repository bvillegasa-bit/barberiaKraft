# Pruebas dinámicas HTTP sobre producción — Barbería Kraft

## 1. Objetivo y entorno

**Objetivo:** medir disponibilidad y rendimiento HTTP de 13 rutas públicas del despliegue de producción, con 3 repeticiones por ruta (39 peticiones), incluyendo una 404 intencional como control negativo.

- **Fecha de ejecución:** 24/11/2026, 16:43 (hora local).
- **Entorno:** Windows · Windows PowerShell 5.1 · `curl.exe` nativo.
- **URL base:** `https://barberiakraft.pages.dev`
- **Salida de datos:** `docs/metricas-http.csv` (métricas agregadas por ruta).

## 2. Comandos exactos para reproducir

Desde la raíz del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\probe-produccion.ps1
```

Una sola ruta, con `curl.exe` suelto (ejemplo `/`):

```powershell
curl.exe -s -o NUL -w "%{http_code}|%{time_total}|%{time_starttransfer}|%{time_connect}|%{size_download}" --max-time 25 "https://barberiakraft.pages.dev/" 2>$null
```

El script usa exactamente ese formato, redirige stderr con `2>$null`, parsea los cinco campos separados por `|` y calcula medias y p95 (nearest-rank sobre 3 muestras por ruta; sobre 39 para el global).

## 3. Resultados por caso de prueba

| Caso de prueba | Ruta | Resultado obtenido (HTTP) | Tiempo medio (s) | TTFB medio (s) | Bytes | Evaluación |
|---|---|---:|---:|---:|---:|---|
| CP-01 Inicio | `/` | 200 (modal) | 0,5529 | 0,5528 | 18 807 | OK; ruta más lenta y con mayor p95 (1,1279 s) |
| CP-02 Login | `/login` | 200 (modal) | 0,3312 | 0,3311 | 3 762 | OK |
| CP-03 Registro | `/registro` | 200 (modal) | 0,2840 | 0,2838 | 5 875 | OK |
| CP-04 Reservar | `/reservar` | 200 (modal) | 0,2367 | 0,2364 | 8 677 | OK |
| CP-05 Ticket | `/ticket` | 200 (modal) | 0,2967 | 0,2965 | 5 182 | OK |
| CP-06 Panel admin | `/admin/dashboard` | 200 (modal) | 0,2417 | 0,2415 | 13 024 | OK |
| CP-07 CSS base | `/css/base.css` | 200 (modal) | 0,1908 | 0,1907 | 11 813 | OK |
| CP-08 CSS landing | `/css/landing.css` | 200 (modal) | 0,1902 | 0,1883 | 30 852 | OK |
| CP-09 JS inicio | `/js/pagina-inicio.js` | 200 (modal) | 0,1814 | 0,1813 | 5 766 | OK; tiempo medio más bajo |
| CP-10 JS validación | `/js/validacion/index.js` | 200 (modal) | 0,3170 | 0,3169 | 1 544 | OK |
| CP-11 Logo | `/assets/img/logo.jpg` | 200 (modal) | 0,4471 | 0,3875 | 105 727 | OK |
| CP-12 Vídeo principal | `/assets/video/principal.mp4` | 200 (modal) | 0,4102 | 0,2075 | 2 213 250 | OK; mayor volumen descargado |
| CP-13 404 intencional | `/ruta-inexistente-prueba` | 404 (modal) | 0,2424 | 0,2421 | 2 462 | Esperado: control negativo |

Tiempo global medio: **0,3017 s**. Tiempo global p95: **0,6465 s**.

## 4. Tasa de errores

Se cuenta como error toda respuesta con `http_code >= 400`.

| Métrica | Valor |
|---|---:|
| Peticiones totales | 39 |
| Errores (`>= 400`) | 3 |
| Errores intencionales (404 de control) | 3 |
| Errores no intencionales | 0 |

Fórmulas aplicadas:

```text
Tasa de error % = (errores >= 400 / peticiones totales) × 100 = (3 / 39) × 100 = 7,69 %
Tasa de error excluyendo la 404 intencional = ((3 - 3) / 39) × 100 = 0,00 %
```

## 5. Dónde tomar capturas

1. Abrir Chrome en `https://barberiakraft.pages.dev`, pulsar **F12** → pestaña **Network**.
2. Marcar **Disable cache**, mantener DevTools abierto y recargar con **Ctrl+R**.
3. Captura 1: la pestaña **Network** con las columnas **Status / Time / Size** visibles (incluir al menos `/`, un CSS/JS y el vídeo).
4. Click derecho sobre una fila → **Copy** → **Copy as cURL**; pegarlo en la evidencia como comando alternativo al `curl.exe` del apartado 2.
5. Captura 2: la consola de PowerShell mostrando la tabla `Format-Table`, el resumen global (`Peticiones`, `TasaError_pct`, `MediaTotal_s`, `P95Total_s`) y la ruta del CSV generado.

## 6. Hallazgos

Las 39 peticiones completaron dentro del límite `--max-time 25`. Las 12 rutas funcionales devolvieron 200 como código modal y la ruta de control devolvió 404, por lo que los 3 errores registrados corresponden íntegramente al control intencional (tasa real 0,00 %). El inicio fue la ruta más lenta (0,5529 s de media; p95 de 1,1279 s) y su TTFB medio (0,5528 s) prácticamente igualó el tiempo total; el patrón se repitió en las demás páginas HTML. Los recursos estáticos más ligeros (`pagina-inicio.js`, `landing.css`, `base.css`) estuvieron entre 0,1814 y 0,1908 s de media. `principal.mp4` descargó 2 213 250 bytes con 0,4102 s de media y 0,2075 s de TTFB, mientras que `logo.jpg` descargó 105 727 bytes con 0,4471 s. El tiempo de conexión medio por ruta osciló entre 0,0500 y 0,1156 s. Estos valores describen únicamente las 3 muestras por ruta ejecutadas en la fecha indicada; no incluyen navegación con caché, cookies ni interacción de usuario.
