const sql = require('mssql');
const configuracionHotelRepository = require('../repositories/configuracionHotel.repository');
const estanciasRepository = require('../repositories/estancias.repository');
const consumoHabitacionRepository = require('../repositories/consumoHabitacion.repository');
const reservasRepository = require('../repositories/reservas.repository');
const hotelBloqueoRepository = require('../repositories/hotelBloqueo.repository');
const hotelHousekeepingRepository = require('../repositories/hotelHousekeeping.repository');
const hotelAnticiposRepository = require('../repositories/hotelAnticipos.repository');
const hotelReportesRepository = require('../repositories/hotelReportes.repository');
const productosRepository = require('../repositories/productos.repository');
const { fechaLocalDesdeDate, parseFechaHoraClienteASQL, sql23ADate } = require('../utils/fechaHoraLocal.util');
const {
  intervaloDesdeReserva,
  intervaloDesdeEstancia,
  intervaloDesdeBloqueo,
  intervalosSeSolapan,
  calcularNochesCalendario,
  checkOutPrevistoSqlDesdeFechaSalida,
  combinarFechaHora,
  DEFAULT_CONFIG
} = require('../utils/hotelIntervalo.util');

async function obtenerConfig(pool, idEmpresa) {
  let cfg = await configuracionHotelRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (!cfg) {
    cfg = await configuracionHotelRepository.upsert(pool, idEmpresa, DEFAULT_CONFIG);
  }
  return cfg;
}

async function guardarConfig(pool, idEmpresa, body) {
  return configuracionHotelRepository.upsert(pool, idEmpresa, {
    horaCheckIn: body.horaCheckIn,
    horaCheckOut: body.horaCheckOut,
    horaCorteDia: body.horaCorteDia,
    minutosLimpieza: body.minutosLimpieza != null ? Number(body.minutosLimpieza) : undefined,
    nochesMinimasWalkIn: body.nochesMinimasWalkIn != null ? Number(body.nochesMinimasWalkIn) : undefined,
    permitirWalkInSinReserva: body.permitirWalkInSinReserva,
    recargoEarlyCheckIn: body.recargoEarlyCheckIn != null ? Number(body.recargoEarlyCheckIn) : undefined,
    recargoLateCheckOut: body.recargoLateCheckOut != null ? Number(body.recargoLateCheckOut) : undefined
  });
}

async function validarDisponibilidadIntervalo(pool, idEmpresa, idProductoHabitacion, intervalo, opts = {}) {
  const cfg = await obtenerConfig(pool, idEmpresa);
  const reservas = await estanciasRepository.listarReservasConfirmadasHabitacion(
    pool,
    idEmpresa,
    idProductoHabitacion,
    opts.excluirIdReserva || null
  );
  for (const r of reservas) {
    const ir = intervaloDesdeReserva(r.fechaEntrada, r.fechaSalida, cfg);
    if (intervalosSeSolapan(intervalo, ir)) {
      throw new Error(`Conflicto con reserva ${r.codigo} (${r.fechaEntrada} – ${r.fechaSalida})`);
    }
  }
  const estancias = await estanciasRepository.listarEstanciasActivasHabitacion(
    pool,
    idEmpresa,
    idProductoHabitacion,
    opts.excluirIdEstancia || null
  );
  for (const e of estancias) {
    const ie = intervaloDesdeEstancia(e.checkIn, e.checkOutPrevisto, cfg);
    if (intervalosSeSolapan(intervalo, ie)) {
      throw new Error(`Conflicto con estancia activa de ${e.nombreHuesped}`);
    }
  }

  const bloqueos = await hotelBloqueoRepository.listarSolapantesHabitacion(
    pool,
    idEmpresa,
    idProductoHabitacion,
    intervalo.inicio,
    intervalo.finConLimpieza,
    opts.excluirIdBloqueo || null
  );
  for (const bl of bloqueos) {
    const ib = intervaloDesdeBloqueo(bl.fechaDesde, bl.fechaHasta);
    if (intervalosSeSolapan(intervalo, ib)) {
      throw new Error(`Conflicto con bloqueo (${bl.motivo || 'mantenimiento'})`);
    }
  }
}

async function listarEstanciasActivas(pool, idEmpresa) {
  return estanciasRepository.listarActivas(pool, idEmpresa);
}

