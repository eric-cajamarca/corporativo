const dbConfig = require('../dbconfig');
const { v4: uuidv4 } = require('uuid');
const sql = require('mssql');
const ProductosServices = require('../services/productos.service');
const preciosVRepository = require('../repositories/preciosV.repository');



// const obtener_productos_todos = async (req, res) => {
//   if (req.user) {
//     if (req.user.rol == "Administrador") {
//       try {
//         let pool = await sql.connect(dbConfig);
//         let productos = await pool.request().query("SELECT * FROM Productos");

      

//         res.status(200).send({ data: productos.recordset });
//       } catch (error) {
//         console.log("obterner productos error: " + error);
//         res
//           .status(500)
//           .send({ message: "Error al obtener los productos", data: undefined });
//       }
//     } else {
//       res
//         .status(200)
//         .send({
//           message: "No tiene permisos para realizar esta acción",
//           data: undefined,
//         });
//     }
//   } else {
//     res.status(500).send({ message: "No Access", data: undefined });
//   }
// };


const obtener_productos_todos = async (req, res) => {
  try {

    const pool = await sql.connect(dbConfig);

    const productos = await ProductosServices.obtenerProductosTodosService(pool, req.user);

    res.status(200).send({ data: productos });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(500).send({ message: "No Access", data: undefined });
    }

    if (error.message === "NO_PERMISSIONS") {
      return res.status(200).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined,
      });
    }

    console.log("Error obtener productos:", error);
    res.status(500).send({
      message: "Error al obtener los productos",
      data: undefined,
    });
  }
};

const obtener_productos_compras = async (req, res) => {
  try {

    const pool = await sql.connect(dbConfig);

    const productos = await ProductosServices.obtenerProductosComprasService(pool, req.user);

    res.status(200).send({ data: productos });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(500).send({ message: "No Access", data: undefined });
    }

    if (error.message === "NO_PERMISSIONS") {
      return res.status(200).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined,
      });
    }

    console.log("Error obtener productos:", error);
    res.status(500).send({
      message: "Error al obtener los productos",
      data: undefined,
    });
  }
};

const match_productos_descripcion = async (req, res) => {
  try {
    const descripciones = req.body && req.body.descripciones;
    const pool = await sql.connect(dbConfig);
    const matches = await ProductosServices.matchProductosPorDescripcionService(pool, req.user, descripciones || []);
    res.status(200).send({ data: matches });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(500).send({ message: "No Access", data: undefined });
    }
    console.error("match_productos_descripcion:", error);
    res.status(500).send({ message: "Error al buscar productos por descripción", data: undefined });
  }
};

const obtener_productos_id = async (req, res) => {
  try {
    const idProducto = req.params.id;

    const pool = await sql.connect(dbConfig);

    // NUNCA pongas lógica de negocio en controllers, solo llamadas a services (regla 1.1)
    const producto = await ProductosServices.obtenerProductoPorIdService(pool, idProducto, req.user);

    res.status(200).json({ data: producto });
  } catch (error) {
    // SIEMPRE lanza throw new Error para errores de negocio (regla 1.3)
    if (error.message === "NO_ACCESS") {
      return res.status(401).json({ message: "No autorizado" });
    }

    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).json({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }

    if (error.message === "PRODUCTO_NO_ENCONTRADO") {
      return res.status(404).json({ message: "Producto no encontrado", data: undefined });
    }

    if (error.message === "ID_PRODUCTO_INVALIDO") {
      return res.status(400).json({ message: "ID de producto inválido", data: undefined });
    }

    // NUNCA uses console.log(). Usa console.error() (regla 1.3)
    console.error("Error al obtener producto:", error);
    res.status(500).json({ message: "Error interno del servidor", data: undefined });
  }
};

// const crear_producto = async (req, res) => {
//     const { Codigo, idCategoria, idMarca, descripcion, idPresentacion, pUnitario, fProduccion, fVencimiento, facturar } = req.body;

//     console.log('crear producto ', req.body);
//     //crear id unico
//     const idProducto = uuidv4();
//     const idEmpresa = req.user.empresa;
//     const idUsuario = req.user.sub;
//     //console.log('idUsuario ', idUsuario);

//     // idCategoria = parseInt(idCategoria);

