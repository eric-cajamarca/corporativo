-- =============================================
-- BASE DE DATOS MEJORADA - SISTEMA MULTIEMPRESA
-- Fecha: 2026-01-24
-- Versión: 2.0 - Optimizada y Completa
-- =============================================

USE master;
GO

-- Crear base de datos si no existe
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'SistemaInventario')
BEGIN
    CREATE DATABASE SistemaInventario;
END
GO

USE SistemaInventario;
GO

-- =============================================
-- TABLAS MAESTRAS GLOBALES (SUNAT)
-- =============================================

-- Tabla de documentos de identidad (global)
CREATE TABLE Documentos (
    idDocumento varchar(1) PRIMARY KEY NOT NULL,
    nombre varchar(20) NOT NULL,
    descripcion varchar(200) NOT NULL,
);
GO

-- Tabla de presentaciones (global - SUNAT)
CREATE TABLE Presentacion (
    idPresentacion int IDENTITY(1,1) PRIMARY KEY NOT NULL,
    codigo varchar(3) NOT NULL UNIQUE,
    descripcion varchar(50) NULL,
    multiplicador int NULL,
);
GO

-- Tabla de medios de pago (global - SUNAT)
CREATE TABLE MediosPago (
    idMediosPago int IDENTITY PRIMARY KEY NOT NULL,
    codigo varchar(3) NOT NULL UNIQUE,
    descripcion varchar(50) NOT NULL
);
GO

-- Tabla de monedas (global)
CREATE TABLE Moneda (
    idMoneda int IDENTITY(1,1) PRIMARY KEY NOT NULL,
    codigo varchar(3) NOT NULL UNIQUE,
    descripcion varchar(20) NOT NULL,
    simbolo varchar(3) NOT NULL,
);
GO

-- =============================================
-- TABLAS MULTIEMPRESA - CONFIGURACIÓN
-- =============================================

-- Tabla de empresas mejorada
CREATE TABLE Empresas (
    idEmpresa UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
    idDocumento varchar(1) NOT NULL,
    ruc varchar(11) NOT NULL UNIQUE,
    razon_Social varchar(200) NOT NULL,
    nombreComercial varchar(200) NULL,
    rubro varchar(200) NULL,
    celular varchar(11) NULL,
    correo varchar(100) NOT NULL UNIQUE,
    password NVARCHAR(MAX) NOT NULL,
    logo varchar(200) NULL,
    alias varchar(10) NULL,
    condicion varchar(20) NULL,
    estSunat varchar(20) NULL,
    estado BIT NOT NULL DEFAULT 1,
    fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
    fModificacion DATETIME NULL,
    usuarioModificacion UNIQUEIDENTIFIER NULL,

    FOREIGN KEY (idDocumento) REFERENCES Documentos (idDocumento),
);
GO

-- Tabla de direcciones de empresa
CREATE TABLE DireccionEmpresa (
    idDireccionEmpresa INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    ubigeo varchar(10) NULL,
    codPais varchar(10) NULL,
    region varchar(50) NULL,
    provincia varchar(50) NULL,
    distrito varchar(50) NULL,
    urbanizacion varchar(100) NULL,
    direccion VARCHAR(255) NULL,
    codLocal varchar(10) NULL,
    principal BIT DEFAULT 0,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
);
GO

-- Tabla para gestores de empresas (empresas que pueden gestionar otras)
CREATE TABLE Gestores_Empresas (
    idGestor INT IDENTITY PRIMARY KEY,
    idEmpresaOrigen UNIQUEIDENTIFIER NOT NULL,
    idEmpresaDestino UNIQUEIDENTIFIER NOT NULL,
    estado BIT DEFAULT 1,
    fAsignacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresaOrigen) REFERENCES Empresas(idEmpresa),
    FOREIGN KEY (idEmpresaDestino) REFERENCES Empresas(idEmpresa),
    CONSTRAINT UQ_Gestores_Empresas UNIQUE (idEmpresaOrigen, idEmpresaDestino)
);
GO

-- Tabla de configuración por empresa
CREATE TABLE ConfiguracionEmpresa (
    idConfiguracion UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    clave VARCHAR(100) NOT NULL,
    valor VARCHAR(500) NOT NULL,
    descripcion VARCHAR(200),
    tipoDato VARCHAR(20) DEFAULT 'STRING', -- STRING, NUMBER, BOOLEAN, JSON
    fCreacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_ConfiguracionEmpresa_Clave UNIQUE (idEmpresa, clave)
);
GO

-- =============================================
-- TABLAS MULTIEMPRESA - USUARIOS Y ROLES
-- =============================================
CREATE TABLE [dbo].[Correlativos](
    [idCorrelativo] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [numero] [int] NOT NULL,
    CONSTRAINT [PK_Correlativos] PRIMARY KEY CLUSTERED ([idCorrelativo] ASC)
);

ALTER TABLE [dbo].[Correlativos]
ADD CONSTRAINT [FK_Correlativos_Empresas]
FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas]([idEmpresa]) ON DELETE CASCADE;

-- Tabla de roles mejorada
CREATE TABLE Rol (
    idRol UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    descripcion VARCHAR(50) NOT NULL,
    estado BIT DEFAULT 1,
    fCreacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_Rol_Empresa UNIQUE (idEmpresa, descripcion)
);
GO

-- Tabla de permisos por empresa
CREATE TABLE Permisos (
    idPermiso UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(100) NOT NULL, -- VER_PRODUCTOS, CREAR_VENTAS, etc.
    descripcion VARCHAR(200),
    modulo VARCHAR(50), -- INVENTARIO, VENTAS, COMPRAS, etc.
    estado BIT DEFAULT 1,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_Permisos_EmpresaNombre UNIQUE (idEmpresa, nombre)
);
GO

-- Tabla de asociación rol-permisos
--CREATE TABLE RolPermisos (
--    idRol UNIQUEIDENTIFIER NOT NULL,
--    idPermiso UNIQUEIDENTIFIER NOT NULL,
--    PRIMARY KEY (idRol, idPermiso),

--    FOREIGN KEY (idRol) REFERENCES Rol(idRol) ON DELETE CASCADE,
--    FOREIGN KEY (idPermiso) REFERENCES Permisos(idPermiso) ON DELETE CASCADE
--);
--GO

CREATE TABLE RolPermisos (
    idRol UNIQUEIDENTIFIER NOT NULL,
    idPermiso UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_RolPermisos PRIMARY KEY (idRol, idPermiso),

    CONSTRAINT FK_RolPermisos_Rol
      FOREIGN KEY (idRol)
      REFERENCES dbo.Rol(idRol)
      ON DELETE CASCADE,

    CONSTRAINT FK_RolPermisos_Permisos
      FOREIGN KEY (idPermiso)
      REFERENCES dbo.Permisos(idPermiso)
      ON DELETE NO ACTION
);
GO
select * from RolPermisos

-- Tabla de usuarios mejorada
CREATE TABLE UsuarioWeb (
    idUsuario UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombres VARCHAR(50) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password NVARCHAR(MAX) NOT NULL,
    idRol UNIQUEIDENTIFIER NOT NULL,
    estado BIT NOT NULL DEFAULT 1,
    fRegistro DATETIME NOT NULL DEFAULT GETDATE(),
    ultimoLogin DATETIME NULL,
    intentosFallidos INT DEFAULT 0,
    bloqueadoHasta DATETIME NULL,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idRol) REFERENCES Rol(idRol),
);
GO

-- Tabla de sesiones de usuario
CREATE TABLE SesionesUsuario (
    idSesion UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    fechaInicio DATETIME NOT NULL DEFAULT GETDATE(),
    fechaExpiracion DATETIME NOT NULL,
    ipAddress VARCHAR(45),
    userAgent VARCHAR(500),
    activo BIT NOT NULL DEFAULT 1,

    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario) ON DELETE CASCADE
);
GO

-- =============================================
-- TABLAS MULTIEMPRESA - CATÁLOGOS
-- =============================================

-- Tabla de categorías mejorada
CREATE TABLE Categorias (
    idCategoria INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    estado BIT NOT NULL DEFAULT 1,
    fCreacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_Categorias_EmpresaNombre UNIQUE (idEmpresa, nombre)
);
GO

-- Tabla de marcas mejorada
CREATE TABLE Marcas (
    idMarca INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(200) NULL,
    contacto VARCHAR(100) NULL,
    paginaWeb VARCHAR(100) NULL,
    estado BIT NOT NULL DEFAULT 1,
    fCreacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_Marcas_EmpresaNombre UNIQUE (idEmpresa, nombre)
);
GO

-- Tabla de clientes mejorada
CREATE TABLE Clientes (
    idCliente INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idDocumento VARCHAR(1) NOT NULL,
    ruc VARCHAR(11) NOT NULL,
    rSocial VARCHAR(200) NOT NULL,
    correo VARCHAR(100) NULL,
    celular VARCHAR(50) NULL,
    condicion VARCHAR(50) NULL,
    estado BIT NOT NULL DEFAULT 1,
    fCreacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idDocumento) REFERENCES Documentos(idDocumento),
    CONSTRAINT UQ_Clientes_EmpresaRuc UNIQUE (idEmpresa, ruc)
);
GO

-- Tabla de direcciones de clientes
CREATE TABLE DireccionClientes (
    idDireccionClientes INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idCliente INT NOT NULL,
    ubigeo VARCHAR(10) NULL,
    codPais VARCHAR(10) NULL,
    region VARCHAR(50) NULL,
    provincia VARCHAR(50) NULL,
    distrito VARCHAR(50) NULL,
    urbanizacion VARCHAR(100) NULL,
    direccion VARCHAR(255) NULL,
    referencia VARCHAR(200) NULL,
    codLocal VARCHAR(10) NULL,
    principal BIT DEFAULT 0,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente) ON DELETE NO ACTION,
);
GO

