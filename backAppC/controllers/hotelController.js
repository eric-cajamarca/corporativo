const { withPool } = require('../utils/dbPool.util');
const hotelService = require('../services/hotel.service');
const reservasService = require('../services/reservas.service');

async function obtenerConfiguracion(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const data = await withPool((pool) => hotelService.obtenerConfig(pool, req.user.empresa));
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.obtenerConfiguracion:', error);
    res.status(500).json({ message: error.message || 'Error al obtener configuración' });
  }
}

async function guardarConfiguracion(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const body = { ...req.body };
    delete body.idEmpresa;
    const data = await withPool((pool) => hotelService.guardarConfig(pool, req.user.empresa, body));
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.guardarConfiguracion:', error);
    res.status(400).json({ message: error.message || 'Error al guardar configuración' });
  }
}

async function listarEstanciasActivas(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const data = await withPool((pool) => hotelService.listarEstanciasActivas(pool, req.user.empresa));
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.listarEstanciasActivas:', error);
    res.status(500).json({ message: error.message || 'Error al listar estancias' });
  }
}

async function checkInWalkIn(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const body = { ...req.body };
    delete body.idEmpresa;
    const idUsuario = req.user.idUsuario || req.user.id;
    const data = await withPool((pool) =>
      hotelService.checkInWalkIn(pool, req.user.empresa, body, idUsuario)
    );
    res.status(201).json({ data });
  } catch (error) {
    console.error('hotel.checkInWalkIn:', error);
    res.status(400).json({ message: error.message || 'Error en check-in' });
  }
}

async function checkInDesdeReserva(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const body = { ...req.body };
    delete body.idEmpresa;
    const idUsuario = req.user.idUsuario || req.user.id;
    const data = await withPool((pool) =>
      hotelService.checkInDesdeReserva(pool, req.user.empresa, req.params.idReserva, body, idUsuario)
    );
    res.status(201).json({ data });
  } catch (error) {
    console.error('hotel.checkInDesdeReserva:', error);
    res.status(400).json({ message: error.message || 'Error en check-in desde reserva' });
  }
}

async function checkOutPreload(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const data = await withPool((pool) =>
      hotelService.checkOutPreload(pool, req.user.empresa, req.params.idEstancia)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.checkOutPreload:', error);
    res.status(400).json({ message: error.message || 'Error en check-out' });
  }
}

async function confirmarCheckoutPostVenta(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const idVenta = Number(req.body?.idVenta);
    if (!idVenta) return res.status(400).json({ message: 'idVenta requerido' });
    const data = await withPool((pool) =>
      hotelService.confirmarCheckoutPostVenta(pool, req.user.empresa, req.params.idEstancia, idVenta)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.confirmarCheckoutPostVenta:', error);
    res.status(400).json({ message: error.message || 'Error al confirmar check-out' });
  }
}

async function consultarDisponibilidad(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const { idProductoHabitacion, fechaEntrada, fechaSalida } = req.query;
    const data = await withPool((pool) =>
      hotelService.consultarDisponibilidad(
        pool,
        req.user.empresa,
        idProductoHabitacion,
        fechaEntrada,
        fechaSalida
      )
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.consultarDisponibilidad:', error);
    res.status(400).json({ message: error.message || 'Error al consultar disponibilidad' });
  }
}

async function listarCalendario(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const data = await withPool((pool) =>
      hotelService.listarCalendario(pool, req.user.empresa, fechaDesde, fechaHasta)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.listarCalendario:', error);
    res.status(400).json({ message: error.message || 'Error al cargar calendario' });
  }
}

async function listarBloqueos(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const data = await withPool((pool) =>
      hotelService.listarBloqueos(pool, req.user.empresa, fechaDesde, fechaHasta)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.listarBloqueos:', error);
    res.status(400).json({ message: error.message || 'Error al listar bloqueos' });
  }
}

async function crearBloqueo(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const body = { ...req.body };
    delete body.idEmpresa;
    const idUsuario = req.user.idUsuario || req.user.id;
    const data = await withPool((pool) =>
      hotelService.crearBloqueo(pool, req.user.empresa, body, idUsuario)
    );
    res.status(201).json({ data });
  } catch (error) {
    console.error('hotel.crearBloqueo:', error);
    res.status(400).json({ message: error.message || 'Error al crear bloqueo' });
  }
}

