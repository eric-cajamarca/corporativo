/*
  Eliminación en cascada lógica de 3 empresas (gestora + 2 gestionadas) y todos los datos vinculados.

  IMPORTANTE
  - Irreversible. Hacer BACKUP completo de la base antes.
  - Sustituir los 3 GUID por los obtenidos en 01_validar_y_obtener_ids.sql.
  - Ajusta USE si tu base no se llama SistemaInventario.

  Tablas/columnas con FK a Empresas en NO ACTION (según diagnóstico típico): Gestores_Empresas,
  AuditoriaUsuario, DetalleCotizacion.idEmpresaProducto (UPDATE NULL), DetallePresupuestos,
  CuotasCredito, PagosCuotas, GuiasElectronicasEmitidas, ProductosImagen,
  DetalleVentaAgrupada, VentaAgrupadaLog, VentaAgrupada, VentaEmpresa,
  PagosSuscripcionEmpresa.idEmpresaCliente. El resto cae por CASCADE al borrar Empresas.

  Si al ejecutar aparece error de clave foránea, revisa el mensaje: puede existir otra tabla
  añadida en tu entorno; consulta sys.foreign_keys hacia dbo.Empresas.
*/

USE SistemaInventario;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONFIGURAR: los tres UNIQUEIDENTIFIER (sin comillas mal cerradas)
-- ═══════════════════════════════════════════════════════════════════════════════

DECLARE @IdGestora     UNIQUEIDENTIFIER = '434F5BE5-C371-44D7-A88D-11A7D5D7D4CB'; -- <-- GESTORA
DECLARE @IdGestionada1 UNIQUEIDENTIFIER = 'EE318D5D-9CE9-43B3-A5AB-6CA885808FF8'; -- <-- GESTIONADA 1
DECLARE @IdGestionada2 UNIQUEIDENTIFIER = '76200185-583A-4CE7-AB59-B9FA1BB87FEE'; -- <-- GESTIONADA 2