async function obtenerEstanciaActivaHabitacion(pool, idEmpresa, idProductoHabitacion) {
  return estanciasRepository.obtenerActivaPorHabitacion(pool, idEmpresa, idProductoHabitacion);
}

async function validarProductoEsHabitacion(pool, idEmpresa, idProductoHabitacion) {
  const lista = await productosRepository.obtenerProductosHabitacionRepo(pool, idEmpresa);
  const ok = lista.some(
    (p) => String(p.idProducto).toLowerCase() === String(idProductoHabitacion).toLowerCase()
  );
  if (!ok) throw new Error('El producto no es una habitación válida (categoría Habitación).');
}

async function validarHousekeepingParaCheckIn(pool, idEmpresa, idProductoHabitacion) {
  const hk = await hotelHousekeepingRepository.obtenerPorHabitacion(pool, idEmpresa, idProductoHabitacion);
  const estado = String(hk?.estadoLimpieza || 'limpia').trim().toLowerCase();
  if (estado === 'sucia') {
    throw new Error('La habitación está sucia. Debe limpiarla antes de registrar un huésped.');
  }
  if (estado === 'fuera_servicio') {
    throw new Error('La habitación está fuera de servicio. No se puede registrar un huésped.');
  }
}

async function checkInWalkIn(pool, idEmpresa, body, idUsuario) {
  const cfg = await obtenerConfig(pool, idEmpresa);
  if (cfg.permitirWalkInSinReserva === false || cfg.permitirWalkInSinReserva === 0) {
    throw new Error('Walk-in no permitido en la configuración del hotel');
  }
  if (!body?.idProductoHabitacion) throw new Error('Habitación requerida');
  await validarProductoEsHabitacion(pool, idEmpresa, body.idProductoHabitacion);
  await validarHousekeepingParaCheckIn(pool, idEmpresa, body.idProductoHabitacion);
  if (!body?.nombreHuesped?.trim()) throw new Error('Nombre del huésped requerido');
  if (!body?.fechaSalida) throw new Error('Fecha de salida requerida');

  const activa = await estanciasRepository.obtenerActivaPorHabitacion(pool, idEmpresa, body.idProductoHabitacion);
  if (activa) throw new Error('La habitación ya tiene una estancia activa');

  const checkInSql = parseFechaHoraClienteASQL(body.checkIn || body.fechaHoraCliente);
  const checkOutPrevistoSql = checkOutPrevistoSqlDesdeFechaSalida(body.fechaSalida, cfg);
  const checkIn = sql23ADate(checkInSql);
  const checkOutPrevisto = sql23ADate(checkOutPrevistoSql);
  if (!checkOutPrevistoSql || !checkOutPrevisto || checkOutPrevisto <= checkIn) {
    throw new Error('La fecha de salida debe ser posterior al check-in (mínimo 1 noche: salida al día siguiente)');
  }

  const intervalo = intervaloDesdeEstancia(checkIn, checkOutPrevisto, cfg);
  await validarDisponibilidadIntervalo(pool, idEmpresa, body.idProductoHabitacion, intervalo);

  const noches = calcularNochesCalendario(
    fechaLocalDesdeDate(checkIn),
    String(body.fechaSalida).slice(0, 10)
  );
  if (noches < (Number(cfg.nochesMinimasWalkIn) || 1)) {
    throw new Error(`Estancia mínima: ${cfg.nochesMinimasWalkIn} noche(s)`);
  }

  const tarifaNoche = body.tarifaNoche != null ? Number(body.tarifaNoche) : Number(body.pVenta) || 0;
  const totalHabitacion = body.totalHabitacion != null
    ? Number(body.totalHabitacion)
    : Math.round(tarifaNoche * noches * 100) / 100;

  const idEstancia = await estanciasRepository.insertar(pool, idEmpresa, {
    idProductoHabitacion: body.idProductoHabitacion,
    idReserva: null,
    idCliente: body.idCliente || null,
    nombreHuesped: body.nombreHuesped.trim(),
    checkIn: checkInSql,
    checkOutPrevisto: checkOutPrevistoSql,
    tarifaNoche,
    totalHabitacion
  }, idUsuario);

  return estanciasRepository.obtenerPorId(pool, idEstancia, idEmpresa);
}

