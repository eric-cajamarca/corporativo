-- =============================================
-- INSTALACIÓN COMPLETA - BASE DE DATOS SistemaInventario
-- Respaldo: ejecutar desde la carpeta respaldo (o ajustar rutas en :r)
-- Uso en SSMS: File > Open > instalar_base_completa.sql, ejecutar con sqlcmd mode ON
-- O desde cmd: sqlcmd -S servidor -i "c:\ruta\respaldo\instalar_base_completa.sql"
-- =============================================

SET NOCOUNT ON;
PRINT '=============================================';
PRINT 'Iniciando instalación completa del sistema...';
PRINT '=============================================';
GO

-- =============================================
-- PASO 1: BASE CORREGIDA (incluye tablas Concepto y catálogos antes de MovimientosCaja)
-- =============================================
PRINT 'PASO 1: Ejecutando base_datos_mejorada.sql...';
GO
:r base_datos_mejorada.sql
GO
PRINT 'PASO 1 COMPLETADO.';
GO

-- =============================================
-- PASO 2: MIGRACIONES backAppC (en orden)
-- =============================================
PRINT 'PASO 2: Migraciones backAppC...';
GO
:r migrations_backAppC\create_catalogos_tablas.sql
:r migrations_backAppC\create_cotizaciones_detalle_cotizacion.sql
:r migrations_backAppC\create_creditos_clientes_cuotas_pagos.sql
:r migrations_backAppC\alter_impuestos_codigo_sunat.sql
:r migrations_backAppC\add_clientes_sujeto_credito_linea.sql
:r migrations_backAppC\add_comprobantes_usar_venta_compra.sql
:r migrations_backAppC\comprobantes_unique_empresa_codigo.sql
:r migrations_backAppC\add_idEstadoPedido_ventas.sql
:r migrations_backAppC\add_numero_lote_compras.sql
:r migrations_backAppC\alter_concepto_id_tipo_movimiento_caja.sql
:r migrations_backAppC\alter_movimientos_caja_id_concepto_comprobantes_ri_re.sql
:r migrations_backAppC\alter_detalle_cotizacion_idSucursal_uniqueidentifier.sql
GO
PRINT 'PASO 2 COMPLETADO.';
GO

-- =============================================
-- PASO 3: MIGRACIONES Query/sjb (Factiliza, ProductosImagen)
-- =============================================
PRINT 'PASO 3: Migraciones Factiliza y ProductosImagen...';
GO
:r migrations_sjb\migration_factiliza_tablas.sql
:r migrations_sjb\migration_factiliza_tipo_cambio.sql
:r migrations_sjb\migration_factiliza_whatsapp.sql
:r migrations_sjb\migration_empresa_factiliza_servicio.sql
:r migrations_sjb\migration_empresa_faciliza_tabla.sql
:r migrations_sjb\migration_productos_imagen.sql
GO
PRINT 'PASO 3 COMPLETADO.';
GO

PRINT '=============================================';
PRINT 'Instalación completa finalizada.';
PRINT 'Opcional: ejecutar datos_iniciales.sql y datos_adicionales.sql desde Query/sjb si los utiliza.';
PRINT '=============================================';
GO
