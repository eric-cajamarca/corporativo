const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const dbConfig = require('../dbconfig');
const suscripcionCatalogoAdminService = require('./suscripcionCatalogoAdmin.service');
const gestoresRepository = require('../repositories/gestores.repository');

const BACKUP_TIMEOUT_MS = Math.min(
  Math.max(parseInt(process.env.BACKUP_SCRIPT_TIMEOUT_MS, 10) || 1200000, 60000),
  3600000
);

function mapConfigSistema(rows) {
  const map = {};
  for (const r of rows || []) {
    const k = String(r.clave || '').trim().toUpperCase();
    if (k) map[k] = r.valor != null ? String(r.valor).trim() : '';
  }
  return map;
}

function nombreBaseDatosSeguro(database) {
  const db = String(database || '').trim();
  if (!db || !/^[\w\-\[\]]+$/.test(db)) {
    throw new Error('BACKUP_DB_NOMBRE_INVALIDO');
  }
  return db.replace(/\]/g, ']]');
}

/** Ruta Windows para DISK = N'...' en T-SQL (barras invertidas). */
function rutaSqlBackup(filePath) {
  return path.resolve(filePath).replace(/\//g, '\\');
}

function asegurarDirectorio(dir) {
  const p = path.resolve(String(dir).trim());
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
  return p;
}

function extraerMensajeSqlError(err) {
  const parts = [];
  const push = (s) => {
    const t = String(s || '').trim();
    if (t && !parts.includes(t)) parts.push(t);
  };
  push(err?.message);
  if (Array.isArray(err?.precedingErrors)) {
    for (const pe of err.precedingErrors) {
      push(pe?.message);
      if (pe?.info?.message) push(pe.info.message);
    }
  }
  if (err?.originalError?.info?.message) push(err.originalError.info.message);
  if (err?.originalError?.message) push(err.originalError.message);
  return parts.join(' | ') || 'Error desconocido en BACKUP DATABASE';
}

function mensajeBackupAmigable(err, backupFilePath) {
  const raw = extraerMensajeSqlError(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes('access is denied') ||
    lower.includes('acceso denegado') ||
    lower.includes('operating system error 5') ||
    lower.includes('cannot open backup device') ||
    lower.includes('no se puede abrir el dispositivo')
  ) {
    return (
      `SQL Server no puede escribir en "${backupFilePath}". ` +
      'Conceda permiso de escritura en esa carpeta a la cuenta del servicio SQL Server ' +
      '(por ejemplo NT SERVICE\\MSSQL$SQLEXPRESS o NT AUTHORITY\\NETWORK SERVICE), ' +
      'o use una ruta bajo la carpeta Backup predeterminada de la instancia. Detalle: ' +
      raw
    );
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimeout')) {
    return (
      'El backup superó el tiempo de espera. Intente de nuevo o aumente BACKUP_SCRIPT_TIMEOUT_MS en .env. Detalle: ' +
      raw
    );
  }
  if (lower.includes('terminating abnormally')) {
    return (
      'BACKUP DATABASE se interrumpió (permisos de carpeta, disco lleno, ruta inválida o timeout). ' +
      `Ruta intentada: ${backupFilePath}. Detalle: ${raw}`
    );
  }
  return raw;
}

function crearPoolBackup() {
  const cfg = {
    user: dbConfig.user,
    password: dbConfig.password,
    server: dbConfig.server,
    database: dbConfig.database,
    options: {
      ...(dbConfig.options || {}),
      requestTimeout: BACKUP_TIMEOUT_MS,
      connectTimeout: Math.max(dbConfig.options?.connectTimeout || 30000, 60000)
    }
  };
  if (dbConfig.port) cfg.port = dbConfig.port;
  return new sql.ConnectionPool(cfg);
}

async function obtenerRutaBackupPredeterminadaSql(pool) {
  try {
    const r = await pool.request().query(`
      SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(4000)) AS ruta
    `);
    const row = r.recordset && r.recordset[0];
    const p = row?.ruta != null ? String(row.ruta).trim() : '';
    if (p) return path.resolve(p);
  } catch (_) {
    /* ignore */
  }
  return null;
}

async function ejecutarBackupQuery(pool, database, diskPathSql) {
  const db = nombreBaseDatosSeguro(database);
  const escaped = diskPathSql.replace(/'/g, "''");
  const intentos = [
    `BACKUP DATABASE [${db}] TO DISK = N'${escaped}' WITH INIT, COMPRESSION, STATS = 10`,
    `BACKUP DATABASE [${db}] TO DISK = N'${escaped}' WITH INIT, STATS = 10`,
    `BACKUP DATABASE [${db}] TO DISK = N'${escaped}' WITH INIT, CHECKSUM, STATS = 10`
  ];
  let lastErr;
  for (const q of intentos) {
    try {
      await pool.request().query(q);
      return;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '').toLowerCase();
      if (/compression/i.test(msg)) continue;
      if (/terminating abnormally/i.test(msg) && intentos.indexOf(q) < intentos.length - 1) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * BACKUP DATABASE con pool dedicado (no cierra el pool global de la API).
 */
async function ejecutarBackupDatabase(database, backupFilePath) {
  const diskPathSql = rutaSqlBackup(backupFilePath);
  const pool = crearPoolBackup();
  await pool.connect();
  try {
    await ejecutarBackupQuery(pool, database, diskPathSql);
  } catch (err) {
    const msg = mensajeBackupAmigable(err, diskPathSql);
    const lower = msg.toLowerCase();
    const esPermisoORuta =
      lower.includes('cannot open') ||
      lower.includes('access') ||
      lower.includes('dispositivo') ||
      lower.includes('permiso');
    if (esPermisoORuta) {
      const defPath = await obtenerRutaBackupPredeterminadaSql(pool);
      if (defPath && path.resolve(defPath) !== path.resolve(path.dirname(diskPathSql))) {
        asegurarDirectorio(defPath);
        const altFile = path.join(defPath, path.basename(backupFilePath));
        const altSql = rutaSqlBackup(altFile);
        try {
          await ejecutarBackupQuery(pool, database, altSql);
          err.rutaAlternativaUsada = altFile;
          return altFile;
        } catch (err2) {
          throw new Error(mensajeBackupAmigable(err2, altSql));
        }
      }
    }
    throw new Error(msg);
  } finally {
    try {
      await pool.close();
    } catch (_) {
      /* ignore */
    }
  }
  return backupFilePath;
}

function runChild(command, args, timeoutMs = BACKUP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('BACKUP_TIMEOUT'));
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (command === 'robocopy') {
        if (code < 8) resolve();
        else reject(new Error((stderr || `robocopy código ${code}`).trim().slice(0, 1500)));
        return;
      }
      if (code !== 0) {
        reject(new Error((stderr || `${command} código ${code}`).trim().slice(0, 1500)));
        return;
      }
      resolve();
    });
  });
}

