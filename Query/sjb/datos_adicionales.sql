-- =============================================
-- DATOS ADICIONALES PARA FUNCIONALIDADES AVANZADAS
-- Sistema de Caja, Créditos, Despachos, Envíos y Facturación Electrónica
-- =============================================

USE SistemaInventario;
GO

-- =============================================
-- DATOS PARA SISTEMA DE CAJA
-- =============================================

-- Tipos de movimiento de caja
INSERT INTO TiposMovimientoCaja (nombre, descripcion, tipo) VALUES
('VENTA_CONTADO', 'Ingreso por venta al contado', 'I'),
('VENTA_CREDITO', 'Ingreso por venta a crédito', 'I'),
('PAGO_CUOTA', 'Ingreso por pago de cuota', 'I'),
('INGRESO_EXTRA', 'Ingreso extraordinario', 'I'),
('COMPRA_CONTADO', 'Egreso por compra al contado', 'E'),
('GASTO_ADMINISTRATIVO', 'Egreso por gastos administrativos', 'E'),
('GASTO_OPERATIVO', 'Egreso por gastos operativos', 'E'),
('PAGO_SERVICIOS', 'Egreso por pago de servicios', 'E'),
('RETIRO_EFECTIVO', 'Egreso por retiro de efectivo', 'E');
GO

-- Cajas por empresa
INSERT INTO Cajas (idEmpresa, idSucursal, nombre, descripcion, estado) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', '9D8B5A3C-1E2F-4G5H-6I7J-8K9L0M1N2O3P', 'CAJA PRINCIPAL', 'Caja principal de la sucursal', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', '9D8B5A3C-1E2F-4G5H-6I7J-8K9L0M1N2O3P', 'CAJA SECUNDARIA', 'Caja secundaria para entregas', 1);
GO

-- =============================================
-- DATOS PARA SISTEMA DE DESPACHOS
-- =============================================

-- Tipos de despacho
INSERT INTO TiposDespacho (nombre, descripcion, requiereCantidad) VALUES
('AUTOMATICO', 'Despacho automático al registrar venta', 0),
('CONTROLADO', 'Despacho controlado con cantidades específicas', 1),
('PARCIAL', 'Despacho parcial de productos', 1);
GO

-- =============================================
-- DATOS PARA SISTEMA DE ENVIOS
-- =============================================

-- Tipos de envío
INSERT INTO TiposEnvio (nombre, descripcion, costoBase, requiereTransportista) VALUES
('DELIVERY_LOCAL', 'Delivery dentro de la ciudad', 5.00, 1),
('DELIVERY_PROVINCIAL', 'Delivery a otras provincias', 15.00, 1),
('SERVICIO_OBRA', 'Servicio de transporte a obra', 25.00, 1),
('RETIRO_TIENDA', 'Retiro en tienda (sin envío)', 0.00, 0);
GO

-- Estados de envío
INSERT INTO EstadosEnvio (nombre, descripcion, color, orden) VALUES
('AGENDADO', 'Envío agendado para entrega', '#FFA500', 1),
('EN_PREPARACION', 'Preparando productos para envío', '#0000FF', 2),
('EN_CAMINO', 'Producto en camino hacia destino', '#800080', 3),
('ENTREGADO', 'Producto entregado exitosamente', '#008000', 4),
('DEVUELTO', 'Producto devuelto al remitente', '#FF0000', 5),
('CANCELADO', 'Envío cancelado', '#808080', 6);
GO

-- Tipos de envío
INSERT INTO TiposEnvio (nombre, descripcion, costoBase, requiereTransportista) VALUES
('DELIVERY_LOCAL', 'Delivery dentro de la ciudad', 5.00, 1),
('DELIVERY_PROVINCIAL', 'Delivery a otras provincias', 15.00, 1),
('SERVICIO_OBRA', 'Servicio de transporte a obra', 25.00, 1),
('RETIRO_TIENDA', 'Retiro en tienda (sin envío)', 0.00, 0);
GO

-- Transportistas de ejemplo
INSERT INTO Transportistas (idEmpresa, nombres, apellidos, documento, licencia, celular, email, vehiculo, placa) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'JUAN', 'PEREZ GARCIA', '12345678', 'LIC123456', '987654321', 'juan.perez@empresa.com', 'CAMIONETA TOYOTA', 'ABC-123'),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'MARIA', 'LOPEZ TORRES', '87654321', 'LIC654321', '912345678', 'maria.lopez@empresa.com', 'MOTO LINEAL', 'XYZ-789');
GO

