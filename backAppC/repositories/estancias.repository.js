const sql = require('mssql');

const ESTADOS_RESERVA_ACTIVOS = "('confirmada')";

let columnasFacturacionParcialOk = false;

async function asegurarColumnasFacturacionParcial(pool) {
  if (columnasFacturacionParcialOk) return;
  await pool.request().query(`
    IF COL_LENGTH('dbo.Estancias', 'habitacionFacturada') IS NULL
      ALTER TABLE Estancias ADD habitacionFacturada BIT NOT NULL CONSTRAINT DF_Estancias_habitacionFacturada DEFAULT 0;
    IF COL_LENGTH('dbo.Estancias', 'idVentaHabitacion') IS NULL
      ALTER TABLE Estancias ADD idVentaHabitacion INT NULL;
  `);
  columnasFacturacionParcialOk = true;
}

function selectEstanciaBase() {
  return `
    SELECT e.idEstancia, e.idEmpresa, e.idProductoHabitacion, e.idReserva, e.idCliente,
           e.nombreHuesped,
           CONVERT(VARCHAR(19), e.checkIn, 120) AS checkIn,
           CONVERT(VARCHAR(19), e.checkOutPrevisto, 120) AS checkOutPrevisto,
           CONVERT(VARCHAR(19), e.checkOutReal, 120) AS checkOutReal,
           e.estadoEstancia, e.tarifaNoche, e.totalHabitacion, e.idVenta,
           CAST(ISNULL(e.habitacionFacturada, 0) AS BIT) AS habitacionFacturada,
           e.idVentaHabitacion,
           CONVERT(VARCHAR(19), e.fRegistro, 120) AS fRegistro,
           p.codigo AS habitacionCodigo, p.descripcion AS habitacionDescripcion
    FROM Estancias e
    INNER JOIN Productos p ON e.idProductoHabitacion = p.idProducto
  `;
}

async function listarActivas(pool, idEmpresa) {
  await asegurarColumnasFacturacionParcial(pool);
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`${selectEstanciaBase()} WHERE e.idEmpresa = @idEmpresa AND e.estadoEstancia = 'activa' ORDER BY e.checkIn`);
  return result.recordset;
}

async function obtenerActivaPorHabitacion(pool, idEmpresa, idProductoHabitacion) {
  await asegurarColumnasFacturacionParcial(pool);
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query(`
      ${selectEstanciaBase()}
      WHERE e.idEmpresa = @idEmpresa
        AND e.idProductoHabitacion = @idProductoHabitacion
        AND e.estadoEstancia = 'activa'
    `);
  return result.recordset[0] || null;
}

async function obtenerPorId(pool, idEstancia, idEmpresa) {
  await asegurarColumnasFacturacionParcial(pool);
  const result = await pool.request()
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`${selectEstanciaBase()} WHERE e.idEstancia = @idEstancia AND e.idEmpresa = @idEmpresa`);
  return result.recordset[0] || null;
}

async function insertar(pool, idEmpresa, payload, idUsuario) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, payload.idProductoHabitacion)
    .input('idReserva', sql.UniqueIdentifier, payload.idReserva || null)
    .input('idCliente', sql.Int, payload.idCliente || null)
    .input('nombreHuesped', sql.VarChar(200), payload.nombreHuesped)
    .input('checkIn', sql.VarChar(23), payload.checkIn)
    .input('checkOutPrevisto', sql.VarChar(23), payload.checkOutPrevisto)
    .input('tarifaNoche', sql.Decimal(18, 6), payload.tarifaNoche ?? 0)
    .input('totalHabitacion', sql.Decimal(18, 2), payload.totalHabitacion ?? 0)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .query(`
      INSERT INTO Estancias
        (idEmpresa, idProductoHabitacion, idReserva, idCliente, nombreHuesped, checkIn, checkOutPrevisto, tarifaNoche, totalHabitacion, idUsuario)
      OUTPUT INSERTED.idEstancia
      VALUES
        (@idEmpresa, @idProductoHabitacion, @idReserva, @idCliente, @nombreHuesped,
         CAST(@checkIn AS DATETIME), CAST(@checkOutPrevisto AS DATETIME),
         @tarifaNoche, @totalHabitacion, @idUsuario)
    `);
  return result.recordset[0]?.idEstancia;
}

async function cerrarCheckout(pool, idEstancia, idEmpresa, idVenta = null, checkOutReal = null) {
  const req = pool.request()
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta);
  if (checkOutReal) {
    req.input('checkOutReal', sql.VarChar(23), checkOutReal);
    await req.query(`
      UPDATE Estancias SET
        estadoEstancia = 'checkout',
        checkOutReal = CAST(@checkOutReal AS DATETIME),
        idVenta = COALESCE(@idVenta, idVenta)
      WHERE idEstancia = @idEstancia AND idEmpresa = @idEmpresa AND estadoEstancia = 'activa'
    `);
    return;
  }
  await req.query(`
    UPDATE Estancias SET
      estadoEstancia = 'checkout',
      checkOutReal = GETDATE(),
      idVenta = COALESCE(@idVenta, idVenta)
    WHERE idEstancia = @idEstancia AND idEmpresa = @idEmpresa AND estadoEstancia = 'activa'
  `);
}

async function actualizarSalidaYTotal(pool, idEstancia, idEmpresa, checkOutPrevisto, totalHabitacion) {
  await pool.request()
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('checkOutPrevisto', sql.VarChar(23), checkOutPrevisto)
    .input('totalHabitacion', sql.Decimal(18, 2), totalHabitacion ?? 0)
    .query(`
      UPDATE Estancias SET
        checkOutPrevisto = CAST(@checkOutPrevisto AS DATETIME),
        totalHabitacion = @totalHabitacion
      WHERE idEstancia = @idEstancia AND idEmpresa = @idEmpresa AND estadoEstancia = 'activa'
    `);
}

