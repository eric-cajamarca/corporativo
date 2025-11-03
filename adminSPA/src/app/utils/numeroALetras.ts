export function numeroALetras(num: number): string {
  const unidades = [
    '',
    'uno',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve'
  ];

  const decenas = [
    '',
    'diez',
    'veinte',
    'treinta',
    'cuarenta',
    'cincuenta',
    'sesenta',
    'setenta',
    'ochenta',
    'noventa'
  ];

  const centenas = [
    '',
    'cien',
    'doscientos',
    'trescientos',
    'cuatrocientos',
    'quinientos',
    'seiscientos',
    'setecientos',
    'ochocientos',
    'novecientos'
  ];

  function convertir(num: number): string {
    if (num === 0) return 'cero';
    if (num < 10) return unidades[num];
    if (num < 100) {
      const d = Math.floor(num / 10);
      const u = num % 10;
      return decenas[d] + (u ? ' y ' + unidades[u] : '');
    }
    if (num < 1000) {
      const c = Math.floor(num / 100);
      const resto = num % 100;
      if (num === 100) return 'cien';
      return (
        centenas[c] +
        (resto ? ' ' + convertir(resto) : '')
      );
    }
    if (num < 1000000) {
      const miles = Math.floor(num / 1000);
      const resto = num % 1000;
      return (
        (miles === 1 ? 'mil' : convertir(miles) + ' mil') +
        (resto ? ' ' + convertir(resto) : '')
      );
    }
    return num.toString();
  }

  const enteros = Math.floor(num);
  const decimales = Math.round((num - enteros) * 100);
  const letrasEnteros = convertir(enteros);
  const letrasDecimales =
    decimales > 0 ? ` con ${decimales}/100` : '';

  return `${letrasEnteros.toUpperCase()}${letrasDecimales} SOLES`;
}
