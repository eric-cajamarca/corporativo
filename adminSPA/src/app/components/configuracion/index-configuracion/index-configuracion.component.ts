import { Component, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { ComprasService } from '../../../services/compras.service';
import { ImpuestoService } from '../../../services/impuesto.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { EmpresaService } from '../../../services/empresa.service';
import { FacturacionService } from '../../../services/facturacion.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { Impuesto } from '../../../interfaces/impuesto.interface';

declare var iziToast: any;

@Component({
  selector: 'app-index-configuracion',
  imports: [FormsModule, CommonModule, TopnavComponent, SidebarComponent],
  templateUrl: './index-configuracion.component.html',
  styleUrl: './index-configuracion.component.css'
})
export class IndexConfiguracionComponent implements OnInit {
  @ViewChild('modalImpuestoForm') modalImpuestoRef?: ElementRef<HTMLDivElement>;
  @ViewChild('modalComprobantes') modalComprobantesRef?: ElementRef<HTMLDivElement>;

  /** Estado del sidebar (colapsado/expandido) para layout y topnav */
  sidebarCollapsed = signal<boolean>(false);

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
    urlEnvio: '' as string,
    usuarioSunat: '' as string,
    claveSunat: '' as string,
    rucEmpresa: '' as string
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
    ubicaciones: true
  };

  // Configuración de ventas
  public ventas = {
    permitirCreditos: true,
    diasCreditoMaximo: 30,
    interesMoratorio: 2.5,
    descuentoMaximo: 15,
    comisionVendedor: 5
  };

  // Configuración de sistema
  public sistema = {
    backupAutomatico: true,
    frecuenciaBackup: 'diario',
    retencionLogs: 90,
    notificacionesEmail: true,
    notificacionesWhatsApp: false,
    modoMantenimiento: false
  };

  /** Correlativo de códigos de producto (número inicial por defecto 10000) */
  public correlativo: { idCorrelativo?: number; numero?: number } = { numero: 10000 };
  public correlativoGuardando = false;
  public correlativoMensaje: string | null = null;

  /** Impuestos */
  impuestos: Impuesto[] = [];
  impuestosCargando = false;
  impuestoGuardando = false;
  impuestoEditando: Impuesto | null = null;
  impuestoForm = {
    descripcion: '',
    porcentaje: 0,
    pIncluyeIGV: false,
    estado: true
  };

  /** Comprobantes (series y correlativos) */
  comprobantes: Array<{ idComprobante: number; codigo: string; nombre: string; serie: string; numero: number; usarEnVenta: boolean; usarEnCompra: boolean }> = [];
  comprobantesCargando = false;
  comprobanteGuardandoId: number | null = null;
  comprobanteCreando = false;
  nuevoComprobante = { codigo: '', nombre: '', serie: '', numero: 1, usarEnVenta: true, usarEnCompra: true };

  constructor(
    private _adminService: AdminService,
    private _comprasService: ComprasService,
    private _impuestoService: ImpuestoService,
    private _comprobanteService: ComprobanteService,
    private _empresaService: EmpresaService,
    private _facturacionService: FacturacionService,
    private _router: Router
  ) {}

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  cargarConfiguracion(): void {
    this.cargarEmpresaYDireccion();
    this.cargarConfiguracionFacturacion();
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
    console.log('Guardando configuración general:', this.configuracion);
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
          this.facturacion.urlEnvio = c.urlEnvio ?? '';
          this.facturacion.usuarioSunat = c.usuarioSunat ?? '';
          this.facturacion.claveSunat = ''; // No se devuelve por seguridad; solo se envía al guardar si el usuario la escribe
          this.facturacion.rucEmpresa = c.rucEmpresa ?? '';
        }
      },
      error: () => {}
    });
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
    this._facturacionService.actualizarConfiguracion({
      serieFactura: this.facturacion.serieFactura,
      serieBoleta: this.facturacion.serieBoleta,
      serieNotaCredito: this.facturacion.serieNotaCredito,
      serieNotaDebito: this.facturacion.serieNotaDebito,
      rutaCarpetaFacturadorSunat: this.facturacion.rutaCarpetaFacturadorSunat || undefined,
      urlFacturadorSunat: this.facturacion.urlFacturadorSunat || undefined,
      urlEnvio: this.facturacion.urlEnvio || undefined,
      envioDirectoSunat: this.facturacion.envioDirectoSunat,
      usuarioSunat: this.facturacion.usuarioSunat || undefined,
      claveSunat: this.facturacion.claveSunat || undefined,
      envioAutomatico: this.facturacion.envioAutomatico,
      minutosEnvioAutomatico: this.facturacion.minutosEnvioAutomatico,
      envioPorLotes: this.facturacion.envioPorLotes,
      programacionEnvioLotes: this.facturacion.programacionEnvioLotes || undefined,
      modoPrueba: this.facturacion.modoPrueba
    }).subscribe({
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

  guardarConfiguracionInventario(): void {
    console.log('Guardando configuración de inventario:', this.inventario);
    // Llamada al backend para guardar
  }

  guardarConfiguracionVentas(): void {
    console.log('Guardando configuración de ventas:', this.ventas);
    // Llamada al backend para guardar
  }

  guardarConfiguracionSistema(): void {
    console.log('Guardando configuración del sistema:', this.sistema);
    // Llamada al backend para guardar
  }

  exportarConfiguracion(): void {
    console.log('Exportando configuración...');
    // Descargar archivo de configuración
  }

  importarConfiguracion(): void {
    console.log('Importando configuración...');
    // Abrir selector de archivos
  }

  restaurarConfiguracion(): void {
    if (confirm('¿Está seguro de restaurar la configuración por defecto? Esta acción no se puede deshacer.')) {
      console.log('Restaurando configuración por defecto...');
      // Restaurar valores por defecto
    }
  }

  /** Carga la lista de impuestos de la empresa */
  cargarImpuestos(): void {
    this.impuestosCargando = true;
    this._impuestoService.obtenerTodos().subscribe({
      next: (response) => {
        const list = response?.data ?? [];
        this.impuestos = list.map((i: { idImpuesto: number; descripcion: string; porcentaje: number; estado?: boolean | number; pIncluyeIGV?: boolean | number }) => ({
          ...i,
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
    this.impuestoForm = { descripcion: '', porcentaje: 0, pIncluyeIGV: false, estado: true };
  }

  /** Abre el modal para editar un impuesto */
  abrirModalEditarImpuesto(imp: Impuesto): void {
    this.impuestoEditando = imp;
    this.impuestoForm = {
      descripcion: imp.descripcion,
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
    this.cargarComprobantes();
  }

  /** Carga comprobantes de la empresa */
  cargarComprobantes(): void {
    this.comprobantesCargando = true;
    this._comprobanteService.obtener_comprobantes().subscribe({
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
    this._comprobanteService.crear({ codigo: cod, nombre: nom, serie: ser, numero, usarEnVenta, usarEnCompra }).subscribe({
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

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
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
        console.log('Módulo no implementado:', module);
    }
  }
}