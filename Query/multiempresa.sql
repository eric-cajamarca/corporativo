create database Multiempresa

use multiempresa

--truncate table Empresas
--drop table Empresas
CREATE TABLE Empresas(
	idEmpresa UNIQUEIDENTIFIER primary key NOT NULL,
	ruc varchar(11) NULL,
	razon_Social varchar(200) NULL,
	rubro varchar(200) NULL,
	direccion varchar(200) NULL,
	distrito varchar(50) NULL,
	region varchar(50) NULL,
	provincia varchar(50) NULL,
	celular varchar(11) NULL,
	Whatsapp varchar(11) NULL,
	Correo varchar(100) NULL,
	Logo varbinary(max) NULL,
	Alias varchar(29) NULL,
)
go

insert into Empresas values (NEWID(),'20611688564','EMPRESA FERRETERA AVE FENIX SJB E.I.R.L.','VENTA AL POR MAYOR DE MATERIALES DE CONSTRUCCIÓN, ARTÍCULOS DE FERRETERÍA...','PJ. LOS OLIVOS NRO. C-02 URB. H.U PALESTINA (FRENTE AL PARQUE LOS OLIVOS)','JAEN','CAJAMARCA','JAEN','968073361','968073361','',CONVERT(varbinary(max),''),'Fenix');
insert into Empresas values (NEWID(),'20611658495','GRUPO OLITOR SJB E.I.R.L.','VENTA AL POR MAYOR DE MATERIALES DE CONSTRUCCIÓN, ARTÍCULOS DE FERRETERÍA...','PJ. LOS OLIVOS C-1 NRO. SN URB. PALESTINA (1ER PISO)','JAEN','CAJAMARCA','JAEN','968073361','968073361','',CONVERT(varbinary(max),''),'Olitor');
insert into Empresas values (NEWID(),'10426524541','TORRES NUÑEZ LUCILA','VENTA AL POR MAYOR Y MENOR DE MATERIALES DE CONSTRUCCIÓN Y ARTÍCULOS DE FERRETERÍA','PSJE. LOS OLIVOS S/N URB. LOS OLIVOSPSJE. LOS OLIVOS S/N URB. LOS OLIVOS','JAEN','CAJAMARCA','JAEN','966818231','966818231','lucilatorressjb@gmail.com',CONVERT(varbinary(max),''),'Lucila');

select * from Empresas

go

--drop table Rol
create table Rol
(
idRol UNIQUEIDENTIFIER primary key NOT NULL,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
descripcion varchar(50) not null,

)
--select * from Rol
--insert into Rol values('33F8239F-6AAC-458D-B7CA-8E8AB583C5B1','Administrador');

go

--drop table usuarios
CREATE TABLE Usuarios
(
	idUsuario UNIQUEIDENTIFIER primary key NOT NULL,
	idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
	nombres varchar(50) NOT NULL,
	apellidos varchar(100) NOT NULL,
	email varchar(100) NOT NULL,
	password text NOT NULL,
	idRol UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Rol(idRol) not null, 
	estado bit NOT NULL,
	fregistro date NOT NULL,
	
 )
GO

--drop table Documentos
create table Documentos
(
idDocumento varchar(1) primary key not null,
nombre varchar(20) not null,
descripcion varchar(200) not null,

)
--select * from Documentos
go


insert into Documentos values ('1','DNI','Documento Nacional de Identidad')
insert into Documentos values ('6','RUC','Registro Unico de Contributentes')
insert into Documentos values ('4','CARNET','Carnet de extrangería')
insert into Documentos values ('A','CEDULA','Cédula diplomática de identidad')
GO

--drop table Empleados
create table Empleados
(
	IdEmpleado UNIQUEIDENTIFIER primary key NOT NULL,
	idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas (idEmpresa) ON DELETE CASCADE,
	idDocumento varchar(1)FOREIGN KEY REFERENCES Documentos (idDocumento) not null,
	dni varchar(8) ,
	nombres varchar (50),
	apellidos varchar(100),
	celular varchar (11),
	direccion varchar(200),
	puesto varchar (50),
	fIngreso varchar (10),
	fNacimiento varchar (10),
	foto varbinary(max),
	idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,
	
)
go