-- Tabla de proveedores mejorada
CREATE TABLE Proveedores (
    idProveedor INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idDocumento VARCHAR(1) NOT NULL,
    ruc VARCHAR(11) NOT NULL,
    rSocial VARCHAR(200) NOT NULL,
    correo VARCHAR(100) NULL,
    celular VARCHAR(50) NULL,
    condicion VARCHAR(50) NULL,
    estado BIT NOT NULL DEFAULT 1,
    fCreacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idDocumento) REFERENCES Documentos(idDocumento),
    CONSTRAINT UQ_Proveedores_EmpresaRuc UNIQUE (idEmpresa, ruc)
);
GO

-- Tabla de direcciones de proveedores
CREATE TABLE DireccionProveedor (
    idDireccionProveedor INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idProveedor INT NOT NULL,
    ubigeo VARCHAR(10) NULL,
    codPais VARCHAR(10) NULL,
    region VARCHAR(50) NULL,
    provincia VARCHAR(50) NULL,
    distrito VARCHAR(50) NULL,
    urbanizacion VARCHAR(100) NULL,
    direccion VARCHAR(255) NULL,
    referencia VARCHAR(200) NULL,
    codLocal VARCHAR(10) NULL,
    principal BIT DEFAULT 0,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idProveedor) REFERENCES Proveedores(idProveedor) ON DELETE NO ACTION,
);
GO

-- =============================================
-- TABLAS MULTIEMPRESA - PRODUCTOS E INVENTARIO
-- =============================================

-- Tabla de sucursales mejorada
CREATE TABLE Sucursal (
    idSucursal UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    direccion VARCHAR(200) NULL,
    telefono VARCHAR(20) NULL,
    responsable UNIQUEIDENTIFIER NULL,
    estado BIT NOT NULL DEFAULT 1,
    fRegistro DATETIME NOT NULL DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (responsable) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT UQ_Sucursal_EmpresaNombre UNIQUE (idEmpresa, nombre)
);
GO

-- Tabla de usuarios que pueden acceder a sucursales específicas
--CREATE TABLE UsuarioSucursal (
--    idUsuario UNIQUEIDENTIFIER NOT NULL,
--    idSucursal UNIQUEIDENTIFIER NOT NULL,
--    PRIMARY KEY (idUsuario, idSucursal),

--    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario) ON DELETE CASCADE,
--    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal) ON DELETE NO ACTION,
--);
--GO

--DROP TABLE UsuarioSucursal

CREATE TABLE UsuarioSucursal (
    idUsuarioSucursal UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    estado BIT NOT NULL DEFAULT 1,
    esDefault BIT NOT NULL DEFAULT 0,
	fAsignacion DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT PK_UsuarioSucursal PRIMARY KEY (idUsuarioSucursal),

    CONSTRAINT FK_UsuarioSucursal_Usuario
      FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario) ON DELETE CASCADE,

    CONSTRAINT FK_UsuarioSucursal_Sucursal
      FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal) ON DELETE NO ACTION,

    CONSTRAINT UQ_UsuarioSucursal UNIQUE (idUsuario, idSucursal)
);
GO


-- Tabla de productos mejorada
CREATE TABLE Productos (
    idProducto UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    codigo VARCHAR(20) NOT NULL,
    idCategoria INT NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    tipoProducto CHAR(1) NOT NULL DEFAULT 'S' CHECK (tipoProducto IN ('S', 'C')), -- 'S'imple o 'C'ompuesto
    idMarca INT NULL,
    idPresentacion INT NOT NULL,
    cUnitario DECIMAL(18,6) NOT NULL,
    fProduccion VARCHAR(10) NULL,
    fVencimiento VARCHAR(10) NULL,
    alertaMinimo DECIMAL(18,2) NULL,
    alertaMaximo DECIMAL(18,2) NULL,
    vecesVendidas INT NULL DEFAULT 0,
    facturar VARCHAR(2) NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    fIngreso DATETIME NOT NULL DEFAULT GETDATE(),
    estado BIT NOT NULL DEFAULT 1,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idCategoria) REFERENCES Categorias(idCategoria),
    FOREIGN KEY (idPresentacion) REFERENCES Presentacion(idPresentacion),
    FOREIGN KEY (idMarca) REFERENCES Marcas(idMarca),
    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT UQ_Productos_EmpresaCodigo UNIQUE (idEmpresa, codigo)
);
GO

-- Tabla de productos compuestos
CREATE TABLE ProductosCompuestos (
    idProductoCompuesto INT PRIMARY KEY IDENTITY,
    idProductoPadre UNIQUEIDENTIFIER NOT NULL,
    idProductoHijo UNIQUEIDENTIFIER NOT NULL,
    cantidad INT NOT NULL,

    FOREIGN KEY (idProductoPadre) REFERENCES Productos(idProducto) ON DELETE CASCADE,
    FOREIGN KEY (idProductoHijo) REFERENCES Productos(idProducto),
    CONSTRAINT UQ_ProductosCompuestos UNIQUE (idProductoPadre, idProductoHijo)
);
GO

---- Tabla de stock por sucursal mejorada
CREATE TABLE StockSucursal (
    idStockSucursal INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    cantidad DECIMAL(18,2) NOT NULL DEFAULT 0,
    fIngreso DATETIME DEFAULT GETDATE(),
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    ubicacion VARCHAR(50) NULL,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal) ON DELETE NO ACTION,
    FOREIGN KEY (idProducto) REFERENCES Productos(idProducto) ON DELETE NO ACTION,
    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT UQ_StockSucursal UNIQUE (idEmpresa, idSucursal, idProducto)
);
GO

-- Tabla de lotes mejorada
CREATE TABLE Lotes (
    idLote UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    costoUnitario DECIMAL(18,6) NOT NULL,
    cantidadIngresada DECIMAL(18,2) NOT NULL,
    cantidadDisponible DECIMAL(18,2) NOT NULL,
    fechaIngreso DATETIME NOT NULL DEFAULT GETDATE(),
    fechaVencimiento DATETIME NULL,
    numeroLote VARCHAR(50) NULL,

    FOREIGN KEY (idProducto) REFERENCES Productos(idProducto),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal)
);
GO

CREATE TABLE UbicacionesPrioridad (
    idUbicacion INT IDENTITY(1,1) PRIMARY KEY,
    idSucursal UNIQUEIDENTIFIER,
    codigoUbicacion VARCHAR(20), -- 'MOSTRADOR', 'ANDAMIO-5'
    prioridad INT, -- 1=Primero, 2=Segundo
    UNIQUE(codigoUbicacion)
)
SELECT * FROM UbicacionesPrioridad ORDER BY idSucursal, prioridad;

go
CREATE TABLE LotesUbicacion (
    idLote UNIQUEIDENTIFIER,
    idUbicacion INT,
    cantidad INT, -- Cantidad física en esa ubicación
    PRIMARY KEY(idLote, idUbicacion)
)




-- =============================================
-- TABLAS MULTIEMPRESA - PRECIOS Y LISTAS
-- =============================================

-- Tabla de listas de precio mejorada
CREATE TABLE ListasPrecio (
    idLista INT IDENTITY(1,1) NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NULL, -- NULL = lista global para todas las sucursales
    nombre VARCHAR(100) NOT NULL,
    idMoneda INT NOT NULL,
    principal BIT NOT NULL DEFAULT 0, -- 1 = lista por defecto
    conIgv BIT NOT NULL DEFAULT 1, -- indica si el precio ya tiene IGV
    fechaInicio DATE NOT NULL DEFAULT GETDATE(),
    fechaFin DATE NULL, -- NULL = vigente hasta aviso
    activo BIT NOT NULL DEFAULT 1,
    fCreacion DATETIME DEFAULT GETDATE(),

    CONSTRAINT PK_ListasPrecio PRIMARY KEY (idLista),
    CONSTRAINT FK_ListasPrecio_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_ListasPrecio_Moneda FOREIGN KEY (idMoneda) REFERENCES Moneda(idMoneda),
    CONSTRAINT FK_ListasPrecio_Sucursales FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    CONSTRAINT UQ_ListasPrecio_EmpSucNombre UNIQUE (idEmpresa, idSucursal, nombre)
);
GO

-- Tabla de precios por producto mejorada
CREATE TABLE PreciosProducto (
    idPrecio INT IDENTITY(1,1) NOT NULL,
    idLista INT NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    precio DECIMAL(18,6) NOT NULL,
    idMoneda INT NOT NULL,
    fActualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    idUsuario UNIQUEIDENTIFIER NULL,

    CONSTRAINT PK_PreciosProducto PRIMARY KEY (idPrecio),
    CONSTRAINT FK_PreciosProducto_ListasPrecio FOREIGN KEY (idLista) REFERENCES ListasPrecio(idLista) ON DELETE CASCADE,
    CONSTRAINT FK_PreciosProducto_Productos FOREIGN KEY (idProducto) REFERENCES Productos(idProducto) ON DELETE NO ACTION,
    CONSTRAINT FK_PreciosProducto_Moneda FOREIGN KEY (idMoneda) REFERENCES Moneda(idMoneda),
    CONSTRAINT FK_PreciosProducto_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT UQ_PreciosProducto_ListaProducto UNIQUE (idLista, idProducto)
);
GO

-- =============================================
-- TABLAS MULTIEMPRESA - COMPROBANTES Y SECUENCIAS
-- =============================================

