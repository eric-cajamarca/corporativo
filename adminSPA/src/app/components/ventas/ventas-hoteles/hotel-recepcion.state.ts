import { Injectable, inject, signal, OnInit } from '@angular/core';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ClienteService } from '../../../services/cliente.service';
import { DocumentoService } from '../../../services/documento.service';
import { Documento } from '../../../interfaces/documento-interface';
import { HotelService, type Reserva, type ProductoHabitacion, type ConsumoHabitacionLinea, type Estancia, type EstadoReserva, type HotelCalendarioData, type HotelCalendarioEvento, type HotelBloqueo, type MotivoBloqueoHotel, type HotelHousekeepingItem, type HotelAnticipo, type HotelFolio, type HotelFolioDocumento, type HotelReporte, type HotelReporteHabitacion, type HotelReporteOcupacionDia, type EstadoLimpiezaHotel, type HotelHistorialHabitacion, type HotelHistorialEstanciaResumen, type HotelHistorialEstanciaDetalle, type CheckOutPreloadLinea, type HotelGrupo, type HotelGrupoDetalle } from '../../../services/hotel.service';
import { HotelPreloadVentaService } from '../../../services/hotel-preload-venta.service';
import { ProductoService } from '../../../services/producto.service';
import { Router } from '@angular/router';
import { productoActivoParaVenta } from '../../../utils/producto-busqueda.util';
import { descripcionUnidadMedidaProducto } from '../../../utils/producto-presentacion.util';
import { getFechaHoyLocal, calcularNochesEstadia, fechaHoraClienteAhora } from '../../../utils/fecha-local.util';
import { PdfService } from '../../../services/pdf.service';
import { EmpresaService } from '../../../services/empresa.service';

declare var iziToast: { warning: (o: object) => void; success: (o: object) => void; error: (o: object) => void; info: (o: object) => void };

export interface ProductoParaConsumo {
  idProducto: string;
  codigo: string;
  descripcion: string;
  pVenta?: number;
  codigoPresentacion?: string;
  descripcionPres?: string;
  categoria?: string;
  sucursal?: string;
  stock?: number;
}

export type HotelTabId = 'calendario' | 'reservas' | 'habitaciones' | 'consumo' | 'housekeeping' | 'reportes';

export type CeldaCalendarioOcupacion =
  | { tipo: 'vacio' }
  | { tipo: 'fuera'; dia: number }
  | { tipo: 'dia'; dia: number; data: HotelReporteOcupacionDia };


@Injectable()
export class HotelRecepcionState implements OnInit {
  private hotelService = inject(HotelService);
  private preloadVenta = inject(HotelPreloadVentaService);
  private productoService = inject(ProductoService);
  private clienteService = inject(ClienteService);
  private documentoService = inject(DocumentoService);
  private pdfService = inject(PdfService);
  private empresaService = inject(EmpresaService);
  private router = inject(Router);
  sidebarState = inject(SidebarStateService);
  activeTab = signal<HotelTabId>('calendario');

  reservas: Reserva[] = [];
  estanciasActivas: Estancia[] = [];
  gruposActivos: HotelGrupo[] = [];
  productosHabitacion: ProductoHabitacion[] = [];
  /** Consumo agrupado por idProductoHabitacion */
  consumoPorHabitacion: Record<string, ConsumoHabitacionLinea[]> = {};
  /** Productos con datos completos (presentación, precio, etc.) para consumo y buscador. */
  productosParaConsumo: ProductoParaConsumo[] = [];
  /** Producto elegido en el modal de búsqueda (para mostrar descripción y precio en el form). */
  productoSeleccionadoConsumo: ProductoParaConsumo | null = null;
  showModalBuscarProducto = signal(false);
  searchTermProducto = '';
  productosFiltradosBusqueda: ProductoParaConsumo[] = [];

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  showModalReserva = signal(false);
  reservaEditando: Reserva | null = null;
  formReserva = {
    idProductoHabitacion: '',
    idCliente: null as number | null,
    nombreHuesped: '',
    fechaEntrada: '',
    fechaSalida: '',
    total: 0,
    codigo: ''
  };
  /** Si el usuario editó manualmente el total, no sobrescribir al cambiar fechas/habitación. */
  totalReservaEditadoManual = false;
  guardandoReserva = false;

  showModalCheckIn = signal(false);
  habitacionCheckInSeleccionada: ProductoHabitacion | null = null;
  reservaCheckInSeleccionada: Reserva | null = null;
  formCheckIn = {
    idProductoHabitacion: '',
    idCliente: null as number | null,
    nombreHuesped: '',
    fechaSalida: '',
    tarifaNoche: 0,
    totalHabitacion: 0
  };
  guardandoCheckIn = false;

  showModalCliente = signal(false);
  showModalCrearCliente = signal(false);

  documentos: Documento[] = [];
  idDocumentoHuesped = '1';
  numeroDocumentoHuesped = '';
  clienteBuscando = false;
  crearClientePreSerial = 0;

  private readonly ID_DOC_RUC = '6';
  private readonly ID_DOC_DNI = '1';

  showModalConsumo = signal(false);
  habitacionConsumoSeleccionada: ProductoHabitacion | null = null;
  formConsumo = { idProducto: '', cantidad: 1, pUnitario: 0 };
  guardandoConsumo = false;

  showModalDetalle = signal(false);
  habitacionDetalleSeleccionada: ProductoHabitacion | null = null;
  editandoConsumo: ConsumoHabitacionLinea | null = null;
  formEditConsumo = { cantidad: 0, pUnitario: 0 };
  guardandoEditConsumo = false;

  calendarioDesde = '';
  calendarioHasta = '';
  calendarioData: HotelCalendarioData | null = null;
  calendarioLoading = signal(false);

  showModalBloqueo = signal(false);
  guardandoBloqueo = false;
  formBloqueo = {
    idProductoHabitacion: '',
    fechaDesde: '',
    fechaHasta: '',
    motivo: 'mantenimiento' as MotivoBloqueoHotel,
    observaciones: ''
  };
  motivosBloqueo: { value: MotivoBloqueoHotel; label: string }[] = [
    { value: 'mantenimiento', label: 'Mantenimiento' },
    { value: 'admin', label: 'Administrativo' },
    { value: 'housekeeping', label: 'Housekeeping' }
  ];

  housekeepingPorHabitacion: Record<string, HotelHousekeepingItem> = {};
  housekeepingLoading = signal(false);

  reporteDesde = '';
  reporteHasta = '';
  reporteMes = '';
  reporteData: HotelReporte | null = null;
  reporteLoading = signal(false);
  generandoPdfGeneral = false;
  generandoPdfHabitaciones = false;
  readonly diasSemanaOcupacion = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  readonly fechaHoyOcupacion = getFechaHoyLocal();

  historialHabitacionId = '';
  historialMes = '';
  historialData: HotelHistorialHabitacion | null = null;
  historialLoading = signal(false);
  showModalHistorialEstancia = signal(false);
  showModalFacturarEstancia = signal(false);
  habitacionFacturarSeleccionada: ProductoHabitacion | null = null;
  facturarPendienteHabitacion = false;
  facturarPendienteConsumo = false;
  showModalCambiarSalida = signal(false);
  habitacionCambiarSalida: ProductoHabitacion | null = null;
  formCambiarSalida = { fechaSalida: '', tarifaNoche: 0 };
  guardandoCambiarSalida = false;
  showModalMoverHabitacion = signal(false);
  habitacionMoverOrigen: ProductoHabitacion | null = null;
  idHabitacionDestinoMover = '';
  guardandoMoverHabitacion = false;
  showModalFolio = signal(false);
  habitacionFolio: ProductoHabitacion | null = null;
  folioData: HotelFolio | null = null;
  folioLoading = false;
  formFolioAnticipo = { monto: 0, concepto: 'Seña / anticipo' };
  guardandoFolioAnticipo = false;
  historialDetalle: HotelHistorialEstanciaDetalle | null = null;
  historialDetalleLoading = signal(false);

  showModalAnticipo = signal(false);
  reservaAnticipoSeleccionada: Reserva | null = null;
  formAnticipo = { monto: 0, concepto: 'Seña / anticipo' };
  guardandoAnticipo = false;

  showModalGrupo = signal(false);
  showPanelGrupo = signal(false);
  grupoDetalle: HotelGrupoDetalle | null = null;
  grupoDetalleLoading = false;
  guardandoGrupo = false;
  facturandoGrupo = false;
  formGrupo = {
    idCliente: null as number | null,
    nombre: '',
    fechaEntrada: '',
    fechaSalida: '',
    idsProductoHabitacion: [] as string[]
  };
  anticiposReserva: HotelAnticipo[] = [];

  private dragReservaActiva: {
    idReserva: string;
    startX: number;
    fechaEntrada: string;
    fechaSalida: string;
    idProductoHabitacion: string;
  } | null = null;

  /** Filtro rápido en pestaña Habitaciones (número, estado, huésped). */
  filtroHabitaciones = '';

  estadosLimpieza: { value: EstadoLimpiezaHotel; label: string; labelCorto: string }[] = [
    { value: 'limpia', label: 'Limpia', labelCorto: 'Limpia' },
    { value: 'sucia', label: 'Sucia', labelCorto: 'Sucia' },
    { value: 'en_limpieza', label: 'En limpieza', labelCorto: 'En limpieza' },
    { value: 'fuera_servicio', label: 'Fuera de servicio', labelCorto: 'Fuera srv.' }
  ];