async function actualizarHabitacion(pool, idEstancia, idEmpresa, idProductoHabitacion) {
  await pool.request()
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query(`
      UPDATE Estancias SET idProductoHabitacion = @idProductoHabitacion
      WHERE idEstancia = @idEstancia AND idEmpresa = @idEmpresa AND estadoEstancia = 'activa'
    `);
}

async function marcarHabitacionFacturada(pool, idEstancia, idEmpresa, idVenta) {
  await asegurarColumnasFacturacionParcial(pool);
  await pool.request()
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta)
    .query(`
      UPDATE Estancias SET
        habitacionFacturada = 1,
        idVentaHabitacion = COALESCE(idVentaHabitacion, @idVenta)
      WHERE idEstancia = @idEstancia AND idEmpresa = @idEmpresa AND estadoEstancia = 'activa'
    `);
}

async function listarReservasConfirmadasHabitacion(pool, idEmpresa, idProductoHabitacion, excluirIdReserva = null) {
  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion);
  let excl = '';
  if (excluirIdReserva) {
    req.input('excluirIdReserva', sql.UniqueIdentifier, excluirIdReserva);
    excl = ' AND r.idReserva <> @excluirIdReserva ';
  }
  const result = await req.query(`
    SELECT r.idReserva,
           CONVERT(VARCHAR(10), r.fechaEntrada, 120) AS fechaEntrada,
           CONVERT(VARCHAR(10), r.fechaSalida, 120) AS fechaSalida,
           r.estado, r.nombreHuesped, r.codigo
    FROM Reservas r
    WHERE r.idEmpresa = @idEmpresa
      AND r.idProductoHabitacion = @idProductoHabitacion
      AND r.estado IN ${ESTADOS_RESERVA_ACTIVOS}
      ${excl}
  `);
  return result.recordset;
}

async function listarEstanciasActivasHabitacion(pool, idEmpresa, idProductoHabitacion, excluirIdEstancia = null) {
  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion);
  let excl = '';
  if (excluirIdEstancia) {
    req.input('excluirIdEstancia', sql.UniqueIdentifier, excluirIdEstancia);
    excl = ' AND e.idEstancia <> @excluirIdEstancia ';
  }
  const result = await req.query(`
    SELECT e.idEstancia, e.checkIn, e.checkOutPrevisto, e.nombreHuesped
    FROM Estancias e
    WHERE e.idEmpresa = @idEmpresa
      AND e.idProductoHabitacion = @idProductoHabitacion
      AND e.estadoEstancia = 'activa'
      ${excl}
  `);
  return result.recordset;
}

async function listarActivasEnRango(pool, idEmpresa, fechaDesde, fechaHasta) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaDesde', sql.DateTime, fechaDesde)
    .input('fechaHasta', sql.DateTime, fechaHasta)
    .query(`
      ${selectEstanciaBase()}
      WHERE e.idEmpresa = @idEmpresa
        AND e.estadoEstancia = 'activa'
        AND e.checkIn < @fechaHasta
        AND e.checkOutPrevisto > @fechaDesde
      ORDER BY e.checkIn, p.codigo
    `);
  return result.recordset;
}

/** Estancias activas y cerradas que solapan un rango (fechaHasta inclusive). */
async function listarEnRango(pool, idEmpresa, fechaDesde, fechaHasta) {
  await asegurarColumnasFacturacionParcial(pool);
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaDesde', sql.DateTime, new Date(`${fechaDesde}T00:00:00`))
    .input('fechaHasta', sql.DateTime, new Date(`${fechaHasta}T23:59:59`))
    .query(`
      ${selectEstanciaBase()}
      WHERE e.idEmpresa = @idEmpresa
        AND e.estadoEstancia IN ('activa', 'checkout')
        AND e.checkIn <= @fechaHasta
        AND COALESCE(e.checkOutReal, e.checkOutPrevisto) >= @fechaDesde
      ORDER BY p.codigo, e.checkIn
    `);
  return result.recordset;
}

/** Estancias que solapan un mes calendario en una habitación (activas y cerradas). */
async function listarHistorialHabitacionMes(pool, idEmpresa, idProductoHabitacion, inicioMes, finMes) {
  await asegurarColumnasFacturacionParcial(pool);
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .input('inicioMes', sql.DateTime, inicioMes)
    .input('finMes', sql.DateTime, finMes)
    .query(`
      ${selectEstanciaBase()}
      WHERE e.idEmpresa = @idEmpresa
        AND e.idProductoHabitacion = @idProductoHabitacion
        AND e.estadoEstancia IN ('activa', 'checkout')
        AND e.checkIn < @finMes
        AND COALESCE(e.checkOutReal, e.checkOutPrevisto) >= @inicioMes
      ORDER BY e.checkIn DESC
    `);
  return result.recordset;
}

module.exports = {
  listarActivas,
  obtenerActivaPorHabitacion,
  obtenerPorId,
  insertar,
  actualizarSalidaYTotal,
  actualizarHabitacion,
  cerrarCheckout,
  marcarHabitacionFacturada,
  asegurarColumnasFacturacionParcial,
  listarReservasConfirmadasHabitacion,
  listarEstanciasActivasHabitacion,
  listarActivasEnRango,
  listarEnRango,
  listarHistorialHabitacionMes
};
