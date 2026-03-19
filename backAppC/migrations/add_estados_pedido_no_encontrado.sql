-- Agregar estado de pedido para "NO ENCONTRADO"
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'EstadosPedidos')
BEGIN
  IF NOT EXISTS (SELECT 1 FROM EstadosPedidos WHERE descripcion = 'No encontrado')
  BEGIN
    -- EstadosPedidos puede ser global (sin idEmpresa) o multiempresa (con idEmpresa)
    IF EXISTS (
      SELECT 1
      FROM sys.columns
      WHERE object_id = OBJECT_ID('EstadosPedidos') AND name = 'idEmpresa'
    )
    BEGIN
      INSERT INTO EstadosPedidos (idEmpresa, descripcion, color)
      SELECT e.idEmpresa, 'No encontrado', '#808080'
      FROM Empresas e;
    END
    ELSE
    BEGIN
      INSERT INTO EstadosPedidos (descripcion, color)
      VALUES ('No encontrado', '#808080');
    END
  END
END
GO

