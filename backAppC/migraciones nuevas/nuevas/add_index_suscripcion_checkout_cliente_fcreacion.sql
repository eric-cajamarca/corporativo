-- Mejora consultas por empresa en SuscripcionCheckoutPendiente (obtenerMiEstado / listar checkouts).
-- Idempotente: solo crea el índice si no existe.

IF OBJECT_ID(N'dbo.SuscripcionCheckoutPendiente', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    INNER JOIN sys.tables t ON i.object_id = t.object_id
    WHERE t.name = N'SuscripcionCheckoutPendiente' AND i.name = N'IX_SCP_idEmpresaCliente_fCreacion'
  )
BEGIN
    CREATE NONCLUSTERED INDEX IX_SCP_idEmpresaCliente_fCreacion
    ON dbo.SuscripcionCheckoutPendiente (idEmpresaCliente, fCreacion DESC)
    INCLUDE (orderNumber, planCode, billingCycle, monto, moneda, estado, fConfirmacion, idCheckout);
END
GO
