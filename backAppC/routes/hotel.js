const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const hotelController = require('../controllers/hotelController');

// Solo rutas /hotel/* (no aplicar a todo /api: bloqueaba suscripcion/mi-estado en rubro GEN)
api.use('/hotel', auth.auth);
api.use('/hotel', requireRubro('HOTEL'));

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
api.get('/hotel/estancias/:idEstancia/folio', hotelController.folioEstancia);
api.get('/hotel/reportes', hotelController.reporteHotel);
api.get('/hotel/reportes/historial-habitacion', hotelController.historialHabitacionMes);
api.get('/hotel/estancias/:idEstancia/historial-detalle', hotelController.detalleEstanciaHistorial);
api.put('/hotel/estancias/:idEstancia/salida', hotelController.cambiarSalidaEstancia);
api.put('/hotel/estancias/:idEstancia/habitacion', hotelController.moverEstancia);
api.put('/hotel/reservas/:idReserva/mover', hotelController.moverReservaCalendario);
api.get('/hotel/grupos', hotelController.listarGrupos);
api.post('/hotel/grupos', hotelController.crearGrupo);
api.get('/hotel/grupos/:idGrupo', hotelController.obtenerGrupo);
api.post('/hotel/grupos/:idGrupo/facturar-hospedaje', hotelController.facturarHospedajeGrupoPreload);
api.post('/hotel/grupos/:idGrupo/facturar-hospedaje/confirmar', hotelController.confirmarFacturaHospedajeGrupo);
api.post('/hotel/estancias/:idEstancia/salida-operativa', hotelController.salidaOperativaEstancia);
api.post('/hotel/cerrar-post-venta', hotelController.cerrarPostVenta);

module.exports = api;
