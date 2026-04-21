param(
  [Parameter(Mandatory = $true)][string]$SqlInstance,
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [Parameter(Mandatory = $true)][string]$RestoreAsDatabase,
  [string]$SqlUser = "",
  [string]$SqlPassword = ""
)

$query = @"
RESTORE VERIFYONLY
FROM DISK = N'$BackupFile';
"@

if ($SqlUser -and $SqlPassword) {
  sqlcmd -S $SqlInstance -U $SqlUser -P $SqlPassword -Q $query
} else {
  sqlcmd -S $SqlInstance -E -Q $query
}

if ($LASTEXITCODE -ne 0) {
  throw "VERIFYONLY falló para $BackupFile"
}

Write-Host "VERIFYONLY OK para $BackupFile"

# Restauración de ensayo (usar base temporal)
$restore = @"
RESTORE DATABASE [$RestoreAsDatabase]
FROM DISK = N'$BackupFile'
WITH REPLACE, RECOVERY, STATS = 10;
"@

if ($SqlUser -and $SqlPassword) {
  sqlcmd -S $SqlInstance -U $SqlUser -P $SqlPassword -Q $restore
} else {
  sqlcmd -S $SqlInstance -E -Q $restore
}

if ($LASTEXITCODE -ne 0) {
  throw "Restauración de ensayo falló."
}

Write-Host "Restauración de ensayo OK en base: $RestoreAsDatabase"

