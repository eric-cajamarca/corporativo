
-------------------------------------
--SUNAT
-------------------------------------

--drop table tributos
create table Tributos
(
	idTributo int identity primary key not null,
	codigo varchar(4) not null,
	descripcion varchar(50) not null,
	nombreT varchar(3) not null
)	
go
select * from Tributos
insert into Tributos values	('1000','IGV Impuesto General a las Ventas','VAT');
insert into Tributos values	('1016','Impuesto a la Venta Arroz Pilado','VAT');
insert into Tributos values	('2000','ISC Impuesto Selectivo al Consumo','EXC');
insert into Tributos values	('7152','Impuesto a la bolsa plastica','OTH');
insert into Tributos values	('9995','Exportaci�n','FRE');
insert into Tributos values	('9996','Gratuito','FRE');
insert into Tributos values	('9997','Exonerado','VAT');
insert into Tributos values	('9998','Inafecto','FRE');
insert into Tributos values	('9999','Otros conceptos de pago','OTH');

go

create table EstadoSunat
(
	idEstadoSunat int identity(1,1) primary key not null,
	codigo varchar(3) not null,
	descripcion varchar(30) not null,
)
go
--truncate table estadosunat
insert into EstadoSunat values	('0','Pendiente');
insert into EstadoSunat values	('1','Aceptado');
insert into EstadoSunat values	('2','Aceptado con observaciones');
insert into EstadoSunat values	('3','Rechazado');
insert into EstadoSunat values	('4','Baja');
insert into EstadoSunat values	('5','Anulado');

select * from EstadoSunat

create table ComprobanteRelacionado
(
	idCompRel int identity primary key not null,
	descripcion varchar(50) not null,
)
insert into ComprobanteRelacionado values ('factura')
insert into ComprobanteRelacionado values ('Guia de remisión')




create table TipoCambio
(
idTipoCambio int identity(1,1) primary key,
descripcion varchar(200),
costo decimal(18,3),
simbolo varchar(3)

)
--go
insert into TipoCambio values ('SOLES',1,'S/')
insert into TipoCambio values ('DOLARES AMERICANOS',3.688,'US$')
insert into TipoCambio values ('EUROS',3.688,'€')
SELECT * FROM TipoCambio
--go

--drop table mediospago
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
select * from MediosPago

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


--catalogo nro 6
--create table Documentos
--(
--idDocumento varchar(1) primary key not null,
--nombre varchar(20) not null,
--descripcion varchar(200) not null,

--)
--select * from Documentos
--go


--insert into Documentos values ('1','DNI','Documento Nacional de Identidad')
--insert into Documentos values ('4','CARNET','Carnet de extrangería')
--insert into Documentos values ('6','RUC','Registro Unico de Contributentes')
--insert into Documentos values ('7','PASAPORTE','Pasaporte')
--insert into Documentos values ('A','CEDULA','Cédula diplomática de identidad')
--GO

--catalogo nro 15
CREATE TABLE Leyenda (
    Id INT PRIMARY KEY IDENTITY(1,1),
    codigo VARCHAR(10),
    valor VARCHAR(255)
);

