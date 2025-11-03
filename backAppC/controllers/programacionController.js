const sql = require('mssql');
const dbConfig = require('../dbconfig');

async function obtener_programacion(req, res) {
    console.log('Aquí entro a obtener programación');
    
    if (req.user) {
        const rol = req.user.rol;
        const id = req.user.id;
        let query = '';
        let parameters = [];

        if (rol === 'Administrador') {
            query = 'SELECT * FROM ProgramacionPedidos';
        } else if (rol === 'Conductor') {
            query = 'SELECT * FROM ProgramacionPedidos WHERE idConductor = @idConductor';
            parameters.push({ name: 'idConductor', type: sql.Int, value: id });
        }

        try {
            let pool = await sql.connect(dbConfig);
            let request = pool.request();

            
            parameters.forEach(param => {
                request.input(param.name, param.type, param.value);
            });

            let result = await request.query(query);

            console.log('result.recordset', result.recordset);
            res.json({ data: result.recordset });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}

async function obtener_programacion_id(req, res) {
    console.log('aqui entro a obtener programacion');
    
    if(req.user){
        
        const rol = req.user.rol;
        const id = req.user.id;
        let query = '';
        if(rol == 'Administrador'){
           // query = 'SELECT * FROM ProgramacionPedidos';
            //quiero que la consulta tambien me traiga la descripcion del estado
             query = 'SELECT * FROM ProgramacionPedidos INNER JOIN EstadosPedidos ON ProgramacionPedidos.idEstado = EstadosPedidos.idEstado';
             //query = 'SELECT ProgramacionPedidos.CompVentas, ProgramacionPedidos.RSocial, EstadosPedidos.Descripcion FROM ProgramacionPedidos, EstadosPedidos WHERE ProgramacionPedidos.idEstado = EstadosPedidos.idEstado';

            console.log(query);

        }else if(rol == 'Conductor'){
            query = `SELECT * FROM ProgramacionPedidos WHERE idConductor = ${id}`;
            console.log(query);
        }

        try {
            let pool = await sql.connect(dbConfig);
            let result = await pool.request().query(query);
            console.log('result.recordset', result.recordset);
            res.json({data: result.recordset});
            
        } catch (error) {
            res.status(500);
            res.send(error.message);
        }
    }
}




module.exports = {
    obtener_programacion,
    obtener_programacion_id

}