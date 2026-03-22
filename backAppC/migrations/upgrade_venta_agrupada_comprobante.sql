-- =====================================================================
-- Migracion: Comprobante VA para Empresa Gestora
-- Incluye: columnas VentaAgrupada, referencia en Ventas,
--          DetalleVentaAgrupada, VentaAgrupadaLog, SP correlativo,
--          trigger conciliacion, usuario espejo, comprobante VA default
-- =====================================================================

-- 1. Columnas nuevas en VentaAgrupada (comprobante VA propio)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('VentaAgrupada') AND name = 'serie')
BEGIN
  ALTER TABLE VentaAgrupada ADD
    serie VARCHAR(4) NULL,
    numero VARCHAR(8) NULL,
    compVenta VARCHAR(13) NULL,
    tipoComprobanteDestino VARCHAR(2) NOT NULL DEFAULT 'NV',
    idComprobante INT NULL,
    observaciones VARCHAR(500) NULL;
END;
GO

-- 2. Referencia a VentaAgrupada desde Ventas (trazabilidad)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Ventas') AND name = 'idVentaAgrupada')
BEGIN
  ALTER TABLE Ventas ADD idVentaAgrupada UNIQUEIDENTIFIER NULL;
  CREATE INDEX IX_Ventas_VentaAgrupada ON Ventas(idVentaAgrupada) WHERE idVentaAgrupada IS NOT NULL;
END;
GO

-- 3. Tabla DetalleVentaAgrupada (items del comprobante VA para impresion)
IF OBJECT_ID('dbo.DetalleVentaAgrupada', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.DetalleVentaAgrupada (
    idDetalleVA INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idVentaAgrupada UNIQUEIDENTIFIER NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    idEmpresaProducto UNIQUEIDENTIFIER NOT NULL,
    aliasEmpresa VARCHAR(10) NULL,
    sucursal VARCHAR(50) NULL,
    cantidad DECIMAL(18,3) NOT NULL,
    pVenta DECIMAL(18,5) NOT NULL,
    descuento DECIMAL(18,2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(18,2) NOT NULL,
    igv BIT NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL,
    descripcionProducto VARCHAR(200) NULL,
    codigoProducto VARCHAR(20) NULL,
    CONSTRAINT FK_DetalleVA_VentaAgrupada FOREIGN KEY (idVentaAgrupada)
      REFERENCES VentaAgrupada(idVentaAgrupada)
  );
  CREATE INDEX IX_DetalleVA_VentaAgrupada ON DetalleVentaAgrupada(idVentaAgrupada);
END;
GO

-- 4. Tabla VentaAgrupadaLog (auditoria y conciliacion)
IF OBJECT_ID('dbo.VentaAgrupadaLog', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.VentaAgrupadaLog (
    idLog INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idVentaAgrupada UNIQUEIDENTIFIER NOT NULL,
    evento VARCHAR(30) NOT NULL,
    compVA VARCHAR(13) NULL,
    totalVA DECIMAL(18,2) NULL,
    sumaVentasHijas DECIMAL(18,2) NULL,
    diferencia DECIMAL(18,2) NULL,
    estadoConciliacion VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',
    idUsuario UNIQUEIDENTIFIER NULL,
    fEvento DATETIME NOT NULL DEFAULT GETDATE(),
    detalle VARCHAR(500) NULL,
    CONSTRAINT FK_VALog_VentaAgrupada FOREIGN KEY (idVentaAgrupada)
      REFERENCES VentaAgrupada(idVentaAgrupada)
  );
  CREATE INDEX IX_VALog_VentaAgrupada ON VentaAgrupadaLog(idVentaAgrupada);
  CREATE INDEX IX_VALog_Evento ON VentaAgrupadaLog(evento, fEvento);
END;
GO

-- 5. Columnas espejo en UsuarioWeb (replicacion de vendedores)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('UsuarioWeb') AND name = 'esEspejo')
BEGIN
  ALTER TABLE UsuarioWeb ADD
    esEspejo BIT NOT NULL DEFAULT 0,
    idUsuarioOrigen UNIQUEIDENTIFIER NULL;
END;
GO

-- 6. Stored Procedure: correlativo seguro con concurrencia
IF OBJECT_ID('dbo.sp_ObtenerSiguienteCorrelativo', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ObtenerSiguienteCorrelativo;
GO

CREATE PROCEDURE dbo.sp_ObtenerSiguienteCorrelativo
  @idEmpresa UNIQUEIDENTIFIER,
  @idComprobante INT,
  @serieOut VARCHAR(4) OUTPUT,
  @numeroOut VARCHAR(8) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @num INT;

  UPDATE Comprobantes WITH (UPDLOCK, HOLDLOCK)
  SET numero = ISNULL(numero, 0) + 1
  WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante;

  SELECT @num = numero, @serieOut = serie
  FROM Comprobantes
  WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante;

  IF @num IS NULL
  BEGIN
    DECLARE @msg NVARCHAR(200) = 'Comprobante no encontrado para idEmpresa=' + CAST(@idEmpresa AS VARCHAR(36)) + ', idComprobante=' + CAST(@idComprobante AS VARCHAR(10));
    RAISERROR(@msg, 16, 1);
    RETURN;
  END;

  SET @numeroOut = RIGHT('00000000' + CAST(@num AS VARCHAR(8)), 8);
END;
GO

-- 7. Trigger de conciliacion en tiempo real
IF OBJECT_ID('dbo.TR_ConciliacionVentaAgrupada', 'TR') IS NOT NULL
  DROP TRIGGER dbo.TR_ConciliacionVentaAgrupada;
GO

CREATE TRIGGER dbo.TR_ConciliacionVentaAgrupada
ON dbo.Ventas
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO VentaAgrupadaLog (idVentaAgrupada, evento, compVA, totalVA, sumaVentasHijas, diferencia, estadoConciliacion)
  SELECT
    i.idVentaAgrupada,
    'VENTA_HIJA',
    va.compVenta,
    va.total,
    sumaHijas.total,
    va.total - sumaHijas.total,
    CASE
      WHEN ABS(va.total - sumaHijas.total) <= 0.01 THEN 'OK'
      ELSE 'PENDIENTE'
    END
  FROM inserted i
  INNER JOIN VentaAgrupada va ON i.idVentaAgrupada = va.idVentaAgrupada
  CROSS APPLY (
    SELECT ISNULL(SUM(v2.total), 0) AS total
    FROM Ventas v2
    WHERE v2.idVentaAgrupada = i.idVentaAgrupada AND v2.eliminado = 0
  ) sumaHijas
  WHERE i.idVentaAgrupada IS NOT NULL;
END;
GO

-- 8. Comprobante VA por defecto para empresas gestoras existentes
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
SELECT ge.idEmpresaOrigen, 'VA', 'Venta Agrupada', 'VA01', 0, 1, 1, 0
FROM (SELECT DISTINCT idEmpresaOrigen FROM Gestores_Empresas WHERE estado = 1) ge
WHERE NOT EXISTS (
  SELECT 1 FROM Comprobantes
  WHERE idEmpresa = ge.idEmpresaOrigen AND codigo = 'VA'
);
GO
