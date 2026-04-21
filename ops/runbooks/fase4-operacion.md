## Fase 4 Operación (Deploy, Backups, Onboarding)

### 1) CI/CD monorepo
- Workflow: `.github/workflows/monorepo-ci-cd.yml`
- Ejecuta: instalación dependencias, build de `adminSPA`, validación carga de `backAppC` y `pdf-backend`, empaquetado de artefactos.
- Deploy opcional por SSH con secretos:
  - `DEPLOY_BACKAPP_HOST`, `DEPLOY_BACKAPP_USER`, `DEPLOY_BACKAPP_SSH_KEY`, `DEPLOY_BACKAPP_TARGET`
  - `DEPLOY_PDF_HOST`, `DEPLOY_PDF_USER`, `DEPLOY_PDF_SSH_KEY`, `DEPLOY_PDF_TARGET`

### 2) Backups SQL Server
- Script backup: `ops/sql-backup/backup_sqlserver.ps1`
- Script ensayo restore: `ops/sql-backup/restore_verify_sqlserver.ps1`
- Backup soporta:
  - ruta local,
  - copia secundaria (otro servidor/NAS),
  - subida a Google Drive vía `rclone`.

#### Ejemplo diario (Task Scheduler / cron + pwsh)
```powershell
pwsh -File "ops/sql-backup/backup_sqlserver.ps1" `
  -SqlInstance "localhost" `
  -Database "ERP_MAIN" `
  -BackupDir "D:\sql_backups" `
  -SecondaryBackupDir "\\BACKUP-SRV\sql_backups" `
  -GoogleDriveRemote "gdrive:erp-backups/sql" `
  -RetentionDays 30
```

#### Ensayo semanal de restauración
```powershell
pwsh -File "ops/sql-backup/restore_verify_sqlserver.ps1" `
  -SqlInstance "localhost" `
  -BackupFile "D:\sql_backups\ERP_MAIN_20260420_010000.bak" `
  -RestoreAsDatabase "ERP_MAIN_RESTORE_TEST"
```

### 3) Onboarding automatizado
- Job: `backAppC/jobs/onboardingAutomation.job.js`
- Intervalo por env: `ONBOARDING_AUTOMATION_INTERVAL_MS` (default 1h).
- Envía correos (si SMTP configurado):
  - `BIENVENIDA`
  - `FALTA_SUNAT`
  - `ACTIVA_PLAN`
- Bitácora en BD: `OnboardingAutomationLog` (migración `saas_onboarding_operativo_fase4.sql`).

### 4) Conciliación Culqi (sin copy/paste manual)
- API JSON: `GET /api/suscripcion/conciliacion/culqi`
- Export CSV: `GET /api/suscripcion/conciliacion/culqi.csv`
- Filtros query:
  - `fechaDesde=YYYY-MM-DD`
  - `fechaHasta=YYYY-MM-DD`
  - `estado=PAGADO|PENDIENTE|FALLIDO`
- Acceso: superAdmin de empresa principal.

### 5) Checklist operativo (release)
1. Ejecutar migraciones nuevas.
2. Confirmar health:
   - `GET /health` en `backAppC`
   - `GET /health` en `pdf-backend`
3. Confirmar job onboarding activo (logs de servidor).
4. Validar backup diario y restauración semanal en bitácora.
5. Exportar conciliación CSV y cruzar con contabilidad.

### 6) Configuración en UI (Configuración > Sistema)
Solo `superAdmin` de la empresa principal puede editar:
- Backup automático y frecuencia
- Ruta backup local
- Ruta secundaria (otro servidor)
- Remote Google Drive (rclone)
- Ensayo semanal de restauración
- Habilitar conciliación Culqi CSV

