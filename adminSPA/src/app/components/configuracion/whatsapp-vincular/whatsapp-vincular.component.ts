import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { WhatsappSessionPanelComponent } from '../../shared/whatsapp-session-panel/whatsapp-session-panel.component';

@Component({
  selector: 'app-whatsapp-vincular',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SidebarComponent,
    TopnavComponent,
    WhatsappSessionPanelComponent
  ],
  templateUrl: './whatsapp-vincular.component.html',
  styleUrl: './whatsapp-vincular.component.css'
})
export class WhatsappVincularComponent {
  sidebarState = inject(SidebarStateService);
  constructor() {}



  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
