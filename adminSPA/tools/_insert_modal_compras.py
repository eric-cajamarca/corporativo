from pathlib import Path

p = Path("adminSPA/src/app/components/compras/create-compras/create-compras.component.html")
lines = p.read_text(encoding="utf-8").splitlines(keepends=True)
chunk = "".join(lines[855:1050])
chunk = chunk.replace("<!-- MODAL NUEVO PRODUCTO -->", "<!-- MODAL EDITAR DETALLE (único, fuera del *ngFor) -->")
chunk = chunk.replace('id="addProducto"', 'id="addProductoDetalle"')
chunk = chunk.replace('id="addProductoLabel"', 'id="addProductoDetalleLabel"')
chunk = chunk.replace(
    "Agregar\n                                        Producto existente",
    "Editar línea de detalle",
)
chunk = chunk.replace('<div class="modal-dialog">', '<div class="modal-dialog modal-dialog-scrollable modal-lg">')
chunk = chunk.replace('class="modal-header bg-success text-white"', 'class="modal-header bg-primary text-white"')
chunk = chunk.replace(
    'btn-close" data-bs-dismiss="modal" aria-label="Close"',
    'btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"',
)
chunk = chunk.replace(
    '(click)="agregarProductoNuevo()">Agregar</button>',
    '(click)="actualizarDetalleCompras(indexDetalle)">Guardar</button>',
)
text = "".join(lines)
marker = (
    "</tbody>\n                                    \n                                </table>\n"
    "                            </div>\n        \n                        </div>\n                    </div>\n"
    "        \n                    <!-- MODAL BUSCADOR DE PRODUCTOS -->"
)
if marker not in text:
    raise SystemExit("marker not found")
text = text.replace(
    marker,
    "</tbody>\n                                    \n                                </table>\n\n"
    + chunk
    + "\n                            </div>\n        \n                        </div>\n                    </div>\n"
    "        \n                    <!-- MODAL BUSCADOR DE PRODUCTOS -->",
    1,
)
p.write_text(text, encoding="utf-8")
print("ok")
