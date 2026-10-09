const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');
const ProductosRepository = require('../repositories/productos.repository');
const preciosVRepository = require('../repositories/preciosV.repository');
const inventarioRepository = require('../repositories/inventario.repository');

const CATALOGOS_DEMO = {
  avicola: [
    { codigo: 'AVI-001', descripcion: 'Pollo Entero Fresco (kg)', unidad: 'KGM', costo: 6.80, precio: 9.00, stock: 60 },
    { codigo: 'AVI-002', descripcion: 'Pechuga Especial con Hueso (kg)', unidad: 'KGM', costo: 10.50, precio: 14.50, stock: 30 },
    { codigo: 'AVI-003', descripcion: 'Pierna con Encuentro (kg)', unidad: 'KGM', costo: 8.00, precio: 11.00, stock: 40 },
    { codigo: 'AVI-004', descripcion: 'Menudencia de Pollo (kg)', unidad: 'KGM', costo: 3.50, precio: 5.50, stock: 25 },
    { codigo: 'AVI-005', descripcion: 'Huevos Rosados - Bandeja x 30 und', unidad: 'NIU', costo: 14.00, precio: 18.50, stock: 40 },
    { codigo: 'AVI-006', descripcion: 'Huevos al Peso (kg)', unidad: 'KGM', costo: 5.80, precio: 7.80, stock: 80 }
  ],
  botica: [
    { codigo: 'BOT-001', descripcion: 'Paracetamol 500mg x 100 tabletas (Portugal)', unidad: 'NIU', costo: 4.50, precio: 8.00, stock: 30 },
    { codigo: 'BOT-002', descripcion: 'Amoxicilina 500mg x 100 cápsulas (Medifarma)', unidad: 'NIU', costo: 12.00, precio: 18.50, stock: 25 },
    { codigo: 'BOT-003', descripcion: 'Ibuprofeno 400mg x 100 tabletas', unidad: 'NIU', costo: 5.50, precio: 9.50, stock: 35 },
    { codigo: 'BOT-004', descripcion: 'Alcohol Medicinal 70° Frasco x 1L', unidad: 'NIU', costo: 6.50, precio: 9.50, stock: 40 },
    { codigo: 'BOT-005', descripcion: 'Algodón Hidrófilo 100g Farmacia', unidad: 'NIU', costo: 2.80, precio: 4.50, stock: 50 },
    { codigo: 'BOT-006', descripcion: 'Mascarillas Quirúrgicas 3 pliegues x 50 und', unidad: 'NIU', costo: 5.00, precio: 8.50, stock: 40 }
  ],
  carniceria: [
    { codigo: 'CAR-001', descripcion: 'Bistec de Res - Lomo (kg)', unidad: 'KGM', costo: 24.00, precio: 32.00, stock: 25 },
    { codigo: 'CAR-002', descripcion: 'Carne Molida Especial (kg)', unidad: 'KGM', costo: 16.00, precio: 22.00, stock: 35 },
    { codigo: 'CAR-003', descripcion: 'Chuleta de Cerdo (kg)', unidad: 'KGM', costo: 14.50, precio: 19.50, stock: 30 },
    { codigo: 'CAR-004', descripcion: 'Costillar de Cerdo (kg)', unidad: 'KGM', costo: 17.00, precio: 24.00, stock: 20 }
  ],
  ferreteria: [
    { codigo: 'FER-001', descripcion: 'Cemento Sol Tipo I x 42.5 kg', unidad: 'NIU', costo: 25.00, precio: 28.50, stock: 100 },
    { codigo: 'FER-002', descripcion: 'Tubo PVC Sel 1/2" x 3m Pavco', unidad: 'NIU', costo: 6.00, precio: 8.50, stock: 50 },
    { codigo: 'FER-003', descripcion: 'Alambre Negro #16 Recocido (kg)', unidad: 'KGM', costo: 4.80, precio: 6.50, stock: 80 },
    { codigo: 'FER-004', descripcion: 'Martillo de Uña 16 oz Truper', unidad: 'NIU', costo: 15.00, precio: 22.00, stock: 15 },
    { codigo: 'FER-005', descripcion: 'Disco de Corte Metal 4 1/2" DeWalt', unidad: 'NIU', costo: 3.80, precio: 5.50, stock: 40 }
  ],
  abarrotes: [
    { codigo: 'ABA-001', descripcion: 'Arroz Costeño Extra x 5 kg', unidad: 'NIU', costo: 18.50, precio: 22.50, stock: 30 },
    { codigo: 'ABA-002', descripcion: 'Aceite Primor Clásico 900 ml', unidad: 'NIU', costo: 7.20, precio: 8.80, stock: 48 },
    { codigo: 'ABA-003', descripcion: 'Azúcar Rubia Paramonga (kg)', unidad: 'KGM', costo: 3.40, precio: 4.20, stock: 100 },
    { codigo: 'ABA-004', descripcion: 'Leche Gloria Azul 400g', unidad: 'NIU', costo: 3.60, precio: 4.30, stock: 72 },
    { codigo: 'ABA-005', descripcion: 'Fideos Don Vittorio Spaghetti 450g', unidad: 'NIU', costo: 2.50, precio: 3.20, stock: 50 }
  ],
  repuestos: [
    { codigo: 'REP-001', descripcion: 'Aceite para Motor 20W-50 1L Castrol', unidad: 'NIU', costo: 22.00, precio: 29.00, stock: 24 },
    { codigo: 'REP-002', descripcion: 'Filtro de Aceite Automotriz', unidad: 'NIU', costo: 12.00, precio: 18.00, stock: 20 },
    { codigo: 'REP-003', descripcion: 'Pastillas de Freno Delanteras', unidad: 'NIU', costo: 35.00, precio: 52.00, stock: 12 },
    { codigo: 'REP-004', descripcion: 'Bujía de Encendido NGK', unidad: 'NIU', costo: 9.00, precio: 14.00, stock: 30 }
  ],
  ropa: [
    { codigo: 'TEX-001', descripcion: 'Pantalón Jean Clásico Varón', unidad: 'NIU', costo: 38.00, precio: 59.00, stock: 25 },
    { codigo: 'TEX-002', descripcion: 'Polo Algodón Cuello Redondo', unidad: 'NIU', costo: 16.00, precio: 26.00, stock: 40 },
    { codigo: 'TEX-003', descripcion: 'Casaca Impermeable Unisex', unidad: 'NIU', costo: 45.00, precio: 75.00, stock: 18 }
  ],
  veterinaria: [
    { codigo: 'VET-001', descripcion: 'Alimento Perro Adulto Ricocan 15kg (Saco)', unidad: 'NIU', costo: 72.00, precio: 92.00, stock: 15 },
    { codigo: 'VET-002', descripcion: 'Alimento Canino a Granel (kg)', unidad: 'KGM', costo: 4.80, precio: 6.80, stock: 60 },
    { codigo: 'VET-003', descripcion: 'Antipulgas Pipeta Frontline Mediano', unidad: 'NIU', costo: 22.00, precio: 32.00, stock: 20 },
    { codigo: 'VET-004', descripcion: 'Shampoo Medicado Antipulgas 250ml', unidad: 'NIU', costo: 11.00, precio: 16.50, stock: 25 }
  ],
  libreria: [
    { codigo: 'LIB-001', descripcion: 'Cuaderno Cuadriculado 100H Standford A4', unidad: 'NIU', costo: 3.50, precio: 5.50, stock: 50 },
    { codigo: 'LIB-002', descripcion: 'Millar Papel Bond 75g A4 Chamex', unidad: 'NIU', costo: 14.50, precio: 18.50, stock: 30 },
    { codigo: 'LIB-003', descripcion: 'Lapicero Pilot G-2 0.7mm Azul (Caja x 12)', unidad: 'NIU', costo: 28.00, precio: 38.00, stock: 15 },
    { codigo: 'LIB-004', descripcion: 'Resaltador Faber-Castell 48 Amarillo', unidad: 'NIU', costo: 2.00, precio: 3.50, stock: 40 }
  ],
  licoreria: [
    { codigo: 'LIC-001', descripcion: 'Cerveza Pilsen Callao 310ml (Six Pack)', unidad: 'NIU', costo: 18.50, precio: 23.00, stock: 30 },
    { codigo: 'LIC-002', descripcion: 'Whisky Johnnie Walker Red Label 750ml', unidad: 'NIU', costo: 42.00, precio: 58.00, stock: 15 },
    { codigo: 'LIC-003', descripcion: 'Gaseosa Coca Cola 3 Litros No Retornable', unidad: 'NIU', costo: 9.50, precio: 12.50, stock: 24 },
    { codigo: 'LIC-004', descripcion: 'Hielo en Cubos x 3 kg (Bolsa)', unidad: 'NIU', costo: 3.00, precio: 5.00, stock: 40 }
  ],
  general: [
    { codigo: 'DEM-001', descripcion: 'Producto de Muestra A (Unidad)', unidad: 'NIU', costo: 18.00, precio: 25.00, stock: 25 },
    { codigo: 'DEM-002', descripcion: 'Producto de Muestra B (Unidad)', unidad: 'NIU', costo: 10.00, precio: 15.00, stock: 35 },
    { codigo: 'DEM-003', descripcion: 'Producto al Peso C (Kilogramo)', unidad: 'KGM', costo: 6.50, precio: 9.50, stock: 50 }
  ]
};

