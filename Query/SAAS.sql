
CREATE TABLE Organizaciones (
    OrganizacionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Nombre NVARCHAR(100) NOT NULL,
    DominioPersonalizado NVARCHAR(100),
    RUC NVARCHAR(20),
    Direccion NVARCHAR(200),
    Telefono NVARCHAR(20),
    EmailContacto NVARCHAR(100),
    FechaRegistro DATETIME DEFAULT GETDATE(),
    FechaUltimaActualizacion DATETIME,
    Activo BIT DEFAULT 1,
    Configuracion NVARCHAR(MAX) -- JSON con configuraciones personalizadas
);

--tabla de planes---
CREATE TABLE Planes (
    PlanID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Nombre NVARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(200),
    PrecioMensual DECIMAL(10,2),
    PrecioAnual DECIMAL(10,2),
    Moneda NVARCHAR(3) DEFAULT 'USD',
    LimiteUsuarios INT,
    LimiteAlmacenamientoMB INT,
    Caracteristicas NVARCHAR(MAX), -- JSON con características del plan
    Activo BIT DEFAULT 1
);

CREATE TABLE PlanModulos (
    PlanModuloID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PlanID UNIQUEIDENTIFIER NOT NULL,
    ModuloID UNIQUEIDENTIFIER NOT NULL,
    AccesoCompleto BIT DEFAULT 0,
    FOREIGN KEY (PlanID) REFERENCES Planes(PlanID),
    FOREIGN KEY (ModuloID) REFERENCES Modulos(ModuloID)
);


--usuarios globales ---

CREATE TABLE Usuarios (
    UsuarioID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Email NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Salt NVARCHAR(100) NOT NULL,
    Nombre NVARCHAR(100),
    Apellido NVARCHAR(100),
    Telefono NVARCHAR(20),
    AvatarURL NVARCHAR(255),
    UltimoAcceso DATETIME,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    RequiereCambioPassword BIT DEFAULT 0,
    Bloqueado BIT DEFAULT 0,
    MotivoBloqueo NVARCHAR(200)
);

CREATE TABLE MiembrosOrganizacion (
    MiembroID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    UsuarioID UNIQUEIDENTIFIER NOT NULL,
    RolID UNIQUEIDENTIFIER NOT NULL,
    FechaUnion DATETIME DEFAULT GETDATE(),
    FechaInvitacion DATETIME,
    InvitacionToken NVARCHAR(100),
    Estado NVARCHAR(20) DEFAULT 'Activo', -- 'Activo', 'Pendiente', 'Inactivo'
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (RolID) REFERENCES Roles(RolID),
    CONSTRAINT UQ_MiembroOrganizacion UNIQUE (OrganizacionID, UsuarioID)
);


---tabla de roless y permisos----

CREATE TABLE Roles (
    RolID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(200),
    EsSistema BIT DEFAULT 0, -- Para roles predefinidos
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID)
);

CREATE TABLE Permisos (
    PermisoID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Codigo NVARCHAR(50) NOT NULL UNIQUE,
    Descripcion NVARCHAR(200),
    Modulo NVARCHAR(50)
);

CREATE TABLE RolPermisos (
    RolPermisoID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RolID UNIQUEIDENTIFIER NOT NULL,
    PermisoID UNIQUEIDENTIFIER NOT NULL,
    FOREIGN KEY (RolID) REFERENCES Roles(RolID),
    FOREIGN KEY (PermisoID) REFERENCES Permisos(PermisoID),
    CONSTRAINT UQ_RolPermiso UNIQUE (RolID, PermisoID)
);


----Tablas de Suscripciones y Facturación---

CREATE TABLE Suscripciones (
    SuscripcionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    PlanID UNIQUEIDENTIFIER NOT NULL,
    FechaInicio DATETIME NOT NULL,
    FechaFin DATETIME NOT NULL,
    CicloFacturacion NVARCHAR(10) NOT NULL, -- 'Mensual', 'Anual'
    Estado NVARCHAR(20) DEFAULT 'Activa', -- 'Activa', 'Cancelada', 'Suspendida'
    MetodoPagoID UNIQUEIDENTIFIER,
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (PlanID) REFERENCES Planes(PlanID),
    FOREIGN KEY (MetodoPagoID) REFERENCES MetodosPago(MetodoPagoID)
);

