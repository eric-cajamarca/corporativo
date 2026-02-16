/**
 * Extrae la estructura de archivos planos (CAB, DET, TRI, LEY, etc.) por hoja del Excel Anexos I y II.
 * Uso: node scripts/extraerEstructuraAnexos.js [nombreHoja]
 * Sin argumentos: lista todas las hojas y estructura de "Factura y boleta 2.1" y "Nota 2.1".
 */
const path = require("path");
const XLSX = require("xlsx");

const rutaExcel = path.resolve(__dirname, "../../otros/AnexosIyII_Formato1.3.xlsx");
const workbook = XLSX.readFile(rutaExcel);

function estructurasDeHoja(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const bloques = [];
  let archivoActual = "";
  let ordenCol = 7;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const dato = (row[2] != null ? row[2] : row[1] != null ? row[1] : "").toString().trim();
    const orden = (row[7] != null && row[7] !== "" ? row[7] : row[6] != null ? row[6] : "").toString().trim();
    if (dato.toLowerCase().includes("archivo:")) {
      archivoActual = dato;
    }
    if (orden !== "" || (archivoActual && dato && /^\d+$/.test(orden))) {
      bloques.push({ fila: i + 1, archivo: archivoActual.substring(0, 50), orden, dato: dato.substring(0, 55) });
    }
  }
  return bloques;
}

const hojasRelevantes = ["Factura y boleta 2.1 ", "Nota 2.1", "Resumen Diario", "Comunicación de Baja"];
const hojaArg = process.argv[2];

if (hojaArg) {
  const bloques = estructurasDeHoja(hojaArg);
  console.log("\n=== Hoja:", hojaArg, "===\n");
  bloques.forEach((b) => console.log(b.fila, "|", b.archivo, "| Orden:", b.orden, "|", b.dato));
} else {
  console.log("Hojas:", workbook.SheetNames.join(", "));
  hojasRelevantes.forEach((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return;
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    console.log("\n=== Hoja:", name, "| Filas:", data.length, "===");
    let archivoActual = "";
    for (let i = 0; i < Math.min(data.length, 120); i++) {
      const row = data[i];
      const dato = (row[2] != null ? row[2] : row[1] != null ? row[1] : "").toString().trim();
      const orden = (row[7] != null && row[7] !== "" ? row[7] : row[6] != null ? row[6] : "").toString().trim();
      if (dato.toLowerCase().includes("archivo:")) archivoActual = dato;
      if (orden !== "" || (archivoActual && dato && /^\d+$/.test(String(orden)))) {
        console.log(i + 1, "|", archivoActual.substring(0, 45), "|", orden, "|", dato.substring(0, 50));
      }
    }
  });
}
