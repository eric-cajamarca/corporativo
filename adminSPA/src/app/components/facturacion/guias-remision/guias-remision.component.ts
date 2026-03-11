import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FacturacionService } from '../../../services/facturacion.service';
import { EmpresaService } from '../../../services/empresa.service';
import { FactilizaService } from '../../../services/factiliza.service';
import { CatalogosService } from '../../../services/catalogos.service';
import { EnviosService } from '../../../services/envios.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare const iziToast: any;

/** Tipos de documento SUNAT (catálogo 06): 1=DNI, 6=RUC, 7=Pasaporte */
const TIPOS_DOC = [
  { value: '1', label: 'DNI' },
  { value: '6', label: 'RUC' },
  { value: '7', label: 'Pasaporte' }
];

/** Modalidad de transporte GRE: 01 Público, 02 Privado */
const MODALIDAD_TRANSPORTE = [
  { value: '01', label: 'Transporte público' },
  { value: '02', label: 'Transporte privado' }
];

/** Unidad de medida de peso SUNAT: KGM = Kilogramo, TNE = Tonelada métrica */
const UNIDADES_PESO = [
  { value: 'KGM', label: 'Kilogramo (kg)' },
  { value: 'TNE', label: 'Tonelada (t)' }
];

@Component({
  selector: 'app-guias-remision',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './guias-remision.component.html',
  styleUrl: './guias-remision.component.css'
})
export class GuiasRemisionComponent implements OnInit {

  public sidebarState = inject(SidebarStateService);

  private facturacionService = inject(FacturacionService);
  private empresaService = inject(EmpresaService);
  private factilizaService = inject(FactilizaService);
  private catalogosService = inject(CatalogosService);
  private enviosService = inject(EnviosService);
  private router = inject(Router);

  readonly tiposDoc = TIPOS_DOC;
  readonly modalidadTransporte = MODALIDAD_TRANSPORTE;
  readonly unidadesPeso = UNIDADES_PESO;

  /** Si la empresa no tiene habilitada la emisión de guías, se bloquea el uso. */
  autorizado = true;

  /** Catálogo SUNAT motivo de traslado (HandlingCode): 01, 02, 04, 08, 09, 13 */
  motivosTraslado: { codigoSunat: string; descripcion: string }[] = [];
  /** Transportistas de la empresa (para transporte público) */
  transportistas: any[] = [];

  // Selección de comprobante origen
  buscarSerie = '';
  buscarNumero = '';
  comprobanteOrigen: any = null;

  // Direcciones
  direccionesEmpresa: any[] = [];
  direccionOrigenSeleccionada: any = null;
  direccionesDestinoLocal: any[] = [];
  direccionDestinoSeleccionada: any = null;

  // Establecimientos vía Factiliza
  anexosOrigen: any[] = [];
  anexosDestino: any[] = [];

  // Destinatario (cliente que recibe): tipo doc, número, razón social
  destinatario: { tipoDoc: string; numeroDoc: string; razonSocial: string } = {
    tipoDoc: '6',
    numeroDoc: '',
    razonSocial: ''
  };
  consultandoDestinatario = false;

  // Datos de traslado (campos obligatorios GRE)
  guia: any = {
    tipoGuia: 'REMITENTE',
    motivoTraslado: '',           // codigoSunat: 01, 02, 04, 08, 09, 13
    descripcionMotivo: '',
    modalidadTransporte: '02',    // 01 Público, 02 Privado
    fechaInicioTraslado: '',
    horaInicioTraslado: '',       // HH:mm
    cantidadPeso: null as number | null,
    unidadMedidaPeso: 'KGM',   // KGM = Kilogramo, TNE = Tonelada
    placaVehiculo: '',
    placaSecundaria: '',
    // Conductor (obligatorio en privado)
    tipoDocConductor: '1',
    numeroDocConductor: '',
    nombreConductor: '',
    licenciaConductor: '',
    // Transporte público
    idTransportista: null as string | null,
    rucTransportista: '',
    razonSocialTransportista: '',
    observaciones: ''
  };
  consultandoConductor = false;