-- Tabla de comprobantes mejorada
CREATE TABLE Comprobantes (
    idComprobante INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    codigo VARCHAR(2) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    serie VARCHAR(4) NOT NULL,
    numero INT NOT NULL DEFAULT 0,
    activo BIT DEFAULT 1,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_Comprobantes_EmpresaSerie UNIQUE (idEmpresa, serie)
);
GO

-- Tabla de secuencias para numeración automática
CREATE TABLE Secuencias (
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idComprobante VARCHAR(2) NOT NULL,
    serie VARCHAR(4) NOT NULL,
    ultimoNumero INT NOT NULL DEFAULT 0,
    fActualizacion DATETIME DEFAULT GETDATE(),

    CONSTRAINT PK_Secuencias PRIMARY KEY (idEmpresa, idSucursal, idComprobante, serie),
    CONSTRAINT FK_Secuencias_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_Secuencias_Sucursal FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal)
);
GO

-- =============================================
-- TABLAS MULTIEMPRESA - COMPRAS
-- =============================================

-- Tabla de estados de pago
CREATE TABLE EstadoPago (
    idEstadoPago INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    descripcion VARCHAR(20) NOT NULL,
);
GO

-- Tabla de compras mejorada
CREATE TABLE Compras (
    idCompra UNIQUEIDENTIFIER PRIMARY KEY NOT NULL DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    compCompra VARCHAR(13) NOT NULL,
    idComprobante INT NOT NULL,
    serie VARCHAR(4) NOT NULL,
    numero VARCHAR(8) NOT NULL,
    fEmision DATETIME NOT NULL,
    fVencimiento DATETIME NULL,
    idProveedor INT NOT NULL,
    idMoneda INT NOT NULL,
    idEstadoPago INT NOT NULL,
    subTotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    igv DECIMAL(18,2) NOT NULL DEFAULT 0,
    exonerado DECIMAL(18,2) NOT NULL DEFAULT 0,
    gratuito DECIMAL(18,2) NOT NULL DEFAULT 0,
    otrosCargos DECIMAL(18,2) NOT NULL DEFAULT 0,
    descuentos DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    idMediosPago INT NOT NULL,
    compRelacionado VARCHAR(50) NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    fRegistro DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idComprobante) REFERENCES Comprobantes(idComprobante),
    FOREIGN KEY (idMoneda) REFERENCES Moneda(idMoneda),
    FOREIGN KEY (idProveedor) REFERENCES Proveedores(idProveedor),
    FOREIGN KEY (idMediosPago) REFERENCES MediosPago(idMediosPago),
    FOREIGN KEY (idEstadoPago) REFERENCES EstadoPago(idEstadoPago),
    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT UQ_Compras_EmpresaSerieNumero UNIQUE (idEmpresa, serie, numero)
);
GO

--IF NOT EXISTS (
--    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_NAME = 'Compras' AND COLUMN_NAME = 'numeroLote'
--)
--BEGIN
--    ALTER TABLE Compras ADD numeroLote INT NULL;
--END
--GO
-- Tabla de detalle de compras mejorada
CREATE TABLE DetalleCompras (
    idDetalleCompra INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idCompra UNIQUEIDENTIFIER NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    idPresentacion INT NOT NULL,
    cantidad DECIMAL(18,3) NOT NULL,
    pUnitario DECIMAL(18,6) NOT NULL,
    total DECIMAL(18,2) NOT NULL,
    fleteXArticulo DECIMAL(10,5) NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    fRegistro DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    FOREIGN KEY (idCompra) REFERENCES Compras(idCompra),
    FOREIGN KEY (idProducto) REFERENCES Productos(idProducto),
    FOREIGN KEY (idPresentacion) REFERENCES Presentacion(idPresentacion),
    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
);
GO

-- =============================================
-- TABLAS MULTIEMPRESA - VENTAS
-- =============================================

-- Tabla de estados de pedido para ventas
CREATE TABLE EstadosPedidos (
    idEstadoPedido INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    descripcion VARCHAR(30) NOT NULL,
    color VARCHAR(7) NULL, -- Hex color para UI
);
GO

-- Tabla de ventas mejorada
CREATE TABLE Ventas (
    idVenta INT IDENTITY(1,1) NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    serie VARCHAR(4) NOT NULL,
    numero VARCHAR(8) NOT NULL,
    compVenta VARCHAR(13) NOT NULL,
    idComprobante INT NOT NULL,
    fEmision DATETIME NOT NULL,
    fVencimiento DATETIME NOT NULL,
    idCliente INT NOT NULL,
    idMoneda INT NOT NULL,
    tCambio DECIMAL(10,4) NOT NULL DEFAULT 1,
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
    igv DECIMAL(18,2) NOT NULL DEFAULT 0,
    exonerado DECIMAL(18,2) NOT NULL DEFAULT 0,
    gratuito DECIMAL(18,2) NOT NULL DEFAULT 0,
    otrosCargos DECIMAL(18,2) NOT NULL DEFAULT 0,
    descuentos DECIMAL(18,2) NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    idMediosPago VARCHAR(20) NOT NULL,
    idEstadoSunat INT NOT NULL DEFAULT 1,
    compRelacionado VARCHAR(30) NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    fechaAnulacion DATETIME NULL DEFAULT GETDATE(),
    idUsuarioAnulacion UNIQUEIDENTIFIER NULL,
    motivoAnulacion VARCHAR(255) NULL,
    fRegistro DATETIME DEFAULT GETDATE(),

    CONSTRAINT PK_Ventas PRIMARY KEY CLUSTERED(idVenta),
    CONSTRAINT FK_Ventas_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_Ventas_Sucursal FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    CONSTRAINT FK_Ventas_Clientes FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
    CONSTRAINT FK_Ventas_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT FK_Ventas_UsuarioAnulacion FOREIGN KEY (idUsuarioAnulacion) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT UQ_Ventas_SerieNumero UNIQUE (idEmpresa, serie, numero)
);
GO

-- Tabla de detalle de venta mejorada
CREATE TABLE DetalleVenta (
    idDetalle INT IDENTITY(1,1) NOT NULL,
    idVenta INT NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    cantidad DECIMAL(18,3) NOT NULL,
    pVenta DECIMAL(18,5) NOT NULL,
    descuento DECIMAL(18,2) NULL DEFAULT 0,
    subtotal DECIMAL(18,2) NOT NULL,
    igv BIT NOT NULL DEFAULT 0,
    isc BIT NOT NULL DEFAULT 0,
    total DECIMAL(18,2) NOT NULL,
    hVenta DATETIME NOT NULL DEFAULT GETDATE(),
    cantEntregada DECIMAL(18,3) NOT NULL DEFAULT 0,
    cantPendiente AS (cantidad - cantEntregada) PERSISTED,
    fUltEntrega DATETIME2 NULL,
    idEstadoPedido INT NOT NULL DEFAULT 1,

    CONSTRAINT PK_DetalleVenta PRIMARY KEY CLUSTERED (idDetalle),
    CONSTRAINT FK_DetalleVenta_Ventas FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta) ON DELETE CASCADE,
    CONSTRAINT FK_DetalleVenta_Productos FOREIGN KEY (idProducto) REFERENCES Productos(idProducto),
    CONSTRAINT FK_DetalleVenta_EstadoPedido FOREIGN KEY (idEstadoPedido) REFERENCES EstadosPedidos(idEstadoPedido)
);
GO

-- Tabla de entregas de productos de venta
CREATE TABLE DetalleVentaEntrega (
    idEntrega INT IDENTITY(1,1) PRIMARY KEY,
    idVenta INT NOT NULL,
    idDetalle INT NOT NULL,
    cantidad DECIMAL(18,3) NOT NULL,
    fEntrega DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    notas VARCHAR(200) NULL,

    CONSTRAINT FK_DetVentaEntrega_Ventas FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta) ON DELETE CASCADE,
    CONSTRAINT FK_DetVentaEntrega_Detalle FOREIGN KEY (idDetalle) REFERENCES DetalleVenta(idDetalle),
    CONSTRAINT FK_DetVentaEntrega_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
);
GO

-- =============================================
-- TABLAS MULTIEMPRESA - MOVIMIENTOS E INVENTARIO
-- =============================================

-- Tabla de tipos de movimiento
CREATE TABLE TiposMovimiento (
    idTipoMovimiento INT PRIMARY KEY IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(20) NOT NULL UNIQUE,
    descripcion VARCHAR(100) NULL,
    afectaStock CHAR(1) NOT NULL CHECK (afectaStock IN ('+','-','N')) -- + suma, - resta, N no afecta
);
GO

-- Tabla de movimientos de inventario mejorada
CREATE TABLE MovimientosInventario (
    idMovimiento INT IDENTITY(1,1) NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    tipoMovimiento CHAR(2) NOT NULL, -- 'EN':Entrada, 'SA':Salida, 'TR':Transferencia, 'AJ':Ajuste
    cantidad DECIMAL(18,3) NOT NULL,
    fMovimiento DATETIME NOT NULL DEFAULT GETDATE(),
    docRelacionado VARCHAR(20) NULL,
    idComprobante INT NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    observaciones VARCHAR(255) NULL,
    costoUnitario DECIMAL(18,6) NULL,
    idLote UNIQUEIDENTIFIER NULL,

    CONSTRAINT PK_MovimientosInventario PRIMARY KEY CLUSTERED (idMovimiento),
    CONSTRAINT FK_MovimientosInventario_Empresas FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_MovimientosInventario_Sucursales FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    CONSTRAINT FK_MovimientosInventario_Productos FOREIGN KEY (idProducto) REFERENCES Productos(idProducto),
    CONSTRAINT FK_MovimientosInventario_Comprobantes FOREIGN KEY (idComprobante) REFERENCES Comprobantes(idComprobante),
    CONSTRAINT FK_MovimientosInventario_Usuario FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT FK_MovimientosInventario_Lote FOREIGN KEY (idLote) REFERENCES Lotes(idLote)
);
GO