async function checkInDesdeReserva(pool, idEmpresa, idReserva, body, idUsuario) {
  const cfg = await obtenerConfig(pool, idEmpresa);
  const reserva = await reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
  if (!reserva) throw new Error('Reserva no encontrada');
  if (reserva.estado !== 'confirmada') {
    throw new Error('Solo se puede hacer check-in de reservas confirmadas');
  }

  const activa = await estanciasRepository.obtenerActivaPorHabitacion(pool, idEmpresa, reserva.idProductoHabitacion);
  if (activa) throw new Error('La habitación ya tiene una estancia activa');

  await validarProductoEsHabitacion(pool, idEmpresa, reserva.idProductoHabitacion);
  await validarHousekeepingParaCheckIn(pool, idEmpresa, reserva.idProductoHabitacion);

  const checkInSql = parseFechaHoraClienteASQL(body?.checkIn || body?.fechaHoraCliente);
  const checkOutPrevistoSql = checkOutPrevistoSqlDesdeFechaSalida(reserva.fechaSalida, cfg);
  const checkIn = sql23ADate(checkInSql);
  const checkOutPrevisto = sql23ADate(checkOutPrevistoSql);
  const intervalo = intervaloDesdeEstancia(checkIn, checkOutPrevisto, cfg);
  await validarDisponibilidadIntervalo(pool, idEmpresa, reserva.idProductoHabitacion, intervalo, {
    excluirIdReserva: idReserva
  });

  const tarifaNoche = body?.tarifaNoche != null ? Number(body.tarifaNoche) : 0;
  const totalHabitacion = reserva.total != null ? Number(reserva.total) : 0;

  const idEstancia = await estanciasRepository.insertar(pool, idEmpresa, {
    idProductoHabitacion: reserva.idProductoHabitacion,
    idReserva,
    idCliente: reserva.idCliente || body?.idCliente || null,
    nombreHuesped: reserva.nombreHuesped,
    checkIn: checkInSql,
    checkOutPrevisto: checkOutPrevistoSql,
    tarifaNoche,
    totalHabitacion
  }, idUsuario);

  await reservasRepository.vincularEstancia(pool, idReserva, idEmpresa, idEstancia, 'convertida');

  return estanciasRepository.obtenerPorId(pool, idEstancia, idEmpresa);
}

async function metadatosProductosPorIds(pool, idEmpresa, idsProducto) {
  const unicos = [...new Set((idsProducto || []).filter(Boolean).map((id) => String(id).toLowerCase()))];
  if (!unicos.length) return new Map();

  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  const inClause = unicos.map((id, i) => {
    req.input(`idProd${i}`, sql.UniqueIdentifier, id);
    return `@idProd${i}`;
  }).join(', ');

  const result = await req.query(`
    SELECT p.idProducto, p.codigo, p.descripcion,
           pr.codigo AS codigoPresentacion, m.nombre AS marca
    FROM Productos p
    INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
    INNER JOIN Marcas m ON p.idMarca = m.idMarca
    WHERE p.idEmpresa = @idEmpresa AND p.idProducto IN (${inClause})
  `);

  const map = new Map();
  for (const row of result.recordset || []) {
    map.set(String(row.idProducto).toLowerCase(), row);
  }
  return map;
}

function lineaPreloadVenta(metaMap, idProducto, codigo, descripcion, cantidad, pVenta, forzarTexto = false) {
  const meta = metaMap.get(String(idProducto).toLowerCase());
  return {
    idProducto,
    codigo: forzarTexto ? codigo : (meta?.codigo ?? codigo),
    descripcion: forzarTexto ? descripcion : (meta?.descripcion ?? descripcion),
    codigoPresentacion: meta?.codigoPresentacion ?? '',
    marca: meta?.marca ?? '',
    cantidad,
    pVenta
  };
}

function partesHora(horaStr) {
  const p = String(horaStr || '14:00:00').split(':');
  return { h: Number(p[0]) || 0, m: Number(p[1]) || 0 };
}

function esCheckInTemprano(checkInIso, cfg) {
  const ci = new Date(checkInIso);
  if (Number.isNaN(ci.getTime())) return false;
  const { h, m } = partesHora(cfg.horaCheckIn);
  const limite = new Date(ci);
  limite.setHours(h, m, 0, 0);
  return ci < limite;
}

function esCheckOutTardio(cfg) {
  const now = new Date();
  const { h, m } = partesHora(cfg.horaCheckOut);
  const limite = new Date();
  limite.setHours(h, m, 0, 0);
  return now > limite;
}

