---Estructura Recomendada para SQL Server
--- este código, asumo que tienes las siguientes tablas en tu SQL Server:

CREATE TABLE Empresa (
    id INT PRIMARY KEY IDENTITY,
    ruc VARCHAR(11) NOT NULL,
    razon_social VARCHAR(100) NOT NULL,
    nombre_comercial VARCHAR(100),
    direccion VARCHAR(200) NOT NULL,
    ubigeo CHAR(6) NOT NULL,
    distrito VARCHAR(50) NOT NULL,
    provincia VARCHAR(50) NOT NULL,
    departamento VARCHAR(50) NOT NULL
);

CREATE TABLE Comprobantes (
    id INT PRIMARY KEY IDENTITY,
    numero VARCHAR(20) NOT NULL,
    fecha_emision DATETIME NOT NULL,
    fecha_vencimiento DATETIME,
    tipo_documento CHAR(2) NOT NULL, -- 01=Factura, 03=Boleta
    moneda CHAR(3) DEFAULT 'PEN',
    subtotal DECIMAL(12,2) NOT NULL,
    total_igv DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    observaciones VARCHAR(500),
    cliente_id INT NOT NULL,
    estado CHAR(1) DEFAULT 'A'
	tipo_comprobante_afectado VARCHAR(2), -- Ej: '01' (Factura), '03' (Boleta)
    numero_comprobante_afectado VARCHAR(20), -- Número de la factura/boleta que se modifica
    motivo VARCHAR(500) -- Razón de la NC/ND (ej: "Anulación por error")
);



CREATE TABLE ComprobanteItems (
    id INT PRIMARY KEY IDENTITY,
    factura_id INT NOT NULL,
    orden INT NOT NULL,
    codigo_producto VARCHAR(30),
    descripcion VARCHAR(200) NOT NULL,
    cantidad DECIMAL(12,3) NOT NULL,
    unidad_medida CHAR(3) NOT NULL, -- NIU=Unidad, KGM=Kilogramo
    precio_unitario DECIMAL(12,2) NOT NULL,
    valor_venta DECIMAL(12,2) NOT NULL,
    igv DECIMAL(12,2) NOT NULL,
    codigo_sunat VARCHAR(10)
);

CREATE TABLE Clientes (
    id INT PRIMARY KEY IDENTITY,
    tipo_documento CHAR(1) NOT NULL, -- 6=RUC, 1=DNI
    numero_documento VARCHAR(11) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    direccion VARCHAR(200),
    ubigeo CHAR(6),
    distrito VARCHAR(50),
    provincia VARCHAR(50),
    departamento VARCHAR(50)
);

CREATE VIEW vw_NotasCredito_UBL AS
SELECT 
    id, numero, fecha_emision, tipo_documento, moneda,
    tipo_comprobante_afectado, numero_comprobante_afectado, motivo
FROM 
    Comprobantes
WHERE 
    tipo_documento = '07'; -- Solo NC



CREATE VIEW vw_NotasDebito_UBL AS
SELECT 
    id, numero, fecha_emision, tipo_documento, moneda,
    tipo_comprobante_afectado, numero_comprobante_afectado, motivo
FROM 
    Comprobantes
WHERE 
    tipo_documento = '08'; -- Solo ND