-- =============================================
-- TABLA DE AUDITORÍA BÁSICA
-- =============================================

-- Tabla de auditoría de usuarios
CREATE TABLE AuditoriaUsuario (
    idAuditoria UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    accion VARCHAR(100) NOT NULL, -- LOGIN, LOGOUT, CREAR_PRODUCTO, etc.
    tablaAfectada VARCHAR(50) NULL,
    idRegistroAfectado UNIQUEIDENTIFIER NULL,
    datosAnteriores NVARCHAR(MAX) NULL, -- JSON con valores anteriores
    datosNuevos NVARCHAR(MAX) NULL, -- JSON con valores nuevos
    fechaAccion DATETIME NOT NULL DEFAULT GETDATE(),
    ipAddress VARCHAR(45) NULL,
    userAgent VARCHAR(500) NULL,

    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa)
);
GO

-- =============================================
-- ÍNDICES OPTIMIZADOS
-- =============================================

-- Índices para SesionesUsuario
CREATE INDEX IX_SesionesUsuario_Usuario ON SesionesUsuario(idUsuario);
CREATE INDEX IX_SesionesUsuario_Token ON SesionesUsuario(token) WHERE activo = 1;

-- Índices para AuditoriaUsuario
CREATE INDEX IX_AuditoriaUsuario_UsuarioFecha ON AuditoriaUsuario(idUsuario, fechaAccion);
CREATE INDEX IX_AuditoriaUsuario_EmpresaFecha ON AuditoriaUsuario(idEmpresa, fechaAccion);

-- Índices para búsquedas frecuentes de productos
CREATE INDEX IX_Productos_EmpresaCategoria ON Productos(idEmpresa, idCategoria) WHERE estado = 1;
CREATE INDEX IX_Productos_EmpresaEstado ON Productos(idEmpresa, estado, fIngreso);

-- Índices para clientes y proveedores
CREATE INDEX IX_Clientes_EmpresaEstado ON Clientes(idEmpresa, estado);
CREATE INDEX IX_Proveedores_EmpresaEstado ON Proveedores(idEmpresa, estado);

-- Índices para ventas y compras
CREATE INDEX IX_Ventas_EmpresaFecha ON Ventas(idEmpresa, fEmision);
CREATE INDEX IX_Ventas_EmpresaSucursalFecha ON Ventas(idEmpresa, idSucursal, fEmision);
CREATE INDEX IX_Compras_EmpresaFecha ON Compras(idEmpresa, fEmision);

-- Índices para movimientos de inventario
CREATE INDEX IX_MovimientosInventario_EmpresaProductoFecha ON MovimientosInventario(idEmpresa, idProducto, fMovimiento);
CREATE INDEX IX_MovimientosInventario_EmpresaSucursalFecha ON MovimientosInventario(idEmpresa, idSucursal, fMovimiento);

-- Índices para precios
CREATE INDEX IX_PreciosProducto_ProductoLista ON PreciosProducto(idProducto, idLista);
CREATE INDEX IX_ListasPrecio_EmpresaSucursalActivo ON ListasPrecio(idEmpresa, idSucursal, activo, fechaInicio, fechaFin);

-- Índices para detalle de ventas y entregas
CREATE INDEX IX_DetalleVenta_VentaProducto ON DetalleVenta(idVenta, idProducto);
CREATE INDEX IX_DetalleVentaEntrega_Venta ON DetalleVentaEntrega(idVenta);

-- Índices para stock
CREATE INDEX IX_StockSucursal_EmpresaSucursalProducto ON StockSucursal(idEmpresa, idSucursal, idProducto);
CREATE INDEX IX_Lotes_EmpresaProductoSucursal ON Lotes(idEmpresa, idProducto, idSucursal);

-- =============================================
-- PROCEDIMIENTOS ALMACENADOS ÚTILES
-- =============================================

-- Procedimiento para obtener siguiente número de secuencia
CREATE OR ALTER PROCEDURE sp_GetNextSequence
    @idEmpresa UNIQUEIDENTIFIER,
    @idSucursal UNIQUEIDENTIFIER,
    @idComprobante VARCHAR(2),
    @serie VARCHAR(4),
    @nuevoNumero VARCHAR(8) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @num INT;

    BEGIN TRANSACTION;

        UPDATE Secuencias
        SET @num = ultimoNumero = ultimoNumero + 1,
            fActualizacion = GETDATE()
        WHERE idEmpresa = @idEmpresa
          AND idSucursal = @idSucursal
          AND idComprobante = @idComprobante
          AND serie = @serie;

        IF @@ROWCOUNT = 0
        BEGIN
            SET @num = 1;
            INSERT Secuencias(idEmpresa, idSucursal, idComprobante, serie, ultimoNumero, fActualizacion)
            VALUES (@idEmpresa, @idSucursal, @idComprobante, @serie, @num, GETDATE());
        END

    COMMIT TRANSACTION;

    SET @nuevoNumero = RIGHT('00000000' + CAST(@num AS VARCHAR(8)), 8);
END
GO

-- Procedimiento para validar login y crear sesión
CREATE OR ALTER PROCEDURE sp_ValidarLogin
    @email VARCHAR(100),
    @passwordHash VARCHAR(500),
    @ipAddress VARCHAR(45) = NULL,
    @userAgent VARCHAR(500) = NULL,
    @idUsuario UNIQUEIDENTIFIER = NULL OUTPUT,
    @idEmpresa UNIQUEIDENTIFIER = NULL OUTPUT,
    @idSesion UNIQUEIDENTIFIER = NULL OUTPUT,
    @resultado INT = 0 OUTPUT -- 0=Error, 1=Exitoso, 2=Bloqueado, 3=Usuario inactivo
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @intentosMax INT = 5;
    DECLARE @tiempoBloqueoMin INT = 30;

    -- Buscar usuario
    SELECT @idUsuario = idUsuario, @idEmpresa = idEmpresa
    FROM UsuarioWeb
    WHERE email = @email AND estado = 1;

    IF @idUsuario IS NULL
    BEGIN
        SET @resultado = 0; -- Usuario no encontrado o inactivo
        RETURN;
    END

    -- Verificar si está bloqueado
    IF EXISTS (
        SELECT 1 FROM UsuarioWeb
        WHERE idUsuario = @idUsuario
        AND bloqueadoHasta > GETDATE()
    )
    BEGIN
        SET @resultado = 2; -- Usuario bloqueado
        RETURN;
    END

    -- Validar contraseña
    IF EXISTS (
        SELECT 1 FROM UsuarioWeb
        WHERE idUsuario = @idUsuario
        AND password = @passwordHash
    )
    BEGIN
        -- Login exitoso
        SET @resultado = 1;

        -- Crear sesión
        SET @idSesion = NEWID();
        INSERT SesionesUsuario (idSesion, idUsuario, token, fechaInicio, fechaExpiracion, ipAddress, userAgent, activo)
        VALUES (@idSesion, @idUsuario, @idSesion, GETDATE(), DATEADD(HOUR, 8, GETDATE()), @ipAddress, @userAgent, 1);

        -- Resetear intentos fallidos y actualizar último login
        UPDATE UsuarioWeb
        SET intentosFallidos = 0,
            ultimoLogin = GETDATE(),
            bloqueadoHasta = NULL
        WHERE idUsuario = @idUsuario;

        -- Registrar en auditoría
        INSERT AuditoriaUsuario (idUsuario, idEmpresa, accion, ipAddress, userAgent)
        VALUES (@idUsuario, @idEmpresa, 'LOGIN', @ipAddress, @userAgent);

    END
    ELSE
    BEGIN
        -- Login fallido
        SET @resultado = 0;

        -- Incrementar intentos fallidos
        UPDATE UsuarioWeb
        SET intentosFallidos = ISNULL(intentosFallidos, 0) + 1
        WHERE idUsuario = @idUsuario;

        -- Bloquear si supera el límite
        IF (SELECT intentosFallidos FROM UsuarioWeb WHERE idUsuario = @idUsuario) >= @intentosMax
        BEGIN
            UPDATE UsuarioWeb
            SET bloqueadoHasta = DATEADD(MINUTE, @tiempoBloqueoMin, GETDATE())
            WHERE idUsuario = @idUsuario;
        END
    END
END
GO

-- =============================================
-- SISTEMA DE CAJA Y MOVIMIENTOS
-- =============================================

-- Tipos de movimiento de caja
CREATE TABLE TiposMovimientoCaja (
    idTipoMovimientoCaja INT PRIMARY KEY IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    descripcion VARCHAR(100),
    tipo CHAR(1) NOT NULL CHECK (tipo IN ('I','E')) -- I=Ingreso, E=Egreso
);
GO

-- Cajas disponibles
CREATE TABLE Cajas (
    idCaja UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(100),
    estado BIT NOT NULL DEFAULT 1,
    fCreacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    CONSTRAINT UQ_Cajas_EmpresaSucursal UNIQUE (idEmpresa, idSucursal, nombre)
);
GO

-- Apertura de caja
CREATE TABLE AperturasCaja (
    idApertura UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idCaja UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    fechaApertura DATETIME NOT NULL DEFAULT GETDATE(),
    montoInicial DECIMAL(18,2) NOT NULL DEFAULT 0,
    observaciones VARCHAR(200),
    estado BIT NOT NULL DEFAULT 1, -- 1=Abierta, 0=Cerrada

    FOREIGN KEY (idCaja) REFERENCES Cajas(idCaja),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
);
GO
CREATE UNIQUE NONCLUSTERED INDEX UQ_AperturasCaja_CajaAbierta ON AperturasCaja(idCaja, estado) WHERE estado = 1;
GO