async function checkOutPreload(pool, idEmpresa, idEstancia) {
  const estancia = await estanciasRepository.obtenerPorId(pool, idEstancia, idEmpresa);
  if (!estancia) throw new Error('Estancia no encontrada');
  if (estancia.estadoEstancia !== 'activa') throw new Error('La estancia no está activa');

  const cfg = await obtenerConfig(pool, idEmpresa);
  const consumos = await consumoHabitacionRepository.listarPendientesParaCheckout(
    pool,
    idEmpresa,
    idEstancia,
    estancia.idProductoHabitacion
  );
  const anticipos = await hotelAnticiposRepository.listarPendientesCheckout(
    pool,
    idEmpresa,
    idEstancia,
    estancia.idReserva
  );
  const totalAnticipos = anticipos.reduce((s, a) => s + (Number(a.monto) || 0), 0);

  const idsProductos = [estancia.idProductoHabitacion, ...consumos.map((c) => c.idProducto)];
  const metaMap = await metadatosProductosPorIds(pool, idEmpresa, idsProductos);

  let totalHabitacion = Math.max(0, (Number(estancia.totalHabitacion) || 0) - totalAnticipos);
  const lineas = [
    lineaPreloadVenta(
      metaMap,
      estancia.idProductoHabitacion,
      estancia.habitacionCodigo,
      estancia.habitacionDescripcion,
      1,
      totalHabitacion
    )
  ];
  for (const c of consumos) {
    lineas.push(
      lineaPreloadVenta(
        metaMap,
        c.idProducto,
        c.productoCodigo,
        c.productoDescripcion,
        Math.max(1, Math.round(Number(c.cantidad) || 0)),
        Number(c.pUnitario) || 0
      )
    );
  }

  const recargoEarly = Number(cfg.recargoEarlyCheckIn) || 0;
  const recargoLate = Number(cfg.recargoLateCheckOut) || 0;
  if (recargoEarly > 0 && esCheckInTemprano(estancia.checkIn, cfg)) {
    lineas.push(lineaPreloadVenta(
      metaMap,
      estancia.idProductoHabitacion,
      'REC-EARLY',
      'Recargo early check-in',
      1,
      recargoEarly,
      true
    ));
  }
  if (recargoLate > 0 && esCheckOutTardio(cfg)) {
    lineas.push(lineaPreloadVenta(
      metaMap,
      estancia.idProductoHabitacion,
      'REC-LATE',
      'Recargo late check-out',
      1,
      recargoLate,
      true
    ));
  }

  return {
    idEstancia,
    idProductoHabitacion: estancia.idProductoHabitacion,
    habitacionCodigo: estancia.habitacionCodigo,
    habitacionDescripcion: estancia.habitacionDescripcion,
    idCliente: estancia.idCliente,
    nombreHuesped: estancia.nombreHuesped,
    idReserva: estancia.idReserva,
    anticiposTotal: totalAnticipos,
    anticipos,
    lineas
  };
}

async function confirmarCheckoutPostVenta(pool, idEmpresa, idEstancia, idVenta, fechaHoraCliente) {
  if (!idVenta) throw new Error('idVenta requerido para confirmar check-out');
  const estancia = await estanciasRepository.obtenerPorId(pool, idEstancia, idEmpresa);
  if (!estancia) throw new Error('Estancia no encontrada');
  if (estancia.estadoEstancia !== 'activa') {
    throw new Error('La estancia ya no está activa');
  }

  const checkOutRealSql = parseFechaHoraClienteASQL(fechaHoraCliente);
  await estanciasRepository.cerrarCheckout(pool, idEstancia, idEmpresa, idVenta, checkOutRealSql);
  await consumoHabitacionRepository.marcarFacturadosCheckout(
    pool,
    idEmpresa,
    idEstancia,
    estancia.idProductoHabitacion
  );
  await hotelAnticiposRepository.marcarAplicadosCheckout(
    pool,
    idEmpresa,
    idEstancia,
    estancia.idReserva,
    idVenta
  );
  await hotelHousekeepingRepository.upsertEstado(
    pool,
    idEmpresa,
    estancia.idProductoHabitacion,
    'sucia',
    'Check-out registrado'
  );

  try {
    await pool.request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idEstanciaHotel', sql.UniqueIdentifier, idEstancia)
      .query(`
        UPDATE Ventas SET idEstanciaHotel = @idEstanciaHotel
        WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
      `);
  } catch (errVentas) {
    console.error('confirmarCheckoutPostVenta idEstanciaHotel:', errVentas.message);
  }

  return { ok: true, idEstancia, idVenta };
}

