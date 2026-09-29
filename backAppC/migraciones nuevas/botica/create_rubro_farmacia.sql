-- Rubro FAR (botica): ficha de medicamento, receta en venta, presentaciones farmacéuticas.
-- FEFO se aplica en código según el rubro. Ejecutar una vez.

-- ========== 1. Rubro FAR ==========
IF NOT EXISTS (SELECT 1 FROM dbo.Rubros WHERE codigo = 'FAR')
BEGIN
    INSERT INTO dbo.Rubros (codigo, nombre, descripcion, activo)
    VALUES ('FAR', 'Botica / Farmacia', 'Mostrador farmacéutico; FEFO, receta y lotes con vencimiento.', 1);
END
ELSE
BEGIN
    UPDATE dbo.Rubros
    SET activo = 1,
        nombre = 'Botica / Farmacia',
        descripcion = 'Mostrador farmacéutico; FEFO, receta y lotes con vencimiento.'
    WHERE codigo = 'FAR';
END
GO

DECLARE @idFAR INT = (SELECT idRubro FROM dbo.Rubros WHERE codigo = 'FAR');

IF @idFAR IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionRubro WHERE idRubro = @idFAR AND clave = 'componenteVentas')
        INSERT INTO dbo.ConfiguracionRubro (idRubro, clave, valor, descripcion)
        VALUES (@idFAR, 'componenteVentas', 'estandar', 'Usa el POS estándar (no ventana nueva).');
    IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionRubro WHERE idRubro = @idFAR AND clave = 'usaFefo')
        INSERT INTO dbo.ConfiguracionRubro (idRubro, clave, valor, descripcion)
        VALUES (@idFAR, 'usaFefo', 'true', 'Descontar stock por fecha de vencimiento (FEFO).');
    IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionRubro WHERE idRubro = @idFAR AND clave = 'bloqueaLoteVencido')
        INSERT INTO dbo.ConfiguracionRubro (idRubro, clave, valor, descripcion)
        VALUES (@idFAR, 'bloqueaLoteVencido', 'true', 'No vender lotes vencidos.');
    IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionRubro WHERE idRubro = @idFAR AND clave = 'usaReceta')
        INSERT INTO dbo.ConfiguracionRubro (idRubro, clave, valor, descripcion)
        VALUES (@idFAR, 'usaReceta', 'true', 'Exigir receta al vender ítems recetados.');
    IF NOT EXISTS (SELECT 1 FROM dbo.ConfiguracionRubro WHERE idRubro = @idFAR AND clave = 'loteObligatorioCompra')
        INSERT INTO dbo.ConfiguracionRubro (idRubro, clave, valor, descripcion)
        VALUES (@idFAR, 'loteObligatorioCompra', 'true', 'N° de lote y vencimiento obligatorios en compras.');
END
GO

-- ========== 2. Ficha farmacéutica en Productos ==========
IF COL_LENGTH('dbo.Productos', 'principioActivo') IS NULL
    ALTER TABLE dbo.Productos ADD principioActivo VARCHAR(150) NULL;
IF COL_LENGTH('dbo.Productos', 'concentracion') IS NULL
    ALTER TABLE dbo.Productos ADD concentracion VARCHAR(40) NULL;
IF COL_LENGTH('dbo.Productos', 'formaFarmaceutica') IS NULL
    ALTER TABLE dbo.Productos ADD formaFarmaceutica VARCHAR(80) NULL;
IF COL_LENGTH('dbo.Productos', 'registroSanitario') IS NULL
    ALTER TABLE dbo.Productos ADD registroSanitario VARCHAR(30) NULL;
IF COL_LENGTH('dbo.Productos', 'laboratorio') IS NULL
    ALTER TABLE dbo.Productos ADD laboratorio VARCHAR(120) NULL;
IF COL_LENGTH('dbo.Productos', 'condicionVenta') IS NULL
    ALTER TABLE dbo.Productos ADD condicionVenta VARCHAR(20) NULL;
IF COL_LENGTH('dbo.Productos', 'codigoEan') IS NULL
    ALTER TABLE dbo.Productos ADD codigoEan VARCHAR(14) NULL;