-- Cierre de caja
CREATE TABLE CierresCaja (
    idCierre UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idApertura UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idUsuarioCierre UNIQUEIDENTIFIER NOT NULL,
    fechaCierre DATETIME NOT NULL DEFAULT GETDATE(),
    montoFinal DECIMAL(18,2) NOT NULL,
    diferencia DECIMAL(18,2) NOT NULL DEFAULT 0,
    observaciones VARCHAR(200),
    estado BIT NOT NULL DEFAULT 1,

    FOREIGN KEY (idApertura) REFERENCES AperturasCaja(idApertura),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    FOREIGN KEY (idUsuarioCierre) REFERENCES UsuarioWeb(idUsuario)
);
GO

-- Movimientos de caja (ingresos y egresos)
CREATE TABLE MovimientosCaja (
    idMovimientoCaja UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idApertura UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idUsuario UNIQUEIDENTIFIER NOT NULL,
    idTipoMovimientoCaja INT NOT NULL,
    fechaMovimiento DATETIME NOT NULL DEFAULT GETDATE(),
    concepto VARCHAR(100) NOT NULL,
    monto DECIMAL(18,2) NOT NULL,
    idMediosPago INT NULL,
    idMoneda INT NOT NULL,
    documentoRelacionado VARCHAR(20) NULL, -- Número de comprobante relacionado
    observaciones VARCHAR(200),

    FOREIGN KEY (idApertura) REFERENCES AperturasCaja(idApertura),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario),
    FOREIGN KEY (idTipoMovimientoCaja) REFERENCES TiposMovimientoCaja(idTipoMovimientoCaja),
    FOREIGN KEY (idMediosPago) REFERENCES MediosPago(idMediosPago),
    FOREIGN KEY (idMoneda) REFERENCES Moneda(idMoneda)
);
GO

-- =========================================================
-- 1. CAT�LOGO DE FORMAS DE PAGO (ampliado)
-- =========================================================

CREATE TABLE FormasPago (
    idFormaPago INT IDENTITY(1,1) PRIMARY KEY,
    descripcion VARCHAR(50) NOT NULL UNIQUE, -- Efectivo, Yape, Plin, Transferencia, Tarjeta Visa, etc.
    tipo VARCHAR(20) NOT NULL, -- EFECTIVO, DIGITAL, BANCARIO, TARJETA
    requiereReferencia BIT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1
);

-- Valores iniciales
INSERT INTO FormasPago (descripcion, tipo, requiereReferencia) VALUES
('Efectivo', 'EFECTIVO', 0),
('Yape', 'DIGITAL', 1),
('Plin', 'DIGITAL', 1),
('Transferencia', 'BANCARIO', 1),
('Tarjeta Visa', 'TARJETA', 1),
('Tarjeta Mastercard', 'TARJETA', 1),
('Pago en Oficina', 'BANCARIO', 0),
('Cheque', 'BANCARIO', 1);

-- =============================================
-- SISTEMA DE CUENTAS POR COBRAR
-- =============================================

-- Créditos otorgados a clientes
CREATE TABLE CreditosClientes (
    idCredito UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idCliente INT NOT NULL,
    idVenta INT NULL, -- Puede ser NULL si es crédito independiente
    idUsuarioCredito UNIQUEIDENTIFIER NOT NULL, -- Usuario que otorgó el crédito
    fechaCredito DATETIME NOT NULL DEFAULT GETDATE(),
    montoTotal DECIMAL(18,2) NOT NULL,
    plazoDias INT NOT NULL,
    tasaInteres DECIMAL(5,2) NULL, -- Porcentaje mensual
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','CANCELADO','VENCIDO')),
    observaciones VARCHAR(200),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
    FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta),
    FOREIGN KEY (idUsuarioCredito) REFERENCES UsuarioWeb(idUsuario)
);
GO

-- Cuotas de créditos
CREATE TABLE CuotasCredito (
    idCuota UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idCredito UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    numeroCuota INT NOT NULL,
    fechaVencimiento DATETIME NOT NULL,
    montoCuota DECIMAL(18,2) NOT NULL,
    interes DECIMAL(18,2) NOT NULL DEFAULT 0,
    capital DECIMAL(18,2) NOT NULL,
    saldoPendiente DECIMAL(18,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','PAGADO','VENCIDO','REFINANCIADO')),
    fechaPago DATETIME NULL,

    FOREIGN KEY (idCredito) REFERENCES CreditosClientes(idCredito) ON DELETE CASCADE,
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_CuotasCredito_Numero UNIQUE (idCredito, numeroCuota)
);
GO

-- Pagos de cuotas
CREATE TABLE PagosCuotas (
    idPagoCuota UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idCuota UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idUsuarioPago UNIQUEIDENTIFIER NOT NULL,
    fechaPago DATETIME NOT NULL DEFAULT GETDATE(),
    montoPagado DECIMAL(18,2) NOT NULL,
    idMediosPago INT NOT NULL,
    idMoneda INT NOT NULL,
    numeroRecibo VARCHAR(20) NULL,
    observaciones VARCHAR(200),

    FOREIGN KEY (idCuota) REFERENCES CuotasCredito(idCuota),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idUsuarioPago) REFERENCES UsuarioWeb(idUsuario),
    FOREIGN KEY (idMediosPago) REFERENCES MediosPago(idMediosPago),
    FOREIGN KEY (idMoneda) REFERENCES Moneda(idMoneda)
);
GO

-- =============================================
-- SISTEMA DE DESPACHOS
-- =============================================

-- Tipos de despacho
CREATE TABLE TiposDespacho (
    idTipoDespacho INT PRIMARY KEY IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    descripcion VARCHAR(100),
    requiereCantidad BIT NOT NULL DEFAULT 1 -- Si requiere especificar cantidad despachada
);
GO

-- Despachos de productos
CREATE TABLE Despachos (
    idDespacho UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idVenta INT NOT NULL,
    idTipoDespacho INT NOT NULL,
    idUsuarioDespacho UNIQUEIDENTIFIER NOT NULL,
    fechaDespacho DATETIME NOT NULL DEFAULT GETDATE(),
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','EN_PROCESO','COMPLETADO','CANCELADO')),
    observaciones VARCHAR(200),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta),
    FOREIGN KEY (idTipoDespacho) REFERENCES TiposDespacho(idTipoDespacho),
    FOREIGN KEY (idUsuarioDespacho) REFERENCES UsuarioWeb(idUsuario)
);
GO

-- Detalle de despachos por producto
CREATE TABLE DetalleDespachos (
    idDetalleDespacho UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idDespacho UNIQUEIDENTIFIER NOT NULL,
    idDetalleVenta INT NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    cantidadSolicitada DECIMAL(18,3) NOT NULL,
    cantidadDespachada DECIMAL(18,3) NOT NULL DEFAULT 0,
    ubicacionOrigen VARCHAR(50) NULL, -- De dónde se despacha
    ubicacionDestino VARCHAR(50) NULL, -- A dónde va
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','DESPACHADO','CANCELADO')),
    fechaDespacho DATETIME NULL,

    FOREIGN KEY (idDespacho) REFERENCES Despachos(idDespacho) ON DELETE CASCADE,
    FOREIGN KEY (idDetalleVenta) REFERENCES DetalleVenta(idDetalle),
    FOREIGN KEY (idProducto) REFERENCES Productos(idProducto)
);
GO

-- =============================================
-- SISTEMA DE ENVIOS Y DELIVERY
-- =============================================

-- Tipos de envío
CREATE TABLE TiposEnvio (
    idTipoEnvio INT PRIMARY KEY IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    descripcion VARCHAR(100),
    costoBase DECIMAL(18,2) NULL,
    requiereTransportista BIT NOT NULL DEFAULT 0
);
GO

-- Estados de envío
CREATE TABLE EstadosEnvio (
    idEstadoEnvio INT PRIMARY KEY IDENTITY(1,1) NOT NULL,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    descripcion VARCHAR(100),
    color VARCHAR(7) NULL, -- Hex color para UI
    orden INT NOT NULL -- Para ordenar los estados
);
GO

-- Transportistas (para envíos)
CREATE TABLE Transportistas (
    idTransportista UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombres VARCHAR(50) NOT NULL,
    apellidos VARCHAR(50) NOT NULL,
    documento VARCHAR(20) NOT NULL,
    licencia VARCHAR(20) NULL,
    celular VARCHAR(15) NOT NULL,
    email VARCHAR(100) NULL,
    vehiculo VARCHAR(50) NULL,
    placa VARCHAR(10) NULL,
    estado BIT NOT NULL DEFAULT 1,
    fRegistro DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_Transportistas_EmpresaDocumento UNIQUE (idEmpresa, documento)
);
GO

-- Envíos
CREATE TABLE Envios (
    idEnvio UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NOT NULL,
    idVenta INT NOT NULL,
    idTipoEnvio INT NOT NULL,
    idEstadoEnvio INT NOT NULL DEFAULT 1,
    idTransportista UNIQUEIDENTIFIER NULL,
    idUsuarioEnvio UNIQUEIDENTIFIER NOT NULL,
    fechaSolicitud DATETIME NOT NULL DEFAULT GETDATE(),
    fechaProgramada DATETIME NULL,
    fechaEntrega DATETIME NULL,
    costoEnvio DECIMAL(18,2) NOT NULL DEFAULT 0,
    direccionEntrega VARCHAR(255) NOT NULL,
    referencia VARCHAR(200) NULL,
    coordenadas VARCHAR(50) NULL, -- Latitud,Longitud
    contactoDestinatario VARCHAR(100) NULL,
    telefonoDestinatario VARCHAR(15) NULL,
    observaciones VARCHAR(300),
    evidenciaFoto VARCHAR(200) NULL, -- URL o path de foto de entrega

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta),
    FOREIGN KEY (idTipoEnvio) REFERENCES TiposEnvio(idTipoEnvio),
    FOREIGN KEY (idEstadoEnvio) REFERENCES EstadosEnvio(idEstadoEnvio),
    FOREIGN KEY (idTransportista) REFERENCES Transportistas(idTransportista),
    FOREIGN KEY (idUsuarioEnvio) REFERENCES UsuarioWeb(idUsuario)
);
GO

