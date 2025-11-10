-- =========================================================
-- 1. CATÁLOGO DE FORMAS DE PAGO (ampliado)
-- =========================================================

CREATE TABLE FormasPago (
    idFormaPago INT IDENTITY(1,1) PRIMARY KEY,
    descripcion VARCHAR(50) NOT NULL UNIQUE, -- Efectivo, Yape, Plin, Transferencia, Tarjeta Visa, etc.
    tipo VARCHAR(20) NOT NULL, -- EFECTIVO, DIGITAL, BANCARIO, TARJETA
    requiereReferencia BIT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1
);

select * from FormasPago
-- Valores iniciales
INSERT INTO FormasPago (descripcion, tipo, requiereReferencia) VALUES
('Efectivo', 'EFECTIVO', 0),
('Yape', 'DIGITAL', 1),
('Plin', 'DIGITAL', 1),
('Transferencia', 'BANCARIO', 1),
('Tarjeta Visa', 'TARJETA', 1),
('Tarjeta Mastercard', 'TARJETA', 1),
('Pago en Oficina', 'BANCARIO', 0),
('Cheque', 'BANCARIO', 1);

-- =========================================================
-- 2. CABECERA DE CORTE DE CAJA
-- =========================================================
CREATE TABLE Caja (
    idCaja INT IDENTITY(1,1) PRIMARY KEY,
    idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa),
    idSucursal UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Sucursal(idSucursal) ON DELETE CASCADE, -- IMPORTANTE: caja por sucursal
    idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES usuarioweb(idUsuario) NOT NULL, -- Quien abre/cierra
    fecha DATE NOT NULL,
    
    -- Montos de apertura
    montoApertura DECIMAL(18,2) NOT NULL DEFAULT 0,
    montoAperturaEfectivo DECIMAL(18,2) NOT NULL DEFAULT 0,
    montoAperturaDigital DECIMAL(18,2) NOT NULL DEFAULT 0,
    
    -- Montos de cierre (se calculan al cerrar)
    montoCierre DECIMAL(18,2) NOT NULL DEFAULT 0,
    montoCierreEfectivo DECIMAL(18,2) NOT NULL DEFAULT 0,
    montoCierreDigital DECIMAL(18,2) NOT NULL DEFAULT 0,
    
    -- Totales del día
    totalVentas DECIMAL(18,2) NOT NULL DEFAULT 0,
    totalCobrosCreditos DECIMAL(18,2) NOT NULL DEFAULT 0,
    totalIngresos DECIMAL(18,2) NOT NULL DEFAULT 0,
    totalEgresos DECIMAL(18,2) NOT NULL DEFAULT 0,
    totalPagosCreditos DECIMAL(18,2) NOT NULL DEFAULT 0, -- Pagos a proveedores
    
    -- Estado y auditoría
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('ABIERTO', 'CERRADO')), 
    fechaApertura DATETIME NOT NULL DEFAULT GETDATE(),
    fechaCierre DATETIME NULL,
    
    UNIQUE(idEmpresa, idSucursal, fecha) -- Solo un corte por día y sucursal
);

-- Índices para rendimiento
CREATE INDEX IX_Caja_EmpresaFecha ON Caja(idEmpresa, fecha);
CREATE INDEX IX_Caja_Estado ON Caja(estado) WHERE estado = 'ABIERTO';

