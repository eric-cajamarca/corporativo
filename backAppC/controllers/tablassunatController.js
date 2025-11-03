const sql = require('mssql');
const dbConfig = require('../dbconfig');

// create table EstadoPago
// (
// 	idEstadoPago int identity(1,1) primary key not null,
// 	descripcion varchar(20) not null,
// )

const obtener_estado_pago = async (req, res) => {
    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let estadoPago = await pool.request().query("SELECT * FROM EstadoPago");
            res.status(200).send({ data: estadoPago.recordset });
        } catch (error) {
            console.log('obterner estadoPago error: ' + error);
            res.status(500).send({ message: 'Error al obtener los estadoPago', data: undefined });
        }

    } else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
}

/////////////////////////////////////////
// create table MediosPago
// (
// 	idMediosPago int identity primary key not null,
// 	codigo varchar(3)not null,
// 	descripcion varchar(50) not null

// )

const obtener_medios_pago = async (req, res) => {
    if (req.user) {

        try {
            let pool = await sql.connect(dbConfig);
            let mediosPago = await pool.request().query("SELECT * FROM MediosPago");
            res.status(200).send({ data: mediosPago.recordset });
        } catch (error) {
            console.log('obterner mediosPago error: ' + error);
            res.status(500).send({ message: 'Error al obtener los mediosPago', data: undefined });
        }

    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }

}

//////////////////////////////////////////////////////////////////
// CREATE TABLE Moneda(
// 	idMoneda int identity(1,1) primary key not null,
// 	codigoc varchar(3) NOT NULL,
// 	descripcion varchar(20) not NULL,
// 	simbolo varchar(3) not NULL,

// )