CREATE TABLE Facturas (
    FacturaID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    SuscripcionID UNIQUEIDENTIFIER NOT NULL,
    NumeroFactura NVARCHAR(20) NOT NULL,
    FechaEmision DATETIME NOT NULL,
    FechaVencimiento DATETIME NOT NULL,
    Subtotal DECIMAL(10,2) NOT NULL,
    Impuestos DECIMAL(10,2) NOT NULL,
    Total DECIMAL(10,2) NOT NULL,
    Moneda NVARCHAR(3) DEFAULT 'USD',
    Estado NVARCHAR(20) DEFAULT 'Pendiente', -- 'Pagada', 'Pendiente', 'Vencida'
    MetodoPagoID UNIQUEIDENTIFIER,
    FOREIGN KEY (SuscripcionID) REFERENCES Suscripciones(SuscripcionID),
    FOREIGN KEY (MetodoPagoID) REFERENCES MetodosPago(MetodoPagoID)
);


--tabla metodo de pago---

CREATE TABLE MetodosPago (
    MetodoPagoID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    Tipo NVARCHAR(20) NOT NULL, -- 'Tarjeta', 'Transferencia', 'PayPal'
    UltimosDigitos NVARCHAR(4),
    NombreTitular NVARCHAR(100),
    FechaVencimiento DATE,
    TokenPago NVARCHAR(100), -- Para gateways de pago
    Predeterminado BIT DEFAULT 0,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID)
);


-----Tabla de Módulos del Sistema----


CREATE TABLE Modulos (
    ModuloID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Nombre NVARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(200),
    Icono NVARCHAR(50),
    Ruta NVARCHAR(100),
    Orden INT,
    Activo BIT DEFAULT 1,
    EsSistema BIT DEFAULT 0 -- Para módulos base del SaaS
);


CREATE TABLE ConfiguracionesOrganizacion (
    ConfiguracionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    ModuloID UNIQUEIDENTIFIER,
    Clave NVARCHAR(50) NOT NULL,
    Valor NVARCHAR(MAX),
    Tipo NVARCHAR(20) DEFAULT 'String', -- 'String', 'Number', 'Boolean', 'JSON'
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (ModuloID) REFERENCES Modulos(ModuloID),
    CONSTRAINT UQ_ConfiguracionOrganizacion UNIQUE (OrganizacionID, ModuloID, Clave)
);


------Tabla de Logs del Sistema----

CREATE TABLE LogsSistema (
    LogID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER,
    UsuarioID UNIQUEIDENTIFIER,
    Accion NVARCHAR(50) NOT NULL,
    Entidad NVARCHAR(50),
    EntidadID NVARCHAR(50),
    Detalles NVARCHAR(MAX),
    DireccionIP NVARCHAR(50),
    UserAgent NVARCHAR(200),
    FechaHora DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID)
);


----Tabla de Actividad de Usuarios----
CREATE TABLE ActividadUsuarios (
    ActividadID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UsuarioID UNIQUEIDENTIFIER NOT NULL,
    OrganizacionID UNIQUEIDENTIFIER,
    TipoActividad NVARCHAR(50) NOT NULL,
    Descripcion NVARCHAR(200),
    FechaHora DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID)
);


-----Vista de Organizaciones con Suscripción Activa---


CREATE VIEW vw_OrganizacionesActivas AS
SELECT 
    o.OrganizacionID,
    o.Nombre,
    o.DominioPersonalizado,
    o.FechaRegistro,
    p.Nombre AS PlanActual,
    s.FechaFin AS ProximoVencimiento,
    s.Estado AS EstadoSuscripcion
FROM Organizaciones o
INNER JOIN Suscripciones s ON o.OrganizacionID = s.OrganizacionID
INNER JOIN Planes p ON s.PlanID = p.PlanID
WHERE s.Estado = 'Activa' AND s.FechaFin >= GETDATE();



---- Vista de Usuarios con Acceso a Organización---

CREATE VIEW vw_UsuariosOrganizacion AS
SELECT 
    mo.OrganizacionID,
    u.UsuarioID,
    u.Email,
    u.Nombre,
    u.Apellido,
    r.Nombre AS Rol,
    mo.Estado AS EstadoMiembro
FROM MiembrosOrganizacion mo
INNER JOIN Usuarios u ON mo.UsuarioID = u.UsuarioID
INNER JOIN Roles r ON mo.RolID = r.RolID;


