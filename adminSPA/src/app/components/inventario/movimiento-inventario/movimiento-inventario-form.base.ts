import { Directive, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  MovimientoInventarioService,
  TipoMovimientoItem,
  ItemMovimiento,
  MovimientoRequest
} from '../../../services/movimiento-inventario.service';
import { SucursalService } from '../../../services/sucursal.service';
import { ProductoService } from '../../../services/producto.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';
import { ProductoCrearModalService, ProductoCreadoModalResult } from '../../../services/producto-crear-modal.service';
import { ProductoEditarModalService } from '../../../services/producto-editar-modal.service';
import { Producto } from '../../../models/producto.models';
import { fechaEmisionVentaParaApi } from '../../../utils/fecha-local.util';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { MovimientoInventarioBorradorService } from '../../../services/movimiento-inventario-borrador.service';
import {
  etiquetaTipoMovimiento,
  MovimientoInventarioCabecera
} from '../../../models/movimientos-inventario-resumen.model';
import {
  CODIGO_COMPROBANTE_POR_TIPO_MOVIMIENTO,
  FilaDetalle
} from './movimiento-inventario.constants';
import { MovimientoInventarioBorradorModo } from '../../../interfaces/movimiento-inventario-borrador.interface';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void; warning: (o: object) => void };

@Directive()
export abstract class MovimientoInventarioFormBase implements OnInit, OnDestroy {
  sidebarState = inject(SidebarStateService);

  protected readonly fb = inject(FormBuilder);
  protected readonly movimientoService = inject(MovimientoInventarioService);
  protected readonly sucursalService = inject(SucursalService);
  protected readonly productoService = inject(ProductoService);
  protected readonly comprobanteService = inject(ComprobanteService);
  protected readonly buscadorProductosModal = inject(BuscadorProductosModalService);
  protected readonly productoCrearModal = inject(ProductoCrearModalService);
  protected readonly productoEditarModal = inject(ProductoEditarModalService);
  protected readonly borradorService = inject(MovimientoInventarioBorradorService);
  protected readonly router = inject(Router);
  protected readonly route = inject(ActivatedRoute);

  form: FormGroup;
  tiposMovimiento: TipoMovimientoItem[] = [];
  sucursales: { idSucursal?: string; nombre?: string }[] = [];
  comprobantesInventario: { idComprobante?: string; codigo?: string; nombre?: string; serie?: string; numero?: string | number }[] = [];
  filas: FilaDetalle[] = [];
  movimientosRecientes: MovimientoInventarioCabecera[] = [];
  guardando = false;
  cargandoRecientes = false;

  /** Hay borrador local con contenido (para banner Descartar). */
  tieneBorradorLocal = false;
  fechaBorradorLocal = '';

  private formSub?: Subscription;
  private borradorTimer: ReturnType<typeof setTimeout> | null = null;
  private saltarSugerenciaComprobante = false;
  private readonly DEBOUNCE_BORRADOR_MS = 300;
  private prefillMerma: Record<string, string> | null = null;
  private tiposListos = false;
  private sucursalesListas = false;
  private prefillMermaAplicado = false;

  /** Tipos de movimiento permitidos en esta pantalla (códigos API). */
  protected abstract readonly tiposCodigoPermitidos: readonly string[];
  /** Códigos de comprobante (tabla Comprobantes) mostrados en el selector. */
  protected abstract readonly codigosComprobantePermitidos: readonly string[];
  /** Si el detalle incluye costo, vencimiento y lote (solo ingresos). */
  abstract esEntrada(): boolean;

  /** true = pantalla de ingresos (enlaces y textos alternos). */
  abstract readonly modoIngreso: boolean;

  abstract get tituloPagina(): string;
  abstract get subtituloPagina(): string;
  abstract get textoAyudaComprobantes(): string;
  abstract get etiquetaBotonGuardar(): string;