async function consultarDisponibilidad(pool, idEmpresa, idProductoHabitacion, fechaEntrada, fechaSalida) {
  const cfg = await obtenerConfig(pool, idEmpresa);
  const intervalo = intervaloDesdeReserva(fechaEntrada, fechaSalida, cfg);
  try {
    await validarDisponibilidadIntervalo(pool, idEmpresa, idProductoHabitacion, intervalo);
    return { disponible: true };
  } catch (err) {
    return { disponible: false, motivo: err.message };
  }
}

function parseFechaCalendario(fechaStr, finDeDia = false) {
  const d = String(fechaStr || '').slice(0, 10);
  if (!d || d.length < 10) throw new Error('Fecha inválida');
  if (finDeDia) return new Date(`${d}T23:59:59`);
  return new Date(`${d}T00:00:00`);
}

async function listarCalendario(pool, idEmpresa, fechaDesde, fechaHasta) {
  if (!fechaDesde || !fechaHasta) throw new Error('Parámetros requeridos: fechaDesde, fechaHasta');
  const inicio = parseFechaCalendario(fechaDesde, false);
  const fin = parseFechaCalendario(fechaHasta, true);
  if (fin <= inicio) throw new Error('fechaHasta debe ser posterior a fechaDesde');

  const cfg = await obtenerConfig(pool, idEmpresa);
  const habitaciones = await productosRepository.obtenerProductosHabitacionRepo(pool, idEmpresa);
  const reservas = await reservasRepository.listarConfirmadasEnRango(pool, idEmpresa, fechaDesde, fechaHasta);
  const estancias = await estanciasRepository.listarActivasEnRango(pool, idEmpresa, inicio, fin);
  const bloqueos = await hotelBloqueoRepository.listarPorEmpresaEnRango(pool, idEmpresa, inicio, fin);

  const reservasEnriquecidas = reservas.map((r) => {
    const iv = intervaloDesdeReserva(r.fechaEntrada, r.fechaSalida, cfg);
    return {
      ...r,
      tipo: 'reserva',
      inicio: iv.inicio.toISOString().slice(0, 19).replace('T', ' '),
      fin: iv.fin.toISOString().slice(0, 19).replace('T', ' ')
    };
  });

  const estanciasEnriquecidas = estancias.map((e) => ({
    ...e,
    tipo: 'estancia',
    inicio: e.checkIn,
    fin: e.checkOutPrevisto
  }));

  const bloqueosEnriquecidos = bloqueos.map((b) => ({
    ...b,
    tipo: 'bloqueo'
  }));

  return {
    fechaDesde,
    fechaHasta,
    configuracion: cfg,
    habitaciones,
    eventos: [...reservasEnriquecidas, ...estanciasEnriquecidas, ...bloqueosEnriquecidos]
  };
}

const MOTIVOS_BLOQUEO = ['mantenimiento', 'admin', 'housekeeping'];

async function crearBloqueo(pool, idEmpresa, body, idUsuario) {
  if (!body?.idProductoHabitacion) throw new Error('Habitación requerida');
  if (!body?.fechaDesde || !body?.fechaHasta) throw new Error('Fechas desde/hasta requeridas');
  const motivo = String(body.motivo || 'mantenimiento').trim().toLowerCase();
  if (!MOTIVOS_BLOQUEO.includes(motivo)) {
    throw new Error(`Motivo inválido. Use: ${MOTIVOS_BLOQUEO.join(', ')}`);
  }

  const fechaDesde = new Date(body.fechaDesde);
  const fechaHasta = new Date(body.fechaHasta);
  const intervalo = intervaloDesdeBloqueo(fechaDesde, fechaHasta);
  await validarDisponibilidadIntervalo(pool, idEmpresa, body.idProductoHabitacion, intervalo);

  const idBloqueo = await hotelBloqueoRepository.insertar(pool, idEmpresa, {
    idProductoHabitacion: body.idProductoHabitacion,
    fechaDesde,
    fechaHasta,
    motivo,
    observaciones: body.observaciones || null
  }, idUsuario);

  return hotelBloqueoRepository.obtenerPorId(pool, idBloqueo, idEmpresa);
}

