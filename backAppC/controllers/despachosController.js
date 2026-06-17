const { withPool } = require('../utils/dbPool.util');
const DespachosServices = require('../services/despachos.service');
const auditoriaOperaciones = require('../services/auditoriaOperaciones.service');

// Obtener despachos por venta
const obtenerDespachosVenta = async (req, res) => {
  try {
    const { idVenta } = req.params;

    const despachos = await withPool(async (pool) =>
      DespachosServices.obtenerDespachosVentaService(pool, req.user, idVenta, req.query)
    );

    res.status(200).send({ data: despachos });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    console.error("Error obtener despachos venta:", error);
    res.status(500).send({
      message: "Error al obtener los despachos de la venta",
      data: undefined
    });
  }
};

// Crear despacho. Opcional: detalles = [{ idDetalle, idProducto, cantidadADespachar }] para fijar cant. por línea.
const crearDespacho = async (req, res) => {
  try {
    const {
      idVenta,
      idTipoDespacho,
      observaciones,
      detalles,
      idEmpresa,
      mercaderiaPendienteDeCarga,
      fechaDespacho
    } = req.body;

    // Validación básica
    if (!idVenta || !idTipoDespacho) {
      return res.status(400).send({
        message: "Datos inválidos: idVenta e idTipoDespacho son requeridos",
        data: undefined
      });
    }

    const idEmpresaOperativa =
      idEmpresa != null && String(idEmpresa).trim() !== ''
        ? String(idEmpresa).trim()
        : undefined;
    const result = await withPool(async (pool) =>
      DespachosServices.crearDespachoService(pool, req.user, {
        idVenta,
        idTipoDespacho,
        observaciones,
        detalles: Array.isArray(detalles) ? detalles : undefined,
        ...(idEmpresaOperativa ? { idEmpresa: idEmpresaOperativa } : {}),
        ...(mercaderiaPendienteDeCarga === true ? { mercaderiaPendienteDeCarga: true } : {}),
        fechaDespacho
      })
    );

    auditoriaOperaciones.auditarDespacho(req, result?.idDespacho, idVenta, null);

    res.status(200).send({
      message: "Despacho creado exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción o para operar en esta empresa",
        data: undefined
      });
    }
    if (error.message === "VENTA_NO_ENCONTRADA") {
      return res.status(404).send({
        message: "Venta no encontrada",
        data: undefined
      });
    }
    console.error("Error crear despacho:", error);
    res.status(500).send({
      message: "Error al crear el despacho",
      data: undefined
    });
  }
};

// Actualizar cantidad despachada de un producto
const actualizarCantidadDespachada = async (req, res) => {
  try {
    const { idDetalleDespacho } = req.params;
    const { cantidadDespachada, ubicacionOrigen, ubicacionDestino, fechaDespacho } = req.body;

    // Validación básica
    if (cantidadDespachada === undefined || cantidadDespachada < 0) {
      return res.status(400).send({
        message: "La cantidad despachada debe ser mayor o igual a cero",
        data: undefined
      });
    }

    const result = await withPool(async (pool) =>
      DespachosServices.actualizarCantidadDespachadaService(pool, req.user, {
        idDetalleDespacho,
        cantidadDespachada,
        ubicacionOrigen,
        ubicacionDestino,
        fechaDespacho
      })
    );

    res.status(200).send({
      message: "Cantidad despachada actualizada exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    if (error.message === "DETALLE_NO_ENCONTRADO") {
      return res.status(404).send({
        message: "Detalle de despacho no encontrado",
        data: undefined
      });
    }
    console.error("Error actualizar cantidad despachada:", error);
    res.status(500).send({
      message: "Error al actualizar la cantidad despachada",
      data: undefined
    });
  }
};

// Registrar cantidades de varias líneas del mismo despacho (almacén)
const registrarCantidadesDespachoBatch = async (req, res) => {
  try {
    const { idDespacho } = req.params;
    const { items, fechaDespacho } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).send({
        message: "Debe enviar al menos una línea con cantidades (items).",
        data: undefined
      });
    }

    const result = await withPool(async (pool) =>
      DespachosServices.actualizarCantidadesDespachoBatchService(pool, req.user, idDespacho, items, fechaDespacho)
    );

    res.status(200).send({
      message: "Cantidades registradas correctamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    if (error.message === "DESPACHO_NO_ENCONTRADO" || error.message === "DETALLE_NO_ENCONTRADO") {
      return res.status(404).send({
        message: "Despacho o detalle no encontrado",
        data: undefined
      });
    }
    if (error.message === "ITEMS_VACIOS" || error.message === "CANTIDAD_INVALIDA") {
      return res.status(400).send({
        message:
          error.message === "CANTIDAD_INVALIDA"
            ? "Alguna cantidad es inválida (debe estar entre 0 y la solicitada en cada línea)."
            : "Lista de líneas vacía.",
        data: undefined
      });
    }
    console.error("Error registrar cantidades despacho batch:", error);
    res.status(500).send({
      message: "Error al registrar las cantidades",
      data: undefined
    });
  }
};

