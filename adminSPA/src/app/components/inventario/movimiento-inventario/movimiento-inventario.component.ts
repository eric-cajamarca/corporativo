import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MovimientoInventarioService,
  TipoMovimientoItem,
  ItemMovimiento
} from '../../../services/movimiento-inventario.service';
import { SucursalService } from '../../../services/sucursal.service';
import { ProductoService } from '../../../services/producto.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';
import { ProductoCrearModalService, ProductoCreadoModalResult } from '../../../services/producto-crear-modal.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast: any;

export interface FilaDetalle {
  idProducto: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  fechaVencimiento: string;
  numeroLote: string;
}

@Component({
  selector: 'app-movimiento-inventario',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    TopnavComponent,
    SidebarComponent
  ],
  templateUrl: './movimiento-inventario.component.html',
  styleUrl: './movimiento-inventario.component.css'
})
export class MovimientoInventarioComponent implements OnInit {

  sidebarState = inject(SidebarStateService);
  form: FormGroup;
  tiposMovimiento: TipoMovimientoItem[] = [];
  sucursales: any[] = [];
  productos: any[] = [];
  comprobantesInventario: any[] = [];
  filas: FilaDetalle[] = [];
  cargando = false;
  guardando = false;

  constructor(
    private fb: FormBuilder,
    private movimientoService: MovimientoInventarioService,
    private sucursalService: SucursalService,
    private productoService: ProductoService,
    private comprobanteService: ComprobanteService,
    private buscadorProductosModal: BuscadorProductosModalService,
    private productoCrearModal: ProductoCrearModalService,
    private router: Router,
    //public sidebarState: SidebarStateService
  ) {
    this.form = this.fb.group({
      tipoMovimiento: ['', [Validators.required]],
      idSucursal: ['', [Validators.required]],
      fechaMovimiento: [this.fechaHoy(), [Validators.required]],
      idComprobante: [''],
      docRelacionado: [''],
      observaciones: ['']
    });
  }

  fechaHoy(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  ngOnInit(): void {
    this.cargarTipos();
    this.cargarSucursales();
    this.cargarProductos();
    this.cargarComprobantesInventario();
    this.agregarFila();
  }

  cargarTipos(): void {
    this.movimientoService.obtenerTiposMovimiento().subscribe({
      next: (data) => { this.tiposMovimiento = data || []; },
      error: () => {
        this.tiposMovimiento = [
          { codigo: 'INVENTARIO_INICIAL', descripcion: 'Inventario inicial' },
          { codigo: 'ENTRADA_VARIA', descripcion: 'Entrada varia' },
          { codigo: 'REAJUSTE_POSITIVO', descripcion: 'Reajuste de stock (positivo)' },
          { codigo: 'REAJUSTE_NEGATIVO', descripcion: 'Reajuste de stock (negativo)' },
          { codigo: 'SALIDA_MERMA', descripcion: 'Salida / Merma' }
        ];
      }
    });
  }

  cargarSucursales(): void {
    this.sucursalService.obtener_sucursal_todos().subscribe({
      next: (res) => { this.sucursales = res?.data || []; },
      error: () => iziToast.error({ title: 'Error', message: 'No se pudieron cargar sucursales', position: 'topRight' })
    });
  }

  cargarProductos(): void {
    this.productoService.obtenerProductosTodos().subscribe({
      next: (res) => {
        const data = res?.data;
        this.productos = Array.isArray(data) ? data : (data ? [data] : []);
      },
      error: () => iziToast.error({ title: 'Error', message: 'No se pudieron cargar productos', position: 'topRight' })
    });
  }

  cargarComprobantesInventario(): void {
    this.comprobanteService.obtener_comprobantes().subscribe({
      next: (res) => {
        const data = res?.data || [];
        const codigosValidos = new Set(['IV', 'II', 'IN', 'SA']);
        this.comprobantesInventario = data.filter((c: any) => codigosValidos.has(String(c.codigo || '').toUpperCase()));
      },
      error: () => {
        this.comprobantesInventario = [];
      }
    });
  }

  onComprobanteChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const id = target?.value ? String(target.value) : '';
    const comp = this.comprobantesInventario.find(c => String(c.idComprobante) === id);
    if (!comp) {
      this.form.patchValue({ docRelacionado: '' });
      return;
    }
    const serie = comp.serie || '';
    const numero = comp.numero != null ? String(comp.numero) : '';
    const doc = serie && numero ? `${serie}-${numero}` : (serie || numero || '');
    this.form.patchValue({ docRelacionado: doc });
  }

  esEntrada(): boolean {
    const t = this.form.get('tipoMovimiento')?.value;
    return t === 'INVENTARIO_INICIAL' || t === 'ENTRADA_VARIA' || t === 'REAJUSTE_POSITIVO';
  }

  agregarFila(): void {
    this.filas.push({
      idProducto: '',
      codigo: '',
      descripcion: '',
      cantidad: 0,
      costoUnitario: 0,
      fechaVencimiento: '',
      numeroLote: ''
    });
  }

