-- Migración: tablas de catálogos multiempresa
-- Requiere: Empresas. Ejecutar una sola vez.
-- Nota: El catálogo Forma Pago usa la tabla existente FormasPago (idFormaPago INT, descripcion, tipo, requiereReferencia, activo).

-- Tipo Movimientos (por empresa: descripción, tipo INGRESO/SALIDA, descripción corta)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CatalogoTipoMovimiento')
BEGIN
    CREATE TABLE CatalogoTipoMovimiento (
        idTipoMovimiento UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        descripcion VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INGRESO','SALIDA')),
        descripcionCorta VARCHAR(30) NULL,
        CONSTRAINT FK_CatalogoTipoMovimiento_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_CatalogoTipoMovimiento_idEmpresa ON CatalogoTipoMovimiento(idEmpresa);
END
GO

-- 3. Clasificación Conceptos (por empresa)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClasificacionConcepto')
BEGIN
    CREATE TABLE ClasificacionConcepto (
        idClasificacionConcepto UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        descripcion VARCHAR(100) NOT NULL,
        CONSTRAINT FK_ClasificacionConcepto_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_ClasificacionConcepto_idEmpresa ON ClasificacionConcepto(idEmpresa);
END
GO

-- 4. Conceptos (por empresa: descripción, tipo INGRESO/EGRESO, clasificación)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Concepto')
BEGIN
    CREATE TABLE Concepto (
        idConcepto UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        descripcion VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
        idClasificacionConcepto UNIQUEIDENTIFIER NULL,
        CONSTRAINT FK_Concepto_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Concepto_idClasificacion FOREIGN KEY (idClasificacionConcepto) REFERENCES ClasificacionConcepto(idClasificacionConcepto)
    );
    CREATE INDEX IX_Concepto_idEmpresa ON Concepto(idEmpresa);
END
GO

-- 5. Motivo Traslado (por empresa)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MotivoTraslado')
BEGIN
    CREATE TABLE MotivoTraslado (
        idMotivoTraslado UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        descripcion VARCHAR(150) NOT NULL,
        CONSTRAINT FK_MotivoTraslado_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_MotivoTraslado_idEmpresa ON MotivoTraslado(idEmpresa);
END
GO

-- 6. Motivo Nota Crédito (por empresa; codigoSunat según Catálogo 09 SUNAT)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MotivoNotaCredito')
BEGIN
    CREATE TABLE MotivoNotaCredito (
        idMotivoNotaCredito UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        codigoSunat VARCHAR(2) NOT NULL,
        descripcion VARCHAR(150) NOT NULL,
        CONSTRAINT FK_MotivoNotaCredito_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
    );
    CREATE INDEX IX_MotivoNotaCredito_idEmpresa ON MotivoNotaCredito(idEmpresa);
END
GO

-- Datos iniciales SUNAT Catálogo 09 (motivos nota de crédito electrónica)
-- Solo insertar si la tabla está vacía para la empresa (opcional: ejecutar por empresa o usar seed en app)
-- Códigos: 01 Anulación de la operación, 02 Anulación por error en RUC, 03 Corrección por error en la descripción,
-- 04 Descuento global, 05 Descuento por ítem, 06 Devolución total, 07 Devolución por ítem, 08 Bonificación,
-- 09 Disminución en el valor, 10 Otros conceptos, 11 Ajustes exportación, 12 Ajustes IVAP, 13 Corrección monto neto/vencimiento
