import { Component, OnDestroy, OnInit, TemplateRef, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { MovimientoInventarioService } from '../../../services/movimiento-inventario.service';
import { SucursalService } from '../../../services/sucursal.service';
import { CategoriaService } from '../../../services/categoria.service';
import { MarcaService } from '../../../services/marca.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { ConteoFisicoService, CrearSesionConteoBody, UpsertLineaConteoBody } from '../../../services/conteo-fisico.service';
import { ProductoCrearModalService } from '../../../services/producto-crear-modal.service';
import { GestoresService } from '../../../services/gestores.service';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { CreateCategoriaComponent } from '../../categorias/create-categoria/create-categoria.component';
import { CreateMarcaComponent } from '../../marcas/create-marca/create-marca.component';
import { ExcelService, ExcelData } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { StockActualItem } from '../../../models/stock-actual.model';
import { fechaHoraVentaClienteAhora } from '../../../utils/fecha-local.util';
import { Sucursal } from '../../../interfaces/sucursal-interface';
import {
  ConteoFisicoPreviewFila,
  InventarioFisicoLineaDto,
  InventarioFisicoSesionDto,
  InventarioFisicoSesionResumenDto,
  TipoConteoFisico
} from '../../../models/conteo-fisico.model';
import { InventarioModalService } from '../../../services/inventario-modal.service';
import { interpretarBooleanoConfig } from '../../../utils/config-valor-booleano.util';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void };

@Component({
  selector: 'app-conteo-fisico',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './conteo-fisico.component.html',
  styleUrl: './conteo-fisico.component.css'
})
export class ConteoFisicoComponent implements OnInit, OnDestroy {
  private readonly detalleModalTpl = viewChild<TemplateRef<unknown>>('detalleConteoModal');

