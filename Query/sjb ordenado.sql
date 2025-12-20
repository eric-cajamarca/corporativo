--base de datos validad 02/11/2025


create table Documentos
(
idDocumento varchar(1) primary key not null,
nombre varchar(20) not null,
descripcion varchar(200) not null,

)
select * from Documentos
go


insert into Documentos values ('1','DNI','Documento Nacional de Identidad')
insert into Documentos values ('4','CARNET','Carnet de extrangería')
insert into Documentos values ('6','RUC','Registro Unico de Contributentes')
insert into Documentos values ('7','PASAPORTE','Pasaporte')
insert into Documentos values ('A','CEDULA','Cédula diplomática de identidad')
GO


-------gestores empresass ----
--para definir que empresas pueden gestionar invenarios de otras empresas--

create table Gestores_Empresas(
	idGestor int primary key identity,
	idEmpresaOrigen UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) not null,
	idEmpresaDestino UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) not null,
	estado bit

);

--truncate table empresas
CREATE TABLE Empresas(
	idEmpresa UNIQUEIDENTIFIER primary key NOT NULL,
	idDocumento varchar(1) not null,
	ruc varchar(11) not NULL,
	razon_Social varchar(200) not NULL,
	nombreComercial varchar(200) null,
	rubro varchar(200) NULL,
	celular varchar(11) NULL,
	correo varchar(100) not NULL,
	password text not null,
	logo varchar(200) NULL,
	alias varchar(10) NULL,
	condicion varchar(20) null,
	estSunat varchar(20) null,
	estado bit NOT NULL,
	fRegistro datetime not null,



	FOREIGN KEY (idDocumento) REFERENCES Documentos (idDocumento),
)
go

--ALTER TABLE Empresas ALTER COLUMN logo VARCHAR(200) NULL;
select * from empresas

insert into Empresas values ('42099529-43C9-4B7F-921A-3D6FB946E93E','6','20611688564','EMPRESA FERRETERA AVE FENIX SJB E.I.R.L.','','VENTA AL POR MAYOR DE MATERIALES DE CONSTRUCCIÓN, ARTÍCULOS DE FERRETERÍA...','968073361','','$2a$08$iD7U/5D7Kc.BOH06wQg/.uGB7pY9CNSd2LYwEabV3QM9GCHIYQmby',CONVERT(varbinary(max),''),'Fenix','HABIDO','ACTIVO',1,GETDATE());
insert into Empresas values ('BA51C992-7D05-459E-B419-A03358C0A788','6','20611658495','GRUPO OLITOR SJB E.I.R.L.','','VENTA AL POR MAYOR DE MATERIALES DE CONSTRUCCIÓN, ARTÍCULOS DE FERRETERÍA...','968073361','',CONVERT(varbinary(max),''),'Olitor','Activo','Habido',1);
insert into Empresas values ('5615C329-F8B6-4634-B0EF-C02B9F2315B3','6','10426524541','TORRES NUÑEZ LUCILA','','VENTA AL POR MAYOR Y MENOR DE MATERIALES DE CONSTRUCCIÓN Y ARTÍCULOS DE FERRETERÍA','966818231','lucilatorressjb@gmail.com',CONVERT(varbinary(max),''),'Lucila','Activo','Habido',0);

go 

select * from Empresas


-- Tabla para la dirección (reutilizable varias direcciones para varias empresas)
CREATE TABLE DireccionEmpresa (
    idDireccionEmpresa INT IDENTITY(1,1) PRIMARY KEY not null,
	idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    ubigeo varchar(10) null,
	codPais varchar(10) null,
    region varchar(50) NULL,
	provincia varchar(50) NULL,
	distrito varchar(50) NULL,
	urbanizacion varchar(100) null,
	direccion VARCHAR(255) null,
	codLocal varchar(10) null,
	principal bit

);

go

insert into DireccionEmpresa values ('42099529-43C9-4B7F-921A-3D6FB946E93E', '060801','PEN','CAJAMARCA','JAEN','JAEN','URB. LOS OLIVOS','PJ. LOS OLIVOS NRO. C-02 URB. H.U PALESTINA (FRENTE AL PARQUE LOS OLIVOS)','',1);
insert into DireccionEmpresa values ('BA51C992-7D05-459E-B419-A03358C0A788','060801','PEN','CAJAMARCA','JAEN','JAEN' ,'URB. LOS OLIVOS','PJ. LOS OLIVOS C-1 NRO. SN URB. PALESTINA (1ER PISO)','',1);
insert into DireccionEmpresa values ('5615C329-F8B6-4634-B0EF-C02B9F2315B3','060801','PEN','CAJAMARCA','JAEN','JAEN','URB. LOS OLIVOS','PSJE. LOS OLIVOS S/N URB. LOS OLIVOSPSJE. LOS OLIVOS S/N URB. LOS OLIVOS','',1);


