-- =============================================
-- DATOS INICIALES PARA LA BASE DE DATOS
-- Ejecutar después de crear las tablas
-- =============================================

USE SistemaInventario;
GO

-- =============================================
-- DATOS GLOBALES (SUNAT)
-- =============================================

-- Documentos de identidad
INSERT INTO Documentos VALUES
('1','DNI','Documento Nacional de Identidad'),
('4','CARNET','Carnet de extrangería'),
('6','RUC','Registro Unico de Contributentes'),
('7','PASAPORTE','Pasaporte'),
('A','CEDULA','Cédula diplomática de identidad');
GO

-- Presentaciones
INSERT INTO Presentacion (codigo, descripcion, multiplicador) VALUES
('BG','Bolsa',1),
('CEN','Ciento',100),
('MIL','Millar',1000),
('BX','Caja',1),
('RO','Rollo',1),
('WG','Galón',1),
('MTR','Metros',1),
('KGM','Kilogramo',1),
('LTR','Litro',1),
('NIU','Unidad',1),
('DZN','Docena',12),
('TNE','Tonelada',1),
('PK','Paquete',1),
('SA','Saco',1),
('BO','Botella',1),
('ZZ','Otros',1);
GO

-- Medios de pago
INSERT INTO MediosPago (codigo, descripcion) VALUES
('001','DEPOSITO EN CUENTA'),
('003','TRANSFERENCIA DE FONDOS'),
('005','TARJETA DEBITO'),
('006','TARJETA CREDITO'),
('009','CONTADO'),
('010','CREDITO'),
('011','LETRA'),
('012','EFECTIVO');
GO

-- Monedas
INSERT INTO Moneda (codigo, descripcion, simbolo) VALUES
('PEN','SOLES','S/.'),
('USD','DOLLAR AMERICANO','US$'),
('EUR','EUROS','€');
GO

-- Estados de pago
INSERT INTO EstadoPago (descripcion) VALUES
('Pendiente'),
('Pagado'),
('Vencido'),
('Anulado');
GO

-- Estados de pedido
INSERT INTO EstadosPedidos (descripcion, color) VALUES
('Pendiente','#FFA500'),
('En Proceso','#0000FF'),
('Entregado','#008000'),
('Cancelado','#FF0000'),
('Devuelto','#800080');
GO

-- Tipos de movimiento
INSERT INTO TiposMovimiento (nombre, descripcion, afectaStock) VALUES
('ENTRADA','Ingreso de productos al inventario','+'),
('SALIDA','Salida de productos del inventario','-'),
('TRANSFERENCIA','Movimiento entre sucursales','N'),
('AJUSTE_POSITIVO','Ajuste de inventario positivo','+'),
('AJUSTE_NEGATIVO','Ajuste de inventario negativo','-'),
('DEVOLUCION','Devolución de productos','+');
GO

-- =============================================
-- DATOS DE EJEMPLO PARA EMPRESA
-- =============================================

-- Empresa principal
DECLARE @idEmpresa UNIQUEIDENTIFIER = '42099529-43C9-4B7F-921A-3D6FB946E93E';

INSERT INTO Empresas (
    idEmpresa, idDocumento, ruc, razon_Social, nombreComercial, rubro,
    celular, correo, password, logo, alias, condicion, estSunat, estado, fRegistro
) VALUES (
    @idEmpresa,
    '6',
    '20611688564',
    'EMPRESA FERRETERA AVE FENIX SJB E.I.R.L.',
    'AVE FENIX',
    'VENTA AL POR MAYOR DE MATERIALES DE CONSTRUCCIÓN, ARTÍCULOS DE FERRETERÍA...',
    '968073361',
    'ventas@avefenix.com',
    '$2a$08$iD7U/5D7Kc.BOH06wQg/.uGB7pY9CNSd2LYwEabV3QM9GCHIYQmby',
    'logo_avefenix.png',
    'Fenix',
    'HABIDO',
    'ACTIVO',
    1,
    GETDATE()
);
GO

-- Dirección de la empresa
INSERT INTO DireccionEmpresa (
    idEmpresa, ubigeo, codPais, region, provincia, distrito,
    urbanizacion, direccion, codLocal, principal
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '060801',
    'PEN',
    'CAJAMARCA',
    'JAEN',
    'JAEN',
    'URB. LOS OLIVOS',
    'PJ. LOS OLIVOS NRO. C-02 URB. H.U PALESTINA (FRENTE AL PARQUE LOS OLIVOS)',
    '',
    1
);
GO

-- Configuración de empresa
INSERT INTO ConfiguracionEmpresa (idEmpresa, clave, valor, descripcion, tipoDato) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'IGV_PORCENTAJE', '18.00', 'Porcentaje de IGV aplicado', 'NUMBER'),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'MONEDA_DEFAULT', 'PEN', 'Moneda por defecto del sistema', 'STRING'),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'LOGO_URL', 'https://example.com/logo.png', 'URL del logo de la empresa', 'STRING'),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'DIAS_VENCIMIENTO_CREDITO', '30', 'Días para vencimiento de créditos', 'NUMBER'),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'STOCK_MINIMO_ALERTA', '10', 'Cantidad mínima para alerta de stock', 'NUMBER');
GO