  async abrirBuscadorProductos(): Promise<void> {
    const idSucursal = this.form.get('idSucursal')?.value || undefined;
    const seleccionado = await this.buscadorProductosModal.abrir(idSucursal);
    if (!seleccionado) return;
    this.agregarProductoSeleccionado(seleccionado);
  }

  async abrirCrearProducto(): Promise<void> {
    const creado = await this.productoCrearModal.abrir();
    if (!creado) {
      return;
    }
    this.cargarProductos();
    const idSuc = creado.idSucursalLote;
    const sucCtrl = this.form.get('idSucursal');
    if (idSuc && (!sucCtrl?.value || sucCtrl.value === '')) {
      this.form.patchValue({ idSucursal: idSuc });
    }
    this.aplicarProductoCreadoAlDetalle(creado);
  }

  /**
   * Tras crear producto en el modal: agrega línea al detalle del movimiento.
   * Entrada: usa cantidad/costo/vencimiento del lote inicial si se indicó en el modal.
   * Salida: deja el producto con cantidad 1 para que el usuario ajuste.
   */
  aplicarProductoCreadoAlDetalle(creado: ProductoCreadoModalResult): void {
    let fila = this.filas.find((f) => !f.idProducto);
    if (!fila) {
      this.agregarFila();
      fila = this.filas[this.filas.length - 1];
    }
    fila.idProducto = String(creado.idProducto);
    fila.codigo = creado.codigo || '';
    fila.descripcion = creado.descripcion || '';

    if (this.esEntrada()) {
      const q =
        creado.cantidadDesdeLote != null && creado.cantidadDesdeLote > 0
          ? Number(creado.cantidadDesdeLote)
          : 1;
      fila.cantidad = q;
      if (creado.costoUnitario != null && creado.costoUnitario > 0) {
        fila.costoUnitario = Number(creado.costoUnitario);
      }
      if (creado.fechaVencimiento) {
        fila.fechaVencimiento = String(creado.fechaVencimiento).slice(0, 10);
      }
      if (creado.numeroLote) {
        fila.numeroLote = String(creado.numeroLote);
      }
    } else {
      fila.cantidad = 1;
    }
  }

  agregarProductoSeleccionado(p: ProductoSeleccionado): void {
    let fila = this.filas.find(f => !f.idProducto);
    if (!fila) {
      this.agregarFila();
      fila = this.filas[this.filas.length - 1];
    }
    fila.idProducto = String(p.idProducto);
    fila.codigo = p.codigo || '';
    fila.descripcion = p.descripcion || '';
    if (!fila.cantidad || fila.cantidad <= 0) {
      fila.cantidad = 1;
    }
  }

  quitarFila(index: number): void {
    this.filas.splice(index, 1);
  }

  onProductoChange(index: number, idProducto: string): void {
    const p = this.productos.find(x => x.idProducto === idProducto);
    if (p) {
      this.filas[index].codigo = p.codigo || '';
      this.filas[index].descripcion = p.descripcion || p.nombre || '';
    }
  }

  get subTotal(): number {
    return this.filas.reduce((sum, f) => {
      if (!f.idProducto || f.cantidad <= 0) return sum;
      const costo = this.esEntrada() ? (f.costoUnitario || 0) : 0;
      return sum + (f.cantidad * costo);
    }, 0);
  }

  registrar(): void {
    if (this.form.invalid) {
      iziToast.warning({ title: 'Datos incompletos', message: 'Seleccione tipo de movimiento y sucursal', position: 'topRight' });
      return;
    }
    const itemsValidos = this.filas.filter(f => f.idProducto && f.cantidad > 0);
    if (itemsValidos.length === 0) {
      iziToast.warning({ title: 'Datos incompletos', message: 'Agregue al menos un producto con cantidad mayor a 0', position: 'topRight' });
      return;
    }
    const items: ItemMovimiento[] = itemsValidos.map(f => {
      const item: ItemMovimiento = { idProducto: f.idProducto, cantidad: Number(f.cantidad) };
      if (this.esEntrada()) {
        if (f.costoUnitario != null && f.costoUnitario > 0) item.costoUnitario = Number(f.costoUnitario);
        if (f.fechaVencimiento) item.fechaVencimiento = f.fechaVencimiento;
        if (f.numeroLote) item.numeroLote = f.numeroLote;
      }
      return item;
    });
    const body = {
      tipoMovimiento: this.form.get('tipoMovimiento')?.value,
      idSucursal: this.form.get('idSucursal')?.value,
      fechaMovimiento: this.form.get('fechaMovimiento')?.value || undefined,
      idComprobante: this.form.get('idComprobante')?.value || undefined,
      docRelacionado: this.form.get('docRelacionado')?.value || undefined,
      observaciones: this.form.get('observaciones')?.value || undefined,
      items
    };
    this.guardando = true;
    this.movimientoService.registrarMovimiento(body).subscribe({
      next: (resp) => {
        this.guardando = false;
        iziToast.success({ title: 'Éxito', message: resp.message || 'Movimiento registrado', position: 'topRight' });
        this.router.navigate(['/inventario']);
      },
      error: (err) => {
        this.guardando = false;
        const msg = err?.error?.message || 'Error al registrar movimiento';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }
}