async function eliminarBloqueo(pool, idEmpresa, idBloqueo) {
  const row = await hotelBloqueoRepository.obtenerPorId(pool, idBloqueo, idEmpresa);
  if (!row) throw new Error('Bloqueo no encontrado');
  const n = await hotelBloqueoRepository.eliminar(pool, idBloqueo, idEmpresa);
  if (!n) throw new Error('No se pudo eliminar el bloqueo');
  return { ok: true };
}

async function listarBloqueos(pool, idEmpresa, fechaDesde, fechaHasta) {
  const inicio = parseFechaCalendario(fechaDesde || new Date().toISOString().slice(0, 10), false);
  const fin = parseFechaCalendario(
    fechaHasta || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    true
  );
  return hotelBloqueoRepository.listarPorEmpresaEnRango(pool, idEmpresa, inicio, fin);
}

async function listarHousekeeping(pool, idEmpresa) {
  return hotelHousekeepingRepository.listarPorEmpresa(pool, idEmpresa);
}

async function actualizarHousekeeping(pool, idEmpresa, idProductoHabitacion, body) {
  if (!idProductoHabitacion) throw new Error('Habitación requerida');
  return hotelHousekeepingRepository.upsertEstado(
    pool,
    idEmpresa,
    idProductoHabitacion,
    body.estadoLimpieza,
    body.observaciones
  );
}

async function listarAnticipos(pool, idEmpresa, filtros = {}) {
  return hotelAnticiposRepository.listarPorEmpresa(pool, idEmpresa, filtros);
}

async function registrarAnticipo(pool, idEmpresa, body, idUsuario) {
  const monto = Number(body.monto);
  if (!monto || monto <= 0) throw new Error('Monto del anticipo debe ser mayor a cero');
  if (!body.idReserva && !body.idEstancia) {
    throw new Error('Debe indicar reserva o estancia para el anticipo');
  }
  const idAnticipo = await hotelAnticiposRepository.insertar(pool, idEmpresa, {
    idReserva: body.idReserva || null,
    idEstancia: body.idEstancia || null,
    monto,
    concepto: body.concepto?.trim() || 'Anticipo / seña'
  }, idUsuario);
  return { idAnticipo, monto };
}

async function anularAnticipo(pool, idEmpresa, idAnticipo) {
  const n = await hotelAnticiposRepository.anular(pool, idAnticipo, idEmpresa);
  if (!n) throw new Error('No se pudo anular el anticipo (ya aplicado o no existe)');
  return { ok: true };
}

function parseMesAnio(mesParam) {
  const m = String(mesParam || '').trim();
  const match = m.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) throw new Error('mes inválido (use YYYY-MM)');
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  if (mes < 1 || mes > 12) throw new Error('mes inválido (use YYYY-MM)');
  const inicioMes = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
  const finMes = new Date(anio, mes, 1, 0, 0, 0, 0);
  return { anio, mes, inicioMes, finMes };
}

function fechaSolo(valor) {
  if (!valor) return null;
  return String(valor).slice(0, 10);
}

function calcularFechasOcupadasMes(estancias, anio, mes) {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  const fechasOcupadas = new Set();
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    for (const e of estancias) {
      const ini = fechaSolo(e.checkIn);
      const fin = fechaSolo(e.checkOutReal || e.checkOutPrevisto);
      if (!ini || !fin) continue;
      if (fecha >= ini && fecha < fin) fechasOcupadas.add(fecha);
    }
  }
  return [...fechasOcupadas].sort();
}

async function historialHabitacionMes(pool, idEmpresa, idProductoHabitacion, mesParam) {
  if (!idProductoHabitacion) throw new Error('idProductoHabitacion requerido');
  const { anio, mes, inicioMes, finMes } = parseMesAnio(mesParam);
  const habitaciones = await productosRepository.obtenerProductosHabitacionRepo(pool, idEmpresa);
  const hab = habitaciones.find((h) => String(h.idProducto).toLowerCase() === String(idProductoHabitacion).toLowerCase());
  if (!hab) throw new Error('Habitación no encontrada');

  const rows = await estanciasRepository.listarHistorialHabitacionMes(
    pool,
    idEmpresa,
    idProductoHabitacion,
    inicioMes,
    finMes
  );

  const estancias = [];
  for (const e of rows) {
    const checkOut = e.checkOutReal || e.checkOutPrevisto;
    const consumo = await consumoHabitacionRepository.totalConsumoPorEstancia(
      pool,
      idEmpresa,
      e.idEstancia,
      e.idProductoHabitacion,
      e.checkIn,
      checkOut
    );
    estancias.push({
      ...e,
      totalConsumo: consumo.total,
      cantidadConsumos: consumo.lineas
    });
  }

  const fechasOcupadas = calcularFechasOcupadasMes(estancias, anio, mes);
  return {
    idProductoHabitacion,
    habitacionCodigo: hab.codigo,
    habitacionDescripcion: hab.descripcion,
    anio,
    mes,
    totalEstancias: estancias.length,
    diasOcupados: fechasOcupadas.length,
    fechasOcupadas,
    estancias
  };
}