  ngOnInit(): void {
    this.inicializarRangoCalendario();
    this.cargarDatos();
    this.cargarProductosHabitacion();
    this.cargarHousekeeping();
    this.documentoService.obtener_documento1().subscribe({
      next: (res) => { this.documentos = res.data || []; },
      error: () => { this.documentos = []; }
    });
    // Recepción móvil: tab Habitaciones primero (solo viewport < md; desktop/gestora no aplica).
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches) {
      this.setTab('habitaciones');
    } else {
      this.cargarCalendario();
    }
  }

  cargarDatos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.hotelService.listarReservas().subscribe({
      next: (res) => {
        this.reservas = res.data ?? [];
        this.hotelService.listarEstanciasActivas().subscribe({
          next: (est) => {
            this.estanciasActivas = est.data ?? [];
            this.hotelService.listarGrupos().subscribe({
              next: (g) => {
                this.gruposActivos = g.data ?? [];
                this.loading.set(false);
              },
              error: () => {
                this.gruposActivos = [];
                this.loading.set(false);
              }
            });
          },
          error: () => {
            this.estanciasActivas = [];
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al cargar reservas');
        this.loading.set(false);
      }
    });
  }

  cargarProductosHabitacion(): void {
    this.hotelService.getProductosHabitacion().subscribe({
      next: (res) => {
        this.productosHabitacion = (res.data ?? []).map((h) => ({
          ...h,
          pVenta: Number(h.pVenta) || 0
        }));
        if (!this.historialHabitacionId && this.productosHabitacion.length) {
          this.historialHabitacionId = this.productosHabitacion[0].idProducto;
        }
        this.completarPreciosHabitacionDesdeCatalogo();
      },
      error: () => { this.productosHabitacion = []; }
    });
  }

  /** Compara UUIDs sin importar mayúsculas/espacios (select HTML vs API). */
  private mismoIdProducto(a: string | null | undefined, b: string | null | undefined): boolean {
    return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  }

  /** Si el endpoint de habitaciones no trae pVenta, toma el del catálogo general. */
  private completarPreciosHabitacionDesdeCatalogo(): void {
    if (!this.productosHabitacion.some((h) => !(Number(h.pVenta) > 0))) return;
    this.productoService.obtenerProductosTodos().subscribe({
      next: (r) => {
        const data = (r as { data?: unknown[] }).data ?? [];
        const map = new Map<string, number>();
        for (const raw of data) {
          const p = raw as Record<string, unknown>;
          const id = String(p['idProducto'] ?? '').trim().toLowerCase();
          const pv = Number(p['pVenta']) || 0;
          if (id && pv > 0) map.set(id, pv);
        }
        let cambio = false;
        this.productosHabitacion = this.productosHabitacion.map((h) => {
          const key = String(h.idProducto).trim().toLowerCase();
          const pvCatalogo = map.get(key) ?? 0;
          if (!(Number(h.pVenta) > 0) && pvCatalogo > 0) {
            cambio = true;
            return { ...h, pVenta: pvCatalogo };
          }
          return h;
        });
        if (cambio) this.onCambioDatosReserva();
      }
    });
  }

  setTab(tab: HotelTabId): void {
    this.activeTab.set(tab);
    if (tab === 'habitaciones') {
      this.cargarConsumo();
      this.cargarCalendarioMini();
      this.cargarHousekeeping();
    }
    if (tab === 'calendario') this.cargarCalendario();
    if (tab === 'housekeeping') this.cargarHousekeeping();
    if (tab === 'reportes') this.inicializarRangoReporte();
  }

  private mesActualLocal(): string {
    const hoy = getFechaHoyLocal();
    return hoy.slice(0, 7);
  }

  private inicializarRangoCalendario(): void {
    const hoy = getFechaHoyLocal();
    this.calendarioDesde = hoy;
    this.calendarioHasta = this.sumarDiasLocal(hoy, 6);
  }

  private sumarDiasLocal(fecha: string, dias: number): string {
    const d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  getDiasCalendario(): string[] {
    if (!this.calendarioDesde) return [];
    const dias: string[] = [];
    let f = this.calendarioDesde;
    const fin = this.calendarioHasta || f;
    while (f <= fin) {
      dias.push(f);
      f = this.sumarDiasLocal(f, 1);
    }
    return dias;
  }

  cargarCalendario(): void {
    if (!this.calendarioDesde || !this.calendarioHasta) this.inicializarRangoCalendario();
    this.calendarioLoading.set(true);
    this.errorMessage.set(null);
    this.hotelService.getCalendario(this.calendarioDesde, this.calendarioHasta).subscribe({
      next: (res) => {
        this.calendarioData = res.data ?? null;
        this.calendarioLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al cargar calendario');
        this.calendarioData = null;
        this.calendarioLoading.set(false);
      }
    });
  }

  cargarCalendarioMini(): void {
    const hoy = getFechaHoyLocal();
    const hasta = this.sumarDiasLocal(hoy, 6);
    this.hotelService.getCalendario(hoy, hasta).subscribe({
      next: (res) => { this.calendarioData = res.data ?? null; },
      error: () => {}
    });
  }

  calendarioSemanaAnterior(): void {
    this.calendarioDesde = this.sumarDiasLocal(this.calendarioDesde, -7);
    this.calendarioHasta = this.sumarDiasLocal(this.calendarioHasta, -7);
    this.cargarCalendario();
  }

  calendarioSemanaSiguiente(): void {
    this.calendarioDesde = this.sumarDiasLocal(this.calendarioDesde, 7);
    this.calendarioHasta = this.sumarDiasLocal(this.calendarioHasta, 7);
    this.cargarCalendario();
  }

  calendarioIrHoy(): void {
    this.inicializarRangoCalendario();
    this.cargarCalendario();
  }

  getEventosHabitacion(idProductoHabitacion: string): HotelCalendarioEvento[] {
    const eventos = this.calendarioData?.eventos ?? [];
    return eventos.filter((e) => this.mismoIdProducto(e.idProductoHabitacion, idProductoHabitacion));
  }

  barStyleEvento(ev: HotelCalendarioEvento): Record<string, string> {
    const dias = this.getDiasCalendario();
    if (!dias.length) return { display: 'none' };
    const rangeStart = new Date(dias[0] + 'T00:00:00');
    const rangeEnd = new Date(dias[dias.length - 1] + 'T23:59:59');
    const inicioRaw = ev.inicio ?? ev.checkIn ?? ev.fechaDesde ?? ev.fechaEntrada ?? '';
    const finRaw = ev.fin ?? ev.checkOutPrevisto ?? ev.fechaHasta ?? ev.fechaSalida ?? '';
    const evStart = new Date(String(inicioRaw).replace(' ', 'T'));
    const evEnd = new Date(String(finRaw).replace(' ', 'T'));
    if (Number.isNaN(evStart.getTime()) || Number.isNaN(evEnd.getTime())) return { display: 'none' };
    const clipStart = evStart < rangeStart ? rangeStart : evStart;
    const clipEnd = evEnd > rangeEnd ? rangeEnd : evEnd;
    if (clipEnd <= clipStart) return { display: 'none' };
    const totalMs = rangeEnd.getTime() - rangeStart.getTime() + 1;
    const left = ((clipStart.getTime() - rangeStart.getTime()) / totalMs) * 100;
    const width = ((clipEnd.getTime() - clipStart.getTime()) / totalMs) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 1.5)}%` };
  }

  labelEventoCalendario(ev: HotelCalendarioEvento): string {
    if (ev.tipo === 'bloqueo') return ev.motivo === 'mantenimiento' ? 'Manten.' : (ev.motivo ?? 'Bloqueo');
    const grupo = ev.grupoCodigo || ev.grupoNombre;
    if (ev.tipo === 'estancia') {
      const nombre = ev.nombreHuesped ?? 'In-house';
      return grupo ? `${grupo} · ${nombre}` : nombre;
    }
    if (grupo) return `${grupo} · ${ev.habitacionCodigo || ev.codigo || 'Reserva'}`;
    return ev.codigo ? `${ev.codigo}` : (ev.nombreHuesped ?? 'Reserva');
  }

  claseBarraEvento(ev: HotelCalendarioEvento): string {
    const extra = ev.idGrupo ? ' tape-bar-grupo' : '';
    if (ev.tipo === 'estancia') return 'tape-bar-estancia' + extra;
    if (ev.tipo === 'bloqueo') return 'tape-bar-bloqueo';
    return 'tape-bar-reserva' + extra;
  }

  onClickEventoCalendario(ev: HotelCalendarioEvento, hab: ProductoHabitacion): void {
    if (this.dragReservaActiva) return;
    if (ev.tipo === 'reserva' && ev.idReserva) {
      const res = this.reservas.find((r) => r.idReserva === ev.idReserva);
      if (res) this.abrirModalCheckInDesdeReserva(res);
      return;
    }
    if (ev.tipo === 'estancia') {
      this.abrirModalDetalle(hab);
      return;
    }
    if (ev.tipo === 'bloqueo' && ev.idBloqueo) {
      if (confirm('¿Eliminar este bloqueo de habitación?')) {
        this.hotelService.eliminarBloqueo(ev.idBloqueo).subscribe({
          next: () => {
            iziToast.success({ title: 'OK', message: 'Bloqueo eliminado.', position: 'topRight' });
            this.cargarCalendario();
            if (this.activeTab() === 'habitaciones') this.cargarCalendarioMini();
          },
          error: (err) => {
            iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo eliminar', position: 'topRight' });
          }
        });
      }
    }
  }

  abrirModalBloqueo(hab?: ProductoHabitacion): void {
    this.formBloqueo = {
      idProductoHabitacion: hab?.idProducto ?? '',
      fechaDesde: this.calendarioDesde ? `${this.calendarioDesde}T14:00` : '',
      fechaHasta: this.calendarioDesde ? `${this.sumarDiasLocal(this.calendarioDesde, 1)}T11:00` : '',
      motivo: 'mantenimiento',
      observaciones: ''
    };
    this.errorMessage.set(null);
    this.showModalBloqueo.set(true);
  }

  cerrarModalBloqueo(): void {
    this.showModalBloqueo.set(false);
  }

  guardarBloqueo(): void {
    if (!this.formBloqueo.idProductoHabitacion || !this.formBloqueo.fechaDesde || !this.formBloqueo.fechaHasta) {
      this.errorMessage.set('Complete habitación y rango de fechas.');
      return;
    }
    this.guardandoBloqueo = true;
    this.hotelService.crearBloqueo({
      idProductoHabitacion: this.formBloqueo.idProductoHabitacion,
      fechaDesde: this.formBloqueo.fechaDesde,
      fechaHasta: this.formBloqueo.fechaHasta,
      motivo: this.formBloqueo.motivo,
      observaciones: this.formBloqueo.observaciones || null
    }).subscribe({
      next: () => {
        this.guardandoBloqueo = false;
        this.cerrarModalBloqueo();
        iziToast.success({ title: 'OK', message: 'Bloqueo registrado.', position: 'topRight' });
        this.cargarCalendario();
        if (this.activeTab() === 'habitaciones') this.cargarCalendarioMini();
      },
      error: (err) => {
        this.guardandoBloqueo = false;
        this.errorMessage.set(err?.error?.message || 'Error al crear bloqueo');
      }
    });
  }

  miniDiaClase(hab: ProductoHabitacion, fecha: string): string {
    const eventos = this.getEventosHabitacion(hab.idProducto).filter((ev) => this.eventoCubreFecha(ev, fecha));
    if (eventos.some((e) => e.tipo === 'estancia')) return 'mini-dia-ocupada';
    if (eventos.some((e) => e.tipo === 'bloqueo')) return 'mini-dia-bloqueo';
    if (eventos.some((e) => e.tipo === 'reserva')) return 'mini-dia-reserva';
    return 'mini-dia-libre';
  }

  private eventoCubreFecha(ev: HotelCalendarioEvento, fecha: string): boolean {
    const dayStart = new Date(fecha + 'T00:00:00');
    const dayEnd = new Date(fecha + 'T23:59:59');
    const inicioRaw = ev.inicio ?? ev.checkIn ?? ev.fechaDesde ?? ev.fechaEntrada ?? '';
    const finRaw = ev.fin ?? ev.checkOutPrevisto ?? ev.fechaHasta ?? ev.fechaSalida ?? '';
    const evStart = new Date(String(inicioRaw).replace(' ', 'T'));
    const evEnd = new Date(String(finRaw).replace(' ', 'T'));
    if (Number.isNaN(evStart.getTime()) || Number.isNaN(evEnd.getTime())) return false;
    return evStart < dayEnd && evEnd > dayStart;
  }

  tieneBloqueoActivo(idProductoHabitacion: string): boolean {
    const hoy = getFechaHoyLocal();
    return this.getEventosHabitacion(idProductoHabitacion).some(
      (e) => e.tipo === 'bloqueo' && this.eventoCubreFecha(e, hoy)
    );
  }

  formatoDiaCalendario(fecha: string): string {
    const d = new Date(fecha + 'T12:00:00');
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${dias[d.getDay()]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  }

  cargarConsumo(): void {
    this.hotelService.listarConsumo().subscribe({
      next: (res) => {
        const list = res.data ?? [];
        const map: Record<string, ConsumoHabitacionLinea[]> = {};
        for (const linea of list) {
          const id = linea.idProductoHabitacion;
          if (!map[id]) map[id] = [];
          map[id].push(linea);
        }
        this.consumoPorHabitacion = map;
      },
      error: () => { this.consumoPorHabitacion = {}; }
    });
  }

  /** Reserva confirmada (booking) para esta habitación. */
  reservaEsConfirmada(r: Reserva): boolean {
    const e = String(r.estado);
    return e === 'confirmada' || e === 'vigente';
  }

  getReservasConfirmadasHabitacion(idProductoHabitacion: string): Reserva[] {
    return this.reservas
      .filter((r) => this.mismoIdProducto(r.idProductoHabitacion, idProductoHabitacion) && this.reservaEsConfirmada(r))
      .sort((a, b) => (a.fechaEntrada > b.fechaEntrada ? 1 : -1));
  }

  getProximaReservaConfirmada(idProductoHabitacion: string): Reserva | null {
    const hoy = getFechaHoyLocal();
    const futuras = this.getReservasConfirmadasHabitacion(idProductoHabitacion).filter((r) => r.fechaSalida >= hoy);
    return futuras[0] ?? null;
  }

  getEstanciaActiva(idProductoHabitacion: string): Estancia | null {
    return (
      this.estanciasActivas.find((e) => this.mismoIdProducto(e.idProductoHabitacion, idProductoHabitacion)) ?? null
    );
  }

  getConsumoDeHabitacion(idProductoHabitacion: string): ConsumoHabitacionLinea[] {
    return Object.entries(this.consumoPorHabitacion)
      .filter(([k]) => this.mismoIdProducto(k, idProductoHabitacion))
      .flatMap(([, v]) => v);
  }

  /** Estado tarjeta: ocupada = estancia activa; reservada = llegada hoy; bloqueada = bloqueo o fuera de servicio. */
  getEstadoHabitacion(hab: ProductoHabitacion): 'ocupada' | 'reservada' | 'disponible' | 'bloqueada' {
    if (this.getEstanciaActiva(hab.idProducto)) return 'ocupada';
    if (this.tieneBloqueoActivo(hab.idProducto)) return 'bloqueada';
    const limp = this.getEstadoLimpieza(hab.idProducto);
    if (limp === 'fuera_servicio') return 'bloqueada';
    const hoy = getFechaHoyLocal();
    const llegadaHoy = this.getReservasConfirmadasHabitacion(hab.idProducto).some((r) => r.fechaEntrada === hoy);
    if (llegadaHoy) return 'reservada';
    return 'disponible';
  }

  /** Check-in permitido: limpia o en limpieza; no sucia ni fuera de servicio. */
  puedeRegistrarHuesped(hab: ProductoHabitacion): boolean {
    if (this.getEstanciaActiva(hab.idProducto)) return false;
    if (this.tieneBloqueoActivo(hab.idProducto)) return false;
    const limp = this.getEstadoLimpieza(hab.idProducto);
    return limp === 'limpia' || limp === 'en_limpieza';
  }

  motivoNoCheckIn(hab: ProductoHabitacion): string {
    const limp = this.getEstadoLimpieza(hab.idProducto);
    if (limp === 'sucia') return 'Habitación sucia';
    if (limp === 'fuera_servicio') return 'Fuera de servicio';
    if (this.tieneBloqueoActivo(hab.idProducto)) return 'Bloqueada';
    return '';
  }

  formatHoraRegistroHuesped(checkIn?: string | null): string {
    if (!checkIn) return '';
    const s = String(checkIn).trim();
    const parte = s.match(/(\d{2}:\d{2})/);
    if (parte) return parte[1];
    const d = new Date(s.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private validarCheckInHousekeeping(hab: ProductoHabitacion): boolean {
    if (this.puedeRegistrarHuesped(hab)) return true;
    const motivo = this.motivoNoCheckIn(hab) || 'No disponible para check-in';
    iziToast.warning({ title: 'Check-in', message: motivo, position: 'topRight' });
    return false;
  }

  /** Habitaciones visibles según filtro de búsqueda. */
  get habitacionesFiltradas(): ProductoHabitacion[] {
    const q = this.normalizarTextoFiltro(this.filtroHabitaciones);
    if (!q) return this.productosHabitacion;
    return this.productosHabitacion.filter((hab) => this.habitacionCoincideFiltro(hab, q));
  }

  limpiarFiltroHabitaciones(): void {
    this.filtroHabitaciones = '';
  }

  private normalizarTextoFiltro(texto: string): string {
    return String(texto ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private habitacionCoincideFiltro(hab: ProductoHabitacion, q: string): boolean {
    return this.textoBusquedaHabitacion(hab).includes(q);
  }

  private textoBusquedaHabitacion(hab: ProductoHabitacion): string {
    const est = this.getEstanciaActiva(hab.idProducto);
    const estado = this.getEstadoHabitacion(hab);
    const limp = this.getEstadoLimpieza(hab.idProducto);
    const proxRes = this.getProximaReservaConfirmada(hab.idProducto);
    const reservas = this.getReservasConfirmadasHabitacion(hab.idProducto);
    const etiquetasEstado: Record<string, string> = {
      ocupada: 'ocupada in-house huesped',
      reservada: 'reserva reservada llegada',
      disponible: 'libre disponible',
      bloqueada: 'bloqueada fuera servicio mantenimiento'
    };
    const partes = [
      hab.codigo,
      hab.descripcion,
      estado,
      etiquetasEstado[estado] ?? '',
      limp,
      this.labelEstadoLimpieza(limp),
      est?.nombreHuesped,
      proxRes?.nombreHuesped,
      ...reservas.map((r) => r.nombreHuesped),
      this.motivoNoCheckIn(hab)
    ];
    return this.normalizarTextoFiltro(partes.filter(Boolean).join(' '));
  }

  /** Total pendiente: habitación si aún no se facturó (y no es de grupo) + consumo pendiente. */
  getTotalHabitacion(hab: ProductoHabitacion): number {
    const est = this.getEstanciaActiva(hab.idProducto);
    const totalHabitacion = est && !this.estanciaHabitacionFacturada(est) && !this.esEstanciaDeGrupo(est)
      ? Number(est.totalHabitacion) || 0
      : 0;
    const lineas = this.getConsumoDeHabitacion(hab.idProducto);
    const totalConsumo = lineas.reduce((s, l) => s + l.cantidad * l.pUnitario, 0);
    return totalHabitacion + totalConsumo;
  }

  estanciaHabitacionFacturada(est: Estancia | null): boolean {
    if (!est) return false;
    return est.habitacionFacturada === true || Number(est.habitacionFacturada) === 1;
  }

  esEstanciaDeGrupo(est: Estancia | null): boolean {
    return !!est?.idGrupo;
  }

  chipGrupoEstancia(est: Estancia | null): string {
    if (!est?.idGrupo) return '';
    const nombre = est.grupoNombre || est.grupoCodigo || this.gruposActivos.find((g) => g.idGrupo === est.idGrupo)?.nombre || 'grupo';
    if (this.estanciaHabitacionFacturada(est)) return `Grupo ${nombre} · hospedaje ya facturado`;
    return `Grupo ${nombre} · hospedaje a cargo de la empresa`;
  }

  chipGrupoReserva(r: Reserva): string {
    if (!r.idGrupo) return '';
    return r.grupoCodigo || r.grupoNombre || 'Grupo';
  }

  tieneConsumoPendiente(hab: ProductoHabitacion): boolean {
    return this.getConsumoDeHabitacion(hab.idProducto).length > 0;
  }

  etiquetaBotonCheckout(hab: ProductoHabitacion): string {
    const est = this.getEstanciaActiva(hab.idProducto);
    if (!est) return 'Check-out';
    if (this.esEstanciaDeGrupo(est)) {
      return this.tieneConsumoPendiente(hab) ? 'Cobrar consumo' : 'Salida';
    }
    const habFact = this.estanciaHabitacionFacturada(est);
    const cons = this.tieneConsumoPendiente(hab);
    if (habFact && cons) return 'Facturar consumo';
    if (!habFact && !cons) return 'Check-out';
    if (!habFact && cons) return 'Facturar';
    return 'Check-out';
  }

  abrirModalAgregarConsumo(habitacion: ProductoHabitacion): void {
    if (!this.getEstanciaActiva(habitacion.idProducto)) {
      this.errorMessage.set('Debe hacer check-in antes de registrar consumo.');
      iziToast.warning({ title: 'Aviso', message: 'La habitación no tiene estancia activa.', position: 'topRight' });
      return;
    }
    this.habitacionConsumoSeleccionada = habitacion;
    this.formConsumo = { idProducto: '', cantidad: 1, pUnitario: 0 };
    this.productoSeleccionadoConsumo = null;
    this.errorMessage.set(null);
    this.productoService.obtenerProductosTodos().subscribe({
      next: (r) => {
        const data = (r as { data?: unknown[] }).data ?? [];
        this.productosParaConsumo = data
          .filter((p: unknown) => productoActivoParaVenta(p as Record<string, unknown>))
          .map((p: unknown) => this.mapearProductoParaConsumo(p));
        this.showModalConsumo.set(true);
      },
      error: () => { this.productosParaConsumo = []; this.showModalConsumo.set(true); }
    });
  }

  private mapearProductoParaConsumo(p: unknown): ProductoParaConsumo {
    const x = p as Record<string, unknown>;
    return {
      idProducto: (x['idProducto'] ?? '') as string,
      codigo: (x['codigo'] ?? '') as string,
      descripcion: (x['descripcion'] ?? '') as string,
      pVenta: (x['pVenta'] != null ? Number(x['pVenta']) : 0),
      codigoPresentacion: (x['codigoPresentacion'] ?? '') as string,
      descripcionPres: (x['descripcionPres'] ?? '') as string,
      categoria: (x['categoria'] ?? '') as string,
      sucursal: (x['sucursal'] ?? '') as string,
      stock: (x['stock'] != null ? Number(x['stock']) : undefined)
    };
  }

  cerrarModalConsumo(): void {
    this.showModalConsumo.set(false);
    this.habitacionConsumoSeleccionada = null;
    this.productoSeleccionadoConsumo = null;
  }

  abrirModalBuscarProductoConsumo(): void {
    this.searchTermProducto = '';
    this.productosFiltradosBusqueda = [...this.productosParaConsumo];
    this.showModalBuscarProducto.set(true);
  }

  cerrarModalBuscarProductoConsumo(): void {
    this.showModalBuscarProducto.set(false);
  }

  uMedidaColumnaConsumo(p: ProductoParaConsumo): string {
    return descripcionUnidadMedidaProducto(p as unknown as Record<string, unknown>);
  }

  buscarProductosConsumo(): void {
    const term = this.searchTermProducto.toLowerCase().trim();
    if (term === '') {
      this.productosFiltradosBusqueda = [...this.productosParaConsumo];
    } else {
      this.productosFiltradosBusqueda = this.productosParaConsumo.filter((item) => {
        const descripcion = (item.descripcion ?? '').toLowerCase();
        const codigo = (item.codigo ?? '').toLowerCase();
        const categoria = (item.categoria ?? '').toLowerCase();
        return descripcion.includes(term) || codigo.includes(term) || categoria.includes(term);
      });
    }
  }

  /** Recarga catálogo desde BD y reaplica el filtro del input (p. ej. producto recién creado). */
  recargarProductosConsumoDesdeServidor(): void {
    this.productoService.obtenerProductosTodos({ evitarCache: true }).subscribe({
      next: (r) => {
        const data = (r as { data?: unknown[] }).data ?? [];
        this.productosParaConsumo = data
          .filter((p: unknown) => productoActivoParaVenta(p as Record<string, unknown>))
          .map((p: unknown) => this.mapearProductoParaConsumo(p));
        this.buscarProductosConsumo();
      },
      error: () => {}
    });
  }

  seleccionarProductoConsumo(p: ProductoParaConsumo): void {
    this.formConsumo.idProducto = p.idProducto;
    this.formConsumo.pUnitario = p.pVenta ?? 0;
    this.formConsumo.cantidad = 1;
    this.productoSeleccionadoConsumo = p;
    this.cerrarModalBuscarProductoConsumo();
  }

  normalizarCantidadEnteraConsumo(valor: number): number {
    return Math.max(1, Math.round(Number(valor) || 1));
  }

  guardarConsumo(): void {
    this.formConsumo.cantidad = this.normalizarCantidadEnteraConsumo(this.formConsumo.cantidad);
    if (!this.habitacionConsumoSeleccionada || !this.formConsumo.idProducto || this.formConsumo.cantidad <= 0) {
      this.errorMessage.set('Seleccione producto y cantidad.');
      return;
    }
    this.guardandoConsumo = true;
    this.errorMessage.set(null);
    const prod = this.productosParaConsumo.find(p => p.idProducto === this.formConsumo.idProducto);
    const pUnitario = this.formConsumo.pUnitario > 0 ? this.formConsumo.pUnitario : (prod?.pVenta ?? 0);
    this.hotelService.agregarConsumo({
      idProductoHabitacion: this.habitacionConsumoSeleccionada.idProducto,
      idProducto: this.formConsumo.idProducto,
      cantidad: this.formConsumo.cantidad,
      pUnitario,
      fechaHoraCliente: fechaHoraClienteAhora()
    }).subscribe({
      next: () => {
        this.cargarConsumo();
        this.cerrarModalConsumo();
        this.guardandoConsumo = false;
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al agregar consumo');
        this.guardandoConsumo = false;
      }
    });
  }

  eliminarConsumoLinea(idConsumo: string): void {
    this.hotelService.eliminarConsumo(idConsumo).subscribe({
      next: () => this.cargarConsumo(),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Error al eliminar')
    });
  }

  abrirModalDetalle(hab: ProductoHabitacion): void {
    this.habitacionDetalleSeleccionada = hab;
    this.editandoConsumo = null;
    this.errorMessage.set(null);
    this.cargarProductosParaConsumoSiFalta();
    this.showModalDetalle.set(true);
  }

  cerrarModalDetalle(): void {
    this.showModalDetalle.set(false);
    this.habitacionDetalleSeleccionada = null;
    this.editandoConsumo = null;
  }

  private cargarProductosParaConsumoSiFalta(): void {
    if (this.productosParaConsumo.length > 0) return;
    this.productoService.obtenerProductosTodos().subscribe({
      next: (r) => {
        const data = (r as { data?: unknown[] }).data ?? [];
        this.productosParaConsumo = data
          .filter((p: unknown) => productoActivoParaVenta(p as Record<string, unknown>))
          .map((p: unknown) => this.mapearProductoParaConsumo(p));
      },
      error: () => {}
    });
  }

  limpiarTarjeta(hab: ProductoHabitacion): void {
    if (!confirm('¿Limpiar todo el consumo de esta habitación?')) return;
    this.hotelService.limpiarConsumoHabitacion(hab.idProducto).subscribe({
      next: () => { this.cargarConsumo(); this.cerrarModalDetalle(); },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Error al limpiar')
    });
  }

  anularHuesped(reserva: Reserva): void {
    this.cancelarReserva(reserva);
  }

  cancelarReserva(reserva: Reserva): void {
    if (!confirm('¿Cancelar esta reserva?')) return;
    this.hotelService.cancelarReserva(reserva.idReserva).subscribe({
      next: () => { this.cargarDatos(); this.cerrarModalDetalle(); },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Error al cancelar')
    });
  }

  iniciarEditarConsumo(lin: ConsumoHabitacionLinea): void {
    this.editandoConsumo = lin;
    this.formEditConsumo = {
      cantidad: this.normalizarCantidadEnteraConsumo(lin.cantidad),
      pUnitario: lin.pUnitario
    };
  }

  cancelarEditarConsumo(): void {
    this.editandoConsumo = null;
  }

  guardarEditarConsumo(): void {
    this.formEditConsumo.cantidad = this.normalizarCantidadEnteraConsumo(this.formEditConsumo.cantidad);
    if (!this.editandoConsumo || this.formEditConsumo.cantidad <= 0) return;
    this.guardandoEditConsumo = true;
    this.hotelService.actualizarConsumo(this.editandoConsumo.idConsumo, {
      cantidad: this.formEditConsumo.cantidad,
      pUnitario: this.formEditConsumo.pUnitario
    }).subscribe({
      next: () => { this.cargarConsumo(); this.cancelarEditarConsumo(); this.guardandoEditConsumo = false; },
      error: (err) => { this.errorMessage.set(err?.error?.message || 'Error'); this.guardandoEditConsumo = false; }
    });
  }

  agregarConsumoDesdeDetalle(): void {
    if (!this.habitacionDetalleSeleccionada) return;
    this.habitacionConsumoSeleccionada = this.habitacionDetalleSeleccionada;
    this.formConsumo = { idProducto: '', cantidad: 1, pUnitario: 0 };
    this.productoSeleccionadoConsumo = null;
    this.showModalConsumo.set(true);
  }

  cerrarModalConsumoYRecargarDetalle(): void {
    this.cerrarModalConsumo();
    this.cargarConsumo();
  }

  abrirFacturacionEstancia(habitacion: ProductoHabitacion): void {
    const est = this.getEstanciaActiva(habitacion.idProducto);
    if (!est) {
      iziToast.warning({ title: 'Aviso', message: 'No hay estancia activa para facturar.', position: 'topRight' });
      return;
    }
    if (this.esEstanciaDeGrupo(est)) {
      if (this.tieneConsumoPendiente(habitacion)) {
        this.generarVenta(habitacion, 'consumo');
        return;
      }
      this.confirmarSalidaOperativa(habitacion, est);
      return;
    }
    const habFact = this.estanciaHabitacionFacturada(est);
    const cons = this.tieneConsumoPendiente(habitacion);
    if (habFact && !cons) {
      iziToast.info({ title: 'Hotel', message: 'No queda saldo pendiente. Recargue la lista de habitaciones.', position: 'topRight' });
      this.cargarDatos();
      return;
    }
    if (habFact && cons) {
      this.generarVenta(habitacion, 'consumo');
      return;
    }
    if (!habFact && !cons) {
      this.generarVenta(habitacion, 'habitacion');
      return;
    }
    this.habitacionFacturarSeleccionada = habitacion;
    this.facturarPendienteHabitacion = !habFact;
    this.facturarPendienteConsumo = cons;
    this.showModalFacturarEstancia.set(true);
  }

  confirmarSalidaOperativa(habitacion: ProductoHabitacion, est: Estancia): void {
    const chip = this.chipGrupoEstancia(est);
    if (!confirm(`¿Liberar ${habitacion.codigo}? ${chip || 'El hospedaje queda a cargo del grupo.'}`)) return;
    this.hotelService.salidaOperativaEstancia(est.idEstancia, fechaHoraClienteAhora()).subscribe({
      next: (res) => {
        iziToast.success({ title: 'Hotel', message: res.data?.message || 'Habitación liberada.', position: 'topRight' });
        this.cargarDatos();
        this.cargarHousekeeping();
        this.cargarCalendario();
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo registrar la salida.', position: 'topRight' });
      }
    });
  }

  cerrarModalFacturarEstancia(): void {
    this.showModalFacturarEstancia.set(false);
    this.habitacionFacturarSeleccionada = null;
  }

  elegirModoFacturacion(modo: 'todo' | 'habitacion' | 'consumo'): void {
    const hab = this.habitacionFacturarSeleccionada;
    this.cerrarModalFacturarEstancia();
    if (hab) this.generarVenta(hab, modo);
  }

  abrirModalCambiarSalida(habitacion: ProductoHabitacion): void {
    const est = this.getEstanciaActiva(habitacion.idProducto);
    if (!est) {
      iziToast.warning({ title: 'Aviso', message: 'No hay estancia activa.', position: 'topRight' });
      return;
    }
    this.habitacionCambiarSalida = habitacion;
    this.formCambiarSalida = {
      fechaSalida: String(est.checkOutPrevisto || '').slice(0, 10),
      tarifaNoche: Number(est.tarifaNoche) || 0
    };
    this.guardandoCambiarSalida = false;
    this.errorMessage.set(null);
    this.showModalCambiarSalida.set(true);
  }

  cerrarModalCambiarSalida(): void {
    this.showModalCambiarSalida.set(false);
    this.habitacionCambiarSalida = null;
    this.guardandoCambiarSalida = false;
  }

  fechaSalidaMinEstancia(est: Estancia): string {
    const entrada = String(est.checkIn || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada)) return this.sumarDiasLocal(getFechaHoyLocal(), 1);
    return this.sumarDiasLocal(entrada, 1);
  }

  nochesCambioSalida(est: Estancia): number {
    return calcularNochesEstadia(String(est.checkIn || '').slice(0, 10), this.formCambiarSalida.fechaSalida);
  }

  totalCambioSalida(est: Estancia): number {
    const noches = this.nochesCambioSalida(est);
    const tarifa = Number(est.tarifaNoche) || 0;
    return Math.round(tarifa * noches * 100) / 100;
  }

  detalleCambioSalida(est: Estancia): string {
    const noches = this.nochesCambioSalida(est);
    if (noches < 1) return 'La salida debe ser al menos el día siguiente al check-in.';
    const total = this.totalCambioSalida(est);
    return `${noches} noche(s) · Nuevo total habitación: ${this.formatearMoneda(total)} (antes ${this.formatearMoneda(Number(est.totalHabitacion) || 0)}).`;
  }

  puedeGuardarCambioSalida(): boolean {
    const hab = this.habitacionCambiarSalida;
    if (!hab) return false;
    const est = this.getEstanciaActiva(hab.idProducto);
    if (!est || this.estanciaHabitacionFacturada(est)) return false;
    return this.nochesCambioSalida(est) >= 1;
  }

  guardarCambioSalida(): void {
    const hab = this.habitacionCambiarSalida;
    const est = hab ? this.getEstanciaActiva(hab.idProducto) : null;
    if (!hab || !est) return;
    if (this.estanciaHabitacionFacturada(est)) {
      iziToast.warning({
        title: 'Hotel',
        message: 'La tarifa ya fue facturada. No se pueden cambiar las noches.',
        position: 'topRight'
      });
      return;
    }
    if (!this.puedeGuardarCambioSalida()) return;
    this.guardandoCambiarSalida = true;
    this.errorMessage.set(null);
    this.hotelService.cambiarSalidaEstancia(est.idEstancia, this.formCambiarSalida.fechaSalida).subscribe({
      next: () => {
        this.guardandoCambiarSalida = false;
        this.cerrarModalCambiarSalida();
        this.cargarDatos();
        iziToast.success({ title: 'OK', message: 'Estadía actualizada.', position: 'topRight' });
      },
      error: (err: { error?: { message?: string } }) => {
        this.guardandoCambiarSalida = false;
        this.errorMessage.set(err?.error?.message || 'No se pudo cambiar la salida.');
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo cambiar la salida.', position: 'topRight' });
      }
    });
  }

  abrirModalMoverHabitacion(habitacion: ProductoHabitacion): void {
    const est = this.getEstanciaActiva(habitacion.idProducto);
    if (!est) {
      iziToast.warning({ title: 'Aviso', message: 'No hay estancia activa.', position: 'topRight' });
      return;
    }
    this.habitacionMoverOrigen = habitacion;
    this.idHabitacionDestinoMover = '';
    this.guardandoMoverHabitacion = false;
    this.errorMessage.set(null);
    this.showModalMoverHabitacion.set(true);
  }

  cerrarModalMoverHabitacion(): void {
    this.showModalMoverHabitacion.set(false);
    this.habitacionMoverOrigen = null;
    this.idHabitacionDestinoMover = '';
    this.guardandoMoverHabitacion = false;
  }

  habitacionesDestinoMover(): ProductoHabitacion[] {
    const origen = this.habitacionMoverOrigen;
    if (!origen) return [];
    return this.productosHabitacion.filter((h) => {
      if (this.mismoIdProducto(h.idProducto, origen.idProducto)) return false;
      if (this.getEstanciaActiva(h.idProducto)) return false;
      const limp = this.getEstadoLimpieza(h.idProducto);
      return limp !== 'sucia' && limp !== 'fuera_servicio';
    });
  }

  guardarMoverHabitacion(): void {
    const origen = this.habitacionMoverOrigen;
    const est = origen ? this.getEstanciaActiva(origen.idProducto) : null;
    if (!origen || !est || !this.idHabitacionDestinoMover) return;
    this.guardandoMoverHabitacion = true;
    this.errorMessage.set(null);
    this.hotelService.moverEstancia(est.idEstancia, this.idHabitacionDestinoMover).subscribe({
      next: () => {
        this.guardandoMoverHabitacion = false;
        this.cerrarModalMoverHabitacion();
        this.cargarDatos();
        this.cargarHousekeeping();
        this.cargarConsumo();
        iziToast.success({ title: 'OK', message: 'Huésped trasladado. La habitación anterior quedó sucia.', position: 'topRight' });
      },
      error: (err: { error?: { message?: string } }) => {
        this.guardandoMoverHabitacion = false;
        this.errorMessage.set(err?.error?.message || 'No se pudo mover la estancia.');
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo mover la estancia.', position: 'topRight' });
      }
    });
  }

  abrirModalFolio(habitacion: ProductoHabitacion): void {
    const est = this.getEstanciaActiva(habitacion.idProducto);
    if (!est) {
      iziToast.warning({ title: 'Aviso', message: 'No hay estancia activa.', position: 'topRight' });
      return;
    }
    this.habitacionFolio = habitacion;
    this.folioData = null;
    this.formFolioAnticipo = { monto: 0, concepto: 'Seña / anticipo' };
    this.errorMessage.set(null);
    this.showModalFolio.set(true);
    this.cargarFolio(est.idEstancia);
  }

  cerrarModalFolio(): void {
    this.showModalFolio.set(false);
    this.habitacionFolio = null;
    this.folioData = null;
    this.folioLoading = false;
  }

  cargarFolio(idEstancia: string): void {
    this.folioLoading = true;
    this.hotelService.getFolioEstancia(idEstancia).subscribe({
      next: (res) => {
        this.folioData = res.data ?? null;
        this.folioLoading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.folioLoading = false;
        this.folioData = null;
        this.errorMessage.set(err?.error?.message || 'No se pudo cargar el folio.');
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo cargar el folio.', position: 'topRight' });
      }
    });
  }

  etiquetaTipoFolio(doc: HotelFolioDocumento): string {
    if (doc.tipo === 'nota_credito') return 'Nota de crédito';
    if (doc.tipo === 'nota_debito') return 'Nota de débito';
    return doc.codigoComprobante || 'Comprobante';
  }

  guardarAnticipoFolio(): void {
    const folio = this.folioData;
    const hab = this.habitacionFolio;
    const est = hab ? this.getEstanciaActiva(hab.idProducto) : null;
    if (!folio || !est || !(Number(this.formFolioAnticipo.monto) > 0)) {
      iziToast.warning({ title: 'Aviso', message: 'Indique un monto válido.', position: 'topRight' });
      return;
    }
    this.guardandoFolioAnticipo = true;
    this.hotelService.registrarAnticipo({
      idEstancia: est.idEstancia,
      idReserva: est.idReserva ?? undefined,
      monto: Number(this.formFolioAnticipo.monto),
      concepto: this.formFolioAnticipo.concepto
    }).subscribe({
      next: () => {
        this.guardandoFolioAnticipo = false;
        this.formFolioAnticipo = { monto: 0, concepto: 'Seña / anticipo' };
        iziToast.success({ title: 'OK', message: 'Anticipo registrado.', position: 'topRight' });
        this.cargarFolio(est.idEstancia);
      },
      error: (err: { error?: { message?: string } }) => {
        this.guardandoFolioAnticipo = false;
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo registrar el anticipo.', position: 'topRight' });
      }
    });
  }

  anularAnticipoFolio(a: HotelAnticipo): void {
    const folio = this.folioData;
    if (a.estado !== 'pendiente' || !folio) return;
    if (!confirm('¿Anular este anticipo?')) return;
    this.hotelService.anularAnticipo(a.idAnticipo).subscribe({
      next: () => {
        iziToast.success({ title: 'OK', message: 'Anticipo anulado.', position: 'topRight' });
        this.cargarFolio(folio.idEstancia);
      },
      error: (err: { error?: { message?: string } }) => {
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo anular', position: 'topRight' });
      }
    });
  }

  facturarDesdeFolio(): void {
    const hab = this.habitacionFolio;
    this.cerrarModalFolio();
    if (hab) this.abrirFacturacionEstancia(hab);
  }

  irACobrarCredito(): void {
    this.cerrarModalFolio();
    this.router.navigate(['/caja/ventas-pendientes-pago']);
  }

  generarVenta(habitacion: ProductoHabitacion, modo: 'todo' | 'habitacion' | 'consumo' = 'todo'): void {
    const est = this.getEstanciaActiva(habitacion.idProducto);
    if (!est) {
      iziToast.warning({ title: 'Aviso', message: 'No hay estancia activa para hacer check-out.', position: 'topRight' });
      return;
    }
    this.hotelService.checkOutPreload(est.idEstancia).subscribe({
      next: (res) => {
        const data = res.data;
        if (!data) {
          iziToast.warning({ title: 'Aviso', message: 'No se obtuvo el detalle de check-out.', position: 'topRight' });
          return;
        }
        let lineas: CheckOutPreloadLinea[] = data.lineas ?? [];
        if (modo === 'habitacion') {
          lineas = lineas.filter((l) => l.tipo === 'habitacion' || l.tipo === 'recargo' || (!l.tipo && l.idProducto === data.idProductoHabitacion));
        } else if (modo === 'consumo') {
          lineas = lineas.filter((l) => l.tipo === 'consumo' || !!l.idConsumo);
        }
        if (!lineas.length) {
          iziToast.warning({ title: 'Aviso', message: 'No hay ítems pendientes para ese tipo de factura.', position: 'topRight' });
          return;
        }
        this.preloadVenta.setPreload({
          idEstancia: data.idEstancia ?? est.idEstancia,
          idProductoHabitacion: data.idProductoHabitacion,
          habitacionCodigo: data.habitacionCodigo,
          habitacionDescripcion: data.habitacionDescripcion,
          idCliente: data.idCliente ?? null,
          nombreHuesped: data.nombreHuesped ?? est.nombreHuesped ?? '',
          idReserva: data.idReserva ?? null,
          lineas
        });
        if (modo !== 'consumo' && data.anticiposTotal && data.anticiposTotal > 0) {
          iziToast.info({
            title: 'Anticipos',
            message: `Se descontaron S/ ${Number(data.anticiposTotal).toFixed(2)} de anticipos en el total de habitación.`,
            position: 'topRight'
          });
        }
        this.router.navigate(['/ventas/create']);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error en check-out');
        iziToast.error({ title: 'Error', message: err?.error?.message || 'Error en check-out', position: 'topRight' });
      }
    });
  }

  getPrecioNocheHabitacion(idProducto: string): number {
    const hab = this.productosHabitacion.find((p) => this.mismoIdProducto(p.idProducto, idProducto));
    return Number(hab?.pVenta) || 0;
  }

  get nochesFormReserva(): number {
    return calcularNochesEstadia(this.formReserva.fechaEntrada, this.formReserva.fechaSalida);
  }

  get detalleCalculoTotalReserva(): string {
    const hab = this.productosHabitacion.find((p) =>
      this.mismoIdProducto(p.idProducto, this.formReserva.idProductoHabitacion)
    );
    const precioNoche = Number(hab?.pVenta) || 0;
    const noches = this.nochesFormReserva;
    if (!this.formReserva.idProductoHabitacion) {
      return 'Seleccione habitación y fechas para calcular el total.';
    }
    if (precioNoche <= 0) {
      return 'La habitación no tiene precio de venta en la lista principal. Asigne precio en Productos → Precios.';
    }
    if (noches <= 0) {
      return 'La fecha de salida debe ser posterior a la de entrada.';
    }
    return `${noches} noche(s) × S/ ${precioNoche.toFixed(2)} = S/ ${(noches * precioNoche).toFixed(2)}`;
  }

  recalcularTotalEstimadoReserva(): void {
    if (this.totalReservaEditadoManual) return;
    const precioNoche = this.getPrecioNocheHabitacion(this.formReserva.idProductoHabitacion);
    const noches = this.nochesFormReserva;
    if (precioNoche > 0 && noches > 0) {
      this.formReserva.total = Math.round(precioNoche * noches * 100) / 100;
    }
  }

  onCambioDatosReserva(): void {
    this.recalcularTotalEstimadoReserva();
  }

  onTotalReservaManual(): void {
    this.totalReservaEditadoManual = true;
  }

  abrirModalNuevaReserva(opciones?: { idProductoHabitacion?: string; checkInHoy?: boolean }): void {
    this.errorMessage.set(null);
    this.reservaEditando = null;
    this.totalReservaEditadoManual = false;
    this.idDocumentoHuesped = this.ID_DOC_DNI;
    this.numeroDocumentoHuesped = '';
    this.formReserva = {
      idProductoHabitacion: opciones?.idProductoHabitacion ?? '',
      idCliente: null,
      nombreHuesped: '',
      fechaEntrada: opciones?.checkInHoy ? getFechaHoyLocal() : '',
      fechaSalida: '',
      total: 0,
      codigo: ''
    };
    this.hotelService.siguienteCodigoReserva().subscribe({
      next: (res) => {
        this.formReserva.codigo = res.data?.codigo ?? '';
        this.recalcularTotalEstimadoReserva();
      }
    });
    this.showModalReserva.set(true);
  }

  abrirModalGrupo(): void {
    this.errorMessage.set(null);
    this.idDocumentoHuesped = this.ID_DOC_RUC;
    this.numeroDocumentoHuesped = '';
    this.formGrupo = {
      idCliente: null,
      nombre: '',
      fechaEntrada: getFechaHoyLocal(),
      fechaSalida: '',
      idsProductoHabitacion: []
    };
    this.showModalGrupo.set(true);
  }

  cerrarModalGrupo(): void {
    this.showModalGrupo.set(false);
  }

  get nochesFormGrupo(): number {
    return calcularNochesEstadia(this.formGrupo.fechaEntrada, this.formGrupo.fechaSalida);
  }

  get totalEstimadoGrupo(): number {
    const noches = this.nochesFormGrupo;
    if (noches <= 0) return 0;
    return this.formGrupo.idsProductoHabitacion.reduce((s, id) => {
      const p = this.getPrecioNocheHabitacion(id);
      return s + p * noches;
    }, 0);
  }

  habitacionLibreParaGrupo(idProducto: string): boolean {
    const entrada = this.formGrupo.fechaEntrada;
    const salida = this.formGrupo.fechaSalida;
    if (!entrada || !salida || this.nochesFormGrupo <= 0) return true;
    const solapaReserva = this.reservas.some((r) =>
      this.mismoIdProducto(r.idProductoHabitacion, idProducto)
      && this.reservaEsConfirmada(r)
      && r.fechaEntrada < salida
      && r.fechaSalida > entrada
    );
    if (solapaReserva) return false;
    const solapaEstancia = this.estanciasActivas.some((e) => {
      if (!this.mismoIdProducto(e.idProductoHabitacion, idProducto)) return false;
      const ini = String(e.checkIn || '').slice(0, 10);
      const fin = String(e.checkOutPrevisto || '').slice(0, 10);
      return ini < salida && fin > entrada;
    });
    return !solapaEstancia;
  }

  toggleHabitacionGrupo(idProducto: string): void {
    if (!this.habitacionLibreParaGrupo(idProducto)) return;
    const i = this.formGrupo.idsProductoHabitacion.indexOf(idProducto);
    if (i >= 0) this.formGrupo.idsProductoHabitacion.splice(i, 1);
    else this.formGrupo.idsProductoHabitacion = [...this.formGrupo.idsProductoHabitacion, idProducto];
  }

  habitacionSeleccionadaGrupo(idProducto: string): boolean {
    return this.formGrupo.idsProductoHabitacion.some((id) => this.mismoIdProducto(id, idProducto));
  }

  guardarGrupo(): void {
    if (!this.formGrupo.idCliente || !this.formGrupo.nombre?.trim()) {
      this.errorMessage.set('Indique el cliente (empresa) del grupo.');
      return;
    }
    if (!this.formGrupo.fechaEntrada || !this.formGrupo.fechaSalida || this.nochesFormGrupo <= 0) {
      this.errorMessage.set('La fecha de salida debe ser posterior a la de entrada.');
      return;
    }
    if (this.formGrupo.idsProductoHabitacion.length < 2) {
      this.errorMessage.set('Seleccione al menos 2 habitaciones.');
      return;
    }
    this.guardandoGrupo = true;
    this.errorMessage.set(null);
    this.hotelService.crearGrupo({
      idCliente: this.formGrupo.idCliente,
      nombre: this.formGrupo.nombre.trim(),
      fechaEntrada: this.formGrupo.fechaEntrada,
      fechaSalida: this.formGrupo.fechaSalida,
      idsProductoHabitacion: this.formGrupo.idsProductoHabitacion,
      fechaHoraCliente: fechaHoraClienteAhora()
    }).subscribe({
      next: (res) => {
        this.guardandoGrupo = false;
        this.cerrarModalGrupo();
        iziToast.success({
          title: 'Grupo',
          message: `Reservas creadas: ${res.data?.codigo || ''} (${res.data?.habitaciones?.length || 0} habitaciones).`,
          position: 'topRight'
        });
        this.cargarDatos();
        this.cargarCalendario();
        if (res.data) this.abrirPanelGrupo(res.data);
      },
      error: (err) => {
        this.guardandoGrupo = false;
        this.errorMessage.set(err?.error?.message || 'No se pudo crear el grupo.');
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo crear el grupo.', position: 'topRight' });
      }
    });
  }

  abrirPanelGrupo(grupo: HotelGrupo | HotelGrupoDetalle): void {
    this.showPanelGrupo.set(true);
    this.grupoDetalleLoading = true;
    this.grupoDetalle = 'habitaciones' in grupo ? grupo : { ...grupo, habitaciones: [] };
    this.hotelService.obtenerGrupo(grupo.idGrupo).subscribe({
      next: (res) => {
        this.grupoDetalle = res.data;
        this.grupoDetalleLoading = false;
      },
      error: (err) => {
        this.grupoDetalleLoading = false;
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo cargar el grupo.', position: 'topRight' });
      }
    });
  }

  cerrarPanelGrupo(): void {
    this.showPanelGrupo.set(false);
    this.grupoDetalle = null;
  }

  facturarHospedajeGrupo(): void {
    const g = this.grupoDetalle;
    if (!g) return;
    if (g.hospedajeFacturado === true || Number(g.hospedajeFacturado) === 1) {
      iziToast.info({ title: 'Grupo', message: 'El hospedaje de este grupo ya está facturado.', position: 'topRight' });
      return;
    }
    this.facturandoGrupo = true;
    this.hotelService.facturarHospedajeGrupo(g.idGrupo).subscribe({
      next: (res) => {
        this.facturandoGrupo = false;
        const data = res.data;
        if (!data?.lineas?.length) {
          iziToast.warning({ title: 'Grupo', message: 'No hay hospedaje pendiente.', position: 'topRight' });
          return;
        }
        this.preloadVenta.setPreload({
          idGrupo: data.idGrupo,
          idProductoHabitacion: data.lineas[0].idProducto,
          habitacionCodigo: data.codigo,
          habitacionDescripcion: data.nombre,
          idCliente: data.idCliente ?? null,
          nombreHuesped: data.nombreHuesped || data.nombre,
          lineas: data.lineas
        });
        this.cerrarPanelGrupo();
        this.router.navigate(['/ventas/create']);
      },
      error: (err) => {
        this.facturandoGrupo = false;
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo preparar la factura.', position: 'topRight' });
      }
    });
  }

  checkInDesdePanelGrupo(idReserva: string): void {
    const res = this.reservas.find((r) => r.idReserva === idReserva);
    if (res) {
      this.cerrarPanelGrupo();
      this.abrirModalCheckInDesdeReserva(res);
    }
  }

  abrirModalEditarReserva(reserva: Reserva): void {
    if (!this.reservaEsConfirmada(reserva)) {
      iziToast.warning({ title: 'Reserva', message: 'Solo se pueden editar reservas confirmadas.', position: 'topRight' });
      return;
    }
    this.errorMessage.set(null);
    this.reservaEditando = reserva;
    this.totalReservaEditadoManual = true;
    this.idDocumentoHuesped = this.ID_DOC_DNI;
    this.numeroDocumentoHuesped = '';
    this.formReserva = {
      idProductoHabitacion: reserva.idProductoHabitacion,
      idCliente: reserva.idCliente,
      nombreHuesped: reserva.nombreHuesped,
      fechaEntrada: String(reserva.fechaEntrada).slice(0, 10),
      fechaSalida: String(reserva.fechaSalida).slice(0, 10),
      total: Number(reserva.total) || 0,
      codigo: reserva.codigo
    };
    this.showModalReserva.set(true);
  }

  abrirModalCheckInWalkIn(hab: ProductoHabitacion): void {
    if (!this.validarCheckInHousekeeping(hab)) return;
    this.reservaCheckInSeleccionada = null;
    this.habitacionCheckInSeleccionada = hab;
    const tarifa = this.getPrecioNocheHabitacion(hab.idProducto);
    const salidaMinima = this.sumarDiasLocal(getFechaHoyLocal(), 1);
    this.formCheckIn = {
      idProductoHabitacion: hab.idProducto,
      idCliente: null,
      nombreHuesped: '',
      fechaSalida: salidaMinima,
      tarifaNoche: tarifa,
      totalHabitacion: 0
    };
    this.recalcularTotalCheckIn();
    this.idDocumentoHuesped = this.ID_DOC_DNI;
    this.numeroDocumentoHuesped = '';
    this.errorMessage.set(null);
    this.showModalCheckIn.set(true);
  }

  abrirModalCheckInDesdeReserva(reserva: Reserva): void {
    const hab = this.productosHabitacion.find((p) => this.mismoIdProducto(p.idProducto, reserva.idProductoHabitacion));
    if (!hab) {
      iziToast.warning({
        title: 'Check-in',
        message: 'La habitación de la reserva no es válida (debe ser categoría Habitación).',
        position: 'topRight'
      });
      return;
    }
    if (!this.validarCheckInHousekeeping(hab)) return;
    this.reservaCheckInSeleccionada = reserva;
    this.habitacionCheckInSeleccionada = null;
    this.formCheckIn = {
      idProductoHabitacion: reserva.idProductoHabitacion,
      idCliente: reserva.idCliente,
      nombreHuesped: reserva.nombreHuesped,
      fechaSalida: reserva.fechaSalida,
      tarifaNoche: 0,
      totalHabitacion: reserva.total
    };
    this.errorMessage.set(null);
    this.showModalCheckIn.set(true);
  }

  cerrarModalCheckIn(): void {
    this.showModalCheckIn.set(false);
    this.habitacionCheckInSeleccionada = null;
    this.reservaCheckInSeleccionada = null;
  }

  recalcularTotalCheckIn(): void {
    const salida = this.formCheckIn.fechaSalida;
    if (!salida) return;
    const hoy = getFechaHoyLocal();
    const noches = calcularNochesEstadia(hoy, salida);
    const tarifa = Number(this.formCheckIn.tarifaNoche) || 0;
    if (noches > 0 && tarifa > 0) {
      this.formCheckIn.totalHabitacion = Math.round(tarifa * noches * 100) / 100;
    }
  }

  /** Walk-in: ingreso hoy; salida mínima mañana (1 noche). */
  fechaHoyCheckInWalkIn(): string {
    return getFechaHoyLocal();
  }

  fechaSalidaMinWalkIn(): string {
    return this.sumarDiasLocal(getFechaHoyLocal(), 1);
  }

  nochesEstadiaCheckIn(): number {
    if (!this.formCheckIn.fechaSalida) return 0;
    return calcularNochesEstadia(getFechaHoyLocal(), this.formCheckIn.fechaSalida);
  }

  ejecutarCheckIn(): void {
    if (!this.formCheckIn.nombreHuesped?.trim() || !this.formCheckIn.fechaSalida) {
      this.errorMessage.set('Complete huésped y fecha de salida.');
      return;
    }
    if (!this.reservaCheckInSeleccionada) {
      const noches = this.nochesEstadiaCheckIn();
      if (noches < 1) {
        this.errorMessage.set('La salida debe ser al menos mañana (1 noche: ingreso hoy).');
        return;
      }
    }
    if (this.reservaCheckInSeleccionada) {
      this.recalcularTotalCheckIn();
    } else {
      this.recalcularTotalCheckIn();
    }
    this.guardandoCheckIn = true;
    this.errorMessage.set(null);

    const horaCliente = fechaHoraClienteAhora();

    if (this.reservaCheckInSeleccionada) {
      this.hotelService.checkInDesdeReserva(this.reservaCheckInSeleccionada.idReserva, {
        fechaHoraCliente: horaCliente
      }).subscribe({
        next: () => {
          this.guardandoCheckIn = false;
          this.cerrarModalCheckIn();
          this.cargarDatos();
          this.cargarHousekeeping();
          iziToast.success({ title: 'OK', message: 'Check-in realizado.', position: 'topRight' });
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.message || 'Error en check-in');
          this.guardandoCheckIn = false;
        }
      });
      return;
    }

    this.hotelService.checkInWalkIn({
      idProductoHabitacion: this.formCheckIn.idProductoHabitacion,
      idCliente: this.formCheckIn.idCliente ?? undefined,
      nombreHuesped: this.formCheckIn.nombreHuesped.trim(),
      fechaSalida: this.formCheckIn.fechaSalida,
      tarifaNoche: this.formCheckIn.tarifaNoche,
      totalHabitacion: this.formCheckIn.totalHabitacion,
      pVenta: this.formCheckIn.tarifaNoche,
      fechaHoraCliente: horaCliente
    }).subscribe({
      next: () => {
        this.guardandoCheckIn = false;
        this.cerrarModalCheckIn();
        this.cargarDatos();
        this.cargarHousekeeping();
        iziToast.success({ title: 'OK', message: 'Check-in walk-in realizado.', position: 'topRight' });
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error en check-in');
        this.guardandoCheckIn = false;
      }
    });
  }

  /** @deprecated use abrirModalCheckInWalkIn */
  abrirModalCheckIn(hab: ProductoHabitacion): void {
    this.abrirModalCheckInWalkIn(hab);
  }

  cerrarModalReserva(): void {
    this.showModalReserva.set(false);
    this.reservaEditando = null;
    this.totalReservaEditadoManual = false;
  }

  /** Busca huésped por DNI/RUC; si no existe en BD abre registro de cliente (igual que nueva venta). */
  buscarORegistrarClienteReserva(): void {
    const digitos = this.normalizarDigitosDocumento(this.numeroDocumentoHuesped);
    if (!digitos) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese el número de documento (RUC o DNI).', position: 'topRight' });
      return;
    }
    const inferido = this.inferirIdDocumentoPorDigitos(digitos);
    if (inferido == null) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 8 dígitos (DNI) u 11 dígitos (RUC).', position: 'topRight' });
      return;
    }
    this.idDocumentoHuesped = inferido;
    this.numeroDocumentoHuesped = digitos;

    this.clienteBuscando = true;
    this.clienteService.obtener_cliente_ruc(digitos).subscribe({
      next: (response) => {
        if (response.data != null && response.data.length > 0) {
          this.aplicarClienteReservaDesdeBd(response.data[0]);
          this.clienteBuscando = false;
          iziToast.success({ title: 'OK', message: 'Cliente encontrado en base de datos.', position: 'topRight' });
        } else {
          this.clienteBuscando = false;
          this.crearClientePreSerial += 1;
          this.showModalCrearCliente.set(true);
        }
      },
      error: () => {
        this.clienteBuscando = false;
        iziToast.error({ title: 'Error', message: 'Error al consultar en base de datos.', position: 'topRight' });
      }
    });
  }

  onClienteCreadoDesdeModalReserva(event: Record<string, unknown>): void {
    this.showModalCrearCliente.set(false);
    const numero = (event?.['ruc'] ?? this.numeroDocumentoHuesped ?? '').toString().trim();
    if (!numero) return;
    this.clienteBuscando = true;
    this.clienteService.obtener_cliente_ruc(numero).subscribe({
      next: (response) => {
        this.clienteBuscando = false;
        if (response?.data != null && response.data.length > 0) {
          this.aplicarClienteReservaDesdeBd(response.data[0]);
          iziToast.success({ title: 'OK', message: 'Cliente registrado y cargado.', position: 'topRight' });
        } else {
          this.aplicarClienteDesdeEventoCreado(event, numero);
        }
      },
      error: () => {
        this.clienteBuscando = false;
        this.aplicarClienteDesdeEventoCreado(event, numero);
      }
    });
  }

  cerrarModalCrearCliente(): void {
    this.showModalCrearCliente.set(false);
  }

  private aplicarClienteReservaDesdeBd(row: Record<string, unknown>): void {
    const nombre = (
      row['rSocial'] ?? row['r_Social'] ?? row['rsocial'] ?? row['razonSocial'] ?? row['RazonSocial'] ?? ''
    ).toString().trim();
    const idCliente = row['idCliente'] != null ? Number(row['idCliente']) : null;
    if (this.showModalCheckIn()) {
      this.formCheckIn.idCliente = idCliente;
      this.formCheckIn.nombreHuesped = nombre;
    } else if (this.showModalGrupo()) {
      this.formGrupo.idCliente = idCliente;
      this.formGrupo.nombre = nombre;
    } else {
      this.formReserva.idCliente = idCliente;
      this.formReserva.nombreHuesped = nombre;
    }
    this.numeroDocumentoHuesped = (row['ruc'] ?? '').toString();
    this.idDocumentoHuesped = (row['idDocumento'] ?? this.idDocumentoHuesped).toString();
  }

  private normalizarDigitosDocumento(raw: string): string {
    return (raw ?? '').toString().replace(/\D/g, '');
  }

  private inferirIdDocumentoPorDigitos(digitos: string): string | null {
    if (digitos.length === 11) return this.ID_DOC_RUC;
    if (digitos.length === 8) return this.ID_DOC_DNI;
    return null;
  }

  abrirModalCliente(): void {
    this.showModalCliente.set(true);
  }

  cerrarModalCliente(): void {
    this.showModalCliente.set(false);
  }

  /** Llamado al elegir cliente en el modal (mismo flujo que crear nueva venta). */
  onClienteElegidoReserva(event: { idCliente?: number; rSocial?: string; ruc?: string; idDocumento?: string; [key: string]: unknown }): void {
    const e = event || {};
    const nombre = (e['rSocial'] ?? e['r_Social'] ?? e['rsocial'] ?? e['razonSocial'] ?? e['RazonSocial'] ?? '').toString().trim();
    const idCliente = e.idCliente != null ? Number(e.idCliente) : null;
    if (this.showModalCheckIn()) {
      this.formCheckIn.idCliente = idCliente;
      this.formCheckIn.nombreHuesped = nombre || '';
    } else if (this.showModalGrupo()) {
      this.formGrupo.idCliente = idCliente;
      this.formGrupo.nombre = nombre || '';
    } else {
      this.formReserva.idCliente = idCliente;
      this.formReserva.nombreHuesped = nombre || '';
    }
    if (e.ruc) this.numeroDocumentoHuesped = String(e.ruc).trim();
    if (e.idDocumento != null) this.idDocumentoHuesped = String(e.idDocumento);
    this.cerrarModalCliente();
  }

  private aplicarClienteDesdeEventoCreado(event: Record<string, unknown>, numero: string): void {
    const idCliente = event?.['idCliente'] != null ? Number(event['idCliente']) : null;
    const nombre = (event?.['rSocial'] ?? event?.['r_Social'] ?? '').toString().trim();
    if (this.showModalCheckIn()) {
      this.formCheckIn.idCliente = idCliente;
      this.formCheckIn.nombreHuesped = nombre;
    } else if (this.showModalGrupo()) {
      this.formGrupo.idCliente = idCliente;
      this.formGrupo.nombre = nombre;
    } else {
      this.formReserva.idCliente = idCliente;
      this.formReserva.nombreHuesped = nombre;
    }
    this.numeroDocumentoHuesped = numero;
    this.idDocumentoHuesped = (event?.['idDocumento'] ?? this.idDocumentoHuesped).toString();
  }

  guardarReserva(): void {
    if (!this.formReserva.idProductoHabitacion || !this.formReserva.nombreHuesped?.trim() || !this.formReserva.fechaEntrada || !this.formReserva.fechaSalida) {
      this.errorMessage.set('Complete habitación, huésped y fechas.');
      return;
    }
    if (this.nochesFormReserva <= 0) {
      this.errorMessage.set('La fecha de salida debe ser posterior a la de entrada.');
      return;
    }
    if (!this.totalReservaEditadoManual) {
      this.recalcularTotalEstimadoReserva();
    }
    this.guardandoReserva = true;
    this.errorMessage.set(null);
    const editando = this.reservaEditando;
    const payload = {
      idProductoHabitacion: this.formReserva.idProductoHabitacion,
      idCliente: this.formReserva.idCliente ?? undefined,
      nombreHuesped: this.formReserva.nombreHuesped.trim(),
      fechaEntrada: this.formReserva.fechaEntrada,
      fechaSalida: this.formReserva.fechaSalida,
      codigo: this.formReserva.codigo || undefined,
      total: this.formReserva.total ?? 0,
      estado: 'confirmada',
      fechaHoraCliente: fechaHoraClienteAhora()
    };
    const onOk = (): void => {
      iziToast.success({
        title: 'OK',
        message: editando ? 'Reserva actualizada.' : 'Reserva creada.',
        position: 'topRight'
      });
      this.cerrarModalReserva();
      this.cargarDatos();
      if (this.activeTab() === 'calendario') this.cargarCalendario();
      if (this.activeTab() === 'reportes') {
        this.cargarReporte();
        this.cargarHistorialHabitacion();
      }
      this.guardandoReserva = false;
    };
    const onErr = (err: { error?: { message?: string } }): void => {
      this.errorMessage.set(err?.error?.message || (editando ? 'Error al actualizar reserva' : 'Error al crear reserva'));
      this.guardandoReserva = false;
    };
    if (editando) {
      this.hotelService.actualizarReserva(editando.idReserva, {
        ...payload,
        codigo: this.formReserva.codigo || editando.codigo,
        estado: 'confirmada',
        total: this.formReserva.total ?? 0
      }).subscribe({ next: onOk, error: onErr });
    } else {
      this.hotelService.crearReserva(payload).subscribe({ next: onOk, error: onErr });
    }
  }

  estadoReservaClass(estado: EstadoReserva): string {
    const e = String(estado);
    if (e === 'confirmada' || e === 'vigente') return 'hotel-badge-en-curso';
    if (e === 'convertida') return 'hotel-badge-completada';
    return 'hotel-badge-completada';
  }

  estadoReservaLabels: Record<string, string> = {
    confirmada: 'Confirmada',
    cancelada: 'Cancelada',
    no_show: 'No show',
    convertida: 'En casa',
    vigente: 'Confirmada',
    sin_efecto: 'Cancelada'
  };

  labelEstadoReserva(estado: EstadoReserva): string {
    return this.estadoReservaLabels[String(estado)] ?? String(estado);
  }

  formatearMoneda(value: number): string {
    return 'S/ ' + Number(value).toFixed(2);
  }

  get confirmadasCount(): number {
    return this.reservas.filter((r) => this.reservaEsConfirmada(r)).length;
  }

  get estanciasActivasCount(): number {
    return this.estanciasActivas.length;
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  cargarHousekeeping(): void {
    this.housekeepingLoading.set(true);
    this.hotelService.listarHousekeeping().subscribe({
      next: (res) => {
        const map: Record<string, HotelHousekeepingItem> = {};
        for (const row of res.data ?? []) {
          map[String(row.idProductoHabitacion).toLowerCase()] = row;
        }
        this.housekeepingPorHabitacion = map;
        this.housekeepingLoading.set(false);
      },
      error: () => {
        this.housekeepingPorHabitacion = {};
        this.housekeepingLoading.set(false);
      }
    });
  }

  getEstadoLimpieza(idProducto: string): EstadoLimpiezaHotel {
    const key = String(idProducto).toLowerCase();
    return this.housekeepingPorHabitacion[key]?.estadoLimpieza ?? 'limpia';
  }

  labelEstadoLimpieza(estado: EstadoLimpiezaHotel): string {
    return this.estadosLimpieza.find((e) => e.value === estado)?.label ?? estado;
  }

  cambiarEstadoLimpieza(hab: ProductoHabitacion, estado: EstadoLimpiezaHotel): void {
    this.hotelService.actualizarHousekeeping(hab.idProducto, { estadoLimpieza: estado }).subscribe({
      next: () => {
        iziToast.success({ title: 'Housekeeping', message: `${hab.codigo}: ${this.labelEstadoLimpieza(estado)}`, position: 'topRight' });
        this.cargarHousekeeping();
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo actualizar', position: 'topRight' });
      }
    });
  }

  inicializarRangoReporte(): void {
    this.reporteMes = this.mesActualLocal();
    this.aplicarMesReporte(false);
    if (!this.historialMes) this.historialMes = this.mesActualLocal();
    if (!this.historialHabitacionId && this.productosHabitacion.length) {
      this.historialHabitacionId = this.productosHabitacion[0].idProducto;
    }
    this.cargarReporte();
    if (this.historialHabitacionId && this.historialMes) this.cargarHistorialHabitacion();
  }

  aplicarMesReporte(recargar = true): void {
    if (!this.reporteMes) return;
    const [y, m] = this.reporteMes.split('-').map(Number);
    if (!y || !m) return;
    const last = new Date(y, m, 0).getDate();
    this.reporteDesde = `${y}-${String(m).padStart(2, '0')}-01`;
    this.reporteHasta = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    if (recargar) this.cargarReporte();
  }

  cargarHistorialHabitacion(): void {
    if (!this.historialHabitacionId || !this.historialMes) return;
    this.historialLoading.set(true);
    this.historialData = null;
    this.hotelService.getHistorialHabitacionMes(this.historialHabitacionId, this.historialMes).subscribe({
      next: (res) => {
        this.historialData = res.data ?? null;
        this.historialLoading.set(false);
      },
      error: (err) => {
        this.historialData = null;
        this.historialLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al cargar historial de habitación');
      }
    });
  }

  labelMesHistorial(): string {
    if (!this.historialMes) return '';
    const [y, m] = this.historialMes.split('-').map(Number);
    const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${nombres[(m || 1) - 1]} ${y}`;
  }

  historialDiasSemana(): string[] {
    return ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  }

  historialCeldasMes(): { fecha: string | null; dia: number | null; estado: 'libre' | 'reservado' | 'ocupado' | 'ocupado-pasado' }[] {
    if (!this.historialMes) return [];
    const [anio, mes] = this.historialMes.split('-').map(Number);
    const primerDia = new Date(anio, mes - 1, 1);
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const offset = (primerDia.getDay() + 6) % 7;
    const ocupadasActivas = new Set(this.historialData?.fechasOcupadasActivas ?? []);
    const ocupadasPasadas = new Set(this.historialData?.fechasOcupadasPasadas ?? []);
    const reservadas = new Set(this.historialData?.fechasReservadas ?? []);
    const celdas: { fecha: string | null; dia: number | null; estado: 'libre' | 'reservado' | 'ocupado' | 'ocupado-pasado' }[] = [];
    for (let i = 0; i < offset; i++) {
      celdas.push({ fecha: null, dia: null, estado: 'libre' });
    }
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let estado: 'libre' | 'reservado' | 'ocupado' | 'ocupado-pasado' = 'libre';
      if (ocupadasActivas.has(fecha)) estado = 'ocupado';
      else if (ocupadasPasadas.has(fecha)) estado = 'ocupado-pasado';
      else if (reservadas.has(fecha)) estado = 'reservado';
      celdas.push({ fecha, dia: d, estado });
    }
    return celdas;
  }

  calendariosOcupacionReporte(): { label: string; celdas: CeldaCalendarioOcupacion[] }[] {
    const dias = this.reporteData?.ocupacionPorDia ?? [];
    if (!dias.length) return [];
    const porFecha = new Map(dias.map((d) => [d.fecha, d]));
    const primera = dias[0].fecha.slice(0, 7);
    const ultima = dias[dias.length - 1].fecha.slice(0, 7);
    const [y0, m0] = primera.split('-').map(Number);
    const [y1, m1] = ultima.split('-').map(Number);
    const meses: { label: string; celdas: CeldaCalendarioOcupacion[] }[] = [];
    let y = y0;
    let m = m0;
    while (y < y1 || (y === y1 && m <= m1)) {
      const labelDate = new Date(y, m - 1, 1, 12, 0, 0);
      const label = labelDate.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
      const primerDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
      const diasMes = new Date(y, m, 0).getDate();
      const celdas: CeldaCalendarioOcupacion[] = [];
      for (let i = 0; i < primerDow; i++) celdas.push({ tipo: 'vacio' });
      for (let dia = 1; dia <= diasMes; dia++) {
        const fecha = `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const data = porFecha.get(fecha);
        if (data) celdas.push({ tipo: 'dia', dia, data });
        else celdas.push({ tipo: 'fuera', dia });
      }
      meses.push({ label, celdas });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return meses;
  }

  claseCeldaOcupacion(dia: HotelReporteOcupacionDia): string {
    if ((dia.ocupadas || 0) <= 0 && (dia.reservadas || 0) > 0) return 'occ-res';
    const total = Math.max(0, Number(dia.total) || 0);
    const p = total > 0 ? (Number(dia.ocupadas) || 0) / total : 0;
    if (p <= 0) return 'occ-0';
    if (p < 0.34) return 'occ-1';
    if (p < 0.67) return 'occ-2';
    if (p < 1) return 'occ-3';
    return 'occ-4';
  }

  tituloCeldaOcupacion(dia: HotelReporteOcupacionDia): string {
    const partes = [`${dia.ocupadas} in-house de ${dia.total} (${dia.ocupacionPct}%)`];
    if (dia.reservadas > 0) partes.push(`${dia.reservadas} reserva(s) sin check-in`);
    return partes.join(' · ');
  }

  esHabitacionMasOcupada(hab: HotelReporteHabitacion): boolean {
    const top = this.reporteData?.destacados?.masOcupada;
    return !!top && String(top.idProductoHabitacion).toLowerCase() === String(hab.idProductoHabitacion).toLowerCase();
  }

  esHabitacionMasVentas(hab: HotelReporteHabitacion): boolean {
    const top = this.reporteData?.destacados?.masVentas;
    return !!top && String(top.idProductoHabitacion).toLowerCase() === String(hab.idProductoHabitacion).toLowerCase();
  }

  abrirDetalleHistorialEstancia(est: HotelHistorialEstanciaResumen): void {
    this.historialDetalle = null;
    this.showModalHistorialEstancia.set(true);
    this.historialDetalleLoading.set(true);
    this.hotelService.getDetalleEstanciaHistorial(est.idEstancia).subscribe({
      next: (res) => {
        this.historialDetalle = res.data ?? null;
        this.historialDetalleLoading.set(false);
      },
      error: (err) => {
        this.historialDetalle = null;
        this.historialDetalleLoading.set(false);
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo cargar el detalle', position: 'topRight' });
      }
    });
  }

  cerrarModalHistorialEstancia(): void {
    this.showModalHistorialEstancia.set(false);
    this.historialDetalle = null;
  }

  formatearFechaHora(valor: string | null | undefined): string {
    if (!valor) return '—';
    return valor.replace('T', ' ').slice(0, 16);
  }

  cargarReporte(): void {
    if (!this.reporteDesde || !this.reporteHasta) return;
    this.reporteLoading.set(true);
    this.hotelService.getReporteHotel(this.reporteDesde, this.reporteHasta).subscribe({
      next: (res) => {
        this.reporteData = res.data ?? null;
        this.reporteLoading.set(false);
      },
      error: (err) => {
        this.reporteData = null;
        this.reporteLoading.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al cargar reporte');
      }
    });
  }

  generarPdfReporteGeneral(): void {
    const d = this.reporteData;
    if (!d) {
      iziToast.warning({ title: 'PDF', message: 'Genere el reporte primero.', position: 'topRight' });
      return;
    }
    const periodo = this.labelPeriodoReporte();
    const topOc = d.destacados.masOcupada;
    const topVen = d.destacados.masVentas;
    const columnas = ['Indicador', 'Valor'];
    const filas = [
      ['Período', periodo],
      ['Ocupación', `${d.ocupacion.ocupacionPct}%`],
      ['Habitaciones ocupadas', `${d.ocupacion.habitacionesOcupadas} de ${d.ocupacion.habitaciones}`],
      ['Noches ocupadas', String(d.ocupacion.nochesOcupadas)],
      ['Noches reservadas', String(d.ocupacion.nochesReservadas)],
      ['Días del período', String(d.ocupacion.dias)],
      ['Ventas ocupación', this.formatearMoneda(d.ocupacion.ingresoHabitacion)],
      ['Consumo habitaciones', this.formatearMoneda(d.consumo.ingresoConsumo)],
      ['Total período', this.formatearMoneda(d.ingresoTotal)],
      ['Reservas confirmadas', String(d.reservas.confirmadas)],
      ['Reservas convertidas', String(d.reservas.convertidas)],
      ['Reservas canceladas', String(d.reservas.cancelaciones)],
      ['No show', String(d.reservas.noShow)],
      ['Monto reservas confirmadas', this.formatearMoneda(d.reservas.ingresoConfirmadas)],
      [
        'Habitación más ocupada',
        topOc
          ? `${topOc.habitacionCodigo} — ${topOc.habitacionDescripcion} (${topOc.nochesOcupadas} noches)`
          : 'Sin ocupación'
      ],
      [
        'Habitación con más ventas',
        topVen
          ? `${topVen.habitacionCodigo} — ${topVen.habitacionDescripcion} (${this.formatearMoneda(topVen.ingresoTotal)})`
          : 'Sin ventas'
      ]
    ];
    const diasOcc = d.ocupacionPorDia ?? [];
    if (diasOcc.length) {
      filas.push(['Ocupación por día', 'In-house / total']);
      for (const dia of diasOcc) {
        const fecha = String(dia.fecha).slice(0, 10).split('-').reverse().join('/');
        let valor = `${dia.ocupadas}/${dia.total} (${dia.ocupacionPct}%)`;
        if (dia.reservadas > 0) valor += ` · ${dia.reservadas} reserva(s)`;
        filas.push([fecha, valor]);
      }
    }
    const nombreArchivo = `hotel_reporte_general_${d.fechaDesde}_${d.fechaHasta}.pdf`;
    this.generandoPdfGeneral = true;
    this.pdfService.generarPdfDinamico({
      titulo: `Reporte general hotel — ${periodo}`,
      empresa: this.payloadEmpresaPdf(),
      columnas,
      filas,
      nombreArchivo
    }, 'lista-ventas', 10, 'A4').subscribe({
      next: (blob) => {
        this.generandoPdfGeneral = false;
        this.pdfService.previsualizar(blob, nombreArchivo);
        iziToast.success({ title: 'PDF', message: 'Reporte general generado.', position: 'topRight' });
      },
      error: (err: { error?: { error?: string; message?: string } }) => {
        this.generandoPdfGeneral = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.error || err?.error?.message || 'No se pudo generar el PDF general.',
          position: 'topRight'
        });
      }
    });
  }

  generarPdfReporteHabitaciones(): void {
    const d = this.reporteData;
    if (!d) {
      iziToast.warning({ title: 'PDF', message: 'Genere el reporte primero.', position: 'topRight' });
      return;
    }
    const periodo = this.labelPeriodoReporte();
    const columnas = [
      'Habitación',
      'Descripción',
      'Noches ocup.',
      'Noches res.',
      'Reservas',
      'Ocupación (S/)',
      'Consumo (S/)',
      'Total (S/)'
    ];
    const filas = d.porHabitacion.map((h) => [
      h.habitacionCodigo,
      h.habitacionDescripcion,
      h.nochesOcupadas,
      h.nochesReservadas,
      h.reservas,
      Number(h.ingresoHabitacion).toFixed(2),
      Number(h.ingresoConsumo).toFixed(2),
      Number(h.ingresoTotal).toFixed(2)
    ]);
    const totOcup = d.porHabitacion.reduce((s, h) => s + (Number(h.ingresoHabitacion) || 0), 0);
    const totCons = d.porHabitacion.reduce((s, h) => s + (Number(h.ingresoConsumo) || 0), 0);
    const totNoc = d.porHabitacion.reduce((s, h) => s + (Number(h.nochesOcupadas) || 0), 0);
    const totResNoc = d.porHabitacion.reduce((s, h) => s + (Number(h.nochesReservadas) || 0), 0);
    const totRes = d.porHabitacion.reduce((s, h) => s + (Number(h.reservas) || 0), 0);
    filas.push([
      'TOTAL',
      '',
      totNoc,
      totResNoc,
      totRes,
      totOcup.toFixed(2),
      totCons.toFixed(2),
      (totOcup + totCons).toFixed(2)
    ]);
    const nombreArchivo = `hotel_reporte_habitaciones_${d.fechaDesde}_${d.fechaHasta}.pdf`;
    this.generandoPdfHabitaciones = true;
    this.pdfService.generarPdfDinamico({
      titulo: `Reporte por habitación — ${periodo}`,
      empresa: this.payloadEmpresaPdf(),
      columnas,
      filas,
      nombreArchivo
    }, 'lista-ventas', 8, 'A4').subscribe({
      next: (blob) => {
        this.generandoPdfHabitaciones = false;
        this.pdfService.previsualizar(blob, nombreArchivo);
        iziToast.success({ title: 'PDF', message: 'Reporte por habitación generado.', position: 'topRight' });
      },
      error: (err: { error?: { error?: string; message?: string } }) => {
        this.generandoPdfHabitaciones = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.error || err?.error?.message || 'No se pudo generar el PDF por habitación.',
          position: 'topRight'
        });
      }
    });
  }

  private labelPeriodoReporte(): string {
    if (!this.reporteDesde || !this.reporteHasta) return '';
    return `${this.reporteDesde} a ${this.reporteHasta}`;
  }

  private payloadEmpresaPdf(): { logo: string; nombre: string; ruc: string; direccion: string; telefono: string } {
    const emp = this.empresaService.getEmpresaActual();
    return {
      logo: emp?.logo || '',
      nombre: emp?.nombre || '',
      ruc: emp?.ruc || '',
      direccion: emp?.direccion || '',
      telefono: emp?.telefono || ''
    };
  }

  abrirModalAnticipo(reserva: Reserva): void {
    this.reservaAnticipoSeleccionada = reserva;
    this.formAnticipo = { monto: 0, concepto: 'Seña / anticipo' };
    this.hotelService.listarAnticipos({ idReserva: reserva.idReserva }).subscribe({
      next: (res) => { this.anticiposReserva = res.data ?? []; },
      error: () => { this.anticiposReserva = []; }
    });
    this.showModalAnticipo.set(true);
  }

  cerrarModalAnticipo(): void {
    this.showModalAnticipo.set(false);
    this.reservaAnticipoSeleccionada = null;
  }

  guardarAnticipo(): void {
    const res = this.reservaAnticipoSeleccionada;
    if (!res || !(Number(this.formAnticipo.monto) > 0)) {
      iziToast.warning({ title: 'Aviso', message: 'Indique un monto válido.', position: 'topRight' });
      return;
    }
    this.guardandoAnticipo = true;
    this.hotelService.registrarAnticipo({
      idReserva: res.idReserva,
      idEstancia: res.idEstancia ?? undefined,
      monto: Number(this.formAnticipo.monto),
      concepto: this.formAnticipo.concepto
    }).subscribe({
      next: () => {
        this.guardandoAnticipo = false;
        iziToast.success({ title: 'OK', message: 'Anticipo registrado.', position: 'topRight' });
        this.abrirModalAnticipo(res);
      },
      error: (err) => {
        this.guardandoAnticipo = false;
        iziToast.error({ title: 'Error', message: err?.error?.message || 'Error al registrar anticipo', position: 'topRight' });
      }
    });
  }

  anularAnticipoLista(a: HotelAnticipo): void {
    if (a.estado !== 'pendiente') return;
    if (!confirm('¿Anular este anticipo?')) return;
    this.hotelService.anularAnticipo(a.idAnticipo).subscribe({
      next: () => {
        if (this.reservaAnticipoSeleccionada) this.abrirModalAnticipo(this.reservaAnticipoSeleccionada);
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo anular', position: 'topRight' });
      }
    });
  }

  iniciarDragReserva(ev: HotelCalendarioEvento, mouseEvent: MouseEvent): void {
    if (ev.tipo !== 'reserva' || !ev.idReserva) return;
    mouseEvent.preventDefault();
    mouseEvent.stopPropagation();
    const res = this.reservas.find((r) => r.idReserva === ev.idReserva);
    if (!res || !this.reservaEsConfirmada(res)) return;
    const startX = mouseEvent.clientX;
    this.dragReservaActiva = {
      idReserva: res.idReserva,
      startX,
      fechaEntrada: res.fechaEntrada,
      fechaSalida: res.fechaSalida,
      idProductoHabitacion: res.idProductoHabitacion
    };
    const onUp = (e: MouseEvent) => {
      window.removeEventListener('mouseup', onUp);
      const drag = this.dragReservaActiva;
      this.dragReservaActiva = null;
      if (!drag) return;
      const deltaPx = e.clientX - drag.startX;
      const numDias = this.getDiasCalendario().length || 7;
      const dayWidth = Math.max(40, (window.innerWidth - 200) / numDias);
      const shift = Math.round(deltaPx / dayWidth);
      if (shift === 0) return;
      const nuevaEntrada = this.sumarDiasLocal(drag.fechaEntrada, shift);
      const nuevaSalida = this.sumarDiasLocal(drag.fechaSalida, shift);
      this.hotelService.moverReservaCalendario(drag.idReserva, {
        fechaEntrada: nuevaEntrada,
        fechaSalida: nuevaSalida,
        idProductoHabitacion: drag.idProductoHabitacion
      }).subscribe({
        next: () => {
          iziToast.success({ title: 'Calendario', message: 'Reserva movida.', position: 'topRight' });
          this.cargarDatos();
          this.cargarCalendario();
        },
        error: (err) => {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo mover la reserva', position: 'topRight' });
        }
      });
    };
    window.addEventListener('mouseup', onUp);
  }
}
