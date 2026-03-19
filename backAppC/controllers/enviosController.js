const dbConfig = require('../dbconfig');
const sql = require('mssql');
const EnviosServices = require('../services/envios.service');

// Obtener envíos programados (listado para pantalla Envios programados)
const obtenerEnviosProgramados = async (req, res) => {
  try {
    const { idEstadoEnvio, fechaDesde, fechaHasta, ruc, cliente } = req.query;
    const filtros = {};
    if (idEstadoEnvio != null && String(idEstadoEnvio).trim() !== "") filtros.idEstadoEnvio = idEstadoEnvio;
    if (fechaDesde != null && String(fechaDesde).trim() !== "") filtros.fechaDesde = fechaDesde;
    if (fechaHasta != null && String(fechaHasta).trim() !== "") filtros.fechaHasta = fechaHasta;
    if (ruc != null && String(ruc).trim() !== "") filtros.ruc = ruc;
    if (cliente != null && String(cliente).trim() !== "") filtros.cliente = cliente;

    const pool = await sql.connect(dbConfig);
    const envios = await EnviosServices.obtenerEnviosProgramadosService(pool, req.user, filtros);
    return res.status(200).send({ data: envios });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'No tiene permisos', data: undefined });
    }
    console.error('Error obtener envíos programados:', error);
    return res.status(500).send({ message: error.message || 'Error al obtener envíos programados', data: undefined });
  }
};

// Obtener detalle de un envío (productos desde DetalleDespachos o DetalleVenta)
const obtenerDetalleEnvio = async (req, res) => {
  try {
    const { idEnvio } = req.params;
    const pool = await sql.connect(dbConfig);
    const detalle = await EnviosServices.obtenerDetalleEnvioService(pool, req.user, idEnvio);
    return res.status(200).send({ data: detalle });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "No tiene permisos", data: undefined });
    }
    if (error.message === "ENVIO_NO_ENCONTRADO") {
      return res.status(404).send({ message: "Envío no encontrado", data: undefined });
    }
    console.error("Error obtener detalle envío:", error);
    return res.status(500).send({ message: error.message || "Error al obtener detalle", data: undefined });
  }
};

// Obtener envíos por venta
const obtenerEnviosVenta = async (req, res) => {
  try {
    const { idVenta } = req.params;

    const pool = await sql.connect(dbConfig);
    const envios = await EnviosServices.obtenerEnviosVentaService(pool, req.user, idVenta);

    res.status(200).send({ data: envios });
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
    console.error("Error obtener envíos venta:", error);
    res.status(500).send({
      message: "Error al obtener los envíos de la venta",
      data: undefined
    });
  }
};

// Crear envío
const crearEnvio = async (req, res) => {
  try {
    const {
      idVenta,
      idDespacho,
      idTipoEnvio,
      idTransportista,
      idChofer,
      idVehiculoEntrega,
      idEstadoEnvioInicial,
      costoEnvio,
      direccionEntrega,
      referencia,
      coordenadas,
      contactoDestinatario,
      telefonoDestinatario,
      fechaProgramada,
      observaciones
    } = req.body;

    // Validación básica
    if (!idVenta || !idTipoEnvio || !direccionEntrega) {
      return res.status(400).send({
        message: "Datos inválidos: idVenta, idTipoEnvio y direccionEntrega son requeridos",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await EnviosServices.crearEnvioService(pool, req.user, {
      idVenta,
      idDespacho,
      idTipoEnvio,
      idTransportista,
      idChofer,
      idVehiculoEntrega,
      idEstadoEnvioInicial,
      costoEnvio: costoEnvio || 0,
      direccionEntrega,
      referencia,
      coordenadas,
      contactoDestinatario,
      telefonoDestinatario,
      fechaProgramada,
      observaciones
    });

    res.status(200).send({
      message: "Envío creado exitosamente",
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
    if (error.message === "VENTA_NO_ENCONTRADA") {
      return res.status(404).send({
        message: "Venta no encontrada",
        data: undefined
      });
    }
    if (error.message === "SUCURSAL_NO_DEFINIDA") {
      return res.status(400).send({
        message: "No se pudo determinar la sucursal para el envío (la venta no tiene sucursal y la empresa no tiene sucursales).",
        data: undefined
      });
    }
    console.error("Error crear envío:", error);
    res.status(500).send({
      message: "Error al crear el envío",
      data: undefined
    });
  }
};

// Obtener envíos asignados al chofer interno (rol Chofer)
const obtenerEnviosMisChoferes = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const envios = await EnviosServices.obtenerEnviosMisChoferesService(pool, req.user);
    return res.status(200).send({ data: envios });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'No tiene permisos', data: undefined });
    }
    console.error('Error obtenerEnviosMisChoferes:', error);
    return res.status(500).send({ message: error.message || 'Error al obtener mis envíos', data: undefined });
  }
};

