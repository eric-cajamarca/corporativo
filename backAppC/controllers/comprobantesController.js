const sql = require('mssql');
const dbConfig = require('../dbconfig');

async function obtener_comprobantes(req, res) {
    const idEmpresa = req.user?.empresa;
    if (!req.user || !idEmpresa) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const uso = (req.query?.uso || '').toLowerCase();
    try {
        const pool = await sql.connect(dbConfig);
        let sqlText = 'SELECT idComprobante, idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra FROM Comprobantes WHERE idEmpresa = @idEmpresa';
        if (uso === 'venta') {
            sqlText += ' AND usarEnVenta = 1';
        } else if (uso === 'compra') {
            sqlText += ' AND usarEnCompra = 1';
        }
        sqlText += ' ORDER BY codigo';
        const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(sqlText);
        return res.status(200).send({ data: result.recordset });
    } catch (error) {
        console.error('Error al obtener comprobantes:', error);
        return res.status(500).send({ message: 'Error al obtener los comprobantes', data: undefined });
    }
}

async function obtenerComprobantes_alias(req, res) {
        let alias = req.params.id;

        
    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query('SELECT * FROM Comprobantes'+alias+' where id = 15');
    
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


/**
 * PUT /comprobantes/:id - Actualiza serie y número correlativo. No modifica codigo (SUNAT).
 * Body: { serie?, numero? }
 */
async function actualizar_comprobante(req, res) {
    const idEmpresa = req.user?.empresa;
    if (!req.user || !idEmpresa) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).send({ message: 'id inválido', data: undefined });
    }
    const { serie, numero, usarEnVenta, usarEnCompra } = req.body || {};
    try {
        const pool = await sql.connect(dbConfig);
        const request = pool.request()
            .input('idComprobante', sql.Int, id)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
        const updates = [];
        if (serie !== undefined) {
            const s = typeof serie === 'string' ? serie.trim() : '';
            if (s !== '-' && (s.length < 1 || s.length > 4)) {
                return res.status(400).send({ message: 'Serie debe ser "-" (para RC/RA) o texto de 1 a 4 caracteres', data: undefined });
            }
            updates.push('serie = @serie');
            request.input('serie', sql.VarChar(4), s);
        }
        if (numero !== undefined) {
            const num = parseInt(numero, 10);
            if (isNaN(num) || num < 0) {
                return res.status(400).send({ message: 'Número correlativo debe ser entero >= 0', data: undefined });
            }
            updates.push('numero = @numero');
            request.input('numero', sql.Int, num);
        }
        if (usarEnVenta !== undefined) {
            updates.push('usarEnVenta = @usarEnVenta');
            request.input('usarEnVenta', sql.Bit, Boolean(usarEnVenta));
        }
        if (usarEnCompra !== undefined) {
            updates.push('usarEnCompra = @usarEnCompra');
            request.input('usarEnCompra', sql.Bit, Boolean(usarEnCompra));
        }
        if (updates.length === 0) {
            return res.status(400).send({ message: 'Envíe serie, numero y/o usarEnVenta/usarEnCompra a actualizar', data: undefined });
        }
        const sqlText = `UPDATE Comprobantes SET ${updates.join(', ')} WHERE idComprobante = @idComprobante AND idEmpresa = @idEmpresa`;
        const result = await request.query(sqlText);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).send({ message: 'Comprobante no encontrado', data: undefined });
        }
        return res.status(200).send({ data: { rowsAffected: result.rowsAffected[0] } });
    } catch (error) {
        console.error('Error al actualizar comprobante:', error);
        return res.status(500).send({ message: 'Error al actualizar comprobante', data: undefined });
    }
}

/**
 * POST /comprobantes - Crea comprobante para la empresa. codigo (SUNAT), nombre, serie, numero (default 1).
 */
async function crear_comprobante(req, res) {
    const idEmpresa = req.user?.empresa;
    if (!req.user || !idEmpresa) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const { codigo, nombre, serie, usarEnVenta, usarEnCompra } = req.body || {};
    let numero = req.body?.numero;
    if (numero === undefined || numero === null) numero = 1;
    const venta = usarEnVenta !== undefined ? Boolean(usarEnVenta) : true;
    const compra = usarEnCompra !== undefined ? Boolean(usarEnCompra) : true;
    const cod = (codigo != null && typeof codigo === 'string') ? codigo.trim() : '';
    const nom = (nombre != null && typeof nombre === 'string') ? nombre.trim() : '';
    let ser = (serie != null && typeof serie === 'string') ? serie.trim() : '';
    if (!cod || cod.length > 2) {
        return res.status(400).send({ message: 'Código es obligatorio (máx. 2 caracteres, SUNAT)', data: undefined });
    }
    if (!nom || nom.length > 50) {
        return res.status(400).send({ message: 'Nombre es obligatorio (máx. 50 caracteres)', data: undefined });
    }
    if (cod === 'RC' || cod === 'RA') {
        if (ser === '') ser = '-';
        if (ser !== '-' && (ser.length < 1 || ser.length > 4)) {
            return res.status(400).send({ message: 'Para RC y RA la serie debe ser "-"', data: undefined });
        }
    } else if (!ser || ser.length > 4) {
        return res.status(400).send({ message: 'Serie es obligatoria (máx. 4 caracteres)', data: undefined });
    }
    const num = parseInt(numero, 10);
    if (isNaN(num) || num < 0) {
        return res.status(400).send({ message: 'Número correlativo debe ser entero >= 0', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('codigo', sql.VarChar(2), cod)
            .input('nombre', sql.VarChar(50), nom)
            .input('serie', sql.VarChar(4), ser)
            .input('numero', sql.Int, num)
            .input('usarEnVenta', sql.Bit, venta)
            .input('usarEnCompra', sql.Bit, compra)
            .query(`INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra) VALUES (@idEmpresa, @codigo, @nombre, @serie, @numero, 1, @usarEnVenta, @usarEnCompra); SELECT SCOPE_IDENTITY() AS idComprobante;`);
        const idNew = result.recordset && result.recordset[0] ? result.recordset[0].idComprobante : null;
        return res.status(200).send({ data: { idComprobante: idNew } });
    } catch (error) {
        if (error.number === 2627) {
            return res.status(400).send({ message: 'Ya existe un comprobante con ese código (SUNAT) para esta empresa', data: undefined });
        }
        console.error('Error al crear comprobante:', error);
        return res.status(500).send({ message: 'Error al crear comprobante', data: undefined });
    }
}

module.exports = {
    obtener_comprobantes,
    obtenerComprobantes_alias,
    actualizar_comprobante,
    crear_comprobante
};