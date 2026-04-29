import { Component, ElementRef, OnDestroy, OnInit, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { MovimientoInventarioService } from '../../../services/movimiento-inventario.service';
import { SucursalService } from '../../../services/sucursal.service';
import { ConteoFisicoService } from '../../../services/conteo-fisico.service';
import { ExcelService, ExcelData } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { StockActualItem } from '../../../models/stock-actual.model';
import { Sucursal } from '../../../interfaces/sucursal-interface';
import {
  ConteoFisicoPreviewFila,
  InventarioFisicoLineaDto,
  InventarioFisicoSesionDto,
  TipoConteoFisico
} from '../../../models/conteo-fisico.model';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void };

@Component({
  selector: 'app-conteo-fisico',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './conteo-fisico.component.html',
  styleUrl: './conteo-fisico.component.css'
})
export class ConteoFisicoComponent implements OnInit, OnDestroy {
  /** Card «Detalle del conteo» para hacer scroll al pulsar Elegir */
  private readonly detalleConteoRef = viewChild<ElementRef<HTMLElement>>('detalleConteoCard');

  sidebarState = inject(SidebarStateService);
  private inventarioApi = inject(MovimientoInventarioService);
  private sucursalService = inject(SucursalService);
  private conteoService = inject(ConteoFisicoService);
  private excelService = inject(ExcelService);
  private pdfService = inject(PdfService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private destroy$ = new Subject<void>();
  private buscarSubject = new Subject<string>();

  sucursales: Sucursal[] = [];
  idSucursalNuevaSesion = '';
  tipoConteoNueva: TipoConteoFisico = 'MENSUAL';
  observacionesNueva = '';

  sesion: InventarioFisicoSesionDto | null = null;
  lineas: InventarioFisicoLineaDto[] = [];
  idSesionEnCurso: string | null = null;

  buscar = '';
  resultados: StockActualItem[] = [];
  cargandoBusqueda = false;
  productoSeleccionado: StockActualItem | null = null;
  stockRealInput: number | null = null;
  verificadoInput = false;
  notasInput = '';

  previewFilas: ConteoFisicoPreviewFila[] = [];
  previewCargado = false;
  cargandoPreview = false;
  aplicando = false;

  tiposConteo: { id: TipoConteoFisico; label: string }[] = [
    { id: 'INICIAL', label: 'Inventario inicial' },
    { id: 'MENSUAL', label: 'Inventario mensual' }
  ];

  ngOnInit(): void {
    this.buscarSubject.pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => {
      this.buscarCatalogo();
    });
    this.cargarSucursales();
    const inicial = this.route.snapshot.queryParamMap.get('idSesion');
    if (inicial) {
      this.idSesionEnCurso = inicial;
      this.cargarSesion(inicial);
    }
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((qp) => {
      const id = qp.get('idSesion');
      if (id && id !== this.idSesionEnCurso) {
        this.idSesionEnCurso = id;
        this.cargarSesion(id);
      } else if (!id) {
        this.idSesionEnCurso = null;
        this.sesion = null;
        this.lineas = [];
        this.limpiarSeleccionProducto();
        this.previewCargado = false;
        this.previewFilas = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private cargarSucursales(): void {
    this.sucursalService.obtener_sucursal_idempresa1().subscribe({
      next: (res) => {
        const d = res?.data;
        this.sucursales = Array.isArray(d) ? d : [];
      },
      error: () => {
        this.sucursales = [];
      }
    });
  }

  onBuscarInput(): void {
    this.buscarSubject.next(this.buscar);
  }

  crearSesion(): void {
    if (!this.idSucursalNuevaSesion?.trim()) {
      iziToast.error({ title: 'Validación', message: 'Seleccione sucursal', position: 'topRight' });
      return;
    }
    this.conteoService
      .crearSesion({
        idSucursal: this.idSucursalNuevaSesion.trim(),
        tipoConteo: this.tipoConteoNueva,
        observaciones: this.observacionesNueva?.trim() || null
      })
      .subscribe({
        next: (r) => {
          iziToast.success({ title: 'Sesión', message: r.message || 'Creada', position: 'topRight' });
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { idSesion: r.idSesion },
            replaceUrl: true
          });
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudo crear la sesión';
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
        }
      });
  }

  cargarSesion(idSesion: string): void {
    this.conteoService.obtenerSesion(idSesion).subscribe({
      next: (data) => {
        this.sesion = data.sesion;
        this.lineas = data.lineas || [];
        this.previewCargado = false;
        this.previewFilas = [];
        if (this.sesion?.estado === 'BORRADOR') {
          this.buscarCatalogo();
        }
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo cargar la sesión';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
    });
  }

  nuevaSesionDesdeCabecera(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  esBorrador(): boolean {
    return this.sesion?.estado === 'BORRADOR';
  }

  buscarCatalogo(): void {
    if (!this.sesion?.idSucursal || !this.esBorrador()) {
      this.resultados = [];
      return;
    }
    this.cargandoBusqueda = true;
    this.inventarioApi
      .obtenerStockActual({
        idSucursal: this.sesion.idSucursal,
        buscar: this.buscar?.trim() || null,
        filtroStock: 'todos'
      })
      .subscribe({
        next: (res) => {
          this.resultados = res.items || [];
          this.cargandoBusqueda = false;
        },
        error: (err) => {
          this.cargandoBusqueda = false;
          const msg = err?.error?.message || 'Error al buscar';
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
          this.resultados = [];
        }
      });
  }

  elegirProducto(p: StockActualItem): void {
    this.productoSeleccionado = p;
    const existente = this.lineas.find((l) => this.mismoUuid(l.idProducto, p.idProducto));
    if (existente) {
      this.stockRealInput = existente.stockReal != null ? Number(existente.stockReal) : null;
      this.notasInput = existente.notas || '';
    } else {
      this.stockRealInput = Number(p.stock) || 0;
      this.notasInput = '';
    }
    this.verificadoInput = true;
    setTimeout(() => {
      const el = this.detalleConteoRef()?.nativeElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  /** Stock real ya guardado en la sesión para este producto (tabla búsqueda), o null si no hay línea / valor. */
  stockRealLineaEnBusqueda(p: StockActualItem): number | null {
    const l = this.lineas.find((x) => this.mismoUuid(x.idProducto, p.idProducto));
    if (!l || l.stockReal === null || l.stockReal === undefined) {
      return null;
    }
    const n = Number(l.stockReal);
    return Number.isNaN(n) ? null : n;
  }

  limpiarSeleccionProducto(): void {
    this.productoSeleccionado = null;
    this.stockRealInput = null;
    this.verificadoInput = false;
    this.notasInput = '';
  }

  guardarLinea(): void {
    if (!this.idSesionEnCurso || !this.productoSeleccionado) {
      return;
    }
    this.conteoService
      .upsertLinea(this.idSesionEnCurso, this.productoSeleccionado.idProducto, {
        stockReal: this.stockRealInput,
        verificado: this.verificadoInput,
        notas: this.notasInput?.trim() || null
      })
      .subscribe({
        next: (r) => {
          this.lineas = r.lineas || [];
          iziToast.success({ title: 'Línea', message: 'Guardada', position: 'topRight' });
          this.previewCargado = false;
          this.buscarCatalogo();
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudo guardar';
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
        }
      });
  }

  cargarPrevisualizacion(): void {
    if (!this.idSesionEnCurso) {
      return;
    }
    this.cargandoPreview = true;
    this.conteoService.previsualizar(this.idSesionEnCurso).subscribe({
      next: (data) => {
        this.previewFilas = data.preview || [];
        this.previewCargado = true;
        this.cargandoPreview = false;
      },
      error: (err) => {
        this.cargandoPreview = false;
        const msg = err?.error?.message || 'Error al previsualizar';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  /** Fecha/hora del equipo del usuario (sin Z); el backend la persiste tal cual en SQL. */
  private fechaHoraLocalParaMovimiento(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  aplicarMovimientos(): void {
    if (!this.idSesionEnCurso) {
      return;
    }
    if (!this.previewCargado) {
      iziToast.error({
        title: 'Paso previo',
        message: 'Pulse primero «Previsualizar ajustes» y revise el delta frente al stock actual.',
        position: 'topRight'
      });
      return;
    }
    const ok = window.confirm(
      'Se registrarán los movimientos de reajuste según el resumen y la sesión pasará a CERRADO. ¿Continuar?'
    );
    if (!ok) {
      return;
    }
    this.aplicando = true;
    this.conteoService
      .aplicarMovimientos(this.idSesionEnCurso, { fechaMovimiento: this.fechaHoraLocalParaMovimiento() })
      .subscribe({
      next: (r) => {
        this.aplicando = false;
        iziToast.success({ title: 'Listo', message: r.message || 'Aplicado', position: 'topRight' });
        this.cargarSesion(this.idSesionEnCurso!);
      },
      error: (err) => {
        this.aplicando = false;
        const msg = err?.error?.message || 'Error al aplicar';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  exportarExcel(): void {
    if (!this.idSesionEnCurso) {
      return;
    }
    this.conteoService.obtenerDatosExport(this.idSesionEnCurso).subscribe({
      next: (data) => {
        const cols = ['#', 'Código', 'Producto', 'Marca', 'Stock ref. al guardar', 'Stock real', 'Verificado', 'Notas'];
        const rows = (data.lineas || []).map((l, i) => [
          i + 1,
          l.productoCodigo,
          l.productoDescripcion,
          l.marca,
          Number(l.stockSistema) || 0,
          l.stockReal != null ? Number(l.stockReal) : '',
          l.verificado ? 'Sí' : 'No',
          l.notas || ''
        ]);
        const excelData: ExcelData = {
          title: `Conteo físico ${data.sesion?.nombreSucursal || ''} (${data.sesion?.tipoConteo || ''})`,
          filename: `conteo_fisico_${this.idSesionEnCurso}`,
          worksheetName: 'Líneas',
          columns: cols,
          rows
        };
        this.excelService.generarExcel(excelData).subscribe({
          next: (blob) => {
            this.excelService.descargar(blob, excelData.filename + '.xlsx');
            iziToast.success({ title: 'Excel', message: 'Exportado', position: 'topRight' });
          },
          error: () => {
            iziToast.error({ title: 'Error', message: 'No se pudo generar Excel', position: 'topRight' });
          }
        });
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo obtener datos';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  exportarPdf(): void {
    if (!this.idSesionEnCurso) {
      return;
    }
    this.conteoService.obtenerDatosExport(this.idSesionEnCurso).subscribe({
      next: (data) => {
        const columnas = ['#', 'Código', 'Producto', 'Stock ref.', 'Stock real', 'Verif.'];
        const filas = (data.lineas || []).map((l, i) => [
          i + 1,
          l.productoCodigo,
          l.productoDescripcion,
          Number(l.stockSistema) || 0,
          l.stockReal != null ? Number(l.stockReal) : '',
          l.verificado ? 'Sí' : 'No'
        ]);
        const titulo = `Conteo físico — ${data.sesion?.nombreSucursal || ''} (${data.sesion?.tipoConteo || ''})`;
        this.pdfService.generarPdfDinamico({ titulo, columnas, filas }, 'lista-compras', 6).subscribe({
          next: (blob) => {
            this.pdfService.descargar(blob, `conteo_fisico_${Date.now()}.pdf`);
            iziToast.success({ title: 'PDF', message: 'Generado', position: 'topRight' });
          },
          error: () => {
            iziToast.error({ title: 'Error', message: 'No se pudo generar PDF', position: 'topRight' });
          }
        });
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo obtener datos';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  trackProducto(_i: number, p: StockActualItem): string {
    return p.idProducto;
  }

  trackLinea(_i: number, l: InventarioFisicoLineaDto): string {
    return l.idLinea;
  }

  trackPreview(_i: number, r: ConteoFisicoPreviewFila): string {
    return r.idLinea;
  }

  private mismoUuid(a: string, b: string): boolean {
    return String(a || '').toLowerCase() === String(b || '').toLowerCase();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
