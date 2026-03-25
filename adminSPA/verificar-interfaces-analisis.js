// Verificación de interfaces de análisis
console.error('🔍 VERIFICANDO INTERFACES DE ANÁLISIS...\n');

// Leer el archivo de interfaces
const fs = require('fs');
const path = require('path');

try {
  const interfacesPath = path.join(__dirname, 'src/app/interfaces/analisis-interface.ts');
  const content = fs.readFileSync(interfacesPath, 'utf8');

  console.error('✅ Archivo de interfaces encontrado');

  // Verificar propiedades requeridas
  const requiredProperties = {
    'DashboardEjecutivo': [
      'patrimonio',
      'ventasTotales',
      'utilidadNeta',
      'flujoCaja',
      'roi',
      'margenBruto',
      'margenOperativo',
      'margenNeto',
      'crecimientoVentas',
      'cuentasPorCobrar',
      'cuentasPorPagar',
      'inventarioTotal'
    ],
    'BalanceGeneral': [
      'patrimonio',
      'activoCorriente',
      'activoFijo',
      'activoTotal',
      'pasivoCorriente',
      'pasivoLargoPlazo',
      'pasivoTotal',
      'ratioLiquidez',
      'ratioEndeudamiento'
    ],
    'EstadoResultados': [
      'ingresos',
      'costoVentas',
      'utilidadBruta',
      'gastosOperacion',
      'utilidadOperacion',
      'gastosFinancieros',
      'impuestos',
      'utilidadNeta'
    ],
    'RatiosFinancieros': [
      'ratioLiquidezCorriente',
      'ratioLiquidezAcida',
      'ratioLiquidezInmediata',
      'ratioDeudaTotal',
      'ratioDeudaPatrimonio',
      'coberturaIntereses',
      'margenBruto',
      'margenOperativo',
      'margenNeto',
      'ROA',
      'ROE',
      'rotacionInventario',
      'rotacionCuentasCobrar',
      'cicloConversionEfectivo'
    ],
    'DiagnosticoFinanciero': [
      'saludFinanciera',
      'puntuacion',
      'fortalezas',
      'debilidades',
      'recomendaciones'
    ]
  };

  let allPresent = true;

  Object.entries(requiredProperties).forEach(([interfaceName, properties]) => {
    console.error(`\n📋 Verificando ${interfaceName}:`);
    properties.forEach(prop => {
      if (content.includes(`${prop}:`)) {
        console.error(`  ✅ ${prop}`);
      } else {
        console.error(`  ❌ ${prop} - NO ENCONTRADO`);
        allPresent = false;
      }
    });
  });

  console.error(`\n${allPresent ? '🎉' : '⚠️'} RESULTADO: ${allPresent ? 'Todas las propiedades están presentes' : 'Faltan propiedades'}`);

  if (allPresent) {
    console.error('\n💡 Si Angular aún tiene errores:');
    console.error('   1. rm -rf node_modules && npm install');
    console.error('   2. rm -rf .angular dist');
    console.error('   3. ng serve --port 4200');
  }

} catch (error) {
  console.error('❌ Error leyendo interfaces:', error.message);
}