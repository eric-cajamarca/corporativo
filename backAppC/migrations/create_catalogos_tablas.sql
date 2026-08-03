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

-- 4. Conceptos (por empresa: descripción, tipo INGRESO/EGRESO, clasificación, tipo movimiento caja para arqueo)
-- Requiere: TiposMovimientoCaja existente (tabla universal).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Concepto')
BEGIN
    CREATE TABLE Concepto (
        idConcepto UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        idEmpresa UNIQUEIDENTIFIER NOT NULL,
        descripcion VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
        idClasificacionConcepto UNIQUEIDENTIFIER NULL,
        idTipoMovimientoCaja INT NULL,
        CONSTRAINT FK_Concepto_idEmpresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
        CONSTRAINT FK_Concepto_idClasificacion FOREIGN KEY (idClasificacionConcepto) REFERENCES ClasificacionConcepto(idClasificacionConcepto),
        CONSTRAINT FK_Concepto_idTipoMovimientoCaja FOREIGN KEY (idTipoMovimientoCaja) REFERENCES TiposMovimientoCaja(idTipoMovimientoCaja)
    );
    CREATE INDEX IX_Concepto_idEmpresa ON Concepto(idEmpresa);
    CREATE INDEX IX_Concepto_idTipoMovimientoCaja ON Concepto(idTipoMovimientoCaja);
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

-- 6. Motivo Nota Crédito GLOBAL (Catálogo 09 SUNAT; todas las empresas)
-- Preferir ejecutar también: migrations/seed_motivos_nota_credito_debito.sql
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MotivoNotaCredito')
BEGIN
    CREATE TABLE MotivoNotaCredito (
        idMotivoNotaCredito UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        codigoSunat VARCHAR(2) NOT NULL,
        descripcion VARCHAR(150) NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        CONSTRAINT UQ_MotivoNotaCredito_codigoSunat UNIQUE (codigoSunat)
    );
END
GO

-- Códigos Cat. 09: 01 Anulación … 13 Corrección monto neto/vencimiento (seed en seed_motivos_nota_credito_debito.sql)