// Actualizar envío (fecha, dirección, chofer, etc.)
const actualizarEnvio = async (req, res) => {
  try {
    const { idEnvio } = req.params;
    const { fechaProgramada, direccionEntrega, idChofer, idTransportista, contactoDestinatario, telefonoDestinatario, observaciones } = req.body;

    const pool = await sql.connect(dbConfig);
    const result = await EnviosServices.actualizarEnvioService(pool, req.user, {
      idEnvio,
      fechaProgramada,
      direccionEntrega,
      idChofer,
      idTransportista,
      contactoDestinatario,
      telefonoDestinatario,
      observaciones
    });

    res.status(200).send({ message: result.mensaje, data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "No tiene permisos", data: undefined });
    }
    if (error.message === "ENVIO_NO_ENCONTRADO") {
      return res.status(404).send({ message: "Envío no encontrado", data: undefined });
    }
    console.error("Error actualizar envío:", error);
    res.status(500).send({ message: error.message || "Error al actualizar envío", data: undefined });
  }
};

// Eliminar envío
const eliminarEnvio = async (req, res) => {
  try {
    const { idEnvio } = req.params;
    const pool = await sql.connect(dbConfig);
    const result = await EnviosServices.eliminarEnvioService(pool, req.user, idEnvio);
    res.status(200).send({ message: result.mensaje, data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "No tiene permisos", data: undefined });
    }
    if (error.message === "ENVIO_NO_ENCONTRADO") {
      return res.status(404).send({ message: "Envío no encontrado", data: undefined });
    }
    console.error("Error eliminar envío:", error);
    res.status(500).send({ message: error.message || "Error al eliminar envío", data: undefined });
  }
};

