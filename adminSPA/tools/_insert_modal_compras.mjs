import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../src/app/components/compras/create-compras/create-compras.component.html");
const allLines = fs.readFileSync(p, "utf8").split("\n");
const chunk = allLines.slice(855, 1050).join("\n") + "\n";
let c = chunk
  .replace("<!-- MODAL NUEVO PRODUCTO -->", "<!-- MODAL EDITAR DETALLE (único, fuera del *ngFor) -->")
  .replace('id="addProducto"', 'id="addProductoDetalle"')
  .replace('id="addProductoLabel"', 'id="addProductoDetalleLabel"')
  .replace(
    "Agregar\n                                        Producto existente",
    "Editar línea de detalle"
  )
  .replace('<div class="modal-dialog">', '<div class="modal-dialog modal-dialog-scrollable modal-lg">')
  .replace('class="modal-header bg-success text-white"', 'class="modal-header bg-primary text-white"')
  .replace(
    'btn-close" data-bs-dismiss="modal" aria-label="Close"',
    'btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"'
  )
  .replace(
    '(click)="agregarProductoNuevo()">Agregar</button>',
    '(click)="actualizarDetalleCompras(indexDetalle)">Guardar</button>'
  );
let text = fs.readFileSync(p, "utf8");
const marker =
  "</tbody>\r\n                                    \r\n                                </table>\r\n" +
  "                            </div>\r\n        \r\n                        </div>\r\n                    </div>\r\n" +
  "        \r\n                    <!-- MODAL BUSCADOR DE PRODUCTOS -->";
if (!text.includes(marker)) {
  console.error("marker not found");
  process.exit(1);
}
text = text.replace(
  marker,
  "</tbody>\r\n                                    \r\n                                </table>\r\n\r\n" +
    c.replace(/\n/g, "\r\n") +
    "\r\n                            </div>\r\n        \r\n                        </div>\r\n                    </div>\r\n" +
  "        \r\n                    <!-- MODAL BUSCADOR DE PRODUCTOS -->"
);
fs.writeFileSync(p, text, "utf8");
console.log("ok");
