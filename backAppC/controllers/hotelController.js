const { withPool } = require('../utils/dbPool.util');
const reservasService = require('../services/reservas.service');

async function cerrarPostVenta(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        await withPool((pool) => reservasService.cerrarPostVenta(pool, req.user.empresa, req.body || {}));
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('hotel.cerrarPostVenta:', error);
        res.status(400).json({ message: error.message || 'Error al cerrar habitación post-venta' });
    }
}

module.exports = { cerrarPostVenta };