async function eliminarBloqueo(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const data = await withPool((pool) =>
      hotelService.eliminarBloqueo(pool, req.user.empresa, req.params.idBloqueo)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.eliminarBloqueo:', error);
    res.status(400).json({ message: error.message || 'Error al eliminar bloqueo' });
  }
}

async function listarHousekeeping(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const data = await withPool((pool) => hotelService.listarHousekeeping(pool, req.user.empresa));
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.listarHousekeeping:', error);
    res.status(500).json({ message: error.message || 'Error al listar housekeeping' });
  }
}

async function actualizarHousekeeping(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const body = { ...req.body };
    delete body.idEmpresa;
    const data = await withPool((pool) =>
      hotelService.actualizarHousekeeping(
        pool,
        req.user.empresa,
        req.params.idProductoHabitacion,
        body
      )
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.actualizarHousekeeping:', error);
    res.status(400).json({ message: error.message || 'Error al actualizar housekeeping' });
  }
}

async function listarAnticipos(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const data = await withPool((pool) =>
      hotelService.listarAnticipos(pool, req.user.empresa, req.query)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.listarAnticipos:', error);
    res.status(400).json({ message: error.message || 'Error al listar anticipos' });
  }
}

async function registrarAnticipo(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const body = { ...req.body };
    delete body.idEmpresa;
    const idUsuario = req.user.idUsuario || req.user.id;
    const data = await withPool((pool) =>
      hotelService.registrarAnticipo(pool, req.user.empresa, body, idUsuario)
    );
    res.status(201).json({ data });
  } catch (error) {
    console.error('hotel.registrarAnticipo:', error);
    res.status(400).json({ message: error.message || 'Error al registrar anticipo' });
  }
}

async function anularAnticipo(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const data = await withPool((pool) =>
      hotelService.anularAnticipo(pool, req.user.empresa, req.params.idAnticipo)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.anularAnticipo:', error);
    res.status(400).json({ message: error.message || 'Error al anular anticipo' });
  }
}

async function reporteHotel(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const data = await withPool((pool) =>
      hotelService.reporteHotel(pool, req.user.empresa, fechaDesde, fechaHasta)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.reporteHotel:', error);
    res.status(400).json({ message: error.message || 'Error al generar reporte' });
  }
}

async function historialHabitacionMes(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const { idProductoHabitacion, mes } = req.query;
    const data = await withPool((pool) =>
      hotelService.historialHabitacionMes(pool, req.user.empresa, idProductoHabitacion, mes)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.historialHabitacionMes:', error);
    res.status(400).json({ message: error.message || 'Error al cargar historial' });
  }
}

async function detalleEstanciaHistorial(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const data = await withPool((pool) =>
      hotelService.detalleEstanciaHistorial(pool, req.user.empresa, req.params.idEstancia)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.detalleEstanciaHistorial:', error);
    res.status(400).json({ message: error.message || 'Error al cargar detalle de estancia' });
  }
}

async function moverReservaCalendario(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    const body = { ...req.body };
    delete body.idEmpresa;
    const data = await withPool((pool) =>
      hotelService.moverReservaCalendario(pool, req.user.empresa, req.params.idReserva, body)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('hotel.moverReservaCalendario:', error);
    res.status(400).json({ message: error.message || 'Error al mover reserva' });
  }
}

/** Compatibilidad con flujo MVP anterior (reserva post-venta). */
async function cerrarPostVenta(req, res) {
  if (!req.user?.empresa) return res.status(401).json({ message: 'No autorizado' });
  try {
    await withPool((pool) => reservasService.cerrarPostVenta(pool, req.user.empresa, req.body || {}));
    res.status(200).json({ data: { ok: true } });
  } catch (error) {
    console.error('hotel.cerrarPostVenta:', error);
    res.status(400).json({ message: error.message || 'Error al cerrar habitación post-venta' });
  }
}

module.exports = {
  obtenerConfiguracion,
  guardarConfiguracion,
  listarEstanciasActivas,
  checkInWalkIn,
  checkInDesdeReserva,
  checkOutPreload,
  confirmarCheckoutPostVenta,
  consultarDisponibilidad,
  listarCalendario,
  listarBloqueos,
  crearBloqueo,
  eliminarBloqueo,
  listarHousekeeping,
  actualizarHousekeeping,
  listarAnticipos,
  registrarAnticipo,
  anularAnticipo,
  reporteHotel,
  historialHabitacionMes,
  detalleEstanciaHistorial,
  moverReservaCalendario,
  cerrarPostVenta
};
