const sql = require('mssql');
const dbConfig = require('../dbconfig');


//tabla unidporcaja
// CREATE TABLE UndPorCaja (
//     idUndPorCaja INT PRIMARY KEY IDENTITY(1,1) not null,
// 	   idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE not null,
//     idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto) not null,
//     unidxCaja int not null,
//     pesoUnidad DECIMAL(10,2) NOT NULL, -- Peso por unidad del producto
//     pesoCaja DECIMAL(10,2) NOT NULL, -- Peso total por caja o bulto
// );

//obtener todas las unidades por caja
const obtenerUnidPorCaja = async function (req, res) {
    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
            .query(`SELECT * FROM UndPorCaja WHERE idEmpresa = @idEmpresa`);
            res.status(200).send({data: result.recordset});
        } catch (error) {
            console.error('Error al obtener las unidades por caja:', error);
            res.status(500).send({ data: undefined });
        }
    }else{
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

//editar unidad por caja
const editarUnidPorCaja = async function (req, res) {
    const { unidxCaja, pesoUnidad, pesoCaja } = req.body;
    const idUndPorCaja = req.params.id;
    const idEmpresa = req.user.empresa;

    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idUndPorCaja', sql.Int, idUndPorCaja)
            .input('unidxCaja', sql.Int, unidxCaja)
            .input('pesoUnidad', sql.Decimal, pesoUnidad)
            .input('pesoCaja', sql.Decimal, pesoCaja)
            .query(`UPDATE UndPorCaja SET unidxCaja = @unidxCaja, pesoUnidad = @pesoUnidad, pesoCaja = @pesoCaja WHERE idUndPorCaja = @idUndPorCaja and idEmpresa = @idEmpresa`);
            res.status(200).send({data: result.recordset});
        } catch (error) {
            console.error('Error al editar la unidad por caja:', error);
            res.status(500).send({ data: undefined });
        }
    }else{
        res.status(401).send({ message: 'No Access', data: undefined });
    }

}



module.exports = {
    obtenerUnidPorCaja,
    editarUnidPorCaja

}