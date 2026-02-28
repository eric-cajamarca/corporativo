-- Migración: Rubros, ConfiguracionRubro, idRubro en Empresas, VD, ValesDespacho, AnticiposCliente, ConvenioCliente
-- Ejecutar una sola vez.

-- ========== 1. Rubros (catálogo global) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Rubros')
BEGIN
    CREATE TABLE Rubros (
        idRubro INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
        codigo VARCHAR(10) NOT NULL UNIQUE,
        nombre VARCHAR(80) NOT NULL,
        descripcion VARCHAR(200) NULL,
        activo BIT NOT NULL DEFAULT 1
    );
END
GO

-- ========== 2. ConfiguracionRubro (clave/valor por rubro) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConfiguracionRubro')
BEGIN
    CREATE TABLE ConfiguracionRubro (
        idConfiguracionRubro INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
        idRubro INT NOT NULL,
        clave VARCHAR(100) NOT NULL,
        valor VARCHAR(500) NOT NULL,
        descripcion VARCHAR(200) NULL,
        CONSTRAINT FK_ConfiguracionRubro_Rubros FOREIGN KEY (idRubro) REFERENCES Rubros(idRubro) ON DELETE CASCADE,
        CONSTRAINT UQ_ConfiguracionRubro_RubroClave UNIQUE (idRubro, clave)
    );
END
GO

-- ========== 3. idRubro en Empresas ==========
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Empresas' AND COLUMN_NAME = 'idRubro')
BEGIN
    ALTER TABLE Empresas ADD idRubro INT NULL;
    ALTER TABLE Empresas ADD CONSTRAINT FK_Empresas_Rubros FOREIGN KEY (idRubro) REFERENCES Rubros(idRubro);
END
GO

-- ========== 4. Datos iniciales Rubros ==========
IF NOT EXISTS (SELECT 1 FROM Rubros WHERE codigo = 'GRF')
    INSERT INTO Rubros (codigo, nombre, descripcion, activo) VALUES ('GRF', 'Grifo', 'Estación de servicio; vale de despacho, liquidación, galones.', 1);
IF NOT EXISTS (SELECT 1 FROM Rubros WHERE codigo = 'FERR')
    INSERT INTO Rubros (codigo, nombre, descripcion, activo) VALUES ('FERR', 'Ferretería', 'Facturación estándar; tope 22 líneas por factura.', 1);
IF NOT EXISTS (SELECT 1 FROM Rubros WHERE codigo = 'RETAIL')
    INSERT INTO Rubros (codigo, nombre, descripcion, activo) VALUES ('RETAIL', 'Retail / Comercio', 'Facturación estándar; tope 22 líneas.', 1);
IF NOT EXISTS (SELECT 1 FROM Rubros WHERE codigo = 'HOTEL')
    INSERT INTO Rubros (codigo, nombre, descripcion, activo) VALUES ('HOTEL', 'Hoteles', 'Ventas adaptadas a hospedaje y consumo.', 1);
IF NOT EXISTS (SELECT 1 FROM Rubros WHERE codigo = 'ROPA')
    INSERT INTO Rubros (codigo, nombre, descripcion, activo) VALUES ('ROPA', 'Venta de ropa', 'Ventas con tallas y variantes.', 1);
IF NOT EXISTS (SELECT 1 FROM Rubros WHERE codigo = 'REST')
    INSERT INTO Rubros (codigo, nombre, descripcion, activo) VALUES ('REST', 'Restaurantes', 'Ventas por mesa y comandas.', 1);
IF NOT EXISTS (SELECT 1 FROM Rubros WHERE codigo = 'GEN')
    INSERT INTO Rubros (codigo, nombre, descripcion, activo) VALUES ('GEN', 'General', 'Sin flujo especial; venta estándar.', 1);
GO

