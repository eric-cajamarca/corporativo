-- Vincular Concepto con TiposMovimientoCaja para usar en recibos de ingreso/egreso
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Concepto') AND name = 'idTipoMovimientoCaja'
)
BEGIN
    ALTER TABLE dbo.Concepto
    ADD idTipoMovimientoCaja INT NULL;

    ALTER TABLE dbo.Concepto
    ADD CONSTRAINT FK_Concepto_idTipoMovimientoCaja
    FOREIGN KEY (idTipoMovimientoCaja) REFERENCES dbo.TiposMovimientoCaja(idTipoMovimientoCaja);

    CREATE INDEX IX_Concepto_idTipoMovimientoCaja ON dbo.Concepto(idTipoMovimientoCaja);
END
GO
