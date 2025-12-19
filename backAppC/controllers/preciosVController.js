const sql = require('mssql');
const dbConfig = require('../dbconfig');
const precioProductoService = require('../services/preciosV.service');



//crear un registro en PreciosV
const crearPrecioV = async function (detalle) {
    
    console.log('detalle en crear preciosV', detalle);

    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
                .input('cUnitario', sql.Decimal(18, 4), detalle.pUnitario)
                .input('mayorista', sql.Decimal(18, 4), 0)
                .input('cliente', sql.Decimal(18, 4), 0)
                .input('transeunte', sql.Decimal(18, 4), 0)
                .query(`INSERT INTO PreciosV (idProducto, cUnitario, mayorista, cliente, transeunte) VALUES (@idProducto, @cUnitario, @mayorista, @cliente, @transeunte)`);
            res.status(200).send({ data: result });
        } catch (error) {
            console.error('Error al crear el precio:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

//obtener un precio por su id
const obtenerPrecioV = async function (req, res) {
    console.log('req.params', req.params.id);
    const idPrecioV = req.params.id;
    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idPrecioV', sql.Int, idPrecioV)
                .query(`SELECT * FROM PreciosV WHERE idPreciosV = @idPrecioV`);
            res.status(200).send({ data: result.recordset });
        } catch (error) {
            console.error('Error al obtener el precio:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

//obtener todos los precios
const obtenerPreciosV = async function (req, res) {
    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .query(`SELECT * FROM PreciosV`);
            res.status(200).send({ data: result.recordset });
        } catch (error) {
            console.error('Error al obtener los precios:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

//actualizar un precio
const actualizarPrecioV = async function (req, res) {
    const { idPreciosV, idProducto, cUnitario, mayorista, cliente, transeunte } = req.body;
    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idPreciosV', sql.Int, idPreciosV)
                .input('idProducto', sql.UniqueIdentifier, idProducto)
                .input('cUnitario', sql.Decimal(18, 4), cUnitario)
                .input('mayorista', sql.Decimal(18, 4), mayorista)
                .input('cliente', sql.Decimal(18, 4), cliente)
                .input('transeunte', sql.Decimal(18, 4), transeunte)
                .query(`UPDATE PreciosV SET idProducto = @idProducto, cUnitario = @cUnitario, mayorista = @mayorista, cliente = @cliente, transeunte = @transeunte WHERE idPreciosV = @idPreciosV`);
            res.status(200).send({ data: result });
        } catch (error) {
            console.error('Error al actualizar el precio:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

//crear controlador para esta tabla
// CREATE TABLE dbo.ListasPrecio
// (
//     idLista int IDENTITY(1,1) NOT NULL,
//     idEmpresa UNIQUEIDENTIFIER NOT NULL,
//     idSucursal UNIQUEIDENTIFIER NULL,       -- NULL = lista global para todas las sucursales  
//     nombre varchar(100) NOT NULL,   -- ej. "Normal", "Mayorista", "Cyber 2025"
//     idMoneda int NOT NULL,
//     principal bit NOT NULL DEFAULT 0,  -- 1 = lista por defecto
//     conIgv bit  NOT NULL DEFAULT 1,  -- indica si el precio ya tiene IGV
//     fecha_inicio date NOT NULL,
//     fecha_fin date NULL,                  -- NULL = vigente hasta aviso
//     activo bit NOT NULL DEFAULT 1,
//     CONSTRAINT PK_ListasPrecio PRIMARY KEY (idLista),
// 	CONSTRAINT FK_ListasPrecio_Empresas FOREIGN KEY (idEmpresa) REFERENCES dbo.Empresas(idEmpresa),
// 	CONSTRAINT FK_ListasPrecio_Moneda FOREIGN KEY (idMoneda) REFERENCES dbo.Moneda(idMoneda),
// 	CONSTRAINT FK_ListasPrecio_Sucursales FOREIGN KEY (idSucursal) REFERENCES dbo.Sucursal(idSucursal),
//     CONSTRAINT UQ_ListasPrecio_EmpSucNombre UNIQUE (idEmpresa, idSucursal, nombre),

// );


const crear_lista_precio = async function (req, res) {
    console.log('idEmpresa from req.user:', req.body);
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

        const idSucursal = req.body.idSucursal || null;
        console.log('idEmpresa from req.user:', req.user);
        
        // Validación básica en el controller
        if (!req.user.empresa || !nombre || !idMoneda) {
            return res.status(400).send({ 
                message: 'Faltan campos requeridos', 
                data: undefined 
            });
        }

        // Crear conexión a la base de datos
        pool = await sql.connect(dbConfig);
        let idEmpresa = req.user.empresa;
        console.log('Datos recibidos para crear lista de precios:', req.body);
        // Llamar al service
        const resultado = await precioProductoService.crearListaPrecio(
            pool,
            { 
                idEmpresa , 
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

    console.log('idEmpresa from req.user:', req.body);
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
        
        if (!idLista || !idSucursal || !nombre || !idMoneda) {
            return res.status(400).send({ 
                message: 'Faltan campos requeridos', 
                data: undefined 
            });
        }

        const pool = await sql.connect(dbConfig);
        let idEmpresa = req.user.empresa;
        const resultado = await precioProductoService.editarListaPrecio(
            pool,
            { 
                idLista, 
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

        const pool = await sql.connect(dbConfig);
        
        const listas = await precioProductoService.obtenerListasPrecioPorProducto(
            pool, 
            idProducto, 
            req.user
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

        const pool = await sql.connect(dbConfig);
        
        const listas = await precioProductoService.obtenerListasPrecioEmpresa(pool, req.user);
        
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
    let pool;
    
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

        pool = await sql.connect(dbConfig);
        
        const resultado = await precioProductoService.desactivarListaPrecio(
            pool, 
            idLista, 
            req.user
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




// const desactivar_lista_precio = async function (req, res) {
//     const idLista = req.params.id;
//     if (req.user) {
//         try {
//             const pool = await sql.connect(dbConfig);
//             const result = await pool
//                 .request()
//                 .input('idLista', sql.Int, idLista)
//                 .query(`DELETE FROM ListasPrecio WHERE idLista = @idLista`);
//             res.status(200).send({ data: result });
//         } catch (error) {
//             console.error('Error al eliminar la lista de precios:', error);
//             res.status(500).send({ data: undefined });
//         }
//     } else {
//         res.status(401).send({ message: 'No Access', data: undefined });
//     }
// }


// CREATE TABLE dbo.PreciosProducto
// (
//     idPrecio int IDENTITY(1,1) NOT NULL,
//     idLista int NOT NULL,
//     idProducto UNIQUEIDENTIFIER NOT NULL,
//     precio decimal(18,4) NOT NULL,
//     idMoneda int NOT NULL,
//     fActualizacion datetime2 NOT NULL DEFAULT SYSDATETIME(),
//     idUsuario   UNIQUEIDENTIFIER NULL,
//     CONSTRAINT PK_PreciosProducto PRIMARY KEY (idPrecio),
// 	CONSTRAINT FK_PreciosProducto_ListasPrecio FOREIGN KEY (idLista) REFERENCES dbo.ListasPrecio(idLista),
// 	CONSTRAINT FK_PreciosProducto_Productos FOREIGN KEY (idProducto) REFERENCES dbo.Productos(idProducto),
// 	CONSTRAINT FK_PreciosProducto_Moneda FOREIGN KEY (idMoneda) REFERENCES dbo.Moneda(idMoneda),
// 	 CONSTRAINT FK_PreciosProducto_Usuario FOREIGN KEY (idUsuario) REFERENCES dbo.UsuarioWeb(idUsuario),
//     CONSTRAINT UQ_PreciosProducto_ListaProducto UNIQUE (idLista, idProducto)
// );

const crear_precio_producto = async function (req, res) {
    console.log('Datos recibidos para crear precio de producto:', req.body);
    console.log('Usuario autenticado:', req.user);
    
    if (req.user.rol) {
    
         // Obtener datos del request
            console.log('entro al trycahs');
            const precioData = req.body;
            
            // Crear conexión a la base de datos
            const pool = await sql.connect(dbConfig);
            
            // Llamar al service pasando el pool y datos necesarios
            const resultado = await precioProductoService.crearPrecioProducto(
                pool,
                precioData,
                req.user  // usuario autenticado
            );
            
            // Enviar respuesta exitosa
            res.status(200).send({ 
                data: resultado.data,
                message: resultado.message
            });
            
        
    } else {
        res.status(401).send({ 
            message: 'No Access', 
            data: undefined 
        });
    }
};

const editar_precio_producto = async function (req, res) {
    console.log('Datos recibidos para editar precio de producto:', req.body);
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

        // Llamar al service pasando req.querySafe (el middleware)
        const pool = await sql.connect(dbConfig);
        const resultado = await precioProductoService.editarPrecioProducto(
            pool,  // Pasamos el método seguro con empresa
            { idPrecio, idLista, idProducto, precio, idMoneda, idUsuario },
            req.user  // usuario autenticado
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
            const pool = await sql.connect(dbConfig);
            const result = precioProductoService.obtenerPrecioPorId(pool, req.params.idPrecio);
            res.status(200).send({ data: result.recordset });
        } catch (error) {
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
            const pool = await sql.connect(dbConfig);
            const result = await precioProductoService.eliminarPrecioProducto(
                pool,
                idPrecio,
                req.user  // usuario autenticado
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