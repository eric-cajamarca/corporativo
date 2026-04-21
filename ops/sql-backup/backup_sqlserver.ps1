param(
  [Parameter(Mandatory = $true)][string]$SqlInstance,
  [Parameter(Mandatory = $true)][string]$Database,
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [string]$SecondaryBackupDir = "",
  [string]$GoogleDriveRemote = "",
  [int]$RetentionDays = 30,
  [string]$SqlUser = "",
  [string]$SqlPassword = ""
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "$Database`_$timestamp.bak"

if (!(Test-Path $BackupDir)) {
  New-Item -Path $BackupDir -ItemType Directory | Out-Null
}

$query = @"
BACKUP DATABASE [$Database]
TO DISK = N'$backupFile'
WITH COPY_ONLY, CHECKSUM, INIT, STATS = 10;
"@

if ($SqlUser -and $SqlPassword) {
  sqlcmd -S $SqlInstance -U $SqlUser -P $SqlPassword -Q $query
} else {
  sqlcmd -S $SqlInstance -E -Q $query
}

if ($LASTEXITCODE -ne 0) {
  throw "Backup SQL falló. Revise permisos/credenciales."
}

Write-Host "Backup generado: $backupFile"

if ($SecondaryBackupDir) {
  if (!(Test-Path $SecondaryBackupDir)) {
    New-Item -Path $SecondaryBackupDir -ItemType Directory | Out-Null
  }
  robocopy $BackupDir $SecondaryBackupDir "*.bak" /Z /R:3 /W:5 | Out-Null
  Write-Host "Copia secundaria completada en: $SecondaryBackupDir"
}

if ($GoogleDriveRemote) {
  rclone copy $BackupDir $GoogleDriveRemote --include "*.bak"
  if ($LASTEXITCODE -ne 0) {
    throw "Subida a Google Drive falló (rclone)."
  }
  Write-Host "Copia Google Drive completada en: $GoogleDriveRemote"
}

# Retención local
Get-ChildItem -Path $BackupDir -Filter "*.bak" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

