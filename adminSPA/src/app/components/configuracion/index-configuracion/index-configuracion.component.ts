import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { ComprasService } from '../../../services/compras.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

@Component({
  selector: 'app-index-configuracion',
  imports: [FormsModule, CommonModule, TopnavComponent],
  templateUrl: './index-configuracion.component.html',
  styleUrl: './index-configuracion.component.css'
})
export class IndexConfiguracionComponent implements OnInit {

  // Configuración general
  public configuracion = {
    nombreEmpresa: 'AVE FENIX S.A.C.',
    ruc: '20611688564',
    telefono: '+51 999 999 999',
    email: 'ventas@avefenix.com',
    direccion: 'Av. Principal 123, Lima, Perú',
    logo: '',
    moneda: 'PEN',
    idioma: 'es',
    zonaHoraria: 'America/Lima'
  };

  // Configuración de facturación
  public facturacion = {
    serieFactura: 'F001',
    serieBoleta: 'B001',
    serieNotaCredito: 'FC01',
    serieNotaDebito: 'FD01',
    igv: 18,
    autoNumeracion: true,
    enviarSunat: true
  };

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

  constructor(
    private _adminService: AdminService,
    private _comprasService: ComprasService,
    private _router: Router
  ) {}

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  cargarConfiguracion(): void {
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

  guardarConfiguracionFacturacion(): void {
    console.log('Guardando configuración de facturación:', this.facturacion);
    // Llamada al backend para guardar
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

  navigateTo(module: string): void {
    // Aquí implementaríamos la navegación a diferentes módulos
    console.log('Navegando a:', module);

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