function resolverTipoCatalogo(rubro) {
  const r = String(rubro || '').toLowerCase();
  if (/av[ií]col|pollo|ave/i.test(r)) return 'avicola';
  if (/farmac|botic|medicament|salud|droguer/i.test(r)) return 'botica';
  if (/carnicer|carne|frigor[ií]fic/i.test(r)) return 'carniceria';
  if (/ferreter|construc|ferret|pintur/i.test(r)) return 'ferreteria';
  if (/abarrot|minimarket|bodega|market|tienda/i.test(r)) return 'abarrotes';
  if (/repuesto|automotr|mecanic|taller|moto/i.test(r)) return 'repuestos';
  if (/ropa|textil|calzado|zapat|moda|boutique/i.test(r)) return 'ropa';
  if (/veterin|agropec|mascota|pet/i.test(r)) return 'veterinaria';
  if (/librer|papeler|utiles/i.test(r)) return 'libreria';
  if (/licor|cerveza|bebida/i.test(r)) return 'licoreria';
  return 'general';
}

async function resolverPresentaciones(pool) {
  const map = { NIU: 1, KGM: 1 };
  try {
    const res = await pool.request().query("SELECT idPresentacion, UPPER(LTRIM(RTRIM(codigo))) AS codigo FROM Presentacion WHERE codigo IN ('NIU', 'KGM')");
    for (const row of res.recordset || []) {
      if (row.codigo === 'NIU') map.NIU = row.idPresentacion;
      if (row.codigo === 'KGM') map.KGM = row.idPresentacion;
    }
  } catch (err) {
    console.error('resolverPresentaciones demo seed error:', err.message);
  }
  return map;
}

