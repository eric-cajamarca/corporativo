import { Component, inject, signal } from '@angular/core';
import { DespachoService } from '../../../services/despacho.service';
import { EmpresaService } from '../../../services/empresa.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { EnviosService } from '../../../services/envios.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ChoferesService, ChoferInterno } from '../../../services/choferes.service';
import { RegistrarChoferVehiculoModalComponent } from '../registrar-chofer-vehiculo-modal/registrar-chofer-vehiculo-modal.component';
import { RegistrarTransportistaModalComponent } from '../registrar-transportista-modal/registrar-transportista-modal.component';

declare const iziToast: any;

export interface DetalleVentaLinea {
  idDetalle: number;
  idProducto: string;
  productoCodigo: string;
  productoDescripcion: string;
  cantidad: number;
  cantEntregada: number;
  cantPendiente: number;
  ubicaciones: string;
}

export interface VentaDespachosResult {
  venta: {
    idVenta: number;
    compVenta: string;
    serie: string;
    numero: string;
    fEmision: string;
    total: number;
    idEstadoPedidoVenta: number | null;
    estadoPedidoVentaNombre: string | null;
    idEstadoPago?: number;
    estadoPagoNombre?: string;
    clienteRazonSocial: string;
    clienteRuc: string;
  };
  despachos: Array<{
    idDespacho: string;
    idVenta: number;
    fechaDespacho: string;
    estado: string;
    observaciones: string | null;
    tipoDespacho: string;
    usuarioDespacho: string;
    totalLineas: number;
    lineasDespachadas: number;
  }>;
  detalleVenta?: DetalleVentaLinea[];
  entregadoMismoDia: boolean;
}

@Component({
  selector: 'app-index-despachos',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, SidebarComponent, TopnavComponent, RegistrarChoferVehiculoModalComponent, RegistrarTransportistaModalComponent],
  templateUrl: './index-despachos.component.html',
  styleUrl: './index-despachos.component.css'
})
export class IndexDespachosComponent {
  public sidebarState = inject(SidebarStateService);
  
  /** Criterio de búsqueda: número de comprobante o idVenta (puede escanearse del código de barras del comprobante) */
  criterioBusqueda = '';
  loading = false;
  errorMsg = '';
  resultado: VentaDespachosResult | null = null;
  /** Detalle cargado por idDespacho para el acordeón */
  detallePorDespacho: Record<string, Array<{
    idDetalleDespacho: string;
    productoCodigo: string;
    productoDescripcion: string;
    cantidadSolicitada: number;
    cantidadDespachada: number;
    estado: string;
    fechaDespacho: string | null;
    ubicacionOrigen?: string | null;
    ubicacionDestino?: string | null;
  }>> = {};
  loadingDetalle: Record<string, boolean> = {};
  guardandoCantidad: Record<string, boolean> = {};
  cantADespacharEdicion: Record<string, number | undefined> = {};
 

  /** Modal Crear despacho */
  modalCrearDespachoAbierto = signal<boolean>(false);
  tiposDespacho: Array<{ idTipoDespacho: number; nombre: string }> = [];
  idTipoDespachoPanel: number | null = null;
  observacionesPanel = '';
  cantADespacharPanel: Record<number, number> = {};
  enviandoCrear = false;
  generandoPdf = false;

  // Delivery desde despacho
  modoEntregaPanel: 'RECOJO' | 'DELIVERY' = 'RECOJO';
  tipoDeliveryPanel: 'INTERNO' | 'EXTERNO' = 'INTERNO';
  choferesInternos: ChoferInterno[] = [];
  transportistasExternos: Array<{ idTransportista: string; nombres: string; apellidos: string; placa?: string; estado?: boolean }> = [];
  idChoferSeleccionado: string | null = null;
  idTransportistaSeleccionado: string | null = null;
  idTipoEnvioPanel: number | null = null;
  direccionEntregaPanel = 'SIN_DIRECCION';

  // Modal: registrar chofer interno + vehículo
  modalRegistrarChoferVisible = false;

