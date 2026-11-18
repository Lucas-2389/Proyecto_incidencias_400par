param(
    [string]$DeviceId,
    [switch]$NoResident
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $projectRoot 'apps/mobile'

Get-Command adb -ErrorAction Stop | Out-Null
Get-Command flutter -ErrorAction Stop | Out-Null

if (-not $DeviceId) {
    $devices = @(adb devices | ForEach-Object {
        if ($_ -match '^(\S+)\s+device$') { $Matches[1] }
    })
    if ($devices.Count -ne 1) {
        throw 'Conecta y autoriza un telefono Android por USB, o indica -DeviceId si hay varios dispositivos.'
    }
    $DeviceId = $devices[0]
}

try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health/database' -TimeoutSec 5 | Out-Null
} catch {
    throw 'La API local no responde. Activa Docker e inicia npm.cmd start --prefix apps/api desde la raiz del proyecto.'
}

& adb -s $DeviceId reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) { throw 'No se pudo conectar el telefono a la API mediante el tunel USB.' }

$flutterArguments = @(
    'run', '-d', $DeviceId,
    '--dart-define=APP_ENV=development',
    '--dart-define=API_BASE_URL=http://127.0.0.1:3000/api/v1'
)
if ($NoResident) { $flutterArguments += '--no-resident' }

Push-Location $mobileRoot
try {
    Write-Host 'Iniciando mobile con la API local http://127.0.0.1:3000/api/v1'
    & flutter @flutterArguments
    if ($LASTEXITCODE -ne 0) { throw 'Flutter no pudo iniciar la aplicacion local.' }
} finally {
    Pop-Location
}
