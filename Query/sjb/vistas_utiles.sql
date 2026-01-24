-- =============================================
-- VISTAS ÚTILES PARA CONSULTAS FRECUENTES
-- =============================================

USE SistemaInventario;
GO

-- =============================================
-- VISTAS PARA SISTEMA DE CAJA
-- =============================================

-- Vista de resumen de caja por día
CREATE VIEW vw_ResumenCajaDiario AS
SELECT
    ac.idEmpresa,
    ac.idSucursal,
    c.nombre AS nombreCaja,
    CONVERT(DATE, ac.fechaApertura) AS fecha,
    ac.montoInicial,
    ISNULL(SUM(CASE WHEN tmc.tipo = 'I' THEN mc.monto ELSE 0 END), 0) AS totalIngresos,
    ISNULL(SUM(CASE WHEN tmc.tipo = 'E' THEN mc.monto ELSE 0 END), 0) AS totalEgresos,
    ac.montoInicial +
    ISNULL(SUM(CASE WHEN tmc.tipo = 'I' THEN mc.monto ELSE 0 END), 0) -
    ISNULL(SUM(CASE WHEN tmc.tipo = 'E' THEN mc.monto ELSE 0 END), 0) AS saldoEsperado,
    cc.montoFinal,
    ISNULL(cc.diferencia, 0) AS diferencia,
    CASE WHEN cc.idCierre IS NOT NULL THEN 'CERRADA' ELSE 'ABIERTA' END AS estado,
    ac.idUsuario,
    uw.nombres + ' ' + uw.apellidos AS usuarioApertura
FROM AperturasCaja ac
INNER JOIN Cajas c ON ac.idCaja = c.idCaja
LEFT JOIN MovimientosCaja mc ON ac.idApertura = mc.idApertura
LEFT JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
LEFT JOIN CierresCaja cc ON ac.idApertura = cc.idApertura
LEFT JOIN UsuarioWeb uw ON ac.idUsuario = uw.idUsuario
GROUP BY ac.idEmpresa, ac.idSucursal, c.nombre, CONVERT(DATE, ac.fechaApertura),
         ac.montoInicial, cc.montoFinal, cc.diferencia, cc.idCierre, ac.idUsuario, uw.nombres, uw.apellidos;
GO

-- Vista de movimientos de caja detallados
CREATE VIEW vw_MovimientosCajaDetallado AS
SELECT
    mc.idMovimientoCaja,
    mc.fechaMovimiento,
    c.nombre AS caja,
    tmc.nombre AS tipoMovimiento,
    tmc.tipo AS tipoOperacion,
    mc.concepto,
    mc.monto,
    mp.descripcion AS medioPago,
    mon.simbolo + ' ' + mon.descripcion AS moneda,
    mc.documentoRelacionado,
    mc.observaciones,
    uw.nombres + ' ' + uw.apellidos AS usuario,
    e.nombreComercial AS empresa,
    s.nombre AS sucursal
FROM MovimientosCaja mc
INNER JOIN AperturasCaja ac ON mc.idApertura = ac.idApertura
INNER JOIN Cajas c ON ac.idCaja = c.idCaja
INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
LEFT JOIN MediosPago mp ON mc.idMediosPago = mp.idMediosPago
INNER JOIN Moneda mon ON mc.idMoneda = mon.idMoneda
INNER JOIN UsuarioWeb uw ON mc.idUsuario = uw.idUsuario
INNER JOIN Empresas e ON mc.idEmpresa = e.idEmpresa
INNER JOIN Sucursal s ON mc.idSucursal = s.idSucursal;
GO

-- =============================================
-- VISTAS PARA CUENTAS POR COBRAR
-- =============================================

-- Vista de resumen de créditos por cliente
CREATE VIEW vw_ResumenCreditosCliente AS
SELECT
    cc.idEmpresa,
    c.rSocial AS cliente,
    c.ruc,
    COUNT(DISTINCT cc.idCredito) AS totalCreditos,
    SUM(cc.montoTotal) AS totalCredito,
    SUM(ISNULL(cuot.saldoPendiente, 0)) AS saldoPendiente,
    SUM(cc.montoTotal - ISNULL(cuot.saldoPendiente, 0)) AS totalPagado,
    AVG(cc.tasaInteres) AS tasaPromedio,
    MIN(cuot.fechaVencimiento) AS proximaCuota,
    COUNT(CASE WHEN cuot.estado = 'VENCIDO' THEN 1 END) AS cuotasVencidas,
    uw.nombres + ' ' + uw.apellidos AS usuarioCredito