create table Clientes
(
idCliente int identity (1,1) primary key not null ,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
ruc varchar(11) not null,
idDocumento varchar(1) not null,
rSocial varchar(200) not null,
direccion varchar(200) not null,
referencia text null,
distrito varchar(50) null,
ubigeo varchar(12) null,
celular varchar (50) null,
correo varchar(100) null,
condicion varchar(50) null,
FOREIGN KEY (idDocumento) REFERENCES Documentos (idDocumento),
)
go

create table Proveedors
(
idProveedor int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idDocumento varchar(1) not null,
ruc varchar (11) not null,
rSocial varchar (200) not null,
direccion varchar(200) null,
distrito varchar (50) null,
ubigeo varchar(12) null,
celular varchar (50) null,
correo varchar(100) null,
condicion varchar(50) null,

FOREIGN KEY (idDocumento) REFERENCES Documentos (idDocumento),
)
go

create table Presentacion
(
idPresentacion int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE null,
Descripcion varchar(50) null,
Multiplicador int null,

)
go

select * from Presentacion

--INSERT INTO Presentacion VALUES ('BG','Bolsa',1)
--INSERT INTO Presentacion VALUES ('CEN','Ciento',100)
--INSERT INTO Presentacion VALUES ('MIL','Millar',1000)
--INSERT INTO Presentacion VALUES ('BX','Caja',1)
--INSERT INTO Presentacion VALUES ('RO','Rollo',1)
--INSERT INTO Presentacion VALUES ('WG','Gal�n',1)
--INSERT INTO Presentacion VALUES ('MTR','Metros',1)
--INSERT INTO Presentacion VALUES ('KGM','Kilogramo',1)
--INSERT INTO Presentacion VALUES ('LTR','Litro',1)
--INSERT INTO Presentacion VALUES ('NIU','Unidad',1)
--INSERT INTO Presentacion VALUES ('DZN','Docena',12)
--INSERT INTO Presentacion VALUES ('TNE','Tonelada',1)
--INSERT INTO Presentacion VALUES ('PK','Paquete',1)
--INSERT INTO Presentacion VALUES ('SA','Saco',1)
--INSERT INTO Presentacion VALUES ('BO','Botella',1)
--INSERT INTO Presentacion VALUES ('ZZ','Otros',1)


