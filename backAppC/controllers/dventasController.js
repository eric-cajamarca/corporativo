const sql = require('mssql');
const dbConfig = require('../dbconfig');


async function obtenerDetalleVentas(req, res) {

  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool.request().query('SELECT * FROM DetalleVentas');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener detalle de ventas:', error);
    res.status(500).send('Error al obtener  detalle de ventas');
  }
}

// async function obtenerDetalleVentaPorId(req, res) {
//   const CompVentas = req.params.id; 
//   console.log('req.params.id');
//   console.log(req.params.id);
//   try {
//     let pool = await sql.connect(dbConfig);
//     let result = await pool
//       .request()
//       .input('CompVentas', sql.Char, CompVentas) 
//       .query('SELECT * FROM DetalleVentas WHERE CompVentas = @CompVentas');
//     res.json(result.recordset);
//   } catch (error) {
//     console.error('Error al obtener la venta:', error);
//     res.status(500).send('Error al obtener la venta');
//   }
// }


// async function actualizarDetalleVenta(req, res) {
//   const { id, CantEntregado } = req.body;
//   console.log('req.body');
//   console.log(id);
//   console.log(req.body);

//   if (parseFloat(CantEntregado) >= 0 ) {
//     console.log('la cantidad es mayor que 0');


//   }else {
//     console.log('la cantidad es menor que 0');
//     res.status(400).json({ message: 'La cantidad entregado no debe ser menor a 0' });
//   }

//   try {


//     let pool = await sql.connect(dbConfig);
//     let result = await pool
//       .request()
//       .input('id', sql.Int, id)

//       .input('CantEntregado', sql.Decimal, CantEntregado)
//       .query('UPDATE DetalleVentas SET CantEntregado = @CantEntregado WHERE Id = @id');

//     res.status(200).json({ message: 'Registro actualizado correctamente' });

//   } catch (error) {
//     console.error('Error al actualizar el detalle de venta:', error);
//     res.status(500).send('Error al actualizar el detalle de venta');

//   }

// }

async function obtenerDetalleVentaPorId_empresa(req, res) {
  const CompVentas = req.params.id; // Cambia el nombre de la variable a compVentas
  const Destino = req.params.idempresa;

  console.log('entro obtenerDetalleVentaPorId_empresa :', 'req.params');
  console.log(req.params);
  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool
      .request()
      .input('CompVentas', sql.Char, CompVentas)
      .input('Destino', sql.Int, Destino)
      .query('SELECT * FROM DetalleVentas WHERE CompVentas = @CompVentas and Destino = @Destino'); // Cambia el nombre del campo a compVentas
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener la venta:', error);
    res.status(500).send('Error al obtener la venta');
  }
}


// async function actualizarDetalleVenta(req, res) {
//   const data = req.body;
//   let id = req.params.id;
//    console.log('req.body', data);
//    console.log('req.params', req.params);
//   console.log('id:',id);

//   let CantEntregado = data.CantEntregado;

//   if (parseFloat(CantEntregado) >= 0 ) {
//      console.log('la cantidad es mayor que 0');

//     try {

//       console.log('si entro al query del backend');
//       let pool = await sql.connect(dbConfig);
//       let result = await pool
//         .request()
//         .input('id', sql.Int, id)
//         .input('CantEntregado', sql.Decimal, CantEntregado)
//         //.query('UPDATE DetalleVentas SET CantEntregado = @CantEntregado WHERE Id = @id');

//       res.status(200).json({ message: 'Registro actualizado correctamente' });

//     } catch (error) {
//       console.error('Error al actualizar el detalle de venta:', error);
//       res.status(500).send('Error al actualizar el detalle de venta');
//     }

//   } else {
//     console.log('la cantidad es menor que 0');
//     res.status(400).json({ message: 'La cantidad entregada no debe ser menor a 0' });
//   }
// }

async function actualizarDetalleVentakkk(req, res) {
  const data = req.body;
  let compventa = req.params.id;

  try {
    // Verifica que data sea un array antes de intentar recorrerlo
    if (Array.isArray(data)) {
      // Recorre cada elemento en el array data
      console.log('verifico si data es un array');

      data.forEach(async (registro) => {
        const id = registro.id; // Asegúrate de tener la propiedad correcta que contiene el id
        const CantEntregado = registro.CantEntregado;

        // Verifica si CantEntregado es mayor o igual a 0
        if (parseFloat(CantEntregado) >= 0) {
          console.log('la cantidad es mayor a 0');
          // Realiza la actualización en la base de datos
          let pool = await sql.connect(dbConfig);
          await pool
            .request()
            .input('id', sql.Int, id)
            .input('CantEntregado', sql.Decimal, CantEntregado)
          // .query('UPDATE DetalleVentas SET CantEntregado = @CantEntregado WHERE Id = @id');
          console.log('modifico en la base de datos');

        } else {
          console.log(`La cantidad para el registro con id ${id} es menor que 0`);
          // Puedes manejar esto como desees, por ejemplo, agregar un mensaje a una lista de errores
        }
      });

      res.status(200).json({ message: 'Registros actualizados correctamente' });

    } else {
      res.status(400).json({ message: 'El formato de datos no es válido' });
    }

  } catch (error) {
    console.error('Error al actualizar el detalle de venta:', error);
    res.status(500).send('Error al actualizar el detalle de venta');
  }
}