// Actualizar estado de envío
const actualizarEstadoEnvio = async (req, res) => {
  try {
    const { idEnvio } = req.params;
    const { idEstadoEnvio, observaciones, evidenciaFoto } = req.body;

    // Validación básica
    if (!idEstadoEnvio) {
      return res.status(400).send({
        message: "El idEstadoEnvio es requerido",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await EnviosServices.actualizarEstadoEnvioService(pool, req.user, {
      idEnvio,
      idEstadoEnvio,
      observaciones,
      evidenciaFoto
    });

    res.status(200).send({
      message: "Estado del envío actualizado exitosamente",
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
    if (error.message === "ENVIO_NO_ENCONTRADO") {
      return res.status(404).send({
        message: "Envío no encontrado",
        data: undefined
      });
    }
    console.error("Error actualizar estado envío:", error);
    res.status(500).send({
      message: "Error al actualizar el estado del envío",
      data: undefined
    });
  }
};

// Asignar transportista
const asignarTransportista = async (req, res) => {
  try {
    const { idEnvio } = req.params;
    const { idTransportista } = req.body;

    // Validación básica
    if (!idTransportista) {
      return res.status(400).send({
        message: "El idTransportista es requerido",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await EnviosServices.asignarTransportistaService(pool, req.user, {
      idEnvio,
      idTransportista
    });

    res.status(200).send({
      message: "Transportista asignado exitosamente",
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
    console.error("Error asignar transportista:", error);
    res.status(500).send({
      message: "Error al asignar el transportista",
      data: undefined
    });
  }
};

// Obtener transportistas disponibles
const obtenerTransportistas = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const transportistas = await EnviosServices.obtenerTransportistasService(pool, req.user);

    res.status(200).send({ data: transportistas });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener transportistas:", error);
    res.status(500).send({
      message: "Error al obtener los transportistas",
      data: undefined
    });
  }
};

// Crear transportista (delivery externo)
const crearTransportista = async (req, res) => {
  try {
    const {
      nombres,
      apellidos,
      documento,
      licencia,
      celular,
      email,
      vehiculo,
      placa
    } = req.body || {};

    if (!nombres || !apellidos || !documento || !celular) {
      return res.status(400).send({
        message: "Datos inválidos: nombres, apellidos, documento y celular son requeridos",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await EnviosServices.crearTransportistaService(pool, req.user, {
      nombres,
      apellidos,
      documento,
      licencia: licencia || null,
      celular,
      email: email || null,
      vehiculo: vehiculo || null,
      placa: placa || null
    });

    return res.status(200).send({ message: "Transportista registrado", data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "No tiene permisos", data: undefined });
    }
    if (error.message === "TRANSPORTISTA_YA_EXISTE") {
      return res.status(409).send({ message: "Transportista ya existe para esta empresa", data: undefined });
    }
    console.error("Error crearTransportista:", error);
    return res.status(500).send({ message: error.message || "Error al registrar transportista", data: undefined });
  }
};

// Obtener tipos de envío
const obtenerTiposEnvio = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const tipos = await EnviosServices.obtenerTiposEnvioService(pool, req.user);
    res.status(200).send({ data: tipos });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener tipos envío:", error);
    res.status(500).send({
      message: "Error al obtener los tipos de envío",
      data: undefined
    });
  }
};

// Obtener estados de envío
const obtenerEstadosEnvio = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const estados = await EnviosServices.obtenerEstadosEnvioService(pool, req.user);
    res.status(200).send({ data: estados });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener estados envío:", error);
    res.status(500).send({
      message: "Error al obtener los estados de envío",
      data: undefined
    });
  }
};

// Obtener envíos por estado
const obtenerEnviosPorEstado = async (req, res) => {
  try {
    const { estado } = req.query;

    const pool = await sql.connect(dbConfig);
    const envios = await EnviosServices.obtenerEnviosPorEstadoService(pool, req.user, estado);

    res.status(200).send({ data: envios });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener envíos por estado:", error);
    res.status(500).send({
      message: "Error al obtener los envíos por estado",
      data: undefined
    });
  }
};

// Obtener envíos por transportista
const obtenerEnviosPorTransportista = async (req, res) => {
  try {
    const { idTransportista } = req.params;

    const pool = await sql.connect(dbConfig);
    const envios = await EnviosServices.obtenerEnviosPorTransportistaService(pool, req.user, idTransportista);

    res.status(200).send({ data: envios });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener envíos por transportista:", error);
    res.status(500).send({
      message: "Error al obtener los envíos por transportista",
      data: undefined
    });
  }
};

module.exports = {
  obtenerEnviosProgramados,
  obtenerDetalleEnvio,
  obtenerEnviosVenta,
  crearEnvio,
  actualizarEnvio,
  eliminarEnvio,
  actualizarEstadoEnvio,
  asignarTransportista,
  obtenerTransportistas,
  crearTransportista,
  obtenerTiposEnvio,
  obtenerEstadosEnvio,
  obtenerEnviosPorEstado,
  obtenerEnviosPorTransportista,
  obtenerEnviosMisChoferes
};