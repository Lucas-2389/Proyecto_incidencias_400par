# Creates private development configuration for a fresh clone. Never overwrites files.
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$MySqlPort = 3307
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$envFiles = @('.env', 'apps/api/.env', 'apps/admin/.env')
foreach ($envFile in $envFiles) {
    if (Test-Path -LiteralPath (Join-Path $workspaceRoot $envFile)) {
        throw "Ya existe $envFile. No se cambio ningun archivo. Usa tu configuracion actual; este script es para un clon nuevo."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $workspaceRoot "$envFile.example"))) {
        throw "Falta la plantilla $envFile.example. No se cambio ningun archivo."
    }
}

function New-LocalSecret {
    $buffer = New-Object byte[] 48
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($buffer)
}

$appPassword = New-LocalSecret
$rootPassword = New-LocalSecret
$jwtSecret = New-LocalSecret
$demoPassword = New-LocalSecret
$composeEnv = [IO.File]::ReadAllText((Join-Path $workspaceRoot '.env.example'))
$apiEnv = [IO.File]::ReadAllText((Join-Path $workspaceRoot 'apps/api/.env.example'))
$adminEnv = [IO.File]::ReadAllText((Join-Path $workspaceRoot 'apps/admin/.env.example'))
$composeEnv = $composeEnv.Replace('MYSQL_PASSWORD=change-me-local-app', "MYSQL_PASSWORD=$appPassword")
$composeEnv = $composeEnv.Replace('MYSQL_ROOT_PASSWORD=change-me-local-root', "MYSQL_ROOT_PASSWORD=$rootPassword")
$composeEnv = $composeEnv.Replace('MYSQL_PORT=3307', "MYSQL_PORT=$MySqlPort")
$apiEnv = $apiEnv.Replace('DB_PASSWORD=change-me-local-app', "DB_PASSWORD=$appPassword")
$apiEnv = $apiEnv.Replace('DB_PORT=3307', "DB_PORT=$MySqlPort")
$apiEnv = $apiEnv.Replace('JWT_SECRET=change-me-with-a-random-local-secret-at-least-32-characters', "JWT_SECRET=$jwtSecret")
$apiEnv = $apiEnv.Replace('DEMO_PASSWORD=', "DEMO_PASSWORD=$demoPassword")
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $workspaceRoot '.env'), $composeEnv, $utf8)
[IO.File]::WriteAllText((Join-Path $workspaceRoot 'apps/api/.env'), $apiEnv, $utf8)
[IO.File]::WriteAllText((Join-Path $workspaceRoot 'apps/admin/.env'), $adminEnv, $utf8)
Write-Output 'Creados .env, apps/api/.env y apps/admin/.env para MySQL Docker local.'
Write-Output 'Secretos aleatorios individuales guardados solo en esos archivos privados. No se imprimieron.'
Write-Output 'No se instalaron dependencias, no se inicio Docker y no se modifico ninguna base de datos.'
