// SIEMPRE usa sql.UniqueIdentifier para UUIDs, sql.VarChar para cadenas (regla 1.4)
const sql = require('mssql');
const { isSaas } = require('../config/deployment.config');

/**
 * Obtiene todos los gestores de una empresa
 */
const obtenerGestoresPorEmpresa = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                ge.idGestor,
                ge.idEmpresaOrigen,
                ge.idEmpresaDestino,
                ge.estado,
                CONVERT(VARCHAR(19), ge.fAsignacion, 120) as fAsignacion,
                eo.ruc as rucOrigen,
                eo.razon_Social as razonSocialOrigen,
                ed.ruc as rucDestino,
                ed.razon_Social as razonSocialDestino,
                ed.correo as correoDestino,
                ed.estado as estadoEmpresaDestino
            FROM Gestores_Empresas ge
            INNER JOIN Empresas eo ON ge.idEmpresaOrigen = eo.idEmpresa
            INNER JOIN Empresas ed ON ge.idEmpresaDestino = ed.idEmpresa
            WHERE ge.idEmpresaOrigen = @idEmpresa
            ORDER BY ge.fAsignacion DESC
        `);
    return result.recordset;
};

/**
 * Obtiene las empresas que gestiona una empresa
 */
const obtenerEmpresasGestionadas = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                ge.idGestor,
                e.idEmpresa,
                e.ruc,
                e.razon_Social,
                e.nombreComercial,
                e.correo,
                e.celular,
                e.estado,
                e.estSunat,
                CONVERT(VARCHAR(19), ge.fAsignacion, 120) as fAsignacion,
                ge.estado as estadoGestor
            FROM Gestores_Empresas ge
            INNER JOIN Empresas e ON ge.idEmpresaDestino = e.idEmpresa
            WHERE ge.idEmpresaOrigen = @idEmpresa
            AND ge.estado = 1
            ORDER BY e.razon_Social
        `);
    return result.recordset;
};

/**
 * Obtiene las empresas que pueden gestionar a esta empresa
 */
const obtenerGestoresDeEmpresa = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                ge.idGestor,
                e.idEmpresa,
                e.ruc,
                e.razon_Social,
                e.nombreComercial,
                e.correo,
                CONVERT(VARCHAR(19), ge.fAsignacion, 120) as fAsignacion,
                ge.estado as estadoGestor
            FROM Gestores_Empresas ge
            INNER JOIN Empresas e ON ge.idEmpresaOrigen = e.idEmpresa
            WHERE ge.idEmpresaDestino = @idEmpresa
            ORDER BY e.razon_Social
        `);
    return result.recordset;
};

/**
 * Asigna una empresa como gestora de otra
 */
const asignarGestor = async (pool, idEmpresaOrigen, idEmpresaDestino) => {
    const result = await pool.request()
        .input('idEmpresaOrigen', sql.UniqueIdentifier, idEmpresaOrigen)
        .input('idEmpresaDestino', sql.UniqueIdentifier, idEmpresaDestino)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM Gestores_Empresas 
                WHERE idEmpresaOrigen = @idEmpresaOrigen 
                AND idEmpresaDestino = @idEmpresaDestino
            )
            BEGIN
                INSERT INTO Gestores_Empresas (idEmpresaOrigen, idEmpresaDestino, estado, fAsignacion)
                OUTPUT INSERTED.idGestor
                VALUES (@idEmpresaOrigen, @idEmpresaDestino, 1, GETDATE())
            END
            ELSE
            BEGIN
                UPDATE Gestores_Empresas 
                SET estado = 1, fAsignacion = GETDATE()
                OUTPUT INSERTED.idGestor
                WHERE idEmpresaOrigen = @idEmpresaOrigen 
                AND idEmpresaDestino = @idEmpresaDestino
            END
        `);
    return result.recordset[0];
};

/**
 * Remueve un gestor (desactiva la relación)
 */
const removerGestor = async (pool, idGestor) => {
    const result = await pool.request()
        .input('idGestor', sql.Int, idGestor)
        .query(`
            UPDATE Gestores_Empresas 
            SET estado = 0
            WHERE idGestor = @idGestor
        `);
    return result.rowsAffected[0];
};

/**
 * Activa un gestor previamente desactivado
 */
const activarGestor = async (pool, idGestor) => {
    const result = await pool.request()
        .input('idGestor', sql.Int, idGestor)
        .query(`
            UPDATE Gestores_Empresas 
            SET estado = 1, fAsignacion = GETDATE()
            WHERE idGestor = @idGestor
        `);
    return result.rowsAffected[0];
};

/**
 * Elimina un gestor permanentemente
 */
const eliminarGestor = async (pool, idGestor) => {
    const result = await pool.request()
        .input('idGestor', sql.Int, idGestor)
        .query('DELETE FROM Gestores_Empresas WHERE idGestor = @idGestor');
    return result.rowsAffected[0];
};

/**
 * Busca una empresa por RUC
 */
const buscarEmpresaPorRuc = async (pool, ruc) => {
    const result = await pool.request()
        .input('ruc', sql.VarChar(11), ruc)
        .query(`
            SELECT 
                idEmpresa,
                ruc,
                razon_Social,
                nombreComercial,
                correo,
                celular,
                estado,
                estSunat
            FROM Empresas 
            WHERE ruc = @ruc
        `);
    return result.recordset[0] || null;
};

