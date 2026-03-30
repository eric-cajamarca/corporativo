import { test, expect } from '@playwright/test';
import {
  loginGestora,
  postJson,
  getJson,
  hoyRangoFechasLima,
  esCobroVaConcepto,
} from './helpers/api-gestora';

/**
 * Flujo crítico: login API (gestora) → VA pendiente → (opcional) cobro → movimientos "Cobro VA" por empresa.
 * Requiere: backAppC + SQL, cajas abiertas en gestora y en cada empresa con comprobante hijo,
 * y al menos una VentaAgrupada con idEstadoPago=1 (o definir E2E_ID_VENTA_AGRUPADA).
 *
 * E2E_DRY_RUN=1 — no hace POST cobrar; solo valida pendientes y formas de pago.
 */
test.describe('Gestora: VA pendiente, cobro y caja', () => {
  test('login, listar VA pendiente, cobrar y ver movimientos por empresa', async ({ request }) => {
    test.skip(
      !process.env.E2E_GESTORA_RUC?.trim() ||
        !process.env.E2E_GESTORA_EMAIL?.trim() ||
        !process.env.E2E_GESTORA_PASSWORD?.trim(),
      'Configure e2e/.env con E2E_GESTORA_RUC, E2E_GESTORA_EMAIL y E2E_GESTORA_PASSWORD'
    );

    const dry = process.env.E2E_DRY_RUN === '1';

    await loginGestora(request);

    const pendRes = await getJson(request, '/api/ventas/agrupadas/pendientes-pago');
    expect(pendRes.ok(), await pendRes.text()).toBeTruthy();
    const pendBody = (await pendRes.json()) as { data?: Array<{ idVentaAgrupada: string; total: number }> };
    const lista = pendBody.data || [];

    const forzada = process.env.E2E_ID_VENTA_AGRUPADA?.trim();
    let va = forzada
      ? lista.find((x) => String(x.idVentaAgrupada).toLowerCase() === forzada.toLowerCase())
      : lista[0];

    if (!va && forzada) {
      test.skip(true, `No hay pendiente con E2E_ID_VENTA_AGRUPADA=${forzada} en el listado actual`);
    }
    if (!va) {
      test.skip(true, 'No hay ventas agrupadas pendientes de pago. Cree una VA corporativa sin cobrar.');
    }

    const idVa = va.idVentaAgrupada;
    const total = Number(va.total) || 0;
    expect(total).toBeGreaterThan(0);

    const detRes = await getJson(request, `/api/ventas/agrupadas/${idVa}/detalle`);
    expect(detRes.ok(), await detRes.text()).toBeTruthy();
    const detalle = (await detRes.json()) as { data?: Array<{ idEmpresa: string }> };
    const filas = detalle.data || [];
    const idsEmpresaLineas = [...new Set(filas.map((r) => String(r.idEmpresa)).filter(Boolean))];
    expect(idsEmpresaLineas.length).toBeGreaterThan(0);

    const formasRes = await getJson(request, '/api/formaPago');
    expect(formasRes.ok(), await formasRes.text()).toBeTruthy();
    const formasBody = (await formasRes.json()) as { data?: Array<{ idFormaPago: number; descripcion?: string }> };
    const formas = formasBody.data || [];
    const efectivo = formas.find((f) => (f.descripcion || '').toUpperCase().includes('EFECTIVO'));
    const idMedios = efectivo?.idFormaPago ?? formas[0]?.idFormaPago;
    expect(idMedios, 'Se necesita al menos una forma de pago').toBeTruthy();

    const cajasRes = await getJson(request, '/api/caja/cajas');
    expect(cajasRes.ok(), await cajasRes.text()).toBeTruthy();
    const cajasBody = (await cajasRes.json()) as {
      data?: Array<{ cajaAbierta?: boolean; idApertura?: string }>;
    };
    const abiertas = (cajasBody.data || []).filter((c) => c.cajaAbierta && c.idApertura);
    const idAperturaGestora = abiertas[0]?.idApertura;
    expect(idAperturaGestora, 'Abra una caja en la empresa gestora antes del cobro').toBeTruthy();

    const { desde, hasta } = hoyRangoFechasLima();

    async function countCobroVaPorEmpresa(idEmpresa: string): Promise<number> {
      const q = new URLSearchParams({
        fechaDesde: desde,
        fechaHasta: hasta,
        idEmpresaOperacion: idEmpresa,
      });
      const mr = await getJson(request, `/api/caja/movimientos?${q.toString()}`);
      if (!mr.ok()) return -1;
      const mb = (await mr.json()) as { data?: Array<{ concepto?: string; conceptoCatalogoDescripcion?: string }> };
      const movs = mb.data || [];
      return movs.filter(
        (m) => esCobroVaConcepto(m.concepto) || esCobroVaConcepto(m.conceptoCatalogoDescripcion)
      ).length;
    }

    const antes: Record<string, number> = {};
    for (const idEm of idsEmpresaLineas) {
      antes[idEm] = await countCobroVaPorEmpresa(idEm);
      expect(antes[idEm], `movimientos caja empresa ${idEm}`).toBeGreaterThanOrEqual(0);
    }

    if (dry) {
      test.info().annotations.push({
        type: 'dry-run',
        description: 'E2E_DRY_RUN=1 — no se ejecutó cobro',
      });
      return;
    }

    const cobroRes = await postJson(request, `/api/ventas/agrupadas/${idVa}/cobrar`, {
      detallePago: [{ idMediosPago: idMedios, monto: total }],
      idApertura: idAperturaGestora,
    });
    const cobroText = await cobroRes.text();
    expect(cobroRes.ok(), cobroText).toBeTruthy();

    for (const idEm of idsEmpresaLineas) {
      const despues = await countCobroVaPorEmpresa(idEm);
      expect(
        despues,
        `Se esperaba al menos un movimiento "Cobro VA" en caja para empresa ${idEm} (¿caja abierta en esa sucursal/empresa?)`
      ).toBeGreaterThan(antes[idEm]);
    }
  });
});
