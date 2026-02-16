-- Migración: crear tablas Cotizaciones y DetalleCotizacion
-- Ejecutar una sola vez en la base de datos donde corre el backend.
-- Requiere: Empresas, Comprobantes, Documentos, Clientes, Sucursal, Presentacion.

-- Tabla Cotizaciones (idUsuario sin FK para compatibilidad con UsuarioWeb/Usuarios)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Cotizaciones')
BEGIN
    CREATE TABLE Cotizaciones (
        idCotizacion INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        serieNumero VARCHAR(13) NOT NULL,
        idComprobante INT NULL,
        serie VARCHAR(4) NULL,
        numero VARCHAR(8) NULL,
        fEmision VARCHAR(10) NULL,
        fVencimiento VARCHAR(10) NULL,
        idDocumento VARCHAR(1) NOT NULL,
        idCliente INT NOT NULL,
        moneda VARCHAR(20) NULL,
        idCondicionPago INT NULL,
        total DECIMAL(18, 2) NULL,
        idUsuario UNIQUEIDENTIFIER NOT NULL,
        Conversion VARCHAR(13) NULL,
        CONSTRAINT FK_Cotizaciones_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Cotizaciones_idComprobante FOREIGN KEY (idComprobante) REFERENCES Comprobantes(idComprobante),
        CONSTRAINT FK_Cotizaciones_idDocumento FOREIGN KEY (idDocumento) REFERENCES Documentos(idDocumento),
        CONSTRAINT FK_Cotizaciones_idCliente FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente)
    );
END
GO

-- Tabla DetalleCotizacion
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DetalleCotizacion')
BEGIN
    CREATE TABLE DetalleCotizacion (
        idDetalleCotizacion INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idCotizacion INT NOT NULL,
        cantidad DECIMAL(18, 3) NULL,
        codigo VARCHAR(50) NULL,
        descripcion VARCHAR(200) NULL,
        idPresentacion INT NOT NULL,
        pVenta DECIMAL(18, 5) NULL,
        descuentos DECIMAL(18, 2) NULL,
        igv DECIMAL(18, 2) NULL,
        ISC DECIMAL(18, 2) NULL,
        total DECIMAL(18, 2) NULL,
        idSucursal UNIQUEIDENTIFIER NOT NULL,
        hVenta VARCHAR(10) NULL,
        CONSTRAINT FK_DetalleCotizacion_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_DetalleCotizacion_idCotizacion FOREIGN KEY (idCotizacion) REFERENCES Cotizaciones(idCotizacion),
        CONSTRAINT FK_DetalleCotizacion_idSucursal FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
        CONSTRAINT FK_DetalleCotizacion_idPresentacion FOREIGN KEY (idPresentacion) REFERENCES Presentacion(idPresentacion)
    );
END
GO
