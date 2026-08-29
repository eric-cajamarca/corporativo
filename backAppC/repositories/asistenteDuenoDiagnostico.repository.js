const sql = require('mssql');

async function contarSeguro(pool, idEmpresa, query) {
  try {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(query);
    return Number((r.recordset[0] || {}).n) || 0;
  } catch (err) {
    console.error('asistenteDuenoDiagnostico contar:', err.message);
    return null;
  }
}

/**
 * Lectura de estado (sin certificados ni claves). Filtra siempre por idEmpresa.
 */
async function diagnosticarEmpresa(pool, idEmpresa) {
  const productos = await contarSeguro(
    pool,
    idEmpresa,
    `SELECT COUNT(1) AS n FROM Productos WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1`
  );
  const sucursales = await contarSeguro(
    pool,
    idEmpresa,
    `SELECT COUNT(1) AS n FROM Sucursal WHERE idEmpresa = @idEmpresa`
  );
  const clientes = await contarSeguro(
    pool,
    idEmpresa,
    `SELECT COUNT(1) AS n FROM Clientes WHERE idEmpresa = @idEmpresa`
  );
  const comprobantesVenta = await contarSeguro(
    pool,
    idEmpresa,
    `SELECT COUNT(1) AS n FROM Comprobantes WHERE idEmpresa = @idEmpresa AND ISNULL(usarEnVenta, 0) = 1 AND ISNULL(activo, 1) = 1`
  );

  let facturacion = {
    configurada: false,
    tieneCertificado: false,
    tieneUsuarioSunat: false,
    tieneSerieFactura: false,
    tieneSerieBoleta: false,
    modoPrueba: null,
    envioDirectoSunat: false
  };
  try {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT TOP 1
          CASE WHEN certificadoDigital IS NOT NULL AND LEN(LTRIM(RTRIM(ISNULL(certificadoDigital, '')))) > 20 THEN 1 ELSE 0 END AS tieneCertificado,
          CASE WHEN LTRIM(RTRIM(ISNULL(usuarioSunat, ''))) <> '' THEN 1 ELSE 0 END AS tieneUsuarioSunat,
          CASE WHEN LTRIM(RTRIM(ISNULL(serieFactura, ''))) <> '' THEN 1 ELSE 0 END AS tieneSerieFactura,
          CASE WHEN LTRIM(RTRIM(ISNULL(serieBoleta, ''))) <> '' THEN 1 ELSE 0 END AS tieneSerieBoleta,
          ISNULL(modoPrueba, 1) AS modoPrueba,
          ISNULL(envioDirectoSunat, 0) AS envioDirectoSunat
        FROM ConfiguracionFacturacionElectronica
        WHERE idEmpresa = @idEmpresa
      `);
    const row = r.recordset[0];
    if (row) {
      facturacion = {
        configurada: true,
        tieneCertificado: Number(row.tieneCertificado) === 1,
        tieneUsuarioSunat: Number(row.tieneUsuarioSunat) === 1,
        tieneSerieFactura: Number(row.tieneSerieFactura) === 1,
        tieneSerieBoleta: Number(row.tieneSerieBoleta) === 1,
        modoPrueba: row.modoPrueba === true || row.modoPrueba === 1,
        envioDirectoSunat: row.envioDirectoSunat === true || row.envioDirectoSunat === 1
      };
    }
  } catch (err) {
    console.error('asistenteDuenoDiagnostico facturacion:', err.message);
  }

  const problemas = [];
  if (productos === 0) problemas.push('No hay productos activos. Agregue al menos uno en Productos.');
  if (sucursales === 0) problemas.push('No hay sucursales. Cree una sucursal en Empresa / sucursales.');
  if (!facturacion.configurada) {
    problemas.push('Aún no hay configuración de facturación electrónica.');
  } else {
    if (!facturacion.tieneCertificado) problemas.push('Falta el certificado digital (.pfx) en Configuración → Facturación.');
    if (!facturacion.tieneUsuarioSunat) problemas.push('Falta el usuario SOL (SUNAT) en Configuración → Facturación.');
    if (!facturacion.tieneSerieFactura) problemas.push('Falta serie de factura.');
    if (!facturacion.tieneSerieBoleta) problemas.push('Falta serie de boleta.');
    if (facturacion.modoPrueba) problemas.push('El envío SUNAT está en modo prueba (beta).');
  }
  if (comprobantesVenta === 0) problemas.push('No hay comprobantes de venta activos (boleta/factura).');

  return {
    productos,
    sucursales,
    clientes,
    comprobantesVenta,
    facturacion,
    problemas
  };
}

module.exports = { diagnosticarEmpresa };