  ngOnInit(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res: any) => {
        this.autorizado = res?.data?.habilitarGuiasElectronicas === true;
        if (!this.autorizado) {
          iziToast.warning({
            title: 'No autorizado',
            message: 'Active "Habilitar emisión de guías electrónicas" en Configuración → Facturación.',
            position: 'topRight'
          });
          return;
        }
        this.cargarDireccionesEmpresa();
        this.cargarMotivosTraslado();
        this.cargarTransportistas();
      },
      error: () => {
        this.autorizado = false;
      }
    });
  }

  private cargarMotivosTraslado(): void {
    this.catalogosService.codigosSunatMotivoTraslado().subscribe({
      next: (res: any) => {
        this.motivosTraslado = res?.data || [];
        if (this.motivosTraslado.length === 0) {
          this.motivosTraslado = [
            { codigoSunat: '01', descripcion: 'Venta' },
            { codigoSunat: '02', descripcion: 'Compra' },
            { codigoSunat: '04', descripcion: 'Traslado entre establecimientos' },
            { codigoSunat: '08', descripcion: 'Importación' },
            { codigoSunat: '09', descripcion: 'Exportación' },
            { codigoSunat: '13', descripcion: 'Otros' }
          ];
        }
      },
      error: () => {
        this.motivosTraslado = [
          { codigoSunat: '01', descripcion: 'Venta' },
          { codigoSunat: '02', descripcion: 'Compra' },
          { codigoSunat: '04', descripcion: 'Traslado entre establecimientos' },
          { codigoSunat: '08', descripcion: 'Importación' },
          { codigoSunat: '09', descripcion: 'Exportación' },
          { codigoSunat: '13', descripcion: 'Otros' }
        ];
      }
    });
  }

  private cargarTransportistas(): void {
    this.enviosService.obtenerTransportistas().subscribe({
      next: (res: any) => {
        this.transportistas = res?.data || [];
      },
      error: () => {
        this.transportistas = [];
      }
    });
  }

  private cargarDireccionesEmpresa(): void {
    this.empresaService.getDireccionEmpresa_id().subscribe({
      next: (res: any) => {
        this.direccionesEmpresa = res?.data || [];
      },
      error: () => {
        iziToast.error({
          title: 'Error',
          message: 'No se pudieron cargar las direcciones de la empresa',
          position: 'topRight'
        });
      }
    });
  }

  buscarComprobanteOrigen(): void {
    if (!this.buscarSerie.trim() || !this.buscarNumero.trim()) {
      iziToast.warning({
        title: 'Datos incompletos',
        message: 'Ingrese serie y número del comprobante',
        position: 'topRight'
      });
      return;
    }
    this.facturacionService.buscarComprobanteOrigenParaGuia({
      serie: this.buscarSerie.trim(),
      numero: this.buscarNumero.trim()
    }).subscribe({
      next: (res: any) => {
        if (res?.data) {
          this.comprobanteOrigen = res.data;
          this.cargarDireccionesDestinoLocal(res.data);
          this.prefillDestinatarioDesdeComprobante(res.data);
        } else {
          iziToast.warning({
            title: 'Sin resultados',
            message: 'No se encontró el comprobante indicado',
            position: 'topRight'
          });
        }
      },
      error: () => {
        iziToast.error({
          title: 'Error',
          message: 'No se pudo buscar el comprobante',
          position: 'topRight'
        });
      }
    });
  }

  private cargarDireccionesDestinoLocal(comprobante: any): void {
    this.direccionesDestinoLocal = [];
    this.direccionDestinoSeleccionada = null;
    const dir = (comprobante?.clienteDireccion || '').toString().trim();
    if (dir) {
      const destino = { direccion: dir, referencia: 'Dirección del cliente' };
      this.direccionesDestinoLocal.push(destino);
      this.direccionDestinoSeleccionada = destino;
    }
  }

  private prefillDestinatarioDesdeComprobante(comprobante: any): void {
    const doc = (comprobante.documento_cliente || comprobante.rucCliente || '').toString().trim();
    const nombre = comprobante.cliente || comprobante.razon_social || '';
    if (doc.length === 11) {
      this.destinatario.tipoDoc = '6';
      this.destinatario.numeroDoc = doc;
      this.destinatario.razonSocial = nombre;
    } else if (doc.length === 8) {
      this.destinatario.tipoDoc = '1';
      this.destinatario.numeroDoc = doc;
      this.destinatario.razonSocial = nombre;
    } else if (doc) {
      this.destinatario.numeroDoc = doc;
      this.destinatario.razonSocial = nombre;
    }
  }

  /** Consulta DNI (Factiliza) y completa nombre del conductor. */
  consultarDniConductor(): void {
    const num = (this.guia.numeroDocConductor || '').toString().trim();
    if (num.length !== 8) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 8 dígitos del DNI del conductor.', position: 'topRight' });
      return;
    }
    this.consultandoConductor = true;
    this.factilizaService.getDni(num).subscribe({
      next: (res: any) => {
        const nombre = res?.data?.nombre || res?.nombre || `${res?.data?.apellidoPaterno || ''} ${res?.data?.apellidoMaterno || ''} ${res?.data?.nombres || ''}`.trim();
        if (nombre) this.guia.nombreConductor = nombre;
        else iziToast.info({ title: 'Sin nombre', message: 'No se obtuvo el nombre del DNI.', position: 'topRight' });
        this.consultandoConductor = false;
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el DNI.', position: 'topRight' });
        this.consultandoConductor = false;
      }
    });
  }

  /** Consulta RUC (Factiliza) y completa razón social del destinatario. */
  consultarRucDestinatario(): void {
    const num = (this.destinatario.numeroDoc || '').toString().trim();
    if (num.length !== 11) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 11 dígitos del RUC.', position: 'topRight' });
      return;
    }
    this.destinatario.tipoDoc = '6';
    this.consultandoDestinatario = true;
    this.factilizaService.getRuc(num).subscribe({
      next: (res: any) => {
        const razon = res?.data?.razonSocial || res?.razonSocial || res?.data?.nombre || '';
        if (razon) this.destinatario.razonSocial = razon;
        this.consultandoDestinatario = false;
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el RUC.', position: 'topRight' });
        this.consultandoDestinatario = false;
      }
    });
  }

  /** Consulta DNI (Factiliza) y completa razón social del destinatario. */
  consultarDniDestinatario(): void {
    const num = (this.destinatario.numeroDoc || '').toString().trim();
    if (num.length !== 8) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 8 dígitos del DNI.', position: 'topRight' });
      return;
    }
    this.destinatario.tipoDoc = '1';
    this.consultandoDestinatario = true;
    this.factilizaService.getDni(num).subscribe({
      next: (res: any) => {
        const nombre = res?.data?.nombre || res?.nombre || `${res?.data?.apellidoPaterno || ''} ${res?.data?.apellidoMaterno || ''} ${res?.data?.nombres || ''}`.trim();
        if (nombre) this.destinatario.razonSocial = nombre;
        this.consultandoDestinatario = false;
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el DNI.', position: 'topRight' });
        this.consultandoDestinatario = false;
      }
    });
  }

  /** Al seleccionar transportista (transporte público) rellenar RUC y razón social si existen. */
  onTransportistaChange(): void {
    const id = this.guia.idTransportista;
    if (!id) {
      this.guia.rucTransportista = '';
      this.guia.razonSocialTransportista = '';
      return;
    }
    const t = this.transportistas.find((x: any) => x.idTransportista === id);
    if (t) {
      this.guia.rucTransportista = t.documento || t.ruc || '';
      this.guia.razonSocialTransportista = [t.nombres, t.apellidos].filter(Boolean).join(' ') || t.razonSocial || '';
    }
  }

  /** Consulta RUC transportista en SUNAT (Factiliza) y completa razón social. */
  consultarRucTransportista(): void {
    const ruc = (this.guia.rucTransportista || '').toString().trim();
    if (ruc.length !== 11) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 11 dígitos del RUC del transportista.', position: 'topRight' });
      return;
    }
    this.factilizaService.getRuc(ruc).subscribe({
      next: (res: any) => {
        const razon = res?.data?.razonSocial || res?.razonSocial || res?.data?.nombre || '';
        if (razon) {
          this.guia.razonSocialTransportista = razon;
        } else {
          iziToast.info({ title: 'Sin datos', message: 'No se obtuvo razón social para este RUC.', position: 'topRight' });
        }
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el RUC del transportista.', position: 'topRight' });
      }
    });
  }

  consultarAnexosOrigenPorRuc(): void {
    const ruc = this.comprobanteOrigen?.rucEmpresa || this.comprobanteOrigen?.rucEmisor;
    if (!ruc) {
      iziToast.warning({
        title: 'Sin RUC emisor',
        message: 'No hay RUC de emisor en el comprobante origen',
        position: 'topRight'
      });
      return;
    }
    this.factilizaService.getAnexoByRUC(ruc).subscribe({
      next: (res: any) => {
        this.anexosOrigen = res?.data || [];
        if (!this.anexosOrigen.length) {
          iziToast.info({
            title: 'Sin establecimientos',
            message: 'El RUC emisor no tiene anexos en SUNAT',
            position: 'topRight'
          });
        }
      },
      error: () => {
        iziToast.error({
          title: 'Error',
          message: 'No se pudieron obtener los establecimientos del emisor',
          position: 'topRight'
        });
      }
    });
  }

  consultarAnexosDestinoPorRuc(): void {
    const ruc = this.comprobanteOrigen?.documento_cliente || this.comprobanteOrigen?.rucCliente;
    if (!ruc) {
      iziToast.warning({
        title: 'Sin RUC destino',
        message: 'El comprobante no tiene RUC del destinatario',
        position: 'topRight'
      });
      return;
    }
    this.factilizaService.getAnexoByRUC(ruc).subscribe({
      next: (res: any) => {
        this.anexosDestino = res?.data || [];
        if (!this.anexosDestino.length) {
          iziToast.info({
            title: 'Sin establecimientos',
            message: 'El RUC destino no tiene anexos en SUNAT',
            position: 'topRight'
          });
        }
      },
      error: () => {
        iziToast.error({
          title: 'Error',
          message: 'No se pudieron obtener los establecimientos del destinatario',
          position: 'topRight'
        });
      }
    });
  }

  guardarGuia(): void {
    iziToast.info({
      title: 'Pendiente',
      message: 'Registro y envío de la guía se implementará en el backend (UBL + SUNAT).',
      position: 'topRight'
    });
  }

  descargarPdf(): void {
    iziToast.info({
      title: 'Pendiente',
      message: 'Descarga de PDF de guía se implementará con el servicio configurado (SUNAT / Factiliza).',
      position: 'topRight'
    });
  }

  enviarWhatsapp(): void {
    iziToast.info({
      title: 'Pendiente',
      message: 'Envío de guía por WhatsApp se implementará usando WhatsApp Factiliza.',
      position: 'topRight'
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}

