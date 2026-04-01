-- =============================================
-- INSTALACIÓN COMPLETA - BASE DE DATOS
-- Nombre de la base: cambie la línea siguiente al nombre que desee.
-- =============================================
-- Modo sqlcmd: activar en SSMS (Query > SQLCMD Mode) o usar: sqlcmd -S servidor -i "ruta\instalar_base_completa.sql"
-- Ejecutar desde la carpeta respaldo (cd respaldo) para que las rutas :r sean correctas.
--
-- El esquema completo (antes repartido en base_datos_mejorada + migrations_backAppC + migrations_sjb
-- + rutas en backAppC/migrations) está unificado en base_datos_mejorada.sql.
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
-- PASO 1: ESQUEMA UNIFICADO (tablas, Factiliza, ProductosImagen, Gastos, etc.)
-- =============================================
PRINT 'PASO 1: Ejecutando base_datos_mejorada.sql...';
GO
:r base_datos_mejorada.sql
GO
PRINT 'PASO 1 COMPLETADO.';
GO

PRINT '=============================================';
PRINT 'Instalación de estructura finalizada.';
PRINT 'Opcional: ejecutar datos_iniciales.sql y datos_adicionales.sql desde Query/sjb (cambiar USE al nombre de su base si no es SistemaInventario).';
PRINT 'Cambios incrementales del backend sueltos siguen en backAppC/migrations/ (bases ya existentes).';
PRINT '=============================================';
GO