-- =============================================
-- DATOS PARA FACTURACIÓN ELECTRÓNICA
-- =============================================

-- Estados de SUNAT
INSERT INTO EstadosSunat (codigo, descripcion, requiereAccion) VALUES
('01', 'Aceptado', 0),
('02', 'Enviado a SUNAT', 0),
('03', 'Aceptado con observaciones', 0),
('04', 'Rechazado', 1),
('05', 'En proceso', 0),
('06', 'Error de envío', 1),
('07', 'Pendiente de envío', 0),
('08', 'Baja aceptada', 0),
('09', 'Baja rechazada', 1);
GO

-- Configuración de facturación electrónica
INSERT INTO ConfiguracionFacturacionElectronica (
    idEmpresa, modoPrueba, serieFactura, serieBoleta, serieNotaCredito, serieNotaDebito
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    1, -- Modo pruebas
    'F001',
    'B001',
    'FC01',
    'FD01'
);
GO

-- =============================================
-- DATOS DE EJEMPLO PARA PRUEBAS
-- =============================================

-- Apertura de caja de ejemplo
DECLARE @idAperturaEjemplo UNIQUEIDENTIFIER = NEWID();
EXEC sp_AbrirCaja
    @idCaja = '12345678-1234-1234-1234-123456789012', -- Ajustar con ID real de caja
    @idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E',
    @idSucursal = '9D8B5A3C-1E2F-4G5H-6I7J-8K9L0M1N2O3P',
    @idUsuario = (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    @montoInicial = 500.00,
    @observaciones = 'Apertura de caja del día',
    @idApertura = @idAperturaEjemplo OUTPUT;

-- Movimiento de caja de ejemplo
EXEC sp_RegistrarMovimientoCaja
    @idApertura = @idAperturaEjemplo,
    @idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E',
    @idSucursal = '9D8B5A3C-1E2F-4G5H-6I7J-8K9L0M1N2O3P',
    @idUsuario = (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    @idTipoMovimientoCaja = 1, -- VENTA_CONTADO
    @concepto = 'Venta de cable eléctrico',
    @monto = 120.00,
    @idMediosPago = (SELECT idMediosPago FROM MediosPago WHERE codigo = '009'), -- CONTADO
    @documentoRelacionado = 'B001-00000001';
GO

-- Crédito de ejemplo
DECLARE @idCreditoEjemplo UNIQUEIDENTIFIER = NEWID();

INSERT INTO CreditosClientes (
    idCredito, idEmpresa, idCliente, idUsuarioCredito,
    fechaCredito, montoTotal, plazoDias, tasaInteres, estado
) VALUES (
    @idCreditoEjemplo,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    (SELECT idCliente FROM Clientes WHERE ruc = '20123456789'),
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    GETDATE(),
    1000.00,
    90, -- 90 días
    2.5, -- 2.5% mensual
    'ACTIVO'
);
GO

-- Cuotas del crédito (3 cuotas mensuales)
INSERT INTO CuotasCredito (
    idCredito, idEmpresa, numeroCuota, fechaVencimiento,
    montoCuota, interes, capital, saldoPendiente, estado
) VALUES
(
    @idCreditoEjemplo,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    1,
    DATEADD(MONTH, 1, GETDATE()),
    341.67, -- 1000 / 3 + interés
    8.33,
    333.34,
    341.67,
    'PENDIENTE'
),
(
    @idCreditoEjemplo,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    2,
    DATEADD(MONTH, 2, GETDATE()),
    341.67,
    8.33,
    333.34,
    341.67,
    'PENDIENTE'
),
(
    @idCreditoEjemplo,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    3,
    DATEADD(MONTH, 3, GETDATE()),
    341.67,
    8.33,
    333.34,
    341.67,
    'PENDIENTE'
);
GO

-- Comprobante electrónico de ejemplo
INSERT INTO ComprobantesElectronicos (
    idEmpresa, tipoComprobante, serie, numero,
    fechaEmision, idEstadoSunat, hash
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '01', -- Factura
    'F001',
    '00000001',
    GETDATE(),
    7, -- Pendiente de envío
    'ABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA'
);
GO

PRINT 'Datos adicionales insertados correctamente.';
PRINT 'Sistema completo listo para usar.';
GO