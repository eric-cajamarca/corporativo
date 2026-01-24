-- =============================================
-- EJEMPLOS DE CONSULTAS ÚTILES
-- Para el sistema completo multiempresa
-- =============================================

USE SistemaInventario;
GO

-- =============================================
-- CONSULTAS PARA SISTEMA DE CAJA
-- =============================================

-- 1. Resumen de caja del día actual
SELECT * FROM vw_ResumenCajaDiario
WHERE fecha = CONVERT(DATE, GETDATE())
  AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E';

-- 2. Movimientos de caja detallados de hoy
SELECT * FROM vw_MovimientosCajaDetallado
WHERE CONVERT(DATE, fechaMovimiento) = CONVERT(DATE, GETDATE())
  AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY fechaMovimiento DESC;

-- 3. Cajas abiertas actualmente
SELECT
    c.nombre AS caja,
    s.nombre AS sucursal,
    ac.fechaApertura,
    ac.montoInicial,
    uw.nombres + ' ' + uw.apellidos AS usuario
FROM AperturasCaja ac
INNER JOIN Cajas c ON ac.idCaja = c.idCaja
INNER JOIN Sucursal s ON ac.idSucursal = s.idSucursal
INNER JOIN UsuarioWeb uw ON ac.idUsuario = uw.idUsuario
WHERE ac.estado = 1 -- Abierta
  AND ac.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E';

-- =============================================
-- CONSULTAS PARA CUENTAS POR COBRAR
-- =============================================

-- 4. Clientes con créditos activos
SELECT * FROM vw_ResumenCreditosCliente
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY saldoPendiente DESC;

-- 5. Cuotas pendientes de vencer (próximos 7 días)
SELECT * FROM vw_CuotasPendientes
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND situacion IN ('POR_VENCER', 'VENCIDA')
ORDER BY fechaVencimiento;

-- 6. Eficiencia de cobros por usuario
SELECT * FROM vw_EficienciaCobros
ORDER BY porcentajeCobranza DESC;

-- 7. Pagos realizados hoy
SELECT
    pc.fechaPago,
    pc.montoPagado,
    mp.descripcion AS medioPago,
    cu.numeroCuota,
    cc.idCredito,
    c.rSocial AS cliente,
    uw.nombres + ' ' + uw.apellidos AS usuarioCobro
FROM PagosCuotas pc
INNER JOIN CuotasCredito cu ON pc.idCuota = cu.idCuota
INNER JOIN CreditosClientes cc ON cu.idCredito = cc.idCredito
INNER JOIN Clientes c ON cc.idCliente = c.idCliente
INNER JOIN MediosPago mp ON pc.idMediosPago = mp.idMediosPago
INNER JOIN UsuarioWeb uw ON pc.idUsuarioPago = uw.idUsuario
WHERE CONVERT(DATE, pc.fechaPago) = CONVERT(DATE, GETDATE())
  AND pc.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E';

-- =============================================
-- CONSULTAS PARA DESPACHOS Y ENVIOS
-- =============================================

-- 8. Estado de despachos por venta
SELECT * FROM vw_EstadoDespachos
WHERE estadoGeneral = 'PENDIENTE'
  AND fechaDespacho >= DATEADD(DAY, -7, GETDATE())
ORDER BY fechaDespacho DESC;

-- 9. Envíos del día
SELECT * FROM vw_EstadoEnvios
WHERE CONVERT(DATE, fechaSolicitud) = CONVERT(DATE, GETDATE())
ORDER BY fechaSolicitud DESC;

-- 10. Envíos por transportista
SELECT
    t.nombres + ' ' + t.apellidos AS transportista,
    COUNT(e.idEnvio) AS enviosAsignados,
    COUNT(CASE WHEN e.idEstadoEnvio = (SELECT idEstadoEnvio FROM EstadosEnvio WHERE nombre = 'ENTREGADO') THEN e.idEnvio END) AS entregados,
    COUNT(CASE WHEN e.idEstadoEnvio = (SELECT idEstadoEnvio FROM EstadosEnvio WHERE nombre = 'EN_CAMINO') THEN e.idEnvio END) AS enCamino,
    SUM(e.costoEnvio) AS costoTotal
