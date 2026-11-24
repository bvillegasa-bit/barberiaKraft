# Métricas: cobertura de código y uso de CPU

## Entorno

- Node: `v24.11.1` (`node -v`)
- OS: `Microsoft Windows NT 10.0.26300.0` (Windows, PowerShell 5.1)
- Fecha: 2026-11-24
- Repo: `barberia-kraft` (sin dependencias nuevas)

## Resultados medidos

| Métrica | Valor obtenido | Comando exacto | Criterio/observación |
| --- | --- | --- | --- |
| Cobertura de líneas | 89.82 % | `node --test --experimental-test-coverage "tests/**/*.test.js"` | Fila `all files`; reporter nativo de Node 24 |
| Cobertura de ramas | 92.41 % | ídem | Fila `all files` |
| Cobertura de funciones | 87.07 % | ídem | Fila `all files` |
| Totales de cobertura | `all files \| 89.82 \| 92.41 \| 87.07` (26 archivos listados) | ídem | Conteos absolutos cubiertos/totales: **no disponible en este entorno** (el reporter solo imprime porcentajes por archivo y la fila agregada) |
| Tests totales | 276 tests, 276 pass, 0 fail, 59 suites | ídem | `duration_ms 2491.0861` |
| CPU media (tests) | 47.89 % | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\medir-cpu.ps1` | 9 muestras, 200 ms, 5 instancias node vistas |
| CPU máx (tests) | 155.11 % | ídem | % de un núcleo lógico; suma de instancias node |
| CPU p95 (tests) | 155.11 % | ídem | percentil sobre las 9 muestras |
| Duración (tests, script CPU) | 2.38 s | ídem | medida con StopWatch del script |
| CPU media / máx / p95 (bench) | 72.50 % / 130.24 % / 130.24 % | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\medir-cpu.ps1 -FilePath npm.cmd -ArgumentList @('run','bench') -Label bench` | 4 muestras, 200 ms |
| Duración (bench) | 1.23 s | ídem | < 30 s, por eso se midió |
| Resultado del bench | formulario registro: 2.758 µs/op = 0.0028 ms/op (27.6 ms / 10000) → CUMPLE | `npm run bench` | email 0.567 µs/op; teléfono 0.138 µs/op; contraseña 0.177 µs/op; checklist 0.781 µs/op |

## Comandos exactos para reproducir

Cobertura (el bloque crudo quedó en `docs/cobertura-raw.txt`):

```powershell
node --test --experimental-test-coverage "tests/**/*.test.js"
$raw = 'C:\Users\BERNAB~1.LAP\AppData\Local\Temp\opencode\coverage-exp-raw.txt'
& cmd.exe /c "node --test --experimental-test-coverage `"tests/**/*.test.js`" > `"$raw`" 2>&1"
$ini = (Select-String -LiteralPath $raw -Pattern 'start of coverage report' -Encoding UTF8).LineNumber
$fin = (Select-String -LiteralPath $raw -Pattern 'end of coverage report' -Encoding UTF8).LineNumber
(Get-Content $raw -Encoding UTF8)[($ini-1)..($fin-1)]
```

CPU (tests):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\medir-cpu.ps1
```

CPU (bench) y bench:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\medir-cpu.ps1 -FilePath npm.cmd -ArgumentList @('run','bench') -Label bench
npm run bench
```

Nota sobre flags: `--experimental-test-coverage` existe en Node 24.11.1 y fue usado. El flag alternativo no existe; error exacto: `node: bad option: --test-coverage` (exit 9).

Nota sobre el método de CPU: `Get-Counter '\Process(node*)\% Processor Time'` está disponible como cmdlet pero el contador no existe en este equipo; error exacto: `El objeto especificado no se encontró en el equipo.` Se usó el fallback documentado en `scripts/medir-cpu.ps1`: `Get-Process node` + delta de `TotalProcessorTime` (100 × delta CPU / tiempo transcurrido). No hizo falta el fallback global (proceso más cargado del sistema).

## Dónde tomar capturas

- Cobertura: terminal con la corrida de `node --test --experimental-test-coverage "tests/**/*.test.js"`, desde `ℹ start of coverage report` hasta `ℹ end of coverage report` (mismo bloque guardado en `docs/cobertura-raw.txt`).
- CPU: Administrador de tareas → Detalles → proceso `node.exe` durante la corrida (columna CPU), o la línea `Muestras %:` impresa por `scripts/medir-cpu.ps1`.
- Bench: salida de `npm run bench` con la tabla de `µs/op` y la línea `Criterio de aceptación`.

## Interpretación (solo números medidos)

Cobertura global: 89.82 % líneas, 92.41 % ramas, 87.07 % funciones en 26 archivos; 276/276 tests pasan en 2491.0861 ms. Durante los tests, CPU media 47.89 %, máx 155.11 %, p95 155.11 % en 9 muestras y 2.38 s. Durante el bench, CPU media 72.50 %, máx 130.24 %, p95 130.24 % en 4 muestras y 1.23 s. El bench valida un formulario en 0.0028 ms/op (2.758 µs/op) y cumple el criterio de < 1 ms. Conteos absolutos de líneas/ramas/funciones cubiertas: no disponible en este entorno.