async function actualizarDetalleVenta(req, res) {
  const data = req.body;
  let estado = '';
  let mensaje = '';
  let contador = 0;


  console.log('data:', data);

  if (req.user) {
    try {
      // Verifica que data sea un array antes de intentar recorrerlo
      if (Array.isArray(data)) {
        // Inicializa una variable para la suma total de CantEntregado
        let sumaTotal = 0;
        let cantidadActual = 0;
        let CantEntregadoRegistro = 0;
        let CantEntregadoBD = 0;
  
        // Recorre cada elemento en el array data
        for (const registro of data) {
          cantidadActual = 0;
          CantEntregadoRegistro = 0;
          CantEntregadoBD = 0;
          sumaTotal = 0;
  
  
          const id = parseInt(registro.Id, 10);
          CantEntregadoRegistro = parseFloat(registro.CantEntregado);
          cantidadActual = parseInt(registro.Cantidad);
  
          //console.log('id:', id, 'CantEntregadoRegistro:', CantEntregadoRegistro);
  
          // Recupera la CantEntregado actual de la base de datos
          let pool = await sql.connect(dbConfig);
          let resultadoConsulta = await pool
            .request()
            .input('id', sql.Int, id)
            .query('SELECT CantEntregado FROM DetalleVentas WHERE Id = @id');
  
          CantEntregadoBD = resultadoConsulta.recordset[0].CantEntregado;
  
  
  
          // Suma la CantEntregado del registro actual con la CantEntregado en la base de datos
  
          sumaTotal = CantEntregadoBD + CantEntregadoRegistro;
  
          //console.log('suamtotal=', sumaTotal, ':CantEntregadoBD:', CantEntregadoBD, 'CantEntregadoRegistro:', CantEntregadoRegistro);
  
          // Verifica si la suma total es menor o igual a la cantidad en la base de datos
          //console.log('sumatotal=', sumaTotal, '=>    cantidadactual=', cantidadActual);
  
          if (sumaTotal <= cantidadActual) {
  
            console.log('entro a sumaTotal <= cantidadActual');
  
            let CantEntregado = sumaTotal;
  
            let pool = await sql.connect(dbConfig);
            let result = await pool
              .request()
              .input('id', sql.Int, id)
              .input('CantEntregado', sql.Decimal, CantEntregado)
              .query('UPDATE DetalleVentas SET CantEntregado = @CantEntregado WHERE Id = @id');
            console.log('guardo correctamente por cada registro');
  
            estado = result.rowsAffected;
            mensaje = 'Registros actualizados correctamente';
            // }
  
          } else {
  
            contador++;
  
            console.log('data.length', data.length, 'contador:', contador)
            if (contador == data.length) {
              estado = undefined;
              mensaje = 'La cantidad que deseas registrar es mayor a la cantidad comprada';
            }
  
          }
  
        }
  
  
      }
      
      res.status(200).send({ message: mensaje, data: estado });
  
    } catch (error) {
      console.error('Error al actualizar el detalle de venta:', error);
      res.status(200).send({ message: 'Error al actualizar el detalle de venta', data: undefined });
    }
  }
  else {
    res.status(200).send({ message: 'No Access', data:undefined });
  }


}




async function eliminarDetalleVenta(req, res) {
  const id = req.params.id; // Asegúrate de obtener el ID del registro a eliminar
  console.log(id);

  try {
    let pool = await sql.connect(dbConfig);
    let result = await pool
      .request()
      .input('id', sql.Int, id) // Asegúrate de usar el tipo de dato adecuado para el campo id
      .query('SELECT * FROM DetalleVentas WHERE id = @id'); // Buscar el registro con el ID proporcionado

    if (result.recordset.length === 0) { // Si no se encuentra ningún registro con el ID dado
      return res.status(404).json({ message: 'El registro no existe' });
    } else { // Si se encuentra el registro
      let deleteResult = await pool
        .request()
        .input('id', sql.Int, id)
        .query('DELETE FROM DetalleVentas WHERE id = @id'); // Asegúrate de reemplazar 'id' con el nombre del campo ID en tu tabla

      res.json({ message: 'Registro eliminado correctamente' });
    }
  } catch (error) {
    console.error('Error al eliminar el detalle de venta:', error);
    res.status(500).send('Error al eliminar el detalle de venta');
  }
}


// Agrega los métodos restantes para crear, actualizar y eliminar ventas

module.exports = {
  obtenerDetalleVentas,
  obtenerDetalleVentaPorId_empresa,
  actualizarDetalleVenta,
  eliminarDetalleVenta,
  actualizarDetalleVentakkk
};
