const sql = require('mssql');

/**
 * Inserta fila de comprobante SUNAT real vinculada a una compra.
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} executor
 */
exports.insertar = async (executor, row) => {
  const req = executor.request()
    .input('idComprobanteCompraSunat', sql.UniqueIdentifier, row.idComprobanteCompraSunat)
    .input('idCompra', sql.UniqueIdentifier, row.idCompra)
    .input('rucEmisor', sql.VarChar(11), row.rucEmisor)
    .input('razonSocialEmisor', sql.NVarChar(500), row.razonSocialEmisor ?? null)
    .input('tipoDocumento', sql.VarChar(2), row.tipoDocumento)
    .input('serie', sql.VarChar(10), row.serie)
    .input('numero', sql.VarChar(20), row.numero)
    .input('fechaEmision', sql.VarChar(10), row.fechaEmision)
    .input('codigoMoneda', sql.VarChar(3), row.codigoMoneda ?? null)
    .input('condicionPago', sql.VarChar(10), row.condicionPago)
    .input('fechaVencimiento', sql.VarChar(10), row.fechaVencimiento ?? null)
    .input('tipoCambio', sql.Decimal(18, 6), row.tipoCambio != null ? row.tipoCambio : null)
    .input('subTotal', sql.Decimal(18, 6), row.subTotal ?? 0)
    .input('igv', sql.Decimal(18, 6), row.igv ?? 0)
    .input('exonerado', sql.Decimal(18, 6), row.exonerado ?? 0)
    .input('total', sql.Decimal(18, 6), row.total ?? 0)
    .input('idUsuario', sql.UniqueIdentifier, row.idUsuario ?? null);

  await req.query(`
    INSERT INTO dbo.ComprobantesCompraSunat (
      idComprobanteCompraSunat, idCompra, rucEmisor, razonSocialEmisor, tipoDocumento, serie, numero,
      fechaEmision, codigoMoneda, condicionPago, fechaVencimiento, tipoCambio, subTotal, igv, exonerado, total, idUsuario
    ) VALUES (
      @idComprobanteCompraSunat, @idCompra, @rucEmisor, @razonSocialEmisor, @tipoDocumento, @serie, @numero,
      CAST(@fechaEmision AS DATE), @codigoMoneda, @condicionPago,
      CASE WHEN @fechaVencimiento IS NULL OR LTRIM(RTRIM(@fechaVencimiento)) = N'' THEN NULL ELSE CAST(@fechaVencimiento AS DATE) END,
      @tipoCambio, @subTotal, @igv, @exonerado, @total, @idUsuario
    )
  `);
};

/**
 * Listado de CPE de compra consultados/registrados (empresa vía JOIN Compras).
 * @param {import('mssql').ConnectionPool} pool
 * @param {string} idEmpresa UUID
 * @param {object} opts filtros opcionales (rucEmisor, razonSocial, fechaDesde, fechaHasta, condicionPago, tipoDocumento)
 */
exports.listarPorIdEmpresa = async (pool, idEmpresa, opts = {}) => {
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  let where = 'WHERE c.idEmpresa = @idEmpresa';

  const ruc = opts.rucEmisor != null ? String(opts.rucEmisor).replace(/\D/g, '').slice(0, 11) : '';
  if (ruc.length === 11) {
    req.input('rucEmisorEx', sql.VarChar(11), ruc);
    where += ' AND ccs.rucEmisor = @rucEmisorEx';
  }

  const raz = opts.razonSocial != null ? String(opts.razonSocial).trim() : '';
  if (raz) {
    const esc = raz.replace(/%/g, '').replace(/'/g, '');
    req.input('razonLike', sql.NVarChar(200), `%${esc}%`);
    where += ' AND (ccs.razonSocialEmisor LIKE @razonLike OR ccs.rucEmisor LIKE @razonLike)';
  }

  const cond = opts.condicionPago != null ? String(opts.condicionPago).toUpperCase().trim() : '';
  if (cond === 'CONTADO' || cond === 'CREDITO') {
    req.input('condicionPagoF', sql.VarChar(10), cond);
    where += ' AND ccs.condicionPago = @condicionPagoF';
  }

  const td = opts.tipoDocumento != null ? String(opts.tipoDocumento).replace(/\D/g, '').slice(0, 2) : '';
  if (td) {
    const td2 = td.padStart(2, '0');
    req.input('tipoDocF', sql.VarChar(2), td2);
    where += ' AND ccs.tipoDocumento = @tipoDocF';
  }

  const fd = opts.fechaDesde != null ? String(opts.fechaDesde).trim().slice(0, 10) : '';
  if (fd.length >= 8) {
    req.input('fechaDesdeF', sql.VarChar(10), fd);
    where += ' AND ccs.fechaEmision >= CAST(@fechaDesdeF AS DATE)';
  }

  const fh = opts.fechaHasta != null ? String(opts.fechaHasta).trim().slice(0, 10) : '';
  if (fh.length >= 8) {
    req.input('fechaHastaF', sql.VarChar(10), fh);
    where += ' AND ccs.fechaEmision <= CAST(@fechaHastaF AS DATE)';
  }

  const result = await req.query(`
    SELECT
      ccs.idComprobanteCompraSunat,
      ccs.idCompra,
      ccs.rucEmisor,
      ccs.razonSocialEmisor,
      ccs.tipoDocumento,
      ccs.serie,
      ccs.numero,
      CONVERT(VARCHAR(10), ccs.fechaEmision, 23) AS fechaEmision,
      ccs.codigoMoneda,
      ccs.condicionPago,
      CONVERT(VARCHAR(10), ccs.fechaVencimiento, 23) AS fechaVencimiento,
      ccs.tipoCambio,
      ccs.subTotal,
      ccs.igv,
      ccs.total,
      CONVERT(VARCHAR(19), ccs.fRegistro, 120) AS fRegistro,
      c.compCompra
    FROM dbo.ComprobantesCompraSunat ccs
    INNER JOIN dbo.Compras c ON c.idCompra = ccs.idCompra AND c.idEmpresa = @idEmpresa
    ${where}
    ORDER BY ccs.fechaEmision DESC, ccs.fRegistro DESC
  `);
  return result.recordset || [];
};