-- Historial de cambios de estado de envíos
CREATE TABLE HistorialEstadosEnvio (
    idHistorial UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEnvio UNIQUEIDENTIFIER NOT NULL,
    idEstadoAnterior INT NULL,
    idEstadoNuevo INT NOT NULL,
    idUsuarioCambio UNIQUEIDENTIFIER NOT NULL,
    fechaCambio DATETIME NOT NULL DEFAULT GETDATE(),
    observaciones VARCHAR(200),

    FOREIGN KEY (idEnvio) REFERENCES Envios(idEnvio) ON DELETE CASCADE,
    FOREIGN KEY (idEstadoAnterior) REFERENCES EstadosEnvio(idEstadoEnvio),
    FOREIGN KEY (idEstadoNuevo) REFERENCES EstadosEnvio(idEstadoEnvio),
    FOREIGN KEY (idUsuarioCambio) REFERENCES UsuarioWeb(idUsuario)
);
GO

-- =============================================
-- FACTURACIÓN ELECTRÓNICA
-- =============================================

-- Estados de SUNAT
CREATE TABLE EstadosSunat (
    idEstadoSunat INT PRIMARY KEY IDENTITY(1,1) NOT NULL,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    descripcion VARCHAR(100) NOT NULL,
    requiereAccion BIT NOT NULL DEFAULT 0
);
GO

-- Comprobantes electrónicos
CREATE TABLE ComprobantesElectronicos (
    idComprobanteElectronico UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idVenta INT NULL,
    idCompra UNIQUEIDENTIFIER NULL,
    tipoComprobante VARCHAR(2) NOT NULL, -- 01, 03, 07, 08
    serie VARCHAR(4) NOT NULL,
    numero VARCHAR(8) NOT NULL,
    fechaEmision DATETIME NOT NULL,
    idEstadoSunat INT NOT NULL DEFAULT 1,
    cdr VARCHAR(MAX) NULL, -- XML del CDR de SUNAT
    xmlEnviado NVARCHAR(MAX) NULL, -- XML enviado a SUNAT
    xmlRespuesta NVARCHAR(MAX) NULL, -- XML de respuesta de SUNAT
    codigoRespuesta VARCHAR(10) NULL,
    descripcionRespuesta VARCHAR(500) NULL,
    fechaEnvio DATETIME NULL,
    fechaRespuesta DATETIME NULL,
    intentosEnvio INT DEFAULT 0,
    ultimoIntento DATETIME NULL,
    hash VARCHAR(100) NULL, -- Hash del comprobante para validación
    archivoPdf VARCHAR(200) NULL, -- Path del archivo PDF generado

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idVenta) REFERENCES Ventas(idVenta),
    FOREIGN KEY (idCompra) REFERENCES Compras(idCompra),
    FOREIGN KEY (idEstadoSunat) REFERENCES EstadosSunat(idEstadoSunat),
    CONSTRAINT UQ_ComprobantesElectronicos_SerieNumero UNIQUE (idEmpresa, serie, numero)
);
GO

-- Configuración de facturación electrónica por empresa
CREATE TABLE ConfiguracionFacturacionElectronica (
    idConfiguracion UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    certificadoDigital VARCHAR(500) NULL, -- Path del certificado
    claveCertificado VARCHAR(100) NULL, -- Clave del certificado
    usuarioSunat VARCHAR(20) NULL,
    claveSunat VARCHAR(20) NULL,
    urlEnvio VARCHAR(200) NULL, -- URL del servicio de SUNAT
    urlConsulta VARCHAR(200) NULL, -- URL de consulta de SUNAT
    modoPrueba BIT NOT NULL DEFAULT 1, -- 1=Pruebas, 0=Producción
    serieFactura VARCHAR(4) NULL,
    serieBoleta VARCHAR(4) NULL,
    serieNotaCredito VARCHAR(4) NULL,
    serieNotaDebito VARCHAR(4) NULL,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_ConfiguracionFacturacionElectronica_Empresa UNIQUE (idEmpresa)
);
GO

-- =============================================
-- ÍNDICES ADICIONALES PARA NUEVAS FUNCIONALIDADES
-- =============================================

-- Índices para sistema de caja
CREATE INDEX IX_AperturasCaja_EmpresaSucursalFecha ON AperturasCaja(idEmpresa, idSucursal, fechaApertura);
CREATE INDEX IX_MovimientosCaja_AperturaFecha ON MovimientosCaja(idApertura, fechaMovimiento);
CREATE INDEX IX_MovimientosCaja_EmpresaFecha ON MovimientosCaja(idEmpresa, fechaMovimiento);

-- Índices para cuentas por cobrar
CREATE INDEX IX_CreditosClientes_EmpresaCliente ON CreditosClientes(idEmpresa, idCliente);
CREATE INDEX IX_CreditosClientes_UsuarioCredito ON CreditosClientes(idUsuarioCredito);
CREATE INDEX IX_CuotasCredito_CreditoEstado ON CuotasCredito(idCredito, estado);
CREATE INDEX IX_CuotasCredito_FechaVencimiento ON CuotasCredito(fechaVencimiento) WHERE estado = 'PENDIENTE';
CREATE INDEX IX_PagosCuotas_CuotaFecha ON PagosCuotas(idCuota, fechaPago);

-- Índices para despachos
CREATE INDEX IX_Despachos_VentaEstado ON Despachos(idVenta, estado);
CREATE INDEX IX_Despachos_EmpresaFecha ON Despachos(idEmpresa, fechaDespacho);
CREATE INDEX IX_DetalleDespachos_DespachoEstado ON DetalleDespachos(idDespacho, estado);

-- Índices para envíos
CREATE INDEX IX_Envios_VentaEstado ON Envios(idVenta, idEstadoEnvio);
CREATE INDEX IX_Envios_EmpresaFecha ON Envios(idEmpresa, fechaSolicitud);
CREATE INDEX IX_Envios_TransportistaFecha ON Envios(idTransportista, fechaProgramada);
CREATE INDEX IX_HistorialEstadosEnvio_EnvioFecha ON HistorialEstadosEnvio(idEnvio, fechaCambio);

-- Índices para facturación electrónica
CREATE INDEX IX_ComprobantesElectronicos_EmpresaEstado ON ComprobantesElectronicos(idEmpresa, idEstadoSunat);
CREATE INDEX IX_ComprobantesElectronicos_FechaEmision ON ComprobantesElectronicos(fechaEmision);
CREATE INDEX IX_ComprobantesElectronicos_Venta ON ComprobantesElectronicos(idVenta) WHERE idVenta IS NOT NULL;
CREATE INDEX IX_ComprobantesElectronicos_Compra ON ComprobantesElectronicos(idCompra) WHERE idCompra IS NOT NULL;

-- =============================================
-- PROCEDIMIENTOS ADICIONALES
-- =============================================

-- Procedimiento para apertura de caja
CREATE OR ALTER PROCEDURE sp_AbrirCaja
    @idCaja UNIQUEIDENTIFIER,
    @idEmpresa UNIQUEIDENTIFIER,
    @idSucursal UNIQUEIDENTIFIER,
    @idUsuario UNIQUEIDENTIFIER,
    @montoInicial DECIMAL(18,2),
    @observaciones VARCHAR(200) = NULL,
    @idApertura UNIQUEIDENTIFIER = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- Verificar que no haya caja abierta para esta caja
    IF EXISTS (
        SELECT 1 FROM AperturasCaja
        WHERE idCaja = @idCaja AND estado = 1
    )
    BEGIN
        RAISERROR('Ya existe una caja abierta para esta caja.', 16, 1);
        RETURN;
    END

    -- Crear nueva apertura
    SET @idApertura = NEWID();

    INSERT INTO AperturasCaja (
        idApertura, idCaja, idEmpresa, idSucursal, idUsuario,
        fechaApertura, montoInicial, observaciones, estado
    ) VALUES (
        @idApertura, @idCaja, @idEmpresa, @idSucursal, @idUsuario,
        GETDATE(), @montoInicial, @observaciones, 1
    );
END
GO

-- Procedimiento para registrar movimiento de caja
CREATE OR ALTER PROCEDURE sp_RegistrarMovimientoCaja
    @idApertura UNIQUEIDENTIFIER,
    @idEmpresa UNIQUEIDENTIFIER,
    @idSucursal UNIQUEIDENTIFIER,
    @idUsuario UNIQUEIDENTIFIER,
    @idTipoMovimientoCaja INT,
    @concepto VARCHAR(100),
    @monto DECIMAL(18,2),
    @idMediosPago INT = NULL,
    @idMoneda INT = 1, -- PEN por defecto
    @documentoRelacionado VARCHAR(20) = NULL,
    @observaciones VARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Verificar que la caja esté abierta
    IF NOT EXISTS (
        SELECT 1 FROM AperturasCaja
        WHERE idApertura = @idApertura AND estado = 1
    )
    BEGIN
        RAISERROR('La caja no está abierta o no existe.', 16, 1);
        RETURN;
    END

    INSERT INTO MovimientosCaja (
        idApertura, idEmpresa, idSucursal, idUsuario, idTipoMovimientoCaja,
        fechaMovimiento, concepto, monto, idMediosPago, idMoneda,
        documentoRelacionado, observaciones
    ) VALUES (
        @idApertura, @idEmpresa, @idSucursal, @idUsuario, @idTipoMovimientoCaja,
        GETDATE(), @concepto, @monto, @idMediosPago, @idMoneda,
        @documentoRelacionado, @observaciones
    );
