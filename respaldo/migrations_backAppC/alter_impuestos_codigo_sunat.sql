-- Agrega codigoSunat (Catálogo 05 SUNAT - Código de tipos de tributos y otros conceptos) a Impuestos.
-- Códigos: 1000=IGV, 1016=IVAP, 2000=ISC, 3000=IR, 7152=ICBPER, 9995=EXP, 9996=GRA, 9997=EXO, 9998=INA, 9999=OTROS

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Impuestos') AND name = 'codigoSunat'
)
BEGIN
  ALTER TABLE Impuestos ADD codigoSunat VARCHAR(4) NULL;
END
GO

-- Backfill según descripción (opcional; ejecutar una vez)
UPDATE Impuestos
SET codigoSunat = CASE
  WHEN UPPER(RTRIM(LTRIM(descripcion))) LIKE '%IGV%' THEN '1000'
  WHEN UPPER(RTRIM(LTRIM(descripcion))) LIKE '%EXO%' OR UPPER(RTRIM(LTRIM(descripcion))) LIKE '%EXONERAD%' THEN '9997'
  WHEN UPPER(RTRIM(LTRIM(descripcion))) LIKE '%ISC%' THEN '2000'
  WHEN UPPER(RTRIM(LTRIM(descripcion))) LIKE '%INA%' OR UPPER(RTRIM(LTRIM(descripcion))) LIKE '%INAFECT%' THEN '9998'
  WHEN UPPER(RTRIM(LTRIM(descripcion))) LIKE '%GRA%' OR UPPER(RTRIM(LTRIM(descripcion))) LIKE '%GRATUIT%' THEN '9996'
  WHEN UPPER(RTRIM(LTRIM(descripcion))) LIKE '%IVAP%' THEN '1016'
  WHEN UPPER(RTRIM(LTRIM(descripcion))) LIKE '%ICBPER%' THEN '7152'
  ELSE '9999'
END
WHERE codigoSunat IS NULL;
GO
