-- Seed CatProductoSunatAnexo
-- Mismo contenido que: node scripts/seed-catalogo-producto-sunat.js
-- Requiere que exista la tabla (20260717_codigo_producto_sunat.sql)
SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.CatProductoSunatAnexo', N'U') IS NULL
BEGIN
    RAISERROR(N'No existe CatProductoSunatAnexo. Ejecute primero 20260717_codigo_producto_sunat.sql', 16, 1);
    RETURN;
END
GO

;WITH src AS (
    SELECT anexo, codigo, descripcion, partidaArancelaria
    FROM (VALUES
    ('25.1', '11101616', 'Mineral de oro', '2616.90.10.00'),
    ('25.1', '11101801', 'Oro', '2843.30.00.00, 2843.90.00.00, 7108.11.00.00, 7108.12.00.00, 7108.13.00.00, 7108.20.00.00 y 7112.91.00.00'),
    ('25.1', '12131500', 'Explosivos', '3601.00.00.00 y 2904.20.20.00'),
    ('25.1', '12131501', 'Dinamita', '3602.00.11.00'),
    ('25.1', '12131502', 'Cartuchos explosivos', '3602.00.90.00'),
    ('25.1', '12131503', 'Explosivos propelentes', NULL),
    ('25.1', '12131504', 'Cargas explosivas', NULL),
    ('25.1', '12131505', 'Explosivos plasticos', NULL),
    ('25.1', '12131506', 'Explosivos aluminizados', NULL),
    ('25.1', '12131508', 'Explosivos de polvo de nitroglicerina', NULL),
    ('25.1', '12131509', 'Nitrato de amonio y fuel oil', '3602.00.20.10'),
    ('25.1', '12131507', 'Explosivos de nitrato de amonio', '3602.00.20.90'),
    ('25.1', '12141726', 'Mercurio Hg', '2805.40.00.00'),
    ('25.1', '12352117', 'Cianuros o isocianuros', '2837.11.10.00 y 2811.12.00.00'),
    ('25.1', '15100000', 'Otros combustibles', NULL),
    ('25.1', '15101505', 'Combustible diesel', NULL),
    ('25.1', '15101506', 'Gasolina', NULL),
    ('25.1', '20101504', 'Cortadores de roca', '8430.39.00.00'),
    ('25.1', '20101600', 'Cribas y equipos de alimentacion', '8474.10.20.00 y 8474.10.90.00'),
    ('25.1', '20111601', 'Maquinaria de sondeo o de perforacion', '8430.41.00.00 y 8430.49.00.00'),
    ('25.1', '20111607', 'Maquinaria para hacer tuneles', '8430.31.00.00'),
    ('25.1', '22101501', 'Cargadores frontales', '8429.51.00.00 y 8429.52.00.00'),
    ('25.1', '22101502', 'Niveladoras', '8429.20.00.00 y 8429.52.00.00'),
    ('25.1', '22101505', 'Aplanadoras', '8429.40.00.00 y 8429.52.00.00'),
    ('25.1', '22101509', 'Retroexcavadoras', '8429.59.00.00 y 8429.52.00.00'),
    ('25.1', '22101511', 'Compactadores', '8429.40.00.00 y 8429.52.00.00'),
    ('25.1', '22101513', 'Dragalineas', '8905.10.00.00 y 8429.52.00.00'),
    ('25.1', '22101514', 'Dragas', '8905.10.00.00 y 8429.52.00.00'),
    ('25.1', '22101516', 'Excavadoras de fosos', '8429.52.00.00 y 8429.59.00.00'),
    ('25.1', '22101518', 'Raspadores elevadores', '8429.30.00.00 y 8429.52.00.00'),
    ('25.1', '22101519', 'Maquina giratoria con cazoleta de rastrillos abiertas', '8429.30.00.00 y 8429.52.00.00'),
    ('25.1', '22101520', 'Maquina giratoria con rastrillos elevadores', '8429.30.00.00 y 8429.52.00.00'),
    ('25.1', '22101521', 'Rastrilladora arrastrada', '8429.30.00.00 y 8429.52.00.00'),
    ('25.1', '22101522', 'Buldoceres de orugas', '8429.11.00.00 y 8429.52.00.00'),
    ('25.1', '22101523', 'Buldoceres de ruedas', '8429.19.00.00 y 8429.52.00.00'),
    ('25.1', '22101524', 'Excavadoras moviles', '8429.52.00.00 y 8429.59.00.00'),
    ('25.1', '22101525', 'Excavadoras de ruedas', '8429.52.00.00 y 8429.59.00.00'),
    ('25.1', '22101526', 'Excavadoras de orugas', '8429.52.00.00 y 8429.59.00.00'),
    ('25.1', '22101528', 'Cargadores de ruedas', '8429.51.00.00 y 8429.52.00.00'),
    ('25.1', '22101529', 'Cargadores sobre patines con direccion', '8429.51.00.00 y 8429.52.00.00'),
    ('25.1', '22101530', 'Raspadores abiertos', '8429.30.00.00 y 8429.52.00.00'),
    ('25.1', '22101532', 'Cargadores de orugas', '8429.51.00.00 y 8429.52.00.00'),
    ('25.1', '22101534', 'Excavadoras de campana', '8429.52.00.00 y 8429.59.00.00'),
    ('25.1', '22101602', 'Equipo de apisonamiento', '8429.40.00.00 y 8429.52.00.00'),
    ('25.1', '22101701', 'Palas excavadoras', '8429.52.00.00 y 8429.59.00.00'),
    ('25.1', '22101702', 'Palas mecanicas para el movimiento de tierra o sus piezas o accesorios', '8429.52.00.00 y 8429.59.00.00'),
    ('25.1', '22101713', 'Brazo de retroexcavadora o secciones del brazo', '8429.52.00.00 y 8429.59.00.00'),
    ('25.1', '22101714', 'Kits de reparacion o piezas de apisonadora', '8429.40.00.00'),
    ('25.1', '25181709', 'Pala cargadora', '8429.51.00.00 y 8429.52.00.00'),
    ('25.1', '26111600', 'Generadores de potencia', '8502.11.10.00, 8502.11.90.00, 8502.12.10.00, 8502.12.90.00, 8502.13.10.00, 8502.13.90.00, 8502.20.10.00, 8502.20.90.00, 8502.39.10.00 y 8502.39.90.00'),
    ('25.1', '26111603', 'Generadores eolicos', '8502.31.00.00'),
    ('25.1', '39121013', 'Convertidores rotativos electricos', '8502.40.00.00'),
    ('25.1', '40151530', 'Bombas de dragado', '8905.10.00.00'),
    ('25.1', '12352104', 'Alcoholes o sus sustitutos', '2207.10.00.00, 2207.20.00.10, 2207.20.00.90 y 2208.90.10.00'),
    ('25.1', '50161509', 'Azucares naturales o productos endulzantes', '1701.13.00.00, 1701.14.00.00, 1701.91.00.00, 1701.99.90.00, 1703.10.00.00'),
    ('25.1', '50221101', 'Grano de cereal', '1006.20.00.00, 1006.30.00.00, 1006.40.00.00 y 2302.20.00.00'),
    ('25.1', '71101710', 'Servicio de alquiler o leasing de maquinaria y equipo para mineria', NULL),
    ('25.1', '72141701', 'Servicio de alquiler o leasing de maquinaria para construccion', NULL),
    ('25.1', '72141702', 'Servicio de alquiler o leasing de equipo para construccion', NULL),
    ('25.1', '73121509', 'Servicios de purificacion de metales', NULL),
    ('25.1', '73121613', 'Servicios de fundicion de metales', NULL),
    ('25.1', '73121500', 'Procesos de fundicion y refinacion y formado de metales', NULL),
    ('25.2', '10171503', 'Harina, polvo y pellets de pescado, crustaceos, moluscos y demas invertebrados acuaticos', NULL),
    ('25.2', '11101600', 'Minerales metalicos no auriferos', NULL),
    ('25.2', '11101714', 'Plomo', NULL),
    ('25.2', '11111600', 'Piedra', NULL),
    ('25.2', '11111700', 'Arena', NULL),
    ('25.2', '11121600', 'Madera', NULL),
    ('25.2', '11140000', 'Chatarra y materiales de desecho', NULL),
    ('25.2', '50111500', 'Carnes y despojos comestibles', NULL),
    ('25.2', '50120000', 'Recursos hidrobiologicos', NULL),
    ('25.2', '50151600', 'Aceite de pescado', NULL),
    ('25.2', '50161509', 'Cana de Azucar', NULL),
    ('25.2', '50171500', 'Paprika', NULL),
    ('25.2', '50203205', 'Leche cruda entera', NULL),
    ('25.2', '50403200', 'Maiz amarillo', NULL),
    ('25.2', '11111111', 'Bienes gravados con el IGV por renuncia a la exoneracion', NULL),
    ('25.3', '12142104', 'Dioxido de carbono', NULL),
    ('25.3', '13111039', 'Poli (tereftalato de etileno) sin adicion de dioxido de titanio en formas primarias', NULL),
    ('25.3', '13102020', 'Envases o preformas de poli (tereftalato de etileno) (PET)', NULL),
    ('25.3', '15101502', 'Kerosene', NULL),
    ('25.3', '15101504', 'Combustible para Aviacion', NULL),
    ('25.3', '15101509', 'Combustible de uso marino (bunker)', NULL),
    ('25.3', '15111510', 'Gas licuado de petroleo', NULL),
    ('25.3', '24122000', 'Bombonas, botellas, frascos, bocales, tarros, envases tubulares, ampollas y demas recipientes de vidrio', NULL),
    ('25.3', '24122004', 'Tapones, tapas, capsulas y demas dispositivos de cierre', NULL),
    ('25.3', '50202201', 'Cerveza de malta', NULL),
    ('25.3', '50202300', 'Agua, incluida el agua mineral, natural o artificial y demas bebidas no alcoholicas', NULL),
    ('25.3', '50221002', 'Harina de trigo o de morcajo (tranquillon)', NULL),
    ('25.3', '50221110', 'Trigo y morcajo (tranquillon)', NULL)
    ) AS v(anexo, codigo, descripcion, partidaArancelaria)
)
MERGE dbo.CatProductoSunatAnexo AS t
USING src AS s
    ON t.codigo = s.codigo AND t.anexo = s.anexo
WHEN MATCHED THEN
    UPDATE SET
        descripcion = s.descripcion,
        partidaArancelaria = s.partidaArancelaria,
        activo = 1
WHEN NOT MATCHED THEN
    INSERT (codigo, anexo, descripcion, partidaArancelaria, activo)
    VALUES (s.codigo, s.anexo, s.descripcion, s.partidaArancelaria, 1);
GO

SELECT COUNT(1) AS filasCatProductoSunatAnexo FROM dbo.CatProductoSunatAnexo WHERE activo = 1;
GO
