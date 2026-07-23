const { withPool } = require('../utils/dbPool.util');
const cuentasBancariasService = require('../services/cuentasBancarias.service');

const listar = async (req, res) => {
  try {
    const data = await withPool((pool) => cuentasBancariasService.listar(pool, req.user));
    return res.status(200).json({ data });
  } catch (error) {
    if (error.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    console.error('cuentasBancarias.listar:', error);
    return res.status(500).json({ message: 'Error al listar cuentas bancarias' });
  }
};

const crear = async (req, res) => {
  try {
    const data = await withPool((pool) => cuentasBancariasService.crear(pool, req.user, req.body || {}));
    return res.status(201).json({ data, message: 'Cuenta bancaria creada' });
  } catch (error) {
    if (error.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    if (
      error.message === 'BANCO_REQUERIDO' ||
      error.message === 'NUMERO_CUENTA_REQUERIDO' ||
      error.message === 'TIPO_CUENTA_REQUERIDO' ||
      error.message === 'MONEDA_INVALIDA' ||
      error.message === 'FECHA_APERTURA_INVALIDA' ||
      error.message === 'CCI_INVALIDO'
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('cuentasBancarias.crear:', error);
    return res.status(500).json({ message: 'Error al crear cuenta bancaria' });
  }
};

const actualizar = async (req, res) => {
  try {
    const data = await withPool((pool) =>
      cuentasBancariasService.actualizar(pool, req.user, req.params.id, req.body || {})
    );
    return res.status(200).json({ data, message: 'Cuenta bancaria actualizada' });
  } catch (error) {
    if (error.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    if (error.message === 'NO_ENCONTRADO' || error.message === 'ID_REQUERIDO') {
      return res.status(404).json({ message: 'Cuenta bancaria no encontrada' });
    }
    if (
      error.message === 'BANCO_REQUERIDO' ||
      error.message === 'NUMERO_CUENTA_REQUERIDO' ||
      error.message === 'TIPO_CUENTA_REQUERIDO' ||
      error.message === 'MONEDA_INVALIDA' ||
      error.message === 'CCI_INVALIDO'
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('cuentasBancarias.actualizar:', error);
    return res.status(500).json({ message: 'Error al actualizar cuenta bancaria' });
  }
};

const eliminar = async (req, res) => {
  try {
    const data = await withPool((pool) =>
      cuentasBancariasService.eliminar(pool, req.user, req.params.id)
    );
    return res.status(200).json({ data, message: 'Cuenta bancaria desactivada' });
  } catch (error) {
    if (error.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    if (error.message === 'NO_ENCONTRADO' || error.message === 'ID_REQUERIDO') {
      return res.status(404).json({ message: 'Cuenta bancaria no encontrada' });
    }
    console.error('cuentasBancarias.eliminar:', error);
    return res.status(500).json({ message: 'Error al desactivar cuenta bancaria' });
  }
};

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar
};
