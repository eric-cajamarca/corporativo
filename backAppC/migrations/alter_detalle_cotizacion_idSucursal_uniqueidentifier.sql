-- Migración: cambiar DetalleCotizacion.idSucursal de INT a UNIQUEIDENTIFIER
-- Ejecutar solo si tu tabla Sucursal tiene idSucursal UNIQUEIDENTIFIER y DetalleCotizacion fue creada con idSucursal INT.
-- Si ya hay filas en DetalleCotizacion, vacíe la tabla antes o la conversión fallará.

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'DetalleCotizacion')
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'DetalleCotizacion' AND COLUMN_NAME = 'idSucursal'
        AND DATA_TYPE = 'int'
    )
    BEGIN
        -- Eliminar FK y default si existen
        IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('DetalleCotizacion') AND name = 'FK_DetalleCotizacion_idSucursal')
            ALTER TABLE DetalleCotizacion DROP CONSTRAINT FK_DetalleCotizacion_idSucursal;

        ALTER TABLE DetalleCotizacion ALTER COLUMN idSucursal UNIQUEIDENTIFIER NOT NULL;

        IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Sucursal')
            ALTER TABLE DetalleCotizacion ADD CONSTRAINT FK_DetalleCotizacion_idSucursal
                FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal);
    END
END
GO