  constructor() {
    this.form = this.fb.group({
      tipoMovimiento: ['', [Validators.required]],
      idSucursal: ['', [Validators.required]],
      idSucursalDestino: [''],
      fechaMovimiento: [this.fechaHoy(), [Validators.required]],
      idComprobante: [''],
      docRelacionado: [''],
      observaciones: ['']
    });
  }

  fechaHoy(): string {
    return this.fechaLocalYmd(new Date());
  }

  private leerQueryPrefillMerma(): Record<string, string> | null {
    if (this.modoIngreso) {
      return null;
    }
    const q = this.route.snapshot.queryParamMap;
    const idProducto = String(q.get('idProducto') || '').trim();
    if (!idProducto) {
      return null;
    }
    return {
      tipo: String(q.get('tipo') || 'SALIDA_MERMA').trim() || 'SALIDA_MERMA',
      idProducto,
      idSucursal: String(q.get('idSucursal') || '').trim(),
      idLote: String(q.get('idLote') || '').trim(),
      cantidad: String(q.get('cantidad') || '').trim(),
      codigo: String(q.get('codigo') || '').trim(),
      descripcion: String(q.get('descripcion') || '').trim(),
      numeroLote: String(q.get('numeroLote') || '').trim(),
      fechaVencimiento: String(q.get('fechaVencimiento') || '').trim(),
      costoUnitario: String(q.get('costoUnitario') || '').trim()
    };
  }

  private aplicarPrefillMermaSiListo(): void {
    if (!this.prefillMerma || this.prefillMermaAplicado || !this.tiposListos || !this.sucursalesListas) {
      return;
    }
    this.prefillMermaAplicado = true;
    const p = this.prefillMerma;
    const tipo = this.tiposMovimiento.some((t) => t.codigo === p['tipo'])
      ? p['tipo']
      : 'SALIDA_MERMA';
    const idSucursal =
      p['idSucursal'] && this.sucursales.some((s) => String(s.idSucursal) === p['idSucursal'])
        ? p['idSucursal']
        : String(this.sucursales[0]?.idSucursal || '');
    const nro = p['numeroLote'] || '';
    const fv = p['fechaVencimiento'] || '';
    const obs = [
      'Baja por vencimiento',
      nro ? `lote ${nro}` : '',
      fv ? `f.venc ${fv}` : ''
    ].filter(Boolean).join('. ');
    this.form.patchValue({
      tipoMovimiento: tipo,
      idSucursal,
      observaciones: obs
    });
    this.filas = [
      {
        idProducto: p['idProducto'],
        codigo: p['codigo'],
        descripcion: p['descripcion'],
        cantidad: Number(p['cantidad']) || 0,
        costoUnitario: Number(p['costoUnitario']) || 0,
        fechaVencimiento: fv,
        numeroLote: nro,
        idLote: p['idLote']
      }
    ];
    this.aplicarComprobanteSugeridoPorTipo(tipo);
    this.programarGuardadoBorrador();
  }

  ngOnInit(): void {
    this.cargarTipos();
    this.cargarSucursales();
    this.cargarComprobantesInventario();
    this.cargarMovimientosRecientes();
    this.formSub = this.form.valueChanges.subscribe(() => this.programarGuardadoBorrador());
    this.form.get('tipoMovimiento')?.valueChanges.subscribe((tipo) => {
      const t = String(tipo || '');
      if (t !== 'TRANSFERENCIA') {
        this.form.patchValue({ idSucursalDestino: '' }, { emitEvent: false });
      }
      this.aplicarComprobanteSugeridoPorTipo(t);
      this.programarGuardadoBorrador();
    });

    this.prefillMerma = this.leerQueryPrefillMerma();
    const restaurado = this.prefillMerma ? false : this.restaurarBorradorSiExiste();
    if (!restaurado && !this.prefillMerma) {
      this.agregarFila();
    }
  }

