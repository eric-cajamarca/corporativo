-- Servicio Factiliza para ruta pública RUC (solo crear-empresa). Usa nombre "Factiliza SUNAT"; token en tokenDefault.
IF NOT EXISTS (SELECT 1 FROM FactilizaConfig WHERE nombre = 'Factiliza SUNAT')
BEGIN
    INSERT INTO FactilizaConfig (nombre, urlApi, tokenDefault, parametroRuta, estado)
    VALUES ('Factiliza SUNAT', 'https://api.factiliza.com/v1', NULL, NULL, 1);
END
GO