async function copiarASecundaria(backupDir, secondaryDir, fileName) {
  if (!secondaryDir) return;
  asegurarDirectorio(secondaryDir);
  await runChild('robocopy', [backupDir, secondaryDir, fileName, '/Z', '/R:2', '/W:5', '/NFL', '/NDL', '/NJH', '/NJS']);
}

async function copiarAGoogleDrive(backupFile, gdriveRemote) {
  if (!gdriveRemote) return;
  await runChild('rclone', ['copy', backupFile, gdriveRemote, '--stats-one-line'], 600000);
}

async function ejecutarBackupAhora(pool, user, overrides = {}) {
  if (!user || !user.empresa) {
    throw new Error('USUARIO_NO_VALIDO');
  }
  const autorizado = await suscripcionCatalogoAdminService.puedeEditarCatalogoPlanes(pool, user);
  if (!autorizado) {
    throw new Error('NO_AUTORIZADO_CONFIG_SISTEMA');
  }
  if (process.platform !== 'win32') {
    throw new Error('BACKUP_SOLO_WINDOWS');
  }

  const rows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, user.empresa);
  const cfg = mapConfigSistema(rows);
  const backupDir = asegurarDirectorio(
    overrides.rutaBackupLocal != null && String(overrides.rutaBackupLocal).trim()
      ? overrides.rutaBackupLocal
      : cfg.SISTEMA_BACKUP_RUTA_LOCAL || 'D:\\sql_backups'
  );
  const secondaryDir = String(
    overrides.rutaBackupSecundaria != null
      ? overrides.rutaBackupSecundaria
      : cfg.SISTEMA_BACKUP_RUTA_SECUNDARIA || ''
  ).trim();
  const gdriveRemote = String(
    overrides.googleDriveRemote != null
      ? overrides.googleDriveRemote
      : cfg.SISTEMA_BACKUP_GOOGLE_DRIVE_REMOTE || ''
  ).trim();

  const database = process.env.DB_NAME;
  if (!database) {
    throw new Error('BACKUP_DB_ENV_INCOMPLETA');
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const safeDb = String(database).replace(/[^\w\-]/g, '_');
  const fileName = `${safeDb}_${stamp}.bak`;
  let backupFile = path.join(backupDir, fileName);

  const rutaReal = await ejecutarBackupDatabase(database, backupFile);
  backupFile = rutaReal || backupFile;

  if (!fs.existsSync(backupFile)) {
    throw new Error(
      `El comando BACKUP finalizó pero no aparece el archivo en disco. ` +
        'Verifique permisos de la cuenta del servicio SQL Server en la carpeta destino.'
    );
  }

  const backupDirEfectivo = path.dirname(backupFile);
  const fileNameEfectivo = path.basename(backupFile);

  if (secondaryDir) {
    await copiarASecundaria(backupDirEfectivo, secondaryDir, fileNameEfectivo);
  }
  if (gdriveRemote) {
    try {
      await copiarAGoogleDrive(backupFile, gdriveRemote);
    } catch (err) {
      console.error('contexto: backup Google Drive (rclone):', err.message);
      return {
        success: true,
        archivo: backupFile,
        rutaLocal: backupDirEfectivo,
        advertencia: 'Backup local OK; falló copia a Google Drive: ' + err.message,
        mensaje: `Backup generado: ${backupFile} (advertencia en copia a nube)`
      };
    }
  }

  return {
    success: true,
    archivo: backupFile,
    rutaLocal: backupDirEfectivo,
    mensaje: `Backup generado: ${backupFile}`
  };
}

module.exports = {
  ejecutarBackupAhora
};
