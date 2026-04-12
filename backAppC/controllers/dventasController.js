const sql = require('mssql');
const dbConfig = require('../dbconfig');
const { idUsuarioDesdePayloadUser } = require('../utils/idUsuarioSesion.util');


async function obtenerDetalleVentas(req, res) {
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!idEmpresa) {
    return res.status(403).json({ message: 'No autorizado: falta empresa en token' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT dv.* FROM DetalleVenta dv
        INNER JOIN Ventas v ON dv.idVenta = v.idVenta
        WHERE v.idEmpresa = @idEmpresa
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener detalle de ventas:', error);
    res.status(500).json({ message: 'Error al obtener detalle de ventas' });
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
      
      data.forEach(async (registro) => {
        const id = registro.id; // Asegúrate de tener la propiedad correcta que contiene el id
        const CantEntregado = registro.CantEntregado;

        // Verifica si CantEntregado es mayor o igual a 0
        if (parseFloat(CantEntregado) >= 0) {
                    // Realiza la actualización en la base de datos
          let pool = await sql.connect(dbConfig);
          await pool
            .request()
            .input('id', sql.Int, id)
            .input('CantEntregado', sql.Decimal, CantEntregado)
          // .query('UPDATE DetalleVentas SET CantEntregado = @CantEntregado WHERE Id = @id');
          
        } else {
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
  
              
            let CantEntregado = sumaTotal;
  
            let pool = await sql.connect(dbConfig);
            let result = await pool
              .request()
              .input('id', sql.Int, id)
              .input('CantEntregado', sql.Decimal, CantEntregado)
              .query('UPDATE DetalleVentas SET CantEntregado = @CantEntregado WHERE Id = @id');
              
            estado = result.rowsAffected;
            mensaje = 'Registros actualizados correctamente';
            // }
  
          } else {
  
            contador++;
  
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
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!idEmpresa) {
    return res.status(403).json({ message: 'No autorizado: falta empresa en token' });
  }
  const idDetalle = parseInt(req.params.id, 10);
  if (Number.isNaN(idDetalle) || idDetalle < 1) {
    return res.status(400).json({ message: 'id de detalle inválido' });
  }
  const stockRepository = require('../repositories/stock.repository');
  const inventarioRepository = require('../repositories/inventario.repository');
  try {
    const pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const rowRs = await transaction.request()
        .input('idDetalle', sql.Int, idDetalle)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT dv.idDetalle, dv.idVenta, dv.idProducto, dv.cantidad, ISNULL(dv.costoUnitario, 0) AS costoUnitario,
            v.idSucursal, v.idEstadoSunat, v.compVenta, v.idComprobante, v.idUsuario, ISNULL(v.eliminado, 0) AS eliminado,
            UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
          FROM DetalleVenta dv
          INNER JOIN Ventas v ON dv.idVenta = v.idVenta AND v.idEmpresa = @idEmpresa
          LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
          WHERE dv.idDetalle = @idDetalle
        `);
      const row = rowRs.recordset && rowRs.recordset[0];
      if (!row) {
        await transaction.rollback();
        return res.status(404).json({ message: 'El registro no existe o no pertenece a tu empresa' });
      }
      if (row.eliminado) {
        await transaction.rollback();
        return res.status(400).json({ message: 'No se puede eliminar línea: la venta está anulada.' });
      }
      const cod = String(row.codigoComprobante || '').trim().toUpperCase();
      const esNv = cod === 'NV';
      if (!esNv && (row.idEstadoSunat === 1 || row.idEstadoSunat === 2 || row.idEstadoSunat === 3)) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'No se puede eliminar la línea: el comprobante ya fue enviado o aceptado en SUNAT.'
        });
      }
      const cant = parseFloat(row.cantidad) || 0;
      if (cant > 0 && row.idProducto) {
        await stockRepository.restaurarStockEnLotes(transaction, {
          idEmpresa,
          idSucursal: row.idSucursal,
          idProducto: row.idProducto,
          cantidad: cant
        });
        const idUsuarioMov = row.idUsuario || idUsuarioDesdePayloadUser(req.user);
        if (idUsuarioMov) {
          await inventarioRepository.insertarFilaMovimiento(transaction, {
            idEmpresa,
            idSucursal: row.idSucursal,
            idProducto: row.idProducto,
            tipoMovimiento: 'EN',
            cantidad: cant,
            docRelacionado: row.compVenta,
            idComprobante: row.idComprobante,
            idUsuario: idUsuarioMov,
            observaciones: 'Eliminación de línea de venta — devolución de stock',
            costoUnitario: row.costoUnitario != null ? Number(row.costoUnitario) : 0,
            idLote: null
          });
        }
      }
      await transaction.request()
        .input('idDetalle', sql.Int, idDetalle)
        .query('DELETE FROM DetalleVenta WHERE idDetalle = @idDetalle');
      await transaction.commit();
      res.json({ message: 'Registro eliminado correctamente; el stock de la línea fue devuelto.' });
    } catch (inner) {
      try {
        await transaction.rollback();
      } catch (_) {}
      throw inner;
    }
  } catch (error) {
    console.error('Error al eliminar el detalle de venta:', error);
    res.status(500).json({ message: error.message || 'Error al eliminar el detalle de venta' });
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