select * from DireccionEmpresa
go

--truncate table rol
create table Rol
(
idRol UNIQUEIDENTIFIER primary key NOT NULL,
idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
descripcion varchar(50) not null,
)
go
select * from Rol
insert into Rol values
(NEWID(),'42099529-43C9-4B7F-921A-3D6FB946E93E','Contador'),
 (NEWID(),'42099529-43C9-4B7F-921A-3D6FB946E93E','Almacen'),
 (NEWID(),'42099529-43C9-4B7F-921A-3D6FB946E93E','Despacho'),
 (NEWID(),'42099529-43C9-4B7F-921A-3D6FB946E93E','Administrador'),
(NEWID(),'42099529-43C9-4B7F-921A-3D6FB946E93E','Vendedor');

go

--truncate table usuarioweb
--drop table UsuarioWeb
CREATE TABLE UsuarioWeb
(
	idUsuario UNIQUEIDENTIFIER primary key NOT NULL,
	idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
	nombres varchar(50) NOT NULL,
	apellidos varchar(100) NOT NULL,
	email varchar(100) NOT NULL,
	password text NOT NULL,
	idRol UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Rol(idRol) not null, 
	estado bit NOT NULL,
	fregistro datetime NOT NULL,
	
 )
GO


INSERT INTO UsuarioWeb (idUsuario, idEmpresa, nombres, apellidos, email, password, idRol, estado, fregistro)
VALUES
(
    NEWID(),
	'42099529-43C9-4B7F-921A-3D6FB946E93E',
    'Eric',
    'Ortiz Guevara',
	'ericortizguevara@gmail.com',
	'$2a$08$iD7U/5D7Kc.BOH06wQg/.uGB7pY9CNSd2LYwEabV3QM9GCHIYQmby',
    '7D06FE44-7297-402F-9350-5E67431AD9CC', -- Utiliza directamente el identificador único
    1,
    GETDATE()
);



go


create table Clientes
(
idCliente int identity (1,1) primary key not null,
idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idDocumento varchar(1) not null,
ruc varchar(11) not null,
rSocial varchar(200) not null,
correo varchar(100) null,
celular varchar (50) null,
condicion varchar(50) null,
estado bit not null
FOREIGN KEY (idDocumento) REFERENCES Documentos (idDocumento),
)
go

CREATE TABLE DireccionClientes (
    idDireccionClientes INT IDENTITY(1,1) PRIMARY KEY not null,
	idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa),
	idCliente int not null,
	ubigeo varchar(10) null,
	codPais varchar(10) null,
    region varchar(50) NULL,
	provincia varchar(50) NULL,
	distrito varchar(50) NULL,
	urbanizacion varchar(100) null,
	direccion VARCHAR(255) null,
	referencia varchar(200) null,
	codLocal varchar(10) null,
	principal bit
	
	FOREIGN KEY (idCliente) REFERENCES Clientes (idCliente) ON DELETE CASCADE,
);

--select * from proveedores
create table Proveedores
(
idProveedor int identity (1,1) primary key not null,
idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idDocumento varchar(1) not null,
ruc varchar(11) not null,
rSocial varchar(200) not null,
correo varchar(100) null,
celular varchar (50) null,
condicion varchar(50) null,
estado bit not null
FOREIGN KEY (idDocumento) REFERENCES Documentos (idDocumento),
)
go

CREATE TABLE DireccionProveedor (
    idDireccionProveedor INT IDENTITY(1,1) PRIMARY KEY not null,
	idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa),
	idProveedor int not null,
	ubigeo varchar(10) null,
	codPais varchar(10) null,
    region varchar(50) NULL,
	provincia varchar(50) NULL,
	distrito varchar(50) NULL,
	urbanizacion varchar(100) null,
	direccion VARCHAR(255) null,
	referencia varchar(200) null,
	codLocal varchar(10) null,
	principal bit
	
	FOREIGN KEY (idProveedor) REFERENCES Proveedores (idProveedor) ON DELETE CASCADE,
);

go

create table Presentacion
(
idPresentacion int identity(1,1) primary key not null,
--idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
codigo varchar(3) not null,
Descripcion varchar(50) null,
Multiplicador int null,

)
go

select * from Presentacion


INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','BG','Bolsa',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','CEN','Ciento',100)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','MIL','Millar',1000)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','BX','Caja',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','RO','Rollo',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','WG','Gal�n',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','MTR','Metros',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','KGM','Kilogramo',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','LTR','Litro',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','NIU','Unidad',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','DZN','Docena',12)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','TNE','Tonelada',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','PK','Paquete',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','SA','Saco',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','BO','Botella',1)
INSERT INTO Presentacion VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','ZZ','Otros',1)

go

--drop table comprobantes
create table Comprobantes
(
idComprobante int identity (1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
codigo varchar(2) not null,
nombre varchar(50) not null,
serie varchar(4) not null,
numero int not null,
)
go


select * from Comprobantes
select * from Empresas
go

insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','01','Factura','F001',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','03','Boleta','B001',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','07','Nota de credito','BC01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','07','Nota de credito','FC01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','08','Nota de dedito','BD01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','08','Nota de dedito','FD01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','RA','Comunicacion de baja','-',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','RC','Resumen diario','-',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','10','Guia Remitente','TG01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','11','Guia Transportista','RG01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023E','LT','Letra por cobrar','LT',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','TK','Ticket de despacho','TK01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','NP','Nota de pedido','NP01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','CT','Cotizacion','CT01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','NE','Nota de envio','NE01',1)
insert into Comprobantes values	('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','RP','Recibo de pago','RP01',1)
go

--drop table Productos
--drop table Categorias
--create table Categoria
create table Categorias 
(
idCategoria int identity (1,1) primary key not null,
idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
nombre varchar(100) not null,
descripcion varchar(200)not null,
estado bit not null

)
go

INSERT INTO Categorias VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','Electricidad')
INSERT INTO Categorias VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','Carpinteria','Carpinteria en general',1)
INSERT INTO Categorias VALUES ('0CE8EED8-83C6-4694-B64F-9AD82B5E4023','Pintura')
--INSERT INTO Categoria VALUES ('Aceite')
select * from Categorias
select * from Empresas

go

--drop table Marcas
create table Marcas
(
idMarca int identity(1,1) primary key not null,
idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE not null,
nombre varchar(50) not null,
descripcion varchar(200) null,
contacto varchar(100) null,
paginaWeb varchar(100) null,
estado bit not null
)

insert into Marcas values('42099529-43C9-4B7F-921A-3D6FB946E93E','TRUPER','HERRAMIENTAS Y ACCESORIOS', 'VENDEDOR ROJER', 'WWW.TRUPER.COM',1)

select * from marcas
select * from empresas
select * from UsuarioWeb
go
--TRUNCATE TABLE CORRELATIVO
create table Correlativos
(
idCorrelativo int identity (1,1000) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE not null,
numero int not null,
)
go

insert into Correlativos values('0CE8EED8-83C6-4694-B64F-9AD82B5E4023',100000)
insert into Correlativos values('BA51C992-7D05-459E-B419-A03358C0A788',600000)
insert into Correlativos values('5615C329-F8B6-4634-B0EF-C02B9F2315B3',700000)
go
select * from Correlativos

go




CREATE TABLE UsuarioWeb
(
	idUsuario UNIQUEIDENTIFIER primary key NOT NULL,
	idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
	nombres varchar(50) NOT NULL,
	apellidos varchar(100) NOT NULL,
	email varchar(100) NOT NULL,
	password text NOT NULL,
	idRol UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Rol(idRol) not null, 
	estado bit NOT NULL,
	fregistro datetime NOT NULL,
	
 )
GO



INSERT INTO UsuarioWeb (idUsuario, idEmpresa, nombres, apellidos, email, password, idRol, estado, fregistro)
VALUES
(
    NEWID(),
	'42099529-43C9-4B7F-921A-3D6FB946E93E',
    'Eric',
    'Ortiz Guevara',
	'ericortizguevara@gmail.com',
	'$2a$08$iD7U/5D7Kc.BOH06wQg/.uGB7pY9CNSd2LYwEabV3QM9GCHIYQmby',
    '33210C97-A42A-4AA3-AFF9-57F70823CCC9', -- Utiliza directamente el identificador único
    1,
    GETDATE()
);