  ngOnDestroy(): void {
    if (this.borradorTimer) {
      clearTimeout(this.borradorTimer);
      this.borradorTimer = null;
    }
    this.formSub?.unsubscribe();
  }

  protected get modoBorrador(): MovimientoInventarioBorradorModo {
    return this.modoIngreso ? 'ingreso' : 'salida';
  }

  private filaVacia(): FilaDetalle {
    return {
      idProducto: '',
      codigo: '',
      descripcion: '',
      cantidad: 0,
      costoUnitario: 0,
      fechaVencimiento: '',
      numeroLote: '',
      idLote: ''
    };
  }

  private construirBorradorActual() {
    const v = this.form.getRawValue();
    return {
      version: 1 as const,
      modo: this.modoBorrador,
      fechaActualizacion: new Date().toISOString(),
      cabecera: {
        tipoMovimiento: String(v.tipoMovimiento || ''),
        idSucursal: String(v.idSucursal || ''),
        idSucursalDestino: String(v.idSucursalDestino || ''),
        fechaMovimiento: String(v.fechaMovimiento || this.fechaHoy()),
        idComprobante: String(v.idComprobante || ''),
        docRelacionado: String(v.docRelacionado || ''),
        observaciones: String(v.observaciones || '')
      },
      filas: this.filas.map((f) => ({
        idProducto: String(f.idProducto || ''),
        codigo: String(f.codigo || ''),
        descripcion: String(f.descripcion || ''),
        cantidad: Number(f.cantidad) || 0,
        costoUnitario: Number(f.costoUnitario) || 0,
        fechaVencimiento: String(f.fechaVencimiento || ''),
        numeroLote: String(f.numeroLote || ''),
        idLote: String(f.idLote || '')
      }))
    };
  }

  programarGuardadoBorrador(): void {
    if (this.borradorTimer) {
      clearTimeout(this.borradorTimer);
    }
    this.borradorTimer = setTimeout(() => {
      this.borradorTimer = null;
      this.guardarBorradorLocal();
    }, this.DEBOUNCE_BORRADOR_MS);
  }

  /** Llamar tras editar cantidades/costos/lotes en el detalle (ngModel). */
  onCambioDetalle(): void {
    this.programarGuardadoBorrador();
  }

  private guardarBorradorLocal(): void {
    const borrador = this.construirBorradorActual();
    if (!this.borradorService.tieneContenidoUtil(borrador)) {
      this.borradorService.limpiar(this.modoBorrador);
      this.tieneBorradorLocal = false;
      this.fechaBorradorLocal = '';
      return;
    }
    this.borradorService.guardar(borrador);
    this.tieneBorradorLocal = true;
    this.fechaBorradorLocal = this.formatearFechaBorrador(borrador.fechaActualizacion);
  }

  private restaurarBorradorSiExiste(): boolean {
    const data = this.borradorService.leer(this.modoBorrador);
    if (!data || !this.borradorService.tieneContenidoUtil(data)) {
      return false;
    }
    this.saltarSugerenciaComprobante = true;
    const c = data.cabecera;
    this.form.patchValue(
      {
        tipoMovimiento: c.tipoMovimiento || '',
        idSucursal: c.idSucursal || '',
        idSucursalDestino: c.idSucursalDestino || '',
        fechaMovimiento: c.fechaMovimiento || this.fechaHoy(),
        idComprobante: c.idComprobante || '',
        docRelacionado: c.docRelacionado || '',
        observaciones: c.observaciones || ''
      },
      { emitEvent: false }
    );
    this.filas =
      data.filas.length > 0
        ? data.filas.map((f) => ({
            idProducto: f.idProducto || '',
            codigo: f.codigo || '',
            descripcion: f.descripcion || '',
            cantidad: Number(f.cantidad) || 0,
            costoUnitario: Number(f.costoUnitario) || 0,
            fechaVencimiento: f.fechaVencimiento || '',
            numeroLote: f.numeroLote || '',
            idLote: f.idLote || ''
          }))
        : [this.filaVacia()];
    this.tieneBorradorLocal = true;
    this.fechaBorradorLocal = this.formatearFechaBorrador(data.fechaActualizacion);
    setTimeout(() => {
      this.saltarSugerenciaComprobante = false;
    }, 0);
    return true;
  }