END
GO

-- Procedimiento para cerrar caja
CREATE OR ALTER PROCEDURE sp_CerrarCaja
    @idApertura UNIQUEIDENTIFIER,
    @idUsuarioCierre UNIQUEIDENTIFIER,
    @montoFinal DECIMAL(18,2),
    @observaciones VARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @montoInicial DECIMAL(18,2);
    DECLARE @totalIngresos DECIMAL(18,2);
    DECLARE @totalEgresos DECIMAL(18,2);
    DECLARE @idEmpresa UNIQUEIDENTIFIER;
    DECLARE @idSucursal UNIQUEIDENTIFIER;

    -- Obtener datos de la apertura
    SELECT @montoInicial = montoInicial,
           @idEmpresa = idEmpresa,
           @idSucursal = idSucursal
    FROM AperturasCaja
    WHERE idApertura = @idApertura AND estado = 1;

    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR('La apertura de caja no existe o ya está cerrada.', 16, 1);
        RETURN;
    END

    -- Calcular totales
    SELECT @totalIngresos = ISNULL(SUM(CASE WHEN tmc.tipo = 'I' THEN mc.monto ELSE 0 END), 0),
           @totalEgresos = ISNULL(SUM(CASE WHEN tmc.tipo = 'E' THEN mc.monto ELSE 0 END), 0)
    FROM MovimientosCaja mc
    INNER JOIN TiposMovimientoCaja tmc ON mc.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
    WHERE mc.idApertura = @idApertura;

    -- Registrar cierre
    INSERT INTO CierresCaja (
        idApertura, idEmpresa, idSucursal, idUsuarioCierre,
        fechaCierre, montoFinal, diferencia, observaciones
    ) VALUES (
        @idApertura, @idEmpresa, @idSucursal, @idUsuarioCierre,
        GETDATE(), @montoFinal,
        @montoFinal - (@montoInicial + @totalIngresos - @totalEgresos),
        @observaciones
    );

    -- Cerrar la apertura
    UPDATE AperturasCaja
    SET estado = 0
    WHERE idApertura = @idApertura;
END
GO

-- Procedimiento para pago parcial de cuota (genera nueva cuota)
CREATE OR ALTER PROCEDURE sp_PagarCuotaParcial
    @idCuota UNIQUEIDENTIFIER,
    @montoPagado DECIMAL(18,2),
    @idUsuarioPago UNIQUEIDENTIFIER,
    @idMediosPago INT,
    @idMoneda INT = 1,
    @numeroRecibo VARCHAR(20) = NULL,
    @observaciones VARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @idCredito UNIQUEIDENTIFIER;
    DECLARE @numeroCuota INT;
    DECLARE @montoCuota DECIMAL(18,2);
    DECLARE @saldoPendiente DECIMAL(18,2);
    DECLARE @idEmpresa UNIQUEIDENTIFIER;
    DECLARE @fechaVencimiento DATETIME;

    -- Obtener datos de la cuota
    SELECT @idCredito = idCredito,
           @numeroCuota = numeroCuota,
           @montoCuota = montoCuota,
           @saldoPendiente = saldoPendiente,
           @idEmpresa = idEmpresa,
           @fechaVencimiento = fechaVencimiento
    FROM CuotasCredito
    WHERE idCuota = @idCuota AND estado = 'PENDIENTE';

    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR('La cuota no existe o no está pendiente.', 16, 1);
        RETURN;
    END

    -- Verificar que el monto pagado sea menor que el saldo pendiente
    IF @montoPagado >= @saldoPendiente
    BEGIN
        RAISERROR('Para pagos completos, use el procedimiento de pago total.', 16, 1);
        RETURN;
    END

    -- Registrar pago parcial
    INSERT INTO PagosCuotas (
        idCuota, idEmpresa, idUsuarioPago, fechaPago, montoPagado,
        idMediosPago, idMoneda, numeroRecibo, observaciones
    ) VALUES (
        @idCuota, @idEmpresa, @idUsuarioPago, GETDATE(), @montoPagado,
        @idMediosPago, @idMoneda, @numeroRecibo, @observaciones
    );

    -- Actualizar cuota actual como parcialmente pagada
    UPDATE CuotasCredito
    SET saldoPendiente = saldoPendiente - @montoPagado,
        estado = 'PENDIENTE' -- Sigue pendiente porque queda saldo
    WHERE idCuota = @idCuota;

    -- Generar nueva cuota con el saldo restante
    -- Nueva fecha de vencimiento: 30 días después
    DECLARE @nuevaFechaVencimiento DATETIME = DATEADD(DAY, 30, @fechaVencimiento);

    INSERT INTO CuotasCredito (
        idCredito, idEmpresa, numeroCuota, fechaVencimiento,
        montoCuota, interes, capital, saldoPendiente, estado
    ) VALUES (
        @idCredito, @idEmpresa, @numeroCuota + 1, @nuevaFechaVencimiento,
        @saldoPendiente, 0, @saldoPendiente, @saldoPendiente, 'PENDIENTE'
    );
END
GO

-- =============================================
-- SISTEMA CONTABLE Y ANÁLISIS FINANCIERO
-- =============================================

-- Configuración contable por empresa
CREATE TABLE ConfiguracionContable (
    idConfiguracion UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    monedaFuncional VARCHAR(3) NOT NULL DEFAULT 'PEN',
    tipoCambioAutomatico BIT NOT NULL DEFAULT 1,
    periodoActual VARCHAR(6) NOT NULL, -- YYYYMM
    cierreAutomatico BIT NOT NULL DEFAULT 0,
    digitosCuenta INT NOT NULL DEFAULT 6,
    separadorCuenta VARCHAR(1) NOT NULL DEFAULT '-',
    requiereCentroCosto BIT NOT NULL DEFAULT 0,

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT UQ_ConfiguracionContable_Empresa UNIQUE (idEmpresa)
);
GO

-- Plan de cuentas contables
CREATE TABLE PlanCuentas (
    idCuenta VARCHAR(20) NOT NULL, -- Código de cuenta (ej: 1001-001)
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO')),
    subTipo VARCHAR(30), -- CIRCULANTE, FIJO, CORRIENTE, NO_CORRIENTE, etc.
    nivel INT NOT NULL CHECK (nivel >= 1 AND nivel <= 6),
    cuentaPadre VARCHAR(20) NULL,
    naturaleza CHAR(1) NOT NULL CHECK (naturaleza IN ('D','A')), -- Débito, Acreedor
    permiteMovimientos BIT NOT NULL DEFAULT 1,
    requiereCentroCosto BIT NOT NULL DEFAULT 0,
    requiereDocumento BIT NOT NULL DEFAULT 0,
    estado BIT NOT NULL DEFAULT 1,

    PRIMARY KEY (idCuenta, idEmpresa),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_PlanCuentas_Padre FOREIGN KEY (cuentaPadre, idEmpresa) REFERENCES PlanCuentas(idCuenta, idEmpresa)
);
GO

-- Centros de costos
CREATE TABLE CentrosCosto (
    idCentroCosto VARCHAR(10) NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('PRODUCCION', 'VENTAS', 'ADMINISTRACION', 'DISTRIBUCION', 'OTROS')),
    centroPadre VARCHAR(10) NULL,
    nivel INT NOT NULL DEFAULT 1,
    estado BIT NOT NULL DEFAULT 1,

    PRIMARY KEY (idCentroCosto, idEmpresa),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_CentrosCosto_Padre FOREIGN KEY (centroPadre, idEmpresa) REFERENCES CentrosCosto(idCentroCosto, idEmpresa)
);
GO

-- Períodos contables
CREATE TABLE PeriodosContables (
    idPeriodo VARCHAR(6) NOT NULL, -- YYYYMM
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    descripcion VARCHAR(50) NOT NULL,
    fechaInicio DATE NOT NULL,
    fechaFin DATE NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO', 'BLOQUEADO')),
    tipo VARCHAR(10) NOT NULL DEFAULT 'MENSUAL' CHECK (tipo IN ('MENSUAL', 'TRIMESTRAL', 'ANUAL')),

    PRIMARY KEY (idPeriodo, idEmpresa),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE
);
GO

-- Asientos contables
CREATE TABLE AsientosContables (
    idAsiento BIGINT IDENTITY(1,1) NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    periodo VARCHAR(6) NOT NULL,
    numeroAsiento INT NOT NULL,
    fechaAsiento DATE NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    origen VARCHAR(20) NOT NULL, -- VENTA, COMPRA, CAJA, INVENTARIO, MANUAL
    idDocumentoRelacionado UNIQUEIDENTIFIER NULL,
    numeroDocumento VARCHAR(20) NULL,
    totalDebe DECIMAL(18,2) NOT NULL DEFAULT 0,
    totalHaber DECIMAL(18,2) NOT NULL DEFAULT 0,
    estado VARCHAR(15) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'APROBADO', 'CONTABILIZADO', 'ANULADO')),
    idUsuarioCreacion UNIQUEIDENTIFIER NOT NULL,
    fechaCreacion DATETIME DEFAULT GETDATE(),
    idUsuarioAprobacion UNIQUEIDENTIFIER NULL,
    fechaAprobacion DATETIME NULL,

    PRIMARY KEY (idAsiento, idEmpresa),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (periodo, idEmpresa) REFERENCES PeriodosContables(idPeriodo, idEmpresa),
    FOREIGN KEY (idUsuarioCreacion) REFERENCES UsuarioWeb(idUsuario),
    FOREIGN KEY (idUsuarioAprobacion) REFERENCES UsuarioWeb(idUsuario),
    CONSTRAINT UQ_Asientos_Numero UNIQUE (idEmpresa, periodo, numeroAsiento),
    CONSTRAINT CHK_Asientos_Balance CHECK (totalDebe = totalHaber)
);
GO