create table Productos   
(
idProducto UNIQUEIDENTIFIER primary key not null,
idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE not null,
Codigo varchar(20) not null,
idCategoria int not null,
descripcion varchar(200) not null,
tipoProducto CHAR(1) NOT NULL CHECK (tipoProducto IN ('S', 'C')), -- 'S'imple o 'C'ompuesto
idMarca int null,
idPresentacion int not null,
cUnitario decimal(18,5) not null,
fProduccion varchar(10) null,
fVencimiento varchar(10) null,
alertaMinimo decimal(18,5)null,
alertaMaximo decimal(18,5) null,
VecesVendidas int null,
facturar varchar(2) null,
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb (idUsuario) not null,
FIngreso datetime not null,
estado bit not null

FOREIGN KEY (idCategoria) REFERENCES Categorias (idCategoria),
FOREIGN KEY (idPresentacion) REFERENCES Presentacion (idPresentacion),
FOREIGN KEY (idMarca) REFERENCES Marcas (idMarca),
)

go

CREATE TABLE ProductosCompuestos (
    idProductoCompuesto INT PRIMARY KEY IDENTITY,
    idProductoPadre UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos(idProducto),
    idProductoHijo UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos(idProducto),
    Cantidad INT NOT NULL
);

go


-- Tabla para atributos (Talla, Color, etc.)
CREATE TABLE AtributosProducto (
    idAtributo INT IDENTITY PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL, -- 'Talla', 'Color', 'Material'
    idEmpresa UNIQUEIDENTIFIER
);

-- Tabla para valores de atributos
CREATE TABLE ValoresAtributo (
    idValor INT IDENTITY PRIMARY KEY,
    idAtributo INT,
    valor VARCHAR(50) NOT NULL, -- 'M', 'L', 'Rojo', 'Azul'
    FOREIGN KEY (idAtributo) REFERENCES AtributosProducto(idAtributo)
);

-- Tabla para variantes del producto
CREATE TABLE VariantesProducto (
    idVariante UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idProductoBase UNIQUEIDENTIFIER, -- Producto principal
    sku VARCHAR(50) UNIQUE, -- SKU específico de la variante
    precio DECIMAL(18,5), -- Precio específico (opcional)
    stock INT,
    FOREIGN KEY (idProductoBase) REFERENCES Productos(idProducto)
);

-- Tabla para asociar valores a variantes
CREATE TABLE VarianteAtributos (
    idVariante UNIQUEIDENTIFIER,
    idValor INT,
    FOREIGN KEY (idVariante) REFERENCES VariantesProducto(idVariante),
    FOREIGN KEY (idValor) REFERENCES ValoresAtributo(idValor)
);

--truncate table preciosV
--drop table PreciosV
--create table PreciosV
--(
--idPreciosV int identity (1,1) not null,
--idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto) not null,
--cUnitario decimal(18,4) null,
--mayorista decimal(18,4) null,
--cliente decimal(18,4) null,
--transeunte decimal(18,4) null,

--)
go

select * from PreciosV
CREATE TABLE dbo.ListasPrecio
(
    idLista int IDENTITY(1,1) NOT NULL,
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idSucursal UNIQUEIDENTIFIER NULL,       -- NULL = lista global para todas las sucursales  
    nombre varchar(100) NOT NULL,   -- ej. "Normal", "Mayorista", "Cyber 2025"
    idMoneda int NOT NULL,
    principal bit NOT NULL DEFAULT 0,  -- 1 = lista por defecto
    conIgv bit  NOT NULL DEFAULT 1,  -- indica si el precio ya tiene IGV
    fecha_inicio date NOT NULL,
    fecha_fin date NULL,                  -- NULL = vigente hasta aviso
    activo bit NOT NULL DEFAULT 1,
    CONSTRAINT PK_ListasPrecio PRIMARY KEY (idLista),
	CONSTRAINT FK_ListasPrecio_Empresas FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas(idEmpresa),
	CONSTRAINT FK_ListasPrecio_Moneda FOREIGN KEY (idMoneda) REFERENCES dbo.Moneda(idMoneda),
	CONSTRAINT FK_ListasPrecio_Sucursales FOREIGN KEY (idSucursal) REFERENCES dbo.Sucursal(idSucursal),
    CONSTRAINT UQ_ListasPrecio_EmpSucNombre UNIQUE (idEmpresa, idSucursal, nombre),

);
GO

CREATE TABLE dbo.PreciosProducto
(
    idPrecio int IDENTITY(1,1) NOT NULL,
    idLista int NOT NULL,
    idProducto UNIQUEIDENTIFIER NOT NULL,
    precio decimal(18,4) NOT NULL,
    idMoneda int NOT NULL,
    fActualizacion datetime2 NOT NULL DEFAULT SYSDATETIME(),
    idUsuario   UNIQUEIDENTIFIER NULL,
    CONSTRAINT PK_PreciosProducto PRIMARY KEY (idPrecio),
	CONSTRAINT FK_PreciosProducto_ListasPrecio FOREIGN KEY (idLista) REFERENCES dbo.ListasPrecio(idLista),
	CONSTRAINT FK_PreciosProducto_Productos FOREIGN KEY (idProducto) REFERENCES dbo.Productos(idProducto),
	CONSTRAINT FK_PreciosProducto_Moneda FOREIGN KEY (idMoneda) REFERENCES dbo.Moneda(idMoneda),
	 CONSTRAINT FK_PreciosProducto_Usuario FOREIGN KEY (idUsuario) REFERENCES dbo.UsuarioWeb(idUsuario),
    CONSTRAINT UQ_PreciosProducto_ListaProducto UNIQUE (idLista, idProducto)
);
GO

