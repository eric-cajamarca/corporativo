const sql = require('mssql');
const dbConfig = require('../dbconfig');

async function obtener_comprobantes(req, res) {
    console.log('aqui entro a obtener comprobantes');
    const idEmpresa = req.user.empresa;
    console.log('idEmpresa', idEmpresa);

    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT * FROM Comprobantes where idEmpresa = @idEmpresa');
            //console.log('resultado del result', result.recordset);

            res.status(200).send({data:result.recordset});
        } catch (error) {
            console.error('Error al obtener los usuarios:', error);
            res.status(500).send({message:'Error al obtener los comprobantes', data:undefined});
        }
    } 
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }
}

async function obtenerComprobantes_alias(req, res) {
    console.log('aqui entro a obtener comprobantes');
    let alias = req.params.id;

    console.log('alias', alias);
    console.log('params', req.params);

    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query('SELECT * FROM Comprobantes'+alias+' where id = 15');
    
            console.log('resultado del result', result.recordset);
            res.json(result.recordset);
    
        } catch (error) {
            console.error('Error al obtener los comprobantes:', error);
            res.status(500).send('Error al obtener los comprobantes');
        }
    } 
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }

}


module.exports = {
    obtener_comprobantes,
    obtenerComprobantes_alias

};