--drop table Categoria
create table Categorias 
(
idCategoria int identity (1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
Descripcion varchar(200)not null,

)
go
--INSERT INTO Categoria VALUES ('Abrazadera')
--INSERT INTO Categoria VALUES ('Aceite')



--TRUNCATE TABLE CORRELATIVO
create table Correlativos
(
idCorrelativo int identity (1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
numero int not null,


)
go
--insert into Correlativo values(1,100000)
--insert into Correlativo values(2,200000)


--truncate table Productos
--go 
--drop table Productos
create table Productos   
(
idProducto UNIQUEIDENTIFIER primary key not null,
idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
Codigo varchar(20) not null,
idCategoria int not null,
descripcion varchar(200) not null,
idPresentacion int not null,
cUnitario decimal(18,5) not null,
cantidad decimal(18,2) not null, --agrego la cantidad
fProduccion varchar(10) null,
fVencimiento varchar(10) null,
alertaMinimo varchar(5)null,
alertaMaximo varchar(5) null,
VecesVendidas int null,
facturar varchar(2) null,
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,
FIngreso varchar(10) not null,

FOREIGN KEY (idCategoria) REFERENCES Categorias (idCategoria),
FOREIGN KEY (idPresentacion) REFERENCES Presentacion (idPresentacion),
)

go


create table PreciosV
(
idPreciosV int identity (1,1) not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
mayorista decimal(18,4) null,
cliente decimal(18,4) null,
transeunte decimal(18,4) null,
idUSuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,

)
go

create table HistorialProductos
(
idHistorialP int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
Fecha date not null,
idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
descripcion varchar(100), 
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,
)

go

----------------------------------
--TIENDAS Y EXISTENCIAS
----------------------------------
--drop table tiendas
create table Sucursal
(
idSucursal int identity (1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
nombre varchar(20) not null,
direccion varchar(200) null,
inventario decimal(18,4) null,
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,
)

go

create table StockSucursal
(
idStockSucursal int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idSucursal int not null,
idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
idCategoria int not null,
cantidad decimal(18,2) not null,
ubicacion Varchar(20) null,
fIngreso date null,
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,

FOREIGN KEY (idSucursal) REFERENCES Sucursal(idSucursal),
FOREIGN KEY (idCategoria) REFERENCES Categorias (idCategoria),
)
go
--DROP TABLE ORDENESALIDA
go
create table OrdenSalida
(
idOrdenSalida int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
fechaSalida date not null,
responsable varchar(200) null,
idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
cantidad decimal(18,3) null,
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,
)

go
--TRUNCATE TABLE ComprobantesTienda02
create table Comprobantes
(
idComprobante int identity (1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
codigo varchar(2) not null,
nombre varchar(50) not null,
serie varchar(4) not null,
numero varchar(8) not null,
)
go

--insert into Comprobantes values	('01','Factura','F001','1')
--insert into Comprobantes values	('03','Boleta','B001','1')
--insert into Comprobantes values	('07','Nota de cr�dito','BC01','1')
--insert into Comprobantes values	('07','Nota de cr�dito','FC01','1')
--insert into Comprobantes values	('08','Nota de d�dito','BD01','1')
--insert into Comprobantes values	('08','Nota de d�dito','FD01','1')
--insert into Comprobantes values	('RA','Comunicaci�n de baja','-','1')
--insert into Comprobantes values	('RC','Resumen diario','-','1')
--insert into Comprobantes values	('10','Gu�a Remitente','TG01','1')
--insert into Comprobantes values	('11','Gu�a Transportista','RG01','1')
--insert into Comprobantes values	('LT','Letra por cobrar','LT','1')
--insert into Comprobantes values	('TK','Ticket de despacho','TK01','1')
--insert into Comprobantes values	('NP','Nota de pedido','NP01','1')
--insert into Comprobantes values	('CT','Cotizaci�n','CT01','1')
--insert into Comprobantes values	('NE','Nota de envio','NE01','1')
--insert into Comprobantes values	('RP','Recibo de pago','RP01','1')

create table MediosPago
(
	idMediospago varchar(3) primary key not null,
	descripcion varchar(50) not null

)
go
--insert into MediosPago values	('001','DEP�SITO EN CUENTA');
--insert into MediosPago values	('003','TRANSFERENCIA DE FONDOS');
--insert into MediosPago values	('005','TARJETA D�BITO');
--insert into MediosPago values	('006','TARJETA CR�DITO');
--insert into MediosPago values	('009','CONTADO');
--insert into MediosPago values	('009','CR�DITO');

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
--------------------------------.
--COMPRAS
---------------------------------

create table Compras
(
idcompra int identity (1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
compCompra char(13) not null,
idComprobante int not null,
serie varchar(4) not null,
numero varchar (8) not null,
fEmision varchar (10) not null,
fVencimiento varchar(10) null,
idProveedor int not null,
idMoneda int not null,
condicionPago varchar (20),
subTotal decimal(18,2),
igv decimal(18,2),
exonerado decimal(18,2),
gratuito decimal(18,2),
otrosCargos decimal(18,2),
descuentos decimal(18,2),
total decimal(18,2),
idMediosPago varchar(3) not null, --el estado determinara pendiente o pagado
compRelacionado varchar(50),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,

FOREIGN KEY (idComprobante) REFERENCES Comprobantes(idComprobante),
FOREIGN KEY (idMoneda) REFERENCES Moneda (idMoneda),
FOREIGN KEY (idProveedor) REFERENCES Proveedors (idProveedor),
FOREIGN KEY (idMediosPago) REFERENCES MediosPago (idMediosPago),
)

go





create table EstadosPedidos(
idEstadoPEdido int identity(1,1) primary key,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
descripcion varchar(50) not null
)
select * from EstadosPedidos
go

insert into EstadosPedidos values	('0D949A6D-0311-4B9F-AA5B-ADCF311970C7','Sin Programar');
insert into EstadosPedidos values	('0D949A6D-0311-4B9F-AA5B-ADCF311970C7','Programado');
insert into EstadosPedidos values	('0D949A6D-0311-4B9F-AA5B-ADCF311970C7','Enviado');
insert into EstadosPedidos values	('0D949A6D-0311-4B9F-AA5B-ADCF311970C7','Entregado');



--drop table DetalleCompras

create table DetalleCompras
(
idDetalleCompra int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idCompra int not null,
idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
idCategoria int not null,
idSucursal int not null,
Cantidad decimal(18,3) not null,
--Codigo varchar(50),
--Categoria varchar(50),
--Descripcion varchar(200),
idPresentacion int not null,
pUnitario decimal(18,5),
total decimal(18,2),

FOREIGN KEY (idCategoria) REFERENCES Categorias (idCategoria),
FOREIGN KEY (idCompra) REFERENCES Compras (idCompra),
FOREIGN KEY (idSucursal) REFERENCES Sucursal (idSucursal),
FOREIGN KEY (idPresentacion) REFERENCES Presentacion (idPresentacion),
)

--SELECT * FROM DetalleCompras
go

create table BorradorCompras
(
idBorradorCompras int identity(1,1) not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
Cantidad decimal(18,3) null,
Codigo varchar(50) null,
Categoria varchar(50) null,
Descripcion varchar(200) null,
Presentacion varchar(20) null,
CUnitario decimal(18,5) null,
FProduccion varchar(10) null,
FVencimiento varchar(10) null,
Ubicacion varchar(20) null,
Total decimal(18,2) null,
Serie_Numero char(13) null,
Razon_Social varchar(200) null
)
SELECT * FROM BorradorCompras
go



------------------------------------
--VENTAS
------------------------------------
CREATE TABLE Ventas
(
	idVentas int identity(1,1) primary key not null,
	idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
	compVenta varchar(13) NOT NULL,
	idComprobante int not NULL,
	serie varchar(4) not NULL,
	numero varchar(8) not NULL,
	fEmision varchar(10) not NULL,
	fVencimiento varchar(10) not NULL,
	idDocumento varchar(1) not NULL,
	idCliente int NULL,
	idMoneda int NULL,
	idMediosPago varchar(3) not NULL, --contado, deposito...
	subTotal decimal(18, 2) NULL,
	igv decimal(18, 2) NULL,
	exonerado decimal(18, 2) NULL,
	gratuito decimal(18, 2) NULL,
	icbper decimal(18, 2) NULL,
	otrosCargos decimal(18, 2) NULL,
	descuentos decimal(18, 2) NULL,
	total decimal(18, 2) NULL,
	idEstadoPago int not NULL, --pagado o pendiente
	idEstadoPedido int not NULL,
	idEstadoSunat int not NULL,
	idCompRel int not NULL,
	idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,

	FOREIGN KEY (idComprobante) REFERENCES Comprobantes (idComprobante),
	FOREIGN KEY (idDocumento) REFERENCES Documentos (idDocumento),
	FOREIGN KEY (idCliente) REFERENCES Clientes (idCliente),
	FOREIGN KEY (idMoneda) REFERENCES Moneda (idMoneda),
	FOREIGN KEY (idMediosPago) REFERENCES MediosPago (idMediosPago),
	FOREIGN KEY (idEstadoPago) REFERENCES EstadoPago (idEstadoPago),
	FOREIGN KEY (idEstadoPedido) REFERENCES EstadosPedidos (idEstadoPedido),
	FOREIGN KEY (idEstadoSunat) REFERENCES EstadoSunat (idEstadoSunat),
	FOREIGN KEY (idCompRel) REFERENCES ComprobanteRelacionado (idCompRel),
	
)

select * from ventas


CREATE TABLE DetalleVentas(
	idDetalleVenta int identity(1,1) primary key NOT NULL,
	idVentas int not NULL,
	cantidad decimal(18, 3) not NULL,
	idCategoria int not null,
	idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
	--[Descripcion] [varchar](200) NULL,
	idPresentacion int not NULL,
	pVenta decimal(18, 5) not NULL,
	descuentos decimal(18, 2) NULL,
	igv decimal(18, 2) NULL,
	ISC decimal(18, 2) NULL,
	total decimal(18, 2) NULL,
	cantEntregado decimal(18, 2) NULL,
	hVenta varchar(10) NULL,

	
	FOREIGN KEY (idCategoria) REFERENCES Categorias (idCategoria),
	FOREIGN KEY (idVentas) REFERENCES Ventas (idVentas),
	FOREIGN KEY (idPresentacion) REFERENCES Presentacion (idPresentacion),
)


CREATE TABLE BorradorVenta(
	idBorradorVenta int identity(1,1) primary key not null,
	idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
	cantidad decimal(18, 3) NULL,
	codigo varchar(50) NULL,
	descripcion varchar(200) NULL,
	presentacion varchar(3) NULL,
	pVenta decimal(18, 5) NULL,
	total decimal(18, 2) NULL,
	alias varchar(50) NULL
)

GO

CREATE TABLE Caja(
	idCaja int identity(1,1) primary key not null,
	idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
	fecha date NOT NULL,
	estadoAC varchar(20) NULL,
	horaAC varchar(20) NULL,
	usuarioAC varchar(20) NULL,
	efectivoAC decimal(18, 2) NULL,
	estadoCC varchar(20) NULL,
	horaCC varchar(20) NULL,
	usuarioCC varchar(20) NULL,
	efectivoCC decimal(18, 2) NULL,
	transferencia decimal(18, 2) NULL,
	tarjeta decimal(18, 2) NULL,
	credito decimal(18, 2) NULL,
	FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa),
);

CREATE TABLE Cotizaciones(
	idCotizacion int identity(1,1) primary key not null,
	idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE, 
	serieNumero char(13) NOT NULL,
	idComprobante int NULL,
	serie varchar(4) NULL,
	numero varchar(8) NULL,
	fEmision varchar(10) NULL,
	fVencimiento varchar(10) NULL,
	idDocumento varchar(1) not NULL,
	idCliente int not null,
	moneda varchar(20) NULL,
	idCondicionPago int NULL,
	total decimal (18, 2) NULL,
	idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,
	Conversion varchar(13) NULL,

	FOREIGN KEY (idComprobante) REFERENCES Comprobantes (idComprobante),
	FOREIGN KEY (idDocumento) REFERENCES Documentos (idDocumento),
	FOREIGN KEY (idCliente) REFERENCES Clientes (idCliente),
	)

	select * from cotizaciones



	CREATE TABLE DetalleCotizacion(
	idDetalleCotizacion int IDENTITY(1,1) primary key NOT NULL,
	idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
	idCotizacion int not null,
	cantidad decimal(18, 3) NULL,
	codigo varchar(50) NULL,
	descripcion varchar(200) NULL,
	idPresentacion int not NULL,
	pVenta decimal(18, 5) NULL,
	descuentos decimal(18, 2) NULL,
	igv decimal(18, 2) NULL,
	ISC decimal(18, 2) NULL,
	total decimal(18, 2) NULL,
	idSucursal int not null,
	hVenta varchar(10) NULL,

	FOREIGN KEY (idCotizacion) REFERENCES Cotizaciones (idCotizacion),
	FOREIGN KEY (idSucursal) REFERENCES Sucursal (idSucursal),
	FOREIGN KEY (idPresentacion) REFERENCES Presentacion (idPresentacion),
	
	
)

-------------------------------------
--SUNAT
-------------------------------------


create table Tributos
(
	idTributo int primary key not null,
	descripcion varchar(50) not null,
	codigo varchar(3) not null
)

--insert into Tributos values	('1000','IGV Impuesto General a las Ventas','VAT');
--insert into Tributos values	('1016','Impuesto a la Venta Arroz Pilado','VAT');
--insert into Tributos values	('2000','ISC Impuesto Selectivo al Consumo','EXC');
--insert into Tributos values	('7152','Impuesto a la bolsa plastica','OTH');
--insert into Tributos values	('9995','Exportaci�n','FRE');
--insert into Tributos values	('9996','Gratuito','FRE');
--insert into Tributos values	('9997','Exonerado','VAT');
--insert into Tributos values	('9998','Inafecto','FRE');
--insert into Tributos values	('9999','Otros tributos','OTH');

create table EstadoSunat
(
	idEstadoSunat int identity(1,1) primary key not null,
	codigo varchar(3) not null,
	descripcion varchar(30) not null,
)
go


create table ComprobanteRelacionado
(
	idCompRel int identity(1,1) primary key not null,
	descripcion varchar(50) not null,
)


create table TipoCambio
(
idTipoCambio int identity(1,1) primary key,
descripcion varchar(200),
costo decimal(18,3),
simbolo varchar(3)

)
--go
--insert into TipoCambio values ('SOLES',1,'S/')
--insert into TipoCambio values ('DOLARES AMERICANOS',3.688,'US$')
--insert into TipoCambio values ('EUROS',3.688,'€')
--SELECT * FROM TipoCambio
--go



--============================================================================================================================================================
--RESTO DE TABLAS
--============================================================================================================================================================
create table Periodos
(
idPeriodo int identity(1,1) primary key not null,
plazo int not null,
descripcion varchar(20),
)
go

--insert into Periodos values ('Dias')
--insert into Periodos values ('Semanas')
--insert into Periodos values ('Quincenal')
--insert into Periodos values ('Meses')
--insert into Periodos values ('Años')
--go
--select * from Periodos

------------------------------
--------CUENTAS X PAGAR
-------------------------------

--drop table CuentasxPagar

create table CuentasxPagar
(
idCuentaxPagar int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idProveedor int not null,
idCompra int not null,
fEmision varchar(10),
fVencimiento varchar(10),
total decimal(18,2),
idPeriodo int not null,
cuota decimal(18,2),
cPagadas varchar(2),
saldo decimal(18,2),
ctaBanco varchar(50),
Estado varchar(50),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,

FOREIGN KEY (idProveedor) REFERENCES Proveedors (idProveedor),
FOREIGN KEY (idCompra) REFERENCES Compras (idCompra),
FOREIGN KEY (idPeriodo) REFERENCES Periodos (idPeriodo),
)
go


go
---drop table HistorialCXP
create table HistorialCXP
(
idHistorialCXP int identity(1,1) not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
fecha varchar(10),
idCuentaxPagar int not null,
idProveedor int not null,
nroCuota int,
nroDocpago varchar(13),
responsable varchar(200),
total decimal(18,2),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,

FOREIGN KEY (idCuentaxPagar) REFERENCES CuentasxPagar (idCuentaxPagar),

)

go

go

create table DetalleCuotasCXP
(
idDetalleCuotaCxP int identity(1,1) primary key not null,
idCuentaxPagar int not null,
NroCuota int,
Monto decimal(18,2),
FVencimiento varchar(10),
Moneda varchar(20),

FOREIGN KEY (idCuentaxPagar) REFERENCES CuentasxPagar (idCuentaxPagar),
)




------------------------------
--------CUENTAS X COBRAR
-------------------------------

--drop table CuentasxPagar

create table CuentasxCobrar
(
idCuentaxCobrar int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idCliente int not null,
idVentas int not null,
fEmision varchar(10),
fVencimiento varchar(10),
total decimal(18,2),
idPeriodo int not null,
cuota decimal(18,2),
cPagadas varchar(2),
saldo decimal(18,2),
ctaBanco varchar(50),
Estado varchar(50),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,

FOREIGN KEY (idCliente) REFERENCES Clientes (idCliente),
FOREIGN KEY (idVentas) REFERENCES Ventas (idVentas),
FOREIGN KEY (idPeriodo) REFERENCES Periodos (idPeriodo),
)
go


go
---drop table HistorialCXP
create table HistorialCXC
(
idHistorialCXC int identity(1,1) not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
fecha varchar(10),
idCuentaxCobrar int not null,
nroCuota int,
nroDocpago varchar(13),
responsable varchar(200),
total decimal(18,2),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,


FOREIGN KEY (idCuentaxCobrar) REFERENCES CuentasxCobrar (idCuentaxCobrar),
)

go

go

create table DetalleCuotasCXC
(
idDetalleCuotaCXC int identity(1,1) primary key not null,
idCuentaxCobrar int not null,
NroCuota int,
Monto decimal(18,2),
FVencimiento varchar(10),
Moneda varchar(20),

FOREIGN KEY (idCuentaxCobrar) REFERENCES CuentasxCobrar (idCuentaxCobrar),
)

--==============================================
--TABLAS PROVICIONALES PARA VENTAS
--==============================================
--drop table ProvicionalTienda01
create table Provicional
(
idProvicional int identity (1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
--idCompro varchar(20),
fecha varchar(10),
ruc varchar(11),
cliente char(200) ,
cantidad decimal(18,3),
codigo varchar(50),
descripcion varchar(200),
presentacion varchar(20),
pVenta decimal(18,5),
total decimal(18,2),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,



)

--select * from ProvicionalTienda01
go

create table NoFacturado
(
idNoFacturado int identity(1,1) primary key not null,
idVentas int  null,
fecha varchar(10),
idCliente int not null,
Cantidad decimal(18,3),
idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
idPresentacion int not null,
pVenta decimal(18,5),
total decimal(18,2),
idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Usuarios (idUsuario) not null,

FOREIGN KEY (idVentas) REFERENCES Ventas (idVentas),
FOREIGN KEY (idCliente) REFERENCES Clientes (idCliente),
FOREIGN KEY (idPresentacion) REFERENCES Presentacion (idPresentacion),

)


-----------------------------------------------
--CONFIGURACIONES ADICIONALES
-----------------------------------------------
--drop table ModoImpresion
create table ModoImpresion
(
idModoImpresion int identity (1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
descripcion varchar(20),
estado varchar(5)

)
--select * from ModoImpresion
go
--insert into  ModoImpresion values(1,'Tamaño Ticket','False')
--insert into  ModoImpresion values(2,'Tamaño A4','True')

--drop table ImpresorasDisponibles
--truncate table ImpresorasDisponibles
create table ImpresorasDisponibles
(
idImpresorasDisponibles int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
Descripcion varchar(200),
Predeterminado varchar(5)
)

--select * from ImpresorasDisponibles

--insert into  ImpresorasDisponibles values('epson t22','SI')
--insert into  ImpresorasDisponibles values('BROTHER 120','NO')

--DROP TABLE Mostrarpdfs
create table Mostrarpdfs
(
idMostrarPdf int identity(1,1) primary key not null,
idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
idComprobante int not null,
Mostrar varchar(2),
Imprimir varchar(2)

)

select * from Mostrarpdfs