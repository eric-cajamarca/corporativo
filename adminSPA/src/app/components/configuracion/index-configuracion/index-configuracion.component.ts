import { Component, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { ComprasService } from '../../../services/compras.service';
import { ImpuestoService } from '../../../services/impuesto.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { SucursalService } from '../../../services/sucursal.service';
import { EmpresaService } from '../../../services/empresa.service';
import { FacturacionService } from '../../../services/facturacion.service';
import { VentasService } from '../../../services/ventas.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { Impuesto } from '../../../interfaces/impuesto.interface';
import { GestoresService, ConfiguracionEmpresa } from '../../../services/gestores.service';
import { interpretarBooleanoConfig } from '../../../utils/config-valor-booleano.util';

declare var iziToast: any;

@Component({
  selector: 'app-index-configuracion',
  imports: [FormsModule, CommonModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './index-configuracion.component.html',
  styleUrl: './index-configuracion.component.css'
})
export class IndexConfiguracionComponent implements OnInit {
  @ViewChild('modalImpuestoForm') modalImpuestoRef?: ElementRef<HTMLDivElement>;
  @ViewChild('modalComprobantes') modalComprobantesRef?: ElementRef<HTMLDivElement>;

  // Configuración general (se llena con la empresa del usuario logueado)
  public configuracion = {
    idEmpresa: '' as string | number,
    nombreEmpresa: '',
    ruc: '',
    telefono: '',
    email: '',
    direccion: '',
    logo: '',
    moneda: 'PEN',
    idioma: 'es',
    zonaHoraria: 'America/Lima'
  };

  // Configuración de facturación (series, ruta y opciones de envío se cargan/guardan en API)
  public facturacion = {
    serieFactura: 'F001',
    serieBoleta: 'B001',
    serieNotaCredito: 'FC01',
    serieNotaDebito: 'FD01',
    rutaCarpetaFacturadorSunat: '' as string,
    urlFacturadorSunat: 'http://localhost:9000' as string,
    envioAutomatico: false,
    minutosEnvioAutomatico: 10,
    envioPorLotes: false,
    programacionEnvioLotes: '' as string,
    igv: 18,
    autoNumeracion: true,
    enviarSunat: true,
    modoPrueba: true,
    tieneCertificado: false,
    envioDirectoSunat: false,
    useResumenDiarioBoletas: false,
    usaGuiasElectronicas: false,
    urlEnvio: '' as string,
    usuarioSunat: '' as string,
    claveSunat: '' as string,
    rucEmpresa: '' as string,
    modoEnvioSunat: 2,
    horaEnvioSunat: '09:00' as string
  };
  public facturacionGuardando = false;
  public enviandoLote = false;
  /** Certificado: archivo seleccionado y clave para subir */
  public certificadoArchivo: File | null = null;
  public certificadoClave = '';
  public certificadoSubiendo = false;

  // Configuración de inventario
  public inventario = {
    alertaStockMinimo: 10,
    alertaStockMaximo: 1000,
    permitirVentasNegativas: false,
    controlLotes: true,
    controlVencimiento: true,
    ubicaciones: true,
    productosConImagenes: false
  };
  public inventarioGuardando = false;
  public pdfComprobante = {
    cuentasBancarias: '',
    usarTemaColor: true,
    colorPrimario: '#0B5FA5'
  };
  public pdfComprobanteGuardando = false;

  // Configuración de ventas
  public ventas = {
    permitirCreditos: true,
    diasCreditoMaximo: 30,
    interesMoratorio: 2.5,
    descuentoMaximo: 15,
    comisionVendedor: 5,
    /** Si es false, no se acumula descuento en el POS y en PDF el monto de descuentos se muestra 0.00 */
    usarDescuentoEnTotal: true,
    /** Tras registrar venta en “Nueva venta”, mostrar modal para generar PDF / WhatsApp */
    mostrarModalPdfTrasRegistrarVenta: true
  };
  public ventasGuardando = false;

  // Configuración de sistema
  public sistema = {
    backupAutomatico: true,
    frecuenciaBackup: 'diario',
    rutaBackupLocal: 'D:\\sql_backups',
    rutaBackupSecundaria: '',
    googleDriveRemote: '',
    restauracionSemanal: true,
    retencionLogs: 90,
    notificacionesEmail: true,
    notificacionesWhatsApp: false,
    modoMantenimiento: false,
    exportarConciliacionCulqi: true
  };
  public sistemaGuardando = false;
  public puedeEditarSistemaOperativo = false;
  /** Pestaña Sistema: visible solo si empresa principal o usuario superAdmin. */
  public mostrarTabSistema = false;
  /** Placeholder UNC para copia secundaria (evita escapado frágil en plantilla). */
  readonly ejemploUncBackupSecundario = '\\\\SERVIDOR\\Compartida\\sql_backups';

  /** Correlativo de códigos de producto (número inicial por defecto 10000) */
  public correlativo: { idCorrelativo?: number; numero?: number } = { numero: 10000 };
  public correlativoGuardando = false;
  public correlativoMensaje: string | null = null;

  /** Impuestos */
  impuestos: Impuesto[] = [];
  impuestosCargando = false;
  impuestoGuardando = false;
  impuestoEditando: Impuesto | null = null;
  /** Catálogo 05 SUNAT para selector de código tributo */
  codigosSunatImpuesto: Array<{ codigo: string; descripcion: string }> = [];
  impuestoForm = {
    descripcion: '',
    codigoSunat: '' as string,
    porcentaje: 0,
    pIncluyeIGV: false,
    estado: true
  };

  /** Comprobante por defecto: estado pedido y estado pago al crear nueva venta */
  ventasDefaults = { idEstadoPedidoPorDefecto: 1, idEstadoPagoPorDefecto: 2 };
  ventasDefaultsGuardando = false;

  /** Comprobantes (series y correlativos) */
  comprobantes: Array<{ idComprobante: number; codigo: string; nombre: string; serie: string; numero: number; usarEnVenta: boolean; usarEnCompra: boolean }> = [];
  comprobantesCargando = false;
  comprobanteGuardandoId: number | null = null;
  comprobanteCreando = false;
  nuevoComprobante = { codigo: '', nombre: '', serie: '', numero: 1, usarEnVenta: true, usarEnCompra: true };
  /** Sucursal cuyos comprobantes se editan en el modal (operativa; el API resuelve series padre si aplica). */
  sucursalesParaComprobantes: Array<{ idSucursal: string; nombre: string; esPrincipal?: boolean | number | string }> = [];
  idSucursalComprobantes: string | null = null;

  constructor(
    private _adminService: AdminService,
    private _comprasService: ComprasService,
    private _impuestoService: ImpuestoService,
    private _comprobanteService: ComprobanteService,
    private _sucursalService: SucursalService,
    private _empresaService: EmpresaService,
    private _facturacionService: FacturacionService,
    private _ventasService: VentasService,
    private _gestoresService: GestoresService,
    private _router: Router,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  cargarVentasDefaults(): void {
    this._ventasService.getConfigDefaults().subscribe({
      next: (res) => {
        const d = res?.data;
        if (d) {
          this.ventasDefaults.idEstadoPedidoPorDefecto = d.idEstadoPedidoPorDefecto ?? 1;
          this.ventasDefaults.idEstadoPagoPorDefecto = d.idEstadoPagoPorDefecto ?? 2;
        }
      },
      error: () => {}
    });
  }

  guardarVentasDefaults(): void {
    this.ventasDefaultsGuardando = true;
    this._ventasService.putConfigDefaults({
      idEstadoPedidoPorDefecto: this.ventasDefaults.idEstadoPedidoPorDefecto,
      idEstadoPagoPorDefecto: this.ventasDefaults.idEstadoPagoPorDefecto
    }).subscribe({
      next: () => {
        this.ventasDefaultsGuardando = false;
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Guardado', message: 'Valores por defecto guardados.', position: 'topRight' });
      },
      error: () => { this.ventasDefaultsGuardando = false; }
    });
  }

  cargarConfiguracion(): void {
    this.cargarEmpresaYDireccion();
    this.cargarConfiguracionFacturacion();
    this.cargarVentasDefaults();
    this.cargarConfiguracionInventario();
    this.cargarConfiguracionPdfComprobante();
    this.cargarConfiguracionVentas();
    this.cargarConfiguracionSistema();
    this._comprasService.obtener_correlativo_empresa().subscribe({
      next: (response: { data?: Array<{ idCorrelativo?: number; numero?: number }> }) => {
        const lista = response?.data;
        if (lista && lista.length > 0 && lista[0]) {
          this.correlativo = {
            idCorrelativo: lista[0].idCorrelativo,
            numero: lista[0].numero ?? 10000
          };
        } else {
          this.correlativo = { numero: 10000 };
        }
      },
      error: () => {
        this.correlativo = { numero: 10000 };
      }
    });
  }

  cargarConfiguracionPdfComprobante(): void {
    this._gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const lista = res?.data ?? [];
        const getVal = (clave: string, def: string) => (lista.find((c: { clave: string; valor: string }) => c.clave === clave)?.valor ?? def);
        this.pdfComprobante.cuentasBancarias = getVal('PDF_CUENTAS_BANCARIAS', '');
        this.pdfComprobante.usarTemaColor = String(getVal('PDF_TEMA_COLOR_ACTIVO', 'true')).toLowerCase() !== 'false';
        const color = String(getVal('PDF_COLOR_PRIMARIO', '#0B5FA5')).trim();
        this.pdfComprobante.colorPrimario = color || '#0B5FA5';
      },
      error: () => {}
    });
  }

  guardarConfiguracionPdfComprobante(): void {
    this.pdfComprobanteGuardando = true;
    const color = (this.pdfComprobante.colorPrimario || '').trim();
    const colorFinal = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#0B5FA5';
    const configs: Array<{ clave: string; valor: string; descripcion: string; tipoDato: string }> = [
      {
        clave: 'PDF_CUENTAS_BANCARIAS',
        valor: String(this.pdfComprobante.cuentasBancarias || '').trim(),
        descripcion: 'Cuentas bancarias mostradas en PDF de comprobantes de venta (una por línea).',
        tipoDato: 'STRING'
      },
      {
        clave: 'PDF_TEMA_COLOR_ACTIVO',
        valor: this.pdfComprobante.usarTemaColor ? 'true' : 'false',
        descripcion: 'Habilita color de tema tecnológico en PDFs A4/A5 de comprobantes de venta.',
        tipoDato: 'BOOLEAN'
      },
      {
        clave: 'PDF_COLOR_PRIMARIO',
        valor: colorFinal,
        descripcion: 'Color primario HEX del tema PDF (A4/A5). Ejemplo: #0B5FA5',
        tipoDato: 'STRING'
      }
    ];
    this._gestoresService.guardarConfiguracion(configs).subscribe({
      next: () => {
        this.pdfComprobanteGuardando = false;
        this.pdfComprobante.colorPrimario = colorFinal;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Guardado', message: 'Configuración de PDF actualizada.', position: 'topRight' });
        }
      },
      error: () => {
        this.pdfComprobanteGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo guardar la configuración de PDF.', position: 'topRight' });
        }
      }
    });
  }

  /** Carga datos de la empresa con la que el usuario inició sesión (mismo criterio que update-empresa). */
  cargarEmpresaYDireccion(): void {
    this._empresaService.getEmpresas_id().subscribe({
      next: (response: { data?: any[] }) => {
        const empresa = response?.data?.[0];
        if (empresa) {
          this.configuracion.idEmpresa = empresa.idEmpresa ?? '';
          this.configuracion.nombreEmpresa = empresa.razon_Social ?? empresa.nombre_Comercial ?? empresa.alias ?? '';
          this.configuracion.ruc = empresa.ruc ?? '';
          this.configuracion.telefono = empresa.celular ?? '';
          this.configuracion.email = empresa.correo ?? '';
          this.configuracion.logo = empresa.logo ?? '';
        }
      },
      error: () => {}
    });
    this._empresaService.getDireccionEmpresa_id().subscribe({
      next: (response: { data?: any[] }) => {
        const direcciones = response?.data ?? [];
        const principal = direcciones.find((d: any) => d.principal === true || d.principal === 1);
        const dir = principal ?? direcciones[0];
        if (dir) {
          const partes = [dir.direccion, dir.referencia].filter(Boolean);
          this.configuracion.direccion = partes.length > 0 ? partes.join(', ') : '';
        }
      },
      error: () => {}
    });
  }

  guardarCorrelativo(): void {
    if (this.correlativo.numero == null || this.correlativo.numero < 0) {
      this.correlativoMensaje = 'El número debe ser mayor o igual a 0.';
      return;
    }
    if (!this.correlativo.idCorrelativo) {
      this.correlativoMensaje = 'No hay correlativo configurado para esta empresa. Se crea al dar de alta la empresa.';
      return;
    }
    this.correlativoMensaje = null;
    this.correlativoGuardando = true;
    this._comprasService.editar_correlativos_empresa(this.correlativo.idCorrelativo, { numero: this.correlativo.numero }).subscribe({
      next: () => {
        this.correlativoGuardando = false;
        this.correlativoMensaje = 'Correlativo guardado correctamente.';
      },
      error: () => {
        this.correlativoGuardando = false;
        this.correlativoMensaje = 'Error al guardar el correlativo.';
      }
    });
  }

  guardarConfiguracionGeneral(): void {
        // Llamada al backend para guardar
  }

  /** Carga configuración de facturación electrónica desde el API */
  cargarConfiguracionFacturacion(): void {
    this._facturacionService.obtenerConfiguracion().subscribe({
      next: (res: { data?: any }) => {
        const c = res?.data;
        if (c) {
          this.facturacion.serieFactura = c.serieFactura ?? 'F001';
          this.facturacion.serieBoleta = c.serieBoleta ?? 'B001';
          this.facturacion.serieNotaCredito = c.serieNotaCredito ?? 'FC01';
          this.facturacion.serieNotaDebito = c.serieNotaDebito ?? 'FD01';
          this.facturacion.rutaCarpetaFacturadorSunat = c.rutaCarpetaFacturadorSunat ?? '';
          this.facturacion.urlFacturadorSunat = c.urlFacturadorSunat ?? 'http://localhost:9000';
          this.facturacion.envioAutomatico = c.envioAutomatico === true;
          this.facturacion.minutosEnvioAutomatico = c.minutosEnvioAutomatico ?? 10;
          this.facturacion.envioPorLotes = c.envioPorLotes === true;
          this.facturacion.programacionEnvioLotes = c.programacionEnvioLotes ?? '';
          this.facturacion.modoPrueba = c.modoPrueba !== false;
          this.facturacion.tieneCertificado = c.tieneCertificado === true;
          this.facturacion.envioDirectoSunat = c.envioDirectoSunat === true;
          this.facturacion.useResumenDiarioBoletas = c.useResumenDiarioBoletas === true;
          this.facturacion.usaGuiasElectronicas = c.usaGuiasElectronicas === true;
          this.facturacion.urlEnvio = c.urlEnvio ?? '';
          this.facturacion.usuarioSunat = c.usuarioSunat ?? '';
          this.facturacion.claveSunat = ''; // No se devuelve por seguridad; solo se envía al guardar si el usuario la escribe
          this.facturacion.rucEmpresa = c.rucEmpresa ?? '';
          this.facturacion.modoEnvioSunat = c.modoEnvioSunat != null ? Number(c.modoEnvioSunat) : 2;
          this.facturacion.horaEnvioSunat = (c.horaEnvioSunat && String(c.horaEnvioSunat).trim()) ? String(c.horaEnvioSunat).trim().slice(0, 5) : '09:00';
        }
      },
      error: () => {}
    });
  }

  /** Payload común para PUT facturación (evita resetear modo/hora al guardar otra pestaña). */
  private buildPayloadFacturacionElectronica(): Parameters<FacturacionService['actualizarConfiguracion']>[0] {
    const hora = (this.facturacion.horaEnvioSunat || '').trim().slice(0, 5);
    return {
      serieFactura: this.facturacion.serieFactura,
      serieBoleta: this.facturacion.serieBoleta,
      serieNotaCredito: this.facturacion.serieNotaCredito,
      serieNotaDebito: this.facturacion.serieNotaDebito,
      rutaCarpetaFacturadorSunat: this.facturacion.rutaCarpetaFacturadorSunat || undefined,
      urlFacturadorSunat: this.facturacion.urlFacturadorSunat || undefined,
      urlEnvio: this.facturacion.urlEnvio || undefined,
      envioDirectoSunat: this.facturacion.envioDirectoSunat,
      useResumenDiarioBoletas: this.facturacion.useResumenDiarioBoletas,
      usaGuiasElectronicas: this.facturacion.usaGuiasElectronicas,
      usuarioSunat: this.facturacion.usuarioSunat || undefined,
      claveSunat: this.facturacion.claveSunat || undefined,
      envioAutomatico: this.facturacion.envioAutomatico,
      minutosEnvioAutomatico: this.facturacion.minutosEnvioAutomatico,
      envioPorLotes: this.facturacion.envioPorLotes,
      programacionEnvioLotes: this.facturacion.programacionEnvioLotes || undefined,
      modoPrueba: this.facturacion.modoPrueba,
      modoEnvioSunat: this.facturacion.modoEnvioSunat,
      horaEnvioSunat: hora ? `${hora}:00`.slice(0, 8) : null
    };
  }

  onCertificadoArchivoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    this.certificadoArchivo = file ?? null;
  }

  subirCertificadoFacturacion(): void {
    if (!this.certificadoArchivo) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Certificado', message: 'Seleccione un archivo .pfx' });
      }
      return;
    }
    this.certificadoSubiendo = true;
    this._facturacionService.subirCertificado(this.certificadoArchivo, this.certificadoClave).subscribe({
      next: () => {
        this.certificadoSubiendo = false;
        this.facturacion.tieneCertificado = true;
        this.certificadoArchivo = null;
        this.certificadoClave = '';
        const fileInput = document.getElementById('inputCertificadoPfx') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Certificado', message: 'Certificado guardado correctamente.' });
        }
      },
      error: (err) => {
        this.certificadoSubiendo = false;
        const msg = err?.error?.message || err?.message || 'Error al subir el certificado.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        } else {
          alert(msg);
        }
      }
    });
  }

  guardarConfiguracionFacturacion(): void {
    this.facturacionGuardando = true;
    this._facturacionService.actualizarConfiguracion(this.buildPayloadFacturacionElectronica()).subscribe({
      next: () => {
        this.facturacionGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Guardado', message: 'Configuración de facturación actualizada.' });
        }
      },
      error: () => {
        this.facturacionGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo guardar la configuración de facturación.' });
        }
      }
    });
  }

  guardarConfiguracionEnvioSunat(): void {
    this.facturacionGuardando = true;
    this._facturacionService.actualizarConfiguracion(this.buildPayloadFacturacionElectronica()).subscribe({
      next: () => {
        this.facturacionGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Guardado', message: 'Modos de envío SUNAT actualizados.' });
        }
      },
      error: () => {
        this.facturacionGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo guardar la configuración.' });
        }
      }
    });
  }

  enviarLoteAhora(): void {
    this.enviandoLote = true;
    this._facturacionService.enviarLoteSunat().subscribe({
      next: (res) => {
        this.enviandoLote = false;
        const msg = res?.message || `Enviados: ${res?.data?.enviados ?? 0}, errores: ${res?.data?.errores ?? 0}`;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Envío por lotes', message: msg });
        } else {
          alert(msg);
        }
      },
      error: (err) => {
        this.enviandoLote = false;
        const msg = err?.error?.message || err?.message || 'Error al enviar lote.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        } else {
          alert(msg);
        }
      }
    });
  }

  cargarConfiguracionInventario(): void {
    this._gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const lista = res?.data ?? [];
        const getVal = (clave: string, def: string) => (lista.find((c: { clave: string; valor: string }) => c.clave === clave)?.valor ?? def);
        this.inventario.alertaStockMinimo = parseInt(getVal('INVENTARIO_ALERTA_STOCK_MINIMO', '10'), 10) || 10;
        this.inventario.alertaStockMaximo = parseInt(getVal('INVENTARIO_ALERTA_STOCK_MAXIMO', '1000'), 10) || 1000;
        this.inventario.permitirVentasNegativas = String(getVal('INVENTARIO_PERMITIR_VENTAS_NEGATIVAS', 'false')).toLowerCase() === 'true';
        this.inventario.controlLotes = true;
        this.inventario.controlVencimiento = String(getVal('INVENTARIO_CONTROL_VENCIMIENTO', 'true')).toLowerCase() === 'true';
        this.inventario.ubicaciones = String(getVal('INVENTARIO_CONTROL_UBICACIONES', 'true')).toLowerCase() === 'true';
        const item = lista.find((c: { clave: string }) => c.clave === 'PRODUCTOS_CON_IMAGENES');
        this.inventario.productosConImagenes = item ? (String(item.valor).toLowerCase() === 'true') : false;
      },
      error: () => {}
    });
  }

  guardarConfiguracionInventario(): void {
    this.inventarioGuardando = true;
    const configs: Array<{ clave: string; valor: string; descripcion: string; tipoDato: string }> = [
      { clave: 'INVENTARIO_ALERTA_STOCK_MINIMO', valor: String(this.inventario.alertaStockMinimo ?? 10), descripcion: 'Alerta stock mínimo general (productos sin umbral propio)', tipoDato: 'NUMBER' },
      { clave: 'INVENTARIO_ALERTA_STOCK_MAXIMO', valor: String(this.inventario.alertaStockMaximo ?? 1000), descripcion: 'Alerta stock máximo general (productos sin umbral propio)', tipoDato: 'NUMBER' },
      { clave: 'INVENTARIO_PERMITIR_VENTAS_NEGATIVAS', valor: this.inventario.permitirVentasNegativas ? 'true' : 'false', descripcion: 'Permitir ventas con stock negativo (mostrar aviso)', tipoDato: 'BOOLEAN' },
      { clave: 'INVENTARIO_CONTROL_VENCIMIENTO', valor: this.inventario.controlVencimiento ? 'true' : 'false', descripcion: 'Mostrar productos próximos a vencer en dashboard', tipoDato: 'BOOLEAN' },
      { clave: 'INVENTARIO_CONTROL_UBICACIONES', valor: this.inventario.ubicaciones ? 'true' : 'false', descripcion: 'Gestionar stock por ubicación (LotesUbicacion); si no, solo Lotes', tipoDato: 'BOOLEAN' },
      { clave: 'PRODUCTOS_CON_IMAGENES', valor: this.inventario.productosConImagenes ? 'true' : 'false', descripcion: 'Manejar productos con imágenes (galería)', tipoDato: 'BOOLEAN' }
    ];
    this._gestoresService.guardarConfiguracion(configs).subscribe({
      next: () => {
        this.inventarioGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Guardado', message: 'Configuración de inventario guardada.', position: 'topRight' });
        }
      },
      error: () => {
        this.inventarioGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo guardar la configuración de inventario.', position: 'topRight' });
        }
      }
    });
  }

  cargarConfiguracionVentas(): void {
    this._gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const lista = res?.data ?? [];
        const getVal = (clave: string, def: string) =>
          (lista.find((c: { clave: string; valor: string }) => c.clave === clave)?.valor ?? def);
        this.ventas.permitirCreditos = String(getVal('VENTAS_PERMITIR_CREDITOS', 'true')).toLowerCase() === 'true';
        this.ventas.diasCreditoMaximo = parseInt(getVal('VENTAS_DIAS_CREDITO_MAXIMO', '30'), 10) || 30;
        this.ventas.interesMoratorio = parseFloat(getVal('VENTAS_INTERES_MORATORIO', '2.5')) || 0;
        this.ventas.descuentoMaximo = parseFloat(getVal('VENTAS_DESCUENTO_MAXIMO_PCT', '15')) || 0;
        this.ventas.comisionVendedor = parseFloat(getVal('VENTAS_COMISION_VENDEDOR_PCT', '5')) || 0;
        this.ventas.usarDescuentoEnTotal = interpretarBooleanoConfig(getVal('VENTAS_USAR_DESCUENTO_EN_TOTAL', 'true'), true);
        this.ventas.mostrarModalPdfTrasRegistrarVenta = interpretarBooleanoConfig(
          getVal('VENTAS_MOSTRAR_MODAL_PDF_TRAS_REGISTRAR', 'true'),
          true
        );
      },
      error: () => {}
    });
  }

  guardarConfiguracionVentas(): void {
    this.ventasGuardando = true;
    const configs: Array<{ clave: string; valor: string; descripcion: string; tipoDato: string }> = [
      { clave: 'VENTAS_PERMITIR_CREDITOS', valor: this.ventas.permitirCreditos ? 'true' : 'false', descripcion: 'Permitir ventas a crédito', tipoDato: 'BOOLEAN' },
      { clave: 'VENTAS_DIAS_CREDITO_MAXIMO', valor: String(this.ventas.diasCreditoMaximo ?? 30), descripcion: 'Días de crédito máximo', tipoDato: 'NUMBER' },
      { clave: 'VENTAS_INTERES_MORATORIO', valor: String(this.ventas.interesMoratorio ?? 0), descripcion: 'Interés moratorio (%)', tipoDato: 'NUMBER' },
      { clave: 'VENTAS_DESCUENTO_MAXIMO_PCT', valor: String(this.ventas.descuentoMaximo ?? 0), descripcion: 'Descuento máximo (%)', tipoDato: 'NUMBER' },
      { clave: 'VENTAS_COMISION_VENDEDOR_PCT', valor: String(this.ventas.comisionVendedor ?? 0), descripcion: 'Comisión vendedor (%)', tipoDato: 'NUMBER' },
      {
        clave: 'VENTAS_USAR_DESCUENTO_EN_TOTAL',
        valor: this.ventas.usarDescuentoEnTotal ? 'true' : 'false',
        descripcion: 'Usar y mostrar descuento en total de venta (PDF); XML SUNAT sin descuento en cabecera',
        tipoDato: 'BOOLEAN'
      },
      {
        clave: 'VENTAS_MOSTRAR_MODAL_PDF_TRAS_REGISTRAR',
        valor: this.ventas.mostrarModalPdfTrasRegistrarVenta ? 'true' : 'false',
        descripcion: 'Al registrar una venta en Nueva venta, mostrar modal para generar comprobante PDF o WhatsApp',
        tipoDato: 'BOOLEAN'
      }
    ];
    this._gestoresService.guardarConfiguracion(configs).subscribe({
      next: () => {
        this.ventasGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Guardado', message: 'Configuración de ventas guardada.', position: 'topRight' });
        }
      },
      error: () => {
        this.ventasGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo guardar la configuración de ventas.', position: 'topRight' });
        }
      }
    });
  }

  guardarConfiguracionSistema(): void {
    if (!this.puedeEditarSistemaOperativo) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({
          title: 'Permisos',
          message: 'Solo superAdmin de la empresa principal puede editar esta configuración.',
          position: 'topRight'
        });
      }
      return;
    }
    this.sistemaGuardando = true;
    const configs: ConfiguracionEmpresa[] = [
      {
        clave: 'SISTEMA_BACKUP_AUTOMATICO',
        valor: this.sistema.backupAutomatico ? 'true' : 'false',
        descripcion: 'Activa backup automático SQL Server',
        tipoDato: 'BOOLEAN'
      },
      {
        clave: 'SISTEMA_BACKUP_FRECUENCIA',
        valor: String(this.sistema.frecuenciaBackup || 'diario').toLowerCase(),
        descripcion: 'Frecuencia backup: diario|semanal|mensual',
        tipoDato: 'STRING'
      },
      {
        clave: 'SISTEMA_BACKUP_RUTA_LOCAL',
        valor: String(this.sistema.rutaBackupLocal || '').trim(),
        descripcion: 'Ruta local donde se genera .bak',
        tipoDato: 'STRING'
      },
      {
        clave: 'SISTEMA_BACKUP_RUTA_SECUNDARIA',
        valor: String(this.sistema.rutaBackupSecundaria || '').trim(),
        descripcion: 'Ruta secundaria (otro servidor/NAS) para réplica',
        tipoDato: 'STRING'
      },
      {
        clave: 'SISTEMA_BACKUP_GOOGLE_DRIVE_REMOTE',
        valor: String(this.sistema.googleDriveRemote || '').trim(),
        descripcion: 'Remote rclone Google Drive (ej: gdrive:erp-backups/sql)',
        tipoDato: 'STRING'
      },
      {
        clave: 'SISTEMA_BACKUP_RESTORE_SEMANAL',
        valor: this.sistema.restauracionSemanal ? 'true' : 'false',
        descripcion: 'Habilita ensayo semanal de restauración',
        tipoDato: 'BOOLEAN'
      },
      {
        clave: 'SISTEMA_RETENCION_LOGS_DIAS',
        valor: String(this.sistema.retencionLogs ?? 90),
        descripcion: 'Retención de logs en días',
        tipoDato: 'NUMBER'
      },
      {
        clave: 'SISTEMA_NOTIFICACIONES_EMAIL',
        valor: this.sistema.notificacionesEmail ? 'true' : 'false',
        descripcion: 'Notificaciones operativas por email',
        tipoDato: 'BOOLEAN'
      },
      {
        clave: 'SISTEMA_NOTIFICACIONES_WHATSAPP',
        valor: this.sistema.notificacionesWhatsApp ? 'true' : 'false',
        descripcion: 'Notificaciones operativas por WhatsApp',
        tipoDato: 'BOOLEAN'
      },
      {
        clave: 'SISTEMA_MODO_MANTENIMIENTO',
        valor: this.sistema.modoMantenimiento ? 'true' : 'false',
        descripcion: 'Modo mantenimiento global',
        tipoDato: 'BOOLEAN'
      },
      {
        clave: 'SISTEMA_CULQI_CONCILIACION_CSV',
        valor: this.sistema.exportarConciliacionCulqi ? 'true' : 'false',
        descripcion: 'Habilita exportación conciliación Culqi CSV',
        tipoDato: 'BOOLEAN'
      }
    ];
    this._gestoresService.guardarConfiguracion(configs).subscribe({
      next: () => {
        this.sistemaGuardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({
            title: 'Guardado',
            message: 'Configuración operativa guardada.',
            position: 'topRight'
          });
        }
      },
      error: (err) => {
        this.sistemaGuardando = false;
        const msg =
          err?.error?.message ||
          'No se pudo guardar la configuración. Solo superAdmin de la empresa principal puede editar.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
        }
      }
    });
  }

  cargarConfiguracionSistema(): void {
    this._gestoresService.obtenerPermisosConfiguracionSistema().subscribe({
      next: (res) => {
        const d = res?.data;
        this.puedeEditarSistemaOperativo = !!d?.puedeEditarSistemaOperativo;
        this.mostrarTabSistema =
          typeof d?.mostrarTabSistema === 'boolean'
            ? d.mostrarTabSistema
            : !!(d?.esEmpresaPrincipal || d?.esSuperAdmin);
        if (!this.mostrarTabSistema) {
          return;
        }
        this._gestoresService.obtenerConfiguracion().subscribe({
          next: (cfgRes) => {
            const lista = cfgRes?.data ?? [];
            const getVal = (clave: string, def: string) =>
              (lista.find((c: ConfiguracionEmpresa) => c.clave === clave)?.valor ?? def);
            this.sistema.backupAutomatico = String(getVal('SISTEMA_BACKUP_AUTOMATICO', 'true')).toLowerCase() === 'true';
            this.sistema.frecuenciaBackup = String(getVal('SISTEMA_BACKUP_FRECUENCIA', 'diario')).toLowerCase();
            this.sistema.rutaBackupLocal = getVal('SISTEMA_BACKUP_RUTA_LOCAL', 'D:\\sql_backups');
            this.sistema.rutaBackupSecundaria = getVal('SISTEMA_BACKUP_RUTA_SECUNDARIA', '');
            this.sistema.googleDriveRemote = getVal('SISTEMA_BACKUP_GOOGLE_DRIVE_REMOTE', '');
            this.sistema.restauracionSemanal = String(getVal('SISTEMA_BACKUP_RESTORE_SEMANAL', 'true')).toLowerCase() === 'true';
            this.sistema.retencionLogs = parseInt(getVal('SISTEMA_RETENCION_LOGS_DIAS', '90'), 10) || 90;
            this.sistema.notificacionesEmail = String(getVal('SISTEMA_NOTIFICACIONES_EMAIL', 'true')).toLowerCase() === 'true';
            this.sistema.notificacionesWhatsApp = String(getVal('SISTEMA_NOTIFICACIONES_WHATSAPP', 'false')).toLowerCase() === 'true';
            this.sistema.modoMantenimiento = String(getVal('SISTEMA_MODO_MANTENIMIENTO', 'false')).toLowerCase() === 'true';
            this.sistema.exportarConciliacionCulqi =
              String(getVal('SISTEMA_CULQI_CONCILIACION_CSV', 'true')).toLowerCase() === 'true';
          },
          error: () => {}
        });
      },
      error: () => {
        this.puedeEditarSistemaOperativo = false;
        this.mostrarTabSistema = false;
      }
    });
  }

  exportarConfiguracion(): void {
        // Descargar archivo de configuración
  }

  importarConfiguracion(): void {
        // Abrir selector de archivos
  }

  restaurarConfiguracion(): void {
    if (confirm('¿Está seguro de restaurar la configuración por defecto? Esta acción no se puede deshacer.')) {
            // Restaurar valores por defecto
    }
  }

  /** Carga la lista de impuestos de la empresa y códigos SUNAT (Catálogo 05) */
  cargarImpuestos(): void {
    this.impuestosCargando = true;
    this._impuestoService.getCodigosSunat().subscribe({
      next: (res) => {
        this.codigosSunatImpuesto = res?.data ?? [];
      },
      error: () => {}
    });
    this._impuestoService.obtenerTodos().subscribe({
      next: (response) => {
        const list = response?.data ?? [];
        this.impuestos = list.map((i: { idImpuesto: number; descripcion: string; codigoSunat?: string; porcentaje: number; estado?: boolean | number; pIncluyeIGV?: boolean | number }) => ({
          ...i,
          codigoSunat: i.codigoSunat ?? '',
          estado: !!(i.estado === true || i.estado === 1),
          pIncluyeIGV: !!(i.pIncluyeIGV === true || i.pIncluyeIGV === 1)
        })) as Impuesto[];
        this.impuestosCargando = false;
      },
      error: () => {
        this.impuestosCargando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudieron cargar los impuestos.' });
        }
      }
    });
  }

  /** Abre el modal para crear un nuevo impuesto */
  abrirModalCrearImpuesto(): void {
    this.impuestoEditando = null;
    this.impuestoForm = { descripcion: '', codigoSunat: '', porcentaje: 0, pIncluyeIGV: false, estado: true };
  }

  /** Abre el modal para editar un impuesto */
  abrirModalEditarImpuesto(imp: Impuesto): void {
    this.impuestoEditando = imp;
    this.impuestoForm = {
      descripcion: imp.descripcion,
      codigoSunat: imp.codigoSunat ?? '',
      porcentaje: imp.porcentaje ?? 0,
      pIncluyeIGV: !!imp.pIncluyeIGV,
      estado: !!imp.estado
    };
  }

  /** Cierra el modal de impuesto (Bootstrap 5) */
  private cerrarModalImpuesto(): void {
    const el = this.modalImpuestoRef?.nativeElement;
    if (el && typeof (window as any).bootstrap !== 'undefined') {
      (window as any).bootstrap.Modal.getInstance(el)?.hide();
    }
  }

  /** Guarda el impuesto (crear o actualizar) */
  guardarImpuesto(): void {
    const desc = (this.impuestoForm.descripcion || '').trim();
    if (!desc) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Validación', message: 'La descripción es obligatoria.' });
      }
      return;
    }
    const payload = {
      descripcion: desc,
      codigoSunat: (this.impuestoForm.codigoSunat || '').trim() || undefined,
      porcentaje: this.impuestoForm.porcentaje ?? 0,
      pIncluyeIGV: !!this.impuestoForm.pIncluyeIGV,
      estado: !!this.impuestoForm.estado
    };
    this.impuestoGuardando = true;
    if (this.impuestoEditando != null) {
      this._impuestoService.actualizar(this.impuestoEditando.idImpuesto, payload).subscribe({
        next: () => {
          this.impuestoGuardando = false;
          this.cerrarModalImpuesto();
          this.cargarImpuestos();
          if (typeof iziToast !== 'undefined') {
            iziToast.success({ title: 'OK', message: 'Impuesto actualizado correctamente.' });
          }
        },
        error: (err) => {
          this.impuestoGuardando = false;
          const msg = err?.error?.message || 'Error al actualizar el impuesto.';
          if (typeof iziToast !== 'undefined') {
            iziToast.error({ title: 'Error', message: msg });
          }
        }
      });
    } else {
      this._impuestoService.crear(payload).subscribe({
        next: () => {
          this.impuestoGuardando = false;
          this.cerrarModalImpuesto();
          this.cargarImpuestos();
          if (typeof iziToast !== 'undefined') {
            iziToast.success({ title: 'OK', message: 'Impuesto registrado correctamente.' });
          }
        },
        error: (err) => {
          this.impuestoGuardando = false;
          const msg = err?.error?.message || 'Error al crear el impuesto.';
          if (typeof iziToast !== 'undefined') {
            iziToast.error({ title: 'Error', message: msg });
          }
        }
      });
    }
  }

  /** Cambia el estado activo/inactivo del impuesto */
  cambiarEstadoImpuesto(imp: Impuesto): void {
    const nuevoEstado = !imp.estado;
    this._impuestoService.actualizarEstado(imp.idImpuesto, nuevoEstado).subscribe({
      next: () => {
        this.cargarImpuestos();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: nuevoEstado ? 'Impuesto activado.' : 'Impuesto desactivado.' });
        }
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error al cambiar el estado.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  /** Abre el modal de comprobantes y carga la lista */
  abrirModalComprobantes(): void {
    this.nuevoComprobante = { codigo: '', nombre: '', serie: '', numero: 1, usarEnVenta: true, usarEnCompra: true };
    this.cargarSucursalesYComprobantes();
  }

  /** Carga sucursales y, si hace falta, fija la sucursal seleccionada antes de listar comprobantes. */
  cargarSucursalesYComprobantes(): void {
    this.comprobantesCargando = true;
    this._sucursalService.obtener_sucursal_todos().subscribe({
      next: (res) => {
        const list = (res?.data ?? []) as Array<{ idSucursal: string; nombre: string; esPrincipal?: boolean | number | string }>;
        this.sucursalesParaComprobantes = Array.isArray(list) ? list : [];
        const sigueSiendoValida =
          this.idSucursalComprobantes &&
          this.sucursalesParaComprobantes.some((s) => s.idSucursal === this.idSucursalComprobantes);
        if (!sigueSiendoValida) {
          const principal = this.sucursalesParaComprobantes.find(
            (s) => s.esPrincipal === true || s.esPrincipal === 1 || s.esPrincipal === '1'
          );
          this.idSucursalComprobantes =
            principal?.idSucursal ?? this.sucursalesParaComprobantes[0]?.idSucursal ?? null;
        }
        this.cargarComprobantes();
      },
      error: () => {
        this.sucursalesParaComprobantes = [];
        this.idSucursalComprobantes = null;
        this.cargarComprobantes();
      }
    });
  }

  onCambioSucursalComprobantes(): void {
    this.cargarComprobantes();
  }

  /** Carga comprobantes de la empresa */
  cargarComprobantes(): void {
    this.comprobantesCargando = true;
    this._comprobanteService.obtener_comprobantes(this.idSucursalComprobantes).subscribe({
      next: (response) => {
        this.comprobantes = (response?.data ?? []).map((c: any) => ({
          idComprobante: c.idComprobante,
          codigo: c.codigo ?? '',
          nombre: c.nombre ?? '',
          serie: c.serie ?? '',
          numero: c.numero != null ? Number(c.numero) : 0,
          usarEnVenta: c.usarEnVenta !== false,
          usarEnCompra: c.usarEnCompra !== false
        }));
        this.comprobantesCargando = false;
      },
      error: () => {
        this.comprobantesCargando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudieron cargar los comprobantes.' });
        }
      }
    });
  }

  /** Guarda serie, número y flags de un comprobante (no modifica código SUNAT) */
  guardarComprobante(comp: { idComprobante: number; serie: string; numero: number; usarEnVenta: boolean; usarEnCompra: boolean }): void {
    this.comprobanteGuardandoId = comp.idComprobante;
    this._comprobanteService.actualizar(comp.idComprobante, {
      serie: comp.serie?.trim() || '',
      numero: comp.numero,
      usarEnVenta: comp.usarEnVenta,
      usarEnCompra: comp.usarEnCompra
    }).subscribe({
      next: () => {
        this.comprobanteGuardandoId = null;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Comprobante actualizado.' });
        }
      },
      error: (err) => {
        this.comprobanteGuardandoId = null;
        const msg = err?.error?.message || 'Error al actualizar.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  /** Crea un nuevo comprobante para la empresa */
  agregarComprobante(): void {
    const cod = (this.nuevoComprobante.codigo || '').trim();
    const nom = (this.nuevoComprobante.nombre || '').trim();
    const ser = (this.nuevoComprobante.serie || '').trim();
    if (!cod) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Validación', message: 'El código (SUNAT) es obligatorio.' });
      }
      return;
    }
    if (!nom) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Validación', message: 'El nombre es obligatorio.' });
      }
      return;
    }
    if (!ser) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Validación', message: 'La serie es obligatoria.' });
      }
      return;
    }
    const numero = this.nuevoComprobante.numero != null ? this.nuevoComprobante.numero : 1;
    const usarEnVenta = this.nuevoComprobante.usarEnVenta !== false;
    const usarEnCompra = this.nuevoComprobante.usarEnCompra !== false;
    this.comprobanteCreando = true;
    const idSuc = this.idSucursalComprobantes;
    this._comprobanteService
      .crear({
        codigo: cod,
        nombre: nom,
        serie: ser,
        numero,
        usarEnVenta,
        usarEnCompra,
        ...(idSuc ? { idSucursal: idSuc } : {})
      })
      .subscribe({
      next: () => {
        this.comprobanteCreando = false;
        this.nuevoComprobante = { codigo: '', nombre: '', serie: '', numero: 1, usarEnVenta: true, usarEnCompra: true };
        this.cargarComprobantes();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Comprobante agregado.' });
        }
      },
      error: (err) => {
        this.comprobanteCreando = false;
        const msg = err?.error?.message || 'Error al crear comprobante.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  navigateTo(module: string): void {
    switch (module) {
      case 'dashboard':
        this._router.navigate(['/home']);
        break;
      case 'caja':
        this._router.navigate(['/caja']);
        break;
      case 'creditos':
        this._router.navigate(['/creditos']);
        break;
      case 'analisis':
        this._router.navigate(['/analisis']);
        break;
      case 'ventas':
        this._router.navigate(['/ventas']);
        break;
      case 'compras':
        this._router.navigate(['/compras']);
        break;
      case 'inventario':
        this._router.navigate(['/inventario']);
        break;
      case 'clientes':
        this._router.navigate(['/clientes']);
        break;
      case 'configuracion':
        // Ya estamos aquí
        break;
      case 'reportes':
        this._router.navigate(['/reportes']);
        break;
      default:
            }
  }
}