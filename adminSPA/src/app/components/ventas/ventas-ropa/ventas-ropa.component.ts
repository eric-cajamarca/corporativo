import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../../services/sidebar-state.service';

@Component({
  selector: 'app-ventas-ropa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ventas-ropa.component.html',
  styleUrl: './ventas-ropa.component.css'
})
export class VentasRopaComponent {
  constructor(public sidebarState: SidebarStateService) {}
}
