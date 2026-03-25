/**
 * Lee el Excel Anexos I y II Formato 1.3 de SUNAT y muestra la estructura de cada hoja
 * para construir los archivos planos CAB, DET, TRI, LEY.
 */
const path = require("path");
const XLSX = require("xlsx");

const rutaExcel = path.resolve(__dirname, "../../otros/AnexosIyII_Formato1.3.xlsx");

try {
  const workbook = XLSX.readFile(rutaExcel);
    const name = "Factura y boleta 2.1 ";
  const sheet = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        data.forEach((row, i) => {
    const orden = row[7] !== undefined && row[7] !== "" ? row[7] : (row[6] !== undefined ? row[6] : "");
    const dato = (row[2] || row[1] || "").toString().trim();
    if (orden !== "" || dato.toLowerCase().includes("archivo") || (typeof row[1] === "number" && row[1] <= 30)) {
          }
  });
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
