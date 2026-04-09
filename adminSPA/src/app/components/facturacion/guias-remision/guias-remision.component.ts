import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FacturacionService,
  GuiaDetalle,
  RegistrarGuiaPayload,
  RegistrarGuiaResponse
} from '../../../services/facturacion.service';
import { EmpresaService } from '../../../services/empresa.service';
import { FactilizaService } from '../../../services/factiliza.service';
import { CatalogosService } from '../../../services/catalogos.service';
import { EnviosService } from '../../../services/envios.service';
import { PdfService } from '../../../services/pdf.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

declare const iziToast: any;

const CLAVES_NUMERO_LICENCIA = [
  'numeroLicencia',
  'numero_licencia',
  'nroLicencia',
  'nro_licencia',
  'licencia',
  'numeroCredencial',
  'credencial',
  'numero',
  'codigo',
  'nro',
  'valor',
  'value'
];

/** Recorre objeto Factiliza; nunca usa String(obj) sobre objetos (evita "[object Object]"). */
function extraerNumeroLicenciaDesdeObjeto(obj: Record<string, unknown>, depth: number): string {
  if (depth > 5) return '';
  for (const k of CLAVES_NUMERO_LICENCIA) {
    const v = obj[k];
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number') {
      const s = String(v).trim();
      if (s) return s;
    }
    if (typeof v === 'object' && !Array.isArray(v)) {
      const nested = extraerNumeroLicenciaDesdeObjeto(v as Record<string, unknown>, depth + 1);
      if (nested) return nested;
    }
  }
  return '';
}

