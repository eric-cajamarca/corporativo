/**
 * Normaliza placa para consultas MTC / Factiliza (mayúsculas, sin guión ni espacios).
 */
function normalizarPlacaParaApi(placa) {
  return String(placa || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function primerString(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

/**
 * Factiliza puede devolver el vehículo en distintas formas (data plana, data.vehiculo, arrays, snake_case).
 * Devuelve objeto { placa, marca, modelo, color, serie, vin, motor } o null si no hay datos útiles.
 */
function extraerVehiculoNormalizado(dataRes, placaSolicitada) {
  if (!dataRes || typeof dataRes !== 'object') return null;

  let raw = dataRes.data;
  if (raw == null && !Array.isArray(dataRes) && typeof dataRes === 'object') {
    const keys = Object.keys(dataRes);
    const soloMeta = keys.every((k) =>
      ['status', 'message', 'success', 'code'].includes(k.toLowerCase())
    );
    if (!soloMeta) raw = dataRes;
  }
  if (Array.isArray(raw)) raw = raw.length ? raw[0] : null;
  if (raw && typeof raw === 'object') {
    if (raw.vehiculo && typeof raw.vehiculo === 'object') raw = raw.vehiculo;
    else if (raw.datos && typeof raw.datos === 'object') {
      if (raw.datos.vehiculo) raw = raw.datos.vehiculo;
      else raw = raw.datos;
    } else if (raw.resultado && typeof raw.resultado === 'object') raw = raw.resultado;
  }
  if (!raw || typeof raw !== 'object') return null;

  const placa = primerString(
    raw.placa,
    raw.PLACA,
    raw.numero_placa,
    raw.numeroPlaca,
    placaSolicitada
  );
  const marca = primerString(
    raw.marca,
    raw.MARCA,
    raw.marca_descripcion,
    raw.marcaDescripcion,
    raw.marca_mercosur,
    raw.marcaMercosur
  );
  const modelo = primerString(
    raw.modelo,
    raw.MODELO,
    raw.modelo_descripcion,
    raw.modeloDescripcion,
    raw.descripcion_modelo,
    raw.descripcionModelo,
    raw.descripcion
  );
  const color = primerString(raw.color, raw.COLOR, raw.color_descripcion, raw.colorDescripcion);
  const serie = primerString(
    raw.serie,
    raw.SERIE,
    raw.numero_serie,
    raw.numeroSerie,
    raw.nro_serie,
    raw.vin
  );
  const vin = primerString(raw.vin, raw.VIN, raw.numero_vin, raw.numeroVin);
  const motor = primerString(
    raw.motor,
    raw.MOTOR,
    raw.numero_motor,
    raw.numeroMotor,
    raw.nro_motor
  );

  let marcaF = marca;
  let modeloF = modelo;
  let colorF = color;
  let serieF = serie;
  let vinF = vin;
  let motorF = motor;
  if (!marcaF && !modeloF && !colorF && !serieF && !vinF && !motorF) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v !== 'string' || !String(v).trim()) continue;
      const kl = k.toLowerCase();
      const val = String(v).trim();
      if (kl.includes('marca') && !marcaF) marcaF = val;
      else if (kl.includes('modelo') && !modeloF) modeloF = val;
      else if (kl.includes('color') && !colorF) colorF = val;
      else if ((kl.includes('serie') || kl.includes('vin')) && !serieF && !kl.includes('motor')) serieF = val;
      else if (kl.includes('motor') && !motorF) motorF = val;
    }
  }

  const tieneAlgo =
    marcaF ||
    modeloF ||
    colorF ||
    serieF ||
    vinF ||
    motorF ||
    placa;

  if (!tieneAlgo) return null;

  return {
    placa: placa || normalizarPlacaParaApi(placaSolicitada),
    marca: marcaF || '',
    modelo: modeloF || '',
    color: colorF || '',
    serie: serieF || '',
    vin: vinF || '',
    motor: motorF || ''
  };
}

module.exports = {
  normalizarPlacaParaApi,
  extraerVehiculoNormalizado
};
