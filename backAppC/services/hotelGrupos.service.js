const sql = require('mssql');
const hotelGruposRepository = require('../repositories/hotelGrupos.repository');
const reservasRepository = require('../repositories/reservas.repository');
const hotelAnticiposRepository = require('../repositories/hotelAnticipos.repository');
const productosRepository = require('../repositories/productos.repository');
const hotelService = require('./hotel.service');
const { intervaloDesdeReserva, calcularNochesCalendario } = require('../utils/hotelIntervalo.util');
const { parseFechaHoraClienteASQL } = require('../utils/fechaHoraLocal.util');

async function ejecutarEnTransaccion(pool, fn) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const out = await fn(transaction);
    await transaction.commit();
    return out;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rb) {
      console.error('hotel grupos transacción rollback:', rb);
    }
    throw error;
  }
}

function bitOn(v) {
  return v === true || Number(v) === 1;
}

async function listarVigentes(pool, idEmpresa) {
  if (!idEmpresa) throw new Error('idEmpresa requerido');
  return hotelGruposRepository.listarVigentes(pool, idEmpresa);
}

async function obtenerDetalle(pool, idEmpresa, idGrupo) {
  if (!idEmpresa) throw new Error('idEmpresa requerido');
  const grupo = await hotelGruposRepository.obtenerPorId(pool, idGrupo, idEmpresa);
  if (!grupo) throw new Error('Grupo no encontrado');
  const habitaciones = await hotelGruposRepository.listarHabitaciones(pool, idGrupo, idEmpresa);
  return { ...grupo, habitaciones };
}

async function crear(pool, idEmpresa, body, idUsuario) {
  if (!idEmpresa) throw new Error('idEmpresa requerido');
  if (!body?.idCliente) throw new Error('Cliente (empresa) es requerido para el grupo');
  if (!body?.nombre?.trim() && !body?.nombreHuesped?.trim()) {
    throw new Error('Nombre del grupo o razón social es requerido');
  }
  if (!body?.fechaEntrada || !body?.fechaSalida) throw new Error('Fechas de entrada y salida son requeridas');

  const ids = [...new Set((body.idsProductoHabitacion || []).filter(Boolean).map((id) => String(id)))];
  if (ids.length < 2) throw new Error('Seleccione al menos 2 habitaciones para el grupo');

  const entrada = String(body.fechaEntrada).slice(0, 10);
  const salida = String(body.fechaSalida).slice(0, 10);
  const a = new Date(entrada);
  const b = new Date(salida);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) {
    throw new Error('La fecha de salida debe ser posterior a la de entrada');
  }

  const catalogo = await productosRepository.obtenerProductosHabitacionRepo(pool, idEmpresa);
  const porId = new Map(catalogo.map((p) => [String(p.idProducto).toLowerCase(), p]));
  for (const id of ids) {
    if (!porId.has(id.toLowerCase())) {
      throw new Error('Una de las habitaciones no es válida (categoría Habitación).');
    }
  }

  const cfg = await hotelService.obtenerConfigInterno(pool, idEmpresa);
  const intervalo = intervaloDesdeReserva(entrada, salida, cfg);
  const noches = calcularNochesCalendario(entrada, salida);
  if (noches < 1) throw new Error('La estadía debe ser de al menos 1 noche');

  for (const id of ids) {
    await hotelService.validarDisponibilidadIntervalo(pool, idEmpresa, id, intervalo);
  }

  const nombre = String(body.nombre || body.nombreHuesped).trim();
  const codigo = body.codigo?.trim() || await hotelGruposRepository.siguienteCodigo(pool, idEmpresa);
  const fRegistro = parseFechaHoraClienteASQL(body.fRegistro || body.fechaHoraCliente);

  const creado = await ejecutarEnTransaccion(pool, async (tx) => {
    const grupo = await hotelGruposRepository.crear(tx, idEmpresa, {
      idCliente: Number(body.idCliente),
      codigo,
      nombre,
      fechaEntrada: entrada,
      fechaSalida: salida,
      observaciones: body.observaciones?.trim() || null
    }, idUsuario);

    for (const id of ids) {
      const hab = porId.get(id.toLowerCase());
      const precioNoche = Number(hab?.pVenta) || 0;
      const total = Math.round(precioNoche * noches * 100) / 100;
      const codigoReserva = await reservasRepository.siguienteCodigo(tx, idEmpresa);
      await reservasRepository.crear(tx, idEmpresa, {
        idProductoHabitacion: id,
        idCliente: Number(body.idCliente),
        codigo: codigoReserva,
        nombreHuesped: `${nombre} · ${hab.codigo}`,
        fechaEntrada: entrada,
        fechaSalida: salida,
        estado: 'confirmada',
        total,
        observaciones: `Grupo ${codigo}`,
        fRegistro,
        idGrupo: grupo.idGrupo
      }, idUsuario);
    }

    return grupo;
  });

  return obtenerDetalle(pool, idEmpresa, creado.idGrupo);
}

