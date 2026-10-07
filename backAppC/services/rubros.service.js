const rubrosRepository = require('../repositories/rubros.repository');

async function asegurarRubroFerreteria(pool) {
    const sql = require('mssql');
    const existente = await rubrosRepository.obtenerPorCodigo(pool, 'FERR');
    if (!existente) {
        await rubrosRepository.crear(pool, {
            codigo: 'FERR',
            nombre: 'Ferretería',
            descripcion: 'Facturación estándar; tope 22 líneas por factura.',
            activo: true
        });
        return;
    }
    if (!existente.activo) {
        await rubrosRepository.actualizar(pool, existente.idRubro, {
            codigo: existente.codigo,
            nombre: existente.nombre || 'Ferretería',
            descripcion: existente.descripcion,
            activo: true
        });
    }
}

exports.listar = async (pool, query) => {
    try {
        await asegurarRubroFerreteria(pool);
    } catch (err) {
        console.error('rubros.service asegurarRubroFerreteria:', err.message);
    }
    return rubrosRepository.listar(pool, query);
};

exports.obtenerPorId = async (pool, idRubro) => {
    return rubrosRepository.obtenerPorId(pool, idRubro);
};

exports.obtenerPorCodigo = async (pool, codigo) => {
    return rubrosRepository.obtenerPorCodigo(pool, codigo);
};

exports.crear = async (pool, body) => {
    const existente = await rubrosRepository.obtenerPorCodigo(pool, body.codigo);
    if (existente) throw new Error('Ya existe un rubro con ese código');
    return rubrosRepository.crear(pool, body);
};

exports.actualizar = async (pool, idRubro, body) => {
    const existente = await rubrosRepository.obtenerPorId(pool, idRubro);
    if (!existente) throw new Error('Rubro no encontrado');
    if (body.codigo && body.codigo !== existente.codigo) {
        const otro = await rubrosRepository.obtenerPorCodigo(pool, body.codigo);
        if (otro) throw new Error('Ya existe un rubro con ese código');
    }
    return rubrosRepository.actualizar(pool, idRubro, body);
};

exports.eliminar = async (pool, idRubro) => {
    const existente = await rubrosRepository.obtenerPorId(pool, idRubro);
    if (!existente) throw new Error('Rubro no encontrado');
    return rubrosRepository.eliminar(pool, idRubro);
};

exports.listarConfiguracion = async (pool, idRubro) => {
    return rubrosRepository.listarConfiguracion(pool, idRubro);
};

exports.guardarConfiguracion = async (pool, idRubro, items) => {
    return rubrosRepository.guardarConfiguracionLote(pool, idRubro, items);
};