FROM CreditosClientes cc
INNER JOIN Clientes c ON cc.idCliente = c.idCliente AND cc.idEmpresa = c.idEmpresa
LEFT JOIN (
    SELECT idCredito, SUM(saldoPendiente) AS saldoPendiente, MIN(fechaVencimiento) AS fechaVencimiento
    FROM CuotasCredito
    WHERE estado IN ('PENDIENTE', 'VENCIDO')
    GROUP BY idCredito
) cuot ON cc.idCredito = cuot.idCredito
INNER JOIN UsuarioWeb uw ON cc.idUsuarioCredito = uw.idUsuario
WHERE cc.estado = 'ACTIVO'
GROUP BY cc.idEmpresa, c.rSocial, c.ruc, uw.nombres, uw.apellidos;
GO

-- Vista de cuotas pendientes por vencer
CREATE VIEW vw_CuotasPendientes AS
SELECT
    cu.idCuota,
    cc.idCredito,
    c.rSocial AS cliente,
    cu.numeroCuota,
    cu.fechaVencimiento,
    cu.montoCuota,
    cu.saldoPendiente,
    cu.estado,
    DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) AS diasParaVencimiento,
    CASE
        WHEN DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) < 0 THEN 'VENCIDA'
        WHEN DATEDIFF(DAY, GETDATE(), cu.fechaVencimiento) <= 7 THEN 'POR_VENCER'
        ELSE 'AL_DIA'
    END AS situacion,
    uw.nombres + ' ' + uw.apellidos AS usuarioCredito
FROM CuotasCredito cu
INNER JOIN CreditosClientes cc ON cu.idCredito = cc.idCredito
INNER JOIN Clientes c ON cc.idCliente = c.idCliente
INNER JOIN UsuarioWeb uw ON cc.idUsuarioCredito = uw.idUsuario
WHERE cu.estado IN ('PENDIENTE', 'VENCIDO')
ORDER BY cu.fechaVencimiento;
GO

-- Vista de eficiencia de cobros por usuario
CREATE VIEW vw_EficienciaCobros AS
SELECT
    uw.nombres + ' ' + uw.apellidos AS usuario,
    COUNT(DISTINCT cc.idCredito) AS creditosOtorgados,
    COUNT(cu.idCuota) AS totalCuotas,
    COUNT(CASE WHEN cu.estado = 'PAGADO' THEN cu.idCuota END) AS cuotasPagadas,
    COUNT(CASE WHEN cu.estado = 'VENCIDO' THEN cu.idCuota END) AS cuotasVencidas,
    SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota END) AS montoCobrado,
    SUM(cu.montoCuota) AS montoTotal,
    CASE
        WHEN COUNT(cu.idCuota) > 0 THEN
            CAST(COUNT(CASE WHEN cu.estado = 'PAGADO' THEN cu.idCuota END) AS DECIMAL(10,2)) /
            COUNT(cu.idCuota) * 100
        ELSE 0
    END AS porcentajeCobranza,
    AVG(DATEDIFF(DAY, cu.fechaVencimiento,
        CASE WHEN cu.estado = 'PAGADO' THEN cu.fechaPago ELSE GETDATE() END)
    ) AS diasPromedioCobro
FROM UsuarioWeb uw
INNER JOIN CreditosClientes cc ON uw.idUsuario = cc.idUsuarioCredito
INNER JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
WHERE uw.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E' -- Cambiar por empresa específica
GROUP BY uw.idUsuario, uw.nombres, uw.apellidos
ORDER BY porcentajeCobranza DESC;
GO

-- =============================================
-- VISTAS PARA DESPACHOS Y ENVIOS
-- =============================================