  descartarBorradorLocal(): void {
    this.borradorService.limpiar(this.modoBorrador);
    this.tieneBorradorLocal = false;
    this.fechaBorradorLocal = '';
    this.saltarSugerenciaComprobante = true;
    this.form.reset({
      tipoMovimiento: '',
      idSucursal: '',
      idSucursalDestino: '',
      fechaMovimiento: this.fechaHoy(),
      idComprobante: '',
      docRelacionado: '',
      observaciones: ''
    });
    this.filas = [this.filaVacia()];
    setTimeout(() => {
      this.saltarSugerenciaComprobante = false;
    }, 0);
    iziToast.success({
      title: 'Borrador',
      message: 'Borrador local descartado.',
      position: 'topRight'
    });
  }

  private formatearFechaBorrador(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private fechaLocalYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  cargarMovimientosRecientes(): void {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    this.cargandoRecientes = true;
    this.movimientoService
      .listarMovimientosResumen({
        fechaDesde: this.fechaLocalYmd(desde),
        fechaHasta: this.fechaLocalYmd(hasta),
        idSucursal: null,
        codigoTipo: null,
        buscar: null,
        page: 1,
        pageSize: 40
      })
      .subscribe({
        next: (res) => {
          const allow = new Set(this.tiposCodigoPermitidos);
          this.movimientosRecientes = (res?.items ?? []).filter(
            (i) => i.codigoTipoMovimiento && allow.has(i.codigoTipoMovimiento)
          ).slice(0, 8);
          this.cargandoRecientes = false;
        },
        error: () => {
          this.movimientosRecientes = [];
          this.cargandoRecientes = false;
        }
      });
  }

  cargarTipos(): void {
    const permitidos = new Set(this.tiposCodigoPermitidos);
    const fallback: TipoMovimientoItem[] = [
      { codigo: 'INVENTARIO_INICIAL', descripcion: 'Inventario inicial' },
      { codigo: 'ENTRADA_VARIA', descripcion: 'Entrada varia' },
      { codigo: 'REAJUSTE_POSITIVO', descripcion: 'Reajuste de stock (positivo)' },
      { codigo: 'REAJUSTE_NEGATIVO', descripcion: 'Reajuste de stock (negativo)' },
      { codigo: 'SALIDA_MERMA', descripcion: 'Salida / Merma' },
      { codigo: 'DEVOLUCION', descripcion: 'Devoluciones' },
      { codigo: 'TRANSFERENCIA', descripcion: 'Transferencia entre sucursales' }
    ].filter((t) => permitidos.has(t.codigo));

    this.movimientoService.obtenerTiposMovimiento().subscribe({
      next: (data) => {
        const all = data || [];
        this.tiposMovimiento = all.filter((t) => permitidos.has(t.codigo));
        if (this.tiposMovimiento.length === 0) {
          this.tiposMovimiento = fallback;
        }
        this.tiposListos = true;
        this.aplicarPrefillMermaSiListo();
      },
      error: () => {
        this.tiposMovimiento = fallback;
        this.tiposListos = true;
        this.aplicarPrefillMermaSiListo();
      }
    });
  }

  cargarSucursales(): void {
    this.sucursalService.obtener_sucursal_todos().subscribe({
      next: (res) => {
        this.sucursales = res?.data || [];
        this.sucursalesListas = true;
        this.aplicarPrefillMermaSiListo();
      },
      error: () => {
        this.sucursalesListas = true;
        this.aplicarPrefillMermaSiListo();
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar sucursales', position: 'topRight' });
      }
    });
  }

  cargarComprobantesInventario(): void {
    const permitidos = new Set(this.codigosComprobantePermitidos.map((c) => c.toUpperCase()));
    this.comprobanteService.obtener_comprobantes().subscribe({
      next: (res) => {
        const data = res?.data || [];
        this.comprobantesInventario = data.filter((c: { codigo?: string }) =>
          permitidos.has(String(c.codigo || '').toUpperCase())
        );
        if (this.saltarSugerenciaComprobante || this.tieneBorradorLocal) {
          return;
        }
        const tipo = String(this.form.get('tipoMovimiento')?.value || '');
        this.aplicarComprobanteSugeridoPorTipo(tipo);
      },
      error: () => {
        this.comprobantesInventario = [];
      }
    });
  }

  private docRelacionadoDesdeComprobante(comp: { serie?: string; numero?: string | number }): string {
    const serie = comp.serie || '';
    const numero = comp.numero != null ? String(comp.numero) : '';
    return serie && numero ? `${serie}-${numero}` : serie || numero || '';
  }

  protected aplicarComprobanteSugeridoPorTipo(tipoCodigo: string): void {
    if (this.saltarSugerenciaComprobante) {
      return;
    }
    if (!tipoCodigo || !this.comprobantesInventario.length) {
      return;
    }
    const codigoComp = CODIGO_COMPROBANTE_POR_TIPO_MOVIMIENTO[tipoCodigo];
    if (!codigoComp) {
      return;
    }
    const comp = this.comprobantesInventario.find(
      (c) => String(c.codigo || '').toUpperCase() === codigoComp
    );
    if (!comp) {
      return;
    }
    const doc = this.docRelacionadoDesdeComprobante(comp);
    this.form.patchValue({
      idComprobante: String(comp.idComprobante),
      docRelacionado: doc
    });
  }

  onComprobanteChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const id = target?.value ? String(target.value) : '';
    const comp = this.comprobantesInventario.find((c) => String(c.idComprobante) === id);
    if (!comp) {
      this.form.patchValue({ docRelacionado: '' });
      return;
    }
    this.form.patchValue({ docRelacionado: this.docRelacionadoDesdeComprobante(comp) });
  }

