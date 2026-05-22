import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WhatsappSessionPanelComponent } from '../whatsapp-session-panel/whatsapp-session-panel.component';

/** Panel compacto QR + enlace; usar dentro de cada modal «Enviar por WhatsApp». */
@Component({
  selector: 'app-whatsapp-envio-hint',
  standalone: true,
  imports: [CommonModule, RouterModule, WhatsappSessionPanelComponent],
  template: `
    <app-whatsapp-session-panel [compact]="true"></app-whatsapp-session-panel>
    <a routerLink="/configuracion/whatsapp" class="btn btn-link btn-sm px-0 mt-1">
      Configuración completa de WhatsApp
    </a>
  `
})
export class WhatsappEnvioHintComponent {}
