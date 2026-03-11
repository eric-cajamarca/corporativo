-- Catálogo SUNAT motivo de traslado (HandlingCode GRE): 01, 02, 04, 08, 09, 13
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CatMotivoTrasladoSunat')
BEGIN
    CREATE TABLE CatMotivoTrasladoSunat (
        codigoSunat VARCHAR(2) NOT NULL PRIMARY KEY,
        descripcion VARCHAR(100) NOT NULL
    );
    INSERT INTO CatMotivoTrasladoSunat (codigoSunat, descripcion) VALUES
    ('01', 'Venta'),
    ('02', 'Compra'),
    ('04', 'Traslado entre establecimientos'),
    ('08', 'Importación'),
    ('09', 'Exportación'),
    ('13', 'Otros');
END
GO

-- Columna codigoSunat en MotivoTraslado (por empresa) para alinear con SUNAT
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('MotivoTraslado') AND name = 'codigoSunat'
)
BEGIN
    ALTER TABLE MotivoTraslado ADD codigoSunat VARCHAR(2) NULL;
    UPDATE MotivoTraslado SET codigoSunat = '01' WHERE codigoSunat IS NULL;
END
GO
