# Paginación en componentes Caja

Componentes con **tabla de listado** que conviene paginar:

| Componente | Archivo | Variable de lista | Dónde agregar paginación |
|------------|---------|-------------------|---------------------------|
| **index-caja** | index-caja.component | `movimientos` | Tabla de movimientos de la caja seleccionada |
| **ventas-pendientes-pago** | ventas-pendientes-pago.component | `list` | Tabla de ventas pendientes de pago |
| **recibo-ingreso** | recibo-ingreso.component | `list` | Tabla de recibos de ingreso |
| **recibo-egreso** | recibo-egreso.component | `list` | Tabla de recibos de egreso |
| **pago-proveedores** | pago-proveedores.component | `list` | Tabla de compras/cuentas por pagar |

**No se paginan** (pocos ítems o son resúmenes):
- **arqueo-caja**: tablas de resumen y modales de detalle.
- **conteo-dinero**: sin tabla de listado grande.

---

## Código reutilizable

### 1. Variables y métodos en el `.ts` (común para todos)

Agregar en la **clase del componente** (junto al resto de propiedades públicas):

```typescript
  // --- Paginación (agregar donde corresponda: list o movimientos)
  page = 1;
  pageSize = 10;
  get totalItems(): number {
    return this.list.length;   // o this.movimientos.length en index-caja
  }
  get listPaginated(): any[] { // o movimientosPaginated en index-caja, tipo según tu interfaz
    const start = (this.page - 1) * this.pageSize;
    return this.list.slice(start, start + this.pageSize);
  }
  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.page = p;
  }
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }
```

- En **index-caja** reemplaza `list` por `movimientos` en `totalItems` y crea `movimientosPaginated` en lugar de `listPaginated` (y en el HTML usas `movimientosPaginated`).

### 2. En el HTML: usar la lista paginada y controles

- Donde hoy tienes:
  - `*ngFor="let item of list"`  →  `*ngFor="let item of listPaginated"`
  - o `*ngFor="let movimiento of movimientos"`  →  `*ngFor="let movimiento of movimientosPaginated"`
- Justo **después de `</table>`** (dentro del mismo `div.table-responsive` o del `card-body`) agrega:

```html
          <!-- Paginación -->
          <nav *ngIf="totalPaginas > 1" class="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
            <small class="text-muted">
              Mostrando {{ (page - 1) * pageSize + 1 }} - {{ min((page) * pageSize, totalItems) }} de {{ totalItems }}
            </small>
            <ul class="pagination pagination-sm mb-0">
              <li class="page-item" [class.disabled]="page <= 1">
                <a class="page-link" href="javascript:void(0)" (click)="cambiarPagina(page - 1)" aria-label="Anterior">
                  <span aria-hidden="true">&laquo;</span>
                </a>
              </li>
              <li *ngFor="let p of [].constructor(totalPaginas); let i = index" class="page-item" [class.active]="page === i + 1">
                <a class="page-link" href="javascript:void(0)" (click)="cambiarPagina(i + 1)">{{ i + 1 }}</a>
              </li>
              <li class="page-item" [class.disabled]="page >= totalPaginas">
                <a class="page-link" href="javascript:void(0)" (click)="cambiarPagina(page + 1)" aria-label="Siguiente">
                  <span aria-hidden="true">&raquo;</span>
                </a>
              </li>
            </ul>
          </nav>
```

**Nota:** `[].constructor(totalPaginas)` puede no iterar bien en algunos entornos. Alternativa sin pipe: usar un getter que devuelva un array de números. Abajo tienes la **alternativa con getter** `paginas` para evitar eso.

---

## Alternativa: getter `paginas` en el TS (recomendada)

En el `.ts` agrega también:

```typescript
  get paginas(): number[] {
    const n = this.totalPaginas;
    return Array.from({ length: n }, (_, i) => i + 1);
  }
```

Y en el HTML, en lugar de `*ngFor="let p of [].constructor(totalPaginas); let i = index"` y `(click)="cambiarPagina(i + 1)"` y `{{ i + 1 }}`, usa:

```html
              <li *ngFor="let p of paginas" class="page-item" [class.active]="page === p">
                <a class="page-link" href="javascript:void(0)" (click)="cambiarPagina(p)">{{ p }}</a>
              </li>
```

Para el texto "Mostrando X - Y de Z", en Angular puedes usar un método en el componente para no depender de `min` en el template:

En el **.ts**:
```typescript
  desdePagina(): number {
    return (this.page - 1) * this.pageSize + 1;
  }
  hastaPagina(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }
```

En el **HTML** (texto de “Mostrando”):
```html
Mostrando {{ desdePagina() }} - {{ hastaPagina() }} de {{ totalItems }}
```

(Así no hace falta una función `min` en el template.)

---

## Resumen por componente

### index-caja
- **TS**: Propiedades: `page = 1`, `pageSize = 10`. Getters: `totalItems` (sobre `this.movimientos`), `movimientosPaginated` (slice de `movimientos`), `totalPaginas`, `paginas`, `desdePagina`, `hastaPagina`. Método: `cambiarPagina(p)`.
- **HTML**: Tabla: `*ngFor="let movimiento of movimientosPaginated"`. Después de `</table>`: bloque de paginación usando `movimientosPaginated`/`totalItems`/`totalPaginas`/`paginas`/`desdePagina()`/`hastaPagina()`.

### ventas-pendientes-pago
- **TS**: Igual que el patrón anterior pero con `list` y `listPaginated`.
- **HTML**: `*ngFor="let v of listPaginated"` y el mismo bloque de paginación.

### recibo-ingreso
- **TS**: Igual con `list` y `listPaginated`.
- **HTML**: `*ngFor="let item of listPaginated"` y el mismo bloque de paginación.

### recibo-egreso
- **TS**: Igual con `list` y `listPaginated`.
- **HTML**: `*ngFor="let item of listPaginated"` y el mismo bloque de paginación.

### pago-proveedores
- **TS**: Igual con `list` y `listPaginated`.
- **HTML**: `*ngFor="let item of listPaginated"` y el mismo bloque de paginación.

Si quieres, en el siguiente paso puedo aplicar yo estos cambios en cada componente (TS + HTML) y dejarte solo revisar.
