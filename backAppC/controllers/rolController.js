const rolService = require('../services/rol.service');
const { withPool } = require('../utils/dbPool.util');

const crear_rol = async function (req, res) {
  const { descripcion } = req.body;

  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }

    const resultado = await withPool((pool) => rolService.crearRol(pool, descripcion, req.user));

    // Respuesta exitosa
    res.status(200).json({
      message: resultado.message,
      data: resultado.rowsAffected
    });

  } catch (error) {
    console.error('Error en crear_rol:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }

    if (error.message === 'ROL_EXISTE') {
      return res.status(200).json({
        message: 'El rol ya existe',
        data: undefined
      });
    }

    // Error genérico
    res.status(500).json({
      message: 'Error al crear el rol',
      data: undefined
    });
  }
};


const obtener_roles = async function (req, res) {
 
  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }
    const resultado = await withPool((pool) => rolService.obtenerRoles(pool, req.user));

    // Respuesta exitosa
    res.status(200).json({
      data: resultado.data
    });

  } catch (error) {
    console.error('Error en obtener_roles:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }

    // Error genérico
    res.status(200).json({
      message: 'Error al obtener los roles',
      data: undefined
    });
  }
};

const obtener_rol_id = async function (req, res) {
  const { id } = req.params;
  
  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }

    const resultado = await withPool((pool) => rolService.obtenerRolPorId(pool, id, req.user));

    // Respuesta exitosa
    res.status(200).json({
      data: resultado.data
    });

  } catch (error) {
    console.error('Error en obtener_rol_id:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }

    if (error.message === 'ROL_NO_EXISTE') {
      return res.status(200).json({
        message: 'El rol no existe',
        data: undefined
      });
    }

    // Error genérico
    res.status(500).json({
      message: 'Error al obtener el rol',
      data: undefined
    });
  }
};

const actualizar_rol = async function (req, res) {
  const { id } = req.params;
  const { descripcion } = req.body;

  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }

    const resultado = await withPool((pool) => rolService.actualizarRol(pool, id, descripcion, req.user));

    // Respuesta exitosa
    res.status(200).json({
      message: resultado.message,
      data: resultado.rowsAffected
    });

  } catch (error) {
    console.error('Error en actualizar_rol:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }

    if (error.message === 'ROL_DUPLICADO') {
      return res.status(200).json({
        message: 'El rol ya existe',
        data: undefined
      });
    }

    // Error genérico
    res.status(500).json({
      message: 'Error al actualizar el rol',
      data: undefined
    });
  }
};


//crea la funcion eliminar_rol para eliminar un rol por id



module.exports = {
    crear_rol,
    obtener_roles,
    obtener_rol_id,
    actualizar_rol

};
