import { Component, OnInit, inject, TemplateRef, ViewChild } from '@angular/core';
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
import { ClienteService } from '../../../services/cliente.service';
import { VehiculosService, VehiculoRegistro } from '../../../services/vehiculos.service';
import { PdfService } from '../../../services/pdf.service';
import { htmlBloqueQrSunatGre, qrDataUrlParaPdfGuia } from '../../../utils/guia-representacion-impresa-qr.util';
import {
  estilosGrePdfInline,
  greItemsTablaHtml,
  htmlFirmasGreTransportista,
  type GrePdfFormato
} from '../../../utils/guia-pdf-html.util';
import { NgbModal, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConsultaXMLService } from '../../../services/consulta-xml.service';
import { mapearSunatCompraNormalizadoAComprobanteOrigenGre } from '../utils/gre-consulta-compra-sunat.mapper';
import { ProveedoresService } from '../../../services/proveedores.service';
import {
  ProveedorGreListado,
  SeleccionarProveedorGreModalComponent
} from '../seleccionar-proveedor-gre-modal/seleccionar-proveedor-gre-modal.component';

declare const iziToast: any;

/** Línea de bien trasladado cargada manualmente (sin comprobante de venta/compra). */
export interface ItemManualGreTransportista {
  codigo: string;
  descripcion: string;
  cantidad: number | null;
  unidad: string;
}

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

/**
 * Construye nombre completo priorizando nombres + apellidos del DNI.
 * Si el proveedor no envía partes separadas, usa nombre como fallback.
 */
function extraerNombreCompletoDesdeDni(raw: unknown): string {
  const normalizarTexto = (value: unknown): string => {
    const txt = String(value ?? '').replace(/\s+/g, ' ').trim();
    return txt;
  };

  const tomarPrimero = (obj: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
      const val = obj[key];
      if (typeof val === 'string' || typeof val === 'number') {
        const limpio = normalizarTexto(val);
        if (limpio) return limpio;
      }
    }
    return '';
  };

  const extraerDesdeObjeto = (obj: Record<string, unknown>, depth: number): string => {
    if (depth > 6) return '';

    const apellidoPaterno = tomarPrimero(obj, ['apellidoPaterno', 'apellido_paterno', 'paterno', 'ApellidoPaterno']);
    const apellidoMaterno = tomarPrimero(obj, ['apellidoMaterno', 'apellido_materno', 'materno', 'ApellidoMaterno']);
    const nombres = tomarPrimero(obj, ['nombres', 'Nombres', 'prenombres']);
    const compuesto = [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ').trim();
    if (compuesto) return compuesto;

    const nombreCompleto = tomarPrimero(obj, ['nombreCompleto', 'nombre_completo', 'fullName', 'nombre', 'razonSocial']);
    if (nombreCompleto) return nombreCompleto;

    // Factiliza puede devolver payload en data/resultado/result/persona u otros objetos anidados.
    const nestedKeys = ['data', 'resultado', 'result', 'persona', 'reniec', 'cliente'];
    for (const key of nestedKeys) {
      const nested = obj[key];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const nombre = extraerDesdeObjeto(nested as Record<string, unknown>, depth + 1);
        if (nombre) return nombre;
      }
    }

    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const nombre = extraerDesdeObjeto(val as Record<string, unknown>, depth + 1);
        if (nombre) return nombre;
      }
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === 'object') {
            const nombre = extraerDesdeObjeto(item as Record<string, unknown>, depth + 1);
            if (nombre) return nombre;
          }
        }
      }
    }
    return '';
  };

  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!o) return '';
  return extraerDesdeObjeto(o, 0);
}

/** Tipos de documento SUNAT (catálogo 06): 1=DNI, 6=RUC, 7=Pasaporte */
const TIPOS_DOC = [
  { value: '1', label: 'DNI' },
  { value: '6', label: 'RUC' },
  { value: '7', label: 'Pasaporte' }
];

/** Unidad de medida de peso SUNAT: KGM = Kilogramo, TNE = Tonelada métrica */
const UNIDADES_PESO = [
  { value: 'KGM', label: 'Kilogramo (kg)' },
  { value: 'TNE', label: 'Tonelada (t)' }
];

/** Catálogo 61 — documento relacionado al transporte (GRE 31 suele referenciar GR 09). */
const TIPOS_DOC_RELACION_TRANSPORTISTA = [
  { value: '01', label: 'Factura (01)' },
  { value: '03', label: 'Boleta (03)' },
  { value: '09', label: 'Guía remisión remitente (09)' }
];

const PAGADORES_FLETE_GRE = [
  { value: '', label: 'Sin indicador SUNAT' },
  { value: 'REMITENTE', label: 'Pagador del flete: remitente' },
  { value: 'DESTINATARIO', label: 'Pagador del flete: destinatario' },
  { value: 'TRANSPORTISTA', label: 'Pagador del flete: transportista' }
];

@Component({
  selector: 'app-guias-transportista',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SeleccionarProveedorGreModalComponent
  ],
  templateUrl: './guias-transportista.component.html',
  styleUrl: './guias-transportista.component.css'
})
export class GuiasTransportistaComponent implements OnInit {

  public sidebarState = inject(SidebarStateService);

  private facturacionService = inject(FacturacionService);
  private empresaService = inject(EmpresaService);
  private factilizaService = inject(FactilizaService);
  private clienteService = inject(ClienteService);
  private vehiculosService = inject(VehiculosService);
  private consultaXmlService = inject(ConsultaXMLService);
  private proveedoresService = inject(ProveedoresService);
  private pdfService = inject(PdfService);
  private modalService = inject(NgbModal);
  private router = inject(Router);

  @ViewChild('modalFormatoGrePdf') modalFormatoGrePdfTpl!: TemplateRef<unknown>;
  private route = inject(ActivatedRoute);

  readonly tiposDoc = TIPOS_DOC;
  readonly unidadesPeso = UNIDADES_PESO;
  readonly tiposDocRelacionTransportista = TIPOS_DOC_RELACION_TRANSPORTISTA;
  readonly pagadoresFleteGre = PAGADORES_FLETE_GRE;

  /** Si la empresa no tiene habilitada la emisión de guías, se bloquea el uso. */
  autorizado = true;

  /** Ya no se usa en GRE transportista (tipo 31); se mantiene por compatibilidad de edición. */
  motivosTraslado: { codigoSunat: string; descripcion: string }[] = [];
  /** Vehículos registrados en la empresa (tabla Vehiculos) */
  vehiculosEmpresa: VehiculoRegistro[] = [];

  // Selección de comprobante origen
  buscarSerie = '';
  buscarNumero = '';
  comprobanteOrigen: any = null;

  /**
   * Cómo se cargan los bienes (solo UI). GRE 31 no envía HandlingCode / motivo a SUNAT.
   */
  origenBienesTransporte: 'venta' | 'compra' | 'manual' = 'venta';

  /**
   * desde_comprobante: venta interna o compra SUNAT (flujo previo).
   * manual: ítems ingresados a mano; serie/número de documento relacionado (cat. 61) opcionales.
   */
  modoItemsTransportista: 'desde_comprobante' | 'manual' = 'desde_comprobante';

  itemsManualesGre: ItemManualGreTransportista[] = [
    { codigo: '', descripcion: '', cantidad: 1, unidad: 'NIU' }
  ];

  /** Factura/boleta de compra vía Factiliza (tipo doc. relacionado 01 o 03). */
  compraSunat = {
    rucMiEmpresa: '',
    usuarioSol: '',
    passwordSol: '',
    rucProveedor: ''
  };
  consultandoCompraSunat = false;

  modalProveedorGreVisible = false;
  direccionesOrigenProveedorGre: any[] = [];
  usarOrigenDireccionesProveedor = false;

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

  /** Remitente de la mercadería (GRE transportista — SUNAT DespatchParty) */
  remitente: { tipoDoc: string; numeroDoc: string; razonSocial: string } = {
    tipoDoc: '6',
    numeroDoc: '',
    razonSocial: ''
  };
  consultandoRemitente = false;

  /** Vehículo elegido del catálogo empresa (opcional; rellena placa) */
  idVehiculoEmpresa: string | null = null;

