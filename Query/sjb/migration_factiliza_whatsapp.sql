-- =============================================
-- MIGRACIÓN: FactilizaConfig WhatsApp (servicio por nombre) y EmpresaFactiliza.numeroWhatsApp
-- Fecha: 2026-02-19
-- Uso: Ejecutar sobre base de datos SistemaInventario
-- =============================================

USE SistemaInventario;
GO

-- 1. FactilizaConfig: columna parametroRuta (para nombre-instancia en API WhatsApp)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('FactilizaConfig') AND name = 'parametroRuta'
)
BEGIN
    ALTER TABLE FactilizaConfig ADD parametroRuta VARCHAR(100) NULL;
END
GO

-- 2. Fila para servicio WhatsApp (identificado por nombre)
IF NOT EXISTS (SELECT 1 FROM FactilizaConfig WHERE nombre = 'Factiliza WHATSAPP')
BEGIN
    INSERT INTO FactilizaConfig (nombre, urlApi, tokenDefault, parametroRuta, estado)
    VALUES ('Factiliza WHATSAPP', 'https://apiwsp.factiliza.com/v1', NULL, NULL, 1);
END
GO

-- 3. EmpresaFactiliza: número WhatsApp registrado por empresa (un solo número por empresa)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EmpresaFactiliza') AND name = 'numeroWhatsApp'
)
BEGIN
    ALTER TABLE EmpresaFactiliza ADD numeroWhatsApp VARCHAR(20) NULL;
END
GO
