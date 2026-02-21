-- =============================================
-- MIGRACIÓN: FactilizaConfig Tipo de Cambio
-- Fecha: 2026-02-19
-- Uso: Ejecutar sobre base de datos SistemaInventario
-- =============================================

USE SistemaInventario;
GO

-- Fila para servicio Tipo de Cambio (identificado por nombre)
IF NOT EXISTS (SELECT 1 FROM FactilizaConfig WHERE nombre = 'Factiliza TIPO CAMBIO')
BEGIN
    INSERT INTO FactilizaConfig (nombre, urlApi, tokenDefault, parametroRuta, estado)
    VALUES ('Factiliza TIPO CAMBIO', 'https://api.factiliza.com/v1', NULL, NULL, 1);
END
GO