-- Búsqueda rápida por producto + lista activa
CREATE INDEX IX_PreciosProducto_ProductoLista
ON dbo.PreciosProducto (idProducto, idLista);

-- Búsqueda de listas activas por empresa/sucursal
CREATE INDEX IX_ListasPrecio_EmpresaSucursalActivo
ON dbo.ListasPrecio (idEmpresa, idSucursal, activo, fecha_inicio, fecha_fin);


CREATE TABLE UndPorCaja (
    idUndPorCaja INT PRIMARY KEY IDENTITY(1,1),
    idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto) ON DELETE CASCADE not null,
    unidadesxCaja int not null,
    pesoUnidad DECIMAL(10,2) NOT NULL, -- Peso por unidad del producto
    pesoCaja DECIMAL(10,2) NOT NULL, -- Peso total por caja o bulto
    
    
);


go

select * from Productos
go
----------------------------------
--TIENDAS Y EXISTENCIAS
----------------------------------
--drop table Sucursal
create table Sucursal
(
idSucursal UNIQUEIDENTIFIER primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE not null,
nombre varchar(20) not null,
direccion varchar(200) null,
--idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb (idUsuario) not null,
fregistro datetime not null,
estado bit not null
)

go

--truncate table stockSucursal
create table StockSucursal
(
idStockSucursal int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) not null, 
idSucursal UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Sucursal(idSucursal) ON DELETE CASCADE not null,
idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto)  not null,
cantidad decimal(18,2) not null,
fIngreso DATETIME DEFAULT GETDATE(),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb (idUsuario) not null,
ubicacion varchar(50),
 CONSTRAINT UQ_StockSucursal UNIQUE (idEmpresa, idSucursal, idProducto) -- Clave única compuesta

)
go

--alter table StockSucursal add ubicacion varchar(50) null

-- Eliminar columna 'ubicacion' que ahora estará en la tabla UbicacionesStock
--ALTER TABLE StockSucursal DROP COLUMN IF EXISTS ubicacion;

CREATE TABLE UbicacionesStock (
    idUbicacionStock INT IDENTITY(1,1) PRIMARY KEY NOT NULL,
    idStockSucursal INT FOREIGN KEY REFERENCES StockSucursal(idStockSucursal) ON DELETE CASCADE NOT NULL,
    codigoUbicacion VARCHAR(20) NOT NULL, -- Ej: "ANDAMIO-1", "BODEGA-2"
    cantidad DECIMAL(18,2) NOT NULL,
    fechaUltimaActualizacion DATETIME DEFAULT GETDATE(),
    idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb(idUsuario) NOT NULL,
    
    CONSTRAINT UQ_UbicacionStock UNIQUE (idStockSucursal, codigoUbicacion) -- Evita duplicados
);


-- 1. Actualizar StockSucursal (total)
INSERT INTO StockSucursal (idEmpresa, idSucursal, idProducto, cantidad, fIngreso, idUsuario)
VALUES ('EMPRESA-GUID', 'SUCURSAL-GUID', 'PRODUCTO-GUID', 25, GETDATE(), 'USUARIO-GUID')
ON DUPLICATE KEY UPDATE cantidad = cantidad + 25, fIngreso = GETDATE();

-- 2. Registrar ubicaciones específicas (15 en ANDAMIO-1 y 10 en ESTANTE-3)
INSERT INTO UbicacionesStock (idStockSucursal, codigoUbicacion, cantidad, idUsuario)
VALUES 
(SCOPE_IDENTITY(), 'ANDAMIO-1', 15, 'USUARIO-GUID'),
(SCOPE_IDENTITY(), 'ESTANTE-3', 10, 'USUARIO-GUID');

---Consultar stock con detalle de ubicaciones:
SELECT 
    p.nombre AS Producto,
    ss.cantidad AS StockTotal,
    us.codigoUbicacion AS Ubicacion,
    us.cantidad AS EnUbicacion