/** Extrae número de licencia desde la respuesta de Factiliza GET /licencia/info/{dni}. */
function extraerNumeroLicenciaConductor(raw: unknown): string {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!o) return '';
  const innerRaw = o['data'];
  const inner =
    innerRaw !== undefined && innerRaw !== null && typeof innerRaw === 'object' && !Array.isArray(innerRaw)
      ? (innerRaw as Record<string, unknown>)
      : o;
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return '';
  return extraerNumeroLicenciaDesdeObjeto(inner, 0);
}

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
  private pdfService = inject(PdfService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

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
  guardandoGuia = false;
  generandoPdf = false;
  ultimaGuiaRegistrada: { serie: string; numero: string; idGuiaElectronica?: string } | null = null;

  /** Modo edición: PUT /guias/:id (desde emisión de guías ?editar=uuid). */
  idGuiaEdicion: string | null = null;
  etiquetaEdicion = '';
  cargandoEdicion = false;

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
        forkJoin({
          dir: this.empresaService.getDireccionEmpresa_id().pipe(catchError(() => of({ data: [] }))),
          mot: this.catalogosService.codigosSunatMotivoTraslado().pipe(catchError(() => of({ data: [] }))),
          trans: this.enviosService.obtenerTransportistas().pipe(catchError(() => of({ data: [] })))
        }).subscribe({
          next: ({ dir, mot, trans }) => {
            this.direccionesEmpresa = dir?.data || [];
            const m = mot?.data || [];
            this.motivosTraslado = m.length > 0 ? m : this.motivosTrasladoFallback();
            this.transportistas = trans?.data || [];
            this.tryCargarEdicionDesdeQuery();
          },
          error: () => {
            this.direccionesEmpresa = [];
            this.motivosTraslado = this.motivosTrasladoFallback();
            this.transportistas = [];
            iziToast.error({
              title: 'Error',
              message: 'No se pudieron cargar datos auxiliares del formulario.',
              position: 'topRight'
            });
            this.tryCargarEdicionDesdeQuery();
          }
        });
      },
      error: () => {
        this.autorizado = false;
      }
    });
  }

  private motivosTrasladoFallback(): { codigoSunat: string; descripcion: string }[] {
    return [
      { codigoSunat: '01', descripcion: 'Venta' },
      { codigoSunat: '02', descripcion: 'Compra' },
      { codigoSunat: '04', descripcion: 'Traslado entre establecimientos' },
      { codigoSunat: '08', descripcion: 'Importación' },
      { codigoSunat: '09', descripcion: 'Exportación' },
      { codigoSunat: '13', descripcion: 'Otros' }
    ];
  }

  private tryCargarEdicionDesdeQuery(): void {
    const id = this.route.snapshot.queryParamMap.get('editar');
    if (id) {
      this.cargarGuiaParaEdicion(id);
    }
  }

  cargarGuiaParaEdicion(id: string): void {
    this.cargandoEdicion = true;
    this.facturacionService.obtenerGuia(id).subscribe({
      next: (res) => {
        this.cargandoEdicion = false;
        const g = res.data;
        const st = g.idEstadoSunat;
        if (st === 1 || st === 2) {
          iziToast.warning({
            title: 'No editable',
            message:
              st === 2
                ? 'La guía tiene un envío en proceso. No se puede editar hasta conocer el resultado en SUNAT.'
                : 'La guía ya fue aceptada por SUNAT.',
            position: 'topRight'
          });
          void this.router.navigate(['/facturacion/emision-guias'], { replaceUrl: true });
          return;
        }
        if (!g.datosGuia || typeof g.datosGuia !== 'object') {
          iziToast.error({
            title: 'Error',
            message: 'La guía no tiene datos JSON para editar.',
            position: 'topRight'
          });
          return;
        }
        this.idGuiaEdicion = id;
        this.etiquetaEdicion = `${g.serie}-${g.numero}`;
        this.rellenarFormularioDesdeGuia(g);
      },
      error: () => {
        this.cargandoEdicion = false;
        iziToast.error({ title: 'Error', message: 'No se pudo cargar la guía para editar.', position: 'topRight' });
      }
    });
  }

  salirModoEdicion(): void {
    this.idGuiaEdicion = null;
    this.etiquetaEdicion = '';
    void this.router.navigate(['/facturacion/guias-remision'], { replaceUrl: true });
  }

  private rellenarFormularioDesdeGuia(g: GuiaDetalle): void {
    const d = g.datosGuia!;
    this.guia.tipoGuia = (d.tipoGuia as string) === 'TRANSPORTISTA' ? 'TRANSPORTISTA' : 'REMITENTE';
    this.guia.motivoTraslado = String(d.motivoTraslado || '');
    this.guia.descripcionMotivo = d.descripcionMotivo || '';
    this.guia.modalidadTransporte = d.modalidadTransporte === '01' ? '01' : '02';
    this.guia.fechaInicioTraslado = (d.fechaEmision || g.fechaEmision || '').slice(0, 10);
    this.guia.horaInicioTraslado = d.horaInicioTraslado || '';
    this.guia.cantidadPeso = d.cantidadPeso ?? null;
    this.guia.unidadMedidaPeso = d.unidadMedidaPeso || 'KGM';
    this.guia.placaVehiculo = d.placaVehiculo || '';
    this.guia.placaSecundaria = d.placaSecundaria || '';
    this.guia.tipoDocConductor = d.tipoDocConductor || '1';
    this.guia.numeroDocConductor = d.numeroDocConductor || '';
    this.guia.nombreConductor = d.nombreConductor || '';
    this.guia.licenciaConductor = d.licenciaConductor || '';
    this.guia.rucTransportista = d.rucTransportista || '';
    this.guia.razonSocialTransportista = d.razonSocialTransportista || '';
    this.guia.observaciones = d.observaciones || '';

    this.destinatario.tipoDoc = String(d.tipoDocDestinatario || '6').trim();
    this.destinatario.numeroDoc = d.numDocDestinatario || '';
    this.destinatario.razonSocial = d.nomDestinatario || '';

    const ubiO = String(d.ubigeoOrigen || '').replace(/\D/g, '');
    const dirO = (d.dirOrigen || '').trim();
    this.direccionOrigenSeleccionada =
      this.direccionesEmpresa.find(
        (x: any) =>
          String(x.ubigeo || '')
            .replace(/\D/g, '') === ubiO && String(x.direccion || '').trim() === dirO
      ) || (dirO ? { direccion: dirO, ubigeo: ubiO, referencia: 'Desde guía guardada' } : null);

    const ubiD = String(d.ubigeoDestino || '').replace(/\D/g, '');
    const dirD = (d.dirDestino || '').trim();
    this.direccionesDestinoLocal = [];
    if (dirD) {
      const dest = { direccion: dirD, ubigeo: ubiD, referencia: 'Desde guía guardada' };
      this.direccionesDestinoLocal.push(dest);
      this.direccionDestinoSeleccionada = dest;
    } else {
      this.direccionDestinoSeleccionada = null;
    }

    this.guia.idTransportista = null;
    const rucT = (d.rucTransportista || '').trim();
    if (rucT) {
      const tr = this.transportistas.find((x: any) => String(x.documento || x.ruc || '').trim() === rucT);
      if (tr) {
        this.guia.idTransportista = tr.idTransportista;
      }
    }

    const serieC = (g.comprobanteOrigenSerie || d.comprobanteOrigenSerie || '').trim();
    const numRaw = String(g.comprobanteOrigenNumero || d.comprobanteOrigenNumero || '').trim();
    this.buscarSerie = serieC;
    this.buscarNumero = numRaw.replace(/^0+/, '') || numRaw;

    this.comprobanteOrigen = null;
    if (serieC && numRaw) {
      this.facturacionService
        .buscarComprobanteOrigenParaGuia({ serie: serieC, numero: this.buscarNumero })
        .subscribe({
          next: (res: any) => {
            if (res?.data) {
              this.comprobanteOrigen = res.data;
            } else {
              this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
            }
          },
          error: () => {
            this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
          }
        });
    } else {
      this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
    }
  }

  private comprobanteOrigenSinteticoDesdeGuia(
    g: GuiaDetalle,
    d: NonNullable<GuiaDetalle['datosGuia']>
  ): Record<string, unknown> {
    const items = Array.isArray(d.items) ? d.items : [];
    const num = String(g.comprobanteOrigenNumero || d.comprobanteOrigenNumero || '').trim();
    return {
      serie: g.comprobanteOrigenSerie || d.comprobanteOrigenSerie || '',
      numero: num.replace(/^0+/, '') || num,
      tipoComprobante: d.tipoComprobanteOrigen || '01',
      rucEmpresa: d.emisorRuc || d.rucEmisorDocumentoRelacionado || '',
      rucEmisor: d.emisorRuc || '',
      documento_cliente: d.numDocDestinatario,
      rucCliente: d.numDocDestinatario,
      cliente: d.nomDestinatario,
      clienteDireccion: d.dirDestino || '',
      items: items.map((it) => ({
        codigo: it.codigo || '',
        descripcion: it.descripcion || '',
        cantidad: Number(it.cantidad) || 1,
        unidad: it.unidad || 'NIU'
      }))
    };
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

  /** Consulta DNI (Factiliza) y completa nombre; en paralelo consulta licencia por el mismo DNI. */
  consultarDniConductor(): void {
    const num = (this.guia.numeroDocConductor || '').toString().trim();
    if (num.length !== 8) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 8 dígitos del DNI del conductor.', position: 'topRight' });
      return;
    }
    this.consultandoConductor = true;
    const licReq =
      this.guia.tipoDocConductor === '1'
        ? this.factilizaService.getLicencia(num).pipe(catchError(() => of(null)))
        : of(null);

    forkJoin({
      dni: this.factilizaService.getDni(num),
      lic: licReq
    }).subscribe({
      next: ({ dni: res, lic: licRes }: { dni: any; lic: any }) => {
        const nombre =
          res?.data?.nombre ||
          res?.nombre ||
          `${res?.data?.apellidoPaterno || ''} ${res?.data?.apellidoMaterno || ''} ${res?.data?.nombres || ''}`.trim();
        if (nombre) {
          this.guia.nombreConductor = nombre;
        } else {
          iziToast.info({ title: 'Sin nombre', message: 'No se obtuvo el nombre del DNI.', position: 'topRight' });
        }

        if (licRes) {
          const nroLic = extraerNumeroLicenciaConductor(licRes);
          if (nroLic) {
            this.guia.licenciaConductor = nroLic;
          }
        }

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
      const placaT = (t.placa || '').toString().trim();
      if (placaT) {
        this.guia.placaVehiculo = placaT;
      }
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
    // Validaciones previas al envío
    if (!this.comprobanteOrigen) {
      iziToast.warning({ title: 'Sin comprobante', message: 'Busque y seleccione un comprobante de origen.', position: 'topRight' });
      return;
    }
    if (!this.guia.motivoTraslado) {
      iziToast.warning({ title: 'Campo requerido', message: 'Seleccione el motivo de traslado.', position: 'topRight' });
      return;
    }
    if (!this.guia.fechaInicioTraslado) {
      iziToast.warning({ title: 'Campo requerido', message: 'Indique la fecha de inicio de traslado.', position: 'topRight' });
      return;
    }
    if (!this.direccionOrigenSeleccionada?.direccion) {
      iziToast.warning({ title: 'Campo requerido', message: 'Seleccione la dirección de origen.', position: 'topRight' });
      return;
    }
    if (!this.direccionDestinoSeleccionada?.direccion) {
      iziToast.warning({ title: 'Campo requerido', message: 'Indique la dirección de destino.', position: 'topRight' });
      return;
    }
    const ubiO = String(this.direccionOrigenSeleccionada?.ubigeo || '').replace(/\D/g, '');
    const ubiD = String(this.direccionDestinoSeleccionada?.ubigeo || '').replace(/\D/g, '');
    if (ubiO.length !== 6 || ubiD.length !== 6) {
      iziToast.warning({
        title: 'Ubigeo requerido',
        message:
          'Origen y destino deben tener ubigeo INEI de 6 dígitos (elija establecimientos SUNAT con ubigeo). SUNAT rechaza la GRE si el código de destino va vacío.',
        position: 'topRight'
      });
      return;
    }
    if (!this.destinatario.razonSocial) {
      iziToast.warning({ title: 'Campo requerido', message: 'Ingrese el nombre o razón social del destinatario.', position: 'topRight' });
      return;
    }
    if (!String(this.guia.placaVehiculo || '').trim()) {
      const msg =
        this.guia.modalidadTransporte === '01'
          ? 'SUNAT exige la placa del vehículo principal. Regístrela en el transportista o escríbala en «Placa vehículo».'
          : 'Ingrese la placa del vehículo principal.';
      iziToast.warning({ title: 'Campo requerido', message: msg, position: 'topRight' });
      return;
    }
    if (this.guia.modalidadTransporte === '02') {
      if (!String(this.guia.numeroDocConductor || '').trim()) {
        iziToast.warning({ title: 'Conductor', message: 'Ingrese el documento del conductor (transporte privado).', position: 'topRight' });
        return;
      }
      if (!String(this.guia.nombreConductor || '').trim()) {
        iziToast.warning({
          title: 'Conductor',
          message: 'Ingrese el nombre completo del conductor (nombres y apellidos) para el XML SUNAT.',
          position: 'topRight'
        });
        return;
      }
    }

    this.guardandoGuia = true;

    const payload: RegistrarGuiaPayload = {
      tipoGuia: this.guia.tipoGuia === 'TRANSPORTISTA' ? 'TRANSPORTISTA' : 'REMITENTE',
      motivoTraslado: this.guia.motivoTraslado,
      descripcionMotivo: this.guia.descripcionMotivo || '',
      fechaEmision: this.guia.fechaInicioTraslado,
      horaInicioTraslado: this.guia.horaInicioTraslado || '',
      cantidadPeso: this.guia.cantidadPeso ?? null,
      unidadMedidaPeso: this.guia.unidadMedidaPeso || 'KGM',
      modalidadTransporte: this.guia.modalidadTransporte,
      // Transporte privado
      placaVehiculo: this.guia.placaVehiculo || '',
      placaSecundaria: this.guia.placaSecundaria || '',
      tipoDocConductor: this.guia.tipoDocConductor || '1',
      numeroDocConductor: this.guia.numeroDocConductor || '',
      nombreConductor: this.guia.nombreConductor || '',
      licenciaConductor: this.guia.licenciaConductor || '',
      // Transporte público
      rucTransportista: this.guia.rucTransportista || '',
      razonSocialTransportista: this.guia.razonSocialTransportista || '',
      // Origen / Destino
      dirOrigen: this.direccionOrigenSeleccionada?.direccion || '',
      ubigeoOrigen: this.direccionOrigenSeleccionada?.ubigeo || '',
      dirDestino: this.direccionDestinoSeleccionada?.direccion || '',
      ubigeoDestino: this.direccionDestinoSeleccionada?.ubigeo || '',
      // Destinatario
      tipoDocDestinatario: this.destinatario.tipoDoc || '6',
      numDocDestinatario: this.destinatario.numeroDoc || '',
      nomDestinatario: this.destinatario.razonSocial || '',
      // Comprobante origen
      comprobanteOrigenSerie: this.comprobanteOrigen?.serie || '',
      comprobanteOrigenNumero: this.comprobanteOrigen?.numero || '',
      tipoComprobanteOrigen: this.comprobanteOrigen?.tipoComprobante || '01',
      rucEmisorDocumentoRelacionado: String(
        this.comprobanteOrigen?.rucEmpresa || this.comprobanteOrigen?.rucEmisor || ''
      ).trim(),
      items: (this.comprobanteOrigen?.items || []).map((it: any) => ({
        codigo: it.codigo || '',
        descripcion: it.descripcion || '',
        cantidad: Number(it.cantidad) || 1,
        unidad: it.unidad || 'NIU'
      })),
      observaciones: this.guia.observaciones || ''
    };

    const req = this.idGuiaEdicion
      ? this.facturacionService.actualizarGuia(this.idGuiaEdicion, payload)
      : this.facturacionService.registrarGuia(payload);

    req.subscribe({
      next: (res) => {
        this.guardandoGuia = false;
        const serie = res.data?.serie || '';
        const numero = res.data?.numero || '';
        if (this.idGuiaEdicion) {
          iziToast.success({
            title: 'Guía actualizada',
            message: res.message || `${serie}-${numero} guardada. Use Emisión de guías para enviar a SUNAT.`,
            position: 'topRight',
            timeout: 7000
          });
          this.idGuiaEdicion = null;
          this.etiquetaEdicion = '';
          void this.router.navigate(['/facturacion/emision-guias']);
          return;
        }
        this.ultimaGuiaRegistrada = {
          serie,
          numero,
          idGuiaElectronica: res.data?.idGuiaElectronica
        };
        const reg = res as RegistrarGuiaResponse;
        if (reg.aceptado) {
          iziToast.success({
            title: 'Guía aceptada',
            message: `${serie}-${numero} enviada y aceptada por SUNAT.`,
            position: 'topRight',
            timeout: 6000
          });
        } else if (reg.enviado === false && !reg.advertencia) {
          iziToast.success({
            title: 'Guía registrada',
            message: reg.message || `${serie}-${numero} guardada localmente.`,
            position: 'topRight',
            timeout: 6000
          });
        } else {
          iziToast.info({
            title: 'Guía registrada',
            message: reg.advertencia || reg.message || `${serie}-${numero} guardada.`,
            position: 'topRight',
            timeout: 8000
          });
        }
      },
      error: (err) => {
        this.guardandoGuia = false;
        const msg =
          err?.error?.message ||
          (this.idGuiaEdicion ? 'No se pudo actualizar la guía.' : 'No se pudo registrar la guía.');
        iziToast.error({ title: 'Error', message: msg, position: 'topRight', timeout: 8000 });
      }
    });
  }

  descargarPdf(): void {
    if (!this.ultimaGuiaRegistrada?.idGuiaElectronica) {
      iziToast.warning({ title: 'Sin guía', message: 'Primero guarde la guía para poder imprimir el PDF.', position: 'topRight' });
      return;
    }
    this.generandoPdf = true;
    this.facturacionService.obtenerGuia(this.ultimaGuiaRegistrada.idGuiaElectronica).subscribe({
      next: (res) => {
        // Reutilizamos el mismo método de generación HTML del componente emision-guias
        const guia = res.data;
        const html = this.construirHtmlGuia(guia);
        this.pdfService.generarPdfDinamico({ html }, 'guia-remision', 10, 'A4').subscribe({
          next: (blob) => {
            this.generandoPdf = false;
            this.pdfService.previsualizar(blob);
          },
          error: () => {
            this.generandoPdf = false;
            iziToast.error({ title: 'Error PDF', message: 'No se pudo generar el PDF. Verifique que el servicio de reportes esté activo.', position: 'topRight' });
          }
        });
      },
      error: () => {
        this.generandoPdf = false;
        iziToast.error({ title: 'Error', message: 'No se pudo obtener la guía para el PDF.', position: 'topRight' });
      }
    });
  }

  private construirHtmlGuia(guia: any): string {
    const d = guia?.datosGuia ?? {};
    const serie  = guia?.serie  ?? '';
    const numero = guia?.numero ?? '';
    const tipoDoc = guia?.tipoDocumento === '31' ? 'GUÍA DE REMISIÓN TRANSPORTISTA' : 'GUÍA DE REMISIÓN REMITENTE';
    const codSunat = guia?.tipoDocumento === '31' ? '31' : '09';
    const fecha = (guia?.fechaEmision ?? '').slice(0, 10);
    const motivoMap: Record<string, string> = {
      '01': 'Venta', '02': 'Compra', '04': 'Traslado entre establecimientos',
      '08': 'Importación', '09': 'Exportación', '13': 'Otros'
    };
    const motivo = motivoMap[d.motivoTraslado ?? ''] || d.motivoTraslado || '—';
    const modalidad = d.modalidadTransporte === '01' ? 'Público' : 'Privado';
    const peso = d.cantidadPeso != null ? `${d.cantidadPeso} ${d.unidadMedidaPeso ?? 'KGM'}` : '—';

    const itemsRows = (d.items ?? []).map((it: any, i: number) =>
      `<tr><td>${i + 1}</td><td>${it.codigo ?? ''}</td><td>${it.descripcion ?? ''}</td><td>${it.cantidad ?? ''}</td><td>${it.unidad ?? 'NIU'}</td></tr>`
    ).join('') || `<tr><td colspan="5" style="text-align:center;color:#888">Sin detalle de bienes</td></tr>`;

    const conductorBloque = d.modalidadTransporte === '02' ? `
      <tr><td style="font-weight:600">Conductor</td><td>${d.nombreConductor ?? '—'}</td><td style="font-weight:600">Doc.</td><td>${d.numeroDocConductor ?? '—'}</td></tr>
      <tr><td style="font-weight:600">Licencia</td><td>${d.licenciaConductor ?? '—'}</td><td style="font-weight:600">Placa</td><td>${d.placaVehiculo ?? '—'}${d.placaSecundaria ? ' / ' + d.placaSecundaria : ''}</td></tr>` : '';
    const transportistaBloque = d.modalidadTransporte === '01' ? `
      <tr><td style="font-weight:600">Transportista</td><td>${d.razonSocialTransportista ?? '—'}</td><td style="font-weight:600">RUC</td><td>${d.rucTransportista ?? '—'}</td></tr>` : '';

    const estadoLabel = guia?.idEstadoSunat === 1 ? '<span style="color:#15803d;font-weight:700">ACEPTADA</span>'
      : guia?.idEstadoSunat === 98 ? '<span style="color:#b91c1c;font-weight:700">ERROR</span>'
      : '<span style="color:#78716c;font-weight:700">PENDIENTE</span>';

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a1a;padding:16px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:12px}
.empresa h2{font-size:13px;color:#1d4ed8;margin-bottom:4px}.empresa p{font-size:9px;color:#555;line-height:1.5}
.doc-box{border:2px solid #1d4ed8;border-radius:6px;padding:8px 14px;text-align:center;min-width:160px}
.doc-box .tipo{font-size:9px;font-weight:700;color:#1d4ed8}.doc-box .serie{font-size:16px;font-weight:900}
table.info{width:100%;border-collapse:collapse;margin-bottom:10px}
table.info td{padding:3px 6px;border:1px solid #e5e7eb;font-size:9px}
table.info td:first-child,table.info td:nth-child(3){width:18%;background:#f1f5f9;font-weight:600;color:#374151}
.sec{background:#1d4ed8;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;margin:8px 0 4px;border-radius:3px}
table.items{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px}
table.items th{background:#1d4ed8;color:#fff;padding:4px 6px;text-align:left}
table.items td{padding:3px 6px;border-bottom:1px solid #e5e7eb}
.footer{margin-top:14px;text-align:center;font-size:8px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:6px}
.firma-box{margin-top:28px;display:flex;justify-content:space-around;text-align:center;font-size:9px}
.firma-box div{border-top:1px solid #374151;padding-top:4px;min-width:140px}</style></head><body>
<div class="header">
  <div class="empresa"><h2>${d.emisorNombre ?? 'Empresa'}</h2><p>RUC: ${d.emisorRuc ?? '—'}</p><p>${d.dirOrigen ?? ''}</p></div>
  <div class="doc-box"><div class="tipo">${tipoDoc}</div><div style="font-size:7px;color:#666">Tipo doc.: ${codSunat}</div>
    <div class="serie">${serie}-${numero}</div><div style="margin-top:4px;font-size:9px">${estadoLabel}</div></div>
</div>
<div class="sec">DATOS DEL TRASLADO</div>
<table class="info">
  <tr><td>Fecha</td><td>${fecha}</td><td>Hora</td><td>${d.horaInicioTraslado ?? '—'}</td></tr>
  <tr><td>Motivo</td><td>${motivo}${d.descripcionMotivo ? ' — ' + d.descripcionMotivo : ''}</td><td>Modalidad</td><td>${modalidad}</td></tr>
  <tr><td>Peso bruto</td><td>${peso}</td><td>Doc. origen</td><td>${d.comprobanteOrigenSerie && d.comprobanteOrigenNumero ? d.comprobanteOrigenSerie + '-' + d.comprobanteOrigenNumero : '—'}</td></tr>
</table>
<div class="sec">DESTINATARIO</div>
<table class="info">
  <tr><td>Nombre</td><td colspan="3">${d.nomDestinatario ?? '—'}</td></tr>
  <tr><td>Tipo doc.</td><td>${d.tipoDocDestinatario === '6' ? 'RUC' : d.tipoDocDestinatario === '1' ? 'DNI' : d.tipoDocDestinatario ?? '—'}</td><td>Nº</td><td>${d.numDocDestinatario ?? '—'}</td></tr>
</table>
<div class="sec">DIRECCIONES</div>
<table class="info">
  <tr><td>Origen</td><td colspan="3">${d.dirOrigen ?? '—'}</td></tr>
  <tr><td>Destino</td><td colspan="3">${d.dirDestino ?? '—'}</td></tr>
</table>
<div class="sec">TRANSPORTE</div>
<table class="info">${conductorBloque}${transportistaBloque}</table>
<div class="sec">BIENES TRASLADADOS</div>
<table class="items"><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Unidad</th></tr></thead>
<tbody>${itemsRows}</tbody></table>
${d.observaciones ? `<div style="font-size:9px;color:#555;margin-top:6px;padding:6px 8px;background:#fafafa;border:1px solid #e5e7eb;border-radius:3px"><strong>Obs.:</strong> ${d.observaciones}</div>` : ''}
<div class="firma-box"><div>Firma y sello emisor</div><div>Firma receptor conforme</div></div>
<div class="footer">Documento generado electrónicamente — Estado: ${guia?.descripcionEstado ?? 'Pendiente'}</div>
</body></html>`;
  }

  enviarWhatsapp(): void {
    iziToast.info({
      title: 'Acción disponible en Emisión de guías',
      message: 'Primero guarde la guía y use el botón WhatsApp en la tabla de Emisión de guías.',
      position: 'topRight'
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}