insert into Leyenda values ('1000','Monto en Letras')
insert into Leyenda values ('1002','Leyenda "TRANSFERENCIA GRATUITA DE UN BIEN Y/O SERVICIO PRESTADO GRATUITAMENTE')
insert into Leyenda values ('2000','Leyenda “COMPROBANTE DE PERCEPCIÓN”')
insert into Leyenda values ('2001','Leyenda “BIENES TRANSFERIDOS EN LA AMAZONÍA REGIÓN SELVAPARA SER CONSUMIDOS EN LA
MISMA"')
insert into Leyenda values ('2002','Leyenda “SERVICIOS PRESTADOS EN LA AMAZONÍA REGIÓN SELVA PARA SER CONSUMIDOS EN LA
MISMA”')
insert into Leyenda values ('2003','Leyenda “CONTRATOS DE CONSTRUCCIÓN EJECUTADOS EN LA AMAZONÍA REGIÓN SELVA”
')
insert into Leyenda values ('2004','Leyenda “Agencia de Viaje - Paquete turístico” ')
insert into Leyenda values ('2005','Leyenda “Venta realizada por emisor itinerante”')
insert into Leyenda values ('2006','Leyenda: Operación sujeta a detracción')

insert into Leyenda values ('2007','Leyenda: Operación sujeta a IVAP')

insert into Leyenda values ('3000','Detracciones: CODIGO DE BB Y SS SUJETOS A DETRACCION')
insert into Leyenda values ('3001','Detracciones: NUMERO DE CTA EN EL BN')
insert into Leyenda values ('3002',' Detracciones: Recursos Hidrobiológicos-Nombre y matrícula de la embarcación')

insert into Leyenda values ('3003','Detracciones: Recursos Hidrobiológicos-Tipo y cantidad de especie vendida')
insert into Leyenda values ('3004','Detracciones: Recursos Hidrobiológicos -Lugar de descarga')
insert into Leyenda values ('3005','Detracciones: Recursos Hidrobiológicos -Fecha de descarga')
insert into Leyenda values ('3006','Detracciones: Transporte Bienes vía terrestre – Numero Registro MTC')

insert into Leyenda values ('3007','Detracciones: Transporte Bienes vía terrestre – configuración vehicular')
insert into Leyenda values ('3008','Detracciones: Transporte Bienes vía terrestre – punto de origen')
insert into Leyenda values ('3009','Detracciones: Transporte Bienes vía terrestre – punto destino')
insert into Leyenda values ('3010','Detracciones: Transporte Bienes vía terrestre – valor referencial preliminar')

--catalogo nro 1
create table tipoDoc
(
	idTipoDoc int identity primary key not null,
	codigo varchar(2) not null,
	descripcion varchar(max) not null
)

select * from tipoDoc
insert into tipoDoc values ('01','FACTURA')
insert into tipoDoc values ('03','BOLETA DE VENTA')
insert into tipoDoc values ('07','NOTA DE CREDITO')
insert into tipoDoc values ('08','NOTA DE DEBITO')
insert into tipoDoc values ('09','GUIA DE REMISIÓN REMITENTE')
insert into tipoDoc values ('12','TICKET DE MAQUINA REGISTRADORA')

insert into tipoDoc values ('13','DOCUMENTO EMITIDO POR BANCOS, INSTITUCIONES FINANCIERAS, CREDITICIAS Y DE SEGUROS QUE
SE ENCUENTREN BAJO EL CONTROL DE LA SUPERINTENDENCIA DE BANCA Y SEGUROS
')
insert into tipoDoc values ('14','RECIBO SERVICIOS PUBLICOS')
insert into tipoDoc values ('16','BOLETO DE VIAJE EMITIDO POR LAS EMPRESAS DE TRANSPORTE PÚBLICO INTERPROVINCIAL DE
PASAJEROS
')
insert into tipoDoc values ('18','DOCUMENTOS EMITIDOS POR LAS AFP')
insert into tipoDoc values ('20','COMPROBANTE DE RETENCION')
insert into tipoDoc values ('31','GUIA DE REMISIÓN TRANSPORTISTA')
insert into tipoDoc values ('40','COMPROBANTE DE PERCEPCION')


create table TipoPrecioVenta(
idTipoPrecioV int identity primary key not null,
codigo varchar(2) not null,
descripcion varchar(100) not null
)

insert into tipoPrecioVenta values ('01','Precio unitario (incluye el IGV)')
insert into tipoPrecioVenta values ('02','Valor referencial unitario en operaciones no onerosas')


create table TiposOperacion(
idTiposOperacion int identity primary key not null,
codigo varchar(2) not null,
descripcion varchar(100) not null
)

insert into tiposOperacion values ('01','Venta lnterna')
insert into tiposOperacion values ('02','Exportación')
insert into tiposOperacion values ('03','No Domiciliados')
insert into tiposOperacion values ('04','Venta Interna – Anticipos')
insert into tiposOperacion values ('05','Venta Itinerante')
insert into tiposOperacion values ('06','Factura Guía')
insert into tiposOperacion values ('07','Venta Arroz Pilado')
insert into tiposOperacion values ('08','Factura - Comprobante de Percepción')
insert into tiposOperacion values ('10','Factura - Guía remitente')
insert into tiposOperacion values ('11','Factura - Guía transportista')
insert into tiposOperacion values ('12','Boleta de venta – Comprobante de Percepción')
insert into tiposOperacion values ('13','Gasto Deducible Persona Natural')


create table ModalidadTraslado(
idModalidadTraslado int identity primary key not null,
codigo varchar(2) not null,
descripcion varchar(100) not null
)

insert into ModalidadTraslado values ('01','Transporte público')
insert into ModalidadTraslado values ('02','Transporte privado')


create table MotivosTraslado(
idMotivosTraslado int identity primary key not null,
codigo varchar(2) not null,
descripcion varchar(100) not null
)

insert into MotivosTraslado values ('01','VENTA')
insert into MotivosTraslado values ('02','COMPRA')
insert into MotivosTraslado values ('04','TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA')
insert into MotivosTraslado values ('08','IMPORTACION')
insert into MotivosTraslado values ('09','EXPORTACION')


create table RegimenPercepcion(
idRegimenPercepcion int identity primary key not null,
codigo varchar(2) not null,
descripcion varchar(100) not null,
tasa Varchar(5) not null
)

insert into RegimenPercepcion values ('01','PERCEPCION VENTA INTERNA', '2%')
insert into RegimenPercepcion values ('02','PERCEPCION A LA ADQUISICION DE
COMBUSTIBLE','1%')
insert into RegimenPercepcion values ('03','PERCEPCION REALIZADA AL AGENTE DE
PERCEPCION CON TASA ESPECIAL','0.5%')


create table RegimenRetencion(
idRegimenRetencion int identity primary key not null,
codigo varchar(2) not null,
descripcion varchar(100) not null,
)

insert into RegimenPercepcion values ('01', '3%')


--catalogo 51
create table TiposFactura(
idTiposOperacion int identity primary key not null,
codigo varchar(2) not null,
descripcion varchar(100) not null
)

insert into tiposOperacion values ('0101','Venta lnterna')
insert into tiposOperacion values ('0102','Exportación')
insert into tiposOperacion values ('0103','No Domiciliados')
insert into tiposOperacion values ('0104','Venta Interna – Anticipos')
insert into tiposOperacion values ('0105','Venta Itinerante')
insert into tiposOperacion values ('0106','Factura Guía')
insert into tiposOperacion values ('0107','Venta Arroz Pilado')
insert into tiposOperacion values ('0108','Factura - Comprobante de Percepción')
insert into tiposOperacion values ('0110','Factura - Guía remitente')
insert into tiposOperacion values ('0111','Factura - Guía transportista')



CREATE TABLE Leyenda (
    Id INT PRIMARY KEY IDENTITY(1,1),
    codigo VARCHAR(10),
    valor VARCHAR(255)
);

insert into Leyenda values ('1000','Monto en Letras')
insert into Leyenda values ('1002','Leyenda "TRANSFERENCIA GRATUITA DE UN BIEN Y/O SERVICIO PRESTADO GRATUITAMENTE')
insert into Leyenda values ('2000','Leyenda “COMPROBANTE DE PERCEPCIÓN”')
insert into Leyenda values ('2001','Leyenda “BIENES TRANSFERIDOS EN LA AMAZONÍA REGIÓN SELVAPARA SER CONSUMIDOS EN LA
MISMA"')
insert into Leyenda values ('2002','Leyenda “SERVICIOS PRESTADOS EN LA AMAZONÍA REGIÓN SELVA PARA SER CONSUMIDOS EN LA
MISMA”')
insert into Leyenda values ('2003','Leyenda “CONTRATOS DE CONSTRUCCIÓN EJECUTADOS EN LA AMAZONÍA REGIÓN SELVA”
')
insert into Leyenda values ('2004','Leyenda “Agencia de Viaje - Paquete turístico” ')
insert into Leyenda values ('2005','Leyenda “Venta realizada por emisor itinerante”')
insert into Leyenda values ('2006','Leyenda: Operación sujeta a detracción')


insert into Leyenda values ('3000','Código interno generado por el software de Facturación ')


--Catálogo No. 21: Documentos Relacionados - aplicable solo para la Guía de remisión electrónica
