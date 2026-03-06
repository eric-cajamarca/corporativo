-- =============================================
-- INSTALACIÓN COMPLETA - BASE DE DATOS
-- Nombre de la base: cambie la línea siguiente al nombre que desee.
-- =============================================
-- Modo sqlcmd: activar en SSMS (Query > SQLCMD Mode) o usar: sqlcmd -S servidor -i "ruta\instalar_base_completa.sql"
-- Ejecutar desde la carpeta respaldo (cd respaldo) para que las rutas :r sean correctas.
--
-- Si usa un nombre distinto a SistemaInventario:
--   1) Abra base_datos_mejorada.sql y elimine las líneas 7-19 (USE master; CREATE DATABASE... USE SistemaInventario;).
--   2) En ese mismo archivo, reemplace "USE SistemaInventario" por "USE [$(DatabaseName)]" (solo si queda alguna).
--   Así las tablas se crearán en la base que definió abajo.
-- =============================================

:setvar DatabaseName "SistemaInventario"
-- Ejemplos: "MiEmpresaDB" , "InventarioProduccion" , etc.

SET NOCOUNT ON;
PRINT '=============================================';
PRINT 'Iniciando instalación completa del sistema...';
PRINT 'Base de datos: $(DatabaseName)';
PRINT '=============================================';
GO

-- =============================================
-- PASO 0: CREAR LA BASE DE DATOS (si no existe)
-- =============================================
USE master;
GO
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '$(DatabaseName)')
BEGIN
    EXEC('CREATE DATABASE [$(DatabaseName)]');
    PRINT 'Base de datos $(DatabaseName) creada.';
END
ELSE
    PRINT 'Base de datos $(DatabaseName) ya existe.';
GO

USE [$(DatabaseName)];
GO
PRINT 'Usando base de datos: $(DatabaseName)';
GO

-- =============================================
-- PASO 1: BASE CORREGIDA (tablas principales, Concepto, Caja, etc.)
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
:r ..\backAppC\migrations\add_costos_detalle_venta.sql
:r ..\backAppC\migrations\create_gastos_analisis.sql
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
PRINT 'Instalación de estructura finalizada.';
PRINT 'Opcional: ejecutar datos_iniciales.sql y datos_adicionales.sql desde Query/sjb (cambiar USE al nombre de su base si no es SistemaInventario).';
PRINT '=============================================';
GO
