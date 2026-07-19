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
import { CatalogosService } from '../../../services/catalogos.service';
import { EnviosService } from '../../../services/envios.service';
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
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SeleccionarProveedorGreModalComponent
  ],
  templateUrl: './guias-remision.component.html',
  styleUrl: './guias-remision.component.css'
})
export class GuiasRemisionComponent implements OnInit {

  public sidebarState = inject(SidebarStateService);

  private facturacionService = inject(FacturacionService);
  private empresaService = inject(EmpresaService);
  private factilizaService = inject(FactilizaService);
  private clienteService = inject(ClienteService);
  private catalogosService = inject(CatalogosService);
  private enviosService = inject(EnviosService);
  private consultaXmlService = inject(ConsultaXMLService);
  private proveedoresService = inject(ProveedoresService);
  private pdfService = inject(PdfService);
  private modalService = inject(NgbModal);
  private router = inject(Router);

  @ViewChild('modalFormatoGrePdf') modalFormatoGrePdfTpl!: TemplateRef<unknown>;
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

  /** Motivo 02 (compra): consulta factura/boleta del proveedor en SUNAT vía Factiliza (clave SOL). */
  compraSunat = {
    rucMiEmpresa: '',
    usuarioSol: '',
    passwordSol: '',
    rucProveedor: '',
    tipoDocCompra: '01' as '01' | '03'
  };
  consultandoCompraSunat = false;

  /** Modal catálogo proveedores (compra SUNAT). */
  modalProveedorGreVisible = false;
  /** Direcciones del proveedor elegido → punto de partida en motivo compra. */
  direccionesOrigenProveedorGre: any[] = [];
  usarOrigenDireccionesProveedor = false;
  /** Evita consultas repetidas al tipear el mismo RUC de proveedor. */
  private ultimoRucProveedorOrigenConsultado = '';

  // Selección de comprobante origen
  buscarSerie = '';
  buscarNumero = '';
  comprobanteOrigen: any = null;

  /** Fuente del comprobante de origen: 'buscar' (BD/SUNAT) o 'manual' (captura directa). */
  fuenteComprobante: 'buscar' | 'manual' = 'buscar';

  /** Tipos de comprobante SUNAT (catálogo 01) admitidos como documento relacionado. */
  readonly tiposComprobanteOrigen = [
    { value: '01', label: '01 — Factura' },
    { value: '03', label: '03 — Boleta de venta' },
    { value: '09', label: '09 — Guía de remisión' },
    { value: '12', label: '12 — Ticket / cinta' },
    { value: '31', label: '31 — Guía de remisión transportista' }
  ];

