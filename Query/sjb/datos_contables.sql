-- =============================================
-- DATOS CONTABLES Y FINANCIEROS
-- Configuración contable y datos de ejemplo
-- =============================================

USE SistemaInventario;
GO

-- =============================================
-- CONFIGURACIÓN CONTABLE POR EMPRESA
-- =============================================

INSERT INTO ConfiguracionContable (
    idEmpresa, monedaFuncional, periodoActual, cierreAutomatico,
    digitosCuenta, separadorCuenta, requiereCentroCosto
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    'PEN',
    '202501', -- Enero 2025
    0,
    6,
    '-',
    1 -- Requiere centro de costo
);
GO

-- =============================================
-- CENTROS DE COSTOS
-- =============================================

INSERT INTO CentrosCosto (idCentroCosto, idEmpresa, nombre, descripcion, tipo, nivel, estado) VALUES
('ADM001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'ADMINISTRACIÓN CENTRAL', 'Centro de costos para gastos administrativos generales', 'ADMINISTRACION', 1, 1),
('VEN001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'VENTAS PRINCIPAL', 'Centro de costos para ventas en sucursal principal', 'VENTAS', 1, 1),
('PROD001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'PRODUCCIÓN', 'Centro de costos para procesos productivos', 'PRODUCCION', 1, 1),
('ALM001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'ALMACÉN', 'Centro de costos para operaciones de almacén', 'DISTRIBUCION', 1, 1),
('VEN002', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'VENTAS ONLINE', 'Centro de costos para ventas por internet', 'VENTAS', 2, 1);
GO

-- =============================================
-- PERÍODOS CONTABLES
-- =============================================

-- Crear períodos para los últimos 12 meses
DECLARE @fecha DATE = '2024-01-01';
DECLARE @periodo VARCHAR(6);

WHILE @fecha <= '2025-12-01'
BEGIN
    SET @periodo = CAST(YEAR(@fecha) AS VARCHAR(4)) + RIGHT('00' + CAST(MONTH(@fecha) AS VARCHAR(2)), 2);

    INSERT INTO PeriodosContables (idPeriodo, idEmpresa, descripcion, fechaInicio, fechaFin, estado)
    VALUES (
        @periodo,
        '42099529-43C9-4B7F-921A-3D6FB946E93E',
        'Período ' + @periodo,
        @fecha,
        DATEADD(DAY, -1, DATEADD(MONTH, 1, @fecha)),
        CASE WHEN @fecha < '2025-01-01' THEN 'CERRADO' ELSE 'ABIERTO' END
    );

    SET @fecha = DATEADD(MONTH, 1, @fecha);
END
GO

-- =============================================
-- PLAN DE CUENTAS (ESTRUCTURA BÁSICA)
-- =============================================

-- Activo Corriente
INSERT INTO PlanCuentas (idCuenta, idEmpresa, nombre, tipo, subTipo, nivel, naturaleza, permiteMovimientos) VALUES
('1001-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'CAJA', 'ACTIVO', 'CORRIENTE', 3, 'D', 1),
('1002-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'BANCOS', 'ACTIVO', 'CORRIENTE', 3, 'D', 1),
('1101-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'INVERSIONES TEMPORARIAS', 'ACTIVO', 'CORRIENTE', 3, 'D', 1),
('1201-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'CUENTAS POR COBRAR', 'ACTIVO', 'CORRIENTE', 3, 'D', 1),
('2001-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'INVENTARIOS', 'ACTIVO', 'CORRIENTE', 3, 'D', 1),

-- Activo No Corriente
('1301-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'ACTIVOS FIJOS', 'ACTIVO', 'NO_CORRIENTE', 3, 'D', 1),
('1401-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'DEPRECIACIÓN ACUMULADA', 'ACTIVO', 'NO_CORRIENTE', 3, 'A', 1),

-- Pasivo Corriente
('2101-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'CUENTAS POR PAGAR', 'PASIVO', 'CORRIENTE', 3, 'A', 1),
('2201-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'PRÉSTAMOS BANCARIOS CP', 'PASIVO', 'CORRIENTE', 3, 'A', 1),

-- Pasivo No Corriente
('2301-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'PRÉSTAMOS BANCARIOS LP', 'PASIVO', 'NO_CORRIENTE', 3, 'A', 1),

-- Patrimonio
('3101-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'CAPITAL SOCIAL', 'PATRIMONIO', NULL, 3, 'A', 1),
('3201-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'UTILIDADES ACUMULADAS', 'PATRIMONIO', NULL, 3, 'A', 1),

-- Ingresos
('4101-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'VENTAS NACIONALES', 'INGRESO', NULL, 3, 'A', 1),
('4201-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'VENTAS EXPORTACIÓN', 'INGRESO', NULL, 3, 'A', 1),
('4301-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'OTROS INGRESOS', 'INGRESO', NULL, 3, 'A', 1),

-- Costos y Gastos
('5101-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'COSTO DE VENTAS', 'EGRESO', 'COSTO_VENTAS', 3, 'D', 1),
('5201-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'GASTOS ADMINISTRATIVOS', 'EGRESO', 'GASTOS_ADMIN', 3, 'D', 1),
('5301-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'GASTOS DE VENTAS', 'EGRESO', 'GASTOS_VENTAS', 3, 'D', 1),
('5401-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'GASTOS FINANCIEROS', 'EGRESO', 'GASTOS_FINANCIEROS', 3, 'D', 1),
('5501-001', '42099529-43C9-4B7F-921A-3D6FB946E93E', 'IMPUESTOS', 'EGRESO', 'GASTOS_ADMIN', 3, 'D', 1);
GO

-- =============================================
-- CUENTAS BANCARIAS
-- =============================================

INSERT INTO CuentasBancarias (
    idEmpresa, nombreBanco, numeroCuenta, tipoCuenta, moneda, saldoActual, fechaApertura, idCuentaContable
) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'BANCO DE CRÉDITO', '0011-1234-5678-9012', 'CORRIENTE', 'PEN', 15000.00, '2024-01-15', '1002-001'),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'BANCO CONTINENTAL', '0021-9876-5432-1098', 'AHORROS', 'PEN', 25000.00, '2024-02-01', '1002-001');
GO

-- =============================================
-- ACTIVOS FIJOS
-- =============================================

INSERT INTO ActivosFijos (
    idEmpresa, codigo, nombre, descripcion, idCategoria, fechaAdquisicion,
    costoAdquisicion, valorResidual, vidaUtilMeses, idCuentaContable, idCentroCosto
) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'AF001', 'EQUIPO DE COMPUTO', 'Laptop Dell Inspiron', 'EQUIPOS', '2024-01-15', 3500.00, 350.00, 36, '1301-001', 'ADM001'),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'AF002', 'ESTANTERÍA METÁLICA', 'Estantería para almacén', 'MUEBLES', '2024-03-01', 2500.00, 250.00, 60, '1301-001', 'ALM001'),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'AF003', 'VEHÍCULO DE REPARTO', 'Moto Honda CB190R', 'VEHICULOS', '2024-06-15', 12000.00, 1200.00, 48, '1301-001', 'VEN001');
GO

-- =============================================
-- PRESUPUESTOS
-- =============================================

-- Presupuesto de ingresos 2025
DECLARE @idPresupuestoIngresos UNIQUEIDENTIFIER = NEWID();

INSERT INTO Presupuestos (
    idPresupuesto, idEmpresa, nombre, descripcion, tipo, periodoInicio, periodoFin,
    estado, idUsuarioCreacion
) VALUES (
    @idPresupuestoIngresos,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    'PRESUPUESTO INGRESOS 2025',
    'Presupuesto de ingresos anual 2025',
    'INGRESOS',
    '202501',
    '202512',
    'APROBADO',
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com')
);
GO

-- Detalle del presupuesto de ingresos
INSERT INTO DetallePresupuestos (
    idPresupuesto, idEmpresa, periodo, idCuenta, montoPresupuestado
)
SELECT
    p.idPresupuesto,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    pc.periodo,
    '4101-001', -- Ventas nacionales
    50000.00 -- 50 mil soles mensuales
FROM Presupuestos p
CROSS JOIN PeriodosContables pc
WHERE p.nombre = 'PRESUPUESTO INGRESOS 2025'
  AND pc.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND pc.periodo LIKE '2025%';
GO

-- =============================================
-- ASIENTOS CONTABLES DE EJEMPLO
-- =============================================

-- Asiento de apertura (enero 2025)
DECLARE @idAsientoApertura BIGINT;

INSERT INTO AsientosContables (
    idEmpresa, periodo, numeroAsiento, fechaAsiento, concepto, origen,
    idUsuarioCreacion, totalDebe, totalHaber
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '202501',
    1,
    '2025-01-01',
    'ASIENTO DE APERTURA',
    'MANUAL',
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    100000.00,
    100000.00
);

SET @idAsientoApertura = SCOPE_IDENTITY();

-- Detalle del asiento de apertura
INSERT INTO DetalleAsientos (
    idAsiento, idEmpresa, linea, idCuenta, debe, haber, concepto, idCentroCosto
) VALUES
-- Activo
(@idAsientoApertura, '42099529-43C9-4B7F-921A-3D6FB946E93E', 1, '1001-001', 5000.00, 0, 'Saldo inicial caja', 'ADM001'),
(@idAsientoApertura, '42099529-43C9-4B7F-921A-3D6FB946E93E', 2, '1002-001', 40000.00, 0, 'Saldo inicial bancos', 'ADM001'),
(@idAsientoApertura, '42099529-43C9-4B7F-921A-3D6FB946E93E', 3, '2001-001', 25000.00, 0, 'Saldo inicial inventarios', 'ALM001'),
(@idAsientoApertura, '42099529-43C9-4B7F-921A-3D6FB946E93E', 4, '1301-001', 25000.00, 0, 'Saldo inicial activos fijos', 'ADM001'),
-- Pasivo y Patrimonio
(@idAsientoApertura, '42099529-43C9-4B7F-921A-3D6FB946E93E', 5, '2101-001', 0, 10000.00, 'Saldo inicial proveedores', NULL),
(@idAsientoApertura, '42099529-43C9-4B7F-921A-3D6FB946E93E', 6, '3101-001', 0, 75000.00, 'Capital social', NULL),
(@idAsientoApertura, '42099529-43C9-4B7F-921A-3D6FB946E93E', 7, '3201-001', 0, 15000.00, 'Utilidades acumuladas', NULL);

-- Aprobar el asiento
UPDATE AsientosContables
SET estado = 'CONTABILIZADO',
    idUsuarioAprobacion = (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    fechaAprobacion = GETDATE()
WHERE idAsiento = @idAsientoApertura AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E';
GO

-- Asiento de venta de ejemplo
DECLARE @idAsientoVenta BIGINT;

INSERT INTO AsientosContables (
    idEmpresa, periodo, numeroAsiento, fechaAsiento, concepto, origen, idDocumentoRelacionado,
    idUsuarioCreacion, totalDebe, totalHaber
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '202501',
    2,
    '2025-01-15',
    'VENTA AL CONTADO FACTURA F001-00000001',
    'VENTA',
    'F001-00000001',
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    118.00,
    118.00
);

SET @idAsientoVenta = SCOPE_IDENTITY();

-- Detalle del asiento de venta
INSERT INTO DetalleAsientos (
    idAsiento, idEmpresa, linea, idCuenta, debe, haber, concepto, idCentroCosto
) VALUES
(@idAsientoVenta, '42099529-43C9-4B7F-921A-3D6FB946E93E', 1, '1001-001', 118.00, 0, 'Cobro venta contado', 'VEN001'),
(@idAsientoVenta, '42099529-43C9-4B7F-921A-3D6FB946E93E', 2, '4101-001', 0, 100.00, 'Venta productos', 'VEN001'),
(@idAsientoVenta, '42099529-43C9-4B7F-921A-3D6FB946E93E', 3, '5501-001', 0, 18.00, 'IGV 18%', 'VEN001');

-- Aprobar el asiento
UPDATE AsientosContables
SET estado = 'CONTABILIZADO',
    idUsuarioAprobacion = (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    fechaAprobacion = GETDATE()
WHERE idAsiento = @idAsientoVenta AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E';
GO

-- =============================================
-- MOVIMIENTOS BANCARIOS DE EJEMPLO
-- =============================================

INSERT INTO MovimientosBancarios (
    idCuentaBancaria, idEmpresa, fechaMovimiento, tipo, monto, descripcion,
    numeroDocumento, saldoAnterior, saldoNuevo, idUsuarioRegistro
) VALUES
(
    (SELECT idCuentaBancaria FROM CuentasBancarias WHERE numeroCuenta = '0011-1234-5678-9012'),
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '2025-01-15',
    'ABONO',
    118.00,
    'Depósito venta factura F001-00000001',
    'F001-00000001',
    15000.00,
    15118.00,
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com')
),
(
    (SELECT idCuentaBancaria FROM CuentasBancarias WHERE numeroCuenta = '0011-1234-5678-9012'),
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '2025-01-20',
    'CARGO',
    500.00,
    'Pago servicios básicos',
    'REC-001',
    15118.00,
    14618.00,
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com')
);
GO

-- =============================================
-- DEPRESIACIÓN DE ACTIVOS FIJOS
-- =============================================

-- Depreciación enero 2025
INSERT INTO DepreciacionActivos (
    idActivoFijo, idEmpresa, periodo, fechaDepreciacion, depreciacionMensual,
    depreciacionAcumulada, valorActual
) VALUES
(
    (SELECT idActivoFijo FROM ActivosFijos WHERE codigo = 'AF001'),
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '202501',
    '2025-01-31',
    89.86, -- (3500-350)/36 meses
    89.86,
    3410.14
),
(
    (SELECT idActivoFijo FROM ActivosFijos WHERE codigo = 'AF002'),
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '202501',
    '2025-01-31',
    37.50, -- (2500-250)/60 meses
    37.50,
    2462.50
),
(
    (SELECT idActivoFijo FROM ActivosFijos WHERE codigo = 'AF003'),
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '202501',
    '2025-01-31',
    225.00, -- (12000-1200)/48 meses
    225.00,
    11775.00
);
GO

-- Actualizar depreciación acumulada en activos fijos
UPDATE ActivosFijos
SET depreciacionAcumulada = depreciacionAcumulada + (
    SELECT depreciacionMensual
    FROM DepreciacionActivos
    WHERE idActivoFijo = ActivosFijos.idActivoFijo
      AND periodo = '202501'
),
valorActual = costoAdquisicion - (depreciacionAcumulada + (
    SELECT depreciacionMensual
    FROM DepreciacionActivos
    WHERE idActivoFijo = ActivosFijos.idActivoFijo
      AND periodo = '202501'
)),
fechaUltimaDepreciacion = '2025-01-31'
WHERE idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E';
GO

PRINT 'Datos contables y financieros insertados correctamente.';
PRINT 'Ahora puedes consultar estados financieros, ratios y análisis de rentabilidad.';
PRINT 'Ejecuta el archivo analisis_financiero.sql para crear las vistas de análisis.';
GO