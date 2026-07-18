const sql = require('mssql');

/**
 * Genera correlativo LR-YYYY-NNNNNN dentro de la transacción.
 */
async function generarCodigo(transaction) {
  const anio = new Date().getFullYear();
  const prefijo = `LR-${anio}-`;
  const result = await new sql.Request(transaction)
    .input('prefijo', sql.VarChar(20), `${prefijo}%`)
    .query(`
      SELECT TOP 1 codigo
      FROM dbo.LibroReclamaciones WITH (UPDLOCK, HOLDLOCK)
      WHERE codigo LIKE @prefijo
      ORDER BY codigo DESC
    `);

  let siguiente = 1;
  if (result.recordset.length > 0) {
    const ultimo = String(result.recordset[0].codigo || '');
    const parte = ultimo.split('-').pop();
    const n = parseInt(parte, 10);
    if (!Number.isNaN(n)) siguiente = n + 1;
  }
  return `${prefijo}${String(siguiente).padStart(6, '0')}`;
}

exports.insertar = async (pool, row) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const codigo = await generarCodigo(transaction);
    const idReclamacion = row.idReclamacion;
    await new sql.Request(transaction)
      .input('idReclamacion', sql.UniqueIdentifier, idReclamacion)
      .input('codigo', sql.VarChar(20), codigo)
      .input('tipo', sql.VarChar(10), row.tipo)
      .input('consumidorNombre', sql.VarChar(200), row.consumidorNombre)
      .input('consumidorDocumentoTipo', sql.VarChar(20), row.consumidorDocumentoTipo)
      .input('consumidorDocumentoNumero', sql.VarChar(30), row.consumidorDocumentoNumero)
      .input('consumidorDomicilio', sql.VarChar(300), row.consumidorDomicilio)
      .input('consumidorTelefono', sql.VarChar(30), row.consumidorTelefono)
      .input('consumidorEmail', sql.VarChar(200), row.consumidorEmail)
      .input('esMenor', sql.Bit, row.esMenor ? 1 : 0)
      .input('tutorNombre', sql.VarChar(200), row.tutorNombre)
      .input('bienTipo', sql.VarChar(20), row.bienTipo)
      .input('bienDescripcion', sql.VarChar(500), row.bienDescripcion)
      .input('bienMonto', sql.Decimal(18, 6), row.bienMonto)
      .input('detalle', sql.VarChar(2000), row.detalle)
      .input('pedidoConsumidor', sql.VarChar(1000), row.pedidoConsumidor)
      .input('ipOrigen', sql.VarChar(45), row.ipOrigen)
      .input('userAgent', sql.VarChar(400), row.userAgent)
      .query(`
        INSERT INTO dbo.LibroReclamaciones (
          idReclamacion, codigo, tipo,
          consumidorNombre, consumidorDocumentoTipo, consumidorDocumentoNumero,
          consumidorDomicilio, consumidorTelefono, consumidorEmail,
          esMenor, tutorNombre,
          bienTipo, bienDescripcion, bienMonto,
          detalle, pedidoConsumidor,
          ipOrigen, userAgent
        ) VALUES (
          @idReclamacion, @codigo, @tipo,
          @consumidorNombre, @consumidorDocumentoTipo, @consumidorDocumentoNumero,
          @consumidorDomicilio, @consumidorTelefono, @consumidorEmail,
          @esMenor, @tutorNombre,
          @bienTipo, @bienDescripcion, @bienMonto,
          @detalle, @pedidoConsumidor,
          @ipOrigen, @userAgent
        )
      `);
    await transaction.commit();
    return { idReclamacion, codigo };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      console.error('libroReclamaciones.repository insertar rollback:', rollbackErr);
    }
    throw error;
  }
};

exports.listar = async (pool, { estado, limit = 100, offset = 0 } = {}) => {
  const req = pool.request()
    .input('limit', sql.Int, Math.min(Math.max(Number(limit) || 100, 1), 500))
    .input('offset', sql.Int, Math.max(Number(offset) || 0, 0));

  let where = '';
  if (estado) {
    req.input('estado', sql.VarChar(20), estado);
    where = 'WHERE estado = @estado';
  }

  const result = await req.query(`
    SELECT
      idReclamacion,
      codigo,
      tipo,
      consumidorNombre,
      consumidorDocumentoTipo,
      consumidorDocumentoNumero,
      consumidorEmail,
      consumidorTelefono,
      bienTipo,
      bienDescripcion,
      bienMonto,
      detalle,
      pedidoConsumidor,
      estado,
      CONVERT(VARCHAR(19), fechaRegistro, 120) AS fechaRegistro,
      CONVERT(VARCHAR(19), fechaRespuesta, 120) AS fechaRespuesta
    FROM dbo.LibroReclamaciones
    ${where}
    ORDER BY fechaRegistro DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);
  return result.recordset;
};

exports.obtenerPorId = async (pool, idReclamacion) => {
  const result = await pool.request()
    .input('idReclamacion', sql.UniqueIdentifier, idReclamacion)
    .query(`
      SELECT
        idReclamacion,
        codigo,
        tipo,
        consumidorNombre,
        consumidorDocumentoTipo,
        consumidorDocumentoNumero,
        consumidorDomicilio,
        consumidorTelefono,
        consumidorEmail,
        esMenor,
        tutorNombre,
        bienTipo,
        bienDescripcion,
        bienMonto,
        detalle,
        pedidoConsumidor,
        estado,
        respuestaProveedor,
        respondidoPor,
        CONVERT(VARCHAR(19), fechaRegistro, 120) AS fechaRegistro,
        CONVERT(VARCHAR(19), fechaRespuesta, 120) AS fechaRespuesta
      FROM dbo.LibroReclamaciones
      WHERE idReclamacion = @idReclamacion
    `);
  return result.recordset[0] || null;
};

exports.responder = async (pool, { idReclamacion, respuestaProveedor, respondidoPor, estado }) => {
  const result = await pool.request()
    .input('idReclamacion', sql.UniqueIdentifier, idReclamacion)
    .input('respuestaProveedor', sql.VarChar(2000), respuestaProveedor)
    .input('respondidoPor', sql.VarChar(200), respondidoPor)
    .input('estado', sql.VarChar(20), estado)
    .query(`
      UPDATE dbo.LibroReclamaciones
      SET
        respuestaProveedor = @respuestaProveedor,
        respondidoPor = @respondidoPor,
        estado = @estado,
        fechaRespuesta = GETDATE()
      WHERE idReclamacion = @idReclamacion
    `);
  return result.rowsAffected[0] > 0;
};