FROM 
    StockSucursal ss
    JOIN Productos p ON ss.idProducto = p.idProducto
    LEFT JOIN UbicacionesStock us ON ss.idStockSucursal = us.idStockSucursal
WHERE 
    ss.idEmpresa = 'EMPRESA-GUID'
    AND ss.idSucursal = 'SUCURSAL-GUID';


--------------------------------------
--compras
----------------------------------------
create table MediosPago
(
	idMediosPago int identity primary key not null,
	codigo varchar(3)not null,
	descripcion varchar(50) not null

)
go
insert into MediosPago values	('001','DEPOSITO EN CUENTA');
insert into MediosPago values	('003','TRANSFERENCIA DE FONDOS');
insert into MediosPago values	('005','TARJETA DEBITO');
insert into MediosPago values	('006','TARJETA CREDITO');
insert into MediosPago values	('009','CONTADO');
insert into MediosPago values	('009','CREDITO');

go

CREATE TABLE Moneda(
	idMoneda int identity(1,1) primary key not null,
	codigoc varchar(3) NOT NULL,
	descripcion varchar(20) not NULL,
	simbolo varchar(3) not NULL,

)

go
insert into Moneda values ('PEN','SOLES','S/.')
insert into Moneda values ('USD','DOLLAR','US$')
insert into Moneda values ('EUR','EUROS','€')
select * from moneda
go

create table EstadoPago
(
	idEstadoPago int identity(1,1) primary key not null,
	descripcion varchar(20) not null,
)
go

insert into EstadoPago values	('Pendiente');
insert into EstadoPago values	('Pagado');
go

select * from Comprobantes

--truncate table compras
--drop table Compras
create table Compras
(
idcompra UNIQUEIDENTIFIER primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE not null,
compCompra varchar(13) not null,
idComprobante int not null,
serie varchar(4) not null,
numero varchar (8) not null,
fEmision datetime not null,
fVencimiento datetime null,
idCliente int not null,
idMoneda int not null,
idEstadoPago int not null,
subTotal decimal(18,2),
igv decimal(18,2),
exonerado decimal(18,2),
gratuito decimal(18,2),
otrosCargos decimal(18,2),
descuentos decimal(18,2),
total decimal(18,2),
idMediosPago int not null, --el estado determinara pendiente o pagado
compRelacionado varchar(50),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb (idUsuario) not null,

FOREIGN KEY (idComprobante) REFERENCES Comprobantes(idComprobante),
FOREIGN KEY (idMoneda) REFERENCES Moneda (idMoneda),
FOREIGN KEY (idCliente) REFERENCES Clientes (idCliente),
FOREIGN KEY (idMediosPago) REFERENCES MediosPago (idMediosPago),
FOREIGN KEY (idEstadoPago) REFERENCES EstadoPago (idEstadoPago),
)

go

--truncate table DetalleCompras
--drop table DetalleCompras
create table DetalleCompras
(
idDetalleCompra int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) not null ,
idSucursal UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Sucursal(idSucursal) not null, -- Nueva columna
idCompra UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Compras (idCompra) ON DELETE CASCADE not null,
cantidad decimal(18,3) not null,
idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
idPresentacion int not null,
pUnitario decimal(18,5),
total decimal(18,2),
fleteXArticulo DECIMAL(10,5),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb (idUsuario) not null,


FOREIGN KEY (idPresentacion) REFERENCES Presentacion (idPresentacion),
)

go

--REPETIDO
-----------------------------------
--drop table UndPorCaja
CREATE TABLE UndPorCaja (
    idUndPorCaja INT PRIMARY KEY IDENTITY(1,1) not null,
	idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE not null,
    idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto) not null,
    unidxCaja int not null,
    pesoUnidad DECIMAL(10,2) NOT NULL, -- Peso por unidad del producto
    pesoCaja DECIMAL(10,2) NOT NULL, -- Peso total por caja o bulto
);

select * from UndPorCaja
SELECT * FROM Productos
SELECT * FROM Compras
SELECT * FROM DetalleCompras

