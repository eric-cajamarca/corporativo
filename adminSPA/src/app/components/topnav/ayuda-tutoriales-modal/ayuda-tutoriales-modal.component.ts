import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TutorialManualItem {
  id: string;
  titulo: string;
  descripcion: string;
  pdfUrl: string;
  icono: string;
}

@Component({
  selector: 'app-ayuda-tutoriales-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ayuda-tutoriales-modal.component.html',
  styleUrl: './ayuda-tutoriales-modal.component.css'
})
export class AyudaTutorialesModalComponent {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();

  readonly tutoriales: TutorialManualItem[] = [
    {
      id: 'config',
      titulo: 'Configuración inicial',
      descripcion: 'Registro, activación, empresa, colaboradores, sucursales y primeros pasos.',
      pdfUrl: 'assets/manuales/Manual_Configuracion_Inicial.pdf',
      icono: 'bi-sliders'
    },
    {
      id: 'config-facturacion-sunat',
      titulo: 'Facturación y envío a SUNAT',
      descripcion: 'URL BillService, usuario secundario SOL, certificado .pfx y modos de envío.',
      pdfUrl: 'assets/manuales/Manual_Configuracion_Facturacion_Sunat.pdf',
      icono: 'bi-cloud-upload'
    },
    {
      id: 'ventas',
      titulo: 'Ventas',
      descripcion: 'Venta rápida, nueva venta, historial, crédito/cuotas y caja abierta.',
      pdfUrl: 'assets/manuales/Manual_Ventas.pdf',
      icono: 'bi-receipt'
    },
    {
      id: 'compras',
      titulo: 'Compras',
      descripcion: 'Consulta SUNAT, registro manual, proveedores e ingreso de stock.',
      pdfUrl: 'assets/manuales/Manual_Registrar_Compras.pdf',
      icono: 'bi-cart-plus'
    },
    {
      id: 'cotizaciones',
      titulo: 'Cotizaciones',
      descripcion: 'Crear propuestas (CT) y duplicar en nueva venta.',
      pdfUrl: 'assets/manuales/Manual_Cotizaciones.pdf',
      icono: 'bi-file-earmark-text'
    },
    {
      id: 'despachos',
      titulo: 'Despachos y envíos',
      descripcion: 'Entregas, envíos programados y vista del chofer.',
      pdfUrl: 'assets/manuales/Manual_Despachos_Envios.pdf',
      icono: 'bi-truck'
    },
    {
      id: 'guias-remision',
      titulo: 'Guía de remisión',
      descripcion: 'Emisión GRE remitente (09), envío a SUNAT, PDF y configuración API.',
      pdfUrl: 'assets/manuales/Manual_Guia_Remision.pdf',
      icono: 'bi-file-earmark-ruled'
    },
    {
      id: 'guias-transportista',
      titulo: 'Guía transportista',
      descripcion: 'GRE tipo 31 (requiere vehículos registrados), documento relacionado, MTC y SUNAT.',
      pdfUrl: 'assets/manuales/Manual_Guia_Transportista.pdf',
      icono: 'bi-truck-front'
    },
    {
      id: 'completo',
      titulo: 'Manual completo EFAFERP',
      descripcion: 'Guía general: inventario, caja, créditos, reportes, SUNAT y más.',
      pdfUrl: 'assets/manuales/Manual_Usuario_Completo.pdf',
      icono: 'bi-book'
    }
  ];

  cerrar(): void {
    this.closed.emit();
  }

  abrirPdf(item: TutorialManualItem): void {
    window.open(item.pdfUrl, '_blank', 'noopener,noreferrer');
  }
}
