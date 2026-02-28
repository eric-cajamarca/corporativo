import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

@Component({
  selector: 'app-ventas-ropa',
  standalone: true,
  imports: [CommonModule, SidebarComponent, TopnavComponent],
  templateUrl: './ventas-ropa.component.html',
  styleUrl: './ventas-ropa.component.css'
})
export class VentasRopaComponent {
  constructor(public sidebarState: SidebarStateService) {}
}
