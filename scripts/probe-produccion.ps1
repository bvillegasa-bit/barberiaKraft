$ErrorActionPreference = 'SilentlyContinue'
$Base = 'https://barberiakraft.pages.dev'
$Rutas = @(
    '/',
    '/login',
    '/registro',
    '/reservar',
    '/ticket',
    '/admin/dashboard',
    '/css/base.css',
    '/css/landing.css',
    '/js/pagina-inicio.js',
    '/js/validacion/index.js',
    '/assets/img/logo.jpg',
    '/assets/video/principal.mp4',
    '/ruta-inexistente-prueba'
)
$Repeticiones = 3

function Convertir-Numero {
    param([string]$Valor)
    $numero = 0.0
    if ([double]::TryParse($Valor, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$numero)) {
        return $numero
    }
    return 0.0
}

$muestras = @()
foreach ($ruta in $Rutas) {
    for ($i = 1; $i -le $Repeticiones; $i++) {
        $salida = & curl.exe -s -o NUL -w "%{http_code}|%{time_total}|%{time_starttransfer}|%{time_connect}|%{size_download}" --max-time 25 "$Base$ruta" 2>$null
        $texto = ($salida | Out-String).Trim()
        $partes = $texto -split '\|'
        $codigo = 0
        if ($partes.Count -ge 5) {
            $codigo = [int](Convertir-Numero $partes[0].Trim())
        }
        $muestras += [pscustomobject]@{
            Ruta       = $ruta
            Repeticion = $i
            Codigo     = $codigo
            TimeTotal  = if ($partes.Count -ge 5) { Convertir-Numero $partes[1].Trim() } else { 0.0 }
            TTFB       = if ($partes.Count -ge 5) { Convertir-Numero $partes[2].Trim() } else { 0.0 }
            Connect    = if ($partes.Count -ge 5) { Convertir-Numero $partes[3].Trim() } else { 0.0 }
            Bytes      = if ($partes.Count -ge 5) { [long][Math]::Round((Convertir-Numero $partes[4].Trim()), 0) } else { 0 }
        }
    }
}

function Obtener-P95 {
    param([double[]]$Valores)
    $ordenados = @($Valores | Sort-Object)
    if ($ordenados.Count -eq 0) { return 0.0 }
    $indice = [int][Math]::Ceiling(0.95 * $ordenados.Count) - 1
    if ($indice -lt 0) { $indice = 0 }
    if ($indice -ge $ordenados.Count) { $indice = $ordenados.Count - 1 }
    return [double]$ordenados[$indice]
}

$resumenRuta = foreach ($ruta in $Rutas) {
    $grupo = @($muestras | Where-Object { $_.Ruta -eq $ruta })
    $codigoModal = [int](($grupo | Group-Object Codigo | Sort-Object Count -Descending | Select-Object -First 1).Name)
    $tiempos = @($grupo | ForEach-Object { [double]$_.TimeTotal })
    [pscustomobject]@{
        Ruta          = $ruta
        CodigoModal   = $codigoModal
        MediaTotal_s  = [Math]::Round(($grupo | Measure-Object -Property TimeTotal -Average).Average, 4)
        P95Total_s    = [Math]::Round((Obtener-P95 $tiempos), 4)
        MediaTTFB_s   = [Math]::Round(($grupo | Measure-Object -Property TTFB -Average).Average, 4)
        MediaConnect_s = [Math]::Round(($grupo | Measure-Object -Property Connect -Average).Average, 4)
        BytesMedios   = [long][Math]::Round(($grupo | Measure-Object -Property Bytes -Average).Average, 0)
    }
}

$total = $muestras.Count
$errores = @($muestras | Where-Object { $_.Codigo -ge 400 }).Count
$erroresIntencionales = @($muestras | Where-Object { $_.Ruta -eq '/ruta-inexistente-prueba' -and $_.Codigo -ge 400 }).Count
$erroresReales = $errores - $erroresIntencionales
$tiemposGlobales = @($muestras | ForEach-Object { [double]$_.TimeTotal })
$resumenGlobal = [pscustomobject]@{
    Peticiones            = $total
    Errores400plus        = $errores
    TasaError_pct         = [Math]::Round(100.0 * $errores / $total, 2)
    ErroresIntencionales  = $erroresIntencionales
    ErroresNoIntencionales = $erroresReales
    TasaErrorReal_pct     = [Math]::Round(100.0 * $erroresReales / $total, 2)
    MediaTotal_s          = [Math]::Round(($muestras | Measure-Object -Property TimeTotal -Average).Average, 4)
    P95Total_s            = [Math]::Round((Obtener-P95 $tiemposGlobales), 4)
}

$directorioDocs = Join-Path (Split-Path -Parent $PSScriptRoot) 'docs'
if (-not (Test-Path -LiteralPath $directorioDocs)) {
    New-Item -ItemType Directory -Path $directorioDocs | Out-Null
}
$csv = Join-Path $directorioDocs 'metricas-http.csv'
$resumenRuta | Export-Csv -LiteralPath $csv -NoTypeInformation -Encoding UTF8

$resumenRuta | Format-Table -AutoSize
$resumenGlobal | Format-List
"CSV: $csv"