-----------------------------------
--VENTAS
------------------------------------
--drop table ventas
CREATE TABLE [dbo].[Ventas](
    [idVenta] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [UNIQUEIDENTIFIER] NOT NULL,
    [idSucursal] [UNIQUEIDENTIFIER] NOT NULL,
    [serie] [varchar](4) NOT NULL,
    [numero] [varchar](8) NOT NULL,
	[compVenta][varchar](13) not null,
    [idComprobante] [int] NOT NULL, -- '01':Factura, '03':Boleta, etc.
    [fEmision] [datetime] NOT NULL,
	[fVencimiento] [datetime] NOT NULL,
    [idCliente] [int] NOT NULL,
    [idMoneda] [int] NOT NULL,
    [tCambio] [decimal](10,4) NOT NULL,
	[subtotal] [decimal](18,2) NOT NULL,
    [igv] [decimal](18,2) NOT NULL,
	[exonerado][decimal](18,2) NOT NULL,
	[gratuito][decimal](18,2) NOT NULL,
	[otrosCargos][decimal](18,2) NOT NULL,
	[descuentos][decimal](18,2) NOT NULL,
    [total] [decimal](18,2) NOT NULL,
    [idMediosPago] [varchar](20) NOT NULL, -- 'PENDIENTE', 'PAGADO', 'ANULADO'
	[idEstadoSunat][int]not null,
	[compRelacionado][varchar](30) NULL,
    [idUsuario] [UNIQUEIDENTIFIER] NOT NULL,
    [fechaAnulacion] [datetime] NOT NULL DEFAULT GETDATE(),
    [idUsuarioAnulacion] [int] NULL,
    [motivo_anulacion] [varchar](255) NULL,
    CONSTRAINT [PK_Ventas] PRIMARY KEY CLUSTERED([idVenta] ASC),
    CONSTRAINT [FK_Ventas_Empresas] FOREIGN KEY ([idempresa]) 
        REFERENCES [dbo].[Empresas] ([idEmpresa]),
    CONSTRAINT [FK_Ventas_Sucursal] FOREIGN KEY ([idSucursal]) 
        REFERENCES [dbo].[Sucursal] ([idSucursal]),
    CONSTRAINT [FK_Ventas_Clientes] FOREIGN KEY ([idCliente]) 
        REFERENCES [dbo].[Clientes] ([idCliente]),
	CONSTRAINT [FK_Ventas_Usuario] FOREIGN KEY ([idUsuario])
		REFERENCES [dbo].[usuarioweb]([idUsuario]),
    CONSTRAINT [UQ_Ventas_SerieNumero] UNIQUE ([idEmpresa], [serie], [numero]),
	
) ON [PRIMARY]
GO


---esto me ayudara a evitar numeros duplicados
CREATE TABLE dbo.Secuencias (
    idEmpresa     UNIQUEIDENTIFIER NOT NULL,
    idSucursal    UNIQUEIDENTIFIER NOT NULL,
    idComprobante varchar(2)       NOT NULL,  -- '01','03',...
    serie         varchar(4)       NOT NULL,
    ultimoNro     int              NOT NULL CONSTRAINT DF_Secuencias_ultimoNro DEFAULT 0,
    CONSTRAINT PK_Secuencias PRIMARY KEY (idEmpresa, idSucursal, idComprobante, serie)
);
GO

CREATE OR ALTER PROCEDURE dbo.sp_getNextSequence
    @idEmpresa     UNIQUEIDENTIFIER,
    @idSucursal    UNIQUEIDENTIFIER,
    @idComprobante varchar(2),
    @serie         varchar(4),
    @nuevoNumero   varchar(8) OUTPUT      -- ← sigue siendo varchar para devolver 00000001
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @num int;          -- variable interna entera

    BEGIN TRAN;

        UPDATE dbo.Secuencias
        SET    @num = ultimoNro = ultimoNro + 1   -- incremento y asigno
        WHERE  idEmpresa  = @idEmpresa
          AND  idSucursal = @idSucursal
          AND  idComprobante = @idComprobante
          AND  serie = @serie;

        IF @@ROWCOUNT = 0
        BEGIN
            SET @num = 1;
            INSERT dbo.Secuencias(idEmpresa, idSucursal, idComprobante, serie, ultimoNro)
            VALUES (@idEmpresa, @idSucursal, @idComprobante, @serie, @num);
        END

    COMMIT TRAN;

    -- formateo a 8 dígitos
    SET @nuevoNumero = RIGHT('00000000' + CAST(@num AS varchar(8)), 8);
END
GO


