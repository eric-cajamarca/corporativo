import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ayuda-facturacion-sunat',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ayuda-facturacion-sunat.component.html',
  styleUrl: './ayuda-facturacion-sunat.component.css'
})
export class AyudaFacturacionSunatComponent {
  /** En Inicio: enlace a Configuración → Facturación. */
  @Input() mostrarIrAConfigurar = false;
  /** En Inicio: permite ocultar el recuadro. */
  @Input() dismissible = false;
  @Output() ocultado = new EventEmitter<void>();

  readonly whatsappDisplay = '993 289 440';
  readonly whatsappUrl =
    'https://wa.me/51993289440?text=' +
    encodeURIComponent(
      'Hola, necesito ayuda para configurar la facturación electrónica de mi empresa en EFAFERP (usuario SUNAT, certificado e impuestos).'
    );
  readonly tutorialPdfUrl = 'assets/manuales/Manual_Configuracion_Facturacion_Sunat.pdf';

  abrirTutorial(): void {
    window.open(this.tutorialPdfUrl, '_blank', 'noopener,noreferrer');
  }

  ocultar(): void {
    this.ocultado.emit();
  }
}