  /** Alta manual de direcciones (origen/destino) cuando no vienen de catálogo. */
  mostrarFormDirOrigen = false;
  mostrarFormDirDestino = false;
  formDirOrigen = this.nuevaDireccionManualVacia();
  formDirDestino = this.nuevaDireccionManualVacia();

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
          trans: this.enviosService.obtenerTransportistas().pipe(catchError(() => of({ data: [] }))),
          cfg: this.facturacionService.obtenerConfiguracion().pipe(catchError(() => of({ data: null })))
        }).subscribe({
          next: ({ dir, mot, trans, cfg }) => {
            this.direccionesEmpresa = dir?.data || [];
            const m = mot?.data || [];
            this.motivosTraslado = m.length > 0 ? m : this.motivosTrasladoFallback();
            this.transportistas = trans?.data || [];
            const c = cfg?.data;
            if (c) {
              const rucEmp = String(c.rucEmpresa || '')
                .replace(/\D/g, '')
                .slice(0, 11);
              if (rucEmp.length === 11) {
                this.compraSunat.rucMiEmpresa = rucEmp;
              }
              if (c.usuarioSunat) {
                this.compraSunat.usuarioSol = String(c.usuarioSunat).trim();
              }
            }
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
        if (String(g.tipoDocumento || '') === '31') {
          iziToast.info({
            title: 'Redirigiendo',
            message: 'Esta guía es transportista (31). Se abrirá el formulario correspondiente.',
            position: 'topRight'
          });
          void this.router.navigate(['/facturacion/guias-transportista'], { queryParams: { editar: id }, replaceUrl: true });
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
              this.asegurarItemsComprobanteEditables();
              this.cargarDireccionesDestinoLocal(res.data);
              this.prefillDestinatarioDesdeComprobante(res.data);
              this.intentarAutocompletarUbigeoOrigen();
            } else {
              this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
              this.asegurarItemsComprobanteEditables();
              this.intentarAutocompletarUbigeoOrigen();
              this.sincronizarDestinoAlmacenSiCompra();
            }
          },
          error: () => {
            this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
            this.asegurarItemsComprobanteEditables();
            this.intentarAutocompletarUbigeoOrigen();
            this.sincronizarDestinoAlmacenSiCompra();
          }
        });
    } else {
      this.comprobanteOrigen = this.comprobanteOrigenSinteticoDesdeGuia(g, d);
      this.asegurarItemsComprobanteEditables();
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
   * Factura/boleta de compra registrada en SUNAT (emisor = proveedor).
   * Usa POST consultar-comprobante-sunat; credenciales SOL pueden ir en el formulario o en Configuración → Facturación.
   */
  consultarFacturaCompraSunat(): void {
    if (!this.esMotivoCompraGre()) {
      iziToast.warning({
        title: 'Motivo',
        message: 'La consulta SUNAT de compra solo aplica con motivo 02 — Compra.',
        position: 'topRight'
      });
      return;
    }
    const proveedor = String(this.compraSunat.rucProveedor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (proveedor.length !== 11) {
      iziToast.warning({
        title: 'Proveedor',
        message: 'Ingrese el RUC del proveedor (emisor de la factura de compra), 11 dígitos.',
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
        message: 'Indique el RUC de su empresa (titular de la clave SOL). Se puede precargar desde Configuración → Facturación.',
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
      tipo_doc: this.compraSunat.tipoDocCompra,
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
        this.comprobanteOrigen = comprobanteOrigen as any;
        this.guia.motivoTraslado = '02';
        this.asegurarItemsComprobanteEditables();
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

  /**
   * Proveedor desde catálogo: RUC para SUNAT, direcciones como origen del traslado (compra) y datos en resumen si ya hay comprobante.
   */
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
    this.ultimoRucProveedorOrigenConsultado = ruc;
    const idProveedor = Number(p.idProveedor);
    if (!Number.isFinite(idProveedor) || idProveedor <= 0) {
      iziToast.warning({ title: 'Proveedor', message: 'Proveedor sin identificador válido.', position: 'topRight' });
      return;
    }
    this.cargarDireccionesOrigenProveedorPorId(idProveedor, {
      ruc,
      rSocial: p.rSocial,
      idProveedor
    }, `${p.rSocial || ruc} seleccionado`);
  }

  /**
   * Motivo compra + ingreso manual: al completar el RUC emisor busca proveedor en BD y carga dirección de origen.
   */
  onRucEmisorComprobanteChange(rucRaw: string): void {
    if (!this.comprobanteOrigen) {
      return;
    }
    const ruc = String(rucRaw || '').replace(/\D/g, '').slice(0, 11);
    this.comprobanteOrigen.rucEmisor = ruc;
    this.comprobanteOrigen.rucEmpresa = ruc;

    if (!this.esMotivoCompraGre()) {
      return;
    }
    if (ruc.length !== 11) {
      this.ultimoRucProveedorOrigenConsultado = '';
      return;
    }
    if (ruc === this.ultimoRucProveedorOrigenConsultado) {
      return;
    }
    this.ultimoRucProveedorOrigenConsultado = ruc;
    this.compraSunat.rucProveedor = ruc;

    this.proveedoresService.obtener_proveedor_ruc(ruc).subscribe({
      next: (response: { data?: Record<string, unknown>[] }) => {
        const filas = Array.isArray(response?.data) ? response.data : [];
        if (filas.length === 0) {
          iziToast.info({
            title: 'Proveedor',
            message: 'No se encontró proveedor con ese RUC en su base de datos. Regístrelo en Compras o agregue la dirección manualmente.',
            position: 'topRight'
          });
          return;
        }
        const row = filas[0];
        const nom = String(row['rSocial'] ?? row['razonSocial'] ?? row['RazonSocial'] ?? '').trim();
        if (nom && this.comprobanteOrigen) {
          this.comprobanteOrigen.nombreEmisor = nom;
        }
        const idProveedor = Number(row['idProveedor']);
        if (Number.isFinite(idProveedor) && idProveedor > 0) {
          this.cargarDireccionesOrigenProveedorPorId(idProveedor, row, nom || ruc);
        } else {
          this.aplicarDireccionProveedorFallbackDesdeFila(row);
        }
      },
      error: () => {
        iziToast.error({
          title: 'Error',
          message: 'No se pudo buscar el proveedor en la base de datos.',
          position: 'topRight'
        });
      }
    });
  }

  private cargarDireccionesOrigenProveedorPorId(
    idProveedor: number,
    proveedorRow?: Record<string, unknown>,
    etiquetaExito?: string
  ): void {
    const ruc = String(proveedorRow?.['ruc'] || this.compraSunat.rucProveedor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (ruc.length === 11) {
      this.compraSunat.rucProveedor = ruc;
    }

    this.proveedoresService.obtener_direccionesProveedor_idProveedor(idProveedor).subscribe({
      next: (res: { data?: unknown[] }) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        const lista = raw.map((d) => this.mapDireccionProveedorGreRow(d as Record<string, unknown>));
        if (lista.length > 0) {
          this.aplicarDireccionesOrigenProveedorGre(lista, proveedorRow);
          const nom = String(
            proveedorRow?.['rSocial'] ?? proveedorRow?.['razonSocial'] ?? etiquetaExito ?? ruc
          ).trim();
          iziToast.success({
            title: 'Proveedor',
            message: `${nom || 'Proveedor'}: dirección de origen cargada desde la base de datos.`,
            position: 'topRight'
          });
          return;
        }
        this.aplicarDireccionProveedorFallbackDesdeFila(proveedorRow || {});
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

  private aplicarDireccionesOrigenProveedorGre(
    lista: Record<string, unknown>[],
    proveedorRow?: Record<string, unknown>
  ): void {
    this.direccionesOrigenProveedorGre = lista;
    this.usarOrigenDireccionesProveedor = lista.length > 0;
    if (lista.length > 0) {
      const principal = lista.find((x) => x['principal']) || lista[0];
      this.direccionOrigenSeleccionada = principal;
    } else {
      this.direccionOrigenSeleccionada = null;
      this.intentarAutocompletarUbigeoOrigen();
    }
    const ruc = String(proveedorRow?.['ruc'] || this.compraSunat.rucProveedor || '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (this.comprobanteOrigen && ruc.length === 11) {
      this.comprobanteOrigen.rucEmisor = ruc;
      this.comprobanteOrigen.rucEmpresa = ruc;
      const nom = String(proveedorRow?.['rSocial'] ?? proveedorRow?.['razonSocial'] ?? '').trim();
      if (nom) {
        this.comprobanteOrigen.nombreEmisor = nom;
      }
    }
    this.sincronizarDestinoAlmacenSiCompra();
  }

  /** Usa la dirección del registro de proveedor cuando no hay tabla de direcciones. */
  private aplicarDireccionProveedorFallbackDesdeFila(proveedorRow: Record<string, unknown>): void {
    const dir = String(proveedorRow['direccion'] || '').trim();
    if (!dir) {
      this.direccionesOrigenProveedorGre = [];
      this.usarOrigenDireccionesProveedor = false;
      this.direccionOrigenSeleccionada = null;
      iziToast.info({
        title: 'Sin direcciones de proveedor',
        message: 'El proveedor no tiene direcciones registradas. Agréguelas en Compras o use «Agregar dirección manual» en el paso 3.',
        position: 'topRight'
      });
      this.sincronizarDestinoAlmacenSiCompra();
      return;
    }
    const origen = {
      direccion: dir,
      ubigeo: String(proveedorRow['ubigeo'] || '').replace(/\D/g, '').slice(0, 6),
      codLocal: String(proveedorRow['codLocal'] || '').trim(),
      region: String(proveedorRow['region'] || '').trim(),
      provincia: String(proveedorRow['provincia'] || '').trim(),
      distrito: String(proveedorRow['distrito'] || '').trim(),
      referencia: 'Proveedor',
      principal: true
    };
    this.aplicarDireccionesOrigenProveedorGre([origen], proveedorRow);
    const nom = String(proveedorRow['rSocial'] ?? proveedorRow['razonSocial'] ?? '').trim();
    iziToast.success({
      title: 'Proveedor',
      message: `${nom || 'Proveedor'}: dirección de origen cargada.`,
      position: 'topRight'
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
    this.ultimoRucProveedorOrigenConsultado = '';
    this.intentarAutocompletarUbigeoOrigen();
  }

  /** Si el XML de SUNAT trae otro RUC emisor que el catálogo de direcciones, se revierte el origen por proveedor. */
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

  /** Motivo 02 (compra): origen = proveedor, destino = almacén empresa. Resto (p. ej. 01 venta): origen = empresa, destino = cliente. */
  esMotivoCompraGre(): boolean {
    return this.guia.motivoTraslado === '02';
  }

  listaDireccionesOrigenGre(): any[] {
    return this.esMotivoCompraGre() ? this.direccionesOrigenProveedorGre : this.direccionesEmpresa;
  }

  listaDireccionesDestinoGre(): any[] {
    return this.esMotivoCompraGre() ? this.direccionesEmpresa : this.direccionesDestinoLocal;
  }

  onMotivoTrasladoGreChange(): void {
    const co = this.comprobanteOrigen;
    if (co?.esManual) {
      const rucEmisor = this.esMotivoCompraGre()
        ? String(this.compraSunat.rucProveedor || '').replace(/\D/g, '').slice(0, 11)
        : this.rucMiEmpresaNormalizado();
      if (rucEmisor) {
        co.rucEmisor = rucEmisor;
        co.rucEmpresa = rucEmisor;
      }
    }
    if (co && !co.esManual && this.guia.motivoTraslado) {
      const coEsCompraSunat = !!co.origenDesdeCompraSunat;
      if (this.esMotivoCompraGre() !== coEsCompraSunat) {
        this.comprobanteOrigen = null;
        this.buscarSerie = '';
        this.buscarNumero = '';
        iziToast.info({
          title: 'Comprobante',
          message: 'El comprobante cargado no coincide con el motivo. Busque o consulte de nuevo según corresponda.',
          position: 'topRight'
        });
      }
    }
    if (this.esMotivoCompraGre()) {
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

  /** Si motivo compra, el destino del traslado es el almacén (direcciones de la empresa). */
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

  /** Tras consulta SUNAT compra: marca origen, completa RUC receptor si falta, Factiliza RUC para nombres y prefill destinatario. */
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
      iziToast.success({
        title: 'Comprobante cargado',
        message: 'Detalle desde SUNAT. Revise proveedor, receptor, direcciones y ubigeo.',
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

  buscarComprobanteOrigen(): void {
    if (!this.guia.motivoTraslado) {
      iziToast.warning({
        title: 'Motivo',
        message: 'Seleccione primero el motivo de traslado.',
        position: 'topRight'
      });
      return;
    }
    if (!this.buscarSerie.trim() || !this.buscarNumero.trim()) {
      iziToast.warning({
        title: 'Datos incompletos',
        message: 'Ingrese serie y número del comprobante',
        position: 'topRight'
      });
      return;
    }
    if (this.guia.motivoTraslado === '02') {
      iziToast.info({
        title: 'Motivo compra',
        message:
          'La búsqueda interna solo lista comprobantes de venta emitidos por su empresa. Para una compra use «Consultar en SUNAT (Factiliza)» abajo.',
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
          delete this.comprobanteOrigen.origenDesdeCompraSunat;
          this.asegurarItemsComprobanteEditables();
          this.limpiarOrigenProveedorGre();
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

  /** Garantiza que el comprobante cargado tenga ítems editables (al menos una fila). */
  private asegurarItemsComprobanteEditables(): void {
    if (!this.comprobanteOrigen) return;
    if (!Array.isArray(this.comprobanteOrigen.items) || this.comprobanteOrigen.items.length === 0) {
      this.comprobanteOrigen.items = [this.nuevoItemManual()];
    }
  }

  // ===================== Comprobante manual =====================

  private nuevoItemManual(): { codigo: string; descripcion: string; cantidad: number; unidad: string } {
    return { codigo: '', descripcion: '', cantidad: 1, unidad: 'NIU' };
  }

  private nuevaDireccionManualVacia(): {
    direccion: string; ubigeo: string; codLocal: string;
    region: string; provincia: string; distrito: string; referencia: string;
  } {
    return { direccion: '', ubigeo: '', codLocal: '', region: '', provincia: '', distrito: '', referencia: '' };
  }

  /** Cambia entre buscar comprobante existente e ingreso manual del comprobante. */
  onFuenteComprobanteChange(): void {
    if (this.fuenteComprobante === 'manual') {
      this.iniciarComprobanteManual();
    } else if (this.comprobanteOrigen?.esManual) {
      this.comprobanteOrigen = null;
      this.direccionesDestinoLocal = [];
      this.direccionDestinoSeleccionada = null;
    }
  }

  /** Crea el esqueleto editable del comprobante manual y prefilla el RUC emisor según el motivo. */
  private iniciarComprobanteManual(): void {
    const rucEmisor = this.esMotivoCompraGre()
      ? String(this.compraSunat.rucProveedor || '').replace(/\D/g, '').slice(0, 11)
      : this.rucMiEmpresaNormalizado();
    this.comprobanteOrigen = {
      esManual: true,
      serie: '',
      numero: '',
      tipoComprobante: '01',
      rucEmisor,
      rucEmpresa: rucEmisor,
      total: null as number | null,
      items: [this.nuevoItemManual()]
    };
    this.limpiarOrigenProveedorGre();
    this.direccionesDestinoLocal = [];
    this.direccionDestinoSeleccionada = null;
    if (this.esMotivoCompraGre()) {
      this.sincronizarDestinoAlmacenSiCompra();
      if (rucEmisor.length === 11) {
        this.onRucEmisorComprobanteChange(rucEmisor);
      }
    }
    this.intentarAutocompletarUbigeoOrigen();
  }

  agregarItemManual(): void {
    this.agregarItemComprobante();
  }

  eliminarItemManual(index: number): void {
    this.eliminarItemComprobante(index);
  }

  /** Agrega una línea al comprobante de origen (manual o cargado desde búsqueda). */
  agregarItemComprobante(): void {
    if (!this.comprobanteOrigen) return;
    if (!Array.isArray(this.comprobanteOrigen.items)) {
      this.comprobanteOrigen.items = [];
    }
    this.comprobanteOrigen.items.push(this.nuevoItemManual());
  }

  /** Quita una línea del comprobante de origen. */
  eliminarItemComprobante(index: number): void {
    if (!this.comprobanteOrigen || !Array.isArray(this.comprobanteOrigen.items)) return;
    this.comprobanteOrigen.items.splice(index, 1);
    if (this.comprobanteOrigen.items.length === 0) {
      this.comprobanteOrigen.items.push(this.nuevoItemManual());
    }
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

  /** Carga direcciones del cliente destinatario (BD) hacia el selector de destino. */
  private cargarDireccionesDestinoDesdeDestinatario(idCliente: number, clienteRow?: Record<string, unknown>): void {
    if (this.esMotivoCompraGre()) {
      return;
    }
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
        if (clienteRow) {
          this.aplicarDireccionClienteFallbackDesdeFila(clienteRow);
        }
      },
      error: () => {
        if (clienteRow) {
          this.aplicarDireccionClienteFallbackDesdeFila(clienteRow);
        }
      }
    });
  }

  /** Usa la dirección principal del registro de cliente cuando no hay tabla de direcciones. */
  private aplicarDireccionClienteFallbackDesdeFila(clienteRow: Record<string, unknown>): void {
    if (this.esMotivoCompraGre()) {
      return;
    }
    const dir = String(clienteRow['direccion'] || '').trim();
    if (!dir) {
      return;
    }
    const destino = {
      direccion: dir,
      ubigeo: String(clienteRow['ubigeo'] || '').replace(/\D/g, '').slice(0, 6),
      codLocal: String(clienteRow['codLocal'] || '').trim(),
      region: String(clienteRow['region'] || '').trim(),
      provincia: String(clienteRow['provincia'] || '').trim(),
      distrito: String(clienteRow['distrito'] || '').trim(),
      referencia: 'Dirección del cliente'
    };
    this.direccionesDestinoLocal = [destino];
    this.direccionDestinoSeleccionada = destino;
  }

  /** Agrega dirección de destino a partir de texto (p. ej. respuesta Factiliza). */
  private agregarDireccionDestinoDesdeConsultaExterna(direccion: string, ubigeo?: string): void {
    if (this.esMotivoCompraGre()) {
      return;
    }
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

  /** Busca destinatario en BD por documento; si no existe consulta Factiliza. */
  private buscarDestinatarioEnBd(
    numero: string,
    tipoDoc: '6' | '1',
    onNoEncontrado: () => void
  ): void {
    this.consultandoDestinatario = true;
    this.clienteService.obtener_cliente_ruc(numero).subscribe({
      next: (response: { data?: Record<string, unknown>[] }) => {
        const filas = Array.isArray(response?.data) ? response.data : [];
        if (filas.length > 0) {
          const row = filas[0];
          this.destinatario.tipoDoc = tipoDoc;
          this.destinatario.numeroDoc = String(row['ruc'] || numero).trim();
          this.destinatario.razonSocial = String(
            row['rSocial'] ?? row['r_Social'] ?? row['razonSocial'] ?? row['RazonSocial'] ?? ''
          ).trim();
          const idCliente = Number(row['idCliente']);
          if (Number.isFinite(idCliente) && idCliente > 0) {
            this.cargarDireccionesDestinoDesdeDestinatario(idCliente, row);
          } else {
            this.aplicarDireccionClienteFallbackDesdeFila(row);
          }
          this.consultandoDestinatario = false;
          iziToast.success({
            title: 'Cliente',
            message: 'Encontrado en base de datos. Dirección de destino cargada.',
            position: 'topRight'
          });
          return;
        }
        onNoEncontrado();
      },
      error: () => onNoEncontrado()
    });
  }

  /** Valida y arma una dirección a partir de un formulario manual (origen/destino). */
  private construirDireccionManualDesde(f: {
    direccion: string; ubigeo: string; codLocal: string;
    region: string; provincia: string; distrito: string; referencia: string;
  }): Record<string, unknown> | null {
    const direccion = String(f.direccion || '').trim();
    const ubigeo = String(f.ubigeo || '').replace(/\D/g, '').slice(0, 6);
    if (!direccion) {
      iziToast.warning({ title: 'Dirección', message: 'Ingrese la dirección.', position: 'topRight' });
      return null;
    }
    if (ubigeo.length !== 6) {
      iziToast.warning({ title: 'Ubigeo', message: 'El ubigeo debe tener 6 dígitos (INEI).', position: 'topRight' });
      return null;
    }
    return {
      direccion,
      ubigeo,
      codLocal: String(f.codLocal || '').trim(),
      region: String(f.region || '').trim(),
      provincia: String(f.provincia || '').trim(),
      distrito: String(f.distrito || '').trim(),
      referencia: String(f.referencia || '').trim() || 'Manual',
      principal: false
    };
  }

  agregarDireccionOrigenManual(): void {
    const d = this.construirDireccionManualDesde(this.formDirOrigen);
    if (!d) return;
    if (this.esMotivoCompraGre()) {
      this.direccionesOrigenProveedorGre = [...this.direccionesOrigenProveedorGre, d];
      this.usarOrigenDireccionesProveedor = true;
    } else {
      this.direccionesEmpresa = [...this.direccionesEmpresa, d];
    }
    this.direccionOrigenSeleccionada = d;
    this.formDirOrigen = this.nuevaDireccionManualVacia();
    this.mostrarFormDirOrigen = false;
    iziToast.success({ title: 'Origen', message: 'Dirección de origen agregada.', position: 'topRight' });
  }

  agregarDireccionDestinoManual(): void {
    const d = this.construirDireccionManualDesde(this.formDirDestino);
    if (!d) return;
    if (this.esMotivoCompraGre()) {
      this.direccionesEmpresa = [...this.direccionesEmpresa, d];
    } else {
      this.direccionesDestinoLocal = [...this.direccionesDestinoLocal, d];
    }
    this.direccionDestinoSeleccionada = d;
    this.formDirDestino = this.nuevaDireccionManualVacia();
    this.mostrarFormDirDestino = false;
    iziToast.success({ title: 'Destino', message: 'Dirección de destino agregada.', position: 'topRight' });
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
          .map((d: any) => this.mapDireccionClienteGreRow(d as Record<string, unknown>));

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

  /** Consulta RUC: primero en BD (carga dirección destino); si no existe, consulta Factiliza. */
  consultarRucDestinatario(): void {
    const num = (this.destinatario.numeroDoc || '').toString().trim();
    if (num.length !== 11) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 11 dígitos del RUC.', position: 'topRight' });
      return;
    }
    this.destinatario.tipoDoc = '6';
    this.buscarDestinatarioEnBd(num, '6', () => this.consultarRucDestinatarioFactiliza(num));
  }

  private consultarRucDestinatarioFactiliza(num: string): void {
    this.consultandoDestinatario = true;
    this.factilizaService.getRuc(num).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        const razon = data?.razonSocial || data?.nombre_o_razon_social || data?.nombre || res?.razonSocial || '';
        if (razon) {
          this.destinatario.razonSocial = String(razon).trim();
        }
        const dir = String(data?.direccion ?? data?.direccion_completa ?? data?.direccionCompleta ?? '').trim();
        if (dir) {
          this.agregarDireccionDestinoDesdeConsultaExterna(dir, data?.ubigeo);
        }
        this.consultandoDestinatario = false;
        if (!razon) {
          iziToast.info({ title: 'Sin datos', message: 'RUC consultado en SUNAT; no se obtuvo razón social.', position: 'topRight' });
        }
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo consultar el RUC.', position: 'topRight' });
        this.consultandoDestinatario = false;
      }
    });
  }

  /** Consulta DNI: primero en BD (carga dirección destino); si no existe, consulta Factiliza. */
  consultarDniDestinatario(): void {
    const num = (this.destinatario.numeroDoc || '').toString().trim();
    if (num.length !== 8) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese 8 dígitos del DNI.', position: 'topRight' });
      return;
    }
    this.destinatario.tipoDoc = '1';
    this.buscarDestinatarioEnBd(num, '1', () => this.consultarDniDestinatarioFactiliza(num));
  }

  private consultarDniDestinatarioFactiliza(num: string): void {
    this.consultandoDestinatario = true;
    this.factilizaService.getDni(num).subscribe({
      next: (res: any) => {
        const nombre = extraerNombreCompletoDesdeDni(res);
        if (nombre) {
          this.destinatario.razonSocial = nombre;
        }
        const data = res?.data ?? res;
        const dir = String(data?.direccion ?? data?.direccion_completa ?? '').trim();
        if (dir) {
          this.agregarDireccionDestinoDesdeConsultaExterna(dir, data?.ubigeo);
        }
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
    const ruc = this.rucParaAnexosOrigenGre();
    if (!ruc) {
      iziToast.warning({
        title: 'Sin RUC',
        message: this.esMotivoCompraGre()
          ? 'Indique RUC proveedor, elija proveedor desde el catálogo o cargue el comprobante de compra.'
          : 'No se pudo obtener el RUC de su empresa para anexos del almacén de origen.',
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
    const ruc = this.esMotivoCompraGre()
      ? this.rucMiEmpresaNormalizado()
      : String(this.comprobanteOrigen?.documento_cliente || this.comprobanteOrigen?.rucCliente || '')
          .replace(/\D/g, '')
          .slice(0, 11);
    if (!ruc || String(ruc).length !== 11) {
      iziToast.warning({
        title: 'Sin RUC',
        message: this.esMotivoCompraGre()
          ? 'No hay RUC de su empresa para consultar anexos del almacén de destino.'
          : 'El comprobante no tiene RUC del cliente destinatario.',
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
    const itemsOrigen = Array.isArray(this.comprobanteOrigen.items) ? this.comprobanteOrigen.items : [];
    const itemsValidos = itemsOrigen.filter(
      (it: any) => String(it.descripcion || '').trim() && Number(it.cantidad) > 0
    );
    if (itemsValidos.length === 0) {
      iziToast.warning({
        title: 'Ítems',
        message: 'Agregue al menos un ítem con descripción y cantidad mayor a 0.',
        position: 'topRight'
      });
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
      // Comprobante origen
      comprobanteOrigenSerie: this.comprobanteOrigen?.serie || '',
      comprobanteOrigenNumero: this.comprobanteOrigen?.numero || '',
      tipoComprobanteOrigen: this.comprobanteOrigen?.tipoComprobante || '01',
      rucEmisorDocumentoRelacionado: String(
        this.comprobanteOrigen?.rucEmpresa || this.comprobanteOrigen?.rucEmisor || ''
      ).trim(),
      items: (this.comprobanteOrigen?.items || [])
        .filter((it: any) => String(it.descripcion || '').trim().length > 0)
        .map((it: any) => ({
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
    const motivoMap: Record<string, string> = {
      '01': 'Venta', '02': 'Compra', '04': 'Traslado entre establecimientos',
      '08': 'Importación', '09': 'Exportación', '13': 'Otros'
    };
    const motivo = motivoMap[d.motivoTraslado ?? ''] || d.motivoTraslado || '—';
    const modalidad = d.modalidadTransporte === '01' ? 'Público' : 'Privado';
    const peso = d.cantidadPeso != null ? `${d.cantidadPeso} ${d.unidadMedidaPeso ?? 'KGM'}` : '—';

    const mostrarFirmas = guia?.tipoDocumento === '31';
    const tamQr = formato === 'ticket' ? '2.4cm' : '2.6cm';
    const itemsHtml = greItemsTablaHtml(d.items, formato);

    const conductorBloque = d.modalidadTransporte === '02' ? `
      <tr><td style="font-weight:600">Conductor</td><td>${d.nombreConductor ?? '—'}</td><td style="font-weight:600">Doc.</td><td>${d.numeroDocConductor ?? '—'}</td></tr>
      <tr><td style="font-weight:600">Licencia</td><td>${d.licenciaConductor ?? '—'}</td><td style="font-weight:600">Placa</td><td>${d.placaVehiculo ?? '—'}${d.placaSecundaria ? ' / ' + d.placaSecundaria : ''}</td></tr>` : '';
    const transportistaBloque = d.modalidadTransporte === '01' ? `
      <tr><td style="font-weight:600">Transportista</td><td>${d.razonSocialTransportista ?? '—'}</td><td style="font-weight:600">RUC</td><td>${d.rucTransportista ?? '—'}</td></tr>` : '';

    const estadoLabel = guia?.idEstadoSunat === 1 ? '<span style="color:#15803d;font-weight:700">ACEPTADA</span>'
      : guia?.idEstadoSunat === 98 ? '<span style="color:#b91c1c;font-weight:700">ERROR</span>'
      : '<span style="color:#78716c;font-weight:700">PENDIENTE</span>';

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