/**
 * Precarga un conjunto de productos de muestra de acuerdo al rubro para empresas demo.
 * Idempotente: si la empresa ya tiene productos registrados, omite la operación.
 */
async function seedProductosDemoSegunRubro(pool, idEmpresa, opciones = {}) {
  try {
    // 1. Verificar si ya existen productos
    const chk = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('SELECT COUNT(*) AS total FROM Productos WHERE idEmpresa = @idEmpresa');
    if ((chk.recordset?.[0]?.total || 0) > 0) {
      return { ok: true, skipped: true, razon: 'empresa_ya_tiene_productos' };
    }

    // 2. Resolver dependencias básicas de la empresa
    // A. Sucursal
    let idSucursal = opciones.idSucursal;
    if (!idSucursal) {
      const sucRes = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT TOP 1 idSucursal FROM Sucursal WHERE idEmpresa = @idEmpresa ORDER BY CASE WHEN ISNULL(esPrincipal,0) = 1 THEN 0 ELSE 1 END, fregistro ASC');
      idSucursal = sucRes.recordset?.[0]?.idSucursal;
    }
    if (!idSucursal) return { ok: false, error: 'La empresa no cuenta con una sucursal registrada.' };

    // B. Usuario administrador o del token
    let idUsuario = opciones.idUsuario;
    if (!idUsuario) {
      const usuRes = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query("SELECT TOP 1 idUsuario FROM UsuarioWeb WHERE idEmpresa = @idEmpresa ORDER BY CASE WHEN rol = 'Administrador' THEN 0 ELSE 1 END, fregistro ASC");
      idUsuario = usuRes.recordset?.[0]?.idUsuario;
    }
    if (!idUsuario) return { ok: false, error: 'No se encontró un usuario administrador para registrar los productos.' };

    // C. Lista de precios (tabla: ListasPrecio)
    let idListaPrecio = opciones.idListaPrecio;
    if (!idListaPrecio) {
      const lpRes = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT TOP 1 idLista FROM ListasPrecio WHERE idEmpresa = @idEmpresa ORDER BY idLista ASC');
      idListaPrecio = lpRes.recordset?.[0]?.idLista;
    }
    if (!idListaPrecio) {
      try {
        const lpIns = await pool
          .request()
          .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
          .input('idSucursal', sql.UniqueIdentifier, idSucursal)
          .query("INSERT INTO ListasPrecio (idEmpresa, idSucursal, nombre, estado) OUTPUT INSERTED.idLista VALUES (@idEmpresa, @idSucursal, 'Precio General', 1)");
        idListaPrecio = lpIns.recordset?.[0]?.idLista;
      } catch (errLp) {
        console.error('ListasPrecio fallback insert:', errLp.message);
      }
    }

    // D. Categoría inicial
    const catRes = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('SELECT TOP 1 idCategoria FROM Categorias WHERE idEmpresa = @idEmpresa ORDER BY idCategoria ASC');
    let idCategoria = catRes.recordset?.[0]?.idCategoria;
    if (!idCategoria) {
      const catIns = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query("INSERT INTO Categorias (idEmpresa, nombre, descripcion, estado) OUTPUT INSERTED.idCategoria VALUES (@idEmpresa, 'General', 'Categoría inicial', 1)");
      idCategoria = catIns.recordset?.[0]?.idCategoria || 1;
    }

    // E. Marca inicial
    const marRes = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query("SELECT TOP 1 idMarca FROM Marcas WHERE idEmpresa = @idEmpresa AND LTRIM(RTRIM(nombre)) = 'SM'");
    let idMarca = marRes.recordset?.[0]?.idMarca;
    if (!idMarca) {
      const anyMar = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT TOP 1 idMarca FROM Marcas WHERE idEmpresa = @idEmpresa ORDER BY idMarca ASC');
      idMarca = anyMar.recordset?.[0]?.idMarca;
    }
    if (!idMarca) {
      const marIns = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query("INSERT INTO Marcas (idEmpresa, nombre, descripcion, estado) OUTPUT INSERTED.idMarca VALUES (@idEmpresa, 'SM', 'Sin Marca', 1)");
      idMarca = marIns.recordset?.[0]?.idMarca || 1;
    }

    // F. Ubicación de inventario
    let idUbicacion = null;
    try {
      const ubRes = await pool
        .request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .query('SELECT TOP 1 idUbicacion FROM UbicacionesPrioridad WHERE idSucursal = @idSucursal ORDER BY prioridad ASC, idUbicacion ASC');
      if (ubRes.recordset && ubRes.recordset[0]) {
        idUbicacion = ubRes.recordset[0].idUbicacion;
      }
    } catch (_) {
      idUbicacion = null;
    }

    // G. Resolver rubro de la empresa
    let rubroTexto = opciones.rubro || opciones.rubroTexto;
    if (!rubroTexto) {
      const empRes = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT e.rubro, e.idRubro, r.nombre AS rubroCatalogo
          FROM Empresas e
          LEFT JOIN Rubros r ON e.idRubro = r.idRubro
          WHERE e.idEmpresa = @idEmpresa
        `);
      const rowEmp = empRes.recordset?.[0];
      rubroTexto = rowEmp?.rubro || rowEmp?.rubroCatalogo || '';
    }

    const presMap = await resolverPresentaciones(pool);
    const rubroKey = resolverTipoCatalogo(rubroTexto);
    const plantilla = CATALOGOS_DEMO[rubroKey] || CATALOGOS_DEMO.general;

    // 3. Ejecutar transacción de inserción masiva de productos demo
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const item of plantilla) {
        const idProducto = uuidv4();
        const idPresentacion = item.unidad === 'KGM' ? (presMap.KGM || 1) : (presMap.NIU || 1);

        // A. Insertar Producto
        await ProductosRepository.insertarProducto(transaction, {
          idProducto,
          idEmpresa,
          Codigo: item.codigo,
          idCategoria,
          descripcion: item.descripcion,
          idMarca,
          idPresentacion,
          cUnitario: item.costo,
          fProduccion: null,
          fVencimiento: null,
          alertaMinimo: 5,
          alertaMaximo: 200,
          VecesVendidas: 0,
          facturar: '1',
          idUsuario,
          FIngreso: new Date(),
          estado: 1,
          tipoProducto: 'S',
          permiteDescripcionEnVenta: 0
        });

        // B. Insertar Precio de Venta
        if (idListaPrecio) {
          await preciosVRepository.crearPrecioProducto(transaction, {
            idLista: idListaPrecio,
            idProducto,
            precio: item.precio,
            idMoneda: 1,
            idUsuario
          });
        }

        // C. Insertar Lote con Stock Inicial
        const idLote = await ProductosRepository.insertarLoteInicial(transaction, {
          idEmpresa,
          idProducto,
          idSucursal,
          costoUnitario: item.costo,
          cantidadIngresada: item.stock,
          cantidadDisponible: item.stock,
          fechaVencimiento: null,
          fechaIngreso: new Date(),
          numeroLote: 'LOTE-DEMO',
          idUbicacion
        });

        // D. Insertar Movimiento de Inventario
        await inventarioRepository.insertarFilaMovimiento(transaction, {
          idEmpresa,
          idSucursal,
          idProducto,
          tipoMovimiento: 'EN',
          cantidad: item.stock,
          docRelacionado: 'DEMO-INICIAL',
          idComprobante: null,
          idUsuario,
          observaciones: `Inventario inicial demo (${item.descripcion})`,
          costoUnitario: item.costo,
          idLote,
          idGrupoMovimiento: uuidv4(),
          codigoTipoMovimiento: 'INVENTARIO_INICIAL',
          fMovimiento: null
        });
      }

      await transaction.commit();
      return { ok: true, insertados: plantilla.length, rubro: rubroKey };
    } catch (errTx) {
      await transaction.rollback();
      throw errTx;
    }
  } catch (error) {
    console.error('seedProductosDemoSegunRubro error:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  seedProductosDemoSegunRubro,
  resolverTipoCatalogo,
  CATALOGOS_DEMO
};