const obtener_moneda = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let moneda = await pool.request().query("SELECT * FROM Moneda");
            res.status(200).send({ data: moneda.recordset });

        } catch (error) {
            console.log('obterner moneda error: ' + error);
            res.status(500).send({ message: 'Error al obtener los moneda', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
}

//////////////////////////////////////////////////////////////////
// --catalogo nro 15
// CREATE TABLE Leyenda (
//     Id INT PRIMARY KEY IDENTITY(1,1),
//     codigo VARCHAR(10),
//     valor VARCHAR(255)
// );

const obtener_leyenda = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let leyenda = await pool.request().query("SELECT * FROM Leyenda");
            res.status(200).send({ data: leyenda.recordset });

        } catch (error) {
            console.log('obterner leyenda error: ' + error);
            res.status(500).send({ message: 'Error al obtener los leyenda', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }

}
////////////////////////////////////////////////////////////////////////////////////////
// --catalogo nro 1
// create table tipoDoc
// (
// 	idTipoDoc int identity primary key not null,
// 	codigo varchar(2) not null,
// 	descripcion varchar(max) not null
// )

const obtener_tipo_doc = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let tipoDoc = await pool.request().query("SELECT * FROM tipoDoc");
            res.status(200).send({ data: tipoDoc.recordset });

        } catch (error) {
            console.log('obterner tipoDoc error: ' + error);
            res.status(500).send({ message: 'Error al obtener los tipoDoc', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }


}

///////////////////////////////////////////////////////////////////////////////////////
// --catalogo 51
// create table TiposFactura(
// idTiposOperacion int identity primary key not null,
// codigo varchar(2) not null,
// descripcion varchar(100) not null
// )

const obtener_tipo_factura = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let tipoFactura = await pool.request().query("SELECT * FROM TiposFactura");
            res.status(200).send({ data: tipoFactura.recordset });

        } catch (error) {
            console.log('obterner tipoFactura error: ' + error);
            res.status(500).send({ message: 'Error al obtener los tipoFactura', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
}



////////////////////////////////////////////////////////////////////////////////////////
// create table TiposOperacion(
//     idTiposOperacion int identity primary key not null,
//     codigo varchar(2) not null,
//     descripcion varchar(100) not null
//     )

const obtener_tipo_operacion = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let tipoOperacion = await pool.request().query("SELECT * FROM TiposOperacion");
            res.status(200).send({ data: tipoOperacion.recordset });

        } catch (error) {
            console.log('obterner tipoOperacion error: ' + error);
            res.status(500).send({ message: 'Error al obtener los tipoOperacion', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }

}

///////////////////////////////////////////////////////////////////////////////////////
// create table ModalidadTraslado(
//     idModalidadTraslado int identity primary key not null,
//     codigo varchar(2) not null,
//     descripcion varchar(100) not null
//     )

const obtener_modalidad_traslado = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let modalidadTraslado = await pool.request().query("SELECT * FROM ModalidadTraslado");
            res.status(200).send({ data: modalidadTraslado.recordset });

        } catch (error) {
            console.log('obterner modalidadTraslado error: ' + error);
            res.status(500).send({ message: 'Error al obtener los modalidadTraslado', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }

}

///////////////////////////////////////////////////////////////////////////////////////
// create table MotivosTraslado(
//     idMotivosTraslado int identity primary key not null,
//     codigo varchar(2) not null,
//     descripcion varchar(100) not null
//     )

const obtener_motivos_traslado = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let motivosTraslado = await pool.request().query("SELECT * FROM MotivosTraslado");
            res.status(200).send({ data: motivosTraslado.recordset });

        } catch (error) {
            console.log('obterner motivosTraslado error: ' + error);
            res.status(500).send({ message: 'Error al obtener los motivosTraslado', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
}


///////////////////////////////////////////////////////////////////////////////////////
// create table RegimenPercepcion(
//     idRegimenPercepcion int identity primary key not null,
//     codigo varchar(2) not null,
//     descripcion varchar(100) not null,
//     tasa Varchar(5) not null
//     )

const obtener_regimen_percepcion = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let regimenPercepcion = await pool.request().query("SELECT * FROM RegimenPercepcion");
            res.status(200).send({ data: regimenPercepcion.recordset });

        } catch (error) {
            console.log('obterner regimenPercepcion error: ' + error);
            res.status(500).send({ message: 'Error al obtener los regimenPercepcion', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////
// create table RegimenRetencion(
//     idRegimenRetencion int identity primary key not null,
//     codigo varchar(2) not null,
//     descripcion varchar(100) not null,
//     )

const obtener_regimen_retencion = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let regimenRetencion = await pool.request().query("SELECT * FROM RegimenRetencion");
            res.status(200).send({ data: regimenRetencion.recordset });

        } catch (error) {
            console.log('obterner regimenRetencion error: ' + error);
            res.status(500).send({ message: 'Error al obtener los regimenRetencion', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }

}

////////////////////////////////////////////////////////////////////////
// create table Tributos
// (
// 	idTributo int identity primary key not null,
// 	codigo varchar(4) not null,
// 	descripcion varchar(50) not null,
// 	nombreT varchar(3) not null
// )	

const obtener_tributos = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let tributos = await pool.request().query("SELECT * FROM Tributos");
            res.status(200).send({ data: tributos.recordset });

        } catch (error) {
            console.log('obterner tributos error: ' + error);
            res.status(500).send({ message: 'Error al obtener los tributos', data: undefined });
        }
    }
    else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });

    }

}

///////////////////////////////////////////////////////////////////////////////////////
// create table EstadoSunat
// (
// 	idEstadoSunat int identity(1,1) primary key not null,
// 	codigo varchar(3) not null,
// 	descripcion varchar(30) not null,
// )

const obtener_estado_sunat = async (req, res) => {

    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let estadoSunat = await pool.request().query("SELECT * FROM EstadoSunat");
            res.status(200).send({ data: estadoSunat.recordset });

        } catch (error) {
            console.log('obterner estadoSunat error: ' + error);
            res.status(500).send({ message: 'Error al obtener los estadoSunat', data: undefined });
        }

    } else {
        res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
}


module.exports = {
    obtener_estado_pago,
    obtener_medios_pago,
    obtener_estado_sunat,
    obtener_moneda,
    obtener_leyenda,
    obtener_tipo_doc,
    obtener_tipo_operacion,
    obtener_modalidad_traslado,
    obtener_motivos_traslado,
    obtener_tipo_factura,
    obtener_regimen_percepcion,
    obtener_regimen_retencion,
    obtener_tributos

}