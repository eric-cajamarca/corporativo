const precioProductoService = require('../services/preciosV.service');
const preciosVentaService = require('../services/preciosVenta.service');
const { withPool } = require('../utils/dbPool.util');



/** Helper interno (no es handler HTTP): inserta fila en tabla PreciosV. */
const crearPrecioV = async function (pool, detalle) {
  await preciosVentaService.crearDesdeDetalle(pool, detalle);
};

const obtenerPrecioV = async function (req, res) {
        const idPrecioV = req.params.id;
    if (req.user) {
        try {
            const data = await withPool((pool) => preciosVentaService.obtenerPorId(pool, idPrecioV));
            res.status(200).send({ data });
        } catch (error) {
            console.error('Error al obtener el precio:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

const obtenerPreciosV = async function (req, res) {
    if (req.user) {
        try {
            const data = await withPool((pool) => preciosVentaService.listarTodos(pool));
            res.status(200).send({ data });
        } catch (error) {
            console.error('Error al obtener los precios:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

const actualizarPrecioV = async function (req, res) {
    const { idPreciosV, idProducto, cUnitario, mayorista, cliente, transeunte } = req.body;
    if (req.user) {
        try {
            const result = await withPool((pool) => preciosVentaService.actualizar(pool, {
                idPreciosV,
                idProducto,
                cUnitario,
                mayorista,
                cliente,
                transeunte
            }));
            res.status(200).send({ data: result });
        } catch (error) {
            console.error('Error al actualizar el precio:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

const crear_lista_precio = async function (req, res) {
        try {
        // Verificar autenticación
        if (!req.user) {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }

        // Obtener datos del request
        const { 
            nombre, 
            idMoneda, 
            principal, 
            conIgv, 
            fecha_inicio, 
            fecha_fin, 
            activo 
        } = req.body;

        const idSucursal = (req.body.idSucursal === 'null' || req.body.idSucursal === '' || req.body.idSucursal === undefined) ? null : req.body.idSucursal;
                
        // Validación básica en el controller
        if (!req.user.empresa || !nombre || !idMoneda) {
            return res.status(400).send({ 
                message: 'Faltan campos requeridos', 
                data: undefined 
            });
        }

        const idEmpresa = req.user.empresa;
        const resultado = await withPool((pool) =>
          precioProductoService.crearListaPrecio(
            pool,
            {
              idEmpresa,
              idSucursal,
              nombre,
              idMoneda,
              principal: principal || false,
              conIgv: conIgv || false,
              fecha_inicio,
              fecha_fin,
              activo: activo !== undefined ? activo : true
            },
            req.user
          )
        );

        // Enviar respuesta exitosa
        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            idGenerado: resultado.idGenerado
        });

    } catch (error) {
        console.error('Error al crear la lista de precios:', error);

        // Manejar diferentes tipos de errores
        switch (error.message) {
            case 'NO_ACCESO':
                return res.status(401).send({ 
                    message: 'No Access', 
                    data: undefined 
                });
            case 'CAMPOS_REQUERIDOS':
                return res.status(400).send({ 
                    message: 'Faltan campos requeridos', 
                    data: undefined 
                });
            case 'NOMBRE_DUPLICADO':
                return res.status(409).send({ 
                    message: 'Ya existe una lista de precios con ese nombre', 
                    data: undefined 
                });
            case 'YA_EXISTE_PRINCIPAL':
                return res.status(409).send({ 
                    message: 'Ya existe una lista de precios principal activa', 
                    data: undefined 
                });
            case 'FECHA_FIN_MENOR':
                return res.status(400).send({ 
                    message: 'La fecha de fin no puede ser menor a la fecha de inicio', 
                    data: undefined 
                });
            case 'NOMBRE_LONGITUD_INVALIDA':
                return res.status(400).send({ 
                    message: 'El nombre debe tener entre 3 y 100 caracteres', 
                    data: undefined 
                });
            case 'MONEDA_INVALIDA':
            case 'PRINCIPAL_INVALIDO':
            case 'CON_IGV_INVALIDO':
            case 'ACTIVO_INVALIDO':
                return res.status(400).send({ 
                    message: 'Datos de entrada no válidos', 
                    data: undefined 
                });
            default:
                return res.status(500).send({ 
                    message: 'Error interno del servidor', 
                    data: undefined 
                });
        }
    } 
};


const editar_lista_precio = async function (req, res) {

        try {
        if (!req.user) {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }
        
        
        const { 
            idLista, 
            idSucursal, 
            nombre, 
            idMoneda, 
            principal, 
            conIgv, 
            fecha_inicio, 
            fecha_fin, 
            activo 
        } = req.body;

        const idSucursalNormalizado = (idSucursal === 'null' || idSucursal === '' || idSucursal === undefined) ? null : idSucursal;
        
        if (!idLista || !nombre || !idMoneda) {
            return res.status(400).send({ 
                message: 'Faltan campos requeridos', 
                data: undefined 
            });
        }

        const idEmpresa = req.user.empresa;
        const resultado = await withPool((pool) =>
          precioProductoService.editarListaPrecio(
            pool,
            {
              idLista,
              idEmpresa,
              idSucursal: idSucursalNormalizado,
              nombre,
              idMoneda,
              principal: principal || false,
              conIgv: conIgv || false,
              fecha_inicio,
              fecha_fin,
              activo: activo !== undefined ? activo : true
            },
            req.user
          )
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al actualizar la lista de precios:', error);

        switch (error.message) {
            case 'NO_ACCESO':
                return res.status(401).send({ 
                    message: 'No Access', 
                    data: undefined 
                });
            case 'CAMPOS_REQUERIDOS':
                return res.status(400).send({ 
                    message: 'Faltan campos requeridos', 
                    data: undefined 
                });
            case 'LISTA_NO_ENCONTRADA':
                return res.status(404).send({ 
                    message: 'Lista de precios no encontrada', 
                    data: undefined 
                });
            case 'ID_LISTA_INVALIDO':
            case 'NOMBRE_LONGITUD_INVALIDA':
            case 'MONEDA_INVALIDA':
            case 'PRINCIPAL_INVALIDO':
            case 'CON_IGV_INVALIDO':
            case 'ACTIVO_INVALIDO':
            case 'FECHA_FIN_MENOR':
                return res.status(400).send({ 
                    message: 'Datos de entrada no válidos', 
                    data: undefined 
                });
            case 'NO_SE_ACTUALIZO':
                return res.status(404).send({ 
                    message: 'No se pudo actualizar la lista de precios', 
                    data: undefined 
                });
            default:
                return res.status(500).send({ 
                    message: 'Error interno del servidor', 
                    data: undefined 
                });
        }
    } 
};


const obtener_listas_precio_producto = async function (req, res) {
        
    try {
        if (!req.user) {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }

        const { idProducto } = req.params;
        
        if (!idProducto) {
            return res.status(400).send({ 
                message: 'Producto no válido', 
                data: undefined 
            });
        }

        const listas = await withPool((pool) =>
          precioProductoService.obtenerListasPrecioPorProducto(pool, idProducto, req.user)
        );
        
        res.status(200).send({ data: listas });

    } catch (error) {
        console.error('Error al obtener listas por producto:', error);
        
        if (error.message === 'NO_ACCESO') {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }
        
        if (error.message === 'EMPRESA_NO_ASIGNADA') {
            return res.status(400).send({ 
                message: 'Usuario no tiene empresa asignada', 
                data: undefined 
            });
        }
        
        if (error.message === 'PRODUCTO_NO_VALIDO') {
            return res.status(400).send({ 
                message: 'Producto no válido', 
                data: undefined 
            });
        }
        
        res.status(500).send({ 
            message: 'Error interno del servidor', 
            data: undefined 
        });
        
    } 
};

const obtener_listas_precio_empresa = async function (req, res) {
      
    try {
        if (!req.user) {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }

        const listas = await withPool((pool) => precioProductoService.obtenerListasPrecioEmpresa(pool, req.user));
        
        res.status(200).send({ data: listas });

    } catch (error) {
        console.error('Error al obtener listas de empresa:', error);
        
        if (error.message === 'NO_ACCESO') {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }
        
        if (error.message === 'EMPRESA_NO_ASIGNADA') {
            return res.status(400).send({ 
                message: 'Usuario no tiene empresa asignada', 
                data: undefined 
            });
        }
        
        res.status(500).send({ 
            message: 'Error interno del servidor', 
            data: undefined 
        });
        
    } 
};

const desactivar_lista_precio = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }

        const idLista = req.params.id;
        
        if (!idLista) {
            return res.status(400).send({ 
                message: 'ID de lista no válido', 
                data: undefined 
            });
        }

        const resultado = await withPool((pool) =>
          precioProductoService.desactivarListaPrecio(pool, idLista, req.user)
        );
        
        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al eliminar/desactivar la lista de precios:', error);
        
        if (error.message === 'NO_ACCESO') {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }
        
        if (error.message === 'ID_LISTA_INVALIDO') {
            return res.status(400).send({ 
                message: 'ID de lista no válido', 
                data: undefined 
            });
        }
        
        if (error.message === 'LISTA_NO_ENCONTRADA') {
            return res.status(404).send({ 
                message: 'Lista de precios no encontrada', 
                data: undefined 
            });
        }
        
        res.status(500).send({ 
            message: 'Error interno del servidor', 
            data: undefined 
        });
        
    }
};

const crear_precio_producto = async function (req, res) {
  if (!req.user?.rol) {
    return res.status(401).send({
      message: 'No Access',
      data: undefined
    });
  }
  const precioData = req.body;
  try {
    const resultado = await withPool((pool) =>
      precioProductoService.crearPrecioProducto(pool, precioData, req.user)
    );
    res.status(200).send({
      data: resultado.data,
      message: resultado.message
    });
  } catch (error) {
    console.error('Error al crear precio producto:', error);
    res.status(500).send({ message: error.message || 'Error interno', data: undefined });
  }
};

const editar_precio_producto = async function (req, res) {
        try {
        // Verificar autenticación
        if (!req.user) {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }

        // Obtener datos del request
        const { idPrecio, idLista, idProducto, precio, idMoneda, idUsuario } = req.body;

        const resultado = await withPool((pool) =>
          precioProductoService.editarPrecioProducto(
            pool,
            { idPrecio, idLista, idProducto, precio, idMoneda, idUsuario },
            req.user
          )
        );

        // Enviar respuesta exitosa
        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            cambios: resultado.cambios
        });

    } catch (error) {
        console.error('Error al actualizar precio del producto:', error);

        // Manejar diferentes tipos de errores
        switch (error.message) {
            case 'NO_ACCESO':
                return res.status(401).send({ 
                    message: 'No Access', 
                    data: undefined 
                });
            case 'CAMPOS_REQUERIDOS':
                return res.status(400).send({ 
                    message: 'Faltan campos requeridos', 
                    data: undefined 
                });
            case 'PRECIO_NO_ENCONTRADO':
                return res.status(404).send({ 
                    message: 'Precio no encontrado', 
                    data: undefined 
                });
            case 'ID_PRECIO_INVALIDO':
            case 'PRECIO_INVALIDO':
            case 'PRECIO_NEGATIVO':
            case 'MONEDA_INVALIDA':
                return res.status(400).send({ 
                    message: 'Datos de entrada no válidos', 
                    data: undefined 
                });
            case 'PERMISO_DENEGADO':
                return res.status(403).send({ 
                    message: 'No tiene permisos para editar este precio', 
                    data: undefined 
                });
            case 'NO_SE_ACTUALIZO':
                return res.status(404).send({ 
                    message: 'No se pudo actualizar el precio', 
                    data: undefined 
                });
            default:
                return res.status(500).send({ 
                    message: 'Error interno del servidor', 
                    data: undefined 
                });
        }
    }
};

const obtener_precios_producto = async function (req, res) {
    if (req.user) {
        try {
            const idPrecio = req.params.productoId || req.params.idPrecio;
            const result = await withPool((pool) => precioProductoService.obtenerPrecioPorId(pool, idPrecio));
            res.status(200).send({ data: result.data });
        } catch (error) {
            if (error.message === 'PRECIO_NO_ENCONTRADO') {
                return res.status(404).send({ message: 'Precio no encontrado', data: undefined });
            }
            console.error('Error al obtener los precios de los productos:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

const eliminar_precio_producto = async function (req, res) {
    const idPrecio = req.params.id;
    if (req.user) {
        try {
            const result = await withPool((pool) =>
              precioProductoService.eliminarPrecioProducto(pool, idPrecio, req.user)
            );
            res.status(200).send({ data: result });
        } catch (error) {
            console.error('Error al eliminar el precio del producto:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

module.exports = {
    // crearPrecioV,
    obtenerPrecioV,
    obtenerPreciosV,
    actualizarPrecioV,
    crear_lista_precio,
    editar_lista_precio,
    obtener_listas_precio_producto,
    obtener_listas_precio_empresa,
    desactivar_lista_precio,
    crear_precio_producto,
    editar_precio_producto,
    obtener_precios_producto,
    eliminar_precio_producto
}