-- ========== 5. ConfiguracionRubro por defecto (usa codigo rubro para componenteVentas) ==========
DECLARE @idGRF INT = (SELECT idRubro FROM Rubros WHERE codigo = 'GRF');
DECLARE @idFERR INT = (SELECT idRubro FROM Rubros WHERE codigo = 'FERR');
DECLARE @idRETAIL INT = (SELECT idRubro FROM Rubros WHERE codigo = 'RETAIL');
DECLARE @idHOTEL INT = (SELECT idRubro FROM Rubros WHERE codigo = 'HOTEL');
DECLARE @idROPA INT = (SELECT idRubro FROM Rubros WHERE codigo = 'ROPA');
DECLARE @idREST INT = (SELECT idRubro FROM Rubros WHERE codigo = 'REST');
DECLARE @idGEN INT = (SELECT idRubro FROM Rubros WHERE codigo = 'GEN');

IF @idGRF IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idGRF AND clave = 'usaValeDespacho') INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idGRF, 'usaValeDespacho', 'true');
    IF NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idGRF AND clave = 'usaAnticipo') INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idGRF, 'usaAnticipo', 'true');
    IF NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idGRF AND clave = 'codigoUnidadPrincipal') INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idGRF, 'codigoUnidadPrincipal', 'WG');
    IF NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idGRF AND clave = 'componenteVentas') INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idGRF, 'componenteVentas', 'grifo');
END
IF @idFERR IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idFERR AND clave = 'maxLineasPorFactura') INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idFERR, 'maxLineasPorFactura', '22');
    IF NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idFERR AND clave = 'componenteVentas') INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idFERR, 'componenteVentas', 'estandar');
END
IF @idRETAIL IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idRETAIL AND clave = 'maxLineasPorFactura') INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idRETAIL, 'maxLineasPorFactura', '22');
    IF NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idRETAIL AND clave = 'componenteVentas') INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idRETAIL, 'componenteVentas', 'estandar');
END
IF @idHOTEL IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idHOTEL AND clave = 'componenteVentas')
    INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idHOTEL, 'componenteVentas', 'hoteles');
IF @idROPA IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idROPA AND clave = 'componenteVentas')
    INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idROPA, 'componenteVentas', 'ropa');
IF @idREST IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idREST AND clave = 'componenteVentas')
    INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idREST, 'componenteVentas', 'restaurantes');
IF @idGEN IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ConfiguracionRubro WHERE idRubro = @idGEN AND clave = 'componenteVentas')
    INSERT INTO ConfiguracionRubro (idRubro, clave, valor) VALUES (@idGEN, 'componenteVentas', 'estandar');
GO

-- ========== 6. Comprobante VD (Vale Despacho) - se agrega por empresa vía backend al crear empresa; aquí solo documentamos) ==========
-- El backend en crearComprobantesPredeterminados debe incluir: { codigo: 'VD', nombre: 'Vale Despacho', serie: 'VD01', numero: 0, activo: 1 }

-- ========== 7. ValesDespacho ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ValesDespacho')
BEGIN
    CREATE TABLE ValesDespacho (
        idValeDespacho UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idSucursal UNIQUEIDENTIFIER NOT NULL,
        idCliente INT NOT NULL,
        idComprobante INT NOT NULL,
        serie VARCHAR(4) NOT NULL,
        numero VARCHAR(8) NOT NULL,
        compVale AS (serie + '-' + numero) PERSISTED,
        fEmision DATETIME NOT NULL DEFAULT GETDATE(),
        idUsuario UNIQUEIDENTIFIER NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDO' CHECK (estado IN ('EMITIDO','LIQUIDADO','ANULADO')),
        idVentaLiquidacion INT NULL,
        observaciones VARCHAR(255) NULL,
        fRegistro DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_ValesDespacho_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_ValesDespacho_Sucursal FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
        CONSTRAINT FK_ValesDespacho_Cliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
        CONSTRAINT FK_ValesDespacho_Comprobante FOREIGN KEY (idComprobante) REFERENCES Comprobantes(idComprobante),
        CONSTRAINT FK_ValesDespacho_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
        CONSTRAINT FK_ValesDespacho_Venta FOREIGN KEY (idVentaLiquidacion) REFERENCES Ventas(idVenta)
    );
    CREATE INDEX IX_ValesDespacho_EmpresaFecha ON ValesDespacho(idEmpresa, fEmision);
    CREATE INDEX IX_ValesDespacho_Cliente ON ValesDespacho(idEmpresa, idCliente);