//     //obtener fecha actual
//     var hoy = new Date();
//     var dd = hoy.getDate();
//     var mm = hoy.getMonth() + 1;
//     var yyyy = hoy.getFullYear();

//     //dar formato a la fecha datetime
//     const FIngreso = yyyy + '-' + mm + '-' + dd;

//     if (req.user) {
//         if (req.user.rol == 'Administrador') {
//             try {
//                 let pool = await sql.connect(dbConfig);
//                 let productos = await pool
//                     .request()
//                     .input("idProducto", sql.UniqueIdentifier, idProducto)
//                     .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
//                     .input("Codigo", sql.VarChar, Codigo.toString())
//                     .input("idCategoria", sql.Int, parseInt(idCategoria))
//                     .input("descripcion", sql.VarChar, descripcion)
//                     .input("idMarca", sql.Int, parseInt(idMarca)) //idMarca
//                     .input("idPresentacion", sql.Int, parseInt(idPresentacion))
//                     .input("cUnitario", sql.Decimal(18,5), parseFloat(pUnitario))
//                     .input("fProduccion", sql.VarChar, fProduccion)
//                     .input("fVencimiento", sql.VarChar, fVencimiento)
//                     .input("alertaMinimo", sql.Decimal, 5)
//                     .input("alertaMaximo", sql.Decimal, 50)
//                     .input("VecesVendidas", sql.Int, 0)
//                     .input("facturar", sql.VarChar, facturar)
//                     .input("idUsuario", sql.UniqueIdentifier, idUsuario)
//                     .input("FIngreso", sql.DateTime, FIngreso)
//                     .input("estado", sql.Bit, 1) //estado
//                     .query("INSERT INTO Productos VALUES (@idProducto, @idEmpresa, @Codigo, @idCategoria, @descripcion, @idMarca, @idPresentacion, @cUnitario, @fProduccion, @fVencimiento, @alertaMinimo, @alertaMaximo, @VecesVendidas, @facturar, @idUsuario, @FIngreso, @estado)");

//                     //if(productos.rowsAffected == 1){
//                         res.status(200).send({ data: idProducto });
//                     // }else{
//                     //     res.status(500).send({ message: 'Error al crear los productos', data: undefined });
//                     // }
//                     console.log('producto creado ', idProducto);

//             } catch (error) {
//                 console.log('crear productos error: ' + error);
//                 res.status(500).send({ message: 'Error al crear los productos', data: undefined });
//             }

//         } else {
//             console.log('no tiene permisos');
//             res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//         }
//     }
//     else {
//         console.log('no tiene acceso');
//         res.status(500).send({ message: 'No Access', data: undefined });
//     }

// }

const gestionProductos_Compras = async (req, res) => {
  console.log("req.body en gestionProductos_Compras ", req.body);
  const {
    Codigo,
    idCategoria,
    idMarca,
    descripcion,
    idPresentacion,
    cUnitario,
    fProduccion,
    fVencimiento,
    idProducto,
  } = req.body;

  const datosProducto = {
    idProducto: idProducto ? idProducto : uuidv4(),
    Codigo: Codigo,
    idCategoria: idCategoria ? parseInt(idCategoria) : null,
    descripcion: descripcion,
    idMarca: idMarca ? parseInt(idMarca) : null,
    idPresentacion: idPresentacion ? parseInt(idPresentacion) : null,
    cUnitario: parseFloat(cUnitario),
    fProduccion: fProduccion ? convertirFormato(fProduccion) : null,
    fVencimiento: fVencimiento ? convertirFormato(fVencimiento) : null,
    idEmpresa: req.user.empresa,
    idUsuario: req.user.sub,
    FIngreso: convertirFormato(new Date()), // Fecha actual
    estado: 1, // Estado activo por defecto
    facturar: "SI", // Asignar valor por defecto
    alertaMinimo: 5, // Valor por defecto
    alertaMaximo: 50, // Valor por defecto
    VecesVendidas: 0, // Valor por defecto

  };

  //Validación básica
  if (
    !datosProducto.Codigo ||
    !datosProducto.idCategoria ||
    !datosProducto.idMarca ||
    !datosProducto.descripcion ||
    !datosProducto.idPresentacion ||
    !datosProducto.cUnitario
  ) {
    res
      .status(400)
      .send({
        message: "Todos los campos obligatorios deben ser completados",
        data: undefined,
      });
    return;
  }

  let accion = idProducto ? "actualizando" : "creando";

  try {
    let resultado;
    

    if (idProducto) {
      console.log("actualizando producto con id ", idProducto);
      resultado = await actualizar_producto_compra(datosProducto, req.user);
    } else {
      console.log("creando nuevo producto");
      resultado = await crear_producto_compra(datosProducto, req.user);
    }

    res.status(200).send({
      message: `Producto ${accion} correctamente`,
      data: resultado,
    });
  } catch (error) {
    console.error(`Error en gestión de productos (${accion}):`, error);
    res.status(500).send({
      message: `Error al ${accion} el producto`,
      data: undefined,
    });
  }
};