-- Vista de estado de despachos por venta
CREATE VIEW vw_EstadoDespachos AS
SELECT
    v.idVenta,
    v.serie + '-' + v.numero AS comprobante,
    c.rSocial AS cliente,
    d.fechaDespacho,
    d.estado AS estadoDespacho,
    td.nombre AS tipoDespacho,
    COUNT(dd.idDetalleDespacho) AS productosTotal,
    COUNT(CASE WHEN dd.estado = 'DESPACHADO' THEN dd.idDetalleDespacho END) AS productosDespachados,
    COUNT(CASE WHEN dd.estado = 'PENDIENTE' THEN dd.idDetalleDespacho END) AS productosPendientes,
    CASE
        WHEN COUNT(dd.idDetalleDespacho) = COUNT(CASE WHEN dd.estado = 'DESPACHADO' THEN dd.idDetalleDespacho END)
        THEN 'COMPLETADO'
        ELSE 'PENDIENTE'
    END AS estadoGeneral,
    uw.nombres + ' ' + uw.apellidos AS usuarioDespacho
FROM Ventas v
INNER JOIN Clientes c ON v.idCliente = c.idCliente
LEFT JOIN Despachos d ON v.idVenta = d.idVenta
LEFT JOIN TiposDespacho td ON d.idTipoDespacho = td.idTipoDespacho
LEFT JOIN DetalleDespachos dd ON d.idDespacho = dd.idDespacho
LEFT JOIN UsuarioWeb uw ON d.idUsuarioDespacho = uw.idUsuario
WHERE v.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E' -- Cambiar por empresa específica
GROUP BY v.idVenta, v.serie, v.numero, c.rSocial, d.fechaDespacho, d.estado, td.nombre, uw.nombres, uw.apellidos;
GO

-- Vista de envíos con estado actual
CREATE VIEW vw_EstadoEnvios AS
SELECT
    e.idEnvio,
    v.serie + '-' + v.numero AS comprobante,
    c.rSocial AS cliente,
    e.fechaSolicitud,
    e.fechaProgramada,
    e.fechaEntrega,
    te.nombre AS tipoEnvio,
    ee.nombre AS estadoActual,
    ee.color AS colorEstado,
    e.direccionEntrega,
    e.contactoDestinatario,
    e.telefonoDestinatario,
    e.costoEnvio,
    t.nombres + ' ' + t.apellidos AS transportista,
    uw.nombres + ' ' + uw.apellidos AS usuarioEnvio,
    e.observaciones
FROM Envios e
INNER JOIN Ventas v ON e.idVenta = v.idVenta
INNER JOIN Clientes c ON v.idCliente = c.idCliente
INNER JOIN TiposEnvio te ON e.idTipoEnvio = te.idTipoEnvio
INNER JOIN EstadosEnvio ee ON e.idEstadoEnvio = ee.idEstadoEnvio
LEFT JOIN Transportistas t ON e.idTransportista = t.idTransportista
INNER JOIN UsuarioWeb uw ON e.idUsuarioEnvio = uw.idUsuario
WHERE e.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E' -- Cambiar por empresa específica
ORDER BY e.fechaSolicitud DESC;
GO

-- =============================================
-- VISTAS PARA FACTURACIÓN ELECTRÓNICA
-- =============================================

-- Vista de comprobantes electrónicos con estado SUNAT
CREATE VIEW vw_ComprobantesElectronicos AS
SELECT
    ce.idComprobanteElectronico,
    ce.tipoComprobante,
    ce.serie + '-' + ce.numero AS numeroComprobante,
    ce.fechaEmision,
    CASE
        WHEN ce.idVenta IS NOT NULL THEN 'VENTA'
        WHEN ce.idCompra IS NOT NULL THEN 'COMPRA'
        ELSE 'OTRO'
    END AS origen,
    es.descripcion AS estadoSunat,
    es.requiereAccion,
    ce.fechaEnvio,
    ce.fechaRespuesta,
    ce.intentosEnvio,
    ce.hash,
    ce.archivoPdf,
    e.nombreComercial AS empresa
FROM ComprobantesElectronicos ce
INNER JOIN EstadosSunat es ON ce.idEstadoSunat = es.idEstadoSunat
INNER JOIN Empresas e ON ce.idEmpresa = e.idEmpresa
ORDER BY ce.fechaEmision DESC;
GO

