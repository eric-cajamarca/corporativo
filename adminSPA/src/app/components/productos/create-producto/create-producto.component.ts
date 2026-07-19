import { Component, OnDestroy, OnInit, Optional, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';
import { CatalogoProductoSunatItem } from '../../../models/producto.models';
import { CategoriaService } from '../../../services/categoria.service';
import { MarcaService } from '../../../services/marca.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { SucursalService } from '../../../services/sucursal.service';
import { GestoresService } from '../../../services/gestores.service';
import { ProductosImagenService, ImagenProducto } from '../../../services/productos-imagen.service';
import { ComprasService } from '../../../services/compras.service';
import { PreciosService } from '../../../services/precios.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ProductoCreadoModalResult } from '../../../services/producto-crear-modal.service';
import { CreateCategoriaComponent } from '../../categorias/create-categoria/create-categoria.component';
import { CreateMarcaComponent } from '../../marcas/create-marca/create-marca.component';
import { esProductoServicio } from '../../../utils/producto-servicio.util';

declare var iziToast: any;

/** Presentación "Unidad" por defecto (catálogo en BD). */
const ID_PRESENTACION_UNIDAD_DEFAULT = 10;

interface Categoria {
  idCategoria: string;
  nombre: string;
}

interface Marca {
  idMarca: string;
  nombre: string;
}

interface Presentacion {
  idPresentacion: string;
  codigo: string;
  descripcion: string;
}

interface Sucursal {
  idSucursal: string;
  codigo: string;
  direccion: string;
}

@Component({
  selector: 'app-create-producto',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule],
  templateUrl: './create-producto.component.html',
  styleUrl: './create-producto.component.css'
})
export class CreateProductoComponent implements OnInit, OnDestroy {
  // Formulario
  productoForm!: FormGroup;
  
  // Datos para selects
  categorias: Categoria[] = [];
  marcas: Marca[] = [];
  presentaciones: Presentacion[] = [];
  sucursales: Sucursal[] = [];
  listasPrecio: any[] = [];
  readonly LISTA_TODAS = '__TODAS__';
  mostrarModalPreciosTodas = false;
  preciosPorListaModal: Array<{ idLista: number; nombre: string; precio: number }> = [];
  correlativo: { idCorrelativo?: string; numero?: number; [key: string]: unknown } = { numero: 0 };
  private codigoManual = '';
  sugerenciasSunat: CatalogoProductoSunatItem[] = [];
  private descSunatSub?: Subscription;

  // Estados
  guardando = signal<boolean>(false);
  cargandoDatos = signal<boolean>(true);
  
  // Tabs y modo
  activeTab = signal<string>('basico');
  modoLote = signal<boolean>(false);

  // Datos de lote
  loteData = {
    idSucursal: '',
    costoUnitario: 0,
    cantidadIngresada: 0,
    ubicacion: ''
  };

  // Precios
  precioVenta = 0;
  margenGanancia = 0;

  // Buscar producto base
  textoBusqueda = '';
  resultadosBusqueda: any[] = [];
  mostrarResultados = false;
  buscandoProducto = false;
  /** Debounce para consultar catálogo en servidor sin un cache obsoleto en memoria. */
  private busquedaCopiarTimer: ReturnType<typeof setTimeout> | null = null;

  /** true cuando se abre como modal (desde ProductoCrearModalService) */
  esModal = false;

  /** Empresa gestora: empresas gestionadas para selector y catálogos por empresa. */
  empresasGestionadas: Array<{ idEmpresa: string; nombre: string }> = [];
  idEmpresaSeleccionada = '';

  /** Galería: activa si la empresa tiene productos con imágenes */
  productosConImagenes = false;
  /** Tras crear producto, id para subir imágenes */
  idProductoCreado: string | null = null;
  imagenesProducto: ImagenProducto[] = [];
  subiendoImagenes = false;
  archivosSeleccionados: File[] = [];

  constructor(
    private fb: FormBuilder,
    private productoService: ProductoService,
    private categoriaService: CategoriaService,
    private marcaService: MarcaService,
    private presentacionService: PresentacionService,
    private sucursalService: SucursalService,
    private gestoresService: GestoresService,
    private productosImagenService: ProductosImagenService,
    private comprasService: ComprasService,
    private preciosService: PreciosService,
    private modalService: NgbModal,
    private router: Router,
    @Optional() public activeModal: NgbActiveModal,
    public sidebarState: SidebarStateService
  ) {
    this.esModal = !!this.activeModal;
  }

