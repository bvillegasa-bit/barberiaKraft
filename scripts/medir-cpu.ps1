param(
  [string]$FilePath = 'node',
  [string[]]$ArgumentList = @('--test', '"tests/**/*.test.js"'),
  [int]$IntervalMs = 200,
  [string]$Label = 'tests'
)

# Method: Get-Counter '\Process(node*)\% Processor Time' (sum over node* instances,
# _Total excluded). This is % of one logical core, so values can exceed 100.
# Fallback 1: when the counter is unavailable, Get-Process node with delta of
# TotalProcessorTime: 100 * delta CPU seconds / elapsed wall seconds.
# Fallback 2: when no node instance exists during the window, the busiest system
# process is measured instead and its name is reported in the output.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('cpu-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
$outFile = Join-Path $tmp 'stdout.txt'
$errFile = Join-Path $tmp 'stderr.txt'

$counterOk = $false
$counterError = 'Get-Counter not available'
if (Get-Command Get-Counter -ErrorAction SilentlyContinue) {
  try {
    $null = Get-Counter -Counter '\Process(node*)\% Processor Time' -ErrorAction Stop
    $counterOk = $true
  } catch {
    $counterError = $_.Exception.Message
  }
}
if (-not $counterOk) {
  Write-Output "COUNTER_UNAVAILABLE: $counterError"
  Write-Output 'FALLBACK: Get-Process + TotalProcessorTime delta (100 * delta CPU / elapsed wall).'
}

try {
  $proc = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $root `
    -RedirectStandardOutput $outFile -RedirectStandardError $errFile -WindowStyle Hidden -PassThru
} catch {
  Write-Output "ERROR: could not start '$FilePath'. $_"
  exit 1
}

$samples = New-Object 'System.Collections.Generic.List[double]'
$nodeInstances = 0
$nodePrev = @{}
$allPrev = @{}
foreach ($p in @(Get-Process -ErrorAction SilentlyContinue)) {
  try { $allPrev[[string]$p.Id] = [double]$p.TotalProcessorTime.Ticks } catch { }
  if ($p.ProcessName -eq 'node') {
    try { $nodePrev[[string]$p.Id] = [double]$p.TotalProcessorTime.Ticks } catch { }
  }
}
$usedMethod = if ($counterOk) { "Get-Counter '\\Process(node*)\\% Processor Time' (sum of instances)" } else { 'Get-Process node + TotalProcessorTime delta (fallback)' }
$fallbackGlobal = $false
$fallbackName = ''
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$prevWall = 0.0

function Get-DeltaCpu([object[]]$processes, [hashtable]$previous, [double]$elapsed) {
  $totalTicks = 0.0
  foreach ($p in $processes) {
    try {
      $ticks = [double]$p.TotalProcessorTime.Ticks
      $key = [string]$p.Id
      if ($previous.ContainsKey($key)) { $totalTicks += $ticks - [double]$previous[$key] }
      $previous[$key] = $ticks
    } catch { }
  }
  if ($elapsed -le 0) { return 0.0 }
  return 100.0 * ($totalTicks / 10000000.0) / $elapsed
}

while ($true) {
  Start-Sleep -Milliseconds $IntervalMs
  $proc.Refresh()
  if ($proc.HasExited) { break }
  $now = $sw.Elapsed.TotalSeconds
  $value = $null

  if ($counterOk) {
    try {
      $counterSamples = @(Get-Counter -Counter '\Process(node*)\% Processor Time' -ErrorAction Stop |
        Select-Object -ExpandProperty CounterSamples |
        Where-Object { $_.InstanceName -notlike '_Total' })
      $values = @($counterSamples | ForEach-Object { [double]$_.CookedValue })
      if ($values.Count -gt 0) {
        $nodeInstances = [Math]::Max($nodeInstances, $values.Count)
        $value = ($values | Measure-Object -Sum).Sum
        $usedMethod = "Get-Counter '\\Process(node*)\\% Processor Time' (sum of $($values.Count) instance(s))"
      }
    } catch {
      $counterOk = $false
      $counterError = $_.Exception.Message
      Write-Output "COUNTER_FAILED_DURING_RUN: $counterError"
      Write-Output 'FALLBACK: Get-Process + TotalProcessorTime delta (100 * delta CPU / elapsed wall).'
    }
  }

  if ($null -eq $value) {
    $nodeProcs = @(Get-Process -Name node -ErrorAction SilentlyContinue)
    if ($nodeProcs.Count -gt 0) {
      $nodeInstances = [Math]::Max($nodeInstances, $nodeProcs.Count)
      $value = Get-DeltaCpu $nodeProcs $nodePrev ($now - $prevWall)
      $usedMethod = 'Get-Process node + TotalProcessorTime delta (fallback)'
    } else {
      $allProcs = @(Get-Process -ErrorAction SilentlyContinue)
      $elapsed = $now - $prevWall
      $bestName = ''
      $bestTicks = 0.0
      foreach ($p in $allProcs) {
        try {
          $ticks = [double]$p.TotalProcessorTime.Ticks
          $key = [string]$p.Id
          $delta = 0.0
          if ($allPrev.ContainsKey($key)) { $delta = $ticks - [double]$allPrev[$key] }
          $allPrev[$key] = $ticks
          if ($delta -gt $bestTicks) { $bestTicks = $delta; $bestName = $p.ProcessName }
        } catch { }
      }
      $value = if ($elapsed -gt 0) { 100.0 * ($bestTicks / 10000000.0) / $elapsed } else { 0.0 }
      $fallbackGlobal = $true
      $fallbackName = $bestName
      $usedMethod = "no node instance: busiest system process ($bestName) + TotalProcessorTime delta"
    }
  }

  $samples.Add([Math]::Max(0.0, $value))
  $prevWall = $now
  if ($proc.HasExited) { break }
}

$proc.WaitForExit()
$sw.Stop()
$sorted = @($samples | Sort-Object)
$count = $sorted.Count
$mean = if ($count -gt 0) { ($samples | Measure-Object -Average).Average } else { 0.0 }
$max = if ($count -gt 0) { $sorted[$count - 1] } else { 0.0 }
$p95Index = [Math]::Max(0, [Math]::Ceiling(0.95 * $count) - 1)
$p95 = if ($count -gt 0) { $sorted[$p95Index] } else { 0.0 }

Write-Output "=== CPU measurement: $Label ==="
Write-Output "Command: $FilePath $($ArgumentList -join ' ')"
Write-Output "Method: $usedMethod"
Write-Output "Node instances seen: $nodeInstances"
if ($fallbackGlobal) { Write-Output "WARNING: no node instance during the window; measured busiest system process ($fallbackName)." }
Write-Output "Samples: $count (interval $IntervalMs ms)"
Write-Output "Sample %: $(($samples | ForEach-Object { $_.ToString('F2') }) -join ', ')"
Write-Output ("CPU mean: {0:N2} %" -f $mean)
Write-Output ("CPU max:  {0:N2} %" -f $max)
Write-Output ("CPU p95:  {0:N2} %" -f $p95)
Write-Output ("Duration: {0:N2} s" -f $sw.Elapsed.TotalSeconds)

Write-Output '--- process output (last 8 lines) ---'
if (Test-Path -LiteralPath $outFile) { Get-Content -LiteralPath $outFile -Tail 8 -Encoding UTF8 }
if (Test-Path -LiteralPath $errFile) {
  $stderr = Get-Content -LiteralPath $errFile -Raw -Encoding UTF8
  if ($stderr -and $stderr.Trim()) { Write-Output '--- stderr ---'; Write-Output $stderr }
}
Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