  // Modal: registrar transportista externo
  modalRegistrarTransportistaVisible = false;

  mostrarWhatsappForm = false;
  whatsappNumber = '';
  whatsappCaption = '';
  whatsappFormato: 'A4' | 'A5' | 'ticket' = 'A4';
  enviandoWhatsapp = false;
  whatsappMensaje: string | null = null;

  /** Solo líneas con pendiente > 0 para el modal crear despacho */
  get detalleConPendiente(): DetalleVentaLinea[] {
    const r = this.resultado;
    if (!r?.detalleVenta?.length) return [];
    return r.detalleVenta.filter((dv: DetalleVentaLinea) => (Number(dv.cantPendiente) || 0) > 0);
  }

  constructor(
    private despachoService: DespachoService,
    private empresaService: EmpresaService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    private enviosService: EnviosService,
    private choferesService: ChoferesService
  ) {}

  ngOnInit(): void {}

  onToggleSidebar(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  // #region buscar
  buscar(): void {
    const c = (this.criterioBusqueda || '').trim();
    if (!c) {
      this.errorMsg = 'Ingrese número de comprobante o escanee el código (idVenta).';
      this.resultado = null;
      return;
    }
    this.errorMsg = '';
    this.resultado = null;
    this.loading = true;
    const params: { compVenta?: string; idVenta?: string } = {};
    const num = /^\d+$/.test(c);
    if (num) params.idVenta = c; else params.compVenta = c;

    this.despachoService.buscarVentaDespachos(params).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.data) {
          this.resultado = res.data as VentaDespachosResult;
          this.detallePorDespacho = {};
        } else {
          this.errorMsg = 'Venta no encontrada.';
        }
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Error al buscar. Verifique el comprobante o el código.';
      }
    });
  }

  cargarDetalleDespacho(idDespacho: string): void {
    if (this.detallePorDespacho[idDespacho] || this.loadingDetalle[idDespacho]) return;
    this.loadingDetalle[idDespacho] = true;
    this.despachoService.obtenerDetalleDespacho(idDespacho).subscribe({
      next: (res) => {
        this.loadingDetalle[idDespacho] = false;
        const list = (res && res.data) ? res.data : [];
        this.detallePorDespacho[idDespacho] = list;
        list.forEach((lin: any) => {
          this.cantADespacharEdicion[lin.idDetalleDespacho] = Number(lin.cantidadDespachada) || 0;
        });
      },
      error: () => {
        this.loadingDetalle[idDespacho] = false;
        this.detallePorDespacho[idDespacho] = [];
      }
    });
  }

  expandirDespacho(idDespacho: string): void {
    this.cargarDetalleDespacho(idDespacho);
  }

  pendienteLinea(lin: { cantidadSolicitada: number; cantidadDespachada: number }): number {
    const s = Number(lin.cantidadSolicitada) || 0;
    const d = Number(lin.cantidadDespachada) || 0;
    return Math.max(0, s - d);
  }

  guardarCantidadDespachada(idDespacho: string, idDetalleDespacho: string, cantidadDespachada: number): void {
    const key = idDetalleDespacho;
    if (this.guardandoCantidad[key]) return;
    this.guardandoCantidad[key] = true;
    this.despachoService.actualizarCantidadDetalle({
      idDetalle: idDetalleDespacho,
      cantidadDespachada: Number(cantidadDespachada) || 0
    }).subscribe({
      next: () => {
        this.guardandoCantidad[key] = false;
        delete this.cantADespacharEdicion[key];
        this.detallePorDespacho[idDespacho] = [];
        this.cargarDetalleDespacho(idDespacho);
        if (this.resultado?.detalleVenta) {
          this.despachoService.buscarVentaDespachos(
            this.resultado.venta.compVenta ? { compVenta: this.resultado.venta.compVenta } : { idVenta: String(this.resultado.venta.idVenta) }
          ).subscribe({
            next: (res) => { if (res?.data) this.resultado = res.data as VentaDespachosResult; }
          });
        }
      },
      error: () => { this.guardandoCantidad[key] = false; }
    });
  }

  abrirModalCrearDespacho(): void {
    this.cantADespacharPanel = {};
    this.detalleConPendiente.forEach(dv => {
      this.cantADespacharPanel[dv.idDetalle] = Number(dv.cantPendiente) || 0;
    });
    this.despachoService.obtenerTiposDespacho().subscribe({
      next: (res) => {
        this.tiposDespacho = (res?.data ?? []) as Array<{ idTipoDespacho: number; nombre: string }>;
        this.idTipoDespachoPanel = this.tiposDespacho.length ? this.tiposDespacho[0].idTipoDespacho : null;
      }
    });
    this.observacionesPanel = '';

    // Catálogos para delivery desde despacho
    this.modoEntregaPanel = 'RECOJO';
    this.tipoDeliveryPanel = 'INTERNO';
    this.idChoferSeleccionado = null;
    this.idTransportistaSeleccionado = null;
    this.idTipoEnvioPanel = null;
    this.choferesInternos = [];
    this.transportistasExternos = [];

    this.enviosService.obtenerTiposEnvio().subscribe({
      next: (res: any) => {
        const tipos = (res?.data || []) as Array<{ idTipoEnvio: number; nombre: string; costoBase?: number; requiereTransportista?: boolean }>;
        // Preferir delivery local; si no existe, tomar el primer tipo DELIVERY.
        const local = tipos.find((t) => t.nombre === 'DELIVERY_LOCAL') || tipos.find((t) => t.nombre?.includes('DELIVERY'));
        this.idTipoEnvioPanel = local?.idTipoEnvio ?? (tipos[0]?.idTipoEnvio ?? null);
      }
    });

    // Mantener disponibles transportistas para opción EXTERNO si el usuario cambia de modalidad.
    this.cargarTransportistasExternos();

    this.choferesService.listarChoferes().subscribe({
      next: (res: any) => {
        this.choferesInternos = (res?.data || []) as ChoferInterno[];
        if (this.choferesInternos.length > 0) {
          this.tipoDeliveryPanel = 'INTERNO';
          this.idChoferSeleccionado = this.choferesInternos[0].idChofer;
        }
      }
    });

    this.modalCrearDespachoAbierto.set(true);
  }

  private cargarTransportistasExternos(): void {
    this.enviosService.obtenerTransportistas().subscribe({
      next: (res: any) => {
        this.transportistasExternos = (res?.data || []) as Array<{ idTransportista: string; nombres: string; apellidos: string; placa?: string; estado?: boolean }>;
        this.idTransportistaSeleccionado = this.transportistasExternos[0]?.idTransportista || null;
      },
      error: () => {
        this.transportistasExternos = [];
        this.idTransportistaSeleccionado = null;
      }
    });
  }

  private cargarChoferesInternosParaPanel(): void {
    this.choferesService.listarChoferes().subscribe({
      next: (res: any) => {
        this.choferesInternos = (res?.data || []) as ChoferInterno[];
        if (this.choferesInternos.length > 0) {
          this.tipoDeliveryPanel = 'INTERNO';
          this.idChoferSeleccionado = this.choferesInternos[0].idChofer;
        } else {
          this.tipoDeliveryPanel = 'EXTERNO';
          // Si no hay choferes internos, fallback a transportistas externos
          this.cargarTransportistasExternos();
        }
      },
      error: () => {
        this.choferesInternos = [];
        this.tipoDeliveryPanel = 'EXTERNO';
      }
    });
  }

  abrirModalRegistrarChofer(): void {
    this.modalRegistrarChoferVisible = true;
  }

  onChoferVehiculoGuardado(): void {
    this.modalRegistrarChoferVisible = false;
    this.cargarChoferesInternosParaPanel();
  }

  abrirModalRegistrarTransportista(): void {
    this.modalRegistrarTransportistaVisible = true;
  }

  onTransportistaGuardado(): void {
    this.modalRegistrarTransportistaVisible = false;
    this.cargarTransportistasExternos();
  }

  cerrarModalCrearDespacho(): void {
    this.modalCrearDespachoAbierto.set(false);
  }

  crearDespachoDesdeModal(): void {
    const r = this.resultado;
    if (!r || !r.venta?.idVenta || this.idTipoDespachoPanel == null) return;
    const detalles: Array<{ idDetalle: number; idProducto: string; cantidadADespachar: number }> = [];
    for (const dv of this.detalleConPendiente) {
      const cant = Number(this.cantADespacharPanel[dv.idDetalle]) ?? 0;
      if (cant > 0) {
        const maxP = Number(dv.cantPendiente) || 0;
        detalles.push({
          idDetalle: dv.idDetalle,
          idProducto: dv.idProducto,
          cantidadADespachar: cant > maxP ? maxP : cant
        });
      }
    }
    if (this.modoEntregaPanel === 'DELIVERY') {
      if (this.idTipoEnvioPanel == null) {
        iziToast.warning({ title: 'Aviso', message: 'Selecciona/valida el tipo de envío.', position: 'topRight' });
        return;
      }
      if (this.tipoDeliveryPanel === 'INTERNO' && !this.idChoferSeleccionado) {
        iziToast.warning({ title: 'Aviso', message: 'Selecciona un chofer interno.', position: 'topRight' });
        return;
      }
      if (this.tipoDeliveryPanel === 'EXTERNO' && !this.idTransportistaSeleccionado) {
        iziToast.warning({ title: 'Aviso', message: 'Selecciona un transportista externo.', position: 'topRight' });
        return;
      }
    }

    this.enviandoCrear = true;
    this.despachoService.crearDespacho({
      idVenta: String(r.venta.idVenta),
      idTipoDespacho: this.idTipoDespachoPanel,
      observaciones: this.observacionesPanel || undefined,
      detalles: detalles.length > 0 ? detalles : undefined
    }).subscribe({
      next: (res: any) => {
        this.enviandoCrear = false;
        this.cerrarModalCrearDespacho();
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Despacho creado', position: 'topRight' });

        if (this.modoEntregaPanel === 'DELIVERY') {
          const payload: any = {
            idVenta: String(r.venta.idVenta),
            idDespacho: res?.data?.idDespacho ?? undefined,
            idTipoEnvio: this.idTipoEnvioPanel,
            costoEnvio: 0,
            direccionEntrega: this.direccionEntregaPanel,
            observaciones: undefined,
            idEstadoEnvioInicial: 1
          };

          if (this.tipoDeliveryPanel === 'INTERNO') {
            payload.idChofer = this.idChoferSeleccionado;
          } else {
            payload.idTransportista = this.idTransportistaSeleccionado;
          }

          this.enviosService.crearEnvio(payload).subscribe({
            next: () => {
              this.despachoService.buscarVentaDespachos(
                r.venta.compVenta ? { compVenta: r.venta.compVenta } : { idVenta: String(r.venta.idVenta) }
              ).subscribe({
                next: (res) => { if (res?.data) this.resultado = res.data as VentaDespachosResult; }
              });
            },
            error: (err: any) => {
              iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo crear el envío', position: 'topRight' });
              this.despachoService.buscarVentaDespachos(
                r.venta.compVenta ? { compVenta: r.venta.compVenta } : { idVenta: String(r.venta.idVenta) }
              ).subscribe({
                next: (res) => { if (res?.data) this.resultado = res.data as VentaDespachosResult; }
              });
            }
          });
        } else {
          this.despachoService.buscarVentaDespachos(
            r.venta.compVenta ? { compVenta: r.venta.compVenta } : { idVenta: String(r.venta.idVenta) }
          ).subscribe({
            next: (res) => { if (res?.data) this.resultado = res.data as VentaDespachosResult; }
          });
        }
      },
      error: (err) => {
        this.enviandoCrear = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo crear el despacho', position: 'topRight' });
        }
      }
    });
  }

  imprimirComprobanteDespacho(formato: 'A4' | 'A5' | 'ticket'): void {
    const r = this.resultado;
    if (!r?.venta || !r?.detalleVenta?.length) return;
    this.generandoPdf = true;
    this.empresaService.getEmpresa$().subscribe({
      next: (emp) => {
        const empAny = emp as unknown as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa = {
          logo: logoStr,
          nombre: emp.nombre ?? '',
          ruc: emp.ruc ?? '',
          direccion: emp.direccion ?? '',
          telefono: emp.telefono ?? ''
        };
        const venta = { ...r.venta };
        const cliente = { razonSocial: r.venta.clienteRazonSocial || '', ruc: r.venta.clienteRuc || '' };
        const items = (r.detalleVenta || []).map((dv: DetalleVentaLinea) => ({
          productoCodigo: dv.productoCodigo,
          productoDescripcion: dv.productoDescripcion,
          cantidad: dv.cantPendiente ?? dv.cantidad,
          ubicaciones: dv.ubicaciones || ''
        }));
        const datos = { empresa, venta, cliente, items, titulo: 'Comprobante de despacho' };
        const nombreArchivo = `despacho-${(r.venta.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        this.pdfService.generarPdfComprobanteDespacho(datos, formato, nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.previsualizar(blob);
            this.generandoPdf = false;
          },
          error: () => {
            this.generandoPdf = false;
          }
        });
      },
      error: () => { this.generandoPdf = false; }
    });
  }

  abrirFormWhatsapp(): void {
    this.mostrarWhatsappForm = true;
    this.whatsappMensaje = null;
  }

  cerrarFormWhatsapp(): void {
    this.mostrarWhatsappForm = false;
    this.whatsappNumber = '';
    this.whatsappCaption = '';
    this.whatsappFormato = 'A4';
    this.whatsappMensaje = null;
  }

  enviarPdfPorWhatsapp(): void {
    const r = this.resultado;
    if (!r?.venta || !r?.detalleVenta?.length) return;
    if (!this.whatsappNumber.trim()) {
      this.whatsappMensaje = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    this.enviandoWhatsapp = true;
    this.whatsappMensaje = null;
    this.empresaService.getEmpresa$().subscribe({
      next: (emp) => {
        const empAny = emp as unknown as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa = {
          logo: logoStr,
          nombre: emp?.nombre ?? '',
          ruc: emp?.ruc ?? '',
          direccion: emp?.direccion ?? '',
          telefono: emp?.telefono ?? ''
        };
        const venta = { ...r.venta };
        const cliente = { razonSocial: r.venta.clienteRazonSocial || '', ruc: r.venta.clienteRuc || '' };
        const items = (r.detalleVenta || []).map((dv: DetalleVentaLinea) => ({
          productoCodigo: dv.productoCodigo,
          productoDescripcion: dv.productoDescripcion,
          cantidad: dv.cantPendiente ?? dv.cantidad,
          ubicaciones: dv.ubicaciones || ''
        }));
        const datos = { empresa, venta, cliente, items, titulo: 'Comprobante de despacho' };
        const nombreArchivo = `despacho-${(r.venta.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        this.pdfService.generarPdfComprobanteDespacho(datos, this.whatsappFormato, nombreArchivo).subscribe({
          next: (blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
              this.whatsappService.enviarArchivo(this.whatsappNumber.trim(), base64, nombreArchivo, 'document', this.whatsappCaption.trim() || undefined).subscribe({
                next: (res) => {
                  this.enviandoWhatsapp = false;
                  this.whatsappMensaje = res.message;
                  if (res.success) setTimeout(() => this.cerrarFormWhatsapp(), 2000);
                },
                error: (err) => {
                  this.enviandoWhatsapp = false;
                  this.whatsappMensaje = err?.error?.message || err?.message || 'Error al enviar por WhatsApp.';
                }
              });
            };
            reader.readAsDataURL(blob);
          },
          error: () => {
            this.enviandoWhatsapp = false;
            this.whatsappMensaje = 'Error al generar el PDF.';
          }
        });
      },
      error: () => {
        this.enviandoWhatsapp = false;
        this.whatsappMensaje = 'Error al cargar empresa.';
      }
    });
  }
}
