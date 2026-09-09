const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');

function construirInClauseUuid(request, ids, prefix) {
  const valid = (ids || []).filter((id) => id && String(id).trim());
  if (!valid.length) {
    return null;
  }
  return valid
    .map((id, i) => {
      const key = `${prefix}${i}`;
      request.input(key, sql.UniqueIdentifier, String(id).trim());
      return `@${key}`;
    })
    .join(', ');
}

async function getAll(idEmpresa) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
            SELECT 
                l.idLote, 
                l.idEmpresa, 
                l.idProducto, 
                l.idSucursal, 
                l.numeroLote,
                l.costoUnitario, 
                l.cantidadIngresada, 
                l.cantidadDisponible,
                ISNULL(l.activo, 1) AS activo,
                CONVERT(VARCHAR(19), l.fechaIngreso, 120) AS fechaIngreso,
                CONVERT(VARCHAR(19), l.fechaVencimiento, 120) AS fechaVencimiento,
                p.descripcion AS nombreProducto,
                p.codigo AS codigoProducto,
                s.nombre AS nombreSucursal,
                ISNULL(e.alias, ISNULL(e.nombreComercial, e.razon_Social)) AS aliasEmpresa
            FROM Lotes l
            LEFT JOIN Productos p ON l.idProducto = p.idProducto AND p.idEmpresa = l.idEmpresa
            LEFT JOIN Sucursal s ON l.idSucursal = s.idSucursal
            LEFT JOIN Empresas e ON e.idEmpresa = l.idEmpresa
            WHERE l.idEmpresa = @idEmpresa 
            ORDER BY l.fechaIngreso DESC
        `);
    return result.recordset;
  });
}

async function getAllPorEmpresas(idsEmpresa) {
  return withPool(async (pool) => {
    const request = pool.request();
    const inClause = construirInClauseUuid(request, idsEmpresa, 'idEmpresaLote');
    if (!inClause) {
      return [];
    }
    const result = await request.query(`
            SELECT 
                l.idLote, 
                l.idEmpresa, 
                l.idProducto, 
                l.idSucursal, 
                l.numeroLote,
                l.costoUnitario, 
                l.cantidadIngresada, 
                l.cantidadDisponible,
                ISNULL(l.activo, 1) AS activo,
                CONVERT(VARCHAR(19), l.fechaIngreso, 120) AS fechaIngreso,
                CONVERT(VARCHAR(19), l.fechaVencimiento, 120) AS fechaVencimiento,
                p.descripcion AS nombreProducto,
                p.codigo AS codigoProducto,
                s.nombre AS nombreSucursal,
                ISNULL(e.alias, ISNULL(e.nombreComercial, e.razon_Social)) AS aliasEmpresa
            FROM Lotes l
            LEFT JOIN Productos p ON l.idProducto = p.idProducto AND p.idEmpresa = l.idEmpresa
            LEFT JOIN Sucursal s ON l.idSucursal = s.idSucursal
            LEFT JOIN Empresas e ON e.idEmpresa = l.idEmpresa
            WHERE l.idEmpresa IN (${inClause})
            ORDER BY e.alias, l.fechaIngreso DESC
        `);
    return result.recordset;
  });
}

async function getById(idLote, idEmpresa) {
  return withPool(async (pool) => {
    try {
      const req = pool.request().input('idLote', sql.UniqueIdentifier, idLote);
      const whereEmpresa = idEmpresa ? ' AND l.idEmpresa = @idEmpresa' : '';
      if (idEmpresa) req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
      const result = await req.query(`
                SELECT 
                    idLote, 
                    idEmpresa, 
                    idProducto, 
                    idSucursal, 
                    CONVERT(DECIMAL(18,6), costoUnitario) AS costoUnitario,
                    CONVERT(DECIMAL(18,2), cantidadIngresada) AS cantidadIngresada,
                    CONVERT(DECIMAL(18,2), cantidadDisponible) AS cantidadDisponible,
                    ISNULL(activo, 1) AS activo,
                    l.numeroLote,
                    CONVERT(VARCHAR(10), l.fechaVencimiento, 23) AS fechaVencimiento
                FROM Lotes l
                WHERE l.idLote = @idLote${whereEmpresa}
            `);
      const row = result.recordset && result.recordset[0];
      if (!row) return null;
      return {
        idLote: row.idLote,
        idEmpresa: row.idEmpresa,
        idProducto: row.idProducto,
        idSucursal: row.idSucursal,
        costoUnitario: row.costoUnitario != null ? Number(row.costoUnitario) : 0,
        cantidadIngresada: row.cantidadIngresada != null ? Number(row.cantidadIngresada) : 0,
        cantidadDisponible: row.cantidadDisponible != null ? Number(row.cantidadDisponible) : 0,
        activo: row.activo !== false && row.activo !== 0,
        numeroLote: row.numeroLote || '',
        fechaVencimiento: row.fechaVencimiento || null
      };
    } catch (err) {
      console.error('lotes.repository getById error:', err.message);
      throw err;
    }
  });
}

async function getBySucursal(idEmpresa, idSucursal) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idSucursal', sql.UniqueIdentifier, idSucursal)
      .query('SELECT * FROM Lotes WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal');
    return result.recordset;
  });
}

async function create(loteData) {
  const { idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible } = loteData;
  const numLote =
    loteData.numeroLote != null && String(loteData.numeroLote).trim() !== ''
      ? String(loteData.numeroLote).trim().slice(0, 50)
      : null;
  const fechaVenc =
    loteData.fechaVencimiento != null && String(loteData.fechaVencimiento).trim() !== ''
      ? loteData.fechaVencimiento
      : null;

  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('idSucursal', sql.UniqueIdentifier, idSucursal)
      .input('costoUnitario', sql.Decimal(18, 6), costoUnitario)
      .input('cantidadIngresada', sql.Int, cantidadIngresada)
      .input('cantidadDisponible', sql.Int, cantidadDisponible)
      .input('numeroLote', sql.VarChar(50), numLote)
      .input('fechaVencimiento', sql.DateTime, fechaVenc)
      .query(`INSERT INTO Lotes (idLote, idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible, numeroLote, fechaVencimiento)
                OUTPUT INSERTED.idLote
                VALUES (NEWID(), @idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible, @numeroLote, @fechaVencimiento)`);
    return {
      idLote: result.recordset && result.recordset[0] ? result.recordset[0].idLote : null
    };
  });
}

async function update(idLote, idEmpresa, loteData) {
  return withPool(async (pool) => {
    const existente = await getById(idLote, idEmpresa);
    if (!existente) {
      throw new Error('Lote no encontrado');
    }

    const costoUnitario =
      loteData.costoUnitario != null ? Number(loteData.costoUnitario) : existente.costoUnitario;
    if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
      throw new Error('El costo unitario debe ser un número mayor o igual a 0');
    }

    let cantidadDisponible = existente.cantidadDisponible;
    if (loteData.cantidadDisponible != null && loteData.cantidadDisponible !== '') {
      cantidadDisponible = Number(loteData.cantidadDisponible);
    } else if (loteData.cantidadIngresada != null && loteData.cantidadIngresada !== '') {
      cantidadDisponible = Number(loteData.cantidadIngresada);
    }
    if (!Number.isFinite(cantidadDisponible)) {
      throw new Error('La cantidad disponible no es válida');
    }

    const activo =
      loteData.activo != null
        ? (loteData.activo === true || loteData.activo === 1 || loteData.activo === '1' || loteData.activo === 'true')
        : existente.activo;

    const numeroLote =
      loteData.numeroLote != null
        ? (String(loteData.numeroLote).trim().slice(0, 50) || null)
        : (existente.numeroLote || null);
    const fechaVencimiento =
      loteData.fechaVencimiento != null
        ? (String(loteData.fechaVencimiento).trim() || null)
        : existente.fechaVencimiento;

    await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('costoUnitario', sql.Decimal(18, 6), costoUnitario)
      .input('cantidadDisponible', sql.Decimal(18, 2), cantidadDisponible)
      .input('activo', sql.Bit, activo ? 1 : 0)
      .input('numeroLote', sql.VarChar(50), numeroLote)
      .input('fechaVencimiento', sql.DateTime, fechaVencimiento)
      .query(`
        UPDATE Lotes
        SET costoUnitario = @costoUnitario,
            cantidadDisponible = @cantidadDisponible,
            activo = @activo,
            numeroLote = @numeroLote,
            fechaVencimiento = @fechaVencimiento
        WHERE idLote = @idLote AND idEmpresa = @idEmpresa
      `);

    return {
      ...existente,
      costoUnitario,
      cantidadDisponible,
      activo,
      numeroLote,
      fechaVencimiento
    };
  });
}

async function deleted(idLote) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .query('DELETE FROM Lotes WHERE idLote = @idLote');
    return result;
  });
}

async function listarCaducidadEmpresa(pool, idEmpresa, fechaHoy, diasVentana) {
  const dias = Number.isFinite(Number(diasVentana)) ? Math.max(0, parseInt(String(diasVentana), 10)) : 30;
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaHoy', sql.Date, fechaHoy)
    .input('diasVentana', sql.Int, dias)
    .query(`
      SELECT
        l.idLote,
        l.numeroLote,
        CONVERT(DECIMAL(18, 2), l.cantidadDisponible) AS cantidadDisponible,
        CONVERT(VARCHAR(10), l.fechaVencimiento, 23) AS fechaVencimiento,
        DATEDIFF(DAY, @fechaHoy, CONVERT(DATE, l.fechaVencimiento)) AS dias,
        RTRIM(LTRIM(ISNULL(p.Codigo, ''))) AS codigo,
        RTRIM(LTRIM(ISNULL(p.descripcion, ''))) AS descripcion,
        RTRIM(LTRIM(ISNULL(s.nombre, ''))) AS sucursal
      FROM Lotes l
      LEFT JOIN Productos p ON p.idProducto = l.idProducto AND p.idEmpresa = l.idEmpresa
      LEFT JOIN Sucursal s ON s.idSucursal = l.idSucursal
      WHERE l.idEmpresa = @idEmpresa
        AND l.fechaVencimiento IS NOT NULL
        AND ISNULL(l.activo, 1) = 1
        AND CONVERT(DECIMAL(18, 2), ISNULL(l.cantidadDisponible, 0)) > 0
        AND CONVERT(DATE, l.fechaVencimiento) <= DATEADD(DAY, @diasVentana, @fechaHoy)
      ORDER BY l.fechaVencimiento ASC
    `);
  return result.recordset || [];
}

async function listarEmpresasConLotesCaducidad(pool) {
  const result = await pool.request().query(`
    SELECT DISTINCT l.idEmpresa
    FROM Lotes l
    WHERE l.fechaVencimiento IS NOT NULL
      AND ISNULL(l.activo, 1) = 1
      AND CONVERT(DECIMAL(18, 2), ISNULL(l.cantidadDisponible, 0)) > 0
  `);
  return (result.recordset || []).map((r) => r.idEmpresa).filter(Boolean);
}

async function actualizarCantidadDisponible(idLote, nuevaCantidad) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('nuevaCantidad', sql.Int, nuevaCantidad)
      .query('UPDATE Lotes SET cantidadDisponible = @nuevaCantidad WHERE idLote = @idLote');
    return result;
  });
}

module.exports = {
  getAll,
  getAllPorEmpresas,
  getById,
  getBySucursal,
  create,
  update,
  deleted,
  actualizarCantidadDisponible,
  listarCaducidadEmpresa,
  listarEmpresasConLotesCaducidad
};