/**
 * Obtiene un idUsuario válido para la empresa (req.user.sub o primer usuario de la empresa).
 * Evita FK violation cuando el token tiene sub = idEmpresa (login como empresa sin admin).
 */
const resolverIdUsuarioParaProducto = async (pool, idEmpresa, subFromToken) => {
  if (!subFromToken || !idEmpresa) return null;
  try {
    const r = await pool.request()
      .input('idUsuario', sql.UniqueIdentifier, subFromToken)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('SELECT idUsuario FROM UsuarioWeb WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa');
    if (r.recordset && r.recordset.length > 0) return r.recordset[0].idUsuario;
    const fallback = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('SELECT TOP 1 idUsuario FROM UsuarioWeb WHERE idEmpresa = @idEmpresa');
    if (fallback.recordset && fallback.recordset.length > 0) return fallback.recordset[0].idUsuario;
  } catch (e) {
    console.error('resolverIdUsuarioParaProducto:', e.message);
  }
  return null;
};

const crear_producto = async (req, res) => {
  if (!req.user) {
    return res.status(500).send({ message: "No Access", data: undefined });
  }
  const {
    Codigo,
    codigo,
    idCategoria,
    idMarca,
    descripcion,
    idPresentacion,
    cUnitario,
    fProduccion,
    fVencimiento,
    idProducto,
    alertaMinimo,
    alertaMaximo,
    estado,
    tipoProducto,
    lote,
    precioVenta,
  } = req.body;

  const idEmpresa = req.user.empresa;
  if (!idEmpresa) {
    return res.status(401).send({ message: "Empresa no identificada", data: undefined });
  }

  const cUnitarioNum = parseFloat(cUnitario);
  if (Number.isNaN(cUnitarioNum) || cUnitarioNum < 0) {
    return res.status(400).send({
      message: "Costo unitario debe ser un número válido mayor o igual a 0",
      data: undefined,
    });
  }

  const codigoFinal = (Codigo != null && Codigo !== '') ? String(Codigo).trim() : (codigo != null ? String(codigo).trim() : '');
  const alertaMin = alertaMinimo != null && !Number.isNaN(parseFloat(alertaMinimo)) ? parseFloat(alertaMinimo) : 5;
  const alertaMax = alertaMaximo != null && !Number.isNaN(parseFloat(alertaMaximo)) ? parseFloat(alertaMaximo) : 50;
  const estadoBit = estado === false || estado === 0 ? 0 : 1;
  const tipoProd = (tipoProducto === 'C' || tipoProducto === 'S') ? tipoProducto : 'S';

  var hoy = new Date();
  var dd = String(hoy.getDate()).padStart(2, "0");
  var mm = String(hoy.getMonth() + 1).padStart(2, "0");
  var yyyy = hoy.getFullYear();
  const FIngreso = yyyy + "-" + mm + "-" + dd;

  const datosProducto = {
    idProducto: idProducto || uuidv4(),
    Codigo: codigoFinal,
    idCategoria: idCategoria != null ? parseInt(idCategoria, 10) : null,
    descripcion: descripcion != null ? String(descripcion).trim() : "",
    idMarca: idMarca != null ? parseInt(idMarca, 10) : null,
    idPresentacion: idPresentacion != null ? parseInt(idPresentacion, 10) : null,
    cUnitario: cUnitarioNum,
    fProduccion: fProduccion ? convertirFormato(fProduccion) : null,
    fVencimiento: fVencimiento ? convertirFormato(fVencimiento) : null,
    idEmpresa,
    idUsuario: null,
    FIngreso,
    estado: estadoBit,
    facturar: "SI",
    alertaMinimo: alertaMin,
    alertaMaximo: alertaMax,
    tipoProducto: tipoProd,
    VecesVendidas: 0,
  };

  if (
    !datosProducto.Codigo ||
    datosProducto.idCategoria === null || Number.isNaN(datosProducto.idCategoria) ||
    datosProducto.idMarca === null || Number.isNaN(datosProducto.idMarca) ||
    !datosProducto.descripcion ||
    datosProducto.idPresentacion === null || Number.isNaN(datosProducto.idPresentacion)
  ) {
    return res.status(400).send({
      message: "Todos los campos obligatorios deben ser completados (código, categoría, marca, descripción, presentación, costo unitario).",
      data: undefined,
    });
  }

  if (lote && (!lote.idSucursal || lote.cantidadIngresada == null || lote.cantidadIngresada < 0)) {
    return res.status(400).send({
      message: "Si registra lote inicial, indique sucursal y cantidad mayor o igual a 0.",
      data: undefined,
    });
  }

  try {
    const pool = await sql.connect(dbConfig);
    datosProducto.idUsuario = await resolverIdUsuarioParaProducto(pool, idEmpresa, req.user.sub);
    if (!datosProducto.idUsuario) {
      console.error("crear_producto: no se encontró idUsuario válido para empresa", idEmpresa);
      return res.status(400).send({
        message: "No hay usuario asociado a la empresa para registrar el producto. Contacte al administrador.",
        data: undefined,
      });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await transaction.request()
        .input("idProducto", sql.UniqueIdentifier, datosProducto.idProducto)
        .input("idEmpresa", sql.UniqueIdentifier, datosProducto.idEmpresa)
        .input("Codigo", sql.VarChar, datosProducto.Codigo)
        .input("idCategoria", sql.Int, datosProducto.idCategoria)
        .input("descripcion", sql.VarChar, datosProducto.descripcion)
        .input("idMarca", sql.Int, datosProducto.idMarca)
        .input("idPresentacion", sql.Int, datosProducto.idPresentacion)
        .input("cUnitario", sql.Decimal(18, 5), datosProducto.cUnitario)
        .input("fProduccion", sql.VarChar, datosProducto.fProduccion)
        .input("fVencimiento", sql.VarChar, datosProducto.fVencimiento)
        .input("alertaMinimo", sql.Decimal(18, 2), datosProducto.alertaMinimo)
        .input("alertaMaximo", sql.Decimal(18, 2), datosProducto.alertaMaximo)
        .input("VecesVendidas", sql.Int, 0)
        .input("facturar", sql.VarChar, datosProducto.facturar)
        .input("idUsuario", sql.UniqueIdentifier, datosProducto.idUsuario)
        .input("FIngreso", sql.DateTime, datosProducto.FIngreso)
        .input("estado", sql.Bit, datosProducto.estado)
        .input("tipoProducto", sql.Char(1), datosProducto.tipoProducto)
        .query(
          "INSERT INTO Productos (idProducto, idEmpresa, Codigo, idCategoria, descripcion, idMarca, idPresentacion, cUnitario, fProduccion, fVencimiento, alertaMinimo, alertaMaximo, VecesVendidas, facturar, idUsuario, FIngreso, estado, tipoProducto) VALUES (@idProducto, @idEmpresa, @Codigo, @idCategoria, @descripcion, @idMarca, @idPresentacion, @cUnitario, @fProduccion, @fVencimiento, @alertaMinimo, @alertaMaximo, @VecesVendidas, @facturar, @idUsuario, @FIngreso, @estado, @tipoProducto)"
        );

      if (lote && lote.idSucursal && (lote.cantidadIngresada > 0 || lote.costoUnitario != null)) {
        const cantidad = Math.max(0, parseInt(lote.cantidadIngresada, 10) || 0);
        const costoLote = lote.costoUnitario != null ? parseFloat(lote.costoUnitario) : datosProducto.cUnitario;
        await transaction.request()
          .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
          .input("idProducto", sql.UniqueIdentifier, datosProducto.idProducto)
          .input("idSucursal", sql.UniqueIdentifier, lote.idSucursal)
          .input("costoUnitario", sql.Decimal(18, 6), costoLote)
          .input("cantidadIngresada", sql.Decimal(18, 2), cantidad)
          .input("cantidadDisponible", sql.Decimal(18, 2), cantidad)
          .query(
            "INSERT INTO Lotes (idLote, idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible) VALUES (NEWID(), @idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible)"
          );
      }

      const precioVal = parseFloat(precioVenta);
      if (!Number.isNaN(precioVal) && precioVal > 0) {
        const listaPrincipal = await preciosVRepository.verificarPrincipalExistente(transaction, idEmpresa);
        const lista = listaPrincipal && listaPrincipal.recordset && listaPrincipal.recordset[0];
        if (lista && lista.idLista && lista.idMoneda) {
          await preciosVRepository.crearPrecioProducto(transaction, {
            idLista: lista.idLista,
            idProducto: datosProducto.idProducto,
            precio: precioVal,
            idMoneda: lista.idMoneda,
            idUsuario: datosProducto.idUsuario,
          });
        }
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.status(200).send({ data: datosProducto.idProducto });
  } catch (error) {
    console.error("crear_producto error:", error.message);
    res.status(500).send({
      message: error.message && error.message.length < 200 ? error.message : "Error al crear los productos",
      data: undefined,
    });
  }
};

const actualizar_producto_compra = async function (datosProducto, user) {
  // const idProducto = req.params.id;
  // const { Codigo, idCategoria, descripcion, idPresentacion, cUnitario, fProduccion, fVencimiento } = req.body;

  console.log("actualizar producto producto controlleer ", datosProducto);
  // console.log('idProducto ', req.params.id)

  const detalle = datosProducto;

  //if (req.user) {
  //if (req.user.rol == 'Administrador') {
  try {
    let pool = await sql.connect(dbConfig);
    let productos = await pool
      .request()
      .input("idProducto", sql.UniqueIdentifier, detalle.idProducto)
      .input("idEmpresa", sql.UniqueIdentifier, detalle.idEmpresa)
      .input("Codigo", sql.VarChar, detalle.Codigo)
      .input("idCategoria", sql.Int, detalle.idCategoria)
      .input("descripcion", sql.VarChar, detalle.descripcion)
      .input("idMarca", sql.Int, detalle.idMarca)
      .input("idPresentacion", sql.Int, detalle.idPresentacion)
      .input("cUnitario", sql.Decimal(18, 5), detalle.cUnitario)
      .input("fProduccion", sql.VarChar, detalle.fProduccion)
      .input("fVencimiento", sql.VarChar, detalle.fVencimiento)
      .query(
        "UPDATE Productos SET Codigo = @Codigo, idCategoria = @idCategoria, descripcion = @descripcion, idPresentacion = @idPresentacion, cUnitario = @cUnitario, fProduccion = @fProduccion, fVencimiento = @fVencimiento WHERE idProducto = @idProducto and idEmpresa = @idEmpresa"
      );

    console.log("productosresult actualizar productos", productos.rowsAffected);
    return detalle.idProducto;
    //res.status(200).send({ data: productos.rowsAffected });
  } catch (error) {
    console.log("actualizar productos error: " + error);
    res
      .status(200)
      .send({ message: "Error al actualizar los productos", data: undefined });
  }
  // } else {
  //     res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  // }
  //} else {
  //    res.status(500).send({ message: 'No Access', data: undefined });
  // }
};

const crear_producto_compra = async (datosProducto, user) => {
  console.log("crear_nuevo_producto ", datosProducto);
  //crear id unico

  const detalle = datosProducto;

  try {
    let pool = await sql.connect(dbConfig);
    let productos = await pool
      .request()
      .input("idProducto", sql.UniqueIdentifier, detalle.idProducto)
      .input("idEmpresa", sql.UniqueIdentifier, detalle.idEmpresa)
      .input("Codigo", sql.VarChar, detalle.Codigo.toString())
      .input("idCategoria", sql.Int, detalle.idCategoria)
      .input("descripcion", sql.VarChar, detalle.descripcion)
      .input("idMarca", sql.Int, detalle.idMarca) //idMarca
      .input("idPresentacion", sql.Int, detalle.idPresentacion)
      .input("cUnitario", sql.Decimal(18, 5), detalle.cUnitario)
      .input("fProduccion", sql.VarChar, detalle.fProduccion)
      .input("fVencimiento", sql.VarChar, detalle.fVencimiento)
      .input("alertaMinimo", sql.Decimal, detalle.alertaMinimo)
      .input("alertaMaximo", sql.Decimal, detalle.alertaMaximo)
      .input("VecesVendidas", sql.Int, detalle.VecesVendidas)
      .input("facturar", sql.VarChar, detalle.facturar.toString())
      .input("idUsuario", sql.UniqueIdentifier, detalle.idUsuario)
      .input("FIngreso", sql.DateTime, detalle.FIngreso)
      .input("estado", sql.Bit, detalle.estado) //estado
      .query(
        "INSERT INTO Productos VALUES (@idProducto, @idEmpresa, @Codigo, @idCategoria, @descripcion, @idMarca, @idPresentacion, @cUnitario, @fProduccion, @fVencimiento, @alertaMinimo, @alertaMaximo, @VecesVendidas, @facturar, @idUsuario, @FIngreso, @estado)"
      );

    //if(productos.rowsAffected == 1){
    console.log("producto creado ", detalle.idProducto);
    return detalle.idProducto;
    // }else{
    //     res.status(500).send({ message: 'Error al crear los productos', data: undefined });
    // }
    
  } catch (error) {
    console.log("crear productos error: " + error);
    res
      .status(500)
      .send({ message: "Error al crear los productos", data: undefined });
  }
};

const actualizar_producto = async function (req, res) {
  const idProducto = req.params.id;
  const {
    Codigo,
    idCategoria,
    descripcion,
    idPresentacion,
    cUnitario,
    fProduccion,
    fVencimiento,
    alertaMinimo,
    alertaMaximo,
    estado,
    tipoProducto,
  } = req.body;

  const detalle = {
    idProducto: idProducto,
    Codigo: Codigo,
    idCategoria: parseInt(idCategoria),
    descripcion: descripcion,
    idMarca: parseInt(req.body.idMarca),
    idPresentacion: parseInt(idPresentacion),
    cUnitario: parseFloat(cUnitario),
    fProduccion: fProduccion ? convertirFormato(fProduccion) : null,
    fVencimiento: fVencimiento ? convertirFormato(fVencimiento) : null,
    alertaMinimo: alertaMinimo != null ? parseFloat(alertaMinimo) : undefined,
    alertaMaximo: alertaMaximo != null ? parseFloat(alertaMaximo) : undefined,
    estado: estado !== undefined ? (estado ? 1 : 0) : undefined,
    tipoProducto: tipoProducto === 'C' || tipoProducto === 'S' ? tipoProducto : undefined,
    idEmpresa: req.user.empresa,
  };

  try {
    let pool = await sql.connect(dbConfig);
    const request = pool
      .request()
      .input("idProducto", sql.UniqueIdentifier, detalle.idProducto)
      .input("idEmpresa", sql.UniqueIdentifier, detalle.idEmpresa)
      .input("Codigo", sql.VarChar, detalle.Codigo)
      .input("idCategoria", sql.Int, detalle.idCategoria)
      .input("descripcion", sql.VarChar, detalle.descripcion)
      .input("idMarca", sql.Int, detalle.idMarca)
      .input("idPresentacion", sql.Int, detalle.idPresentacion)
      .input("cUnitario", sql.Decimal(18, 5), detalle.cUnitario)
      .input("fProduccion", sql.VarChar, detalle.fProduccion)
      .input("fVencimiento", sql.VarChar, detalle.fVencimiento);

    let updateSql =
      "UPDATE Productos SET Codigo = @Codigo, idCategoria = @idCategoria, descripcion = @descripcion, idMarca = @idMarca, idPresentacion = @idPresentacion, cUnitario = @cUnitario, fProduccion = @fProduccion, fVencimiento = @fVencimiento";

    if (detalle.tipoProducto !== undefined) {
      request.input("tipoProducto", sql.Char(1), detalle.tipoProducto);
      updateSql += ", tipoProducto = @tipoProducto";
    }

    if (detalle.alertaMinimo !== undefined) {
      request.input("alertaMinimo", sql.Decimal(18, 2), detalle.alertaMinimo);
      updateSql += ", alertaMinimo = @alertaMinimo";
    }
    if (detalle.alertaMaximo !== undefined) {
      request.input("alertaMaximo", sql.Decimal(18, 2), detalle.alertaMaximo);
      updateSql += ", alertaMaximo = @alertaMaximo";
    }
    if (detalle.estado !== undefined) {
      request.input("estado", sql.Bit, detalle.estado);
      updateSql += ", estado = @estado";
    }

    updateSql += " WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa";
    const productos = await request.query(updateSql);

    res.status(200).send({ data: productos.rowsAffected });
  } catch (error) {
    console.error("actualizar productos error:", error);
    res.status(500).send({
      message: "Error al actualizar los productos",
      data: undefined,
    });
  }
  // } else {
  //     res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  // }
  //} else {
  //    res.status(500).send({ message: 'No Access', data: undefined });
  // }
};

const eliminar_producto = async function (req, res) {
  const idProducto = req.params.id;
  let idEmpresa = req.user.empresa;

  if (req.user) {
    if (req.user.rol == "Administrador") {
      try {
        let pool = await sql.connect(dbConfig);
        let productos = await pool
          .request()
          .input("idProducto", sql.UniqueIdentifier, idProducto)
          .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
          .query(
            "DELETE FROM Productos WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa"
          );

        res.status(200).send({ data: productos.rowsAffected });
      } catch (error) {
        console.log("eliminar productos error: " + error);
        res
          .status(500)
          .send({
            message: "Error al eliminar los productos",
            data: undefined,
          });
      }
    } else {
      res
        .status(200)
        .send({
          message: "No tiene permisos para realizar esta acción",
          data: undefined,
        });
    }
  } else {
    res.status(500).send({ message: "No Access", data: undefined });
  }
};

// function convertirFormato(fechaString) {
//   // Mapea los nombres de los meses en español a sus equivalentes numéricos
//   const meses = {
//     Ene: "01",
//     Feb: "02",
//     Mar: "03",
//     Abr: "04",
//     May: "05",
//     Jun: "06",
//     Jul: "07",
//     Ago: "08",
//     Sep: "09",
//     Oct: "10",
//     Nov: "11",
//     Dic: "12",
//   };

//   if (/^\d{4}-\d{2}-\d{2}$/.test(fechaString)) {
//         return fechaString;
//     }
    
//   // Divide la cadena en partes
//   console.log("fechaString ", fechaString);
//   const partes = fechaString.split(" ");

//   console.log("partes ", partes);
//   // Extrae el mes, día y año
//   const mes = meses[partes[0]];
//   const dia = partes[1].padStart(2, "0"); // Asegura que el día tenga dos dígitos
//   const ano = partes[2];

//   // Formatea la fecha
//   const fechaFormateada = `${ano}-${mes}-${dia}`;

//   return fechaFormateada;
// }

function convertirFormato(fecha) {
  // Si la fecha es null o undefined, retorna null
  if (!fecha) return null;

  // Si ya es un string en formato ISO (ej: "2025-06-19T19:58:17.729Z")
  if (typeof fecha === 'string' && fecha.includes('T')) {
    const dateObj = new Date(fecha);
    return formatearFecha(dateObj);
  }

  // Si es un objeto Date
  if (fecha instanceof Date) {
    return formatearFecha(fecha);
  }

  // Si es un string con formato diferente (ej: "19/06/2025")
  if (typeof fecha === 'string') {
    // Verifica si tiene el formato dd/mm/yyyy
    if (fecha.includes('/')) {
      const [day, month, year] = fecha.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return fecha; // Si ya está en otro formato aceptable
  }

  // Para cualquier otro caso no manejado
  console.warn('Formato de fecha no reconocido:', fecha);
  return null;
}

// Función auxiliar para formatear fechas
function formatearFecha(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


// const obtener_Stock_id = async function (req, res){
//   const { id } = req.params;
//   let pool = await sql.connect(dbConfig);
//   const stock = await obtenerProductosTodosService.getStock(id, pool);
//   res.status(200).send({ data: stock });
  
// };

// export const updateStock = async function (req, res){
//   const { id } = req.params;
//   const { quantity, reason } = req.body;

//   let pool = await sql.connect(dbConfig);

//   await obtenerProductosTodosService.updateStock(id, catidad, reason);
//   res.sendStatus(204);
// };


module.exports = {
  obtener_productos_todos,
  obtener_productos_compras,
  match_productos_descripcion,
  obtener_productos_id,
  crear_producto,
  gestionProductos_Compras,
  actualizar_producto,
  eliminar_producto,
};