FROM Transportistas t
LEFT JOIN Envios e ON t.idTransportista = e.idTransportista
    AND e.fechaProgramada >= CONVERT(DATE, GETDATE())
    AND e.fechaProgramada < DATEADD(DAY, 1, CONVERT(DATE, GETDATE()))
WHERE t.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
GROUP BY t.idTransportista, t.nombres, t.apellidos
ORDER BY enviosAsignados DESC;

-- =============================================
-- CONSULTAS PARA FACTURACIÓN ELECTRÓNICA
-- =============================================

-- 11. Comprobantes pendientes de envío a SUNAT
SELECT * FROM vw_ComprobantesElectronicos
WHERE estadoSunat IN ('Pendiente de envío', 'Error de envío')
  AND fechaEmision >= DATEADD(DAY, -30, GETDATE())
ORDER BY fechaEmision DESC;

-- 12. Estado de configuración de facturación electrónica
SELECT * FROM vw_ConfiguracionFacturacion;

-- =============================================
-- CONSULTAS DE REPORTES GENERALES
-- =============================================

-- 13. Resumen diario de operaciones
SELECT * FROM vw_ResumenDiario
ORDER BY fecha DESC;

-- 14. Productos más vendidos (último mes)
SELECT * FROM vw_ProductosMasVendidos;

-- 15. Ventas por día de la semana (último mes)
SELECT
    DATEPART(WEEKDAY, fEmision) AS diaSemana,
    DATENAME(WEEKDAY, fEmision) AS nombreDia,
    COUNT(*) AS cantidadVentas,
    SUM(total) AS montoTotal,
    AVG(total) AS promedioVenta
FROM Ventas
WHERE fEmision >= DATEADD(MONTH, -1, GETDATE())
  AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
GROUP BY DATEPART(WEEKDAY, fEmision), DATENAME(WEEKDAY, fEmision)
ORDER BY diaSemana;

-- =============================================
-- CONSULTAS PARA INVENTARIO
-- =============================================

-- 16. Stock bajo por producto
SELECT
    p.codigo,
    p.descripcion,
    ss.cantidad AS stockActual,
    p.alertaMinimo,
    c.nombre AS categoria,
    s.nombre AS sucursal,
    CASE
        WHEN ss.cantidad <= p.alertaMinimo THEN 'CRÍTICO'
        WHEN ss.cantidad <= p.alertaMinimo * 1.5 THEN 'BAJO'
        ELSE 'NORMAL'
    END AS estadoStock
FROM StockSucursal ss
INNER JOIN Productos p ON ss.idProducto = p.idProducto
INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal
WHERE ss.cantidad <= ISNULL(p.alertaMinimo, 0) * 2
  AND ss.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY ss.cantidad;

-- 17. Movimientos de inventario del día
SELECT
    mi.fechaMovimiento,
    mi.tipoMovimiento,
    p.descripcion AS producto,
    mi.cantidad,
    s.nombre AS sucursal,
    uw.nombres + ' ' + uw.apellidos AS usuario,
    mi.observaciones
FROM MovimientosInventario mi
INNER JOIN Productos p ON mi.idProducto = p.idProducto
INNER JOIN Sucursal s ON mi.idSucursal = s.idSucursal
INNER JOIN UsuarioWeb uw ON mi.idUsuario = uw.idUsuario
WHERE CONVERT(DATE, mi.fechaMovimiento) = CONVERT(DATE, GETDATE())
  AND mi.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY mi.fechaMovimiento DESC;

-- =============================================
-- CONSULTAS PARA AUDITORÍA
-- =============================================

-- 18. Actividad de usuarios hoy
SELECT
    uw.nombres + ' ' + uw.apellidos AS usuario,
    au.accion,
    au.tablaAfectada,
    au.fechaAccion,
    au.ipAddress
FROM AuditoriaUsuario au
INNER JOIN UsuarioWeb uw ON au.idUsuario = uw.idUsuario
WHERE CONVERT(DATE, au.fechaAccion) = CONVERT(DATE, GETDATE())
  AND au.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY au.fechaAccion DESC;

