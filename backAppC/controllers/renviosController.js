const sql = require('mssql');
const dbConfig = require('../dbconfig');

const obtenerEnvios = async (req, res) => {
    console.log('aqui entro a obtener envios');
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM Historialpedidos');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener los usuarios:', error);
        res.status(500).send('Error al obtener los usuarios');
    }
};

const getCompEnvio = async function (req, res) {
    const codicion = req.params.id;

    console.log('getcodicion');
    console.log(req.params);
    console.log(codicion);
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool
            .request()
            .input('codicion', sql.VarChar, codicion)
            .query('SELECT * FROM Historialpedidos WHERE CompEnvio = @codicion or CompVentas = @codicion or FEnvio = @codicion');
        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener la venta:', error);
        res.status(500).send('Error al obtener la venta por id');
    }

};


const createCompEnvio = async (req, res) => {
    let data = req.body;

    //extraer Alias del array data
    let alias = data[0].Alias;

    console.log('entro a createCompEnvio:');
    console.log('alias:', alias);

    //quiero capturar la fecha y la hora del sistema y guardarla en formato varchar(10) en la tabla Historialpedidos
    let fecha = new Date();

    let dia = fecha.getDate();
    //quiero que la variable dia tenga 2 digitos
    if (dia < 10) {
        dia = '0' + dia;
    }

    let mes = fecha.getMonth() + 1;
    let anio = fecha.getFullYear();
    let hora = fecha.getHours();

    let fechaActual = anio + '-' + mes + '-' + dia;
    console.log('fechaActual:', fechaActual);

    console.log(' alias:', alias);


    if (req.user) {


        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM Comprobantes' + alias + ' where id = 15');

        console.log('resultado del result', result.recordset);
        res.json(result.recordset);

        //extraer el numero de comprobante de result.recordset
        let NumeroCompEnvio = result.recordset[0].Numero;
        let serieCompEnvio = result.recordset[0].Serie;
        console.log('NumeroCompEnvio:', NumeroCompEnvio);


        let CompEnvio = serieCompEnvio + '-' + NumeroCompEnvio;
        //quiero que el numero de NumeroCompEnvio tenga 8 digitos y que empiece con 00000001
        //aqui agrego los ceros a la izquierda
        if (NumeroCompEnvio < 10) {
            CompEnvio = serieCompEnvio + '-' + '0000000' + NumeroCompEnvio++;
        } else if (NumeroCompEnvio < 100) {
            CompEnvio = serieCompEnvio + '-' + '000000' + NumeroCompEnvio++;
        } else if (NumeroCompEnvio < 1000) {
            CompEnvio = serieCompEnvio + '-' + '00000' + NumeroCompEnvio++;
        } else if (NumeroCompEnvio < 10000) {
            CompEnvio = serieCompEnvio + '-' + '0000' + NumeroCompEnvio++;
        } else if (NumeroCompEnvio < 100000) {
            CompEnvio = serieCompEnvio + '-' + '000' + NumeroCompEnvio++;
        } else if (NumeroCompEnvio < 1000000) {
            CompEnvio = serieCompEnvio + '-' + '00' + NumeroCompEnvio++;
        } else if (NumeroCompEnvio < 10000000) {
            CompEnvio = serieCompEnvio + '-' + '0' + NumeroCompEnvio++;
        } else {
            CompEnvio = serieCompEnvio + '-' + NumeroCompEnvio++;
        }

        console.log('CompEnvio:', CompEnvio);

        try {

            //quiero comprobar si el CompEnvio ya existe en la tabla Historialpedidos
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('CompEnvio', sql.VarChar, data[0].CompEnvio)
                .query('SELECT * FROM Historialpedidos WHERE CompEnvio = @CompEnvio');
            console.log('result.recordset.length:', result.recordset.length);
            if (result.recordset.length > 0) {
                return res.status(400).json({ message: 'El comprobante ya existe.' });
            } else {
                console.log('no existe');

                //recorre el arreglo data y guarda en sql server los datos
                data.forEach(async (element) => {
                    console.log('element:', element);

                    //quiero validar que element.Cantidad sea mayor a 0
                    if (element.Cantidad <= 0) {
                        console.log('element.Cantidad:', element.Cantidad);
                    } else {
                        console.log('element.Cantidad:', element.Cantidad);
                        const pool = await sql.connect(dbConfig);
                        const result = await pool
                            .request()
                            .input('CompEnvio', sql.VarChar, CompEnvio)
                            .input('CompVentas', sql.VarChar, element.CompVentas)
                            .input('FEnvio', sql.VarChar, fechaActual)
                            .input('Descripcion', sql.VarChar, element.Descripcion)
                            .input('Presentacion', sql.VarChar, element.Presentacion)
                            .input('Cantidad', sql.Decimal, element.Cantidad)
                            .query('INSERT INTO Historialpedidos (CompEnvio, CompVentas, FEnvio, Descripcion, Presentacion, Cantidad) VALUES (@CompEnvio, @CompVentas, @FEnvio, @Descripcion, @Presentacion, @Cantidad)');

                    }


                });

                //quiero actualizar el numero de comprobante en la tabla Comprobantes
                const pool2 = await sql.connect(dbConfig);
                const result2 = await pool2
                    .request()
                    .input('Numero', sql.Int, NumeroCompEnvio++)
                    .query('UPDATE Comprobantes' + alias + ' SET Numero = @Numero WHERE id = 15');


                //mensaje de que se guardaron los registros correctamente
                res.status(200).send({ message: 'Registros guardados correctamente', data: result.rowsAffected });
            }




        } catch (error) {

        }
    } else {
        res.status(200).send({ message: 'No Access', data: undefined });
    }


};

const updateCompEnvio = async (req, res) => {
    //   const { name, apellidos, email, password, rol, estado } = req.body;
    const { CompVentas, FEnvio, Descripcion, Presentacion, Cantidad } = req.body;
    const CompEnvio = req.params.id;

    console.log(CompEnvio);

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input('CompEnvio', sql.VarChar, CompEnvio)
            .input('CompVentas', sql.VarChar, CompVentas)
            .input('FEnvio', sql.VarChar, FEnvio)
            .input('Descripcion', sql.VarChar, Descripcion)
            .input('Presentacion', sql.VarChar, Presentacion)
            .input('Cantidad', sql.Decimal, Cantidad)
            .query('UPDATE Historialpedidos SET  FEnvio = @FEnvio, Descripcion = @Descripcion, Presentacion = @Presentacion, Cantidad = @Cantidad WHERE CompEnvio = @CompEnvio');
        res.json({ message: 'Registro actualizado correctamente' });
    } catch (error) {
        console.error('Error al actualizar el registro:', error);
        res.status(500).send('Error al actualizar el registro');
    }
};

const deleteCompEnvio = async function (req, res) {
    const codicion = req.params.id;
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool
            .request()
            .input('codicion', sql.VarChar, codicion)
            .query('DELETE FROM Historialpedidos WHERE CompEnvio = @codicion');
        res.json({ message: 'El registro se eliminó correctamente' });
    } catch (error) {
        console.error('Error al eliminar el registro de envio :', error);
        res.status(500).send('Error al eliminar el registro');
    }
};


module.exports = {
    obtenerEnvios,
    getCompEnvio,
    createCompEnvio,
    deleteCompEnvio,
    updateCompEnvio

};