-- Detalle de asientos contables
CREATE TABLE DetalleAsientos (
    idDetalle BIGINT IDENTITY(1,1) NOT NULL,
    idAsiento BIGINT NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    linea INT NOT NULL,
    idCuenta VARCHAR(20) NOT NULL,
    debe DECIMAL(18,2) NOT NULL DEFAULT 0,
    haber DECIMAL(18,2) NOT NULL DEFAULT 0,
    concepto VARCHAR(200),
    idCentroCosto VARCHAR(10) NULL,
    idSucursal UNIQUEIDENTIFIER NULL,
    idProducto UNIQUEIDENTIFIER NULL,
    idCliente INT NULL,
    idProveedor INT NULL,

    PRIMARY KEY (idDetalle, idEmpresa),
    FOREIGN KEY (idAsiento, idEmpresa) REFERENCES AsientosContables(idAsiento, idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idCuenta, idEmpresa) REFERENCES PlanCuentas(idCuenta, idEmpresa),
    FOREIGN KEY (idCentroCosto, idEmpresa) REFERENCES CentrosCosto(idCentroCosto, idEmpresa),
    FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
    FOREIGN KEY (idProducto) REFERENCES Productos(idProducto),
    FOREIGN KEY (idCliente) REFERENCES Clientes(idCliente),
    FOREIGN KEY (idProveedor) REFERENCES Proveedores(idProveedor),
    CONSTRAINT CHK_DetalleAsientos_Monto CHECK (
        (debe > 0 AND haber = 0) OR (haber > 0 AND debe = 0)
    )
);
GO

-- Cuentas bancarias
CREATE TABLE CuentasBancarias (
    idCuentaBancaria UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombreBanco VARCHAR(100) NOT NULL,
    numeroCuenta VARCHAR(30) NOT NULL,
    tipoCuenta VARCHAR(20) NOT NULL CHECK (tipoCuenta IN ('CORRIENTE', 'AHORROS', 'PLAZO_FIJO')),
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',
    saldoActual DECIMAL(18,2) NOT NULL DEFAULT 0,
    fechaApertura DATE NOT NULL,
    fechaCierre DATE NULL,
    estado BIT NOT NULL DEFAULT 1,
    idCuentaContable VARCHAR(20) NULL, -- Cuenta contable asociada

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idCuentaContable, idEmpresa) REFERENCES PlanCuentas(idCuenta, idEmpresa),
    CONSTRAINT UQ_CuentasBancarias_Numero UNIQUE (idEmpresa, numeroCuenta)
);
GO

-- Movimientos bancarios
CREATE TABLE MovimientosBancarios (
    idMovimiento UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idCuentaBancaria UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    fechaMovimiento DATE NOT NULL,
    tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('DEPOSITO', 'RETIRO', 'TRANSFERENCIA', 'CHEQUE', 'CARGO', 'ABONO')),
    monto DECIMAL(18,2) NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    numeroDocumento VARCHAR(30) NULL,
    saldoAnterior DECIMAL(18,2) NOT NULL,
    saldoNuevo DECIMAL(18,2) NOT NULL,
    idUsuarioRegistro UNIQUEIDENTIFIER NOT NULL,
    fechaRegistro DATETIME DEFAULT GETDATE(),
    conciliado BIT NOT NULL DEFAULT 0,
    idAsiento BIGINT NULL,

    FOREIGN KEY (idCuentaBancaria) REFERENCES CuentasBancarias(idCuentaBancaria),
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idUsuarioRegistro) REFERENCES UsuarioWeb(idUsuario),
    FOREIGN KEY (idAsiento, idEmpresa) REFERENCES AsientosContables(idAsiento, idEmpresa)
);
GO

-- Activos fijos
CREATE TABLE ActivosFijos (
    idActivoFijo UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200),
    idCategoria VARCHAR(20) NOT NULL,
    fechaAdquisicion DATE NOT NULL,
    costoAdquisicion DECIMAL(18,2) NOT NULL,
    valorResidual DECIMAL(18,2) NOT NULL DEFAULT 0,
    vidaUtilMeses INT NOT NULL,
    metodoDepreciacion VARCHAR(20) NOT NULL DEFAULT 'LINEAL' CHECK (metodoDepreciacion IN ('LINEAL', 'DECRECIENTE')),
    depreciacionAcumulada DECIMAL(18,2) NOT NULL DEFAULT 0,
    valorActual DECIMAL(18,2) NOT NULL,
    fechaUltimaDepreciacion DATE NULL,
    idCuentaContable VARCHAR(20) NULL,
    idCentroCosto VARCHAR(10) NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'BAJA', 'VENDIDO')),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idCuentaContable, idEmpresa) REFERENCES PlanCuentas(idCuenta, idEmpresa),
    FOREIGN KEY (idCentroCosto, idEmpresa) REFERENCES CentrosCosto(idCentroCosto, idEmpresa),
    CONSTRAINT UQ_ActivosFijos_Codigo UNIQUE (idEmpresa, codigo)
);
GO

-- Depreciación de activos fijos
CREATE TABLE DepreciacionActivos (
    idDepreciacion UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idActivoFijo UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    periodo VARCHAR(6) NOT NULL,
    fechaDepreciacion DATE NOT NULL,
    depreciacionMensual DECIMAL(18,2) NOT NULL,
    depreciacionAcumulada DECIMAL(18,2) NOT NULL,
    valorActual DECIMAL(18,2) NOT NULL,
    idAsiento BIGINT NULL,

    FOREIGN KEY (idActivoFijo) REFERENCES ActivosFijos(idActivoFijo) ON DELETE CASCADE,
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (periodo, idEmpresa) REFERENCES PeriodosContables(idPeriodo, idEmpresa),
    FOREIGN KEY (idAsiento, idEmpresa) REFERENCES AsientosContables(idAsiento, idEmpresa),
    CONSTRAINT UQ_Depreciacion_Periodo UNIQUE (idActivoFijo, periodo)
);
GO

-- Presupuestos
CREATE TABLE Presupuestos (
    idPresupuesto UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200),
    tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('INGRESOS', 'EGRESOS', 'GENERAL')),
    periodoInicio VARCHAR(6) NOT NULL,
    periodoFin VARCHAR(6) NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'APROBADO', 'EJECUCION', 'CERRADO')),
    idUsuarioCreacion UNIQUEIDENTIFIER NOT NULL,
    fechaCreacion DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    FOREIGN KEY (idUsuarioCreacion) REFERENCES UsuarioWeb(idUsuario)
);
GO

-- Detalle de presupuestos
CREATE TABLE DetallePresupuestos (
    idDetalle UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idPresupuesto UNIQUEIDENTIFIER NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    periodo VARCHAR(6) NOT NULL,
    idCuenta VARCHAR(20) NULL,
    idCentroCosto VARCHAR(10) NULL,
    montoPresupuestado DECIMAL(18,2) NOT NULL,
    montoEjecutado DECIMAL(18,2) NOT NULL DEFAULT 0,
    variacion DECIMAL(18,2) NULL,

    FOREIGN KEY (idPresupuesto) REFERENCES Presupuestos(idPresupuesto) ON DELETE CASCADE,
    FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa),
    FOREIGN KEY (idCuenta, idEmpresa) REFERENCES PlanCuentas(idCuenta, idEmpresa),
    FOREIGN KEY (idCentroCosto, idEmpresa) REFERENCES CentrosCosto(idCentroCosto, idEmpresa)
);
GO

-- =============================================
-- ÍNDICES PARA SISTEMA CONTABLE
-- =============================================

-- Índices para asientos contables
CREATE INDEX IX_AsientosContables_EmpresaPeriodo ON AsientosContables(idEmpresa, periodo);
CREATE INDEX IX_AsientosContables_Fecha ON AsientosContables(fechaAsiento);
CREATE INDEX IX_AsientosContables_Origen ON AsientosContables(origen);

-- Índices para detalle de asientos
CREATE INDEX IX_DetalleAsientos_Asiento ON DetalleAsientos(idAsiento, idEmpresa);
CREATE INDEX IX_DetalleAsientos_Cuenta ON DetalleAsientos(idCuenta, idEmpresa);
CREATE INDEX IX_DetalleAsientos_CentroCosto ON DetalleAsientos(idCentroCosto, idEmpresa);

-- Índices para movimientos bancarios
CREATE INDEX IX_MovimientosBancarios_CuentaFecha ON MovimientosBancarios(idCuentaBancaria, fechaMovimiento);
CREATE INDEX IX_MovimientosBancarios_EmpresaFecha ON MovimientosBancarios(idEmpresa, fechaMovimiento);

-- Índices para activos fijos
CREATE INDEX IX_ActivosFijos_EmpresaCategoria ON ActivosFijos(idEmpresa, idCategoria);
CREATE INDEX IX_ActivosFijos_Estado ON ActivosFijos(estado);

-- Índices para presupuestos
CREATE INDEX IX_Presupuestos_EmpresaEstado ON Presupuestos(idEmpresa, estado);
CREATE INDEX IX_DetallePresupuestos_PresupuestoPeriodo ON DetallePresupuestos(idPresupuesto, periodo);

PRINT 'Base de datos mejorada creada exitosamente.';
PRINT 'Ejecuta los scripts de inserción de datos iniciales por separado.';
GO


-------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------
