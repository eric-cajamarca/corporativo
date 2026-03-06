-- MIGRACIÓN: Servicio Factiliza SUNAT PDF
IF NOT EXISTS (SELECT 1 FROM FactilizaConfig WHERE nombre = 'Factiliza SUNAT PDF')
BEGIN
    INSERT INTO FactilizaConfig (nombre, urlApi, tokenDefault, parametroRuta, estado)
    VALUES ('Factiliza SUNAT PDF', 'https://api.factiliza.com/v1/sunat/reporte', NULL, NULL, 1);
END
GO

