-- Tabla legacy usada por renviosController (envíos/comp. de referencia)
-- Se crea si no existe para evitar: "Invalid object name 'Historialpedidos'."

IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'Historialpedidos'
)
BEGIN
  CREATE TABLE Historialpedidos (
    idHistorialpedidos INT IDENTITY(1,1) PRIMARY KEY,
    CompEnvio VARCHAR(50) NOT NULL,
    CompVentas VARCHAR(50) NULL,
    FEnvio VARCHAR(10) NULL,
    Descripcion VARCHAR(255) NULL,
    Presentacion VARCHAR(100) NULL,
    Cantidad DECIMAL(18,6) NULL
  );

  CREATE INDEX IX_Historialpedidos_CompEnvio ON Historialpedidos(CompEnvio);
END
GO

