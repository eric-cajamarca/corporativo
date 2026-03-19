const sql = require('mssql');
const dbConfig = require('../dbconfig');

async function obtener_programacion(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });

    const rol = req.user.rol;
    const id = req.user.id;
    const { idEstado, fechaDesde, fechaHasta, ruc, cliente } = req.query;

    let whereClauses = [];
    let parameters = [];

    if (rol === 'Conductor') {
        whereClauses.push('pp.idConductor = @idConductor');
        parameters.push({ name: 'idConductor', type: sql.Int, value: id });
    }
    if (idEstado != null && String(idEstado).trim() !== '') {
        whereClauses.push('pp.idEstado = @idEstado');
        parameters.push({ name: 'idEstado', type: sql.Int, value: parseInt(idEstado, 10) });
    }
    const fechaDesdeVal = fechaDesde != null && String(fechaDesde).trim() !== '' ? String(fechaDesde).trim().substring(0, 10) : null;
    const fechaHastaVal = fechaHasta != null && String(fechaHasta).trim() !== '' ? String(fechaHasta).trim().substring(0, 10) : null;
    if (fechaDesdeVal) {
        whereClauses.push('(pp.FEnvio >= @fechaDesde OR CONVERT(VARCHAR(10), pp.FechaEntrega, 120) >= @fechaDesde)');
        parameters.push({ name: 'fechaDesde', type: sql.VarChar(10), value: fechaDesdeVal });
    }
    if (fechaHastaVal) {
        whereClauses.push('(pp.FEnvio <= @fechaHasta OR CONVERT(VARCHAR(10), pp.FechaEntrega, 120) <= @fechaHasta)');
        parameters.push({ name: 'fechaHasta', type: sql.VarChar(10), value: fechaHastaVal });
    }
    const rucVal = ruc != null && String(ruc).trim() !== '' ? String(ruc).trim() : null;
    const clienteVal = cliente != null && String(cliente).trim() !== '' ? String(cliente).trim() : null;
    if (rucVal) {
        const termRuc = '%' + rucVal + '%';
        whereClauses.push('(pp.RSocial LIKE @termRuc OR pp.Ruc LIKE @termRuc)');
        parameters.push({ name: 'termRuc', type: sql.VarChar(100), value: termRuc });
    }
    if (clienteVal) {
        const termCliente = '%' + clienteVal + '%';
        whereClauses.push('pp.RSocial LIKE @termCliente');
        parameters.push({ name: 'termCliente', type: sql.VarChar(100), value: termCliente });
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const baseQuery = `
        SELECT pp.*, ep.descripcion AS estadoDescripcion, ep.color AS estadoColor
        FROM ProgramacionPedidos pp
        LEFT JOIN EstadosPedidos ep ON pp.idEstado = ep.idEstadoPedido
        ${whereSql}
    `;

    try {
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        parameters.forEach(param => {
            request.input(param.name, param.type, param.value);
        });
        const result = await request.query(baseQuery);
        res.json({ data: result.recordset });
    } catch (error) {
        console.error('obtener_programacion error:', error);
        res.status(500).json({ message: error.message });
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