-- =========================================================
-- 3. DETALLE DE MOVIMIENTOS DE CAJA (ESTA ES LA CLAVE)
-- =========================================================
CREATE TABLE CajaMovimientos (
    idMovimiento INT IDENTITY(1,1) PRIMARY KEY,
    idCaja INT FOREIGN KEY REFERENCES Caja(idCaja) ON DELETE CASCADE,
    
    -- Relación con entidades (solo una debe ser NOT NULL)
    idVenta INT NULL FOREIGN KEY REFERENCES Ventas(idVenta),
    -- idCuentaPorCobrar INT NULL FOREIGN KEY REFERENCES CuentasPorCobrar(idCuentaPorCobrar), -- Si tienes tabla de créditos
    
    -- Para ingresos/egresos varios
    idTipoMovimiento INT NOT NULL, -- 1:VENTA, 2:COBRO_CREDITO, 3:INGRESO, 4:EGRESO, 5:PAGO_CREDITO_PROV
    concepto VARCHAR(255) NULL, -- Descripción del movimiento
    
    -- Datos del movimiento
    idFormaPago INT NOT NULL FOREIGN KEY REFERENCES FormasPago(idFormaPago),
    monto DECIMAL(18,2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN', -- PEN, USD
    fechaHora DATETIME NOT NULL DEFAULT GETDATE(),
    
    -- Referencia y auditoría
    idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES usuarioweb(idUsuario) NOT NULL,
    referencia VARCHAR(100) NULL, -- Número de operación, voucher, etc.
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('ACTIVO', 'ANULADO')) DEFAULT 'ACTIVO',
    
    -- Para facilitar reportes
    esVentaContado BIT NOT NULL DEFAULT 0,
    esVentaCredito BIT NOT NULL DEFAULT 0,
    esCobroCredito BIT NOT NULL DEFAULT 0
);

-- Índices CRÍTICOS para rendimiento
CREATE INDEX IX_CajaMovimientos_IdCaja ON CajaMovimientos(idCaja);
CREATE INDEX IX_CajaMovimientos_Fecha ON CajaMovimientos(fechaHora);
CREATE INDEX IX_CajaMovimientos_FormaPago ON CajaMovimientos(idFormaPago);
CREATE INDEX IX_CajaMovimientos_Tipo ON CajaMovimientos(idTipoMovimiento);
CREATE INDEX IX_CajaMovimientos_Venta ON CajaMovimientos(idVenta) WHERE idVenta IS NOT NULL;
CREATE INDEX IX_CajaMovimientos_Estado ON CajaMovimientos(estado) WHERE estado = 'ACTIVO';

-- =========================================================
-- 4. CATÁLOGO DE TIPOS DE MOVIMIENTO
-- =========================================================
CREATE TABLE TiposMovimientoCaja (
    idTipoMovimiento INT IDENTITY(1,1) PRIMARY KEY,
    descripcion VARCHAR(50) NOT NULL UNIQUE,
    afectaCaja CHAR(1) NOT NULL CHECK (afectaCaja IN ('I', 'E', 'N')), -- I:Ingreso, E:Egreso, N:No afecta
    requiereVenta BIT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1
);

INSERT INTO TiposMovimientoCaja (descripcion, afectaCaja, requiereVenta) VALUES
('VENTA_CONTADO', 'I', 1),
('VENTA_CREDITO', 'N', 1), -- No afecta caja inmediato
('COBRO_CREDITO', 'I', 0),
('INGRESO_VARIO', 'I', 0),
('EGRESO_VARIO', 'E', 0),
('PAGO_CREDITO_PROVEEDOR', 'E', 0);

-- =========================================================
-- 5. VISTAS PARA REPORTES (muy útiles)
-- =========================================================
CREATE VIEW vw_CajaResumenPorFormaPago AS
SELECT 
    cm.idCaja,
    fp.descripcion AS formaPago,
    fp.tipo,
    SUM(cm.monto) AS total,
    COUNT(*) AS cantidadTransacciones
FROM CajaMovimientos cm
INNER JOIN FormasPago fp ON cm.idFormaPago = fp.idFormaPago
WHERE cm.estado = 'ACTIVO' 
  AND cm.idTipoMovimiento IN (1, 3) -- Solo ingresos
GROUP BY cm.idCaja, fp.descripcion, fp.tipo;

CREATE VIEW vw_CajaCuadreDiario AS
SELECT 
    c.idCaja,
    c.idSucursal,
    c.fecha,
    c.estado,
    -- Ingresos
    (SELECT SUM(monto) FROM CajaMovimientos WHERE idCaja = c.idCaja AND idTipoMovimiento IN (1, 3) AND estado = 'ACTIVO') AS totalIngresos,
    -- Egresos
    (SELECT SUM(monto) FROM CajaMovimientos WHERE idCaja = c.idCaja AND idTipoMovimiento IN (4, 5) AND estado = 'ACTIVO') AS totalEgresos,
    -- Saldo
    c.montoApertura + 
    (SELECT SUM(monto) FROM CajaMovimientos WHERE idCaja = c.idCaja AND afectaCaja = 'I' AND estado = 'ACTIVO') -
    (SELECT SUM(monto) FROM CajaMovimientos WHERE idCaja = c.idCaja AND afectaCaja = 'E' AND estado = 'ACTIVO') AS saldoTeorico