-----Índices Recomendados------
-- Índices para mejor performance en consultas frecuentes
CREATE INDEX IX_Usuarios_Email ON Usuarios(Email);
CREATE INDEX IX_MiembrosOrganizacion_Usuario ON MiembrosOrganizacion(UsuarioID);
CREATE INDEX IX_MiembrosOrganizacion_Organizacion ON MiembrosOrganizacion(OrganizacionID);
CREATE INDEX IX_Suscripciones_Organizacion ON Suscripciones(OrganizacionID);
CREATE INDEX IX_Suscripciones_FechaFin ON Suscripciones(FechaFin);
CREATE INDEX IX_LogsSistema_FechaHora ON LogsSistema(FechaHora DESC);


----->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>><



----Tabla de Productos (Estructura Flexible)-----
CREATE TABLE Productos (
    ProductoID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    Codigo NVARCHAR(50),
    Nombre NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(500),
    TipoProducto NVARCHAR(20) NOT NULL, -- 'Simple', 'Compuesto', 'Servicio', 'Platillo'
    CategoriaID UNIQUEIDENTIFIER,
    UnidadMedidaBase NVARCHAR(20),
    PrecioVenta DECIMAL(18,2),
    CostoPromedio DECIMAL(18,2),
    ControlStock BIT DEFAULT 1,
    Activo BIT DEFAULT 1,
    ImagenURL NVARCHAR(255),
    FechaCreacion DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (CategoriaID) REFERENCES CategoriasProducto(CategoriaID)
);


----Tabla de Recetas/Componentes (Para productos compuestos)----

CREATE TABLE Recetas (
    RecetaID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProductoPadreID UNIQUEIDENTIFIER NOT NULL,
    ProductoComponenteID UNIQUEIDENTIFIER NOT NULL,
    Cantidad DECIMAL(18,4) NOT NULL,
    UnidadMedida NVARCHAR(20),
    Instrucciones NVARCHAR(MAX),
    Orden INT,
    Opcional BIT DEFAULT 0,
    FOREIGN KEY (ProductoPadreID) REFERENCES Productos(ProductoID),
    FOREIGN KEY (ProductoComponenteID) REFERENCES Productos(ProductoID)
);


-----Tabla de Variantes (Para ropa, tallas, colores, etc.)--------


CREATE TABLE VariantesProducto (
    VarianteID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProductoID UNIQUEIDENTIFIER NOT NULL,
    CodigoVariante NVARCHAR(50),
    NombreVariante NVARCHAR(100),
    FOREIGN KEY (ProductoID) REFERENCES Productos(ProductoID)
);

CREATE TABLE AtributosVariante (
    AtributoID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(50) NOT NULL, -- 'Talla', 'Color', 'Material'
    TipoDato NVARCHAR(20) NOT NULL, -- 'Texto', 'Numero', 'Lista'
    EsGlobal BIT DEFAULT 1,
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID)
);

CREATE TABLE ValoresAtributo (
    ValorID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    AtributoID UNIQUEIDENTIFIER NOT NULL,
    Valor NVARCHAR(100) NOT NULL,
    Orden INT,
    FOREIGN KEY (AtributoID) REFERENCES AtributosVariante(AtributoID)
);

CREATE TABLE VarianteAtributos (
    VarianteAtributoID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VarianteID UNIQUEIDENTIFIER NOT NULL,
    AtributoID UNIQUEIDENTIFIER NOT NULL,
    ValorID UNIQUEIDENTIFIER,
    ValorPersonalizado NVARCHAR(100),
    FOREIGN KEY (VarianteID) REFERENCES VariantesProducto(VarianteID),
    FOREIGN KEY (AtributoID) REFERENCES AtributosVariante(AtributoID),
    FOREIGN KEY (ValorID) REFERENCES ValoresAtributo(ValorID)
);


--------------Estructura para Restaurantes--------------------

CREATE TABLE Menus (
    MenuID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(200),
    HoraInicio TIME,
    HoraFin TIME,
    Activo BIT DEFAULT 1,
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID)
);

CREATE TABLE MenuItems (
    MenuItemID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    MenuID UNIQUEIDENTIFIER NOT NULL,
    ProductoID UNIQUEIDENTIFIER NOT NULL,
    Seccion NVARCHAR(50),
    Orden INT,
    PrecioPersonalizado DECIMAL(18,2),
    Destacado BIT DEFAULT 0,
    FOREIGN KEY (MenuID) REFERENCES Menus(MenuID),
    FOREIGN KEY (ProductoID) REFERENCES Productos(ProductoID)
);