  esTransferenciaSucursal(): boolean {
    return this.form.get('tipoMovimiento')?.value === 'TRANSFERENCIA';
  }

  agregarFila(): void {
    this.filas.push(this.filaVacia());
    this.programarGuardadoBorrador();
  }

  async abrirBuscadorProductos(): Promise<void> {
    const idSucursal = this.form.get('idSucursal')?.value || undefined;
    const seleccionado = await this.buscadorProductosModal.abrir({ idSucursal });
    if (!seleccionado) return;
    this.agregarProductoSeleccionado(seleccionado);
  }

  async abrirCrearProducto(): Promise<void> {
    const creado = await this.productoCrearModal.abrir();
    if (!creado) {
      return;
    }
    this.productoService.limpiarCacheListaProductos();
    const idSuc = creado.idSucursalLote;
    const sucCtrl = this.form.get('idSucursal');
    if (idSuc && (!sucCtrl?.value || sucCtrl.value === '')) {
      this.form.patchValue({ idSucursal: idSuc });
    }
    this.aplicarProductoCreadoAlDetalle(creado);
  }

  /** Ingresos: abre el modal de catálogo (nombre, marca, etc.), no una etiqueta del movimiento. */
  async abrirEditarProducto(fila: FilaDetalle): Promise<void> {
    const id = String(fila?.idProducto || '').trim();
    if (!id || !this.esEntrada()) {
      return;
    }
    try {
      const guardo = await this.productoEditarModal.abrir(id);
      if (!guardo) {
        return;
      }
    } catch {
      return;
    }
    this.productoService.limpiarCacheListaProductos();
    this.refrescarProductoEnFilas(id);
  }