async function detalleEstanciaHistorial(pool, idEmpresa, idEstancia) {
  if (!idEstancia) throw new Error('idEstancia requerido');
  const estancia = await estanciasRepository.obtenerPorId(pool, idEstancia, idEmpresa);
  if (!estancia) throw new Error('Estancia no encontrada');
  const checkOut = estancia.checkOutReal || estancia.checkOutPrevisto;
  const consumos = await consumoHabitacionRepository.listarPorEstancia(
    pool,
    idEmpresa,
    idEstancia,
    estancia.idProductoHabitacion,
    estancia.checkIn,
    checkOut
  );
  let totalConsumo = 0;
  for (const c of consumos) {
    totalConsumo += (Number(c.cantidad) || 0) * (Number(c.pUnitario) || 0);
  }
  return { estancia, consumos, totalConsumo };
}

async function reporteHotel(pool, idEmpresa, fechaDesde, fechaHasta) {
  if (!fechaDesde || !fechaHasta) throw new Error('fechaDesde y fechaHasta requeridos');
  const habitaciones = await productosRepository.obtenerProductosHabitacionRepo(pool, idEmpresa);
  const ocupacion = await hotelReportesRepository.reporteOcupacion(
    pool,
    idEmpresa,
    fechaDesde,
    fechaHasta,
    habitaciones.length
  );
  const consumo = await hotelReportesRepository.reporteConsumo(pool, idEmpresa, fechaDesde, fechaHasta);
  const reservas = await hotelReportesRepository.reporteReservas(pool, idEmpresa, fechaDesde, fechaHasta);
  return {
    fechaDesde,
    fechaHasta,
    ocupacion,
    consumo,
    reservas,
    ingresoTotal: (ocupacion.ingresoHabitacion || 0) + (consumo.ingresoConsumo || 0)
  };
}

async function moverReservaCalendario(pool, idEmpresa, idReserva, body) {
  const reservasService = require('./reservas.service');
  const reserva = await reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
  if (!reserva) throw new Error('Reserva no encontrada');
  if (reserva.estado !== 'confirmada') throw new Error('Solo se pueden mover reservas confirmadas');
  if (!body?.fechaEntrada || !body?.fechaSalida) {
    throw new Error('fechaEntrada y fechaSalida requeridas');
  }
  await reservasService.actualizar(pool, idReserva, idEmpresa, {
    idProductoHabitacion: body.idProductoHabitacion || reserva.idProductoHabitacion,
    idCliente: reserva.idCliente,
    codigo: reserva.codigo,
    nombreHuesped: reserva.nombreHuesped,
    fechaEntrada: body.fechaEntrada,
    fechaSalida: body.fechaSalida,
    estado: reserva.estado,
    total: reserva.total,
    observaciones: reserva.observaciones
  });
  return reservasRepository.obtenerPorId(pool, idReserva, idEmpresa);
}

module.exports = {
  obtenerConfig,
  guardarConfig,
  validarDisponibilidadIntervalo,
  listarEstanciasActivas,
  obtenerEstanciaActivaHabitacion,
  checkInWalkIn,
  checkInDesdeReserva,
  checkOutPreload,
  confirmarCheckoutPostVenta,
  consultarDisponibilidad,
  listarCalendario,
  crearBloqueo,
  eliminarBloqueo,
  listarBloqueos,
  obtenerConfigInterno: obtenerConfig,
  listarHousekeeping,
  actualizarHousekeeping,
  listarAnticipos,
  registrarAnticipo,
  anularAnticipo,
  reporteHotel,
  historialHabitacionMes,
  detalleEstanciaHistorial,
  moverReservaCalendario
};