  sidebarState = inject(SidebarStateService);
  private inventarioApi = inject(MovimientoInventarioService);
  private sucursalService = inject(SucursalService);
  private categoriaService = inject(CategoriaService);
  private marcaService = inject(MarcaService);
  private presentacionService = inject(PresentacionService);
  private conteoService = inject(ConteoFisicoService);
  private inventarioModal = inject(InventarioModalService);
  private modalService = inject(NgbModal);
  private productoCrearModal = inject(ProductoCrearModalService);
  private gestoresService = inject(GestoresService);
  private ubicacionPrioridadService = inject(UbicacionPrioridadService);
  private excelService = inject(ExcelService);
  private pdfService = inject(PdfService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private destroy$ = new Subject<void>();
  private detalleModalRef: NgbModalRef | null = null;
  private idEmpresaCatalogoActual: string | null = null;

  sucursales: Sucursal[] = [];
  idSucursalNuevaSesion = '';
  tipoConteoNueva: TipoConteoFisico = 'MENSUAL';
  observacionesNueva = '';
  /** Selector de ubicación: visible si INVENTARIO_CONTROL_UBICACIONES está activo. */
  mostrarOpcionUbicacionConteo = false;
  ubicacionesSucursal: Array<{ idUbicacion: number; codigoUbicacion: string }> = [];
  idUbicacionNuevaSesion: number | null = null;
  codigoUbicacionNuevaSesion: string | null = null;
  /** Empresa de referencia para listar códigos de ubicación al crear sesión (gestora). */
  empresaUbicacionNuevaSesion = '';
  codigosUbicacionGestora: string[] = [];

  sesion: InventarioFisicoSesionDto | null = null;
  lineas: InventarioFisicoLineaDto[] = [];
  idSesionEnCurso: string | null = null;

  buscar = '';
  resultados: StockActualItem[] = [];
  cargandoBusqueda = false;
  productoSeleccionado: StockActualItem | null = null;
  stockRealInput: number | null = null;
  verificadoInput = true;
  notasInput = '';
  empresasGestionadas: Array<{ idEmpresa: string; nombre: string }> = [];
  empresaFiltroSeleccionada = 'todas';

  /** Catálogos para editar maestro del producto en el panel lateral */
  categoriasSelect: Array<{ idCategoria: number; nombre: string }> = [];
  marcasSelect: Array<{ idMarca: number; nombre: string }> = [];
  presentacionesSelect: Array<{ idPresentacion: number; label: string }> = [];
  descripcionEdit = '';
  idCategoriaEdit: number | null = null;
  idMarcaEdit: number | null = null;
  idPresentacionEdit: number | null = null;
  private snapshotMaestro: { descripcion: string; idCategoria: number; idMarca: number; idPresentacion: number } | null =
    null;

  previewFilas: ConteoFisicoPreviewFila[] = [];
  previewCargado = false;
  cargandoPreview = false;
  aplicando = false;

  /** Borradores con líneas guardadas (movimientos aún no aplicados). */
  sesionesPendientes: InventarioFisicoSesionResumenDto[] = [];
  cargandoSesionesPendientes = false;

  tiposConteo: { id: TipoConteoFisico; label: string }[] = [
    { id: 'INICIAL', label: 'Inventario inicial' },
    { id: 'MENSUAL', label: 'Inventario mensual' }
  ];

  ngOnInit(): void {
    this.cargarSucursales();
    this.cargarOpcionUbicacionConteo();
    this.cargarEmpresasGestionadas();
    this.cargarSesionesPendientes();
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
        this.cargarSesionesPendientes();
      }
    });
  }

  cargarSesionesPendientes(): void {
    this.cargandoSesionesPendientes = true;
    this.conteoService.listarSesionesPendientes(true).subscribe({
      next: (res) => {
        const lista = Array.isArray(res?.sesiones) ? res.sesiones : [];
        const actual = this.idSesionEnCurso?.trim().toLowerCase();
        this.sesionesPendientes = actual
          ? lista.filter((s) => String(s.idSesion).toLowerCase() !== actual)
          : lista;
        this.cargandoSesionesPendientes = false;
      },
      error: () => {
        this.sesionesPendientes = [];
        this.cargandoSesionesPendientes = false;
      }
    });
  }

  continuarSesionPendiente(idSesion: string): void {
    if (!idSesion?.trim()) {
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { idSesion: idSesion.trim() },
      replaceUrl: true
    });
  }

  etiquetaTipoConteo(tipo: string): string {
    const t = String(tipo || '').toUpperCase();
    return this.tiposConteo.find((x) => x.id === t)?.label || t;
  }

  etiquetaUbicacionResumen(s: InventarioFisicoSesionResumenDto): string | null {
    const cod = String(s.codigoUbicacionInventario ?? '').trim();
    if (cod) {
      return cod;
    }
    const u = s.idUbicacionInventario;
    if (u != null && Number(u) > 0) {
      return `#${u}`;
    }
    return null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get esModoGestora(): boolean {
    return this.empresasGestionadas.length > 0;
  }

  private cargarCatalogosMaestro(idEmpresaProducto?: string | null): void {
    const idEmpresa = idEmpresaProducto?.trim() || this.productoSeleccionado?.idEmpresa?.trim() || null;
    if (!idEmpresa) {
      return;
    }
    const empresaCambio = this.idEmpresaCatalogoActual !== idEmpresa;
    this.idEmpresaCatalogoActual = idEmpresa;
    if (!empresaCambio && this.categoriasSelect.length > 0 && this.marcasSelect.length > 0) {
      return;
    }
    this.categoriasSelect = [];
    this.marcasSelect = [];
    this.categoriaService.obtener_categorias_idEmpresa(idEmpresa).subscribe({
      next: (res) => {
        const raw = res?.data ?? res;
        const arr = Array.isArray(raw) ? raw : [];
        this.categoriasSelect = arr
          .filter((c: { estado?: boolean | number }) => c.estado !== false && c.estado !== 0)
          .map((c: { idCategoria?: number; nombre?: string }) => ({
            idCategoria: Number(c.idCategoria),
            nombre: String(c.nombre || '').trim()
          }))
          .filter((c) => Number.isFinite(c.idCategoria) && c.idCategoria > 0 && c.nombre);
      },
      error: () => {
        this.categoriasSelect = [];
      }
    });
    this.presentacionService.obtener_presentaciones().subscribe({
      next: (res) => {
        const raw = res?.data ?? res;
        const arr = Array.isArray(raw) ? raw : [];
        this.presentacionesSelect = arr
          .map((p: { idPresentacion?: number; codigo?: string; descripcion?: string; Descripcion?: string }) => {
            const id = Number(p.idPresentacion);
            const cod = String(p.codigo || '').trim();
            const desc = String(p.descripcion ?? p.Descripcion ?? '').trim();
            /* Mostrar primero la descripción legible (SUNAT); código solo si no hay texto. */
            const label = desc || cod || String(id);
            return { idPresentacion: id, label };
          })
          .filter((p) => Number.isFinite(p.idPresentacion) && p.idPresentacion > 0);
      },
      error: () => {
        this.presentacionesSelect = [];
      }
    });
    this.marcaService.obtener_marcas_idEmpresa(idEmpresa).subscribe({
      next: (res) => {
        const raw = res?.data ?? res;
        const arr = Array.isArray(raw) ? raw : [];
        this.marcasSelect = arr
          .filter((m: { estado?: boolean | number }) => m.estado !== false && m.estado !== 0)
          .map((m: { idMarca?: number; nombre?: string }) => ({
            idMarca: Number(m.idMarca),
            nombre: String(m.nombre || '').trim()
          }))
          .filter((m) => Number.isFinite(m.idMarca) && m.idMarca > 0 && m.nombre);
      },
      error: () => {
        this.marcasSelect = [];
      }
    });
  }

  /** Empresa dueña del producto en conteo (gestora: no usar token = empresa gestora). */
  private idEmpresaDelProductoSeleccionado(): string | null {
    const id =
      this.productoSeleccionado?.idEmpresa?.trim() ||
      this.idEmpresaCatalogoActual?.trim() ||
      null;
    return id || null;
  }

  abrirModalCrearMarca(): void {
    const idEmpresa = this.idEmpresaDelProductoSeleccionado();
    if (!idEmpresa) {
      iziToast.error({
        title: 'Aviso',
        message: 'No se identificó la empresa del producto. Cierre y vuelva a abrir el detalle.',
        position: 'topRight'
      });
      return;
    }
    const ref = this.modalService.open(CreateMarcaComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    });
    ref.componentInstance.idEmpresaDestino = idEmpresa;
    ref.result
      .then((res: unknown) => {
        const id = this.parseIdMarcaCreada(res);
        if (id != null) {
          this.recargarSoloMarcasYSeleccionar(id);
        } else {
          this.cargarCatalogosMaestro(idEmpresa);
        }
      })
      .catch(() => this.cargarCatalogosMaestro(idEmpresa));
  }

  abrirModalCrearCategoria(): void {
    const idEmpresa = this.idEmpresaDelProductoSeleccionado();
    if (!idEmpresa) {
      iziToast.error({
        title: 'Aviso',
        message: 'No se identificó la empresa del producto. Cierre y vuelva a abrir el detalle.',
        position: 'topRight'
      });
      return;
    }
    const ref = this.modalService.open(CreateCategoriaComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    });
    ref.componentInstance.idEmpresaDestino = idEmpresa;
    ref.result
      .then((res: unknown) => {
        const id = this.parseIdCategoriaCreada(res);
        if (id != null) {
          this.recargarSoloCategoriasYSeleccionar(id);
        } else {
          this.cargarCatalogosMaestro(idEmpresa);
        }
      })
      .catch(() => this.cargarCatalogosMaestro(idEmpresa));
  }

  private parseIdMarcaCreada(res: unknown): number | null {
    if (res && typeof res === 'object' && 'idMarca' in res) {
      const n = Number((res as { idMarca?: unknown }).idMarca);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  private parseIdCategoriaCreada(res: unknown): number | null {
    if (res && typeof res === 'object' && 'idCategoria' in res) {
      const n = Number((res as { idCategoria?: unknown }).idCategoria);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  private recargarSoloMarcasYSeleccionar(idMarca: number): void {
    const idEmpresa = this.productoSeleccionado?.idEmpresa || this.idEmpresaCatalogoActual;
    if (!idEmpresa) {
      return;
    }
    this.marcaService.obtener_marcas_idEmpresa(idEmpresa).subscribe({
      next: (res) => {
        const raw = res?.data ?? res;
        const arr = Array.isArray(raw) ? raw : [];
        this.marcasSelect = arr
          .filter((m: { estado?: boolean | number }) => m.estado !== false && m.estado !== 0)
          .map((m: { idMarca?: number; nombre?: string }) => ({
            idMarca: Number(m.idMarca),
            nombre: String(m.nombre || '').trim()
          }))
          .filter((m) => Number.isFinite(m.idMarca) && m.idMarca > 0 && m.nombre);
        this.idMarcaEdit = idMarca;
      },
      error: () => this.cargarCatalogosMaestro()
    });
  }

  private recargarSoloCategoriasYSeleccionar(idCategoria: number): void {
    const idEmpresa = this.productoSeleccionado?.idEmpresa || this.idEmpresaCatalogoActual;
    if (!idEmpresa) {
      return;
    }
    this.categoriaService.obtener_categorias_idEmpresa(idEmpresa).subscribe({
      next: (res) => {
        const raw = res?.data ?? res;
        const arr = Array.isArray(raw) ? raw : [];
        this.categoriasSelect = arr
          .filter((c: { estado?: boolean | number }) => c.estado !== false && c.estado !== 0)
          .map((c: { idCategoria?: number; nombre?: string }) => ({
            idCategoria: Number(c.idCategoria),
            nombre: String(c.nombre || '').trim()
          }))
          .filter((c) => Number.isFinite(c.idCategoria) && c.idCategoria > 0 && c.nombre);
        this.idCategoriaEdit = idCategoria;
      },
      error: () => this.cargarCatalogosMaestro()
    });
  }

  abrirModalCrearProducto(): void {
    void this.productoCrearModal.abrir().then((creado) => {
      if (creado) {
        iziToast.success({ title: 'Producto', message: 'Producto creado. Actualice la búsqueda si no aparece.', position: 'topRight' });
        this.buscarCatalogo();
      }
    });
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

  /** Muestra selector de ubicación si el inventario usa stock por ubicación (INVENTARIO_CONTROL_UBICACIONES). */
  private cargarOpcionUbicacionConteo(): void {
    this.gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const lista = Array.isArray(res?.data) ? res.data : [];
        const norm = (c: { clave?: string; Clave?: string }) =>
          String(c?.clave ?? c?.Clave ?? '')
            .trim()
            .toUpperCase();
        const row = lista.find((c) => norm(c) === 'INVENTARIO_CONTROL_UBICACIONES');
        const v =
          row && (row as { valor?: string; Valor?: string }).valor !== undefined
            ? (row as { valor?: string; Valor?: string }).valor
            : (row as { valor?: string; Valor?: string })?.Valor;
        this.mostrarOpcionUbicacionConteo = interpretarBooleanoConfig(v, true);
        if (this.mostrarOpcionUbicacionConteo) {
          this.intentarCargarCodigosUbicacionSesion();
          if (this.idSucursalNuevaSesion && !this.esModoGestora) {
            this.onCambioSucursalNuevaSesion();
          }
        }
      },
      error: () => {
        this.mostrarOpcionUbicacionConteo = false;
      }
    });
  }

  private cargarEmpresasGestionadas(): void {
    this.gestoresService.obtenerEmpresasGestionadas().subscribe({
      next: (res) => {
        const arr = Array.isArray(res?.data) ? res.data : [];
        const dedupe = new Map<string, { idEmpresa: string; nombre: string }>();
        arr.forEach((e) => {
          const id = String(e?.idEmpresa || '').trim();
          if (!id) return;
          const nombre = String(e?.nombreComercial || e?.razon_Social || e?.ruc || '').trim() || 'Empresa';
          const key = `${id.toLowerCase()}|${nombre.toLowerCase()}`;
          if (!dedupe.has(key)) {
            dedupe.set(key, { idEmpresa: id, nombre });
          }
        });
        this.empresasGestionadas = Array.from(dedupe.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        if (this.esModoGestora && !this.empresaUbicacionNuevaSesion && this.empresasGestionadas.length === 1) {
          this.empresaUbicacionNuevaSesion = this.empresasGestionadas[0].idEmpresa;
        }
        this.intentarCargarCodigosUbicacionSesion();
      },
      error: () => {
        this.empresasGestionadas = [];
        this.codigosUbicacionGestora = [];
      }
    });
  }

  /** Requiere modo gestora y opción de ubicación activa (evita carrera al iniciar). */
  private intentarCargarCodigosUbicacionSesion(): void {
    if (!this.mostrarOpcionUbicacionConteo || !this.esModoGestora) {
      if (!this.esModoGestora) {
        this.codigosUbicacionGestora = [];
      }
      return;
    }
    this.cargarCodigosUbicacionSesion();
  }

  onEmpresaUbicacionNuevaSesionChange(): void {
    this.codigoUbicacionNuevaSesion = null;
    this.intentarCargarCodigosUbicacionSesion();
  }

  private cargarCodigosUbicacionSesion(): void {
    const idEmpresaRef = this.empresaUbicacionNuevaSesion?.trim() || null;
    this.ubicacionPrioridadService
      .obtener_codigos_ubicacion_consolidados({
        idEmpresa: idEmpresaRef,
        modo: idEmpresaRef ? undefined : 'interseccion'
      })
      .subscribe({
      next: (res) => {
        const raw = res?.data ?? res;
        const arr = Array.isArray(raw) ? raw : [];
        this.codigosUbicacionGestora = arr
          .map((c) => String(c || '').trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
      },
      error: () => {
        this.codigosUbicacionGestora = [];
      }
    });
  }

  onCambioSucursalNuevaSesion(): void {
    this.idUbicacionNuevaSesion = null;
    this.codigoUbicacionNuevaSesion = null;
    this.ubicacionesSucursal = [];
    if (!this.mostrarOpcionUbicacionConteo || !this.idSucursalNuevaSesion?.trim() || this.esModoGestora) {
      return;
    }
    this.ubicacionPrioridadService.obtener_ubicacionesPrioridad_sucursal(this.idSucursalNuevaSesion.trim()).subscribe({
      next: (res) => {
        const raw = res?.data ?? res;
        const arr = Array.isArray(raw) ? raw : [];
        this.ubicacionesSucursal = arr
          .map((u: { idUbicacion?: number; codigoUbicacion?: string }) => ({
            idUbicacion: Number(u.idUbicacion),
            codigoUbicacion: String(u.codigoUbicacion ?? '').trim()
          }))
          .filter((u) => Number.isFinite(u.idUbicacion) && u.idUbicacion > 0);
      },
      error: () => {
        this.ubicacionesSucursal = [];
      }
    });
  }

  crearSesion(): void {
    if (!this.idSucursalNuevaSesion?.trim()) {
      iziToast.error({ title: 'Validación', message: 'Seleccione sucursal', position: 'topRight' });
      return;
    }
    const body: CrearSesionConteoBody = {
      idSucursal: this.idSucursalNuevaSesion.trim(),
      tipoConteo: this.tipoConteoNueva,
      observaciones: this.observacionesNueva?.trim() || null
    };
    if (this.mostrarOpcionUbicacionConteo) {
      if (this.esModoGestora && this.codigoUbicacionNuevaSesion?.trim()) {
        body.codigoUbicacionInventario = this.codigoUbicacionNuevaSesion.trim();
      } else if (!this.esModoGestora && this.idUbicacionNuevaSesion != null) {
        body.idUbicacionInventario = this.idUbicacionNuevaSesion;
      }
    }
    this.conteoService.crearSesion(body).subscribe({
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
          this.resultados = [];
        } else {
          this.categoriasSelect = [];
          this.marcasSelect = [];
          this.presentacionesSelect = [];
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
    this.cargarSesionesPendientes();
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
    const params: {
      idSucursal?: string;
      buscar: string | null;
      filtroStock: 'todos' | 'cero' | 'minimo';
      catalogoConteoFisico: boolean;
      idUbicacionConteo?: number;
      codigoUbicacionConteo?: string;
      idEmpresa?: string;
    } = {
      buscar: this.buscar?.trim() || null,
      filtroStock: 'todos',
      catalogoConteoFisico: true
    };
    if (!this.esModoGestora) {
      params.idSucursal = this.sesion.idSucursal;
    }
    if (this.sesionInventarioPorUbicacion()) {
      const codUb = String(this.sesion?.codigoUbicacionInventario ?? '').trim();
      if (codUb) {
        params.codigoUbicacionConteo = codUb;
        if (!this.esModoGestora) {
          params.idSucursal = this.sesion.idSucursal;
        }
      } else if (this.sesion?.idUbicacionInventario != null) {
        params.idUbicacionConteo = Number(this.sesion.idUbicacionInventario);
        if (!this.esModoGestora) {
          params.idSucursal = this.sesion.idSucursal;
        }
      }
    }
    const idEmpresaFiltro = this.obtenerIdEmpresaFiltro();
    if (idEmpresaFiltro) {
      params.idEmpresa = idEmpresaFiltro;
    }
    this.inventarioApi.obtenerStockActual(params)
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

  /** Sesión creada con ubicación: referencias y movimientos son por esa ubicación. */
  sesionInventarioPorUbicacion(): boolean {
    const cod = String(this.sesion?.codigoUbicacionInventario ?? '').trim();
    if (cod) {
      return true;
    }
    const u = this.sesion?.idUbicacionInventario;
    const n = u != null ? Number(u) : NaN;
    return Number.isFinite(n) && n > 0;
  }

  onEmpresaFiltroChange(): void {
    this.resultados = [];
  }

  private obtenerIdEmpresaFiltro(): string | null {
    if (!this.empresasGestionadas.length) {
      return null;
    }
    if (!this.empresaFiltroSeleccionada || this.empresaFiltroSeleccionada === 'todas') {
      return null;
    }
    return this.empresaFiltroSeleccionada;
  }

  get descripcionEmpresaFiltro(): string {
    if (!this.empresasGestionadas.length) {
      return 'Empresa actual';
    }
    if (!this.empresaFiltroSeleccionada || this.empresaFiltroSeleccionada === 'todas') {
      return 'Consolidado (gestora + empresas gestionadas)';
    }
    const match = this.empresasGestionadas.find((e) => e.idEmpresa === this.empresaFiltroSeleccionada);
    return match?.nombre || 'Empresa seleccionada';
  }

  etiquetaUbicacionSesion(): string {
    if (!this.sesionInventarioPorUbicacion() || !this.sesion) {
      return '';
    }
    const c = String(this.sesion.codigoUbicacionInventario ?? '').trim();
    return c || `#${this.sesion.idUbicacionInventario}`;
  }

  stockUbicacionConteoProducto(p: StockActualItem): number {
    const n = p.stockUbicacionConteo != null ? Number(p.stockUbicacionConteo) : NaN;
    return Number.isFinite(n) ? n : 0;
  }

  columnasTablaBusqueda(): number {
    let n = 6;
    if (this.empresasGestionadas.length > 0) {
      n += 1;
    }
    if (this.sesionInventarioPorUbicacion()) {
      n += 1;
    }
    return n;
  }

  /** En catálogo de conteo (incluye inactivos) el API envía estado 0. */
  productoCatalogoInactivo(p: StockActualItem): boolean {
    if (p.estado == null) {
      return false;
    }
    return Number(p.estado) === 0;
  }

  elegirProducto(p: StockActualItem): void {
    this.productoSeleccionado = { ...p };
    const existente = this.lineas.find((l) => this.mismoUuid(l.idProducto, p.idProducto));
    if (existente) {
      this.stockRealInput = existente.stockReal != null ? Number(existente.stockReal) : null;
      this.notasInput = existente.notas || '';
    } else {
      this.stockRealInput = this.sesionInventarioPorUbicacion()
        ? this.stockUbicacionConteoProducto(p)
        : Number(p.stock) || 0;
      this.notasInput = '';
    }
    if (existente && this.sesionInventarioPorUbicacion()) {
      this.productoSeleccionado = {
        ...p,
        stock: Number(existente.stockSistema) || 0,
        stockUbicacionConteo: Number(existente.stockSistema) || 0
      };
    }
    this.descripcionEdit = String(p.descripcion || '');
    const idCat = p.idCategoria != null && p.idCategoria !== undefined ? Number(p.idCategoria) : NaN;
    const idPres = p.idPresentacion != null && p.idPresentacion !== undefined ? Number(p.idPresentacion) : NaN;
    const idMar = p.idMarca != null && p.idMarca !== undefined ? Number(p.idMarca) : NaN;
    this.idCategoriaEdit = Number.isFinite(idCat) && idCat > 0 ? idCat : null;
    this.idPresentacionEdit = Number.isFinite(idPres) && idPres > 0 ? idPres : null;
    this.idMarcaEdit = Number.isFinite(idMar) && idMar > 0 ? idMar : null;
    this.snapshotMaestro = {
      descripcion: this.descripcionEdit.trim(),
      idCategoria: this.idCategoriaEdit ?? 0,
      idMarca: this.idMarcaEdit ?? 0,
      idPresentacion: this.idPresentacionEdit ?? 0
    };
    this.verificadoInput = existente ? !!existente.verificado : true;
    this.cargarCatalogosMaestro(p.idEmpresa);
    const tpl = this.detalleModalTpl();
    if (tpl) {
      this.detalleModalRef?.close();
      this.detalleModalRef = this.modalService.open(tpl, {
        size: 'lg',
        centered: true,
        backdrop: 'static',
        scrollable: true
      });
    }
  }

  cerrarDetalleModal(): void {
    this.detalleModalRef?.close();
    this.detalleModalRef = null;
    this.limpiarSeleccionProducto();
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
    this.verificadoInput = true;
    this.notasInput = '';
    this.descripcionEdit = '';
    this.idCategoriaEdit = null;
    this.idMarcaEdit = null;
    this.idPresentacionEdit = null;
    this.snapshotMaestro = null;
  }

  /** True si el usuario cambió descripción, categoría o presentación respecto al producto al elegirlo. */
  private maestroCatalogoCambio(): boolean {
    if (!this.snapshotMaestro) {
      return false;
    }
    const cat = this.idCategoriaEdit != null && Number.isFinite(this.idCategoriaEdit) ? Number(this.idCategoriaEdit) : 0;
    const mar = this.idMarcaEdit != null && Number.isFinite(this.idMarcaEdit) ? Number(this.idMarcaEdit) : 0;
    const pres =
      this.idPresentacionEdit != null && Number.isFinite(this.idPresentacionEdit) ? Number(this.idPresentacionEdit) : 0;
    return (
      String(this.descripcionEdit ?? '').trim() !== this.snapshotMaestro.descripcion ||
      cat !== this.snapshotMaestro.idCategoria ||
      mar !== this.snapshotMaestro.idMarca ||
      pres !== this.snapshotMaestro.idPresentacion
    );
  }

  guardarLinea(): void {
    if (!this.idSesionEnCurso || !this.productoSeleccionado) {
      return;
    }
    const body: UpsertLineaConteoBody = {
      stockReal: this.stockRealInput,
      verificado: this.verificadoInput,
      notas: this.notasInput?.trim() || null
    };
    const rawSr = this.stockRealInput;
    const tieneStockRealCapturado =
      rawSr != null && String(rawSr).trim() !== '' && Number.isFinite(Number(rawSr));
    if (tieneStockRealCapturado && !this.verificadoInput) {
      iziToast.error({
        title: 'Verificación',
        message:
          'Si ingresó «Stock real», marque «Verificado» antes de guardar; sin eso la línea no se incluye al registrar movimientos.',
        position: 'topRight'
      });
      return;
    }
    if (this.maestroCatalogoCambio()) {
      const descTrim = String(this.descripcionEdit ?? '').trim();
      if (!descTrim) {
        iziToast.error({ title: 'Validación', message: 'La descripción no puede quedar vacía.', position: 'topRight' });
        return;
      }
      if (this.idCategoriaEdit == null || this.idPresentacionEdit == null || this.idMarcaEdit == null) {
        iziToast.error({
          title: 'Validación',
          message: 'Seleccione categoría, marca y presentación para guardar los cambios del producto.',
          position: 'topRight'
        });
        return;
      }
      body.descripcion = descTrim;
      body.idCategoria = Number(this.idCategoriaEdit);
      body.idMarca = Number(this.idMarcaEdit);
      body.idPresentacion = Number(this.idPresentacionEdit);
    }
    const empresaProducto = this.productoSeleccionado?.idEmpresa || null;
    this.conteoService
      .upsertLinea(this.idSesionEnCurso, this.productoSeleccionado.idProducto, {
        ...body,
        idEmpresaProducto: empresaProducto
      })
      .subscribe({
        next: (r) => {
          this.lineas = r.lineas || [];
          if (this.snapshotMaestro && this.productoSeleccionado) {
            const cat = this.idCategoriaEdit != null ? Number(this.idCategoriaEdit) : 0;
            const mar = this.idMarcaEdit != null ? Number(this.idMarcaEdit) : 0;
            const pres = this.idPresentacionEdit != null ? Number(this.idPresentacionEdit) : 0;
            this.snapshotMaestro = {
              descripcion: String(this.descripcionEdit ?? '').trim(),
              idCategoria: cat,
              idMarca: mar,
              idPresentacion: pres
            };
          }
          if (this.productoSeleccionado) {
            const idMar = this.idMarcaEdit != null ? Number(this.idMarcaEdit) : NaN;
            this.productoSeleccionado = {
              ...this.productoSeleccionado,
              descripcion: String(this.descripcionEdit ?? '').trim(),
              idCategoria: this.idCategoriaEdit ?? undefined,
              idMarca: Number.isFinite(idMar) && idMar > 0 ? idMar : this.productoSeleccionado.idMarca,
              idPresentacion: this.idPresentacionEdit ?? undefined
            };
          }
          iziToast.success({ title: 'Línea', message: 'Guardada', position: 'topRight' });
          this.previewCargado = false;
          this.buscarCatalogo();
          this.cerrarDetalleModal();
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

  tieneStockSinUbicacion(p: StockActualItem): boolean {
    if (p.stockSinUbicacion == null) {
      return false;
    }
    const n = Number(p.stockSinUbicacion);
    return Number.isFinite(n) && n > 0;
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
      .aplicarMovimientos(this.idSesionEnCurso, { fechaMovimiento: fechaHoraVentaClienteAhora() })
      .subscribe({
      next: (r) => {
        this.aplicando = false;
        const n = r?.movimientosGenerados != null ? Number(r.movimientosGenerados) : 0;
        const extra = Number.isFinite(n) && n >= 0 ? ` (${n} ítem${n === 1 ? '' : 's'} de ajuste).` : '';
        const idsEmp = r?.empresasAfectadas || [];
        const nombresEmp = idsEmp
          .map((id) => this.empresasGestionadas.find((e) => this.mismoUuid(e.idEmpresa, id))?.nombre)
          .filter(Boolean);
        const empMsg =
          nombresEmp.length > 0
            ? ` Movimientos en: ${nombresEmp.join(', ')} (véalo en Inventario → Movimientos de esa empresa).`
            : '';
        iziToast.success({
          title: 'Listo',
          message: (r.message || 'Aplicado') + extra + empMsg,
          position: 'topRight',
          timeout: 8000
        });
        this.cargarSesion(this.idSesionEnCurso!);
        this.cargarSesionesPendientes();
      },
      error: (err) => {
        this.aplicando = false;
        const msg = err?.error?.message || 'Error al aplicar';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  abrirAsignarSinUbicar(p: StockActualItem): void {
    this.inventarioModal
      .abrirLoteList({ producto: p.idProducto, empresa: p.idEmpresa })
      .catch(() => {});
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
