const rubrosRepository = require('../repositories/rubros.repository');

exports.listar = async (pool, query) => {
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
