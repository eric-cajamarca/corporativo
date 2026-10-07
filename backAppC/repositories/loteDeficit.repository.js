const sql = require('mssql');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Baja la cantidad en ubicación en la misma medida que el disponible del lote,
 * para que el stock por ubicación no quede por encima del lote.
 */
async function reducirUbicacion(executor, idLote, cantidad) {
  let restante = round2(cantidad);
  if (restante <= 0 || !idLote) return;
  const rs = await executor
    .request()
    .input('idLote', sql.UniqueIdentifier, idLote)
    .query(`
      SELECT idUbicacion, CONVERT(DECIMAL(18, 3), cantidad) AS cantidad
      FROM LotesUbicacion
      WHERE idLote = @idLote
      ORDER BY cantidad DESC
    `);
  for (const row of rs.recordset || []) {
    if (restante <= 0.001) break;
    const cant = parseFloat(row.cantidad) || 0;
    if (cant <= 0) continue;
    const tomar = round2(Math.min(cant, restante));
    const nueva = round2(cant - tomar);
    await executor
      .request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, row.idUbicacion)
      .input('cantidad', sql.Decimal(18, 3), nueva)
      .query(`
        UPDATE LotesUbicacion
        SET cantidad = @cantidad
        WHERE idLote = @idLote AND idUbicacion = @idUbicacion
      `);
    restante = round2(restante - tomar);
  }
}

/**
 * Cuando hubo ventas sin stock (lote en negativo) y luego entra mercadería,
 * el ingreso cubre primero ese faltante. Así el disponible de lotes cierra
 * igual que el kardex (ej. -5 + lote 20 - venta 3 = 12, no 17).
 * No toca cantidadIngresada: el documento sigue registrando lo recibido.
 */
async function compensarDeficitProducto(executor, { idEmpresa, idProducto, idSucursal }) {
  if (!executor || !idEmpresa || !idProducto) return 0;

  const reqNeg = executor.request();
  reqNeg.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  reqNeg.input('idProducto', sql.UniqueIdentifier, idProducto);
  let whereSuc = '';
  if (idSucursal) {
    reqNeg.input('idSucursal', sql.UniqueIdentifier, idSucursal);
    whereSuc = ' AND idSucursal = @idSucursal';
  }
  const neg = await reqNeg.query(`
    SELECT idLote, idSucursal, CONVERT(DECIMAL(18, 2), cantidadDisponible) AS cantidadDisponible
    FROM Lotes
    WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible < 0${whereSuc}
  `);
  const filasNeg = neg.recordset || [];
  if (!filasNeg.length) return 0;

  const porSucursal = new Map();
  for (const row of filasNeg) {
    const key = String(row.idSucursal || '');
    if (!porSucursal.has(key)) porSucursal.set(key, []);
    porSucursal.get(key).push(row);
  }

  let compensado = 0;
  for (const [suc, negativos] of porSucursal) {
    if (!suc) continue;
    const pos = await executor
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('idSucursal', sql.UniqueIdentifier, suc)
      .query(`
        SELECT idLote, CONVERT(DECIMAL(18, 2), cantidadDisponible) AS cantidadDisponible
        FROM Lotes
        WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND idSucursal = @idSucursal
          AND cantidadDisponible > 0
        ORDER BY fechaIngreso DESC, idLote DESC
      `);
    const positivos = (pos.recordset || []).map((r) => ({
      idLote: r.idLote,
      disp: parseFloat(r.cantidadDisponible) || 0
    }));
    if (!positivos.length) continue;

    for (const n of negativos) {
      let deficit = Math.abs(parseFloat(n.cantidadDisponible) || 0);
      for (const p of positivos) {
        if (deficit <= 0.001) break;
        if (p.disp <= 0.001) continue;
        const tomar = round2(Math.min(p.disp, deficit));
        if (tomar <= 0) continue;
        p.disp = round2(p.disp - tomar);
        deficit = round2(deficit - tomar);
        compensado = round2(compensado + tomar);
        await executor
          .request()
          .input('idLote', sql.UniqueIdentifier, p.idLote)
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .input('disp', sql.Decimal(18, 2), p.disp)
          .query(`
            UPDATE Lotes SET cantidadDisponible = @disp
            WHERE idLote = @idLote AND idEmpresa = @idEmpresa
          `);
        try {
          await reducirUbicacion(executor, p.idLote, tomar);
        } catch (errUb) {
          console.error('loteDeficit ubicacion:', errUb.message);
        }
      }
      const nuevoNeg = round2(-Math.max(deficit, 0));
      const anterior = parseFloat(n.cantidadDisponible) || 0;
      if (Math.abs(nuevoNeg - anterior) > 0.001) {
        await executor
          .request()
          .input('idLote', sql.UniqueIdentifier, n.idLote)
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .input('disp', sql.Decimal(18, 2), nuevoNeg)
          .query(`
            UPDATE Lotes SET cantidadDisponible = @disp
            WHERE idLote = @idLote AND idEmpresa = @idEmpresa
          `);
      }
    }
  }
  return compensado;
}

async function compensarDeficitsEmpresa(executor, idEmpresa) {
  if (!executor || !idEmpresa) return;
  const rs = await executor
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT DISTINCT idProducto
      FROM Lotes
      WHERE idEmpresa = @idEmpresa AND cantidadDisponible < 0
    `);
  for (const row of rs.recordset || []) {
    if (!row.idProducto) continue;
    await compensarDeficitProducto(executor, { idEmpresa, idProducto: row.idProducto });
  }
}

module.exports = {
  compensarDeficitProducto,
  compensarDeficitsEmpresa
};
