/**
 * Script para probar que listarComprasPorIdEmpresa solo devuelve compras de una empresa.
 * Ejecutar: node scripts/test-listar-compras-empresa.js
 */
const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, '..', 'test-compras-empresa.log');
const log = (...args) => { const s = args.join(' '); try { fs.appendFileSync(logPath, s + '\n'); } catch (e) { fs.writeFileSync(logPath, 'log error: ' + e.message); } };
try { fs.writeFileSync(logPath, 'start\n'); } catch (_) {}
const sql = require('mssql');
const dbConfig = require('../dbconfig');
const comprasRepository = require('../repositories/compras.repository');

async function run() {
    let pool;
    try {
        log('Iniciando test...');
        pool = await sql.connect(dbConfig);
        log('Conectado a la base de datos.');

        const totalCompras = await pool.request().query('SELECT COUNT(*) AS total FROM Compras');
        const total = totalCompras.recordset[0].total;
        log('Total compras en la tabla Compras (todas las empresas):', total);

        const porEmpresa = await pool.request().query(`
            SELECT idEmpresa, COUNT(*) AS cantidad
            FROM Compras
            GROUP BY idEmpresa
            ORDER BY cantidad DESC
        `);
        log('Compras por empresa (idEmpresa, cantidad):');
        porEmpresa.recordset.forEach((r) => {
            log('  ', r.idEmpresa, '->', r.cantidad);
        });

        const empresaCon3 = porEmpresa.recordset.find((r) => Number(r.cantidad) === 3);
        if (empresaCon3) {
            const idEmpresa = empresaCon3.idEmpresa;
            log('Probando listarComprasPorIdEmpresa para empresa con 3 compras:', idEmpresa);
            const lista = await comprasRepository.listarComprasPorIdEmpresa(pool, idEmpresa);
            log('Resultado: se listaron', lista.length, 'compras.');
            if (lista.length === 3) {
                log('OK: Se listan exactamente 3 compras para esa empresa.');
            } else {
                log('ERROR: Se esperaban 3 compras, se obtuvieron', lista.length);
            }
        } else {
            const primera = porEmpresa.recordset[0];
            if (primera) {
                const idEmpresa = primera.idEmpresa;
                const esperadas = Number(primera.cantidad);
                log('No hay empresa con exactamente 3 compras. Probando con la primera:', idEmpresa, '(esperadas:', esperadas, ')');
                const lista = await comprasRepository.listarComprasPorIdEmpresa(pool, idEmpresa);
                log('Resultado: se listaron', lista.length, 'compras.');
                log(lista.length === esperadas ? 'OK: El filtro por empresa funciona.' : 'Revisar: cantidad no coincide.');
            }
        }

        if (porEmpresa.recordset.length > 1 && total > 3) {
            const otraEmpresa = porEmpresa.recordset[1].idEmpresa;
            const listaOtra = await comprasRepository.listarComprasPorIdEmpresa(pool, otraEmpresa);
            log('Otra empresa', otraEmpresa, '->', listaOtra.length, 'compras (solo de esa empresa).');
        }
    } catch (err) {
        log('Error:', err.message);
        console.error('Error:', err.message);
        process.exitCode = 1;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(process.exitCode || 0)).catch((e) => { console.error(e); process.exit(1); });