-- =============================================
-- TABLA DE DETALLE DE COMPROBANTES
-- =============================================
CREATE TABLE [dbo].[DetalleVenta](
    [idDetalle] [int] IDENTITY(1,1) NOT NULL,
    [idVenta] [int] NOT NULL,
    [idProducto] [UNIQUEIDENTIFIER] NOT NULL,
    [cantidad] [decimal](18,3) NOT NULL,
    [pVenta] [decimal](18,5) NOT NULL,
    [descuento] [decimal](18,2) NULL DEFAULT 0,
    [subtotal] [decimal](18,2) NOT NULL,
	[igv] [bit] NOT NULL DEFAULT 0,
	[isc] [bit] NOT NULL DEFAULT 0,
    [total] [decimal](18,2) NOT NULL,
	[hVenta][datetime]  not null DEFAULT getdate(),
	[cantEntregada][decimal](18,3) NOT NULL,
	[cantPendiente]  AS (cantidad - cantEntregada) PERSISTED,
	[fUltEntrega] [datetime2] NULL, -- última fecha que se entregó
	[idEstadoPedido] [int] NOT NULL
	   
    CONSTRAINT [PK_DetalleVenta] PRIMARY KEY CLUSTERED ([idDetalle] ASC),
    CONSTRAINT [FK_DetalleVenta_Ventas] FOREIGN KEY ([idVenta]) 
        REFERENCES [dbo].[Ventas] ([idVenta]),
    CONSTRAINT [FK_DetalleVenta_Productos] FOREIGN KEY ([idProducto]) 
        REFERENCES [dbo].[Productos] ([idProducto]),
	CONSTRAINT [FK_DetalleVenta_EstadoPedido] FOREIGN KEY ([idEstadoPedido]) 
        REFERENCES [dbo].[EstadosPedidos] ([idEstadoPedido])

) ON [PRIMARY]
GO

select * from DetalleVenta

CREATE TABLE dbo.DetalleVentaEntrega (
    idEntrega     int IDENTITY(1,1) PRIMARY KEY,
	idVenta		  int NOT NULL,
    idDetalle     int NOT NULL FOREIGN KEY REFERENCES dbo.DetalleVenta(idDetalle),
    cantidad      decimal(18,3) NOT NULL,
    fEntrega      datetime2 NOT NULL DEFAULT sysdatetime(),
    idUsuario     UNIQUEIDENTIFIER NOT NULL

	CONSTRAINT FK_DetVentaEntrega_Ventas
    FOREIGN KEY (idVenta) REFERENCES dbo.Ventas(idVenta),
	CONSTRAINT FK_DetVentaEntrega_Usuario
    FOREIGN KEY (idUsuario) REFERENCES dbo.Usuarioweb(idUsuario)
);

go
-- Índice para búsquedas por comprobante
CREATE INDEX IX_DetalleVentaEntrega_idVenta
ON dbo.DetalleVentaEntrega (idVenta);



--CREATE TABLE Caja
--EN OTRO QUERY


-- =============================================
-- TABLA DE MOVIMIENTOS DE INVENTARIO
-- =============================================
CREATE TABLE [dbo].[MovimientosInventario](
    [idMovimiento] [int] IDENTITY(1,1) NOT NULL,
    [idEmpresa] [UNIQUEIDENTIFIER] NOT NULL,
    [idSucursal] [UNIQUEIDENTIFIER] NOT NULL,
    [idProducto] [int] NOT NULL,
    [tipoMovimiento] [varchar](2) NOT NULL, -- 'EN':Entrada, 'SA':Salida, 'TR':Transferencia
    [cantidad] [decimal](18,3) NOT NULL,
    [fMovimiento] [datetime] NOT NULL DEFAULT GETDATE(),
    [docRelacionado] [varchar](20) NULL,
    [idcomprobante] [int] NULL,
    [idUsuario] [UNIQUEIDENTIFIER] NOT NULL,
    [observaciones] [varchar](255) NULL,
    CONSTRAINT [PK_MovimientosInventario] PRIMARY KEY CLUSTERED ([idMovimiento] ASC),
    CONSTRAINT [FK_MovimientosInventario_Empresas] FOREIGN KEY ([idEmpresa]) 
        REFERENCES [dbo].[Empresas] ([idEmpresa]),
    CONSTRAINT [FK_MovimientosInventario_Sucursales] FOREIGN KEY ([idSucursal]) 
        REFERENCES [dbo].[Sucursal] ([idSucursal]),
    CONSTRAINT [FK_MovimientosInventario_Productos] FOREIGN KEY ([idProducto]) 
        REFERENCES [dbo].[Productos] ([idProducto]),
    CONSTRAINT [FK_MovimientosInventario_Comprobantes] FOREIGN KEY ([idComprobante]) 
        REFERENCES [dbo].[Comprobantes] ([idComprobante])
) ON [PRIMARY]
GO



CREATE TABLE TiposMovimiento (
    idTipoMovimiento INT PRIMARY KEY IDENTITY(1,1) not null,
    nombre VARCHAR(20) not null,

);
go
insert into TiposMovimiento values ('INGRESO')
insert into TiposMovimiento values ('SALIDA')
insert into TiposMovimiento values ('TRANSFERENCIA')