END
GO

-- ========== 8. DetalleValeDespacho ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DetalleValeDespacho')
BEGIN
    CREATE TABLE DetalleValeDespacho (
        idDetalleValeDespacho UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idValeDespacho UNIQUEIDENTIFIER NOT NULL,
        idProducto UNIQUEIDENTIFIER NOT NULL,
        idPresentacion INT NOT NULL,
        cantidad DECIMAL(18,3) NOT NULL,
        pUnitario DECIMAL(18,6) NOT NULL,
        total DECIMAL(18,2) NOT NULL,
        CONSTRAINT FK_DetalleValeDespacho_Vale FOREIGN KEY (idValeDespacho) REFERENCES ValesDespacho(idValeDespacho) ON DELETE CASCADE,
        CONSTRAINT FK_DetalleValeDespacho_Producto FOREIGN KEY (idProducto) REFERENCES Productos(idProducto),
        CONSTRAINT FK_DetalleValeDespacho_Presentacion FOREIGN KEY (idPresentacion) REFERENCES Presentacion(idPresentacion)
    );
    CREATE INDEX IX_DetalleValeDespacho_Vale ON DetalleValeDespacho(idValeDespacho);
END
GO

-- ========== 9. AnticiposCliente ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AnticiposCliente')
BEGIN
    CREATE TABLE AnticiposCliente (
        idAnticipo UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idCliente INT NOT NULL,
        monto DECIMAL(18,2) NOT NULL,
        saldo DECIMAL(18,2) NOT NULL,
        idMoneda INT NOT NULL,
        fecha DATETIME NOT NULL DEFAULT GETDATE(),
        estado BIT NOT NULL DEFAULT 1,
        fRegistro DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_AnticiposCliente_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_AnticiposCliente_Cliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
        CONSTRAINT FK_AnticiposCliente_Moneda FOREIGN KEY (idMoneda) REFERENCES Moneda(idMoneda)
    );
    CREATE INDEX IX_AnticiposCliente_EmpresaCliente ON AnticiposCliente(idEmpresa, idCliente);
END
GO

-- ========== 10. MovimientosAnticipo ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MovimientosAnticipo')
BEGIN
    CREATE TABLE MovimientosAnticipo (
        idMovimientoAnticipo UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idAnticipo UNIQUEIDENTIFIER NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ABONO','DESCUENTO_VALE','DESCUENTO_FACTURA')),
        monto DECIMAL(18,2) NOT NULL,
        idValeDespacho UNIQUEIDENTIFIER NULL,
        idVenta INT NULL,
        referencia VARCHAR(50) NULL,
        fecha DATETIME NOT NULL DEFAULT GETDATE(),
        idUsuario UNIQUEIDENTIFIER NULL,
        CONSTRAINT FK_MovimientosAnticipo_Anticipo FOREIGN KEY (idAnticipo) REFERENCES AnticiposCliente(idAnticipo) ON DELETE CASCADE,
        CONSTRAINT FK_MovimientosAnticipo_Vale FOREIGN KEY (idValeDespacho) REFERENCES ValesDespacho(idValeDespacho),
        CONSTRAINT FK_MovimientosAnticipo_Venta FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta),
        CONSTRAINT FK_MovimientosAnticipo_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
    );
    CREATE INDEX IX_MovimientosAnticipo_Anticipo ON MovimientosAnticipo(idAnticipo);
END
GO

-- ========== 11. ConvenioCliente (opcional: flujo A/B por cliente) ==========
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ConvenioCliente')
BEGIN
    CREATE TABLE ConvenioCliente (
        idConvenio UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idCliente INT NOT NULL,
        permiteAnticipo BIT NOT NULL DEFAULT 0,
        permiteLiquidacionMensual BIT NOT NULL DEFAULT 1,
        fRegistro DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_ConvenioCliente_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_ConvenioCliente_Cliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
        CONSTRAINT UQ_ConvenioCliente_EmpresaCliente UNIQUE (idEmpresa, idCliente)
    );
END
GO
