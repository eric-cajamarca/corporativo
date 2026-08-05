/**
 * Prueba reglas de ubicación en importación de productos (sin DB).
 * Ejecutar: node scripts/test_importacion_ubicacion.js
 */
const {
  buildUbicacionesIndex,
  resolverUbicacionImportacion,
  resolverYValidarFilas
} = require('../services/productosImportacion.service');
const repo = require('../repositories/productosImportacion.repository');

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

function testResolverPuro() {
  const index = buildUbicacionesIndex([
    { idUbicacion: 10, codigoUbicacion: 'A-01-02' },
    { idUbicacion: 11, codigoUbicacion: 'MOSTRADOR' }
  ]);

  const ok = resolverUbicacionImportacion('a-01-02', 5, index);
  assert(ok.idUbicacion === 10 && !ok.error, 'ubicación válida (case-insensitive) resuelve id');

  const vacia = resolverUbicacionImportacion('', 5, index);
  assert(vacia.idUbicacion == null && !vacia.error, 'ubicación vacía es opcional');

  const invalida = resolverUbicacionImportacion('Z-99-99', 5, index);
  assert(
    !!invalida.error && /no registrada/i.test(invalida.error),
    'ubicación inexistente genera error'
  );

  const sinCant = resolverUbicacionImportacion('A-01-02', 0, index);
  assert(
    !!sinCant.error && /cantidadInicial/i.test(sinCant.error),
    'ubicación con cantidad 0 genera error'
  );
}

async function testResolverYValidarFilasConMock() {
  const orig = {
    obtenerIdSucursalPrincipal: repo.obtenerIdSucursalPrincipal,
    obtenerListasPrecioBaseImportacion: repo.obtenerListasPrecioBaseImportacion,
    obtenerPresentacionesCatalogo: repo.obtenerPresentacionesCatalogo,
    obtenerCategoriasCatalogo: repo.obtenerCategoriasCatalogo,
    obtenerMarcasCatalogo: repo.obtenerMarcasCatalogo,
    obtenerCodigosExistentes: repo.obtenerCodigosExistentes,
    obtenerUbicacionesPorSucursal: repo.obtenerUbicacionesPorSucursal
  };

  repo.obtenerIdSucursalPrincipal = async () => '11111111-1111-1111-1111-111111111111';
  repo.obtenerListasPrecioBaseImportacion = async () => [
    { idLista: 1, idMoneda: 1, nombre: 'Precio Normal', principal: 1 },
    { idLista: 2, idMoneda: 1, nombre: 'Precio Cliente', principal: 0 },
    { idLista: 3, idMoneda: 1, nombre: 'Precio Mayorista', principal: 0 }
  ];
  repo.obtenerPresentacionesCatalogo = async () => [{ idPresentacion: 1, codigo: 'NIU' }];
  repo.obtenerCategoriasCatalogo = async () => [{ idCategoria: 1, nombre: 'Varios' }];
  repo.obtenerMarcasCatalogo = async () => [{ idMarca: 1, nombre: 'SM' }];
  repo.obtenerCodigosExistentes = async () => new Set();
  repo.obtenerUbicacionesPorSucursal = async () => [
    { idUbicacion: 10, codigoUbicacion: 'A-01-02', nombreSucursal: 'Principal', prioridad: 1 }
  ];

  try {
    const base = {
      presentacionCodigo: 'NIU',
      cantidadStr: '10',
      costoStr: '5',
      precioClienteStr: '9',
      precioNormalStr: '10',
      precioMayoristaStr: '8',
      categoriaAlias: 'Varios',
      marcaAlias: 'SM'
    };

    const { errores, filasResueltas } = await resolverYValidarFilas({}, 'emp-1', [
      {
        ...base,
        numeroFila: 2,
        codigo: 'OK001',
        descripcion: 'Producto ok',
        ubicacionCodigo: 'A-01-02'
      },
      {
        ...base,
        numeroFila: 3,
        codigo: 'BAD001',
        descripcion: 'Ubicación inventada',
        ubicacionCodigo: 'Z-99-99'
      },
      {
        ...base,
        numeroFila: 4,
        codigo: 'BAD002',
        descripcion: 'Ubicación sin stock',
        cantidadStr: '0',
        ubicacionCodigo: 'A-01-02'
      }
    ]);

    assert(filasResueltas.length === 1 && filasResueltas[0].idUbicacion === 10, 'fila válida con idUbicacion');
    assert(errores.length === 2, 'dos filas con error de ubicación');

    const errInvalida = errores.find((e) => e.codigo === 'BAD001');
    assert(
      errInvalida && errInvalida.mensajes.some((m) => /no registrada/i.test(m)),
      'error por ubicación no registrada'
    );

    const errSinCant = errores.find((e) => e.codigo === 'BAD002');
    assert(
      errSinCant && errSinCant.mensajes.some((m) => /cantidadInicial/i.test(m)),
      'error por ubicación sin cantidadInicial'
    );
  } finally {
    Object.assign(repo, orig);
  }
}

(async () => {
  testResolverPuro();
  await testResolverYValidarFilasConMock();
  if (failed > 0) {
    console.error(`\n${failed} prueba(s) fallaron`);
    process.exit(1);
  }
  console.log('\nTodas las pruebas de ubicación en importación pasaron.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
