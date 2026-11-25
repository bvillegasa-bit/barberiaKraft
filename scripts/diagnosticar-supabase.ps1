param(
  [string]$AnonKey
)

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$proyecto = 'wrhzawuowdsfibotnhjk'
$baseUrl = "https://$proyecto.supabase.co"

function Obtener-ClaveLocal {
  $candidatos = @(
    (Join-Path $raiz 'pages\js\config.js'),
    (Join-Path $raiz 'dist\js\config.js'),
    (Join-Path $raiz 'pages\js\config.template.js')
  )
  $patron = 'SUPABASE_ANON_KEY\s*=\s*[''"]+([^''"]+)[''"]'
  foreach ($archivo in $candidatos) {
    if (-not (Test-Path -LiteralPath $archivo)) { continue }
    foreach ($linea in (Get-Content -LiteralPath $archivo)) {
      if ($linea -match $patron) {
        return [pscustomobject]@{ Archivo = $archivo; Clave = $Matches[1] }
      }
    }
  }
  return $null
}

function Decodificar-Jwt {
  param([string]$Token)
  $partes = $Token.Split('.')
  if ($partes.Count -lt 2) { return $null }
  $payload = $partes[1].Replace('-', '+').Replace('_', '/')
  while (($payload.Length % 4) -ne 0) { $payload += '=' }
  try {
    $bytes = [Convert]::FromBase64String($payload)
    return ([Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Formatear-Epoch {
  param($Valor)
  if ($null -eq $Valor -or $Valor -eq '') { return '—' }
  try {
    $fecha = (Get-Date '1970-01-01T00:00:00Z').ToUniversalTime().AddSeconds([double]$Valor)
    return "$Valor ($($fecha.ToString('yyyy-MM-dd HH:mm:ss')) UTC)"
  } catch {
    return [string]$Valor
  }
}

function Obtener-Codigo {
  param([string]$Cuerpo, [string]$Http)
  if ($Cuerpo -match '"code"\s*:\s*"([^"]+)"') { return $Matches[1] }
  if ($Cuerpo -match 'Invalid API key|JWT invalid|invalid claim|Invalid JWT') { return '401' }
  if ($Cuerpo -match '\b(PGRST205|42P01|42501|22P02|PGRST301)\b') { return $Matches[1] }
  if ($Http -eq '401') { return '401' }
  if ($Http -eq '200' -or $Http -eq '206') { return 'OK' }
  return '—'
}

function Interpretar {
  param([string]$Http, [string]$Codigo)
  if ($Codigo -eq '401' -or $Http -eq '401') { return '401: anon key invalida/placeholder; NO indica fallo de SQL' }
  if ($Codigo -eq 'PGRST205') { return 'PGRST205: tabla no expuesta en el esquema de la API (no creada o caché de esquema)' }
  if ($Codigo -eq '42P01') { return '42P01: la tabla no existe en la base de datos' }
  if ($Codigo -eq '42501') { return '42501: faltan grants/permisos para el rol' }
  if ($Codigo -eq 'OK') { return 'Accesible con esta key' }
  return 'Revisar el cuerpo de la respuesta'
}

$origen = 'parametro -AnonKey'
$clave = $AnonKey
if ([string]::IsNullOrWhiteSpace($clave)) {
  $local = Obtener-ClaveLocal
  if ($null -eq $local) {
    Write-Host 'No se encontro la anon key. Pasa -AnonKey "TU_KEY".'
    exit 1
  }
  $clave = $local.Clave
  $origen = $local.Archivo.Replace($raiz + [IO.Path]::DirectorySeparatorChar, '')
}
$clave = $clave.Trim()
$prefijo = $clave.Substring(0, [Math]::Min(20, $clave.Length)) + '...'
Write-Host "Proyecto esperado: $proyecto"
Write-Host "Clave (origen: $origen): $prefijo"

$esPlaceholder = $clave -match '__SUPABASE_ANON_KEY__|TU_ANON_KEY|TU_KEY|placeholder'
if ($esPlaceholder) {
  Write-Host 'PLACEHOLDER detectado: las llamadas daran 401. Esto NO significa que falten tablas.'
}

$claims = Decodificar-Jwt -Token $clave
if ($null -eq $claims) {
  Write-Host 'JWT: no decodificable (payload base64url ausente o invalido).'
  Write-Host 'ref: no disponible | role: no disponible | iat: no disponible | exp: no disponible'
} else {
  $ref = [string]$claims.ref
  $resultadoRef = if ($ref -eq $proyecto) { 'OK (coincide)' } else { "NO coincide (esperado $proyecto)" }
  $exp = Formatear-Epoch -Valor $claims.exp
  Write-Host "JWT ref: $ref -> $resultadoRef"
  Write-Host "JWT role: $($claims.role)"
  Write-Host "JWT iat: $(Formatear-Epoch -Valor $claims.iat)"
  Write-Host "JWT exp: $exp"
}

$consultas = @(
  @{ Nombre = 'auth/v1/health'; Ruta = '/auth/v1/health' },
  @{ Nombre = 'feriados'; Ruta = '/rest/v1/feriados?select=fecha&limit=1' },
  @{ Nombre = 'reservas'; Ruta = '/rest/v1/reservas?select=id&limit=1' },
  @{ Nombre = 'profiles'; Ruta = '/rest/v1/profiles?select=id&limit=1' }
)

$resultados = @()
foreach ($consulta in $consultas) {
  $url = $baseUrl + $consulta.Ruta
  $salida = & curl.exe -s -w "`nHTTP:%{http_code}`n" -H "apikey: $clave" -H "Authorization: Bearer $clave" $url 2>$null
  $texto = ($salida | Out-String)
  $http = '—'
  if ($texto -match 'HTTP:(\d{3})') { $http = $Matches[1] }
  $cuerpo = (($texto -split 'HTTP:\d{3}')[0]).Trim()
  if ($cuerpo.Length -gt 300) { $cuerpo = $cuerpo.Substring(0, 300) + '…' }
  $codigo = Obtener-Codigo -Cuerpo $cuerpo -Http $http
  $interpretacion = Interpretar -Http $http -Codigo $codigo

  Write-Host "`n[$($consulta.Nombre)] $url"
  Write-Host "HTTP: $http | codigo: $codigo"
  Write-Host "Cuerpo (max 300 chars): $cuerpo"

  $resultados += [pscustomobject]@{
    Nombre         = $consulta.Nombre
    HTTP           = $http
    'Codigo Supabase' = $codigo
    Interpretacion = $interpretacion
  }
}

Write-Host "`n=== RESUMEN ==="
$resultados | Format-Table -AutoSize -Wrap | Out-String -Width 200 | Write-Host

$con401 = @($resultados | Where-Object { $_.HTTP -eq '401' -or $_.'Codigo Supabase' -eq '401' }).Count
if ($con401 -gt 0) {
  Write-Host 'Hay respuestas 401: la clave no autentica. Corrige la key antes de concluir que faltan tablas.'
} else {
  Write-Host 'Sin 401: revisa PGRST205/42P01 para distinguir tabla no expuesta de tabla inexistente.'
}