/**
 * Verifica si ya existe una relación de gestor
 */
const verificarRelacionGestor = async (pool, idEmpresaOrigen, idEmpresaDestino) => {
    const result = await pool.request()
        .input('idEmpresaOrigen', sql.UniqueIdentifier, idEmpresaOrigen)
        .input('idEmpresaDestino', sql.UniqueIdentifier, idEmpresaDestino)
        .query(`
            SELECT idGestor, estado 
            FROM Gestores_Empresas 
            WHERE idEmpresaOrigen = @idEmpresaOrigen 
            AND idEmpresaDestino = @idEmpresaDestino
        `);
    return result.recordset[0] || null;
};

/**
 * Obtiene configuración de la empresa
 */
const obtenerConfiguracionEmpresa = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                idConfiguracion,
                clave,
                valor,
                descripcion,
                tipoDato
            FROM ConfiguracionEmpresa 
            WHERE idEmpresa = @idEmpresa
            ORDER BY clave
        `);
    return result.recordset;
};

/**
 * Guarda o actualiza configuración de empresa
 */
const guardarConfiguracion = async (pool, idEmpresa, clave, valor, descripcion, tipoDato) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('clave', sql.VarChar(100), clave)
        .input('valor', sql.VarChar(500), valor)
        .input('descripcion', sql.VarChar(200), descripcion)
        .input('tipoDato', sql.VarChar(20), tipoDato || 'STRING')
        .query(`
            IF EXISTS (SELECT 1 FROM ConfiguracionEmpresa WHERE idEmpresa = @idEmpresa AND clave = @clave)
            BEGIN
                UPDATE ConfiguracionEmpresa 
                SET valor = @valor, descripcion = @descripcion, tipoDato = @tipoDato
                WHERE idEmpresa = @idEmpresa AND clave = @clave
            END
            ELSE
            BEGIN
                INSERT INTO ConfiguracionEmpresa (idEmpresa, clave, valor, descripcion, tipoDato)
                VALUES (@idEmpresa, @clave, @valor, @descripcion, @tipoDato)
            END
        `);
    return result.rowsAffected[0];
};

/**
 * True si la empresa es gestora activa y su plan de suscripción es enterprise (modo SaaS).
 * Modo enterprise (BD sin tablas SaaS): relación activa en Gestores_Empresas como origen.
 */
const esEmpresaGestoraActiva = async (pool, idEmpresa) => {
    if (!isSaas()) {
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT COUNT(*) AS n
                FROM Gestores_Empresas ge
                WHERE ge.idEmpresaOrigen = @idEmpresa
                  AND ge.estado = 1
            `);
        return Number(result.recordset[0]?.n || 0) > 0;
    }
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT COUNT(*) AS n
            FROM Gestores_Empresas ge
            INNER JOIN EmpresaSuscripcion es ON es.idEmpresa = ge.idEmpresaOrigen
            WHERE ge.idEmpresaOrigen = @idEmpresa
              AND ge.estado = 1
              AND LOWER(LTRIM(RTRIM(es.planCode))) = 'enterprise'
              AND UPPER(LTRIM(RTRIM(es.estado))) IN ('ACTIVA', 'DEMO')
        `);
    return Number(result.recordset[0]?.n || 0) > 0;
};

/** True si la empresa es destino de una relación de gestión activa (empresa gestionada). */
const esEmpresaGestionadaActiva = async (pool, idEmpresa) => {
  if (!idEmpresa) return false;
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS n
      FROM Gestores_Empresas ge
      WHERE ge.idEmpresaDestino = @idEmpresa
        AND ge.estado = 1
    `);
  return Number(result.recordset[0]?.n || 0) > 0;
};

/** True si idEmpresaOrigen gestiona activamente a idEmpresaDestino. */
const verificarGestorGestionaEmpresa = async (pool, idEmpresaOrigen, idEmpresaDestino) => {
    if (!idEmpresaOrigen || !idEmpresaDestino) return false;
    if (String(idEmpresaOrigen) === String(idEmpresaDestino)) return true;
    const result = await pool.request()
        .input('idOrigen', sql.UniqueIdentifier, idEmpresaOrigen)
        .input('idDestino', sql.UniqueIdentifier, idEmpresaDestino)
        .query(`
            SELECT 1 AS ok
            FROM Gestores_Empresas
            WHERE idEmpresaOrigen = @idOrigen AND idEmpresaDestino = @idDestino AND estado = 1
        `);
    return (result.recordset || []).length > 0;
};

module.exports = {
    obtenerGestoresPorEmpresa,
    obtenerEmpresasGestionadas,
    obtenerGestoresDeEmpresa,
    esEmpresaGestoraActiva,
    esEmpresaGestionadaActiva,
    verificarGestorGestionaEmpresa,
    asignarGestor,
    removerGestor,
    activarGestor,
    eliminarGestor,
    buscarEmpresaPorRuc,
    verificarRelacionGestor,
    obtenerConfiguracionEmpresa,
    guardarConfiguracion
};
