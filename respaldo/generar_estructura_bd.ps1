# =============================================
# Generar estructura completa de la base de datos (solo schema, sin datos)
# Salida: un archivo .sql con CREATE TABLE, índices, FK, defaults, etc.
# Requiere: SQL Server con la base existente; PowerShell; módulo SqlServer (SMO).
# =============================================

param(
    [string]$ServerInstance = ".",           # Servidor, ej: ".\SQLEXPRESS" o "localhost"
    [string]$Database = "SistemaInventario",
    [string]$OutputFile = "estructura_bd_completa.sql",
    [switch]$UseWindowsAuth = $true,
    [string]$User,
    [string]$Password
)

$ErrorActionPreference = "Stop"
$outPath = Join-Path $PSScriptRoot $OutputFile

# Cargar SMO (viene con SSMS o módulo SqlServer)
$smoLoaded = $false
$smoPaths = @(
    "C:\Program Files\Microsoft SQL Server\160\SDK\Assemblies\Microsoft.SqlServer.Smo.dll",
    "C:\Program Files\Microsoft SQL Server\150\SDK\Assemblies\Microsoft.SqlServer.Smo.dll",
    "C:\Program Files (x86)\Microsoft SQL Server\160\SDK\Assemblies\Microsoft.SqlServer.Smo.dll",
    "C:\Program Files (x86)\Microsoft SQL Server\150\SDK\Assemblies\Microsoft.SqlServer.Smo.dll"
)
foreach ($path in $smoPaths) {
    if (Test-Path $path) {
        try {
            [System.Reflection.Assembly]::LoadFrom($path) | Out-Null
            $smoLoaded = $true
            break
        } catch { }
    }
}
if (-not $smoLoaded) {
    Write-Host "No se encontró Microsoft.SqlServer.Smo. Opciones:" -ForegroundColor Yellow
    Write-Host "  1. Instalar SQL Server Management Studio (incluye SMO)." -ForegroundColor Yellow
    Write-Host "  2. O usar el método manual en SSMS (ver README en esta carpeta)." -ForegroundColor Yellow
    Write-Host "  3. O instalar módulo: Install-Module -Name SqlServer -Scope CurrentUser" -ForegroundColor Yellow
    exit 1
}

Write-Host "Conectando a $ServerInstance, base: $Database ..." -ForegroundColor Cyan
$srv = New-Object Microsoft.SqlServer.Management.Smo.Server($ServerInstance)
if (-not $UseWindowsAuth -and $User) {
    $srv.ConnectionContext.LoginSecure = $false
    $srv.ConnectionContext.Login = $User
    $srv.ConnectionContext.Password = $Password
}
$db = $srv.Databases[$Database]
if (-not $db) {
    Write-Host "ERROR: Base de datos '$Database' no encontrada en el servidor." -ForegroundColor Red
    exit 1
}

$scripter = New-Object Microsoft.SqlServer.Management.Smo.Scripter($srv)
$scripter.Options.ToFileOnly = $true
$scripter.Options.FileName = $outPath
$scripter.Options.ScriptDrops = $false
$scripter.Options.IncludeHeaders = $true
$scripter.Options.AppendFile = $false
# Schema completo: índices, FK, defaults, checks
$scripter.Options.Indexes = $true
$scripter.Options.DriAll = $true
$scripter.Options.Triggers = $true
$scripter.Options.FullTextIndexes = $false

# Script en orden: tablas (con sus FKs según dependencias)
$tables = $db.Tables | Where-Object { $_.IsSystemObject -eq $false }
$count = 0
foreach ($t in $tables) {
    $scripter.Options.AppendFile = ($count -gt 0)
    $scripter.Script($t)
    $count++
    Write-Host "  Script: $($t.Schema).$($t.Name)" -ForegroundColor Gray
}

Write-Host "Estructura generada: $outPath" -ForegroundColor Green
Write-Host "Total tablas: $count" -ForegroundColor Green
