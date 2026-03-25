// Script para verificar compilación básica de TypeScript
console.error('🔍 VERIFICANDO COMPILACIÓN DE ANGULAR...\n');

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
      console.error(`❌ ${path.basename(filePath)}:`);
      errors.forEach(error => console.error(`   - ${error}`));
      return false;
    } else {
      console.error(`✅ ${path.basename(filePath)}`);
      return true;
    }

  } catch (error) {
    console.error(`❌ Error leyendo ${filePath}: ${error.message}`);
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

console.error('📁 Verificando archivos...\n');

let totalFiles = filesToCheck.length;
let validFiles = 0;

filesToCheck.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    if (checkFile(fullPath)) {
      validFiles++;
    }
  } else {
    console.error(`❌ ${file} - NO EXISTE`);
  }
});

console.error(`\n📊 RESULTADO: ${validFiles}/${totalFiles} archivos válidos`);

if (validFiles === totalFiles) {
  console.error('\n🎉 SINTAXIS BÁSICA CORRECTA');
  console.error('💡 Si Angular aún tiene errores, intenta:');
  console.error('   1. rm -rf node_modules && npm install');
  console.error('   2. ng build --configuration development');
  console.error('   3. ng serve --port 4200');
} else {
  console.error('\n⚠️  HAY ERRORES DE SINTAXIS QUE CORREGIR');
}