-- Roles
DECLARE @idRolAdmin UNIQUEIDENTIFIER = NEWID();
DECLARE @idRolVendedor UNIQUEIDENTIFIER = NEWID();
DECLARE @idRolAlmacen UNIQUEIDENTIFIER = NEWID();
DECLARE @idRolContador UNIQUEIDENTIFIER = NEWID();

INSERT INTO Rol (idRol, idEmpresa, descripcion, estado, fCreacion) VALUES
(@idRolAdmin, '42099529-43C9-4B7F-921A-3D6FB946E93E', 'Administrador', 1, GETDATE()),
(@idRolVendedor, '42099529-43C9-4B7F-921A-3D6FB946E93E', 'Vendedor', 1, GETDATE()),
(@idRolAlmacen, '42099529-43C9-4B7F-921A-3D6FB946E93E', 'Almacenero', 1, GETDATE()),
(@idRolContador, '42099529-43C9-4B7F-921A-3D6FB946E93E', 'Contador', 1, GETDATE());
GO

-- Permisos
INSERT INTO Permisos (idEmpresa, nombre, descripcion, modulo, estado) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'VER_PRODUCTOS', 'Puede ver productos', 'INVENTARIO', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'CREAR_PRODUCTOS', 'Puede crear productos', 'INVENTARIO', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'EDITAR_PRODUCTOS', 'Puede editar productos', 'INVENTARIO', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'ELIMINAR_PRODUCTOS', 'Puede eliminar productos', 'INVENTARIO', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'VER_VENTAS', 'Puede ver ventas', 'VENTAS', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'CREAR_VENTAS', 'Puede crear ventas', 'VENTAS', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'VER_COMPRAS', 'Puede ver compras', 'COMPRAS', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'CREAR_COMPRAS', 'Puede crear compras', 'COMPRAS', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'VER_REPORTES', 'Puede ver reportes', 'REPORTES', 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'GESTIONAR_USUARIOS', 'Puede gestionar usuarios', 'ADMINISTRACION', 1);
GO

-- Asociar permisos a roles (Administrador tiene todos los permisos)
INSERT INTO RolPermisos (idRol, idPermiso)
SELECT r.idRol, p.idPermiso
FROM Rol r
CROSS JOIN Permisos p
WHERE r.descripcion = 'Administrador'
  AND r.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'
  AND p.idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E';
GO

-- Usuario administrador
DECLARE @idUsuarioAdmin UNIQUEIDENTIFIER = NEWID();

INSERT INTO UsuarioWeb (
    idUsuario, idEmpresa, nombres, apellidos, email, password,
    idRol, estado, fRegistro
) VALUES (
    @idUsuarioAdmin,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    'Eric',
    'Ortiz Guevara',
    'ericortizguevara@gmail.com',
    '$2a$08$iD7U/5D7Kc.BOH06wQg/.uGB7pY9CNSd2LYwEabV3QM9GCHIYQmby',
    (SELECT idRol FROM Rol WHERE descripcion = 'Administrador' AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'),
    1,
    GETDATE()
);
GO

-- Sucursal principal
DECLARE @idSucursalPrincipal UNIQUEIDENTIFIER = NEWID();

INSERT INTO Sucursal (
    idSucursal, idEmpresa, nombre, direccion, telefono,
    responsable, estado, fRegistro
) VALUES (
    @idSucursalPrincipal,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    'Sucursal Principal',
    'PJ. LOS OLIVOS NRO. C-02 URB. H.U PALESTINA',
    '968073361',
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    1,
    GETDATE()
);
GO

-- Producto de ejemplo
DECLARE @idProductoEjemplo UNIQUEIDENTIFIER = NEWID();

-- Usuario puede acceder a la sucursal principal
INSERT INTO UsuarioSucursal (idUsuario, idSucursal)
SELECT uw.idUsuario, s.idSucursal
FROM UsuarioWeb uw
CROSS JOIN Sucursal s
WHERE uw.email = 'ericortizguevara@gmail.com'
  AND s.nombre = 'Sucursal Principal'
  AND uw.idEmpresa = s.idEmpresa;
GO

-- Categorías
INSERT INTO Categorias (idEmpresa, nombre, descripcion, estado, fCreacion) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'Electricidad', 'Materiales eléctricos', 1, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'Carpintería', 'Herramientas y materiales de carpintería', 1, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'Pintura', 'Pinturas y accesorios', 1, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'Plomería', 'Materiales de plomería', 1, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'Construcción', 'Materiales de construcción general', 1, GETDATE());
GO

-- Marcas
INSERT INTO Marcas (idEmpresa, nombre, descripcion, contacto, paginaWeb, estado, fCreacion) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'TRUPER', 'Herramientas y accesorios', 'VENDEDOR ROJER', 'https://www.truper.com', 1, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'BOSCH', 'Herramientas eléctricas', 'VENDEDOR MARIA', 'https://www.bosch.com', 1, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'GENERICO', 'Productos genéricos', NULL, NULL, 1, GETDATE());
GO