CREATE TABLE AreasRestaurante (
    AreaID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    Nombre NVARCHAR(50) NOT NULL,
    Icono NVARCHAR(20),
    Color NVARCHAR(20),
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID)
);

CREATE TABLE Mesas (
    MesaID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    AreaID UNIQUEIDENTIFIER NOT NULL,
    Numero NVARCHAR(20) NOT NULL,
    Capacidad INT,
    PosicionX INT,
    PosicionY INT,
    Estado NVARCHAR(20) DEFAULT 'Libre', -- 'Libre', 'Ocupada', 'Reservada'
    FOREIGN KEY (AreaID) REFERENCES AreasRestaurante(AreaID)
);


---------- Estructura para Retail/Ferreterías---------

CREATE TABLE Proveedores (
    ProveedorID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    Codigo NVARCHAR(20),
    Nombre NVARCHAR(100) NOT NULL,
    RUC NVARCHAR(20),
    Direccion NVARCHAR(200),
    Telefono NVARCHAR(20),
    Email NVARCHAR(100),
    DiasCredito INT,
    Activo BIT DEFAULT 1,
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID)
);

CREATE TABLE OrdenesCompra (
    OrdenCompraID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    ProveedorID UNIQUEIDENTIFIER NOT NULL,
    NumeroDocumento NVARCHAR(20),
    FechaEmision DATE NOT NULL,
    FechaEntregaEsperada DATE,
    Subtotal DECIMAL(18,2),
    Impuestos DECIMAL(18,2),
    Total DECIMAL(18,2),
    Estado NVARCHAR(20) DEFAULT 'Pendiente', -- 'Pendiente', 'Recibida', 'Cancelada'
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (ProveedorID) REFERENCES Proveedores(ProveedorID)
);

CREATE TABLE DetalleOrdenCompra (
    DetalleID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrdenCompraID UNIQUEIDENTIFIER NOT NULL,
    ProductoID UNIQUEIDENTIFIER NOT NULL,
    Cantidad DECIMAL(18,2) NOT NULL,
    PrecioUnitario DECIMAL(18,2) NOT NULL,
    Descuento DECIMAL(18,2) DEFAULT 0,
    FOREIGN KEY (OrdenCompraID) REFERENCES OrdenesCompra(OrdenCompraID),
    FOREIGN KEY (ProductoID) REFERENCES Productos(ProductoID)
);


-----------Estructura Común para Todos los Rubros-----------

CREATE TABLE Clientes (
    ClienteID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    TipoDocumento NVARCHAR(20),
    NumeroDocumento NVARCHAR(20),
    Nombre NVARCHAR(100) NOT NULL,
    Direccion NVARCHAR(200),
    Telefono NVARCHAR(20),
    Email NVARCHAR(100),
    FechaNacimiento DATE,
    TipoCliente NVARCHAR(20), -- 'Normal', 'Frecuente', 'Mayorista'
    Puntos INT DEFAULT 0,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID)
);


--VENTAS----

CREATE TABLE Ventas (
    VentaID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    ClienteID UNIQUEIDENTIFIER,
    NumeroDocumento NVARCHAR(20),
    FechaHora DATETIME DEFAULT GETDATE(),
    Subtotal DECIMAL(18,2),
    Descuentos DECIMAL(18,2),
    Impuestos DECIMAL(18,2),
    Total DECIMAL(18,2),
    Estado NVARCHAR(20) DEFAULT 'Pendiente', -- 'Pendiente', 'Completada', 'Cancelada'
    TipoVenta NVARCHAR(20), -- 'Mostrador', 'Delivery', 'Reserva'
    UsuarioID UNIQUEIDENTIFIER,
    MesaID UNIQUEIDENTIFIER,
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (ClienteID) REFERENCES Clientes(ClienteID),
    FOREIGN KEY (UsuarioID) REFERENCES Usuarios(UsuarioID),
    FOREIGN KEY (MesaID) REFERENCES Mesas(MesaID)
);

CREATE TABLE DetalleVenta (
    DetalleID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VentaID UNIQUEIDENTIFIER NOT NULL,
    ProductoID UNIQUEIDENTIFIER NOT NULL,
    VarianteID UNIQUEIDENTIFIER,
    Cantidad DECIMAL(18,2) NOT NULL,
    PrecioUnitario DECIMAL(18,2) NOT NULL,
    Descuento DECIMAL(18,2) DEFAULT 0,
    Notas NVARCHAR(200),
    FOREIGN KEY (VentaID) REFERENCES Ventas(VentaID),
    FOREIGN KEY (ProductoID) REFERENCES Productos(ProductoID),
    FOREIGN KEY (VarianteID) REFERENCES VariantesProducto(VarianteID)
);