-- Vista de configuración de facturación electrónica
CREATE VIEW vw_ConfiguracionFacturacion AS
SELECT
    e.nombreComercial AS empresa,
    cfe.modoPrueba,
    CASE WHEN cfe.modoPrueba = 1 THEN 'PRUEBAS' ELSE 'PRODUCCIÓN' END AS ambiente,
    cfe.serieFactura,
    cfe.serieBoleta,
    cfe.serieNotaCredito,
    cfe.serieNotaDebito,
    CASE WHEN cfe.certificadoDigital IS NOT NULL THEN 'CONFIGURADO' ELSE 'PENDIENTE' END AS certificado,
    CASE WHEN cfe.usuarioSunat IS NOT NULL THEN 'CONFIGURADO' ELSE 'PENDIENTE' END AS credencialesSunat
FROM ConfiguracionFacturacionElectronica cfe
INNER JOIN Empresas e ON cfe.idEmpresa = e.idEmpresa;
GO

-- =============================================
-- VISTAS DE REPORTES GENERALES
-- =============================================

-- Vista de resumen diario de operaciones
CREATE VIEW vw_ResumenDiario AS
SELECT
    CONVERT(DATE, v.fEmision) AS fecha,
    v.idEmpresa,
    COUNT(v.idVenta) AS totalVentas,
    SUM(v.total) AS montoTotalVentas,
    COUNT(d.idDespacho) AS despachosRealizados,
    COUNT(e.idEnvio) AS enviosRealizados,
    COUNT(cc.idCredito) AS creditosOtorgados,
    SUM(cc.montoTotal) AS montoCreditos,
    COUNT(cu.idCuota) AS cuotasGeneradas,
    SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota END) AS cobrosDelDia
FROM Ventas v
LEFT JOIN Despachos d ON v.idVenta = d.idVenta AND d.fechaDespacho >= CONVERT(DATE, GETDATE()) AND d.fechaDespacho < DATEADD(DAY, 1, CONVERT(DATE, GETDATE()))
LEFT JOIN Envios e ON v.idVenta = e.idVenta AND e.fechaSolicitud >= CONVERT(DATE, GETDATE()) AND e.fechaSolicitud < DATEADD(DAY, 1, CONVERT(DATE, GETDATE()))
LEFT JOIN CreditosClientes cc ON v.idCliente = cc.idCliente AND cc.fechaCredito >= CONVERT(DATE, GETDATE()) AND cc.fechaCredito < DATEADD(DAY, 1, CONVERT(DATE, GETDATE()))
LEFT JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito AND cu.fechaPago >= CONVERT(DATE, GETDATE()) AND cu.fechaPago < DATEADD(DAY, 1, CONVERT(DATE, GETDATE()))
WHERE v.fEmision >= CONVERT(DATE, GETDATE()) AND v.fEmision < DATEADD(DAY, 1, CONVERT(DATE, GETDATE()))
    AND v.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E' -- Cambiar por empresa específica
GROUP BY CONVERT(DATE, v.fEmision), v.idEmpresa;
GO

-- Vista de productos más vendidos
CREATE VIEW vw_ProductosMasVendidos AS
SELECT TOP 20
    p.idProducto,
    p.codigo,
    p.descripcion,
    SUM(dv.cantidad) AS cantidadVendida,
    SUM(dv.total) AS montoTotal,
    COUNT(DISTINCT v.idVenta) AS numeroVentas,
    AVG(dv.pVenta) AS precioPromedio,
    p.VecesVendidas AS vecesVendidasTotal
FROM Productos p
INNER JOIN DetalleVenta dv ON p.idProducto = dv.idProducto
INNER JOIN Ventas v ON dv.idVenta = v.idVenta
WHERE p.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E' -- Cambiar por empresa específica
    AND v.fEmision >= DATEADD(MONTH, -3, GETDATE()) -- Últimos 3 meses
GROUP BY p.idProducto, p.codigo, p.descripcion, p.VecesVendidas
ORDER BY cantidadVendida DESC;
GO

PRINT 'Vistas útiles creadas exitosamente.';
PRINT 'Puedes usar estas vistas para consultas y reportes.';
GO