async function facturarHospedajePreload(pool, idEmpresa, idGrupo) {
  const grupo = await hotelGruposRepository.obtenerPorId(pool, idGrupo, idEmpresa);
  if (!grupo) throw new Error('Grupo no encontrado');
  if (grupo.estado !== 'activo') throw new Error('El grupo no está activo');
  if (bitOn(grupo.hospedajeFacturado)) {
    throw new Error('El hospedaje del grupo ya está facturado');
  }

  const habitaciones = await hotelGruposRepository.listarHabitaciones(pool, idGrupo, idEmpresa);
  const pendientes = habitaciones.filter((h) => {
    if (h.estado === 'cancelada' || h.estado === 'no_show') return false;
    const facturada = bitOn(h.estanciaHabitacionFacturada) || bitOn(h.habitacionFacturada);
    return !facturada;
  });
  if (!pendientes.length) {
    throw new Error('No hay hospedaje pendiente de facturar en este grupo');
  }

  const idsProducto = pendientes.map((h) => h.idProductoHabitacion);
  const metaMap = await hotelService.metadatosProductosPorIds(pool, idEmpresa, idsProducto);

  const lineas = [];
  for (const h of pendientes) {
    const anticipos = await hotelAnticiposRepository.listarPendientesCheckout(
      pool,
      idEmpresa,
      h.idEstancia || null,
      h.idReserva
    );
    const totalAnticipos = anticipos.reduce((s, a) => s + (Number(a.monto) || 0), 0);
    const base = h.idEstancia && h.totalEstancia != null
      ? Number(h.totalEstancia) || 0
      : Number(h.total) || 0;
    const pVenta = Math.max(0, Math.round((base - totalAnticipos) * 100) / 100);
    const meta = metaMap.get(String(h.idProductoHabitacion).toLowerCase());
    const descHab = h.habitacionCodigo || meta?.codigo || '';
    lineas.push({
      idProducto: h.idProductoHabitacion,
      codigo: meta?.codigo ?? h.habitacionCodigo,
      descripcion: `Hospedaje ${descHab} (${h.fechaEntrada} – ${h.fechaSalida})`,
      codigoPresentacion: meta?.codigoPresentacion ?? '',
      marca: meta?.marca ?? '',
      cantidad: 1,
      pVenta,
      tipo: 'habitacion',
      idConsumo: null,
      idReservaHotel: h.idReserva,
      idEstanciaHotel: h.idEstancia || null
    });
  }

  return {
    idGrupo,
    codigo: grupo.codigo,
    nombre: grupo.nombre,
    idCliente: grupo.idCliente,
    nombreHuesped: grupo.nombre,
    fechaEntrada: grupo.fechaEntrada,
    fechaSalida: grupo.fechaSalida,
    totalHabitaciones: pendientes.length,
    lineas
  };
}

async function confirmarFacturaHospedaje(pool, idEmpresa, idGrupo, idVenta) {
  if (!idVenta) throw new Error('idVenta requerido para confirmar hospedaje del grupo');
  const grupo = await hotelGruposRepository.obtenerPorId(pool, idGrupo, idEmpresa);
  if (!grupo) throw new Error('Grupo no encontrado');
  if (grupo.estado !== 'activo') throw new Error('El grupo no está activo');

  if (bitOn(grupo.hospedajeFacturado)) {
    return {
      ok: true,
      yaFacturado: true,
      message: 'El hospedaje del grupo ya estaba facturado.'
    };
  }

  await ejecutarEnTransaccion(pool, async (tx) => {
    await hotelGruposRepository.marcarHospedajeFacturado(tx, idGrupo, idEmpresa, idVenta);
    await hotelAnticiposRepository.marcarAplicadosPorGrupo(tx, idEmpresa, idGrupo, idVenta);
  });

  return {
    ok: true,
    yaFacturado: false,
    message: 'Hospedaje del grupo facturado. Las habitaciones se liberan con Salida; el consumo se cobra en cada cuarto.'
  };
}

module.exports = {
  listarVigentes,
  obtenerDetalle,
  crear,
  facturarHospedajePreload,
  confirmarFacturaHospedaje
};
