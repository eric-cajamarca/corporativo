const { v4: uuidv4 } = require('uuid');
const { withPool } = require('../utils/dbPool.util');
const { assertEmpresaAutorizada } = require('../utils/empresaGestora.util');
const ProductosServices = require('../services/productos.service');
const ProductosRepository = require('../repositories/productos.repository');
const productosMutacionesService = require('../services/productosMutaciones.service');
const { shouldSkipRedisCache } = require('../utils/cacheSkip.util');

const obtener_productos_todos = async (req, res) => {
  try {
    const { parsePaginacion } = require('../utils/paginacion.util');
    const pag = parsePaginacion(req.query || {});
    if (pag.activa) {
      const result = await withPool(async (pool) =>
        ProductosServices.listarProductosPaginadoService(pool, req.user, req.query)
      );
      return res.status(200).send({ data: result.rows, total: result.total, pagina: result.pagina, porPagina: result.porPagina });
    }

    const productos = await withPool(async (pool) =>
      ProductosServices.obtenerProductosTodosService(pool, req.user)
    );

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

        res.status(500).send({
      message: "Error al obtener los productos",
      data: undefined,
    });
  }
};

const buscar_productos_venta = async (req, res) => {
  try {
    const q = req.query && req.query.q != null ? String(req.query.q).trim() : '';
    const limit = req.query && req.query.limit != null ? req.query.limit : 80;
    const idSucursal = req.query && req.query.idSucursal != null ? String(req.query.idSucursal).trim() : null;

    const productos = await withPool(async (pool) =>
      ProductosServices.buscarProductosVentaService(
        pool,
        req.user,
        q,
        limit,
        idSucursal,
        { skipCache: shouldSkipRedisCache(req.query) }
      )
    );

    res.status(200).send({ data: productos });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(500).send({ message: 'No Access', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(200).send({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }
    if (error.message === 'TERMINO_CORTO') {
      return res.status(400).send({
        message: 'Ingrese al menos 2 caracteres para buscar',
        data: []
      });
    }
    if (error.message === 'ID_SUCURSAL_INVALIDO') {
      return res.status(400).send({ message: 'Sucursal inválida', data: undefined });
    }
    console.error('buscar_productos_venta:', error);
    res.status(500).send({
      message: 'Error al buscar productos',
      data: undefined
    });
  }
};

const obtener_productos_compras = async (req, res) => {
  try {

    const productos = await withPool(async (pool) =>
      ProductosServices.obtenerProductosComprasService(pool, req.user)
    );

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

        res.status(500).send({
      message: "Error al obtener los productos",
      data: undefined,
    });
  }
};

const match_productos_descripcion = async (req, res) => {
  try {
    const descripciones = req.body && req.body.descripciones;
    const matches = await withPool(async (pool) =>
      ProductosServices.matchProductosPorDescripcionService(pool, req.user, descripciones || [])
    );
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

    // NUNCA pongas lógica de negocio en controllers, solo llamadas a services (regla 1.1)
    const producto = await withPool(async (pool) =>
      ProductosServices.obtenerProductoPorIdService(pool, idProducto, req.user)
    );

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

const gestionProductos_Compras = async (req, res) => {
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
    !datosProducto.idCategoria ||
    !datosProducto.idMarca ||
    !datosProducto.descripcion ||
    !datosProducto.idPresentacion ||
    !datosProducto.cUnitario
  ) {
    res
      .status(400)
      .send({
        message: "Todos los campos obligatorios deben ser completados (excepto código, que puede autogenerarse).",
        data: undefined,
      });
    return;
  }

  let accion = idProducto ? "actualizando" : "creando";

  try {
    let resultado;
    

    if (idProducto) {
            resultado = await actualizar_producto_compra(datosProducto, req.user);
    } else {
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
    idListaPrecio,
    useCorrelativo,
    permiteDescripcionEnVenta,
    preciosPorLista,
    idEmpresaDestino,
  } = req.body;

  const idEmpresaJwt = req.user.empresa;
  if (!idEmpresaJwt) {
    return res.status(401).send({ message: "Empresa no identificada", data: undefined });
  }

  let idEmpresa = idEmpresaJwt;
  const destRaw = idEmpresaDestino != null ? String(idEmpresaDestino).trim() : '';
  if (destRaw) {
    try {
      await withPool((pool) => assertEmpresaAutorizada(pool, idEmpresaJwt, destRaw));
      idEmpresa = destRaw;
    } catch (e) {
      return res.status(403).send({ message: 'Empresa destino no autorizada', data: undefined });
    }
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
    permiteDescripcionEnVenta: permiteDescripcionEnVenta === true || permiteDescripcionEnVenta === 1 || permiteDescripcionEnVenta === 'true' ? 1 : 0,
  };

  const usarCorrelativo =
    useCorrelativo === true ||
    useCorrelativo === 'true' ||
    useCorrelativo === 1 ||
    useCorrelativo === '1';

  if (
    (!usarCorrelativo && !datosProducto.Codigo) ||
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
    const resultado = await withPool(async (pool) => {
      datosProducto.idUsuario = await productosMutacionesService.resolverIdUsuarioParaProducto(
        pool,
        idEmpresa,
        req.user.sub
      );
      if (!datosProducto.idUsuario) {
        return { __sinUsuario: true };
      }
      const preciosPorListaNorm = Array.isArray(preciosPorLista)
        ? preciosPorLista
            .map((p) => ({
              idLista: p?.idLista != null ? parseInt(p.idLista, 10) : null,
              precio: p?.precio != null && !Number.isNaN(parseFloat(p.precio)) ? parseFloat(p.precio) : 0
            }))
            .filter((p) => p.idLista != null && !Number.isNaN(p.idLista) && p.precio >= 0)
        : null;
      return productosMutacionesService.crearProductoConTransaccion(pool, {
        datosProducto,
        usarCorrelativo: usarCorrelativo,
        lote,
        precioVenta,
        idListaPrecio,
        preciosPorLista: preciosPorListaNorm,
        idEmpresa
      });
    });
    if (resultado && resultado.__sinUsuario) {
      console.error("crear_producto: no se encontró idUsuario válido para empresa", idEmpresa);
      return res.status(400).send({
        message: "No hay usuario asociado a la empresa para registrar el producto. Contacte al administrador.",
        data: undefined,
      });
    }
    if (resultado.errorLista) {
      return res.status(400).send({ message: "Lista de precios inválida", data: undefined });
    }

    res.status(200).send({ data: resultado.idProducto });
  } catch (error) {
    console.error("crear_producto error:", error.message);
    const msg = error && error.message ? String(error.message) : '';
    const esConflictoCodigo =
      (msg.includes('código') && msg.includes('su empresa')) ||
      msg.includes('CODIGO_PRODUCTO_DUPLICADO') ||
      (error && error.number === 2627);
    res.status(esConflictoCodigo ? 409 : 500).send({
      message: msg || (esConflictoCodigo ? 'Código de producto duplicado.' : 'Error al crear los productos'),
      data: undefined,
    });
  }
};

const actualizar_producto_compra = async function (datosProducto, user) {
  const detalle = datosProducto;
  try {
    await withPool(async (pool) => productosMutacionesService.actualizarProductoCompra(pool, detalle));
    return detalle.idProducto;
  } catch (error) {
    console.error('actualizar_producto_compra:', error);
    throw error;
  }
};

const crear_producto_compra = async (datosProducto, user) => {
  const detalle = datosProducto;
  try {
    await withPool(async (pool) => productosMutacionesService.crearProductoCompra(pool, detalle));
    return detalle.idProducto;
  } catch (error) {
    console.error('crear_producto_compra:', error);
    throw error;
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
    permiteDescripcionEnVenta,
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
    permiteDescripcionEnVenta:
      permiteDescripcionEnVenta === true || permiteDescripcionEnVenta === 1 || permiteDescripcionEnVenta === 'true'
        ? 1
        : permiteDescripcionEnVenta === false || permiteDescripcionEnVenta === 0 || permiteDescripcionEnVenta === 'false'
          ? 0
          : undefined,
    idEmpresa: req.user.empresa,
  };

  try {
    const productos = await withPool(async (pool) => productosMutacionesService.actualizarProducto(pool, detalle));

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

/** PATCH /productos/:id/estado — solo Administrador (misma política que eliminar). */
const actualizar_estado_producto = async function (req, res) {
  const idProducto = req.params.id;
  const idEmpresa = req.user && req.user.empresa;
  const activo = req.body && req.body.activo;

  if (!req.user) {
    return res.status(500).send({ message: 'No Access', data: undefined });
  }
  if (req.user.rol !== 'Administrador') {
    return res.status(403).send({
      message: 'No tiene permisos para cambiar el estado del producto',
      data: undefined,
    });
  }
  if (activo === undefined) {
    return res.status(400).send({ message: 'Envíe { "activo": true|false }', data: undefined });
  }

  try {
    const resultado = await withPool(async (pool) =>
      productosMutacionesService.actualizarEstadoProducto(pool, idProducto, idEmpresa, activo)
    );
    const ra = resultado && resultado.rowsAffected;
    const filas =
      Array.isArray(ra) ? ra.reduce((a, b) => a + (Number(b) || 0), 0) : Number(ra) || 0;
    if (filas === 0) {
      return res.status(404).send({
        message: 'No se encontró el producto en su empresa o no hubo cambios.',
        data: undefined,
      });
    }
    res.status(200).send({ data: resultado.rowsAffected });
  } catch (error) {
    console.error('actualizar_estado_producto:', error);
    res.status(500).send({
      message:
        error && error.message && String(error.message).length < 220
          ? error.message
          : 'Error al actualizar el estado del producto',
      data: undefined,
    });
  }
};

const eliminar_producto = async function (req, res) {
  const idProducto = req.params.id;
  let idEmpresa = req.user.empresa;

  if (req.user) {
    if (req.user.rol == "Administrador") {
      try {
        const productos = await withPool(async (pool) =>
          productosMutacionesService.eliminarProducto(pool, idProducto, idEmpresa)
        );

        res.status(200).send({ data: productos.rowsAffected });
      } catch (error) {
        console.error("eliminar_producto:", error);
        const msg =
          (error && error.message) ||
          "Error al eliminar el producto.";
        const conflicto =
          typeof msg === "string" &&
          (msg.includes("No se puede eliminar") ||
            msg.includes("ventas o compras") ||
            msg.includes("vinculado"));
        res.status(conflicto ? 409 : 500).send({
          message: msg,
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

const obtener_productos_habitacion = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    const items = await withPool(async (pool) =>
      ProductosRepository.obtenerProductosHabitacionRepo(pool, req.user.empresa)
    );
    res.status(200).json({ data: items });
  } catch (error) {
    console.error('productos.obtener_productos_habitacion:', error);
    res.status(500).json({ message: error.message || 'Error al listar productos habitación' });
  }
};

const obtener_stock_ubicaciones_producto = async (req, res) => {
  try {
    const idProducto = req.params.id;
    const idSucursal = req.query && req.query.idSucursal;
    if (!idSucursal || String(idSucursal).trim() === '') {
      return res.status(400).json({ message: 'idSucursal es obligatorio (query)', data: undefined });
    }
    const data = await withPool(async (pool) =>
      ProductosServices.obtenerStockUbicacionesProductoSucursalService(pool, idProducto, idSucursal, req.user)
    );
    res.status(200).json({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).json({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.message === 'PRODUCTO_NO_ENCONTRADO') {
      return res.status(404).json({ message: 'Producto no encontrado', data: undefined });
    }
    if (error.message === 'ID_PRODUCTO_INVALIDO' || error.message === 'ID_SUCURSAL_INVALIDO') {
      return res.status(400).json({ message: 'Identificador inválido', data: undefined });
    }
    if (error.message === 'SUCURSAL_INVALIDA') {
      return res.status(400).json({ message: 'Sucursal no válida para la empresa', data: undefined });
    }
    console.error('obtener_stock_ubicaciones_producto:', error);
    res.status(500).json({ message: 'Error al obtener stock por ubicación', data: undefined });
  }
};

module.exports = {
  obtener_productos_todos,
  buscar_productos_venta,
  obtener_productos_compras,
  obtener_productos_habitacion,
  match_productos_descripcion,
  obtener_stock_ubicaciones_producto,
  obtener_productos_id,
  crear_producto,
  gestionProductos_Compras,
  actualizar_producto,
  actualizar_estado_producto,
  eliminar_producto,
};