DECLARE @Ids TABLE (id UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @Ids (id) VALUES (@IdGestora), (@IdGestionada1), (@IdGestionada2);

BEGIN TRAN;

BEGIN TRY

    /* 1) Relaciones gestor ↔ gestionadas (FK sin CASCADE) */
    IF OBJECT_ID('dbo.Gestores_Empresas', 'U') IS NOT NULL
    BEGIN
        DELETE FROM dbo.Gestores_Empresas
        WHERE idEmpresaOrigen IN (SELECT id FROM @Ids)
           OR idEmpresaDestino IN (SELECT id FROM @Ids);
    END;

    /*
       2) Cotización agrupada: DetalleCotizacion.idEmpresaProducto → Empresas (FK sin CASCADE).
       Las líneas pueden apuntar al catálogo de otra empresa que también se elimina.
    */
    IF COL_LENGTH('dbo.DetalleCotizacion', 'idEmpresaProducto') IS NOT NULL
    BEGIN
        UPDATE dbo.DetalleCotizacion
        SET idEmpresaProducto = NULL
        WHERE idEmpresaProducto IN (SELECT id FROM @Ids);
    END

    /* 3) Auditoría (idEmpresa sin CASCADE; además bloquea borrado de usuarios si quedan filas) */
    IF OBJECT_ID('dbo.AuditoriaUsuario', 'U') IS NOT NULL
        DELETE FROM dbo.AuditoriaUsuario WHERE idEmpresa IN (SELECT id FROM @Ids);

    /* 4) Imágenes de producto: FK idEmpresa sin CASCADE explícito */
    IF OBJECT_ID('dbo.ProductosImagen', 'U') IS NOT NULL
        DELETE FROM dbo.ProductosImagen WHERE idEmpresa IN (SELECT id FROM @Ids);

    /* 5) Contabilidad: detalle presupuesto con FK idEmpresa sin CASCADE */
    IF OBJECT_ID('dbo.DetallePresupuestos', 'U') IS NOT NULL
        DELETE FROM dbo.DetallePresupuestos WHERE idEmpresa IN (SELECT id FROM @Ids);

    /* 6) Guías electrónicas emitidas (migración: FK sin CASCADE) */
    IF OBJECT_ID('dbo.GuiasElectronicasEmitidas', 'U') IS NOT NULL
        DELETE FROM dbo.GuiasElectronicasEmitidas WHERE idEmpresa IN (SELECT id FROM @Ids);

    /* 7) Créditos: Pagos → Cuotas → Créditos (varias FK sin CASCADE sobre idEmpresa) */
    IF OBJECT_ID('dbo.PagosCuotas', 'U') IS NOT NULL
        DELETE FROM dbo.PagosCuotas WHERE idEmpresa IN (SELECT id FROM @Ids);

    IF OBJECT_ID('dbo.CuotasCredito', 'U') IS NOT NULL
        DELETE FROM dbo.CuotasCredito WHERE idEmpresa IN (SELECT id FROM @Ids);

    IF OBJECT_ID('dbo.CreditosClientes', 'U') IS NOT NULL
        DELETE FROM dbo.CreditosClientes WHERE idEmpresa IN (SELECT id FROM @Ids);

    /*
       8) Ventas corporativas: VentaAgrupada (cobradora), VentaEmpresa (empresa emisora), detalle
    */
    IF OBJECT_ID('dbo.DetalleVentaEmpresa', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.VentaEmpresa', 'U') IS NOT NULL
    BEGIN
        DELETE dve
        FROM dbo.DetalleVentaEmpresa AS dve
        INNER JOIN dbo.VentaEmpresa AS ve ON ve.idVentaEmpresa = dve.idVentaEmpresa
        WHERE ve.idEmpresa IN (SELECT id FROM @Ids)
           OR EXISTS (
                SELECT 1
                FROM dbo.VentaAgrupada AS va
                WHERE va.idVentaAgrupada = ve.idVentaAgrupada
                  AND va.idEmpresaCobradora IN (SELECT id FROM @Ids)
           );

        DELETE ve
        FROM dbo.VentaEmpresa AS ve
        WHERE ve.idEmpresa IN (SELECT id FROM @Ids)
           OR EXISTS (
                SELECT 1
                FROM dbo.VentaAgrupada AS va
                WHERE va.idVentaAgrupada = ve.idVentaAgrupada
                  AND va.idEmpresaCobradora IN (SELECT id FROM @Ids)
           );
    END;

    /*
       8a) Comprobante VA (gestora): hijos de VentaAgrupada — migración upgrade_venta_agrupada_comprobante.sql
       (FK_DetalleVA_VentaAgrupada, FK_VALog_VentaAgrupada). Deben borrarse antes de VentaAgrupada.
    */
    IF OBJECT_ID('dbo.DetalleVentaAgrupada', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.VentaAgrupada', 'U') IS NOT NULL
    BEGIN
        DELETE dva
        FROM dbo.DetalleVentaAgrupada AS dva
        INNER JOIN dbo.VentaAgrupada AS va ON va.idVentaAgrupada = dva.idVentaAgrupada
        WHERE va.idEmpresaCobradora IN (SELECT id FROM @Ids);
    END;

    IF OBJECT_ID('dbo.VentaAgrupadaLog', 'U') IS NOT NULL
       AND OBJECT_ID('dbo.VentaAgrupada', 'U') IS NOT NULL
    BEGIN
        DELETE val
        FROM dbo.VentaAgrupadaLog AS val
        INNER JOIN dbo.VentaAgrupada AS va ON va.idVentaAgrupada = val.idVentaAgrupada
        WHERE va.idEmpresaCobradora IN (SELECT id FROM @Ids);
    END;

    /* Quitar idVentaAgrupada en cualquier venta que apunte a un VA que vamos a borrar (evita FK / huérfanos) */
    IF COL_LENGTH('dbo.Ventas', 'idVentaAgrupada') IS NOT NULL
       AND OBJECT_ID('dbo.VentaAgrupada', 'U') IS NOT NULL
    BEGIN
        UPDATE v
        SET v.idVentaAgrupada = NULL
        FROM dbo.Ventas AS v
        WHERE v.idVentaAgrupada IS NOT NULL
          AND EXISTS (
                SELECT 1
                FROM dbo.VentaAgrupada AS va
                WHERE va.idVentaAgrupada = v.idVentaAgrupada
                  AND va.idEmpresaCobradora IN (SELECT id FROM @Ids)
          );
    END;

    IF OBJECT_ID('dbo.VentaAgrupada', 'U') IS NOT NULL
        DELETE FROM dbo.VentaAgrupada WHERE idEmpresaCobradora IN (SELECT id FROM @Ids);

    /*
       8b) PagosSuscripcionEmpresa: idEmpresaCliente → Empresas es NO ACTION
       (idEmpresaPrincipal sí CASCADE al borrar la empresa principal).
    */
    IF OBJECT_ID('dbo.PagosSuscripcionEmpresa', 'U') IS NOT NULL
        DELETE FROM dbo.PagosSuscripcionEmpresa
        WHERE idEmpresaCliente IN (SELECT id FROM @Ids);

    /* 9) Sesiones y auditoría de seguridad (sin FK a Empresas en algunas versiones; por si acaso) */
    IF OBJECT_ID('dbo.SesionRefreshToken', 'U') IS NOT NULL
        DELETE FROM dbo.SesionRefreshToken WHERE idEmpresa IN (SELECT id FROM @Ids);

    IF OBJECT_ID('dbo.SeguridadAuditoria', 'U') IS NOT NULL
        DELETE FROM dbo.SeguridadAuditoria WHERE idEmpresa IN (SELECT id FROM @Ids);

    /*
       10) Borrado de las filas en Empresas. El motor eliminará el resto vía ON DELETE CASCADE
           donde esté definido (inventario, ventas, compras, usuarios, etc.).
    */
    DELETE FROM dbo.Empresas WHERE idEmpresa IN (SELECT id FROM @Ids);

    /* Comprobación rápida */
    IF EXISTS (SELECT 1 FROM dbo.Empresas WHERE idEmpresa IN (SELECT id FROM @Ids))
        THROW 50001, 'Quedaron filas en Empresas: revisar FK u otras tablas no contempladas.', 1;

    COMMIT TRAN;
    PRINT 'OK: las 3 empresas y datos dependientes fueron eliminados.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    THROW;
END CATCH;
GO