IF COL_LENGTH('dbo.Productos', 'controlado') IS NULL
    ALTER TABLE dbo.Productos ADD controlado BIT NOT NULL CONSTRAINT DF_Productos_controlado DEFAULT (0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_EmpresaPrincipio' AND object_id = OBJECT_ID('dbo.Productos'))
    CREATE INDEX IX_Productos_EmpresaPrincipio ON dbo.Productos (idEmpresa, principioActivo)
    WHERE principioActivo IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_EmpresaEan' AND object_id = OBJECT_ID('dbo.Productos'))
    CREATE INDEX IX_Productos_EmpresaEan ON dbo.Productos (idEmpresa, codigoEan)
    WHERE codigoEan IS NOT NULL;
GO

-- ========== 3. Cuarentena / recall en Lotes ==========
IF COL_LENGTH('dbo.Lotes', 'motivoInactivo') IS NULL
    ALTER TABLE dbo.Lotes ADD motivoInactivo VARCHAR(40) NULL;
IF COL_LENGTH('dbo.Lotes', 'fechaInactivo') IS NULL
    ALTER TABLE dbo.Lotes ADD fechaInactivo DATETIME NULL;
GO

-- ========== 4. Receta ligada a la venta ==========
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecetaVenta')
BEGIN
    CREATE TABLE dbo.RecetaVenta (
        idReceta UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_RecetaVenta_id DEFAULT (NEWID()),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        idVenta INT NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        pacienteNombre VARCHAR(150) NOT NULL,
        pacienteDoc VARCHAR(20) NULL,
        medicoNombre VARCHAR(150) NOT NULL,
        cmp VARCHAR(20) NOT NULL,
        numeroReceta VARCHAR(40) NOT NULL,
        fechaReceta DATE NOT NULL,
        idUsuario UNIQUEIDENTIFIER NULL,
        fCreacion DATETIME NOT NULL CONSTRAINT DF_RecetaVenta_fCreacion DEFAULT (GETDATE()),
        CONSTRAINT PK_RecetaVenta PRIMARY KEY (idReceta),
        CONSTRAINT FK_RecetaVenta_Empresa FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas (idEmpresa),
        CONSTRAINT UQ_RecetaVenta_Venta UNIQUE (idEmpresa, idVenta)
    );
    CREATE INDEX IX_RecetaVenta_EmpresaFecha ON dbo.RecetaVenta (idEmpresa, fechaReceta);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecetaVentaDetalle')
BEGIN
    CREATE TABLE dbo.RecetaVentaDetalle (
        idRecetaDetalle UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_RecetaVentaDetalle_id DEFAULT (NEWID()),
        idReceta UNIQUEIDENTIFIER NOT NULL,
        idDetalle INT NULL,
        idProducto UNIQUEIDENTIFIER NOT NULL,
        idLote UNIQUEIDENTIFIER NULL,
        cantidad DECIMAL(18, 6) NOT NULL,
        CONSTRAINT PK_RecetaVentaDetalle PRIMARY KEY (idRecetaDetalle),
        CONSTRAINT FK_RecetaVentaDetalle_Cab FOREIGN KEY (idReceta)
            REFERENCES dbo.RecetaVenta (idReceta),
        CONSTRAINT CK_RecetaVentaDetalle_cant CHECK (cantidad > 0)
    );
    CREATE INDEX IX_RecetaVentaDetalle_Cab ON dbo.RecetaVentaDetalle (idReceta);
    CREATE INDEX IX_RecetaVentaDetalle_Producto ON dbo.RecetaVentaDetalle (idProducto);
END
GO

-- ========== 5. Presentacion = unidad SUNAT, no forma farmacéutica ==========
-- Tableta/Cápsula/Ampolla van en Productos.formaFarmaceutica (solo botica).
-- Se eliminan filas de forma que se insertaron por error en el catálogo global.
IF OBJECT_ID('dbo.Presentacion', 'U') IS NOT NULL
BEGIN
    DECLARE @quitar TABLE (descripcion VARCHAR(50) NOT NULL);
    INSERT INTO @quitar (descripcion) VALUES
        ('Tableta'),
        ('Cápsula'),
        ('Comprimido'),
        ('Gragea'),
        ('Ampolla'),
        ('Vial'),
        ('Óvulo'),
        ('Supositorio'),
        ('Parche'),
        ('Inhalador'),
        ('Jeringa'),
        ('Pote'),
        ('Gotas'),
        ('Crema'),
        ('Pomada'),
        ('Ungüento'),
        ('Gel'),
        ('Solución'),
        ('Emulsión'),
        ('Polvo'),
        ('Blister'),
        ('Sobre'),
        ('Frasco'),
        ('Jarabe'),
        ('Gotero'),
        ('Suspensión'),
        ('Tubo'),
        ('Kit'),
        ('Mililitro'),
        ('Onza'),
        ('Gramo');

    DELETE p
    FROM dbo.Presentacion p
    INNER JOIN @quitar q ON LTRIM(RTRIM(p.Descripcion)) = q.descripcion
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Productos x WHERE x.idPresentacion = p.idPresentacion)
      AND NOT EXISTS (SELECT 1 FROM dbo.DetalleCompras x WHERE x.idPresentacion = p.idPresentacion)
      AND NOT EXISTS (SELECT 1 FROM dbo.DetalleCotizacion x WHERE x.idPresentacion = p.idPresentacion)
      AND NOT EXISTS (SELECT 1 FROM dbo.DetalleValeDespacho x WHERE x.idPresentacion = p.idPresentacion);
END
GO