-- 19. Sesiones activas
SELECT
    uw.nombres + ' ' + uw.apellidos AS usuario,
    s.fechaInicio,
    s.fechaExpiracion,
    s.ipAddress,
    s.userAgent,
    DATEDIFF(MINUTE, GETDATE(), s.fechaExpiracion) AS minutosRestantes
FROM SesionesUsuario s
INNER JOIN UsuarioWeb uw ON s.idUsuario = uw.idUsuario
WHERE s.activo = 1
  AND s.fechaExpiracion > GETDATE()
ORDER BY s.fechaInicio DESC;

-- =============================================
-- CONSULTAS PARA DASHBOARD
-- =============================================

-- 20. KPIs principales del día
SELECT
    -- Ventas del día
    (SELECT COUNT(*) FROM Ventas WHERE CONVERT(DATE, fEmision) = CONVERT(DATE, GETDATE()) AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E') AS ventasHoy,

    -- Monto vendido hoy
    (SELECT ISNULL(SUM(total), 0) FROM Ventas WHERE CONVERT(DATE, fEmision) = CONVERT(DATE, GETDATE()) AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E') AS montoVentasHoy,

    -- Créditos otorgados hoy
    (SELECT COUNT(*) FROM CreditosClientes WHERE CONVERT(DATE, fechaCredito) = CONVERT(DATE, GETDATE()) AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E') AS creditosHoy,

    -- Monto créditos otorgados hoy
    (SELECT ISNULL(SUM(montoTotal), 0) FROM CreditosClientes WHERE CONVERT(DATE, fechaCredito) = CONVERT(DATE, GETDATE()) AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E') AS montoCreditosHoy,

    -- Cobros realizados hoy
    (SELECT ISNULL(SUM(montoPagado), 0) FROM PagosCuotas WHERE CONVERT(DATE, fechaPago) = CONVERT(DATE, GETDATE()) AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E') AS cobrosHoy,

    -- Envíos programados para hoy
    (SELECT COUNT(*) FROM Envios WHERE CONVERT(DATE, fechaProgramada) = CONVERT(DATE, GETDATE()) AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E') AS enviosHoy,

    -- Productos con stock crítico
    (SELECT COUNT(*) FROM StockSucursal ss INNER JOIN Productos p ON ss.idProducto = p.idProducto WHERE ss.cantidad <= ISNULL(p.alertaMinimo, 0) AND ss.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E') AS productosCriticos,

    -- Usuarios activos
    (SELECT COUNT(*) FROM UsuarioWeb WHERE estado = 1 AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E') AS usuariosActivos;

-- =============================================
-- CONSULTAS PARA EXPORTACIÓN/REPORTES
-- =============================================

-- 21. Exportar ventas del mes en formato para Excel
SELECT
    ROW_NUMBER() OVER (ORDER BY v.fEmision) AS nro,
    v.serie + '-' + v.numero AS comprobante,
    CONVERT(VARCHAR(10), v.fEmision, 103) AS fecha,
    c.rSocial AS cliente,
    c.ruc,
    v.subtotal,
    v.igv,
    v.total,
    mp.descripcion AS medioPago,
    uw.nombres + ' ' + uw.apellidos AS vendedor
FROM Ventas v
INNER JOIN Clientes c ON v.idCliente = c.idCliente
LEFT JOIN MediosPago mp ON v.idMediosPago = mp.idMediosPago
INNER JOIN UsuarioWeb uw ON v.idUsuario = uw.idUsuario
WHERE v.fEmision >= DATEADD(MONTH, -1, DATEADD(MONTH, 1, CONVERT(DATE, GETDATE() + '-01')))
  AND v.fEmision < DATEADD(MONTH, 1, CONVERT(DATE, GETDATE() + '-01'))
  AND v.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
ORDER BY v.fEmision;

PRINT 'Ejemplos de consultas ejecutados exitosamente.';
PRINT 'Puedes adaptar estos ejemplos cambiando el ID de empresa según corresponda.';
GO