  ngOnDestroy(): void {
    if (this.busquedaCopiarTimer != null) {
      clearTimeout(this.busquedaCopiarTimer);
      this.busquedaCopiarTimer = null;
    }
    this.descSunatSub?.unsubscribe();
  }

  get esModoGestora(): boolean {
    return this.empresasGestionadas.length > 0;
  }

  ngOnInit(): void {
    this.initForm();
    this.cargarEmpresasGestionadas();
    this.productoForm.get('useCorrelativo')?.valueChanges.subscribe(() => {
      this.onCheckboxChangeCorrelativo();
    });
    this.productoForm.get('idPresentacion')?.valueChanges.subscribe(() => {
      if (this.esPresentacionServicioSeleccionada()) {
        this.modoLote.set(false);
      }
    });
    this.gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const item = (res?.data ?? []).find((c: { clave: string }) => c.clave === 'PRODUCTOS_CON_IMAGENES');
        this.productosConImagenes = item ? (String(item.valor).toLowerCase() === 'true') : false;
      },
      error: () => {}
    });
  }

  esPresentacionServicioSeleccionada(): boolean {
    const id = this.productoForm?.get('idPresentacion')?.value;
    if (id == null || id === '') return false;
    const pres = this.presentaciones.find((p) => String(p.idPresentacion) === String(id));
    return esProductoServicio(pres?.codigo);
  }

  private initForm(): void {
    this.productoForm = this.fb.group({
      // Datos básicos
      codigo: ['', [Validators.required, Validators.minLength(2)]],
      useCorrelativo: [false],
      descripcion: ['', [Validators.required, Validators.minLength(3)]],
      idCategoria: ['', Validators.required],
      idMarca: ['', Validators.required],
      idPresentacion: [String(ID_PRESENTACION_UNIDAD_DEFAULT), Validators.required],
      tipoProducto: ['S', Validators.required], // S: Simple, C: Compuesto, V: Variante
      
      // Control de stock
      alertaMinimo: [10, [Validators.min(0)]],
      alertaMaximo: [100, [Validators.min(0)]],
      
      // Fechas (opcionales)
      fProduccion: [''],
      fVencimiento: [''],
      
      // Estado
      estado: [true],
      permiteDescripcionEnVenta: [false],
      codigoProductoSunat: [''],
      requiereCodigoSunat: [''],
      revisadoSunat: [false],
      anexoSunatSugerido: [''],
      codigoSunatSugerido: [''],

      // Precio
      idListaPrecio: [null]
    });

    this.descSunatSub = this.productoForm
      .get('descripcion')!
      .valueChanges.pipe(debounceTime(450), distinctUntilChanged())
      .subscribe((desc: string) => this.buscarSugerenciasSunat(desc));
  }

  private buscarSugerenciasSunat(desc: string): void {
    const d = String(desc || '').trim();
    if (d.length < 3) {
      this.sugerenciasSunat = [];
      return;
    }
    const catId = this.productoForm.get('idCategoria')?.value;
    const catNombre = this.categorias.find((c) => String(c.idCategoria) === String(catId))?.nombre || '';
    this.productoService.sugerirCodigoProductoSunat(d, catNombre).subscribe({
      next: (res) => {
        this.sugerenciasSunat = Array.isArray(res?.data) ? res.data : [];
        const top = this.sugerenciasSunat[0];
        if (top && !this.productoForm.get('codigoProductoSunat')?.value) {
          this.productoForm.patchValue(
            {
              anexoSunatSugerido: top.anexo,
              codigoSunatSugerido: top.codigo
            },
            { emitEvent: false }
          );
        }
      },
      error: () => {
        this.sugerenciasSunat = [];
      }
    });
  }

  aplicarSugerenciaSunat(item: CatalogoProductoSunatItem): void {
    this.productoForm.patchValue({
      codigoProductoSunat: item.codigo,
      requiereCodigoSunat: '1',
      revisadoSunat: true,
      anexoSunatSugerido: item.anexo,
      codigoSunatSugerido: item.codigo
    });
  }

  etiquetaAnexoSunat(anexo?: string): string {
    if (anexo === '25.1') return 'Regulado';
    if (anexo === '25.2') return 'Detracción';
    if (anexo === '25.3') return 'Percepción';
    return anexo || '';
  }

  private cargarEmpresasGestionadas(): void {
    this.gestoresService.obtenerEmpresasGestionadas().subscribe({
      next: (res) => {
        const arr = Array.isArray(res?.data) ? res.data : [];
        const dedupe = new Map<string, { idEmpresa: string; nombre: string }>();
        arr.forEach((e: { idEmpresa?: string; nombreComercial?: string; razon_Social?: string; ruc?: string }) => {
          const id = String(e?.idEmpresa || '').trim();
          if (!id) return;
          const nombre = String(e?.nombreComercial || e?.razon_Social || e?.ruc || '').trim() || 'Empresa';
          const key = id.toLowerCase();
          if (!dedupe.has(key)) {
            dedupe.set(key, { idEmpresa: id, nombre });
          }
        });
        this.empresasGestionadas = Array.from(dedupe.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        if (this.esModoGestora) {
          this.idEmpresaSeleccionada = this.empresasGestionadas[0]?.idEmpresa || '';
        }
        this.cargarDatos();
      },
      error: () => {
        this.empresasGestionadas = [];
        this.cargarDatos();
      }
    });
  }

  onEmpresaSeleccionadaChange(): void {
    if (!this.esModoGestora) return;
    this.textoBusqueda = '';
    this.resultadosBusqueda = [];
    this.mostrarResultados = false;
    this.productoForm.patchValue({
      idCategoria: '',
      idMarca: ''
    });
    this.cargarDatos();
  }

  private idEmpresaCatalogoActual(): string | undefined {
    if (this.esModoGestora) {
      const id = String(this.idEmpresaSeleccionada || '').trim();
      return id || undefined;
    }
    return undefined;
  }

  private cargarDatos(): void {
    if (this.esModoGestora && !this.idEmpresaSeleccionada) {
      this.categorias = [];
      this.marcas = [];
      this.sucursales = [];
      this.listasPrecio = [];
      this.cargandoDatos.set(false);
      return;
    }

    this.cargandoDatos.set(true);
    let completados = 0;
    const total = 6;
    const idEmpresa = this.idEmpresaCatalogoActual();

    const verificarCompletado = () => {
      completados++;
      if (completados >= total) {
        this.cargandoDatos.set(false);
      }
    };

    const obsCategorias = idEmpresa
      ? this.categoriaService.obtener_categorias_idEmpresa(idEmpresa)
      : this.categoriaService.obtener_categorias();
    obsCategorias.subscribe({
      next: (response) => {
        this.categorias = response.data || [];
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    const obsMarcas = idEmpresa
      ? this.marcaService.obtener_marcas_idEmpresa(idEmpresa)
      : this.marcaService.obtener_marcas();
    obsMarcas.subscribe({
      next: (response) => {
        this.marcas = response.data || [];
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    // Cargar presentaciones (API devuelve Descripcion en PascalCase; se normaliza a descripcion)
    this.presentacionService.obtener_presentaciones().subscribe({
      next: (response) => {
        const raw = Array.isArray(response?.data) ? response.data : [];
        this.presentaciones = this.normalizarPresentacionesDesdeApi(raw);
        const ctrlPres = this.productoForm.get('idPresentacion');
        if (ctrlPres && this.presentaciones.length > 0) {
          const idDefault = String(ID_PRESENTACION_UNIDAD_DEFAULT);
          const idsValidos = new Set(this.presentaciones.map((p) => p.idPresentacion));
          const actual = String(ctrlPres.value ?? '').trim();
          if (!actual || !idsValidos.has(actual)) {
            if (idsValidos.has(idDefault)) {
              ctrlPres.patchValue(idDefault);
            } else {
              const normTxt = (s: string) => (s || '').trim().toLowerCase();
              const unidad =
                this.presentaciones.find((p) => normTxt(p.descripcion) === 'unidad') ??
                this.presentaciones.find((p) => normTxt(p.codigo) === 'un');
              if (unidad) {
                ctrlPres.patchValue(String(unidad.idPresentacion));
              } else {
                ctrlPres.patchValue(this.presentaciones[0].idPresentacion);
              }
            }
          }
        }
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    const obsSucursales = idEmpresa
      ? this.sucursalService.obtener_sucursales_por_empresa(idEmpresa)
      : this.sucursalService.obtener_sucursal_todos();
    obsSucursales.subscribe({
      next: (response: { data?: Sucursal[] }) => {
        this.sucursales = response.data || [];
        if (this.sucursales.length > 0) {
          this.loteData.idSucursal = this.sucursales[0].idSucursal;
        }
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    this.preciosService.listar_listas_precios_empresa(idEmpresa).subscribe({
      next: (response) => {
        this.listasPrecio = response?.data || [];
        const principal = this.listasPrecio.find((l: any) => l.principal === true || l.principal === 1);
        const idLista = principal?.idLista ?? this.listasPrecio[0]?.idLista ?? null;
        if (idLista != null) {
          this.productoForm.patchValue({ idListaPrecio: idLista });
        }
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    this.comprasService.obtener_correlativo_empresa(idEmpresa).subscribe({
      next: (res) => {
        const data = res?.data;
        this.correlativo = data && typeof data === 'object' ? data : this.correlativo;
        if (this.productoForm.get('useCorrelativo')?.value) {
          this.productoForm.patchValue({ codigo: this.correlativo.numero || '' });
        }
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });
  }

  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
  }

  /** Orden de pestañas antes de galería (solo flujo creación en modal). */
  private readonly tabsCreacionOrden = ['basico', 'inventario', 'precios'] as const;

  irSiguienteTabCreacion(): void {
    const tab = this.activeTab();
    if (tab === 'basico') {
      if (this.esModoGestora && !this.idEmpresaSeleccionada) {
        iziToast.show({
          title: 'Advertencia',
          titleColor: '#ffc107',
          message: 'Seleccione la empresa donde se registrará el producto',
          position: 'topRight'
        });
        return;
      }
      const useCorr = !!this.productoForm.get('useCorrelativo')?.value;
      const codVal = String(this.productoForm.get('codigo')?.value || '').trim();
      const codigoOk = useCorr || codVal.length >= 2;
      if (
        !codigoOk ||
        this.productoForm.get('descripcion')?.invalid ||
        this.productoForm.get('idCategoria')?.invalid ||
        this.productoForm.get('idMarca')?.invalid ||
        this.productoForm.get('idPresentacion')?.invalid
      ) {
        this.marcarCamposComoTocados();
        iziToast.show({
          title: 'Advertencia',
          titleColor: '#ffc107',
          message: 'Complete los datos básicos obligatorios antes de continuar',
          position: 'topRight'
        });
        return;
      }
    }
    const idx = this.tabsCreacionOrden.indexOf(tab as (typeof this.tabsCreacionOrden)[number]);
    if (idx >= 0 && idx < this.tabsCreacionOrden.length - 1) {
      this.activeTab.set(this.tabsCreacionOrden[idx + 1]);
    }
  }

  calcularPrecioVenta(): void {
    if (this.loteData.costoUnitario > 0 && this.margenGanancia > 0) {
      this.precioVenta = this.loteData.costoUnitario * (1 + this.margenGanancia / 100);
    }
  }

  calcularMargen(): void {
    if (this.loteData.costoUnitario > 0 && this.precioVenta > 0) {
      this.margenGanancia = ((this.precioVenta - this.loteData.costoUnitario) / this.loteData.costoUnitario) * 100;
    }
  }

  guardarProducto(): void {
    if (this.esModoGestora && !this.idEmpresaSeleccionada) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Seleccione la empresa donde se registrará el producto',
        position: 'topRight'
      });
      return;
    }
    if (this.productoForm.invalid) {
      this.marcarCamposComoTocados();
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Complete todos los campos requeridos',
        position: 'topRight'
      });
      return;
    }

    const idListaSel = this.productoForm.get('idListaPrecio')?.value;
    if (idListaSel === this.LISTA_TODAS) {
      this.abrirModalPreciosTodas();
      return;
    }
    this.guardarProductoInterno();
  }

  private guardarProductoInterno(preciosPorLista?: Array<{ idLista: number; precio: number }>): void {
    this.guardando.set(true);

    const v = this.productoForm.value;
    const producto = {
      Codigo: v.codigo,
      useCorrelativo: !!v.useCorrelativo,
      idCategoria: Number(v.idCategoria),
      idMarca: Number(v.idMarca),
      descripcion: v.descripcion,
      idPresentacion: Number(v.idPresentacion),
      cUnitario: this.loteData.costoUnitario != null ? Number(this.loteData.costoUnitario) : 0,
      fProduccion: v.fProduccion || undefined,
      fVencimiento: v.fVencimiento || undefined,
      alertaMinimo: v.alertaMinimo != null ? Number(v.alertaMinimo) : 10,
      alertaMaximo: v.alertaMaximo != null ? Number(v.alertaMaximo) : 100,
      estado: !!v.estado,
      tipoProducto: (v.tipoProducto === 'C' || v.tipoProducto === 'S') ? v.tipoProducto : 'S',
      lote: !this.esPresentacionServicioSeleccionada() && this.modoLote() && this.loteData.idSucursal ? {
        idSucursal: this.loteData.idSucursal,
        costoUnitario: this.loteData.costoUnitario,
        cantidadIngresada: this.loteData.cantidadIngresada,
        ubicacion: this.loteData.ubicacion
      } : null,
      precioVenta: this.precioVenta && this.precioVenta > 0 ? this.precioVenta : 0,
      idListaPrecio:
        v.idListaPrecio != null && v.idListaPrecio !== '' && v.idListaPrecio !== this.LISTA_TODAS
          ? Number(v.idListaPrecio)
          : null,
      preciosPorLista: Array.isArray(preciosPorLista) ? preciosPorLista : undefined,
      permiteDescripcionEnVenta: !!v.permiteDescripcionEnVenta,
      codigoProductoSunat: v.codigoProductoSunat ? String(v.codigoProductoSunat).trim() : null,
      requiereCodigoSunat:
        v.requiereCodigoSunat === '1' || v.requiereCodigoSunat === true
          ? true
          : v.requiereCodigoSunat === '0' || v.requiereCodigoSunat === false
            ? false
            : null,
      revisadoSunat: !!v.revisadoSunat,
      anexoSunatSugerido: v.anexoSunatSugerido ? String(v.anexoSunatSugerido).trim() : null,
      codigoSunatSugerido: v.codigoSunatSugerido ? String(v.codigoSunatSugerido).trim() : null,
      ...(this.esModoGestora && this.idEmpresaSeleccionada
        ? { idEmpresaDestino: this.idEmpresaSeleccionada }
        : {})
    };

    this.productoService.crearProducto(producto).subscribe({
      next: (response) => {
        this.guardando.set(false);
        if (response.data) {
          const idProducto = typeof response.data === 'string' ? response.data : (response.data as { idProducto?: string })?.idProducto;
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Producto creado correctamente',
            position: 'topRight'
          });
          this.productoService.limpiarCacheListaProductos();
          if (this.productosConImagenes && idProducto) {
            this.idProductoCreado = idProducto;
            this.imagenesProducto = [];
            this.activeTab.set('galeria');
            this.actualizarCorrelativoSiAplica();
          } else if (this.activeModal) {
            this.actualizarCorrelativoSiAplica();
            if (idProducto) {
              this.cerrarModalSiCorresponde(idProducto);
            } else {
              this.activeModal.dismiss();
            }
          } else {
            this.actualizarCorrelativoSiAplica();
            this.router.navigate(['/productos']);
          }
        } else {
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: response.message || 'Error al crear el producto',
            position: 'topRight'
          });
        }
      },
      error: (error) => {
        this.guardando.set(false);
        console.error('Error:', error);
        const apiMsg = String(error?.error?.message || error?.message || '').trim();
        const status = Number(error?.status || 0);
        const mensaje =
          status === 409
            ? (apiMsg || 'Ya existe un producto con ese código. Use un código diferente o seleccione el producto existente para registrar stock en la sucursal correcta.')
            : (apiMsg || 'Error al crear el producto');
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: mensaje,
          position: 'topRight'
        });
      }
    });
  }

  abrirModalPreciosTodas(): void {
    this.preciosPorListaModal = (this.listasPrecio || []).map((l: any) => ({
      idLista: Number(l.idLista),
      nombre: String(l.nombre || 'Lista'),
      precio: this.precioVenta && this.precioVenta > 0 ? Number(this.precioVenta) : 0
    }));
    this.mostrarModalPreciosTodas = true;
  }

  cancelarModalPreciosTodas(): void {
    this.mostrarModalPreciosTodas = false;
  }

  confirmarGuardarConTodas(): void {
    if (!this.preciosPorListaModal.length) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'No hay listas activas para registrar precios.',
        position: 'topRight'
      });
      return;
    }
    const precios = this.preciosPorListaModal.map((x) => ({
      idLista: Number(x.idLista),
      precio: Number.isFinite(Number(x.precio)) && Number(x.precio) >= 0 ? Number(x.precio) : 0
    }));
    this.mostrarModalPreciosTodas = false;
    this.guardarProductoInterno(precios);
  }

  onCheckboxChangeCorrelativo(): void {
    const useCorrelativo = !!this.productoForm.get('useCorrelativo')?.value;
    const codigoCtrl = this.productoForm.get('codigo');
    if (useCorrelativo) {
      this.codigoManual = codigoCtrl?.value || '';
      this.productoForm.patchValue({ codigo: this.correlativo.numero || '' });
      codigoCtrl?.clearValidators();
    } else {
      this.productoForm.patchValue({ codigo: this.codigoManual || '' });
      codigoCtrl?.setValidators([Validators.required, Validators.minLength(2)]);
    }
    codigoCtrl?.updateValueAndValidity();
  }

  private actualizarCorrelativoSiAplica(): void {
    const useCorrelativo = !!this.productoForm.get('useCorrelativo')?.value;
    if (!useCorrelativo) return;
    this.comprasService.obtener_correlativo_empresa(this.idEmpresaCatalogoActual()).subscribe({
      next: (res) => {
        const data = res?.data;
        this.correlativo = data && typeof data === 'object' ? data : this.correlativo;
        this.productoForm.patchValue({ codigo: this.correlativo.numero || '' });
      },
      error: (error) => {
        console.error('actualizarCorrelativoSiAplica:', error);
      }
    });
  }

  recargarCategorias(onDone?: () => void): void {
    const idEmpresa = this.idEmpresaCatalogoActual();
    const obs = idEmpresa
      ? this.categoriaService.obtener_categorias_idEmpresa(idEmpresa)
      : this.categoriaService.obtener_categorias();
    obs.subscribe({
      next: (response) => {
        this.categorias = response.data || [];
        onDone?.();
      },
      error: () => {}
    });
  }

  recargarMarcas(onDone?: () => void): void {
    const idEmpresa = this.idEmpresaCatalogoActual();
    const obs = idEmpresa
      ? this.marcaService.obtener_marcas_idEmpresa(idEmpresa)
      : this.marcaService.obtener_marcas();
    obs.subscribe({
      next: (response) => {
        this.marcas = response.data || [];
        onDone?.();
      },
      error: () => {}
    });
  }

  private parseIdCategoriaModal(res: unknown): number | null {
    if (res && typeof res === 'object' && 'idCategoria' in res) {
      const n = Number((res as { idCategoria?: unknown }).idCategoria);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  private parseIdMarcaModal(res: unknown): number | null {
    if (res && typeof res === 'object' && 'idMarca' in res) {
      const n = Number((res as { idMarca?: unknown }).idMarca);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  /** Une variantes de columnas del API/SQL (p. ej. Descripcion) al modelo del formulario. */
  private normalizarPresentacionesDesdeApi(raw: unknown[]): Presentacion[] {
    return raw
      .map((item) => {
        const p = item as Record<string, unknown>;
        const id = p['idPresentacion'] ?? p['IdPresentacion'];
        const codigo = p['codigo'] ?? p['Codigo'] ?? '';
        const descripcion =
          p['descripcion'] ?? p['Descripcion'] ?? p['DESCRIPCION'] ?? '';
        return {
          idPresentacion: id != null && id !== '' ? String(id) : '',
          codigo: String(codigo ?? '').trim(),
          descripcion: String(descripcion ?? '').trim()
        };
      })
      .filter((p) => p.idPresentacion !== '' && (p.descripcion !== '' || p.codigo !== ''));
  }

  buscarProductoBase(): void {
    if (this.busquedaCopiarTimer != null) {
      clearTimeout(this.busquedaCopiarTimer);
      this.busquedaCopiarTimer = null;
    }

    const textoRaw = this.textoBusqueda.trim();
    if (textoRaw.length < 2) {
      this.resultadosBusqueda = [];
      this.mostrarResultados = false;
      this.buscandoProducto = false;
      return;
    }

    const texto = textoRaw.toLowerCase();
    this.busquedaCopiarTimer = setTimeout(() => {
      this.busquedaCopiarTimer = null;
      this.consultarProductosParaCopiarDesdeServidor(texto);
    }, 320);
  }

  /**
   * Lista siempre desde API (evitarCache) para incluir productos recién dados de alta
   * y no depender de la copia en memoria del ProductoService.
   */
  private consultarProductosParaCopiarDesdeServidor(texto: string): void {
    this.buscandoProducto = true;
    this.productoService.obtenerProductosTodos({ evitarCache: true }).subscribe({
      next: (res) => {
        const lista = Array.isArray(res.data) ? res.data : [];
        this.buscandoProducto = false;
        this.resultadosBusqueda = this.filtrarListaProductos(lista, texto);
        this.mostrarResultados = this.resultadosBusqueda.length > 0;
      },
      error: () => {
        this.buscandoProducto = false;
        this.resultadosBusqueda = [];
        this.mostrarResultados = false;
      }
    });
  }

  private filtrarListaProductos(lista: any[], texto: string): any[] {
    const idEmpresa = this.idEmpresaCatalogoActual();
    return lista
      .filter((p: any) => {
        if (idEmpresa) {
          const pe = String(p.idEmpresa || p.IdEmpresa || '').trim().toLowerCase();
          if (pe !== idEmpresa.toLowerCase()) return false;
        }
        return (
          (p.descripcion || '').toLowerCase().includes(texto) ||
          (p.codigo || '').toLowerCase().includes(texto) ||
          (p.categoria || '').toLowerCase().includes(texto) ||
          (p.marca || '').toLowerCase().includes(texto)
        );
      })
      .slice(0, 10);
  }

  seleccionarProductoBase(producto: any): void {
    this.productoForm.patchValue({
      descripcion: producto.descripcion || '',
      idCategoria: producto.idCategoria != null ? String(producto.idCategoria) : '',
      idMarca: producto.idMarca != null ? String(producto.idMarca) : '',
      idPresentacion: producto.idPresentacion != null ? String(producto.idPresentacion) : '',
      tipoProducto: producto.tipoProducto || 'S',
    });
    if (producto.cUnitario != null && producto.cUnitario > 0) {
      this.loteData.costoUnitario = Number(producto.cUnitario);
    }
    const precio = producto.pVenta || producto.precio || 0;
    if (precio > 0) {
      this.precioVenta = Number(precio);
      this.calcularMargen();
    }
    this.textoBusqueda = '';
    this.resultadosBusqueda = [];
    this.mostrarResultados = false;
    iziToast.show({
      title: 'Producto cargado',
      titleColor: '#17a2b8',
      message: `Datos de "${producto.descripcion}" copiados. Modifique lo necesario.`,
      position: 'topRight'
    });
  }

  cerrarResultadosBusqueda(): void {
    setTimeout(() => { this.mostrarResultados = false; }, 200);
  }

  abrirNuevaCategoria(): void {
    if (this.esModoGestora && !this.idEmpresaSeleccionada) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Seleccione la empresa antes de crear una categoría',
        position: 'topRight'
      });
      return;
    }
    const modalRef = this.modalService.open(CreateCategoriaComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    });
    if (this.esModoGestora) {
      modalRef.componentInstance.idEmpresaDestino = this.idEmpresaSeleccionada;
    }
    modalRef.result
      .then((res: unknown) => {
        const id = this.parseIdCategoriaModal(res);
        if (id != null) {
          this.recargarCategorias(() => this.productoForm.patchValue({ idCategoria: String(id) }));
        } else {
          this.recargarCategorias();
        }
      })
      .catch(() => this.recargarCategorias());
  }

  abrirNuevaMarca(): void {
    if (this.esModoGestora && !this.idEmpresaSeleccionada) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Seleccione la empresa antes de crear una marca',
        position: 'topRight'
      });
      return;
    }
    const modalRef = this.modalService.open(CreateMarcaComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg'
    });
    if (this.esModoGestora) {
      modalRef.componentInstance.idEmpresaDestino = this.idEmpresaSeleccionada;
    }
    modalRef.result
      .then((res: unknown) => {
        const id = this.parseIdMarcaModal(res);
        if (id != null) {
          this.recargarMarcas(() => this.productoForm.patchValue({ idMarca: String(id) }));
        } else {
          this.recargarMarcas();
        }
      })
      .catch(() => this.recargarMarcas());
  }

  private marcarCamposComoTocados(): void {
    Object.keys(this.productoForm.controls).forEach(key => {
      this.productoForm.get(key)?.markAsTouched();
    });
  }

  /** Payload al cerrar modal (movimiento inventario: rellenar detalle con ingreso/salida según pantalla padre). */
  private buildProductoCreadoModalResult(idProducto: string): ProductoCreadoModalResult {
    const v = this.productoForm.value;
    const loteQty = this.modoLote() ? Number(this.loteData.cantidadIngresada) || 0 : 0;
    const costo = Number(this.loteData.costoUnitario) || 0;
    const fvRaw = v.fVencimiento != null && String(v.fVencimiento).trim() !== ''
      ? String(v.fVencimiento).trim()
      : '';
    const fv = fvRaw.length >= 10 ? fvRaw.slice(0, 10) : fvRaw;
    const fpRaw = v.fProduccion != null && String(v.fProduccion).trim() !== ''
      ? String(v.fProduccion).trim()
      : '';
    const fp = fpRaw.length >= 10 ? fpRaw.slice(0, 10) : fpRaw;
    return {
      idProducto,
      codigo: String(v.codigo || ''),
      descripcion: String(v.descripcion || ''),
      idCategoria: v.idCategoria != null && String(v.idCategoria).trim() !== ''
        ? Number(v.idCategoria)
        : undefined,
      idMarca: v.idMarca != null && String(v.idMarca).trim() !== ''
        ? Number(v.idMarca)
        : undefined,
      idPresentacion: v.idPresentacion != null && String(v.idPresentacion).trim() !== ''
        ? Number(v.idPresentacion)
        : undefined,
      fProduccion: fp || undefined,
      cantidadDesdeLote: loteQty > 0 ? loteQty : undefined,
      costoUnitario: costo > 0 ? costo : undefined,
      fechaVencimiento: fv || undefined,
      numeroLote: undefined,
      idSucursalLote:
        this.modoLote() && this.loteData.idSucursal
          ? String(this.loteData.idSucursal)
          : undefined,
    };
  }

  private cerrarModalSiCorresponde(idProducto: string): void {
    if (!this.activeModal) {
      return;
    }
    this.activeModal.close(this.buildProductoCreadoModalResult(idProducto));
  }

  hasError(field: string): boolean {
    const control = this.productoForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  getError(field: string): string {
    const control = this.productoForm.get(field);
    if (control?.errors?.['required']) return 'Este campo es requerido';
    if (control?.errors?.['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    if (control?.errors?.['min']) return `Valor mínimo: ${control.errors['min'].min}`;
    return '';
  }

  cancelar(): void {
    if (this.activeModal) {
      this.activeModal.dismiss();
    } else {
      this.router.navigate(['/productos']);
    }
  }

  onArchivosChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.archivosSeleccionados = Array.from(input.files).slice(0, 5 - this.imagenesProducto.length);
    }
  }

  subirImagenes(): void {
    if (!this.idProductoCreado || this.archivosSeleccionados.length === 0) return;
    this.subiendoImagenes = true;
    this.productosImagenService.subir(this.idProductoCreado, this.archivosSeleccionados).subscribe({
      next: () => {
        this.subiendoImagenes = false;
        this.archivosSeleccionados = [];
        this.cargarImagenesProducto();
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Imágenes subidas', position: 'topRight' });
      },
      error: () => {
        this.subiendoImagenes = false;
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: 'No se pudieron subir las imágenes', position: 'topRight' });
      }
    });
  }

  private cargarImagenesProducto(): void {
    if (!this.idProductoCreado) return;
    this.productosImagenService.listar(this.idProductoCreado).subscribe({
      next: (res) => { this.imagenesProducto = res.data || []; },
      error: () => {}
    });
  }

  eliminarImagen(idImagen: string): void {
    this.productosImagenService.eliminar(idImagen).subscribe({
      next: () => {
        this.imagenesProducto = this.imagenesProducto.filter(i => i.idImagen !== idImagen);
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Imagen eliminada', position: 'topRight' });
      },
      error: () => {
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: 'No se pudo eliminar', position: 'topRight' });
      }
    });
  }

  finalizarCreacion(): void {
    if (this.activeModal) {
      if (this.idProductoCreado) {
        this.activeModal.close(this.buildProductoCreadoModalResult(this.idProductoCreado));
      } else {
        this.activeModal.dismiss();
      }
    } else {
      this.router.navigate(['/productos']);
    }
  }

  irAEditar(): void {
    if (this.idProductoCreado) this.router.navigate(['/productos/update', this.idProductoCreado]);
  }
}
