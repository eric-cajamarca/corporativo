--CREATE DATABASE Multiempresa;
--GO
--USE Multiempresa;
--GO

-- --------------------------------------------------
-- 1) TABLAS MAESTRAS
-- --------------------------------------------------

-- Tabla: Documentos
CREATE TABLE [dbo].[Documentos](
    [idDocumento] [varchar](1) NOT NULL,
    [nombre] [varchar](20) NOT NULL,
    [descripcion] [varchar](200) NOT NULL,
    CONSTRAINT [PK_Documentos] PRIMARY KEY CLUSTERED ([idDocumento] ASC)
);

-- Tabla: EstadoPago
CREATE TABLE [dbo].[EstadoPago](
    [idEstadoPago] [int] IDENTITY(1,1) NOT NULL,
    [descripcion] [varchar](20) NOT NULL,
    CONSTRAINT [PK_EstadoPago] PRIMARY KEY CLUSTERED ([idEstadoPago] ASC)
);

-- Tabla: EstadosPedidos
CREATE TABLE [dbo].[EstadosPedidos](
    [idEstadoPEdido] [int] IDENTITY(1,1) NOT NULL,
    [descripcion] [varchar](50) NOT NULL,
    CONSTRAINT [PK_EstadosPedidos] PRIMARY KEY CLUSTERED ([idEstadoPEdido] ASC)
);

-- Tabla: EstadoSunat
CREATE TABLE [dbo].[EstadoSunat](
    [idEstadoSunat] [int] IDENTITY(1,1) NOT NULL,
    [codigo] [varchar](3) NOT NULL,
    [descripcion] [varchar](30) NOT NULL,
    CONSTRAINT [PK_EstadoSunat] PRIMARY KEY CLUSTERED ([idEstadoSunat] ASC)
);

-- Tabla: MediosPago
CREATE TABLE [dbo].[MediosPago](
    [idMediosPago] [int] IDENTITY(1,1) NOT NULL,
    [codigo] [varchar](3) NOT NULL,
    [descripcion] [varchar](50) NOT NULL,
    CONSTRAINT [PK_MediosPago] PRIMARY KEY CLUSTERED ([idMediosPago] ASC)
);

-- Tabla: Moneda
CREATE TABLE [dbo].[Moneda](
    [idMoneda] [int] IDENTITY(1,1) NOT NULL,
    [codigoc] [varchar](3) NOT NULL,
    [descripcion] [varchar](20) NOT NULL,
    [simbolo] [varchar](3) NOT NULL,
    CONSTRAINT [PK_Moneda] PRIMARY KEY CLUSTERED ([idMoneda] ASC)
);

-- Tabla: ComprobanteRelacionado
CREATE TABLE [dbo].[ComprobanteRelacionado](
    [idCompRel] [int] IDENTITY(1,1) NOT NULL,
    [descripcion] [varchar](50) NOT NULL,
    CONSTRAINT [PK_ComprobanteRelacionado] PRIMARY KEY CLUSTERED ([idCompRel] ASC)
);

-- Tabla: tipoDoc
CREATE TABLE [dbo].[tipoDoc](
    [idTipoDoc] [int] IDENTITY(1,1) NOT NULL,
    [codigo] [varchar](2) NOT NULL,
    [descripcion] [varchar](max) NOT NULL,
    CONSTRAINT [PK_tipoDoc] PRIMARY KEY CLUSTERED ([idTipoDoc] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];

-- Tabla: Tributos
CREATE TABLE [dbo].[Tributos](
    [idTributo] [int] IDENTITY(1,1) NOT NULL,
    [codigo] [varchar](4) NOT NULL,
    [descripcion] [varchar](50) NOT NULL,
    [nombreT] [varchar](3) NOT NULL,
    CONSTRAINT [PK_Tributos] PRIMARY KEY CLUSTERED ([idTributo] ASC)
);

-- Tabla: TipoCambio
CREATE TABLE [dbo].[TipoCambio](
    [idTipoCambio] [int] IDENTITY(1,1) NOT NULL,
    [descripcion] [varchar](200) NULL,
    [costo] [decimal](18,3) NULL,
    [simbolo] [varchar](3) NULL,
    CONSTRAINT [PK_TipoCambio] PRIMARY KEY CLUSTERED ([idTipoCambio] ASC)
);

-- --------------------------------------------------
-- 2) TABLA EMPRESAS (tabla central)
-- --------------------------------------------------
CREATE TABLE [dbo].[Empresas](
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [idDocumento] [varchar](1) NOT NULL,
    [ruc] [varchar](11) NOT NULL,
    [razon_Social] [varchar](200) NOT NULL,
    [nombreComercial] [varchar](200) NULL,
    [rubro] [varchar](200) NULL,
    [celular] [varchar](11) NULL,
    [correo] [varchar](100) NOT NULL,
    [password] [text] NOT NULL,
    [logo] [varchar](200) NULL,
    [alias] [varchar](10) NULL,
    [condicion] [varchar](20) NULL,
    [estSunat] [varchar](20) NULL,
    [estado] [bit] NOT NULL,
    [fRegistro] [datetime] NOT NULL,
    CONSTRAINT [PK_Empresas] PRIMARY KEY CLUSTERED ([idEmpresa] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];

ALTER TABLE [dbo].[Empresas] WITH CHECK ADD CONSTRAINT [FK_Empresas_Documentos] FOREIGN KEY([idDocumento]) REFERENCES [dbo].[Documentos] ([idDocumento]);

-- --------------------------------------------------
-- 3) TABLAS DEPENDIENTES DE EMPRESAS
-- --------------------------------------------------

