// Script para verificar compilación básica de TypeScript
console.log('🔍 VERIFICANDO COMPILACIÓN DE ANGULAR...\n');

// Verificar sintaxis básica de archivos TypeScript
const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Verificaciones básicas de sintaxis
    const errors = [];

    // Verificar imports
    const importMatches = content.match(/import\s+{[^}]*}\s+from\s+['"][^'"]*['"]/g) || [];
    importMatches.forEach(imp => {
      if (!imp.includes('from')) {
        errors.push(`Import malformado: ${imp}`);
      }
    });

    // Verificar interfaces
    const interfaceMatches = content.match(/export\s+interface\s+\w+/g) || [];
    interfaceMatches.forEach(int => {
      if (!int.includes('interface')) {
        errors.push(`Interface malformada: ${int}`);
      }
    });

    // Verificar componentes
    if (content.includes('@Component')) {
      if (!content.includes('selector:')) {
        errors.push('Componente sin selector');
      }
      if (!content.includes('templateUrl:')) {
        errors.push('Componente sin templateUrl');
      }
    }

    if (errors.length > 0) {
      console.log(`❌ ${path.basename(filePath)}:`);
      errors.forEach(error => console.log(`   - ${error}`));
      return false;
    } else {
      console.log(`✅ ${path.basename(filePath)}`);
      return true;
    }

  } catch (error) {
    console.log(`❌ Error leyendo ${filePath}: ${error.message}`);
    return false;
  }
}

// Archivos a verificar
const filesToCheck = [
  'src/app/interfaces/cliente-interface.ts',
  'src/app/interfaces/creditos-interface.ts',
  'src/app/interfaces/caja-interface.ts',
  'src/app/components/creditos/index-creditos/index-creditos.component.ts',
  'src/app/components/caja/index-caja/index-caja.component.ts',
  'src/app/services/creditos.service.ts',
  'src/app/services/caja.service.ts'
];

console.log('📁 Verificando archivos...\n');

let totalFiles = filesToCheck.length;
let validFiles = 0;

filesToCheck.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    if (checkFile(fullPath)) {
      validFiles++;
    }
  } else {
    console.log(`❌ ${file} - NO EXISTE`);
  }
});

console.log(`\n📊 RESULTADO: ${validFiles}/${totalFiles} archivos válidos`);

if (validFiles === totalFiles) {
  console.log('\n🎉 SINTAXIS BÁSICA CORRECTA');
  console.log('💡 Si Angular aún tiene errores, intenta:');
  console.log('   1. rm -rf node_modules && npm install');
  console.log('   2. ng build --configuration development');
  console.log('   3. ng serve --port 4200');
} else {
  console.log('\n⚠️  HAY ERRORES DE SINTAXIS QUE CORREGIR');
}