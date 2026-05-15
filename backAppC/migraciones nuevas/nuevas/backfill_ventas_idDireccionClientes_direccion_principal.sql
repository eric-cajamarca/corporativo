/*
  Rellena Ventas.idDireccionClientes (solo donde está NULL) con la dirección del cliente
  elegida así:
    1) Filas de DireccionClientes con texto en `direccion` (no vacío).
    2) Entre esas, prioridad a principal = 1, luego menor idDireccionClientes.

  Requisitos:
    - Ya ejecutado add_ventas_idDireccionClientes.sql (columna y FK existentes).
    - DireccionClientes.idEmpresa / idCliente alineados con la venta.

  Nota: No sobrescribe ventas que ya tienen idDireccionClientes (emisión explícita).
*/

SET NOCOUNT ON;

IF COL_LENGTH('dbo.Ventas', 'idDireccionClientes') IS NULL
BEGIN
  RAISERROR('Falta la columna Ventas.idDireccionClientes. Ejecute primero add_ventas_idDireccionClientes.sql.', 16, 1);
  RETURN;
END;

BEGIN TRANSACTION;

BEGIN TRY
  UPDATE v
  SET v.idDireccionClientes = x.idDireccionClientes
  FROM dbo.Ventas AS v
  CROSS APPLY (
    SELECT TOP (1)
      dc.idDireccionClientes
    FROM dbo.DireccionClientes AS dc
    WHERE dc.idEmpresa = v.idEmpresa
      AND dc.idCliente = v.idCliente
      AND NULLIF(LTRIM(RTRIM(ISNULL(dc.direccion, ''))), '') IS NOT NULL
    ORDER BY
      CASE WHEN ISNULL(dc.principal, 0) = 1 THEN 0 ELSE 1 END,
      dc.idDireccionClientes ASC
  ) AS x
  WHERE v.idDireccionClientes IS NULL
    AND v.idCliente IS NOT NULL;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;

/*
  Opcional: ventas que siguen sin id (sin dirección con texto en DireccionClientes)

SELECT v.idVenta, v.idEmpresa, v.idCliente, v.compVenta
FROM dbo.Ventas v
WHERE v.idDireccionClientes IS NULL
  AND v.idCliente IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.DireccionClientes dc
    WHERE dc.idEmpresa = v.idEmpresa
      AND dc.idCliente = v.idCliente
      AND NULLIF(LTRIM(RTRIM(ISNULL(dc.direccion, ''))), '') IS NOT NULL
  );
*/