FROM Caja c;

-- =========================================================
-- 6. PROCEDIMIENTO PARA CERRAR CAJA (ejemplo)
-- =========================================================
CREATE PROCEDURE sp_CerrarCaja
    @idCaja INT,
    @idUsuario UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRANSACTION;
    
    -- Calcular totales
    UPDATE c
    SET 
        montoCierre = 
            c.montoApertura + 
            (SELECT SUM(monto) FROM CajaMovimientos WHERE idCaja = @idCaja AND afectaCaja = 'I' AND estado = 'ACTIVO') -
            (SELECT SUM(monto) FROM CajaMovimientos WHERE idCaja = @idCaja AND afectaCaja = 'E' AND estado = 'ACTIVO'),
        montoCierreEfectivo = 
            (SELECT SUM(monto) FROM CajaMovimientos cm JOIN FormasPago fp ON cm.idFormaPago = fp.idFormaPago 
             WHERE cm.idCaja = @idCaja AND fp.tipo = 'EFECTIVO' AND cm.estado = 'ACTIVO'),
        totalVentas = (SELECT SUM(monto) FROM CajaMovimientos WHERE idCaja = @idCaja AND idTipoMovimiento = 1 AND estado = 'ACTIVO'),
        totalCobrosCreditos = (SELECT SUM(monto) FROM CajaMovimientos WHERE idCaja = @idCaja AND idTipoMovimiento = 2 AND estado = 'ACTIVO'),
        estado = 'CERRADO',
        fechaCierre = GETDATE()
    FROM Caja c
    WHERE c.idCaja = @idCaja AND c.estado = 'ABIERTO';
    
    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK;
        RAISERROR('Caja no existe o ya está cerrada', 16, 1);
        RETURN;
    END
    
    COMMIT;
END


---////////////////////////////////////////////////////////////////////////////////////
---EJEMPLOS DE USO
---///////////////////////////////////////////////////////////////////////////////////

-- Al registrar una venta al contado
const movimientos = [
  { idFormaPago: 1, monto: 50, esVentaContado: 1 }, // Efectivo
  { idFormaPago: 3, monto: 50, esVentaContado: 1 }  // Transferencia
];

-- Al cobrar un crédito
const movimiento = {
  idVenta: 123,
  idTipoMovimiento: 3, -- COBRO_CREDITO
  idFormaPago: 1, -- Efectivo
  monto: 100,
  esCobroCredito: 1
};



-- =========================================================
-- TABLA DE CONTEO DE EFECTIVO (BILLETES/MONEDAS)
-- =========================================================
CREATE TABLE CajaConteoEfectivo (
    idConteo INT IDENTITY(1,1) PRIMARY KEY,
    idCaja INT FOREIGN KEY REFERENCES Caja(idCaja) ON DELETE CASCADE,
    
    tipoConteo VARCHAR(20) NOT NULL CHECK (tipoConteo IN ('APERTURA', 'CIERRE')), -- Momento del conteo
    denominacion DECIMAL(10,2) NOT NULL, -- 0.10, 0.20, 1, 5, 10, 20, 50, 100, 200
    cantidad INT NOT NULL DEFAULT 0, -- Unidades contadas
    
    tipoMoneda VARCHAR(10) NOT NULL CHECK (tipoMoneda IN ('MONEDA', 'BILLETE')),
    
    total AS (denominacion * cantidad) PERSISTED, -- Calculado automáticamente
    
    idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES usuarioweb(idUsuario) NOT NULL, -- Quién contó
    fechaHora DATETIME NOT NULL DEFAULT GETDATE(),
    
    UNIQUE(idCaja, tipoConteo, denominacion) -- Solo un registro por denominación por conteo
);

-- Índice para rendimiento
CREATE INDEX IX_CajaConteoEfectivo_Caja ON CajaConteoEfectivo(idCaja, tipoConteo);