-- Categorias
CREATE TABLE [dbo].[Categorias](
    [idCategoria] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NULL,
    [nombre] [varchar](100) NOT NULL,
    [descripcion] [varchar](200) NOT NULL,
    [estado] [bit] NOT NULL,
    CONSTRAINT [PK_Categorias] PRIMARY KEY CLUSTERED ([idCategoria] ASC)
);
ALTER TABLE [dbo].[Categorias] WITH CHECK ADD CONSTRAINT [FK_Categorias_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- Marcas
CREATE TABLE [dbo].[Marcas](
    [idMarca] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [nombre] [varchar](50) NOT NULL,
    [descripcion] [varchar](200) NULL,
    [contacto] [varchar](100) NULL,
    [paginaWeb] [varchar](100) NULL,
    [estado] [bit] NOT NULL,
    CONSTRAINT [PK_Marcas] PRIMARY KEY CLUSTERED ([idMarca] ASC)
);
ALTER TABLE [dbo].[Marcas] WITH CHECK ADD CONSTRAINT [FK_Marcas_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- Presentacion
CREATE TABLE [dbo].[Presentacion](
    [idPresentacion] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NULL,
    [codigo] [varchar](3) NOT NULL,
    [Descripcion] [varchar](50) NULL,
    [Multiplicador] [int] NULL,
    CONSTRAINT [PK_Presentacion] PRIMARY KEY CLUSTERED ([idPresentacion] ASC)
);
ALTER TABLE [dbo].[Presentacion] WITH CHECK ADD CONSTRAINT [FK_Presentacion_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- Clientes
CREATE TABLE [dbo].[Clientes](
    [idCliente] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NULL,
    [idDocumento] [varchar](1) NOT NULL,
    [ruc] [varchar](11) NOT NULL,
    [rSocial] [varchar](200) NOT NULL,
    [correo] [varchar](100) NULL,
    [celular] [varchar](50) NULL,
    [condicion] [varchar](50) NULL,
    [estado] [bit] NOT NULL,
    CONSTRAINT [PK_Clientes] PRIMARY KEY CLUSTERED ([idCliente] ASC)
);
ALTER TABLE [dbo].[Clientes] WITH CHECK ADD CONSTRAINT [FK_Clientes_Documentos] FOREIGN KEY([idDocumento]) REFERENCES [dbo].[Documentos] ([idDocumento]);
ALTER TABLE [dbo].[Clientes] WITH CHECK ADD CONSTRAINT [FK_Clientes_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- Comprobantes
CREATE TABLE [dbo].[Comprobantes](
    [idComprobante] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NULL,
    [codigo] [varchar](2) NOT NULL,
    [nombre] [varchar](50) NOT NULL,
    [serie] [varchar](4) NOT NULL,
    [numero] [int] NOT NULL,
    CONSTRAINT [PK_Comprobantes] PRIMARY KEY CLUSTERED ([idComprobante] ASC)
);
ALTER TABLE [dbo].[Comprobantes] WITH CHECK ADD CONSTRAINT [FK_Comprobantes_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- Correlativos
CREATE TABLE [dbo].[Correlativos](
    [idCorrelativo] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [numero] [int] NOT NULL,
    CONSTRAINT [PK_Correlativos] PRIMARY KEY CLUSTERED ([idCorrelativo] ASC)
);
ALTER TABLE [dbo].[Correlativos] WITH CHECK ADD CONSTRAINT [FK_Correlativos_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- DireccionEmpresa
CREATE TABLE [dbo].[DireccionEmpresa](
    [idDireccionEmpresa] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NULL,
    [ubigeo] [varchar](10) NULL,
    [codPais] [varchar](10) NULL,
    [region] [varchar](50) NULL,
    [provincia] [varchar](50) NULL,
    [distrito] [varchar](50) NULL,
    [urbanizacion] [varchar](100) NULL,
    [direccion] [varchar](255) NULL,
    [codLocal] [varchar](10) NULL,
    [principal] [bit] NULL,
    CONSTRAINT [PK_DireccionEmpresa] PRIMARY KEY CLUSTERED ([idDireccionEmpresa] ASC)
);
ALTER TABLE [dbo].[DireccionEmpresa] WITH CHECK ADD CONSTRAINT [FK_DireccionEmpresa_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- Sucursal
CREATE TABLE [dbo].[Sucursal](
    [idSucursal] [uniqueidentifier] NOT NULL,
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [nombre] [varchar](20) NOT NULL,
    [direccion] [varchar](200) NULL,
    [fregistro] [datetime] NOT NULL,
    [estado] [bit] NOT NULL,
    CONSTRAINT [PK_Sucursal] PRIMARY KEY CLUSTERED ([idSucursal] ASC)
);
ALTER TABLE [dbo].[Sucursal] WITH CHECK ADD CONSTRAINT [FK_Sucursal_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- Rol
CREATE TABLE [dbo].[Rol](
    [idRol] [uniqueidentifier] NOT NULL,
    [idEmpresa] [uniqueidentifier] NULL,
    [descripcion] [varchar](50) NOT NULL,
    CONSTRAINT [PK_Rol] PRIMARY KEY CLUSTERED ([idRol] ASC)
);
ALTER TABLE [dbo].[Rol] WITH CHECK ADD CONSTRAINT [FK_Rol_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;

-- --------------------------------------------------
-- 4) TABLAS DE USUARIOS Y PRODUCTOS
-- --------------------------------------------------

-- UsuarioWeb
CREATE TABLE [dbo].[UsuarioWeb](
    [idUsuario] [uniqueidentifier] NOT NULL,
    [idEmpresa] [uniqueidentifier] NULL,
    [nombres] [varchar](50) NOT NULL,
    [apellidos] [varchar](100) NOT NULL,
    [email] [varchar](100) NOT NULL,
    [password] [text] NOT NULL,
    [idRol] [uniqueidentifier] NOT NULL,
    [estado] [bit] NOT NULL,
    [fregistro] [datetime] NOT NULL,
    CONSTRAINT [PK_UsuarioWeb] PRIMARY KEY CLUSTERED ([idUsuario] ASC)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];
ALTER TABLE [dbo].[UsuarioWeb] WITH CHECK ADD CONSTRAINT [FK_UsuarioWeb_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;
ALTER TABLE [dbo].[UsuarioWeb] WITH CHECK ADD CONSTRAINT [FK_UsuarioWeb_Rol] FOREIGN KEY([idRol]) REFERENCES [dbo].[Rol] ([idRol]);

-- Productos
CREATE TABLE [dbo].[Productos](
    [idProducto] [uniqueidentifier] NOT NULL,
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [Codigo] [varchar](20) NOT NULL,
    [idCategoria] [int] NOT NULL,
    [descripcion] [varchar](200) NOT NULL,
    [idMarca] [int] NULL,
    [idPresentacion] [int] NOT NULL,
    [cUnitario] [decimal](18,5) NOT NULL,
    [fProduccion] [varchar](10) NULL,
    [fVencimiento] [varchar](10) NULL,
    [alertaMinimo] [decimal](18,5) NULL,
    [alertaMaximo] [decimal](18,5) NULL,
    [VecesVendidas] [int] NULL,
    [facturar] [varchar](2) NULL,
    [idUsuario] [uniqueidentifier] NOT NULL,
    [FIngreso] [datetime] NOT NULL,
    [estado] [bit] NOT NULL,
    CONSTRAINT [PK_Productos] PRIMARY KEY CLUSTERED ([idProducto] ASC)
);
ALTER TABLE [dbo].[Productos] WITH CHECK ADD CONSTRAINT [FK_Productos_Categorias] FOREIGN KEY([idCategoria]) REFERENCES [dbo].[Categorias] ([idCategoria]);
ALTER TABLE [dbo].[Productos] WITH CHECK ADD CONSTRAINT [FK_Productos_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;
ALTER TABLE [dbo].[Productos] WITH CHECK ADD CONSTRAINT [FK_Productos_Marcas] FOREIGN KEY([idMarca]) REFERENCES [dbo].[Marcas] ([idMarca]);
ALTER TABLE [dbo].[Productos] WITH CHECK ADD CONSTRAINT [FK_Productos_Presentacion] FOREIGN KEY([idPresentacion]) REFERENCES [dbo].[Presentacion] ([idPresentacion]);
ALTER TABLE [dbo].[Productos] WITH CHECK ADD CONSTRAINT [FK_Productos_UsuarioWeb] FOREIGN KEY([idUsuario]) REFERENCES [dbo].[UsuarioWeb] ([idUsuario]);

-- --------------------------------------------------
-- 5) TABLAS DE VENTAS Y STOCK
-- --------------------------------------------------

-- PreciosV
CREATE TABLE [dbo].[PreciosV](
    [idPreciosV] [int] IDENTITY(1,1) NOT NULL,
    [idProducto] [uniqueidentifier] NOT NULL,
    [cUnitario] [decimal](18,4) NULL,
    [mayorista] [decimal](18,4) NULL,
    [cliente] [decimal](18,4) NULL,
    [transeunte] [decimal](18,4) NULL,
    CONSTRAINT [PK_PreciosV] PRIMARY KEY CLUSTERED ([idPreciosV] ASC)
);
ALTER TABLE [dbo].[PreciosV] WITH CHECK ADD CONSTRAINT [FK_PreciosV_Productos] FOREIGN KEY([idProducto]) REFERENCES [dbo].[Productos] ([idProducto]);

-- UndPorCaja
CREATE TABLE [dbo].[UndPorCaja](
    [idUndPorCaja] [int] IDENTITY(1,1) NOT NULL,
    [idProducto] [uniqueidentifier] NOT NULL,
    [unidadesxCaja] [int] NOT NULL,
    [pesoUnidad] [decimal](10,2) NOT NULL,
    [pesoCaja] [decimal](10,2) NOT NULL,
    CONSTRAINT [PK_UndPorCaja] PRIMARY KEY CLUSTERED ([idUndPorCaja] ASC)
);
ALTER TABLE [dbo].[UndPorCaja] WITH CHECK ADD CONSTRAINT [FK_UndPorCaja_Productos] FOREIGN KEY([idProducto]) REFERENCES [dbo].[Productos] ([idProducto]) ON DELETE CASCADE;

-- StockSucursal
CREATE TABLE [dbo].[StockSucursal](
    [idStockSucursal] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [idSucursal] [uniqueidentifier] NOT NULL,
    [idProducto] [uniqueidentifier] NOT NULL,
    [cantidad] [decimal](18,2) NOT NULL,
    [fIngreso] [datetime] NULL,
    [idUsuario] [uniqueidentifier] NOT NULL,
    CONSTRAINT [PK_StockSucursal] PRIMARY KEY CLUSTERED ([idStockSucursal] ASC)
);
ALTER TABLE [dbo].[StockSucursal] WITH CHECK ADD CONSTRAINT [FK_StockSucursal_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]);
ALTER TABLE [dbo].[StockSucursal] WITH CHECK ADD CONSTRAINT [FK_StockSucursal_Productos] FOREIGN KEY([idProducto]) REFERENCES [dbo].[Productos] ([idProducto]);
ALTER TABLE [dbo].[StockSucursal] WITH CHECK ADD CONSTRAINT [FK_StockSucursal_Sucursal] FOREIGN KEY([idSucursal]) REFERENCES [dbo].[Sucursal] ([idSucursal]) ON DELETE CASCADE;
ALTER TABLE [dbo].[StockSucursal] WITH CHECK ADD CONSTRAINT [FK_StockSucursal_UsuarioWeb] FOREIGN KEY([idUsuario]) REFERENCES [dbo].[UsuarioWeb] ([idUsuario]);

-- --------------------------------------------------
-- 6) TABLAS DE COMPRAS Y DETALLE
-- --------------------------------------------------

-- Compras
CREATE TABLE [dbo].[Compras](
    [idcompra] [uniqueidentifier] NOT NULL,
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [compCompra] [varchar](13) NOT NULL,
    [idComprobante] [int] NOT NULL,
    [serie] [varchar](4) NOT NULL,
    [numero] [varchar](8) NOT NULL,
    [fEmision] [datetime] NOT NULL,
    [fVencimiento] [datetime] NULL,
    [idCliente] [int] NOT NULL,
    [idMoneda] [int] NOT NULL,
    [idEstadoPago] [int] NOT NULL,
    [subTotal] [decimal](18,2) NULL,
    [igv] [decimal](18,2) NULL,
    [exonerado] [decimal](18,2) NULL,
    [gratuito] [decimal](18,2) NULL,
    [otrosCargos] [decimal](18,2) NULL,
    [descuentos] [decimal](18,2) NULL,
    [total] [decimal](18,2) NULL,
    [idMediosPago] [int] NOT NULL,
    [compRelacionado] [varchar](50) NULL,
    [idUsuario] [uniqueidentifier] NOT NULL,
    CONSTRAINT [PK_Compras] PRIMARY KEY CLUSTERED ([idcompra] ASC)
);
ALTER TABLE [dbo].[Compras] WITH CHECK ADD CONSTRAINT [FK_Compras_Clientes] FOREIGN KEY([idCliente]) REFERENCES [dbo].[Clientes] ([idCliente]);
ALTER TABLE [dbo].[Compras] WITH CHECK ADD CONSTRAINT [FK_Compras_Comprobantes] FOREIGN KEY([idComprobante]) REFERENCES [dbo].[Comprobantes] ([idComprobante]);
ALTER TABLE [dbo].[Compras] WITH CHECK ADD CONSTRAINT [FK_Compras_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]) ON DELETE CASCADE;
ALTER TABLE [dbo].[Compras] WITH CHECK ADD CONSTRAINT [FK_Compras_EstadoPago] FOREIGN KEY([idEstadoPago]) REFERENCES [dbo].[EstadoPago] ([idEstadoPago]);
ALTER TABLE [dbo].[Compras] WITH CHECK ADD CONSTRAINT [FK_Compras_MediosPago] FOREIGN KEY([idMediosPago]) REFERENCES [dbo].[MediosPago] ([idMediosPago]);
ALTER TABLE [dbo].[Compras] WITH CHECK ADD CONSTRAINT [FK_Compras_Moneda] FOREIGN KEY([idMoneda]) REFERENCES [dbo].[Moneda] ([idMoneda]);
ALTER TABLE [dbo].[Compras] WITH CHECK ADD CONSTRAINT [FK_Compras_UsuarioWeb] FOREIGN KEY([idUsuario]) REFERENCES [dbo].[UsuarioWeb] ([idUsuario]);

-- DetalleCompras
CREATE TABLE [dbo].[DetalleCompras](
    [idDetalleCompra] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [uniqueidentifier] NOT NULL,
    [idSucursal] [uniqueidentifier] NOT NULL,
    [idCompra] [uniqueidentifier] NOT NULL,
    [cantidad] [decimal](18,3) NOT NULL,
    [idProducto] [uniqueidentifier] NULL,
    [idPresentacion] [int] NOT NULL,
    [pUnitario] [decimal](18,5) NULL,
    [total] [decimal](18,2) NULL,
    [fleteXArticulo] [decimal](10,5) NULL,
    [idUsuario] [uniqueidentifier] NOT NULL,
    CONSTRAINT [PK_DetalleCompras] PRIMARY KEY CLUSTERED ([idDetalleCompra] ASC)
);
ALTER TABLE [dbo].[DetalleCompras] WITH CHECK ADD CONSTRAINT [FK_DetalleCompras_Compras] FOREIGN KEY([idCompra]) REFERENCES [dbo].[Compras] ([idcompra]) ON DELETE CASCADE;
ALTER TABLE [dbo].[DetalleCompras] WITH CHECK ADD CONSTRAINT [FK_DetalleCompras_Empresas] FOREIGN KEY([idEmpresa]) REFERENCES [dbo].[Empresas] ([idEmpresa]);
ALTER TABLE [dbo].[DetalleCompras] WITH CHECK ADD CONSTRAINT [FK_DetalleCompras_Presentacion] FOREIGN KEY([idPresentacion]) REFERENCES [dbo].[Presentacion] ([idPresentacion]);
ALTER TABLE [dbo].[DetalleCompras] WITH CHECK ADD CONSTRAINT [FK_DetalleCompras_Productos] FOREIGN KEY([idProducto]) REFERENCES [dbo].[Productos] ([idProducto]);
ALTER TABLE [dbo].[DetalleCompras] WITH CHECK ADD CONSTRAINT [FK_DetalleCompras_Sucursal] FOREIGN KEY([idSucursal]) REFERENCES [dbo].[Sucursal] ([idSucursal]);
ALTER TABLE [dbo].[DetalleCompras] WITH CHECK ADD CONSTRAINT [FK_DetalleCompras_UsuarioWeb] FOREIGN KEY([idUsuario]) REFERENCES [dbo].[UsuarioWeb] ([idUsuario]);