-------Estructura de Almacenes Multi-Rubro----

CREATE TABLE Almacenes (
    AlmacenID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    Codigo NVARCHAR(20) NOT NULL,
    Nombre NVARCHAR(100) NOT NULL,
    Direccion NVARCHAR(200),
    Tipo NVARCHAR(20) NOT NULL, -- 'Principal', 'Secundario', 'Virtual', 'Mostrador'
    ResponsableID UNIQUEIDENTIFIER,
    Activo BIT DEFAULT 1,
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (ResponsableID) REFERENCES Usuarios(UsuarioID)
);

CREATE TABLE Inventario (
    InventarioID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    ProductoID UNIQUEIDENTIFIER NOT NULL,
    AlmacenID UNIQUEIDENTIFIER NOT NULL,
    VarianteID UNIQUEIDENTIFIER,
    CantidadDisponible DECIMAL(18,2) DEFAULT 0,
    CantidadReservada DECIMAL(18,2) DEFAULT 0,
    StockMinimo DECIMAL(18,2),
    StockMaximo DECIMAL(18,2),
    Ubicacion NVARCHAR(50),
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (ProductoID) REFERENCES Productos(ProductoID),
    FOREIGN KEY (AlmacenID) REFERENCES Almacenes(AlmacenID),
    FOREIGN KEY (VarianteID) REFERENCES VariantesProducto(VarianteID),
    CONSTRAINT UQ_Inventario UNIQUE (ProductoID, AlmacenID, VarianteID)
);

-----Tablas de Configuración por Rubro-------

CREATE TABLE PlantillasRubro (
    PlantillaID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Nombre NVARCHAR(50) NOT NULL, -- 'Restaurante', 'Retail', 'Ferretería', 'Juguetería'
    Descripcion NVARCHAR(200),
    ConfiguracionInicial NVARCHAR(MAX) -- JSON con módulos, configuraciones y datos iniciales
);

CREATE TABLE OrganizacionPlantilla (
    OrganizacionPlantillaID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrganizacionID UNIQUEIDENTIFIER NOT NULL,
    PlantillaID UNIQUEIDENTIFIER NOT NULL,
    FechaAsignacion DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (OrganizacionID) REFERENCES Organizaciones(OrganizacionID),
    FOREIGN KEY (PlantillaID) REFERENCES PlantillasRubro(PlantillaID)
);



-------Vistas Especializadas--------------

CREATE VIEW vw_ProductosConStock AS
SELECT 
    p.ProductoID,
    p.OrganizacionID,
    p.Codigo,
    p.Nombre,
    p.TipoProducto,
    i.AlmacenID,
    a.Nombre AS Almacen,
    i.VarianteID,
    v.NombreVariante,
    i.CantidadDisponible,
    i.CantidadReservada,
    (i.CantidadDisponible - i.CantidadReservada) AS StockActual,
    i.StockMinimo,
    i.StockMaximo,
    i.Ubicacion
FROM Productos p
LEFT JOIN Inventario i ON p.ProductoID = i.ProductoID
LEFT JOIN Almacenes a ON i.AlmacenID = a.AlmacenID
LEFT JOIN VariantesProducto v ON i.VarianteID = v.VarianteID
WHERE p.Activo = 1;


CREATE VIEW vw_PlatillosConIngredientes AS
SELECT 
    p.ProductoID AS PlatilloID,
    p.Nombre AS Platillo,
    p.PrecioVenta AS PrecioPlatillo,
    c.ProductoID AS IngredienteID,
    pc.Nombre AS Ingrediente,
    r.Cantidad,
    r.UnidadMedida,
    i.CantidadDisponible AS StockIngrediente,
    (i.CantidadDisponible / NULLIF(r.Cantidad, 0)) AS PlatillosDisponibles
FROM Productos p
JOIN Recetas r ON p.ProductoID = r.ProductoPadreID
JOIN Productos pc ON r.ProductoComponenteID = pc.ProductoID
LEFT JOIN Inventario i ON pc.ProductoID = i.ProductoID AND i.AlmacenID = (
    SELECT TOP 1 AlmacenID FROM Almacenes 
    WHERE OrganizacionID = p.OrganizacionID AND Tipo = 'Principal'
)
WHERE p.TipoProducto = 'Compuesto' OR p.TipoProducto = 'Platillo';