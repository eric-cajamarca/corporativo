# Scripts de generación de paquetes (copiar a archivos `.ps1` / `.cmd`)

> En entornos donde solo se pueden versionar Markdown, este documento contiene el **cuerpo completo** de los generadores. Creá los archivos en `deploy/` con los nombres indicados, o ejecutá estos bloques desde Agent mode.

---

## Raíz del repo: `.gitignore` (agregar estas líneas)

```gitignore
# Artefactos generados por deploy/build-*.ps1
deploy/out/
```

---

## `deploy/build-first-install.ps1`

```powershell
param(
  [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutName = "EFAF-first-install-$Version-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$OutDir = Join-Path $RepoRoot "deploy\out\$OutName"
$AppDir = Join-Path $OutDir "app"

function Assert-Robocopy {
  param([int]$code)
  if ($code -ge 8) { throw "robocopy fallo con codigo $code" }
}

Write-Host "== EFAF: primera instalacion -> $OutDir" -ForegroundColor Cyan

Push-Location (Join-Path $RepoRoot "adminSPA")
try {
  if (-not (Test-Path "node_modules")) { npm ci }
  npx --yes ng build --configuration production
} finally { Pop-Location }

$dist = Join-Path $RepoRoot "adminSPA\dist\admin-spa"
if (-not (Test-Path $dist)) { throw "No existe salida Angular: $dist" }

New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "backAppC") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "pdf-backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "www") | Out-Null

& robocopy (Join-Path $RepoRoot "backAppC") (Join-Path $AppDir "backAppC") /E /XD node_modules .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Assert-Robocopy $LASTEXITCODE

& robocopy (Join-Path $RepoRoot "pdf-backend") (Join-Path $AppDir "pdf-backend") /E /XD node_modules .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Assert-Robocopy $LASTEXITCODE

if (Test-Path (Join-Path $AppDir "backAppC\.env")) { Remove-Item (Join-Path $AppDir "backAppC\.env") -Force }
if (Test-Path (Join-Path $AppDir "pdf-backend\.env")) { Remove-Item (Join-Path $AppDir "pdf-backend\.env") -Force }

& robocopy $dist (Join-Path $AppDir "www") /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Assert-Robocopy $LASTEXITCODE

Push-Location (Join-Path $AppDir "backAppC"); npm ci --omit=dev; Pop-Location
Push-Location (Join-Path $AppDir "pdf-backend"); npm ci --omit=dev; Pop-Location

$sqlOut = Join-Path $OutDir "sql"
New-Item -ItemType Directory -Force -Path $sqlOut | Out-Null
$boot = Join-Path $PSScriptRoot "sql\bootstrap"
if (Test-Path $boot) {
  & robocopy $boot (Join-Path $sqlOut "bootstrap") /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  Assert-Robocopy $LASTEXITCODE
}
$tpl = Join-Path $PSScriptRoot "sql\database-template"
if (Test-Path $tpl) {
  & robocopy $tpl (Join-Path $sqlOut "database-template") /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  Assert-Robocopy $LASTEXITCODE
}

@{
  kind               = "first-install"
  version            = $Version
  generatedAt        = (Get-Date).ToString("o")
  appRelative        = "app"
  sqlBootstrap       = "sql/bootstrap"
  databaseTemplate   = "sql/database-template"
  databaseTemplateNote = "Una empresa, sin productos ni movimientos; solo estructura/minimo para primer arranque"
} | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $OutDir "manifest-first-install.json")

@"
EFAF primera instalacion
version=$Version
fecha=$(Get-Date -Format o)
repo=$RepoRoot
"@ | Set-Content -Encoding UTF8 (Join-Path $OutDir "BUILD_INFO.txt")

Write-Host "Listo: $OutDir" -ForegroundColor Green
```

---

## `deploy/build-update.ps1`

```powershell
param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$migSrc = Join-Path $PSScriptRoot "sql\migrations\$Version"
if (-not (Test-Path $migSrc)) { throw "No existe carpeta de migraciones: $migSrc" }
$sqlFiles = Get-ChildItem -Path $migSrc -Filter *.sql -File
if ($sqlFiles.Count -eq 0) { throw "La carpeta de migraciones no tiene archivos .sql: $migSrc" }

$Stage = Join-Path $RepoRoot "deploy\out\_staging-update-$Version"
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
$AppDir = Join-Path $Stage "app"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null

function Assert-Robocopy {
  param([int]$code)
  if ($code -ge 8) { throw "robocopy fallo con codigo $code" }
}

Write-Host "== EFAF: actualizacion $Version (solo migraciones en deploy\sql\migrations\$Version)" -ForegroundColor Cyan

Push-Location (Join-Path $RepoRoot "adminSPA")
try {
  if (-not (Test-Path "node_modules")) { npm ci }
  npx --yes ng build --configuration production
} finally { Pop-Location }

$dist = Join-Path $RepoRoot "adminSPA\dist\admin-spa"
if (-not (Test-Path $dist)) { throw "No existe salida Angular: $dist" }

New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "backAppC") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "pdf-backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "www") | Out-Null

& robocopy (Join-Path $RepoRoot "backAppC") (Join-Path $AppDir "backAppC") /E /XD node_modules .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Assert-Robocopy $LASTEXITCODE
& robocopy (Join-Path $RepoRoot "pdf-backend") (Join-Path $AppDir "pdf-backend") /E /XD node_modules .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Assert-Robocopy $LASTEXITCODE
if (Test-Path (Join-Path $AppDir "backAppC\.env")) { Remove-Item (Join-Path $AppDir "backAppC\.env") -Force }
if (Test-Path (Join-Path $AppDir "pdf-backend\.env")) { Remove-Item (Join-Path $AppDir "pdf-backend\.env") -Force }

& robocopy $dist (Join-Path $AppDir "www") /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
Assert-Robocopy $LASTEXITCODE

Push-Location (Join-Path $AppDir "backAppC"); npm ci --omit=dev; Pop-Location
Push-Location (Join-Path $AppDir "pdf-backend"); npm ci --omit=dev; Pop-Location

$migDst = Join-Path $Stage "sql\migrations\$Version"
New-Item -ItemType Directory -Force -Path $migDst | Out-Null
Copy-Item -Path (Join-Path $migSrc "*.sql") -Destination $migDst -Force

@{
  kind             = "app-update"
  version          = $Version
  generatedAt      = (Get-Date).ToString("o")
  appRelative      = "app"
  migrationsRelative = "sql/migrations/$Version"
  migrationFiles   = @($sqlFiles.Name)
} | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $Stage "manifest-update.json")

$zipName = "EFAF-app-$Version.zip"
$zipPath = Join-Path $RepoRoot "deploy\out\$zipName"
New-Item -ItemType Directory -Force -Path (Split-Path $zipPath) | Out-Null
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $zipPath -Force
Remove-Item $Stage -Recurse -Force

Write-Host "Listo: $zipPath" -ForegroundColor Green
```

---

## `deploy/build-first-install.cmd`

```bat
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-first-install.ps1" %*
endlocal
```

---

## `deploy/build-update.cmd`

```bat
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-update.ps1" %*
endlocal
```

Uso:

```bat
deploy\build-update.cmd -Version 1.2.0
```

---

## Notas rápidas

- **Primera instalación:** colocá `Template.bacpac` / `Template.bak` en `deploy/sql/database-template/` cuando los tengas (una empresa, sin productos ni movimientos).
- **Actualización:** creá `deploy/sql/migrations/<version>/` con los `.sql` nuevos antes de ejecutar `build-update`.