  // Datos de traslado (campos obligatorios GRE transportista — sin motivo de traslado)
  guia: any = {
    motivoTraslado: '',           // No aplica a GRE 31; se deja vacío
    descripcionMotivo: '',
    modalidadTransporte: '02',    // Fijo para payload; el XML transportista no usa modalidad SUNAT
    vehiculoM1L: false,
    fechaInicioTraslado: '',
    horaInicioTraslado: '',       // HH:mm
    cantidadPeso: null as number | null,
    unidadMedidaPeso: 'KGM',   // KGM = Kilogramo, TNE = Tonelada
    placaVehiculo: '',
    placaSecundaria: '',
    // Conductor (obligatorio salvo M1/L)
    tipoDocConductor: '1',
    numeroDocConductor: '',
    nombreConductor: '',
    licenciaConductor: '',
    observaciones: '',
    /** Documento relacionado (cat. 61): 01 factura, 03 boleta, 09 GR remitente */
    tipoComprobanteOrigen: '01',
    /** RUC de quien emitió el documento relacionado (obligatorio si tipo 09) */
    rucEmisorDocumentoRelacionado: '',
    /** Inscripción MTC del transportista (XML CarrierParty/CompanyID en GRE 31) */
    nroMtcTransportista: '',
    /** Registro MTC del vehículo (RegistrationNationalityID) */
    registroMtcVehiculo: '',
    /** REMITENTE | DESTINATARIO | TRANSPORTISTA */
    indicadorPagadorFlete: ''
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
          veh: this.vehiculosService.listarVehiculos().pipe(catchError(() => of({ data: [] }))),
          cfg: this.facturacionService.obtenerConfiguracion().pipe(catchError(() => of({ data: null })))
        }).subscribe({
          next: ({ dir, veh, cfg }) => {
            this.direccionesEmpresa = dir?.data || [];
            this.vehiculosEmpresa = veh?.data || [];
            const c = cfg?.data;
            if (c) {
              const rucCfg = String(c.rucEmpresa || '')
                .replace(/\D/g, '')
                .slice(0, 11);
              if (rucCfg.length === 11) {
                this.compraSunat.rucMiEmpresa = rucCfg;
              }
              if (c.usuarioSunat) {
                this.compraSunat.usuarioSol = String(c.usuarioSunat).trim();
              }
            }
            const emp = this.empresaService.getEmpresaActual();
            const rucEmp = String(emp?.ruc || '')
              .replace(/\D/g, '')
              .slice(0, 11);
            if (rucEmp.length === 11 && !this.guia.rucEmisorDocumentoRelacionado) {
              this.guia.rucEmisorDocumentoRelacionado = rucEmp;
            }
            this.tryCargarEdicionDesdeQuery();
          },
          error: () => {
            this.direccionesEmpresa = [];
            this.vehiculosEmpresa = [];
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
    return [];
  }

  private sincronizarOrigenBienesDesdeMotivoLegacy(): void {
    if (this.guia.motivoTraslado === '02') {
      this.origenBienesTransporte = 'compra';
    } else if (this.modoItemsTransportista === 'manual') {
      this.origenBienesTransporte = 'manual';
    } else {
      this.origenBienesTransporte = 'venta';
    }
  }

  onOrigenBienesTransporteChange(): void {
    if (this.origenBienesTransporte === 'manual') {
      this.setModoItemsTransportista('manual');
    } else {
      this.setModoItemsTransportista('desde_comprobante');
    }
    // Compatibilidad interna: compra = flujo direcciones proveedor (antes motivo 02)
    this.guia.motivoTraslado = this.origenBienesTransporte === 'compra' ? '02' : '';
    this.guia.descripcionMotivo = '';
    this.onMotivoTrasladoGreChange();
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
        if (String(g.tipoDocumento || '') !== '31') {
          iziToast.info({
            title: 'Redirigiendo',
            message: 'Esta guía es remitente (09). Se abrirá el formulario de guías remitente.',
            position: 'topRight'
          });
          void this.router.navigate(['/facturacion/guias-remision'], { queryParams: { editar: id }, replaceUrl: true });
          return;
        }
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
    void this.router.navigate(['/facturacion/guias-transportista'], { replaceUrl: true });
  }

  private rellenarFormularioDesdeGuia(g: GuiaDetalle): void {
    const d = g.datosGuia!;
    this.guia.motivoTraslado = String(d.motivoTraslado || '');
    this.guia.descripcionMotivo = d.descripcionMotivo || '';
    this.sincronizarOrigenBienesDesdeMotivoLegacy();
    this.guia.modalidadTransporte = '02';
    this.guia.vehiculoM1L = Boolean(d.vehiculoM1L);
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
    this.guia.observaciones = d.observaciones || '';
    this.guia.tipoComprobanteOrigen = String(d.tipoComprobanteOrigen || '01').trim();
    this.guia.rucEmisorDocumentoRelacionado = String(
      d.rucEmisorDocumentoRelacionado || d.emisorRuc || ''
    ).replace(/\D/g, '').slice(0, 11);
    this.guia.nroMtcTransportista = String(d.nroMtcTransportista || '').trim();
    this.guia.registroMtcVehiculo = String(d.registroMtcVehiculo || '').trim();
    this.guia.indicadorPagadorFlete = String(d.indicadorPagadorFlete || '').trim().toUpperCase();

    this.remitente.tipoDoc = String(d.tipoDocRemitente || '6').trim();
    this.remitente.numeroDoc = d.numDocRemitente || '';
    this.remitente.razonSocial = d.nomRemitente || '';
    this.idVehiculoEmpresa = d.idVehiculoEmpresa || null;

    this.destinatario.tipoDoc = String(d.tipoDocDestinatario || '6').trim();
    this.destinatario.numeroDoc = d.numDocDestinatario || '';
    this.destinatario.razonSocial = d.nomDestinatario || '';

    const ubiO = String(d.ubigeoOrigen || '').replace(/\D/g, '');
    const dirO = (d.dirOrigen || '').trim();
    const origenMatchExacto = this.direccionesEmpresa.find(
      (x: any) =>
        String(x.ubigeo || '')
          .replace(/\D/g, '') === ubiO && String(x.direccion || '').trim() === dirO
    );
    const origenMatchDireccion = this.direccionesEmpresa.find(
      (x: any) => String(x.direccion || '').trim() === dirO
    );
    this.direccionOrigenSeleccionada =
      origenMatchExacto ||
      origenMatchDireccion ||
      (dirO
        ? {
            direccion: dirO,
            ubigeo: ubiO,
            codLocal: String(d.codLocalOrigen || '').trim(),
            region: d.departamentoOrigen || '',
            provincia: d.provinciaOrigen || '',
            distrito: d.distritoOrigen || '',
            referencia: 'Desde guía guardada'
          }
        : null);

    const ubiD = String(d.ubigeoDestino || '').replace(/\D/g, '');
    const dirD = (d.dirDestino || '').trim();
    this.direccionesDestinoLocal = [];
    if (dirD) {
      const dest = {
        direccion: dirD,
        ubigeo: ubiD,
        codLocal: String(d.codLocalDestino || '').trim(),
        region: d.departamentoDestino || '',
        provincia: d.provinciaDestino || '',
        distrito: d.distritoDestino || '',
        referencia: 'Desde guía guardada'
      };
      this.direccionesDestinoLocal.push(dest);
      this.direccionDestinoSeleccionada = dest;
    } else {
      this.direccionDestinoSeleccionada = null;
    }

    const serieC = (g.comprobanteOrigenSerie || d.comprobanteOrigenSerie || '').trim();
    const numRaw = String(g.comprobanteOrigenNumero || d.comprobanteOrigenNumero || '').trim();
    this.buscarSerie = serieC;
    this.buscarNumero = numRaw.replace(/^0+/, '') || numRaw;

    const itemsD = Array.isArray(d.items) ? d.items : [];
    const soloLineaGre09 =
      itemsD.length === 1 &&
      String((itemsD[0] as { unidad?: string })?.unidad || '')
        .toUpperCase()
        .trim() === 'ZZ' &&
      /SEGUN\s+DOCUMENTOS/i.test(String((itemsD[0] as { descripcion?: string })?.descripcion || ''));
    const tieneDocRelacion = Boolean(serieC && numRaw);

    this.comprobanteOrigen = null;

    if (!tieneDocRelacion && itemsD.length > 0 && !soloLineaGre09) {
      this.modoItemsTransportista = 'manual';
      this.itemsManualesGre = itemsD.map((it: { codigo?: string; descripcion?: string; cantidad?: unknown; unidad?: string }) => ({
        codigo: String(it.codigo ?? ''),
        descripcion: String(it.descripcion ?? ''),
        cantidad:
          it.cantidad != null && it.cantidad !== ''
            ? Number(it.cantidad)
            : null,
        unidad: String(it.unidad ?? 'NIU').trim() || 'NIU'
      }));
      if (this.itemsManualesGre.length === 0) {
        this.itemsManualesGre = [{ codigo: '', descripcion: '', cantidad: 1, unidad: 'NIU' }];
      }
      this.intentarAutocompletarUbigeoOrigen();
      this.sincronizarDestinoAlmacenSiCompra();
      return;
    }

    this.modoItemsTransportista = 'desde_comprobante';
    this.itemsManualesGre = [{ codigo: '', descripcion: '', cantidad: 1, unidad: 'NIU' }];

    if (serieC && numRaw) {
      this.facturacionService
        .buscarComprobanteOrigenParaGuia({ serie: serieC, numero: this.buscarNumero })
        .subscribe({
          next: (res: any) => {
            if (res?.data) {
              this.comprobanteOrigen = res.data;
              this.guia.tipoComprobanteOrigen = String(res.data.tipoComprobante || '01').trim();
              this.cargarDireccionesDestinoLocal(res.data);
              this.prefillDestinatarioDesdeComprobante(res.data);
              this.intentarAutocompletarUbigeoOrigen();
            } else {
              this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
              this.intentarAutocompletarUbigeoOrigen();
              this.sincronizarDestinoAlmacenSiCompra();
            }
          },
          error: () => {
            this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
            this.intentarAutocompletarUbigeoOrigen();
            this.sincronizarDestinoAlmacenSiCompra();
          }
        });
    } else {
      this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
      this.intentarAutocompletarUbigeoOrigen();
      this.sincronizarDestinoAlmacenSiCompra();
    }
  }

  private intentarAutocompletarUbigeoOrigen(): void {
    if (this.esMotivoCompraGre()) {
      return;
    }
    const ubigeoActual = String(this.direccionOrigenSeleccionada?.ubigeo || '').replace(/\D/g, '');
    if (ubigeoActual.length === 6) return;

    const direccionActual = String(this.direccionOrigenSeleccionada?.direccion || '').trim();
    const porDireccion = this.direccionesEmpresa.find(
      (x: any) =>
        String(x.direccion || '').trim() === direccionActual &&
        String(x.ubigeo || '').replace(/\D/g, '').length === 6
    );
    if (porDireccion) {
      this.direccionOrigenSeleccionada = porDireccion;
      return;
    }

    const principalValido = this.direccionesEmpresa.find(
      (x: any) =>
        (x?.principal === true || x?.principal === 1) &&
        String(x.ubigeo || '').replace(/\D/g, '').length === 6
    );
    if (principalValido) {
      this.direccionOrigenSeleccionada = principalValido;
    }
  }

  seccionesTransportistaVisibles(): boolean {
    if (this.guia.tipoComprobanteOrigen === '09') {
      return true;
    }
    return this.modoItemsTransportista === 'manual' || !!this.comprobanteOrigen;
  }

  setModoItemsTransportista(modo: 'desde_comprobante' | 'manual'): void {
    if (this.guia.tipoComprobanteOrigen === '09') {
      return;
    }
    this.modoItemsTransportista = modo;
    if (modo === 'manual') {
      this.comprobanteOrigen = null;
      if (this.origenBienesTransporte !== 'compra') {
        this.origenBienesTransporte = 'manual';
      }
    } else {
      this.itemsManualesGre = [{ codigo: '', descripcion: '', cantidad: 1, unidad: 'NIU' }];
      if (this.origenBienesTransporte === 'manual') {
        this.origenBienesTransporte = 'venta';
      }
    }
  }

  onTipoComprobanteOrigenGreChange(): void {
    if (this.guia.tipoComprobanteOrigen === '09') {
      this.modoItemsTransportista = 'desde_comprobante';
      this.itemsManualesGre = [{ codigo: '', descripcion: '', cantidad: 1, unidad: 'NIU' }];
    }
  }

  nuevaFilaItemManual(): ItemManualGreTransportista {
    return { codigo: '', descripcion: '', cantidad: 1, unidad: 'NIU' };
  }

  agregarFilaItemManual(): void {
    this.itemsManualesGre = [...this.itemsManualesGre, this.nuevaFilaItemManual()];
  }

  eliminarFilaItemManual(index: number): void {
    if (this.itemsManualesGre.length <= 1) {
      this.itemsManualesGre = [this.nuevaFilaItemManual()];
      return;
    }
    this.itemsManualesGre = this.itemsManualesGre.filter((_, i) => i !== index);
  }

  private construirItemsPayloadManual(): { codigo: string; descripcion: string; cantidad: number; unidad: string }[] {
    const out: { codigo: string; descripcion: string; cantidad: number; unidad: string }[] = [];
    for (const row of this.itemsManualesGre) {
      const desc = String(row.descripcion || '').trim();
      const cant = Number(row.cantidad);
      if (!desc || !Number.isFinite(cant) || cant <= 0) {
        continue;
      }
      const u = String(row.unidad || 'NIU')
        .trim()
        .toUpperCase()
        .slice(0, 6);
      out.push({
        codigo: String(row.codigo || '').trim(),
        descripcion: desc,
        cantidad: cant,
        unidad: u || 'NIU'
      });
    }
    return out;
  }

  private comprobanteOrigenSinteticoDesdeGuia(
    g: GuiaDetalle,
    d: NonNullable<GuiaDetalle['datosGuia']>
  ): Record<string, unknown> {
    const tipoRel = String(d.tipoComprobanteOrigen || '01').trim();
    let items = Array.isArray(d.items) ? [...d.items] : [];
    if (tipoRel === '09' && items.length === 0) {
      items = [
        { codigo: 'P00001', descripcion: 'SEGUN DOCUMENTOS RELACIONADOS', cantidad: 1, unidad: 'ZZ' }
      ];
    }
    const num = String(g.comprobanteOrigenNumero || d.comprobanteOrigenNumero || '').trim();
    const rucRel = String(d.rucEmisorDocumentoRelacionado || d.emisorRuc || '').replace(/\D/g, '').slice(0, 11);
    return {
      serie: g.comprobanteOrigenSerie || d.comprobanteOrigenSerie || '',
      numero: num.replace(/^0+/, '') || num,
      tipoComprobante: tipoRel,
      rucEmpresa: rucRel || d.emisorRuc || '',
      rucEmisor: rucRel || d.emisorRuc || '',
      documento_cliente: d.numDocDestinatario,
      rucCliente: d.numDocDestinatario,
      cliente: d.nomDestinatario,
      clienteDireccion: d.dirDestino || '',
      ubigeoCliente: d.ubigeoDestino || '',
      codLocalCliente: d.codLocalDestino || '',
      items: items.map((it) => ({
        codigo: it.codigo || '',
        descripcion: it.descripcion || '',
        cantidad: Number(it.cantidad) || 1,
        unidad: it.unidad || 'NIU'
      }))
    };
  }

  /**
   * Comprobante de compra en SUNAT cuando el documento relacionado es factura/boleta (01/03).
   */
  consultarFacturaCompraSunat(): void {
    if (this.guia.tipoComprobanteOrigen === '09') {
      return;
    }
    if (!this.esOrigenCompraBienes()) {
      iziToast.warning({
        title: 'Origen de bienes',
        message: 'La consulta SUNAT de compra solo aplica cuando el origen de bienes es «Desde compra».',
        position: 'topRight'
      });
      return;
    }
    const td = String(this.guia.tipoComprobanteOrigen || '').trim();
    if (td !== '01' && td !== '03') {
      iziToast.warning({
        title: 'Tipo de documento',
        message: 'Para consultar una compra en SUNAT elija Factura (01) o Boleta (03) como documento relacionado.',
        position: 'topRight'
      });
      return;
    }
    const tipoDocSunat = td === '03' ? '03' : '01';
    const proveedor = String(this.compraSunat.rucProveedor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (proveedor.length !== 11) {
      iziToast.warning({
        title: 'Proveedor',
        message: 'Ingrese el RUC del proveedor (emisor del comprobante de compra), 11 dígitos.',
        position: 'topRight'
      });
      return;
    }
    if (!this.buscarSerie.trim() || !this.buscarNumero.trim()) {
      iziToast.warning({
        title: 'Comprobante',
        message: 'Ingrese serie y número del comprobante de compra.',
        position: 'topRight'
      });
      return;
    }
    const rucMi = String(this.compraSunat.rucMiEmpresa || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (rucMi.length !== 11) {
      iziToast.warning({
        title: 'RUC empresa',
        message: 'Indique el RUC de su empresa (titular de la clave SOL). Puede precargarse desde Configuración → Facturación.',
        position: 'topRight'
      });
      return;
    }

    this.consultandoCompraSunat = true;
    const body: {
      proveedor: string;
      tipo_doc: string;
      serie: string;
      correlativo: string;
      ruc?: string;
      usuario?: string;
      password?: string;
    } = {
      proveedor,
      tipo_doc: tipoDocSunat,
      serie: this.buscarSerie.trim(),
      correlativo: this.buscarNumero.trim()
    };
    body.ruc = rucMi;
    const u = this.compraSunat.usuarioSol.trim();
    const p = this.compraSunat.passwordSol;
    if (u) {
      body.usuario = u;
    }
    if (p) {
      body.password = p;
    }

    this.consultaXmlService.consultarComprobanteSunat(body).subscribe({
      next: (res) => {
        const raw = res?.data;
        if (!raw) {
          this.consultandoCompraSunat = false;
          iziToast.error({ title: 'Error', message: 'SUNAT no devolvió datos del comprobante.', position: 'topRight' });
          return;
        }
        const { comprobanteOrigen, buscarSerie, buscarNumero } =
          mapearSunatCompraNormalizadoAComprobanteOrigenGre(raw);
        this.buscarSerie = buscarSerie;
        this.buscarNumero = buscarNumero;
        this.modoItemsTransportista = 'desde_comprobante';
        this.itemsManualesGre = [this.nuevaFilaItemManual()];
        this.comprobanteOrigen = comprobanteOrigen as any;
        this.guia.tipoComprobanteOrigen = String(comprobanteOrigen.tipoComprobante || '01').trim();
        this.origenBienesTransporte = 'compra';
        this.guia.motivoTraslado = '02';
        this.enriquecerComprobanteCompraSunatYPrefill(this.comprobanteOrigen);
      },
      error: (err) => {
        this.consultandoCompraSunat = false;
        const msg =
          err?.error?.message ||
          err?.error?.msg ||
          (typeof err?.error === 'string' ? err.error : '') ||
          'No se pudo consultar el comprobante en SUNAT.';
        iziToast.error({ title: 'Consulta SUNAT', message: msg, position: 'topRight', timeout: 9000 });
      }
    });
  }

  abrirModalSeleccionProveedorGre(): void {
    this.modalProveedorGreVisible = true;
  }

  onModalProveedorGreCerrado(): void {
    this.modalProveedorGreVisible = false;
  }

  aplicarProveedorGreDesdeModal(p: ProveedorGreListado): void {
    const ruc = String(p.ruc || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (ruc.length !== 11) {
      iziToast.warning({
        title: 'Proveedor',
        message: 'El proveedor no tiene un RUC válido de 11 dígitos.',
        position: 'topRight'
      });
      return;
    }
    this.compraSunat.rucProveedor = ruc;
    this.remitente.tipoDoc = '6';
    this.remitente.numeroDoc = ruc;
    this.remitente.razonSocial = String(p.rSocial || '').trim();
    this.proveedoresService.obtener_direccionesProveedor_idProveedor(p.idProveedor).subscribe({
      next: (res: { data?: unknown[] }) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        const lista = raw.map((d) => this.mapDireccionProveedorGreRow(d as Record<string, unknown>));
        this.direccionesOrigenProveedorGre = lista;
        this.usarOrigenDireccionesProveedor = lista.length > 0;
        if (lista.length > 0) {
          const principal = lista.find((x: any) => x.principal) || lista[0];
          this.direccionOrigenSeleccionada = principal;
        } else {
          this.direccionOrigenSeleccionada = null;
          this.intentarAutocompletarUbigeoOrigen();
          iziToast.info({
            title: 'Sin direcciones de proveedor',
            message:
              'Registre direcciones del proveedor en Compras o use «Buscar anexos RUC» con el RUC indicado.',
            position: 'topRight'
          });
        }
        if (this.comprobanteOrigen) {
          this.comprobanteOrigen.rucEmisor = ruc;
          this.comprobanteOrigen.rucEmpresa = ruc;
          const nom = String(p.rSocial || '').trim();
          if (nom) {
            this.comprobanteOrigen.nombreEmisor = nom;
          }
        }
        iziToast.success({
          title: 'Proveedor',
          message: `${p.rSocial || ruc} seleccionado. ${lista.length ? 'Origen desde direcciones del proveedor.' : 'Indique origen o anexos SUNAT.'}`,
          position: 'topRight'
        });
        this.sincronizarDestinoAlmacenSiCompra();
      },
      error: () => {
        iziToast.error({
          title: 'Error',
          message: 'No se pudieron cargar las direcciones del proveedor.',
          position: 'topRight'
        });
      }
    });
  }

  private mapDireccionProveedorGreRow(d: Record<string, unknown>): Record<string, unknown> {
    return {
      idDireccionProveedor: d['idDireccionProveedor'],
      direccion: String(d['direccion'] || '').trim(),
      ubigeo: String(d['ubigeo'] || '')
        .replace(/\D/g, '')
        .slice(0, 6),
      codLocal: String(d['codLocal'] || '').trim(),
      region: String(d['region'] || '').trim(),
      provincia: String(d['provincia'] || '').trim(),
      distrito: String(d['distrito'] || '').trim(),
      referencia: String(d['referencia'] || 'Proveedor').trim(),
      principal: d['principal'] === true || d['principal'] === 1
    };
  }

  private limpiarOrigenProveedorGre(): void {
    this.usarOrigenDireccionesProveedor = false;
    this.direccionesOrigenProveedorGre = [];
    this.intentarAutocompletarUbigeoOrigen();
  }

  private sincronizarOrigenProveedorConRucComprobante(co: any): void {
    if (!this.usarOrigenDireccionesProveedor) {
      return;
    }
    const rucXml = String(co?.rucEmisor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    const rucForm = String(this.compraSunat.rucProveedor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (rucXml.length === 11 && rucForm.length === 11 && rucXml !== rucForm) {
      this.limpiarOrigenProveedorGre();
    }
  }

  /** Compra = carga de bienes desde compra (direcciones proveedor → origen). No es motivo SUNAT. */
  esOrigenCompraBienes(): boolean {
    return this.origenBienesTransporte === 'compra' || this.guia.motivoTraslado === '02';
  }

  /** @deprecated Alias interno: conservar llamadas existentes a esMotivoCompraGre. */
  esMotivoCompraGre(): boolean {
    return this.esOrigenCompraBienes();
  }

  listaDireccionesOrigenGre(): any[] {
    // Preferir direcciones del remitente/proveedor cuando ya se cargaron por Consultar RUC
    if (this.usarOrigenDireccionesProveedor && this.direccionesOrigenProveedorGre.length > 0) {
      return this.direccionesOrigenProveedorGre;
    }
    return this.esOrigenCompraBienes() ? this.direccionesOrigenProveedorGre : this.direccionesEmpresa;
  }

  listaDireccionesDestinoGre(): any[] {
    // Preferir direcciones del destinatario cargadas por Consultar RUC (salvo compra → almacén)
    if (!this.esOrigenCompraBienes() && this.direccionesDestinoLocal.length > 0) {
      return this.direccionesDestinoLocal;
    }
    return this.esOrigenCompraBienes() ? this.direccionesEmpresa : this.direccionesDestinoLocal;
  }

  onMotivoTrasladoGreChange(): void {
    const co = this.comprobanteOrigen;
    if (co && (this.guia.motivoTraslado || this.origenBienesTransporte)) {
      const coEsCompraSunat = !!co.origenDesdeCompraSunat;
      if (this.esOrigenCompraBienes() !== coEsCompraSunat) {
        this.comprobanteOrigen = null;
        this.buscarSerie = '';
        this.buscarNumero = '';
        iziToast.info({
          title: 'Comprobante',
          message: 'El comprobante cargado no coincide con el origen de bienes. Busque o consulte de nuevo según corresponda.',
          position: 'topRight'
        });
      }
    }
    if (this.esOrigenCompraBienes()) {
      this.direccionesDestinoLocal = [];
      this.direccionOrigenSeleccionada = null;
      if (this.usarOrigenDireccionesProveedor && this.direccionesOrigenProveedorGre.length > 0) {
        this.direccionOrigenSeleccionada =
          this.direccionesOrigenProveedorGre.find((x: any) => x.principal) ||
          this.direccionesOrigenProveedorGre[0];
      }
      this.anexosDestino = [];
      this.sincronizarDestinoAlmacenSiCompra();
    } else {
      this.limpiarOrigenProveedorGre();
      this.direccionOrigenSeleccionada = null;
      this.intentarAutocompletarUbigeoOrigen();
      this.anexosDestino = [];
      if (this.comprobanteOrigen) {
        this.cargarDireccionesDestinoLocal(this.comprobanteOrigen);
      } else {
        this.direccionesDestinoLocal = [];
        this.direccionDestinoSeleccionada = null;
      }
    }
  }

  private rucMiEmpresaNormalizado(): string {
    const r = String(this.empresaService.getEmpresaActual()?.ruc || this.compraSunat.rucMiEmpresa || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    return r.length === 11 ? r : '';
  }

  private sincronizarDestinoAlmacenSiCompra(): void {
    if (!this.esMotivoCompraGre()) {
      return;
    }
    if (!this.direccionesEmpresa?.length) {
      return;
    }
    const principal = this.direccionesEmpresa.find(
      (x: any) => x.principal === true || x.principal === 1
    ) || this.direccionesEmpresa[0];
    this.direccionDestinoSeleccionada = principal;
  }

  private rucParaAnexosOrigenGre(): string {
    const rucRemitente = String(this.remitente.numeroDoc || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (rucRemitente.length === 11) {
      return rucRemitente;
    }
    if (this.esMotivoCompraGre()) {
      const r = String(
        this.comprobanteOrigen?.rucEmpresa ||
          this.comprobanteOrigen?.rucEmisor ||
          this.compraSunat.rucProveedor ||
          ''
      )
        .replace(/\D/g, '')
        .slice(0, 11);
      return r.length === 11 ? r : '';
    }
    const rEmp = this.rucMiEmpresaNormalizado();
    if (rEmp) {
      return rEmp;
    }
    const r = String(this.comprobanteOrigen?.rucEmisor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    return r.length === 11 ? r : '';
  }

  private enriquecerComprobanteCompraSunatYPrefill(co: any): void {
    this.sincronizarOrigenProveedorConRucComprobante(co);
    co.origenDesdeCompraSunat = true;
    const rMi = String(this.compraSunat.rucMiEmpresa || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (rMi.length === 11 && !String(co.documento_cliente || co.rucCliente || '').trim()) {
      co.documento_cliente = rMi;
      co.rucCliente = rMi;
    }
    const rProv = String(co.rucEmisor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    const needProvNombre = rProv.length === 11 && !String(co.nombreEmisor || '').trim();
    const needRecNombre =
      rMi.length === 11 && !String(co.cliente || co.razon_social || '').trim();

    const finish = () => {
      this.consultandoCompraSunat = false;
      this.cargarDireccionesDestinoLocal(co);
      this.prefillDestinatarioDesdeComprobante(co);
      this.prefillRemitenteDesdeProveedorCompra(co);
      iziToast.success({
        title: 'Comprobante cargado',
        message: 'Detalle desde SUNAT. Revise proveedor (remitente), receptor y direcciones.',
        position: 'topRight'
      });
    };

    if (!needProvNombre && !needRecNombre) {
      finish();
      return;
    }

    const reqs: Record<string, Observable<unknown>> = {};
    if (needProvNombre) {
      reqs['prov'] = this.factilizaService.getRuc(rProv).pipe(catchError(() => of(null)));
    }
    if (needRecNombre) {
      reqs['rec'] = this.factilizaService.getRuc(rMi).pipe(catchError(() => of(null)));
    }

    forkJoin(reqs).subscribe({
      next: (out) => {
        const rzP = this.extraerRazonSocialRucFactiliza(out['prov']);
        const rzR = this.extraerRazonSocialRucFactiliza(out['rec']);
        if (rzP) {
          co.nombreEmisor = rzP;
        }
        if (rzR) {
          co.cliente = rzR;
          co.razon_social = rzR;
        }
        finish();
      },
      error: () => finish()
    });
  }

  private extraerRazonSocialRucFactiliza(res: unknown): string {
    const o = res && typeof res === 'object' ? (res as Record<string, unknown>) : null;
    if (!o) return '';
    const d = o['data'];
    if (d && typeof d === 'object') {
      const dr = d as Record<string, unknown>;
      const r = String(dr['razonSocial'] || dr['nombre'] || '').trim();
      if (r) return r;
    }
    return String(o['razonSocial'] || '').trim();
  }

  private prefillRemitenteDesdeProveedorCompra(comprobante: any): void {
    const ruc = String(comprobante?.rucEmisor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    const nombre = String(comprobante?.nombreEmisor || '').trim();
    if (ruc.length === 11) {
      this.remitente.tipoDoc = '6';
      this.remitente.numeroDoc = ruc;
      if (nombre) {
        this.remitente.razonSocial = nombre;
      }
    }
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
    if (this.esOrigenCompraBienes()) {
      iziToast.info({
        title: 'Origen compra',
        message:
          'La búsqueda interna solo lista comprobantes de venta emitidos por su empresa. Para una compra use «Consultar en SUNAT (Factiliza)».',
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
          this.modoItemsTransportista = 'desde_comprobante';
          this.origenBienesTransporte = 'venta';
          this.itemsManualesGre = [this.nuevaFilaItemManual()];
          this.comprobanteOrigen = res.data;
          delete this.comprobanteOrigen.origenDesdeCompraSunat;
          this.limpiarOrigenProveedorGre();
          this.guia.tipoComprobanteOrigen = String(res.data.tipoComprobante || '01').trim();
          this.guia.motivoTraslado = '';
          this.guia.descripcionMotivo = '';
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
    if (this.esMotivoCompraGre()) {
      this.direccionesDestinoLocal = [];
      this.sincronizarDestinoAlmacenSiCompra();
      return;
    }
    const idClienteRaw = comprobante?.idCliente;
    const idCliente = Number(idClienteRaw);
    if (Number.isFinite(idCliente) && idCliente > 0) {
      this.cargarDireccionesDestinoDesdeTabla(idCliente, comprobante);
      return;
    }
    this.cargarDireccionDestinoFallback(comprobante);
  }

  private cargarDireccionesDestinoDesdeTabla(idCliente: number, comprobante?: any): void {
    this.clienteService.obtener_direccionesCliente_idCliente(idCliente).subscribe({
      next: (res: any) => {
        const listaRaw = Array.isArray(res?.data) ? res.data : [];
        const lista = listaRaw
          .filter((d: any) => String(d?.direccion || '').trim().length > 0)
          .map((d: any) => ({
            idDireccionClientes: d.idDireccionClientes,
            direccion: String(d?.direccion || '').trim(),
            ubigeo: String(d?.ubigeo || '').replace(/\D/g, ''),
            referencia: String(d?.referencia || '').trim(),
            codLocal: String(d?.codLocal || '').trim(),
            principal: d?.principal === true || d?.principal === 1
          }));

        if (lista.length > 0) {
          this.direccionesDestinoLocal = lista;
          this.direccionDestinoSeleccionada = lista.find((x: any) => x.principal) || lista[0];
          return;
        }
        this.cargarDireccionDestinoFallback(comprobante);
      },
      error: () => {
        this.cargarDireccionDestinoFallback(comprobante);
      }
    });
  }

  private cargarDireccionDestinoFallback(comprobante: any): void {
    this.direccionesDestinoLocal = [];
    this.direccionDestinoSeleccionada = null;
    const dir = (comprobante?.clienteDireccion || '').toString().trim();
    const ubigeo = String(comprobante?.ubigeoCliente || '').replace(/\D/g, '');
    if (!dir) return;
    const codLocal = String(comprobante?.codLocalCliente || '').trim();
    const destino = {
      direccion: dir,
      ubigeo,
      codLocal,
      referencia: 'Dirección del cliente'
    };
    this.direccionesDestinoLocal.push(destino);
    this.direccionDestinoSeleccionada = destino;
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
        const nombre = extraerNombreCompletoDesdeDni(res);
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

  /**
   * Extrae razón social / nombre y dirección desde respuestas Factiliza (RUC/DNI).
   */
  private extraerRazonYDireccionConsultaExterna(res: unknown): {
    razonSocial: string;
    direccion: string;
    ubigeo: string;
  } {
    const o = res && typeof res === 'object' ? (res as Record<string, unknown>) : null;
    if (!o) {
      return { razonSocial: '', direccion: '', ubigeo: '' };
    }
    const data =
      o['data'] !== undefined && o['data'] !== null && typeof o['data'] === 'object' && !Array.isArray(o['data'])
        ? (o['data'] as Record<string, unknown>)
        : o;
    const razonSocial = String(
      data['razonSocial'] ??
        data['nombre_o_razon_social'] ??
        data['razon_social'] ??
        data['nombre'] ??
        o['razonSocial'] ??
        ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    const direccion = String(
      data['direccion_completa'] ??
        data['direccionCompleta'] ??
        data['direccion'] ??
        data['domicilioFiscal'] ??
        ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    const ubigeo = String(data['ubigeo'] ?? data['ubigeo_sunat'] ?? '')
      .replace(/\D/g, '')
      .slice(0, 6);
    return { razonSocial, direccion, ubigeo };
  }

  private mapDireccionClienteGreRow(d: Record<string, unknown>): Record<string, unknown> {
    return {
      idDireccionClientes: d['idDireccionClientes'],
      direccion: String(d['direccion'] || '').trim(),
      ubigeo: String(d['ubigeo'] || '').replace(/\D/g, '').slice(0, 6),
      referencia: String(d['referencia'] || '').trim() || 'Cliente',
      codLocal: String(d['codLocal'] || '').trim(),
      region: String(d['region'] || '').trim(),
      provincia: String(d['provincia'] || '').trim(),
      distrito: String(d['distrito'] || '').trim(),
      principal: d['principal'] === true || d['principal'] === 1
    };
  }

  private mapDireccionProveedorGreRowLocal(d: Record<string, unknown>): Record<string, unknown> {
    return this.mapDireccionProveedorGreRow(d);
  }

  /** Carga direcciones del cliente en el selector de destino (punto de llegada SUNAT). */
  private cargarDireccionesDestinoDesdeClienteId(idCliente: number, clienteRow?: Record<string, unknown>): void {
    this.clienteService.obtener_direccionesCliente_idCliente(idCliente).subscribe({
      next: (res: { data?: unknown[] }) => {
        const listaRaw = Array.isArray(res?.data) ? res.data : [];
        const lista = listaRaw
          .filter((d) => String((d as Record<string, unknown>)?.['direccion'] || '').trim().length > 0)
          .map((d) => this.mapDireccionClienteGreRow(d as Record<string, unknown>));
        if (lista.length > 0) {
          this.direccionesDestinoLocal = lista;
          this.direccionDestinoSeleccionada = lista.find((x) => x['principal']) || lista[0];
          return;
        }
        this.aplicarDireccionDestinoDesdeFila(clienteRow || {});
      },
      error: () => this.aplicarDireccionDestinoDesdeFila(clienteRow || {})
    });
  }

  private aplicarDireccionDestinoDesdeFila(row: Record<string, unknown>): void {
    const dir = String(row['direccion'] || '').trim();
    if (!dir) {
      return;
    }
    const destino = {
      direccion: dir,
      ubigeo: String(row['ubigeo'] || '').replace(/\D/g, '').slice(0, 6),
      codLocal: String(row['codLocal'] || '').trim(),
      region: String(row['region'] || '').trim(),
      provincia: String(row['provincia'] || '').trim(),
      distrito: String(row['distrito'] || '').trim(),
      referencia: 'Destinatario'
    };
    this.direccionesDestinoLocal = [destino];
    this.direccionDestinoSeleccionada = destino;
  }

  private aplicarDireccionDestinoConsultaExterna(direccion: string, ubigeo?: string): void {
    const dir = String(direccion || '').trim();
    if (!dir) {
      return;
    }
    const destino = {
      direccion: dir,
      ubigeo: String(ubigeo || '').replace(/\D/g, '').slice(0, 6),
      codLocal: '',
      referencia: 'Consulta externa'
    };
    this.direccionesDestinoLocal = [destino, ...this.direccionesDestinoLocal.filter((x) => x.direccion !== dir)];
    this.direccionDestinoSeleccionada = destino;
  }

  /** Carga direcciones del proveedor/cliente como origen (punto de partida SUNAT). */
  private cargarDireccionesOrigenDesdeProveedorId(idProveedor: number, row?: Record<string, unknown>): void {
    this.proveedoresService.obtener_direccionesProveedor_idProveedor(idProveedor).subscribe({
      next: (res: { data?: unknown[] }) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        const lista = raw
          .filter((d) => String((d as Record<string, unknown>)?.['direccion'] || '').trim().length > 0)
          .map((d) => this.mapDireccionProveedorGreRowLocal(d as Record<string, unknown>));
        if (lista.length > 0) {
          this.direccionesOrigenProveedorGre = lista;
          this.usarOrigenDireccionesProveedor = true;
          this.direccionOrigenSeleccionada = lista.find((x) => x['principal']) || lista[0];
          return;
        }
        this.aplicarDireccionOrigenDesdeFila(row || {});
      },
      error: () => this.aplicarDireccionOrigenDesdeFila(row || {})
    });
  }

  private cargarDireccionesOrigenDesdeClienteId(idCliente: number, row?: Record<string, unknown>): void {
    this.clienteService.obtener_direccionesCliente_idCliente(idCliente).subscribe({
      next: (res: { data?: unknown[] }) => {
        const listaRaw = Array.isArray(res?.data) ? res.data : [];
        const lista = listaRaw
          .filter((d) => String((d as Record<string, unknown>)?.['direccion'] || '').trim().length > 0)
          .map((d) => this.mapDireccionClienteGreRow(d as Record<string, unknown>));
        if (lista.length > 0) {
          // Reutiliza lista de origen proveedor para no mezclar con almacenes empresa
          this.direccionesOrigenProveedorGre = lista;
          this.usarOrigenDireccionesProveedor = true;
          this.direccionOrigenSeleccionada = lista.find((x) => x['principal']) || lista[0];
          return;
        }
        this.aplicarDireccionOrigenDesdeFila(row || {});
      },
      error: () => this.aplicarDireccionOrigenDesdeFila(row || {})
    });
  }

  private aplicarDireccionOrigenDesdeFila(row: Record<string, unknown>): void {
    const dir = String(row['direccion'] || '').trim();
    if (!dir) {
      return;
    }
    const origen = {
      direccion: dir,
      ubigeo: String(row['ubigeo'] || '').replace(/\D/g, '').slice(0, 6),
      codLocal: String(row['codLocal'] || '').trim(),
      region: String(row['region'] || '').trim(),
      provincia: String(row['provincia'] || '').trim(),
      distrito: String(row['distrito'] || '').trim(),
      referencia: 'Remitente',
      principal: true
    };
    this.direccionesOrigenProveedorGre = [origen];
    this.usarOrigenDireccionesProveedor = true;
    this.direccionOrigenSeleccionada = origen;
  }

  private aplicarDireccionOrigenConsultaExterna(direccion: string, ubigeo?: string): void {
    const dir = String(direccion || '').trim();
    if (!dir) {
      return;
    }
    const origen = {
      direccion: dir,
      ubigeo: String(ubigeo || '').replace(/\D/g, '').slice(0, 6),
      codLocal: '',
      referencia: 'Consulta externa',
      principal: true
    };
    this.direccionesOrigenProveedorGre = [origen];
    this.usarOrigenDireccionesProveedor = true;
    this.direccionOrigenSeleccionada = origen;
  }

  /**
   * Destinatario: BD clientes → Factiliza. Completa nombre (SUNAT) y dirección de destino (ubigeo).
   */
  consultarRucDestinatario(): void {
    const num = String(this.destinatario.numeroDoc || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    this.destinatario.numeroDoc = num;
    if (num.length !== 11) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 11 dígitos del RUC.', position: 'topRight' });
      return;
    }
    this.destinatario.tipoDoc = '6';
    this.consultandoDestinatario = true;
    this.clienteService.obtener_cliente_ruc(num).subscribe({
      next: (response: { data?: Record<string, unknown>[] }) => {
        const filas = Array.isArray(response?.data) ? response.data : [];
        if (filas.length > 0) {
          const row = filas[0];
          this.destinatario.numeroDoc = String(row['ruc'] || num).replace(/\D/g, '').slice(0, 11);
          this.destinatario.razonSocial = String(
            row['rSocial'] ?? row['r_Social'] ?? row['razonSocial'] ?? row['RazonSocial'] ?? ''
          ).trim();
          const idCliente = Number(row['idCliente']);
          if (Number.isFinite(idCliente) && idCliente > 0) {
            this.cargarDireccionesDestinoDesdeClienteId(idCliente, row);
          } else {
            this.aplicarDireccionDestinoDesdeFila(row);
          }
          this.consultandoDestinatario = false;
          iziToast.success({
            title: 'Destinatario',
            message: 'Encontrado en base de datos. Nombre y dirección de destino cargados.',
            position: 'topRight'
          });
          return;
        }
        this.consultarRucDestinatarioFactiliza(num);
      },
      error: () => this.consultarRucDestinatarioFactiliza(num)
    });
  }

  private consultarRucDestinatarioFactiliza(num: string): void {
    this.consultandoDestinatario = true;
    this.factilizaService.getRuc(num).subscribe({
      next: (res: unknown) => {
        const { razonSocial, direccion, ubigeo } = this.extraerRazonYDireccionConsultaExterna(res);
        if (razonSocial) {
          this.destinatario.razonSocial = razonSocial;
        }
        if (direccion) {
          this.aplicarDireccionDestinoConsultaExterna(direccion, ubigeo);
        }
        this.consultandoDestinatario = false;
        if (razonSocial) {
          iziToast.success({
            title: 'Destinatario',
            message: direccion
              ? 'Datos obtenidos de Factiliza (nombre y dirección).'
              : 'Razón social obtenida de Factiliza. Complete la dirección de destino en el paso 2 si falta ubigeo.',
            position: 'topRight'
          });
        } else {
          iziToast.info({
            title: 'Sin datos',
            message: 'RUC consultado; no se obtuvo razón social. Verifique el número o ingrese el nombre manualmente.',
            position: 'topRight'
          });
        }
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el RUC del destinatario.', position: 'topRight' });
        this.consultandoDestinatario = false;
      }
    });
  }

  consultarDniDestinatario(): void {
    const num = String(this.destinatario.numeroDoc || '')
      .replace(/\D/g, '')
      .slice(0, 8);
    this.destinatario.numeroDoc = num;
    if (num.length !== 8) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 8 dígitos del DNI.', position: 'topRight' });
      return;
    }
    this.destinatario.tipoDoc = '1';
    this.consultandoDestinatario = true;
    this.clienteService.obtener_cliente_ruc(num).subscribe({
      next: (response: { data?: Record<string, unknown>[] }) => {
        const filas = Array.isArray(response?.data) ? response.data : [];
        if (filas.length > 0) {
          const row = filas[0];
          this.destinatario.numeroDoc = String(row['ruc'] || num).replace(/\D/g, '').slice(0, 8);
          this.destinatario.razonSocial = String(
            row['rSocial'] ?? row['r_Social'] ?? row['razonSocial'] ?? ''
          ).trim();
          const idCliente = Number(row['idCliente']);
          if (Number.isFinite(idCliente) && idCliente > 0) {
            this.cargarDireccionesDestinoDesdeClienteId(idCliente, row);
          } else {
            this.aplicarDireccionDestinoDesdeFila(row);
          }
          this.consultandoDestinatario = false;
          iziToast.success({
            title: 'Destinatario',
            message: 'Encontrado en base de datos.',
            position: 'topRight'
          });
          return;
        }
        this.consultarDniDestinatarioFactiliza(num);
      },
      error: () => this.consultarDniDestinatarioFactiliza(num)
    });
  }

  private consultarDniDestinatarioFactiliza(num: string): void {
    this.consultandoDestinatario = true;
    this.factilizaService.getDni(num).subscribe({
      next: (res: unknown) => {
        const nombre = extraerNombreCompletoDesdeDni(res);
        const { direccion, ubigeo } = this.extraerRazonYDireccionConsultaExterna(res);
        if (nombre) {
          this.destinatario.razonSocial = nombre;
        }
        if (direccion) {
          this.aplicarDireccionDestinoConsultaExterna(direccion, ubigeo);
        }
        this.consultandoDestinatario = false;
        if (!nombre) {
          iziToast.info({ title: 'Sin nombre', message: 'No se obtuvo el nombre del DNI.', position: 'topRight' });
        }
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el DNI del destinatario.', position: 'topRight' });
        this.consultandoDestinatario = false;
      }
    });
  }

  /** Al elegir un vehículo del catálogo empresa, rellena la placa principal. */
  onVehiculoEmpresaChange(): void {
    const id = this.idVehiculoEmpresa;
    if (!id) return;
    const v = this.vehiculosEmpresa.find((x) => x.idVehiculo === id);
    if (v?.placa) {
      this.guia.placaVehiculo = String(v.placa).trim().toUpperCase();
    }
  }

  /**
   * Remitente GRE 31: BD proveedores → BD clientes → Factiliza.
   * Completa nombre (DespatchParty) y sugiere dirección de origen (punto de partida).
   */
  consultarRucRemitente(): void {
    const num = String(this.remitente.numeroDoc || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    this.remitente.numeroDoc = num;
    if (num.length !== 11) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 11 dígitos del RUC del remitente.', position: 'topRight' });
      return;
    }
    this.remitente.tipoDoc = '6';
    this.consultandoRemitente = true;
    this.proveedoresService.obtener_proveedor_ruc(num).subscribe({
      next: (response: { data?: Record<string, unknown>[] }) => {
        const filas = Array.isArray(response?.data) ? response.data : [];
        if (filas.length > 0) {
          const row = filas[0];
          this.remitente.numeroDoc = String(row['ruc'] || num).replace(/\D/g, '').slice(0, 11);
          this.remitente.razonSocial = String(
            row['rSocial'] ?? row['razonSocial'] ?? row['RazonSocial'] ?? ''
          ).trim();
          const idProveedor = Number(row['idProveedor']);
          if (Number.isFinite(idProveedor) && idProveedor > 0) {
            this.cargarDireccionesOrigenDesdeProveedorId(idProveedor, row);
          } else {
            this.aplicarDireccionOrigenDesdeFila(row);
          }
          this.consultandoRemitente = false;
          iziToast.success({
            title: 'Remitente',
            message: 'Proveedor encontrado en base de datos. Nombre y origen cargados.',
            position: 'topRight'
          });
          return;
        }
        this.buscarRemitenteEnClientesBd(num);
      },
      error: () => this.buscarRemitenteEnClientesBd(num)
    });
  }

  private buscarRemitenteEnClientesBd(num: string): void {
    this.clienteService.obtener_cliente_ruc(num).subscribe({
      next: (response: { data?: Record<string, unknown>[] }) => {
        const filas = Array.isArray(response?.data) ? response.data : [];
        if (filas.length > 0) {
          const row = filas[0];
          this.remitente.numeroDoc = String(row['ruc'] || num).replace(/\D/g, '').slice(0, 11);
          this.remitente.razonSocial = String(
            row['rSocial'] ?? row['r_Social'] ?? row['razonSocial'] ?? ''
          ).trim();
          const idCliente = Number(row['idCliente']);
          if (Number.isFinite(idCliente) && idCliente > 0) {
            this.cargarDireccionesOrigenDesdeClienteId(idCliente, row);
          } else {
            this.aplicarDireccionOrigenDesdeFila(row);
          }
          this.consultandoRemitente = false;
          iziToast.success({
            title: 'Remitente',
            message: 'Encontrado en clientes. Nombre y origen cargados.',
            position: 'topRight'
          });
          return;
        }
        this.consultarRucRemitenteFactiliza(num);
      },
      error: () => this.consultarRucRemitenteFactiliza(num)
    });
  }

  private consultarRucRemitenteFactiliza(num: string): void {
    this.consultandoRemitente = true;
    this.factilizaService.getRuc(num).subscribe({
      next: (res: unknown) => {
        const { razonSocial, direccion, ubigeo } = this.extraerRazonYDireccionConsultaExterna(res);
        if (razonSocial) {
          this.remitente.razonSocial = razonSocial;
        }
        if (direccion) {
          this.aplicarDireccionOrigenConsultaExterna(direccion, ubigeo);
        }
        this.consultandoRemitente = false;
        if (razonSocial) {
          iziToast.success({
            title: 'Remitente',
            message: direccion
              ? 'Datos obtenidos de Factiliza (nombre y punto de partida sugerido).'
              : 'Razón social obtenida de Factiliza. Complete/revise la dirección de origen en el paso 2.',
            position: 'topRight'
          });
        } else {
          iziToast.info({
            title: 'Sin datos',
            message: 'RUC consultado; no se obtuvo razón social. Ingrese el nombre manualmente.',
            position: 'topRight'
          });
        }
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el RUC del remitente.', position: 'topRight' });
        this.consultandoRemitente = false;
      }
    });
  }

  consultarDniRemitente(): void {
    const num = String(this.remitente.numeroDoc || '')
      .replace(/\D/g, '')
      .slice(0, 8);
    this.remitente.numeroDoc = num;
    if (num.length !== 8) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 8 dígitos del DNI del remitente.', position: 'topRight' });
      return;
    }
    this.remitente.tipoDoc = '1';
    this.consultandoRemitente = true;
    this.clienteService.obtener_cliente_ruc(num).subscribe({
      next: (response: { data?: Record<string, unknown>[] }) => {
        const filas = Array.isArray(response?.data) ? response.data : [];
        if (filas.length > 0) {
          const row = filas[0];
          this.remitente.razonSocial = String(
            row['rSocial'] ?? row['r_Social'] ?? row['razonSocial'] ?? ''
          ).trim();
          const idCliente = Number(row['idCliente']);
          if (Number.isFinite(idCliente) && idCliente > 0) {
            this.cargarDireccionesOrigenDesdeClienteId(idCliente, row);
          } else {
            this.aplicarDireccionOrigenDesdeFila(row);
          }
          this.consultandoRemitente = false;
          iziToast.success({ title: 'Remitente', message: 'Encontrado en base de datos.', position: 'topRight' });
          return;
        }
        this.consultarDniRemitenteFactiliza(num);
      },
      error: () => this.consultarDniRemitenteFactiliza(num)
    });
  }

  private consultarDniRemitenteFactiliza(num: string): void {
    this.consultandoRemitente = true;
    this.factilizaService.getDni(num).subscribe({
      next: (res: unknown) => {
        const nombre = extraerNombreCompletoDesdeDni(res);
        const { direccion, ubigeo } = this.extraerRazonYDireccionConsultaExterna(res);
        if (nombre) {
          this.remitente.razonSocial = nombre;
        }
        if (direccion) {
          this.aplicarDireccionOrigenConsultaExterna(direccion, ubigeo);
        }
        this.consultandoRemitente = false;
        if (!nombre) {
          iziToast.info({ title: 'Sin nombre', message: 'No se obtuvo el nombre del DNI.', position: 'topRight' });
        }
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el DNI del remitente.', position: 'topRight' });
        this.consultandoRemitente = false;
      }
    });
  }

  consultarAnexosOrigenPorRuc(): void {
    const ruc = this.rucParaAnexosOrigenGre();
    if (!ruc) {
      iziToast.warning({
        title: 'Sin RUC',
        message:
          'Indique el RUC del remitente (paso 4), el RUC del proveedor o cargue un comprobante con RUC emisor.',
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
    const rucDestinatarioForm = String(this.destinatario.numeroDoc || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    const rucClienteDesdeComprobante = String(
      this.comprobanteOrigen?.documento_cliente || this.comprobanteOrigen?.rucCliente || ''
    )
      .replace(/\D/g, '')
      .slice(0, 11);
    const ruc = this.esOrigenCompraBienes()
      ? this.rucMiEmpresaNormalizado()
      : rucDestinatarioForm.length === 11
        ? rucDestinatarioForm
        : rucClienteDesdeComprobante;
    if (!ruc || String(ruc).length !== 11) {
      iziToast.warning({
        title: 'Sin RUC',
        message: this.esOrigenCompraBienes()
          ? 'No hay RUC de su empresa para consultar anexos del almacén de destino.'
          : 'Ingrese el RUC del destinatario (paso 3) para consultar anexos SUNAT.',
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
    const tipoRel = String(this.guia.tipoComprobanteOrigen || '01').trim();
    if (tipoRel === '09') {
      const s = this.buscarSerie.trim();
      const n = this.buscarNumero.trim();
      const rucRel = String(this.guia.rucEmisorDocumentoRelacionado || '').replace(/\D/g, '').slice(0, 11);
      if (!s || !n) {
        iziToast.warning({
          title: 'Documento relacionado',
          message: 'Ingrese serie y número de la guía de remisión remitente (09).',
          position: 'topRight'
        });
        return;
      }
      if (rucRel.length !== 11) {
        iziToast.warning({
          title: 'RUC emisor',
          message: 'Ingrese el RUC (11 dígitos) de quien emitió la guía remitente relacionada.',
          position: 'topRight'
        });
        return;
      }
    } else if (this.modoItemsTransportista === 'manual') {
      const sRel = this.buscarSerie.trim();
      const nRel = this.buscarNumero.trim();
      if ((sRel && !nRel) || (!sRel && nRel)) {
        iziToast.warning({
          title: 'Documento relacionado',
          message: 'Indique serie y número del documento relacionado, o deje ambos vacíos si no aplica.',
          position: 'topRight'
        });
        return;
      }
      if (sRel && nRel) {
        const rucDoc = String(this.guia.rucEmisorDocumentoRelacionado || '')
          .replace(/\D/g, '')
          .slice(0, 11);
        if (rucDoc.length !== 11) {
          iziToast.warning({
            title: 'RUC emisor',
            message: 'Si informa serie y número del documento relacionado, indique el RUC del emisor (11 dígitos).',
            position: 'topRight'
          });
          return;
        }
      }
      const itemsManuales = this.construirItemsPayloadManual();
      if (itemsManuales.length === 0) {
        iziToast.warning({
          title: 'Ítems',
          message: 'Agregue al menos una línea con descripción y cantidad mayor a cero.',
          position: 'topRight'
        });
        return;
      }
    } else if (!this.comprobanteOrigen) {
      iziToast.warning({
        title: 'Sin comprobante',
        message: 'Busque el comprobante de origen (factura o boleta) o use «Carga manual de ítems».',
        position: 'topRight'
      });
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
    if (!this.remitente.razonSocial?.trim()) {
      iziToast.warning({ title: 'Remitente', message: 'Ingrese el nombre o razón social del remitente de la mercadería.', position: 'topRight' });
      return;
    }
    if (!String(this.remitente.numeroDoc || '').trim()) {
      iziToast.warning({ title: 'Remitente', message: 'Ingrese el documento del remitente.', position: 'topRight' });
      return;
    }
    if (!this.guia.vehiculoM1L) {
      if (!String(this.guia.placaVehiculo || '').trim()) {
        iziToast.warning({
          title: 'Campo requerido',
          message: 'Ingrese la placa del vehículo o marque «Vehículo M1/L» si aplica.',
          position: 'topRight'
        });
        return;
      }
      if (!String(this.guia.numeroDocConductor || '').trim()) {
        iziToast.warning({ title: 'Conductor', message: 'Ingrese el documento del conductor principal.', position: 'topRight' });
        return;
      }
      if (!String(this.guia.nombreConductor || '').trim()) {
        iziToast.warning({
          title: 'Conductor',
          message: 'Ingrese el nombre completo del conductor para el XML SUNAT.',
          position: 'topRight'
        });
        return;
      }
    }

    this.guardandoGuia = true;

    const itemsGre09 = [
      { codigo: 'P00001', descripcion: 'SEGUN DOCUMENTOS RELACIONADOS', cantidad: 1, unidad: 'ZZ' }
    ];
    const comprobanteSerie =
      tipoRel === '09'
        ? this.buscarSerie.trim()
        : this.modoItemsTransportista === 'manual'
          ? this.buscarSerie.trim()
          : String(this.comprobanteOrigen?.serie || '').trim();
    const comprobanteNumeroRaw =
      tipoRel === '09'
        ? this.buscarNumero.trim()
        : this.modoItemsTransportista === 'manual'
          ? this.buscarNumero.trim()
          : String(this.comprobanteOrigen?.numero || '').trim();
    const rucEmisorRel =
      tipoRel === '09'
        ? String(this.guia.rucEmisorDocumentoRelacionado || '').replace(/\D/g, '').slice(0, 11)
        : this.modoItemsTransportista === 'manual'
          ? String(this.guia.rucEmisorDocumentoRelacionado || '').replace(/\D/g, '').slice(0, 11)
          : String(
              this.comprobanteOrigen?.rucEmpresa || this.comprobanteOrigen?.rucEmisor || ''
            ).trim();
    const itemsPayload =
      tipoRel === '09'
        ? itemsGre09
        : this.modoItemsTransportista === 'manual'
          ? this.construirItemsPayloadManual()
          : (this.comprobanteOrigen?.items || []).map((it: any) => ({
              codigo: it.codigo || '',
              descripcion: it.descripcion || '',
              cantidad: Number(it.cantidad) || 1,
              unidad: it.unidad || 'NIU'
            }));

    const payload: RegistrarGuiaPayload = {
      tipoGuia: 'TRANSPORTISTA',
      // GRE 31 no usa motivo de traslado (HandlingCode); se omite en XML SUNAT.
      motivoTraslado: '',
      descripcionMotivo: '',
      fechaEmision: this.guia.fechaInicioTraslado,
      horaInicioTraslado: this.guia.horaInicioTraslado || '',
      cantidadPeso: this.guia.cantidadPeso ?? null,
      unidadMedidaPeso: this.guia.unidadMedidaPeso || 'KGM',
      modalidadTransporte: '02',
      vehiculoM1L: Boolean(this.guia.vehiculoM1L),
      tipoDocRemitente: this.remitente.tipoDoc || '6',
      numDocRemitente: this.remitente.numeroDoc || '',
      nomRemitente: this.remitente.razonSocial || '',
      idVehiculoEmpresa: this.idVehiculoEmpresa || undefined,
      placaVehiculo: this.guia.placaVehiculo || '',
      placaSecundaria: this.guia.placaSecundaria || '',
      tipoDocConductor: this.guia.tipoDocConductor || '1',
      numeroDocConductor: this.guia.numeroDocConductor || '',
      nombreConductor: this.guia.nombreConductor || '',
      licenciaConductor: this.guia.licenciaConductor || '',
      rucTransportista: '',
      razonSocialTransportista: '',
      nroMtcTransportista: String(this.guia.nroMtcTransportista || '').trim(),
      registroMtcVehiculo: String(this.guia.registroMtcVehiculo || '').trim(),
      indicadorPagadorFlete: String(this.guia.indicadorPagadorFlete || '').trim().toUpperCase(),
      // Origen / Destino
      dirOrigen: this.direccionOrigenSeleccionada?.direccion || '',
      ubigeoOrigen: this.direccionOrigenSeleccionada?.ubigeo || '',
      codLocalOrigen: String(this.direccionOrigenSeleccionada?.codLocal || '').trim(),
      departamentoOrigen: String(this.direccionOrigenSeleccionada?.region || '').trim(),
      provinciaOrigen: String(this.direccionOrigenSeleccionada?.provincia || '').trim(),
      distritoOrigen: String(this.direccionOrigenSeleccionada?.distrito || '').trim(),
      dirDestino: this.direccionDestinoSeleccionada?.direccion || '',
      ubigeoDestino: this.direccionDestinoSeleccionada?.ubigeo || '',
      codLocalDestino: String(this.direccionDestinoSeleccionada?.codLocal || '').trim(),
      departamentoDestino: String(this.direccionDestinoSeleccionada?.region || '').trim(),
      provinciaDestino: String(this.direccionDestinoSeleccionada?.provincia || '').trim(),
      distritoDestino: String(this.direccionDestinoSeleccionada?.distrito || '').trim(),
      // Destinatario
      tipoDocDestinatario: this.destinatario.tipoDoc || '6',
      numDocDestinatario: this.destinatario.numeroDoc || '',
      nomDestinatario: this.destinatario.razonSocial || '',
      // Comprobante origen / documento relacionado (cat. 61)
      comprobanteOrigenSerie: comprobanteSerie,
      comprobanteOrigenNumero: comprobanteNumeroRaw,
      tipoComprobanteOrigen: tipoRel,
      rucEmisorDocumentoRelacionado: rucEmisorRel,
      items: itemsPayload,
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

  abrirModalFormatoImpresionGre(): void {
    if (!this.ultimaGuiaRegistrada?.idGuiaElectronica) {
      iziToast.warning({ title: 'Sin guía', message: 'Primero guarde la guía para poder imprimir el PDF.', position: 'topRight' });
      return;
    }
    this.modalService.open(this.modalFormatoGrePdfTpl, { centered: true, backdrop: true });
  }

  confirmarFormatoImpresionGre(formato: GrePdfFormato, modal: NgbActiveModal): void {
    modal.close();
    this.ejecutarDescargarPdfGre(formato);
  }

  private ejecutarDescargarPdfGre(formato: GrePdfFormato): void {
    if (!this.ultimaGuiaRegistrada?.idGuiaElectronica) return;
    this.generandoPdf = true;
    const fontSize = formato === 'ticket' ? 7 : 10;
    this.facturacionService.obtenerGuia(this.ultimaGuiaRegistrada.idGuiaElectronica).subscribe({
      next: (res) => {
        void (async () => {
          const guia = res.data;
          const qrUrl = await qrDataUrlParaPdfGuia(guia);
          const html = this.construirHtmlGuia(guia, qrUrl, formato);
          this.pdfService.generarPdfDinamico({ html }, 'guia-remision', fontSize, formato).subscribe({
            next: (blob) => {
              this.generandoPdf = false;
              this.pdfService.previsualizar(blob);
            },
            error: () => {
              this.generandoPdf = false;
              iziToast.error({ title: 'Error PDF', message: 'No se pudo generar el PDF. Verifique que el servicio de reportes esté activo.', position: 'topRight' });
            }
          });
        })();
      },
      error: () => {
        this.generandoPdf = false;
        iziToast.error({ title: 'Error', message: 'No se pudo obtener la guía para el PDF.', position: 'topRight' });
      }
    });
  }

  private construirHtmlGuia(guia: any, qrDataUrl: string | null = null, formato: GrePdfFormato = 'A4'): string {
    const d = guia?.datosGuia ?? {};
    const serie  = guia?.serie  ?? '';
    const numero = guia?.numero ?? '';
    const tipoDoc = guia?.tipoDocumento === '31' ? 'GUÍA DE REMISIÓN TRANSPORTISTA' : 'GUÍA DE REMISIÓN REMITENTE';
    const codSunat = guia?.tipoDocumento === '31' ? '31' : '09';
    const fecha = (guia?.fechaEmision ?? '').slice(0, 10);
    const peso = d.cantidadPeso != null ? `${d.cantidadPeso} ${d.unidadMedidaPeso ?? 'KGM'}` : '—';
    const docRel =
      d.comprobanteOrigenSerie && d.comprobanteOrigenNumero
        ? `${d.comprobanteOrigenSerie}-${d.comprobanteOrigenNumero}`
        : '—';

    const es31 = guia?.tipoDocumento === '31';
    const mostrarFirmas = es31;
    const tamQr = formato === 'ticket' ? '2.4cm' : '2.6cm';
    const itemsHtml = greItemsTablaHtml(d.items, formato);
    const mostrarConductorPdf =
      !d.vehiculoM1L && (es31 ? true : d.modalidadTransporte === '02');
    const conductorBloque = mostrarConductorPdf
      ? `
      <tr><td style="font-weight:600">Conductor</td><td>${d.nombreConductor ?? '—'}</td><td style="font-weight:600">Doc.</td><td>${d.numeroDocConductor ?? '—'}</td></tr>
      <tr><td style="font-weight:600">Licencia</td><td>${d.licenciaConductor ?? '—'}</td><td style="font-weight:600">Placa</td><td>${d.placaVehiculo ?? '—'}${d.placaSecundaria ? ' / ' + d.placaSecundaria : ''}</td></tr>`
      : d.vehiculoM1L
        ? `<tr><td colspan="4" style="font-style:italic;color:#666">Vehículo M1/L — sin conductor/placa obligatorios en SUNAT</td></tr>`
        : '';
    const transportistaBloque = !es31 && d.modalidadTransporte === '01' ? `
      <tr><td style="font-weight:600">Transportista</td><td>${d.razonSocialTransportista ?? '—'}</td><td style="font-weight:600">RUC</td><td>${d.rucTransportista ?? '—'}</td></tr>` : '';
    const remitenteBloque = es31 && (d.nomRemitente || d.numDocRemitente)
      ? `<div class="sec">REMITENTE DE LA CARGA</div>
<table class="info">
  <tr><td>Nombre</td><td colspan="3">${d.nomRemitente ?? '—'}</td></tr>
  <tr><td>Tipo doc.</td><td>${d.tipoDocRemitente === '6' ? 'RUC' : d.tipoDocRemitente === '1' ? 'DNI' : d.tipoDocRemitente ?? '—'}</td><td>Nº</td><td>${d.numDocRemitente ?? '—'}</td></tr>
</table>`
      : '';

    const estadoLabel = guia?.idEstadoSunat === 1 ? '<span style="color:#15803d;font-weight:700">ACEPTADA</span>'
      : guia?.idEstadoSunat === 98 ? '<span style="color:#b91c1c;font-weight:700">ERROR</span>'
      : '<span style="color:#78716c;font-weight:700">PENDIENTE</span>';

    const filaTrasladoExtra = es31
      ? `<tr><td>Peso bruto</td><td>${peso}</td><td>Doc. relacionado</td><td>${docRel}</td></tr>
  <tr><td>Pagador flete</td><td colspan="3">${d.indicadorPagadorFlete || 'Sin pagador de flete'}</td></tr>`
      : (() => {
          const motivoMap: Record<string, string> = {
            '01': 'Venta', '02': 'Compra', '04': 'Traslado entre establecimientos',
            '08': 'Importación', '09': 'Exportación', '13': 'Otros'
          };
          const motivo = motivoMap[d.motivoTraslado ?? ''] || d.motivoTraslado || '—';
          const modalidad = d.modalidadTransporte === '01' ? 'Público' : 'Privado';
          return `<tr><td>Motivo</td><td>${motivo}${d.descripcionMotivo ? ' — ' + d.descripcionMotivo : ''}</td><td>Modalidad</td><td>${modalidad}</td></tr>
  <tr><td>Peso bruto</td><td>${peso}</td><td>Doc. origen</td><td>${docRel}</td></tr>`;
        })();

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>${estilosGrePdfInline(formato)}</style></head><body>
<div class="header">
  <div class="empresa"><h2>${d.emisorNombre ?? 'Empresa'}</h2><p>RUC: ${d.emisorRuc ?? '—'}</p><p>${d.dirOrigen ?? ''}</p></div>
  <div class="doc-box"><div class="tipo">${tipoDoc}</div><div class="cod">Tipo doc.: ${codSunat}</div>
    <div class="serie">${serie}-${numero}</div><div class="estado">${estadoLabel}</div></div>
</div>
<div class="sec">DATOS DEL TRASLADO</div>
<table class="info">
  <tr><td>Fecha</td><td>${fecha}</td><td>Hora</td><td>${d.horaInicioTraslado ?? '—'}</td></tr>
  ${filaTrasladoExtra}
</table>
<div class="sec">DESTINATARIO</div>
<table class="info">
  <tr><td>Nombre</td><td colspan="3">${d.nomDestinatario ?? '—'}</td></tr>
  <tr><td>Tipo doc.</td><td>${d.tipoDocDestinatario === '6' ? 'RUC' : d.tipoDocDestinatario === '1' ? 'DNI' : d.tipoDocDestinatario ?? '—'}</td><td>Nº</td><td>${d.numDocDestinatario ?? '—'}</td></tr>
</table>
${remitenteBloque}
<div class="sec">DIRECCIONES</div>
<table class="info">
  <tr><td>Origen</td><td colspan="3">${d.dirOrigen ?? '—'}</td></tr>
  <tr><td>Destino</td><td colspan="3">${d.dirDestino ?? '—'}</td></tr>
</table>
<div class="sec">TRANSPORTE</div>
<table class="info">${conductorBloque}${transportistaBloque}</table>
<div class="sec">BIENES TRASLADADOS</div>
${itemsHtml}
${mostrarFirmas ? htmlFirmasGreTransportista() : ''}
${htmlBloqueQrSunatGre(qrDataUrl, { soloDatoQr: true, tamanoQr: tamQr })}
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

