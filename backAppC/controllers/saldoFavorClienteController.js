const saldoFavorClienteService = require('../services/saldoFavorCliente.service');
const { withPool } = require('../utils/dbPool.util');

function idEmpresa(req) {
  return req.user?.empresa || req.user?.idEmpresa;
}

const obtenerSaldoCliente = async (req, res) => {
  try {
    const idEmp = idEmpresa(req);
    const idCliente = Number(req.params.idCliente);
    if (!idEmp || !Number.isFinite(idCliente)) {
      return res.status(400).json({ message: 'Cliente no válido.' });
    }
    const saldo = await withPool((pool) => saldoFavorClienteService.obtenerSaldo(pool, idEmp, idCliente));
    res.status(200).json({ data: { idCliente, saldo } });
  } catch (error) {
    console.error('obtenerSaldoCliente:', error);
    res.status(500).json({ message: 'Error al obtener saldo a favor.' });
  }
};

const listarMovimientosCliente = async (req, res) => {
  try {
    const idEmp = idEmpresa(req);
    const idCliente = Number(req.params.idCliente);
    const limite = req.query.limite != null ? Number(req.query.limite) : 50;
    if (!idEmp || !Number.isFinite(idCliente)) {
      return res.status(400).json({ message: 'Cliente no válido.' });
    }
    const data = await withPool((pool) =>
      saldoFavorClienteService.listarMovimientos(pool, idEmp, idCliente, limite)
    );
    res.status(200).json({ data });
  } catch (error) {
    console.error('listarMovimientosCliente:', error);
    res.status(500).json({ message: 'Error al listar movimientos de saldo a favor.' });
  }
};

const listarSaldosEmpresa = async (req, res) => {
  try {
    const idEmp = idEmpresa(req);
    if (!idEmp) return res.status(401).json({ message: 'No autorizado.' });
    const data = await withPool((pool) => saldoFavorClienteService.listarSaldosEmpresa(pool, idEmp));
    res.status(200).json({ data });
  } catch (error) {
    console.error('listarSaldosEmpresa:', error);
    res.status(500).json({ message: 'Error al listar saldos a favor.' });
  }
};

/** Solo diagnóstico: no modifica datos. */
const diagnosticarHuerfanos = async (req, res) => {
  try {
    const idEmp = idEmpresa(req);
    if (!idEmp) return res.status(401).json({ message: 'No autorizado.' });
    const data = await withPool((pool) => saldoFavorClienteService.diagnosticarHuerfanos(pool, idEmp));
    res.status(200).json({ data });
  } catch (error) {
    console.error('diagnosticarHuerfanos:', error);
    res.status(500).json({ message: 'Error al diagnosticar créditos huérfanos.' });
  }
};

/** Aplica saneamiento: anula CxC huérfanas y acredita cobros como saldo a favor. */
const sanearHuerfanos = async (req, res) => {
  try {
    const idEmp = idEmpresa(req);
    if (!idEmp) return res.status(401).json({ message: 'No autorizado.' });
    const data = await withPool((pool) =>
      saldoFavorClienteService.sanearCreditosHuerfanos(pool, idEmp, req.user?.sub)
    );
    res.status(200).json({ data, message: 'Saneamiento aplicado.' });
  } catch (error) {
    console.error('sanearHuerfanos:', error);
    res.status(500).json({ message: error.message || 'Error al sanear créditos huérfanos.' });
  }
};

module.exports = {
  obtenerSaldoCliente,
  listarMovimientosCliente,
  listarSaldosEmpresa,
  diagnosticarHuerfanos,
  sanearHuerfanos
};
