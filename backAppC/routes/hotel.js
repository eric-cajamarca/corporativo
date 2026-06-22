const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const hotelController = require('../controllers/hotelController');

api.use(auth.auth);
api.use(requireRubro('HOTEL'));

api.get('/hotel/configuracion', hotelController.obtenerConfiguracion);
api.put('/hotel/configuracion', hotelController.guardarConfiguracion);
api.get('/hotel/estancias/activas', hotelController.listarEstanciasActivas);
api.get('/hotel/disponibilidad', hotelController.consultarDisponibilidad);
api.get('/hotel/calendario', hotelController.listarCalendario);
api.get('/hotel/bloqueos', hotelController.listarBloqueos);
api.post('/hotel/bloqueos', hotelController.crearBloqueo);
api.delete('/hotel/bloqueos/:idBloqueo', hotelController.eliminarBloqueo);
api.post('/hotel/estancias/check-in', hotelController.checkInWalkIn);
api.post('/hotel/reservas/:idReserva/check-in', hotelController.checkInDesdeReserva);
api.post('/hotel/estancias/:idEstancia/check-out', hotelController.checkOutPreload);
api.post('/hotel/estancias/:idEstancia/check-out/confirmar', hotelController.confirmarCheckoutPostVenta);
api.get('/hotel/housekeeping', hotelController.listarHousekeeping);
api.put('/hotel/housekeeping/:idProductoHabitacion', hotelController.actualizarHousekeeping);
api.get('/hotel/anticipos', hotelController.listarAnticipos);
api.post('/hotel/anticipos', hotelController.registrarAnticipo);
api.put('/hotel/anticipos/:idAnticipo/anular', hotelController.anularAnticipo);
api.get('/hotel/reportes', hotelController.reporteHotel);
api.get('/hotel/reportes/historial-habitacion', hotelController.historialHabitacionMes);
api.get('/hotel/estancias/:idEstancia/historial-detalle', hotelController.detalleEstanciaHistorial);
api.put('/hotel/reservas/:idReserva/mover', hotelController.moverReservaCalendario);
api.post('/hotel/cerrar-post-venta', hotelController.cerrarPostVenta);

module.exports = api;
