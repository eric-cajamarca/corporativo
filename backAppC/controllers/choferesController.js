const { withPool } = require('../utils/dbPool.util');
const choferesService = require('../services/choferes.service');

// Listar choferes internos registrados (por empresa del token)
const listarChoferes = async (req, res) => {
  try {
    const choferes = await withPool(async (pool) => choferesService.listarChoferesService(pool, req.user));
    return res.status(200).send({ data: choferes });
  } catch (error) {
    if (error.message === 'NO_ACCESS') return res.status(401).send({ message: 'No autorizado', data: undefined });
    console.error('choferesController.listarChoferes:', error);
    return res.status(500).send({ message: error.message || 'Error al listar choferes', data: undefined });
  }
};

// Listar usuarios que tienen rol 'Chofer' (para asignar a un chofer interno)
const listarUsuariosChoferRol = async (req, res) => {
  try {
    const usuarios = await withPool(async (pool) => choferesService.listarUsuariosChoferRolService(pool, req.user));
    return res.status(200).send({ data: usuarios });
  } catch (error) {
    if (error.message === 'NO_ACCESS') return res.status(401).send({ message: 'No autorizado', data: undefined });
    console.error('choferesController.listarUsuariosChoferRol:', error);
    return res.status(500).send({ message: error.message || 'Error al listar usuarios chofer', data: undefined });
  }
};

// Crear o actualizar un registro de chofer interno
// Body: { idUsuarioChofer: string, idVehiculo?: string | null }
const crearOActualizarChofer = async (req, res) => {
  try {
    const { idUsuarioChofer, idVehiculo } = req.body || {};

    if (!idUsuarioChofer) {
      return res.status(400).send({ message: 'idUsuarioChofer es requerido', data: undefined });
    }

    const result = await withPool(async (pool) =>
      choferesService.crearOActualizarChoferService(pool, req.user, {
        idUsuarioChofer,
        idVehiculo: idVehiculo || null
      })
    );

    return res.status(200).send({ message: result?.mensaje || 'Chofer guardado', data: result?.data || null });
  } catch (error) {
    if (error.message === 'NO_ACCESS') return res.status(401).send({ message: 'No autorizado', data: undefined });
    if (error.message === 'NO_PERMISSIONS') return res.status(403).send({ message: 'No tiene permisos', data: undefined });
    console.error('choferesController.crearOActualizarChofer:', error);
    return res.status(500).send({ message: error.message || 'Error al guardar chofer', data: undefined });
  }
};

module.exports = {
  listarChoferes,
  listarUsuariosChoferRol,
  crearOActualizarChofer
};
