const sql = require('mssql');

async function listarPorEmpresa(pool, idEmpresa) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Marcas WHERE idEmpresa = @idEmpresa');
  return result.recordset;
}

async function obtenerPorId(pool, idEmpresa, idMarca) {
  const result = await pool
    .request()
    .input('idMarca', sql.Int, idMarca)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Marcas WHERE idMarca = @idMarca AND idEmpresa = @idEmpresa');
  return result.recordset;
}

/**
 * Busca marca por nombre (trim + mayúsculas) dentro de la empresa.
 * @returns {Promise<{ idMarca: number, nombre: string }|null>}
 */
async function obtenerPorNombreNormalizado(pool, idEmpresa, nombreNormalizado) {
  const norm = String(nombreNormalizado || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!norm) return null;
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('norm', sql.VarChar(50), norm)
    .query(`
      SELECT TOP 1 idMarca, nombre
      FROM Marcas
      WHERE idEmpresa = @idEmpresa
        AND UPPER(LTRIM(RTRIM(nombre))) = @norm
      ORDER BY idMarca
    `);
  const row = result.recordset?.[0];
  if (!row) return null;
  return { idMarca: Number(row.idMarca), nombre: row.nombre };
}

/**
 * Obtiene o crea marca por nombre (idempotente por idEmpresa + nombre normalizado).
 * @returns {Promise<{ idMarca: number, nombre: string, creada: boolean }>}
 */
async function asegurarPorNombre(pool, idEmpresa, nombreDisplay) {
  const nombre = String(nombreDisplay || '')
    .trim()
    .slice(0, 50);
  if (!nombre) {
    throw new Error('nombre de marca es requerido');
  }
  const norm = nombre.toUpperCase().replace(/\s+/g, ' ');
  const existente = await obtenerPorNombreNormalizado(pool, idEmpresa, norm);
  if (existente) {
    return { ...existente, creada: false };
  }
  const insertado = await insertar(pool, idEmpresa, {
    nombre,
    descripcion: 'Creada automáticamente en importación de productos',
    contacto: '',
    paginaWeb: ''
  });
  if (!insertado?.idMarca) {
    // Carrera concurrente: reintentar lectura
    const reintento = await obtenerPorNombreNormalizado(pool, idEmpresa, norm);
    if (reintento) return { ...reintento, creada: false };
    throw new Error(`No se pudo crear la marca "${nombre}"`);
  }
  return { idMarca: Number(insertado.idMarca), nombre, creada: true };
}

async function insertar(pool, idEmpresa, payload) {
  const { nombre, descripcion, contacto, paginaWeb } = payload;
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombre', sql.VarChar(50), nombre)
    .input('descripcion', sql.VarChar(200), descripcion ?? '')
    .input('contacto', sql.VarChar(100), contacto ?? '')
    .input('paginaWeb', sql.VarChar(100), paginaWeb ?? '')
    .query(`
      INSERT INTO Marcas (idEmpresa, nombre, descripcion, contacto, paginaWeb, estado)
      OUTPUT INSERTED.idMarca AS idMarca
      VALUES (@idEmpresa, @nombre, @descripcion, @contacto, @paginaWeb, 1)
    `);
  return result.recordset?.[0] || null;
}

async function actualizar(pool, idEmpresa, idMarca, payload) {
  const { nombre, descripcion, contacto, paginaWeb } = payload;
  const result = await pool
    .request()
    .input('idMarca', sql.Int, idMarca)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombre', sql.VarChar(50), nombre)
    .input('descripcion', sql.VarChar(200), descripcion ?? '')
    .input('contacto', sql.VarChar(100), contacto ?? '')
    .input('paginaWeb', sql.VarChar(100), paginaWeb ?? '')
    .query(
      'UPDATE Marcas SET nombre = @nombre, descripcion = @descripcion, contacto = @contacto, paginaWeb = @paginaWeb WHERE idMarca = @idMarca AND idEmpresa = @idEmpresa'
    );
  return result.rowsAffected;
}

async function actualizarEstado(pool, idEmpresa, idMarca, estado) {
  const result = await pool
    .request()
    .input('idMarca', sql.Int, idMarca)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('estado', sql.Bit, estado)
    .query('UPDATE Marcas SET estado = @estado WHERE idMarca = @idMarca AND idEmpresa = @idEmpresa');
  return result.rowsAffected;
}

module.exports = {
  listarPorEmpresa,
  obtenerPorId,
  obtenerPorNombreNormalizado,
  asegurarPorNombre,
  insertar,
  actualizar,
  actualizarEstado
};