// Finalizar despacho
const finalizarDespacho = async (req, res) => {
  try {
    const { idDespacho } = req.params;

    const result = await withPool(async (pool) =>
      DespachosServices.finalizarDespachoService(pool, req.user, idDespacho)
    );

    res.status(200).send({
      message: "Despacho finalizado exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    if (error.message === "DESPACHO_NO_ENCONTRADO") {
      return res.status(404).send({
        message: "Despacho no encontrado",
        data: undefined
      });
    }
    console.error("Error finalizar despacho:", error);
    res.status(500).send({
      message: "Error al finalizar el despacho",
      data: undefined
    });
  }
};

// Obtener tipos de despacho
const obtenerTiposDespacho = async (req, res) => {
  try {
    const tipos = await withPool(async (pool) =>
      DespachosServices.obtenerTiposDespachoService(pool, req.user)
    );
    res.status(200).send({ data: tipos });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener tipos despacho:", error);
    res.status(500).send({
      message: "Error al obtener los tipos de despacho",
      data: undefined
    });
  }
};

// Obtener estado de despachos
const obtenerEstadoDespachos = async (req, res) => {
  try {
    const estado = await withPool(async (pool) =>
      DespachosServices.obtenerEstadoDespachosService(pool, req.user)
    );
    res.status(200).send({ data: estado });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener estado despachos:", error);
    res.status(500).send({
      message: "Error al obtener el estado de despachos",
      data: undefined
    });
  }
};

// Buscar venta por número comprobante o idVenta; devuelve venta + despachos + entregadoMismoDia
const buscarVentaDespachos = async (req, res) => {
  try {
    const resultado = await withPool(async (pool) =>
      DespachosServices.buscarVentaDespachosService(pool, req.user, req.query)
    );
    if (!resultado) {
      return res.status(404).send({ message: "Venta no encontrada", data: null });
    }
    res.status(200).send({ message: "OK", data: resultado });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "Sin permiso para esta empresa", data: undefined });
    }
    console.error("Error buscar venta despachos:", error);
    res.status(500).send({ message: "Error al buscar", data: undefined });
  }
};

const buscarVentaAgrupadaDespachoGestora = async (req, res) => {
  try {
    const resultado = await withPool(async (pool) =>
      DespachosServices.buscarVentaAgrupadaDespachoGestoraService(pool, req.user, req.query)
    );
    if (!resultado) {
      return res.status(404).send({ message: "Sin coincidencias", data: null });
    }
    res.status(200).send({ message: "OK", data: resultado });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "Sin permisos", data: undefined });
    }
    if (error.message === "NO_ES_GESTORA") {
      return res.status(403).send({ message: "Solo disponible para empresa gestora", data: undefined });
    }
    if (error.message === "FILTROS_REQUERIDOS") {
      return res.status(400).send({
        message: "Indique id o número de venta agrupada, RUC o nombre de cliente",
        data: undefined
      });
    }
    console.error("Error buscar VA despachos:", error);
    res.status(500).send({ message: "Error al buscar venta agrupada", data: undefined });
  }
};

// Obtener detalle de un despacho (líneas DetalleDespachos)
const obtenerDetalleDespacho = async (req, res) => {
  try {
    const { idDespacho } = req.params;
    const detalle = await withPool(async (pool) =>
      DespachosServices.obtenerDetalleDespachoService(pool, req.user, idDespacho)
    );
    res.status(200).send({ data: detalle });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener detalle despacho:", error);
    res.status(500).send({ message: "Error al obtener detalle", data: undefined });
  }
};

module.exports = {
  obtenerDespachosVenta,
  crearDespacho,
  actualizarCantidadDespachada,
  registrarCantidadesDespachoBatch,
  finalizarDespacho,
  obtenerTiposDespacho,
  obtenerEstadoDespachos,
  buscarVentaDespachos,
  buscarVentaAgrupadaDespachoGestora,
  obtenerDetalleDespacho
};
