const express = require('express');
const api = express.Router();

const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const { parsearOrderNumber, esOrderNumberCheckout } = require('../services/integraciones.service');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const empresaSuscripcionBootstrap = require('../services/empresaSuscripcionBootstrap.service');

/**
 * Webhooks multiempresa: identifican pago por orderNumber (patrón idEmpresa-uuid o CHK-uuid para checkout público).
 */

/**
 * Webhook Izipay. Campos soportados: order_number|orderNumber, status|transactionStatus|payment_status|result, transactionId|id.
 */
api.post('/webhooks/izipay', async (req, res) => {
  try {
    const payload = req.body || {};
    const orderNumber = payload.order_number || payload.orderNumber || payload.merchant_order_id || null;
    if (!orderNumber) {
      return res.status(400).json({ message: 'order_number requerido' });
    }

    const estadoPasarela = String(payload.status || payload.transactionStatus || payload.payment_status || payload.result || '').toUpperCase();
    let nuevoEstado = 'PENDIENTE';
    if (estadoPasarela.includes('CAPTURE') || estadoPasarela.includes('PAID') || estadoPasarela.includes('SUCCESS') || estadoPasarela.includes('COMPLETED')) nuevoEstado = 'PAGADO';
    else if (estadoPasarela.includes('FAIL') || estadoPasarela.includes('DECLIN') || estadoPasarela.includes('CANCEL') || estadoPasarela.includes('REJECTED')) nuevoEstado = 'FALLIDO';

    const idTransaccion = String(payload.transactionId || payload.transaction_id || payload.id || payload.reference || '');
    await withPool(async (pool) => {
      if (esOrderNumberCheckout(orderNumber)) {
        await suscripcionCheckoutRepository.actualizarEstadoPago(pool, orderNumber, nuevoEstado, idTransaccion);
        if (nuevoEstado === 'PAGADO') {
          await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, orderNumber, null);
        }
        return res.status(200).json({ ok: true });
      }

      const parsed = parsearOrderNumber(orderNumber);
      if (!parsed) {
        return res.status(400).json({ message: 'order_number inválido' });
      }

      await pool.request()
        .input('orderNumber', sql.VarChar(100), orderNumber)
        .input('estado', sql.VarChar(20), nuevoEstado)
        .input('idTransaccion', sql.VarChar(100), idTransaccion)
        .query(`
        UPDATE PagosSuscripcionEmpresa
        SET estado = @estado,
            idTransaccionPasarela = CASE WHEN @idTransaccion <> '' THEN @idTransaccion ELSE idTransaccionPasarela END,
            fConfirmacion = GETDATE()
        WHERE orderNumber = @orderNumber
      `);

      res.status(200).json({ ok: true });
    });
  } catch (error) {
    console.error('Webhook Izipay error:', error);
    res.status(500).json({ ok: false });
  }
});

/**
 * Webhook Culqi. Eventos tipo charge.paid, charge.failed, etc. order_number en data.object o en metadata.
 * Producción: exponer solo tras proxy y validar firma Culqi (requiere capturar rawBody en middleware dedicado).
 */
api.post('/webhooks/culqi', async (req, res) => {
  try {
    const event = req.body || {};
    const obj = (event.data && event.data.object) ? event.data.object : event;
    const orderNumber = obj.order_number || obj.orderNumber || (obj.metadata && obj.metadata.order_number) || null;
    if (!orderNumber) {
      return res.status(400).json({ message: 'order_number requerido' });
    }

    const tipo = (event.type || obj.status || '').toString().toLowerCase();
    let nuevoEstado = 'PENDIENTE';
    if (tipo.includes('paid') || tipo.includes('succeeded') || tipo.includes('success')) nuevoEstado = 'PAGADO';
    else if (tipo.includes('failed') || tipo.includes('declined') || tipo.includes('rejected')) nuevoEstado = 'FALLIDO';

    const idTransaccion = String(obj.id || event.id || event.data?.id || '');
    await withPool(async (pool) => {
      if (esOrderNumberCheckout(orderNumber)) {
        await suscripcionCheckoutRepository.actualizarEstadoPago(pool, orderNumber, nuevoEstado, idTransaccion);
        if (nuevoEstado === 'PAGADO') {
          await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, orderNumber, null);
        }
        return res.status(200).json({ ok: true });
      }

      const parsed = parsearOrderNumber(orderNumber);
      if (!parsed) {
        return res.status(400).json({ message: 'order_number inválido' });
      }

      await pool.request()
        .input('orderNumber', sql.VarChar(100), orderNumber)
        .input('estado', sql.VarChar(20), nuevoEstado)
        .input('idTransaccion', sql.VarChar(100), idTransaccion)
        .query(`
        UPDATE PagosSuscripcionEmpresa
        SET estado = @estado,
            idTransaccionPasarela = CASE WHEN @idTransaccion <> '' THEN @idTransaccion ELSE idTransaccionPasarela END,
            fConfirmacion = GETDATE()
        WHERE orderNumber = @orderNumber
      `);

      res.status(200).json({ ok: true });
    });
  } catch (error) {
    console.error('Webhook Culqi error:', error);
    res.status(500).json({ ok: false });
  }
});

module.exports = api;
