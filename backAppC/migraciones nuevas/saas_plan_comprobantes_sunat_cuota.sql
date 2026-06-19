-- Tope de comprobantes electrónicos aceptados por SUNAT (por plan) y contador acumulado por empresa.
-- maxComprobantesSunatAceptados = 0 significa sin límite.
-- El contador se incrementa en backend al pasar a estado SUNAT aceptado (CDR 0 / observado 1-2 → idEstadoSunat 1 o 3),
-- incluyendo guías y la comunicación de baja (RA) como documento; no se vuelve a contar al pasar un comprobante a "baja aceptada".

IF COL_LENGTH('dbo.SaasPlan', 'maxComprobantesSunatAceptados') IS NULL
BEGIN
    ALTER TABLE dbo.SaasPlan ADD maxComprobantesSunatAceptados INT NOT NULL
        CONSTRAINT DF_SaasPlan_maxCompSunat DEFAULT (0);
END
GO

IF COL_LENGTH('dbo.EmpresaSuscripcion', 'contadorComprobantesSunatAceptados') IS NULL
BEGIN
    ALTER TABLE dbo.EmpresaSuscripcion ADD contadorComprobantesSunatAceptados INT NOT NULL
        CONSTRAINT DF_EmpresaSuscripcion_contCompSunat DEFAULT (0);
END
GO

-- Semilla solo donde sigue en 0 (no pisa valores ya configurados en BD)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SaasPlan') AND name = 'maxComprobantesSunatAceptados')
BEGIN
    UPDATE dbo.SaasPlan
    SET maxComprobantesSunatAceptados = CASE planCode
        WHEN N'demo' THEN 50
        WHEN N'basico' THEN 150
        WHEN N'emprendedor' THEN 500
        WHEN N'profesional' THEN 2000
        WHEN N'empresarial' THEN 10000
        WHEN N'enterprise' THEN 0
        ELSE maxComprobantesSunatAceptados
    END
    WHERE planCode IN (N'demo', N'basico', N'emprendedor', N'profesional', N'empresarial', N'enterprise')
      AND maxComprobantesSunatAceptados = 0;
END
GO
