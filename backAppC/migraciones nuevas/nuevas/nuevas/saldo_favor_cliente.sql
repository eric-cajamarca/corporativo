-- Saldo a favor del cliente (ledger sobre AnticiposCliente / MovimientosAnticipo).
-- Se genera al anular / dar de baja / NC un comprobante a crédito con cobros previos.
-- Se consume al emitir ventas (medio de pago "Saldo a favor").

-- ========== 1. Ampliar tipos de MovimientosAnticipo ==========
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MovimientosAnticipo')
BEGIN
    DECLARE @ck NVARCHAR(256);
    SELECT @ck = cc.name
    FROM sys.check_constraints cc
    WHERE cc.parent_object_id = OBJECT_ID('dbo.MovimientosAnticipo')
      AND cc.definition LIKE '%tipo%';

    IF @ck IS NOT NULL
        EXEC('ALTER TABLE dbo.MovimientosAnticipo DROP CONSTRAINT [' + @ck + ']');

    ALTER TABLE dbo.MovimientosAnticipo ADD CONSTRAINT CK_MovimientosAnticipo_tipo
        CHECK (tipo IN (
            'ABONO',
            'DESCUENTO_VALE',
            'DESCUENTO_FACTURA',
            'ABONO_ANULACION',
            'ABONO_BAJA',
            'ABONO_NC',
            'APLICACION_VENTA',
            'DEVOLUCION',
            'SANEAMIENTO'
        ));
END
GO

-- ========== 2. Columnas de trazabilidad en movimientos ==========
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MovimientosAnticipo')
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'MovimientosAnticipo' AND COLUMN_NAME = 'idCreditoOrigen'
    )
        ALTER TABLE dbo.MovimientosAnticipo ADD idCreditoOrigen UNIQUEIDENTIFIER NULL;

    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'MovimientosAnticipo' AND COLUMN_NAME = 'motivo'
    )
        ALTER TABLE dbo.MovimientosAnticipo ADD motivo VARCHAR(200) NULL;

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_MovimientosAnticipo_Idempotencia'
          AND object_id = OBJECT_ID('dbo.MovimientosAnticipo')
    )
        CREATE INDEX IX_MovimientosAnticipo_Idempotencia
            ON dbo.MovimientosAnticipo(idAnticipo, tipo, referencia, idVenta)
            WHERE referencia IS NOT NULL;
END
GO

-- ========== 3. Medio interno SAF (solo backend / botón; no listar en FormasPago del POS) ==========
-- IMPORTANTE: SQL Server compila AMBAS ramas de un IF. Si MediosPago no tiene columna
-- "estado", un INSERT estático con esa columna falla (Msg 207) aunque el IF diga lo contrario.
-- Por eso el INSERT va en SQL dinámico (EXEC).
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MediosPago')
   AND COL_LENGTH('dbo.MediosPago', 'codigo') IS NOT NULL
   AND COL_LENGTH('dbo.MediosPago', 'descripcion') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM dbo.MediosPago
        WHERE RTRIM(LTRIM(ISNULL(codigo, ''))) = 'SAF'
           OR LOWER(ISNULL(descripcion, '')) LIKE '%saldo a favor%'
   )
BEGIN
    IF COL_LENGTH('dbo.MediosPago', 'estado') IS NOT NULL
        EXEC(N'INSERT INTO dbo.MediosPago (codigo, descripcion, estado) VALUES (N''SAF'', N''Saldo a favor'', 1)');
    ELSE
        EXEC(N'INSERT INTO dbo.MediosPago (codigo, descripcion) VALUES (N''SAF'', N''Saldo a favor'')');
END
GO

-- No insertar en FormasPago: el POS no debe mostrarlo en el select.
-- Si quedó de una corrida anterior, desactivar o borrar la fila (también con EXEC por Msg 207).
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FormasPago')
BEGIN
    IF COL_LENGTH('dbo.FormasPago', 'activo') IS NOT NULL
        EXEC(N'UPDATE dbo.FormasPago SET activo = 0 WHERE LOWER(ISNULL(descripcion, '''')) LIKE ''%saldo a favor%''');
    ELSE
        EXEC(N'DELETE FROM dbo.FormasPago WHERE LOWER(ISNULL(descripcion, '''')) LIKE ''%saldo a favor%''');
END
GO

-- ========== 4. Diagnóstico / saneamiento de CxC huérfanas (solo SELECT de apoyo) ==========
-- Ejecutar manualmente para revisar antes de aplicar SANEAMIENTO:
-- SELECT cc.idCredito, cc.idEmpresa, cc.idCliente, cc.idVenta, cc.estado, cc.montoTotal,
--        v.compVenta, v.eliminado,
--        (SELECT ISNULL(SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota ELSE 0 END),0)
--           FROM CuotasCredito cu WHERE cu.idCredito = cc.idCredito) AS totalPagado,
--        (SELECT ISNULL(SUM(CASE WHEN cu.estado IN ('PENDIENTE','VENCIDO') THEN cu.saldoPendiente ELSE 0 END),0)
--           FROM CuotasCredito cu WHERE cu.idCredito = cc.idCredito) AS saldoPendiente
-- FROM CreditosClientes cc
-- LEFT JOIN Ventas v ON v.idVenta = cc.idVenta AND v.idEmpresa = cc.idEmpresa
-- WHERE cc.estado = 'ACTIVO'
--   AND (v.idVenta IS NULL OR ISNULL(v.eliminado,0) = 1);
GO