-- Comprobantes
INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', '01', 'Factura', 'F001', 1, 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', '03', 'Boleta', 'B001', 1, 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', '07', 'Nota de crédito', 'BC01', 1, 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', '08', 'Nota de débito', 'BD01', 1, 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'RA', 'Comunicación de baja', '-', 1, 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'TK', 'Ticket de despacho', 'TK01', 1, 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'NP', 'Nota de pedido', 'NP01', 1, 1),
('42099529-43C9-4B7F-921A-3D6FB946E93E', 'CT', 'Cotización', 'CT01', 1, 1);
GO

-- Lista de precios principal
INSERT INTO ListasPrecio (
    idEmpresa, nombre, idMoneda, principal, conIgv,
    fechaInicio, activo, fCreacion
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    'Lista General',
    (SELECT idMoneda FROM Moneda WHERE codigo = 'PEN'),
    1,  -- Lista principal
    1,  -- Con IGV
    GETDATE(),
    1,
    GETDATE()
);
GO

INSERT INTO Productos (
    idProducto, idEmpresa, codigo, idCategoria, descripcion,
    tipoProducto, idMarca, idPresentacion, cUnitario,
    alertaMinimo, alertaMaximo, idUsuario, fIngreso, estado
) VALUES (
    @idProductoEjemplo,
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    'PROD001',
    (SELECT idCategoria FROM Categorias WHERE nombre = 'Electricidad'),
    'Cable eléctrico 2.5mm - 100m',
    'S',  -- Simple
    (SELECT idMarca FROM Marcas WHERE nombre = 'GENERICO'),
    (SELECT idPresentacion FROM Presentacion WHERE codigo = 'RO'),
    85.50,  -- Costo unitario
    5,     -- Alerta mínimo
    100,   -- Alerta máximo
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    GETDATE(),
    1
);
GO

-- Precio del producto
INSERT INTO PreciosProducto (
    idLista, idProducto, precio, idMoneda, fActualizacion, idUsuario
) VALUES (
    (SELECT idLista FROM ListasPrecio WHERE nombre = 'Lista General' AND idEmpresa = '42099529-43C9-4B7F-921A-3D6FB946E93E'),
    @idProductoEjemplo,
    120.00,  -- Precio de venta
    (SELECT idMoneda FROM Moneda WHERE codigo = 'PEN'),
    GETDATE(),
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com')
);
GO

-- Stock inicial
INSERT INTO StockSucursal (
    idEmpresa, idSucursal, idProducto, cantidad, fIngreso,
    idUsuario, ubicacion
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    @idSucursalPrincipal,
    @idProductoEjemplo,
    50.00,  -- 50 rollos
    GETDATE(),
    (SELECT idUsuario FROM UsuarioWeb WHERE email = 'ericortizguevara@gmail.com'),
    'ANDAMIO-5'
);
GO

-- Lote inicial
INSERT INTO Lotes (
    idEmpresa, idProducto, idSucursal, costoUnitario,
    cantidadIngresada, cantidadDisponible, fechaIngreso, numeroLote
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    @idProductoEjemplo,
    @idSucursalPrincipal,
    85.50,
    50.00,
    50.00,
    GETDATE(),
    'LOTE-2024-001'
);
GO

-- Cliente de ejemplo
INSERT INTO Clientes (
    idEmpresa, idDocumento, ruc, rSocial, correo, celular,
    condicion, estado, fCreacion
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '6',  -- RUC
    '20123456789',
    'CONSTRUCTORA EJEMPLO S.A.C.',
    'compras@constructora.com',
    '987654321',
    'HABIDO',
    1,
    GETDATE()
);
GO

-- Proveedor de ejemplo
INSERT INTO Proveedores (
    idEmpresa, idDocumento, ruc, rSocial, correo, celular,
    condicion, estado, fCreacion
) VALUES (
    '42099529-43C9-4B7F-921A-3D6FB946E93E',
    '6',  -- RUC
    '20987654321',
    'DISTRIBUIDORA ELÉCTRICA S.A.',
    'ventas@distribuidora.com',
    '912345678',
    'HABIDO',
    1,
    GETDATE()
);
GO

-- Secuencias iniciales para comprobantes
INSERT INTO Secuencias (idEmpresa, idSucursal, idComprobante, serie, ultimoNumero, fActualizacion) VALUES
('42099529-43C9-4B7F-921A-3D6FB946E93E', @idSucursalPrincipal, '01', 'F001', 0, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', @idSucursalPrincipal, '03', 'B001', 0, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', @idSucursalPrincipal, '07', 'BC01', 0, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', @idSucursalPrincipal, '08', 'BD01', 0, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', @idSucursalPrincipal, 'TK', 'TK01', 0, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', @idSucursalPrincipal, 'NP', 'NP01', 0, GETDATE()),
('42099529-43C9-4B7F-921A-3D6FB946E93E', @idSucursalPrincipal, 'CT', 'CT01', 0, GETDATE());
GO

PRINT 'Datos iniciales insertados correctamente.';
PRINT 'La base de datos está lista para usar.';
PRINT 'Usuario administrador: ericortizguevara@gmail.com';
GO