-- Script para corregir comprobantes que tienen baja aceptada pero estado incorrecto
-- Ejecutar DESPUÉS de add_estado_baja_aceptada.sql

-- 1. Primero verificar que existe el estado 08
IF NOT EXISTS (SELECT 1 FROM EstadosSunat WHERE codigo = '08')
BEGIN
  INSERT INTO EstadosSunat (codigo, descripcion)
  VALUES ('08', 'Baja Aceptada');
END

-- 2. Obtener el idEstadoSunat para "Baja Aceptada"
DECLARE @idBajaAceptada INT;
SELECT @idBajaAceptada = idEstadoSunat FROM EstadosSunat WHERE codigo = '08';

-- 3. Actualizar comprobantes que están en comunicaciones de baja ACEPTADAS (idEstadoSunat = 1)
-- pero sus comprobantes no tienen el estado "Baja Aceptada"
UPDATE ce
SET ce.idEstadoSunat = @idBajaAceptada,
    ce.descripcionRespuesta = 'Baja aceptada - corregido por migración'
FROM ComprobantesElectronicos ce
INNER JOIN ComunicacionBajaDetalle cbd ON cbd.idComprobanteElectronico = ce.idComprobanteElectronico
INNER JOIN ComunicacionesBaja cb ON cb.idComunicacionBaja = cbd.idComunicacionBaja
WHERE cb.idEstadoSunat = 1  -- Comunicación de baja aceptada
  AND ce.idEstadoSunat <> @idBajaAceptada;  -- Comprobante no tiene estado "Baja Aceptada"

-- 4. También actualizar la tabla Ventas correspondiente
UPDATE v
SET v.idEstadoSunat = @idBajaAceptada
FROM Ventas v
INNER JOIN ComprobantesElectronicos ce ON ce.idVenta = v.idVenta
INNER JOIN ComunicacionBajaDetalle cbd ON cbd.idComprobanteElectronico = ce.idComprobanteElectronico
INNER JOIN ComunicacionesBaja cb ON cb.idComunicacionBaja = cbd.idComunicacionBaja
WHERE cb.idEstadoSunat = 1
  AND v.idEstadoSunat <> @idBajaAceptada;

PRINT 'Comprobantes y ventas actualizados a estado Baja Aceptada';
GO
