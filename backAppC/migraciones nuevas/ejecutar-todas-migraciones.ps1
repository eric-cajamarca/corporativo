<#
.SYNOPSIS
  Ejecuta en orden todos los archivos .sql de esta carpeta contra SQL Server.

.DESCRIPTION
  Usa sqlcmd (incluido con SQL Server / SSMS). Los scripts pueden usar GO;
  cada archivo se ejecuta completo. Orden: nombre de archivo (A-Z).

.PARAMETER ServerInstance
  Instancia, ej: localhost, .\SQLEXPRESS, servidor\INSTANCIA

.PARAMETER Database
  Base de datos destino.

.PARAMETER TrustServerCertificate
  Añade -C a sqlcmd (útil con ODBC 18 / certificados autofirmados).

.EXAMPLE
  .\ejecutar-todas-migraciones.ps1 -ServerInstance ".\SQLEXPRESS" -Database "MiERP"

.EXAMPLE
  .\ejecutar-todas-migraciones.ps1 -ServerInstance "localhost" -Database "MiERP" -SqlUser "sa" -SqlPassword "***" -TrustServerCertificate
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $ServerInstance,

  [Parameter(Mandatory = $true)]
  [string] $Database,

  [string] $SqlUser,
  [string] $SqlPassword,

  [switch] $TrustServerCertificate
)

$ErrorActionPreference = "Stop"
$carpeta = $PSScriptRoot

$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if (-not $sqlcmd) {
  throw "No se encontró 'sqlcmd'. Instala las herramientas de línea de comandos de SQL Server o asegúrate de que sqlcmd esté en el PATH."
}

$archivos = Get-ChildItem -LiteralPath $carpeta -File -Filter "*.sql" | Sort-Object Name

if ($archivos.Count -eq 0) {
  Write-Warning "No hay archivos .sql en: $carpeta"
  exit 0
}

Write-Host "Carpeta: $carpeta"
Write-Host "Servidor: $ServerInstance | Base de datos: $Database"
Write-Host "Archivos a ejecutar: $($archivos.Count)`n"

$usarSqlAuth = [string]::IsNullOrWhiteSpace($SqlUser) -eq $false

foreach ($f in $archivos) {
  Write-Host ">>> $($f.Name)" -ForegroundColor Cyan

  $args = @(
    "-S", $ServerInstance,
    "-d", $Database,
    "-b",
    "-i", $f.FullName,
    "-I"
  )

  if ($TrustServerCertificate) {
    $args += "-C"
  }

  if ($usarSqlAuth) {
    if ([string]::IsNullOrWhiteSpace($SqlPassword)) {
      $secure = Read-Host "Contraseña para $SqlUser" -AsSecureString
      $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      $SqlPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    }
    $args += "-U", $SqlUser, "-P", $SqlPassword
  }
  else {
    $args += "-E"
  }

  & sqlcmd @args
  if ($LASTEXITCODE -ne 0) {
    throw "Falló la migración: $($f.Name) (código $LASTEXITCODE)"
  }
  Write-Host "    OK`n" -ForegroundColor Green
}

Write-Host "Todas las migraciones terminaron correctamente." -ForegroundColor Green
