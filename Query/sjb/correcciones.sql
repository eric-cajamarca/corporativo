-- =============================================
-- CORRECCIONES PARA LA BASE DE DATOS
-- Arreglar errores encontrados durante la creación
-- =============================================

USE SistemaInventario;
GO

-- =============================================
-- 1. CORREGIR CAMPOS TEXT POR NVARCHAR(MAX)
-- =============================================

-- Verificar si las tablas existen y tienen los tipos de datos correctos
IF EXISTS (SELECT * FROM sysobjects WHERE name = 'Empresas' AND xtype = 'U')
BEGIN
    -- Cambiar password de TEXT a NVARCHAR(MAX) si es necesario
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Empresas') AND name = 'password' AND system_type_id = 35) -- TEXT
    BEGIN
        ALTER TABLE Empresas ALTER COLUMN password NVARCHAR(MAX);
        PRINT 'Campo password en Empresas corregido de TEXT a NVARCHAR(MAX)';
    END
END

IF EXISTS (SELECT * FROM sysobjects WHERE name = 'UsuarioWeb' AND xtype = 'U')
BEGIN
    -- Cambiar password de TEXT a NVARCHAR(MAX) si es necesario
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UsuarioWeb') AND name = 'password' AND system_type_id = 35) -- TEXT
    BEGIN
        ALTER TABLE UsuarioWeb ALTER COLUMN password NVARCHAR(MAX);
        PRINT 'Campo password en UsuarioWeb corregido de TEXT a NVARCHAR(MAX)';
    END
END

-- =============================================
-- 2. CREAR TABLAS QUE PUEDEN HABER FALTADO
-- =============================================

-- Verificar y crear tabla RolPermisos si no existe
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'RolPermisos' AND xtype = 'U')
BEGIN
    CREATE TABLE RolPermisos (
        idRol UNIQUEIDENTIFIER NOT NULL,
        idPermiso UNIQUEIDENTIFIER NOT NULL,
        PRIMARY KEY (idRol, idPermiso),
        FOREIGN KEY (idRol) REFERENCES Rol(idRol) ON DELETE CASCADE,
        FOREIGN KEY (idPermiso) REFERENCES Permisos(idPermiso) ON DELETE CASCADE
    );
    PRINT 'Tabla RolPermisos creada exitosamente';
END

-- Verificar y crear tabla UsuarioSucursal si no existe
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'UsuarioSucursal' AND xtype = 'U')
BEGIN
    CREATE TABLE UsuarioSucursal (
        idUsuario UNIQUEIDENTIFIER NOT NULL,
        idSucursal UNIQUEIDENTIFIER NOT NULL,
        PRIMARY KEY (idUsuario, idSucursal),
        FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario) ON DELETE CASCADE,
        FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal) ON DELETE CASCADE
    );
    PRINT 'Tabla UsuarioSucursal creada exitosamente';
END

-- =============================================
-- 3. CORREGIR RESTRICCIONES DE FOREIGN KEY CON CICLOS
-- =============================================

-- Quitar CASCADE de restricciones problemáticas si existen
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK__DetallePr__idEmp__153B1FDF')
BEGIN
    ALTER TABLE DetallePresupuestos DROP CONSTRAINT FK__DetallePr__idEmp__153B1FDF;
    ALTER TABLE DetallePresupuestos ADD CONSTRAINT FK_DetallePresupuestos_Empresa
        FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa);
    PRINT 'Restricción FK en DetallePresupuestos corregida';
END

-- =============================================
-- 4. VERIFICAR QUE TODAS LAS TABLAS EXISTAN
-- =============================================

DECLARE @tablas_verificar TABLE (tabla NVARCHAR(100));
INSERT INTO @tablas_verificar VALUES
('Empresas'), ('UsuarioWeb'), ('Rol'), ('Permisos'), ('RolPermisos'),
('Sucursal'), ('UsuarioSucursal'), ('Categorias'), ('Marcas'),
('Productos'), ('ListasPrecio'), ('PreciosProducto'), ('Comprobantes'),
('Clientes'), ('Proveedores'), ('Moneda'), ('MediosPago'),
('Presentacion'), ('Documentos'), ('EstadoPago'), ('Compras'),
('DetalleCompras'), ('Ventas'), ('DetalleVenta'), ('StockSucursal'),
('Lotes'), ('MovimientosInventario'), ('TiposMovimiento'),
('AperturasCaja'), ('MovimientosCaja'), ('TiposMovimientoCaja'),
('CreditosClientes'), ('CuotasCredito'), ('PagosCuotas'),
('TiposDespacho'), ('Despachos'), ('DetalleDespachos'),
('TiposEnvio'), ('EstadosEnvio'), ('Transportistas'), ('Envios'),
('HistorialEstadosEnvio'), ('EstadosSunat'), ('ComprobantesElectronicos'),
('ConfiguracionFacturacionElectronica'), ('PlanCuentas'), ('CentrosCosto'),
('PeriodosContables'), ('AsientosContables'), ('DetalleAsientos'),
('CuentasBancarias'), ('MovimientosBancarios'), ('ActivosFijos'),
('DepreciacionActivos'), ('Presupuestos'), ('DetallePresupuestos'),
('ConfiguracionContable');

DECLARE @tabla NVARCHAR(100);
DECLARE @sql NVARCHAR(MAX);

DECLARE tabla_cursor CURSOR FOR
SELECT tabla FROM @tablas_verificar;

OPEN tabla_cursor;
FETCH NEXT FROM tabla_cursor INTO @tabla;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = 'IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = ''' + @tabla + ''' AND xtype = ''U'')
                 PRINT ''FALTA CREAR TABLA: ' + @tabla + '''';

    EXEC sp_executesql @sql;

    FETCH NEXT FROM tabla_cursor INTO @tabla;
END

CLOSE tabla_cursor;
DEALLOCATE tabla_cursor;

PRINT 'Verificación de tablas completada';

-- =============================================
-- 5. CREAR ÍNDICES BÁSICOS SI NO EXISTEN
-- =============================================

-- Índices básicos para funcionamiento mínimo
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Empresas_RUC' AND object_id = OBJECT_ID('Empresas'))
BEGIN
    CREATE INDEX IX_Empresas_RUC ON Empresas(ruc);
    PRINT 'Índice IX_Empresas_RUC creado';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UsuarioWeb_Email' AND object_id = OBJECT_ID('UsuarioWeb'))
BEGIN
    CREATE INDEX IX_UsuarioWeb_Email ON UsuarioWeb(email);
    PRINT 'Índice IX_UsuarioWeb_Email creado';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Productos_Codigo' AND object_id = OBJECT_ID('Productos'))
BEGIN
    CREATE INDEX IX_Productos_Codigo ON Productos(idEmpresa, codigo);
    PRINT 'Índice IX_Productos_Codigo creado';
END

PRINT 'Correcciones aplicadas exitosamente.';
PRINT 'Ahora puedes ejecutar los scripts de datos en orden.';
GO