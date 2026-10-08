/**
 * Convierte un número a letras en español según el formato oficial de comprobantes de pago (SUNAT).
 * Formato SUNAT: XXX CON DD/100 SOLES.
 * Ejemplo:
 *   115.00 -> "CIENTO QUINCE CON 00/100 SOLES"
 *   115.50 -> "CIENTO QUINCE CON 50/100 SOLES"
 *   115.05 -> "CIENTO QUINCE CON 05/100 SOLES"
 *   1000.00 -> "MIL CON 00/100 SOLES"
 *   1000000.00 -> "UN MILLÓN CON 00/100 SOLES"
 */

function resolverMoneda(moneda) {
  const m = String(moneda || 'SOLES').trim().toUpperCase();
  if (['USD', 'DOLARES', 'DÓLARES', 'DOLAR', 'DÓLAR', '$'].includes(m)) {
    return 'DÓLARES AMERICANOS';
  }
  if (['EUR', 'EUROS', 'EURO'].includes(m)) {
    return 'EUROS';
  }
  return 'SOLES';
}

function convertirGrupo(n, esMayor = false) {
  const unidades = ['', esMayor ? 'un' : 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const diezA19 = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const veintes = ['veinte', esMayor ? 'veintiún' : 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  if (n === 100) return 'cien';
  let salida = '';
  const c = Math.floor(n / 100);
  const restoC = n % 100;
  if (c > 0) salida += centenas[c];

  if (restoC > 0) {
    if (salida) salida += ' ';
    if (restoC < 10) {
      salida += unidades[restoC];
    } else if (restoC >= 10 && restoC < 20) {
      salida += diezA19[restoC - 10];
    } else if (restoC >= 20 && restoC < 30) {
      salida += veintes[restoC - 20];
    } else {
      const d = Math.floor(restoC / 10);
      const u = restoC % 10;
      const txtU = u === 1 && esMayor ? 'un' : unidades[u];
      salida += decenas[d] + (u > 0 ? ' y ' + txtU : '');
    }
  }
  return salida.trim();
}

function seccionEntera(num) {
  if (num === 0) return 'cero';
  if (num === 1) return 'un';

  let salida = '';
  const millones = Math.floor(num / 1000000);
  let resto = num % 1000000;
  if (millones > 0) {
    if (millones === 1) {
      salida += 'un millón';
    } else {
      salida += convertirGrupo(millones, true) + ' millones';
    }
  }

  const miles = Math.floor(resto / 1000);
  resto = resto % 1000;
  if (miles > 0) {
    if (salida) salida += ' ';
    if (miles === 1) {
      salida += 'mil';
    } else {
      salida += convertirGrupo(miles, true) + ' mil';
    }
  }

  if (resto > 0) {
    if (salida) salida += ' ';
    salida += convertirGrupo(resto, false);
  }

  return salida.trim();
}

function numeroALetras(num, moneda = 'SOLES') {
  const n = Math.abs(Number(num) || 0);
  const enteros = Math.floor(n);
  let decFinal = Math.round((n - enteros) * 100);
  let entFinal = enteros;
  if (decFinal === 100) {
    entFinal += 1;
    decFinal = 0;
  }

  const textoEnteros = seccionEntera(entFinal).toUpperCase();
  const textoDecimales = String(decFinal).padStart(2, '0') + '/100';
  const textoMoneda = resolverMoneda(moneda);

  return `${textoEnteros} CON ${textoDecimales} ${textoMoneda}`;
}

module.exports = { numeroALetras };