  private refrescarProductoEnFilas(idProducto: string): void {
    this.productoService.obtenerProductoPorId(idProducto).subscribe({
      next: (res) => {
        const data = res?.data;
        const p = data && !Array.isArray(data) ? (data as Producto) : null;
        if (!p) {
          return;
        }
        const codigo = String(p.Codigo ?? p.codigo ?? '').trim();
        const descripcion = String(p.descripcion ?? '').trim();
        for (const f of this.filas) {
          if (String(f.idProducto) === idProducto) {
            if (codigo) {
              f.codigo = codigo;
            }
            if (descripcion) {
              f.descripcion = descripcion;
            }
          }
        }
        this.programarGuardadoBorrador();
      },
      error: () => {}
    });
  }

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
      } else {
        this.precargarCostoUnitarioEntrada(fila);
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
    this.programarGuardadoBorrador();
  }

  agregarProductoSeleccionado(p: ProductoSeleccionado): void {
    let fila = this.filas.find((f) => !f.idProducto);
    if (!fila) {
      this.agregarFila();
      fila = this.filas[this.filas.length - 1];
    }
    fila.idProducto = String(p.idProducto);
    fila.codigo = p.codigo || '';
    const nombreAlt = p['nombre'];
    fila.descripcion = String(
      p.descripcion || (typeof nombreAlt === 'string' ? nombreAlt : '') || ''
    ).trim();
    if (!fila.cantidad || fila.cantidad <= 0) {
      fila.cantidad = 1;
    }
    if (this.esEntrada()) {
      this.precargarCostoUnitarioEntrada(fila, p);
    }
    this.productoService.limpiarCacheListaProductos();
    this.programarGuardadoBorrador();
  }

  /** Precarga costo desde último lote (editable por el usuario). */
  private precargarCostoUnitarioEntrada(fila: FilaDetalle, p?: ProductoSeleccionado): void {
    const idSucursal = String(this.form.get('idSucursal')?.value || '').trim();
    const idProducto = String(fila.idProducto || '').trim();
    if (!idSucursal) {
      const fallback = Number(p?.['cUnitario'] ?? 0);
      if (fallback > 0) {
        fila.costoUnitario = fallback;
      }
      return;
    }
    if (!idProducto) {
      return;
    }
    this.movimientoService.obtenerCostoSugerido(idProducto, idSucursal).subscribe({
      next: (res) => {
        const sugerido = Number(res?.costoUnitario ?? 0);
        if (sugerido > 0) {
          fila.costoUnitario = sugerido;
          this.programarGuardadoBorrador();
          return;
        }
        const catalogo = Number(p?.['cUnitario'] ?? 0);
        if (catalogo > 0) {
          fila.costoUnitario = catalogo;
          this.programarGuardadoBorrador();
        }
      },
      error: () => {
        const catalogo = Number(p?.['cUnitario'] ?? 0);
        if (catalogo > 0) {
          fila.costoUnitario = catalogo;
          this.programarGuardadoBorrador();
        }
      }
    });
  }

  quitarFila(index: number): void {
    this.filas.splice(index, 1);
    this.programarGuardadoBorrador();
  }

  /** Descripción mostrada en el detalle (viene del buscador o del alta de producto). */
  descripcionProductoEnFila(f: FilaDetalle): string {
    const t = (f.descripcion || '').trim();
    if (t) return t;
    return f.idProducto ? 'Producto' : '';
  }

  get subTotal(): number {
    return this.filas.reduce((sum, f) => {
      if (!f.idProducto || f.cantidad <= 0) return sum;
      const costo = this.esEntrada() ? f.costoUnitario || 0 : 0;
      return sum + f.cantidad * costo;
    }, 0);
  }

  etiquetaTipoReciente(c: MovimientoInventarioCabecera): string {
    return etiquetaTipoMovimiento(c.codigoTipoMovimiento, c.tipoMovimiento);
  }

  textoDocumentoReciente(c: MovimientoInventarioCabecera): string {
    const cod = (c.compCodigo || '').trim();
    const doc = (c.docRelacionado || '').trim();
    const partes = [cod, doc].filter(Boolean);
    return partes.length ? partes.join(' ') : '—';
  }

  registrar(): void {
    if (this.form.invalid) {
      iziToast.warning({
        title: 'Datos incompletos',
        message: 'Seleccione tipo de movimiento y sucursal',
        position: 'topRight'
      });
      return;
    }
    const tipo = this.form.get('tipoMovimiento')?.value;
    if (tipo === 'TRANSFERENCIA') {
      const idOrigen = String(this.form.get('idSucursal')?.value || '').trim();
      const idDest = String(this.form.get('idSucursalDestino')?.value || '').trim();
      if (!idDest) {
        iziToast.warning({ title: 'Datos incompletos', message: 'Indique la sucursal de destino', position: 'topRight' });
        return;
      }
      if (idOrigen === idDest) {
        iziToast.warning({ title: 'Validación', message: 'Origen y destino deben ser sucursales distintas', position: 'topRight' });
        return;
      }
      const idComp = String(this.form.get('idComprobante')?.value || '').trim();
      const comp = this.comprobantesInventario.find((c) => String(c.idComprobante) === idComp);
      if (!comp || String(comp.codigo || '').toUpperCase() !== 'TF') {
        iziToast.warning({
          title: 'Comprobante',
          message:
            'La transferencia requiere el comprobante TF (Transferencia). Ejecute el script SQL en empresas existentes si no lo tiene.',
          position: 'topRight'
        });
        return;
      }
    }
    const itemsValidos = this.filas.filter((f) => f.idProducto && f.cantidad > 0);
    if (itemsValidos.length === 0) {
      iziToast.warning({
        title: 'Datos incompletos',
        message: 'Agregue al menos un producto con cantidad mayor a 0',
        position: 'topRight'
      });
      return;
    }
    const items: ItemMovimiento[] = itemsValidos.map((f) => {
      const item: ItemMovimiento = { idProducto: f.idProducto, cantidad: Number(f.cantidad) };
      if (this.esEntrada()) {
        if (f.costoUnitario != null && f.costoUnitario > 0) item.costoUnitario = Number(f.costoUnitario);
        if (f.fechaVencimiento) item.fechaVencimiento = f.fechaVencimiento;
        if (f.numeroLote) item.numeroLote = f.numeroLote;
      } else if (f.idLote) {
        item.idLote = String(f.idLote);
      }
      return item;
    });
    const body: MovimientoRequest = {
      tipoMovimiento: this.form.get('tipoMovimiento')?.value,
      idSucursal: this.form.get('idSucursal')?.value,
      fechaMovimiento: fechaEmisionVentaParaApi(this.form.get('fechaMovimiento')?.value) || undefined,
      idComprobante: this.form.get('idComprobante')?.value || undefined,
      docRelacionado: this.form.get('docRelacionado')?.value || undefined,
      observaciones: this.form.get('observaciones')?.value || undefined,
      items
    };
    if (tipo === 'TRANSFERENCIA') {
      body.idSucursalDestino = this.form.get('idSucursalDestino')?.value || undefined;
    }
    this.guardando = true;
    this.movimientoService.registrarMovimiento(body).subscribe({
      next: (resp) => {
        this.guardando = false;
        this.borradorService.limpiar(this.modoBorrador);
        this.tieneBorradorLocal = false;
        this.fechaBorradorLocal = '';
        iziToast.success({ title: 'Éxito', message: resp.message || 'Movimiento registrado', position: 'topRight' });
        this.router.navigate(['/inventario']);
      },
      error: (err: { error?: { message?: string } }) => {
        this.guardando = false;
        const msg = err?.error?.message || 'Error al registrar movimiento';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }
}
