import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../../services/sidebar-state.service';

@Component({
  selector: 'app-ventas-restaurantes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ventas-restaurantes.component.html',
  styleUrl: './ventas-restaurantes.component.css'
})
export class VentasRestaurantesComponent {
  constructor(public sidebarState: SidebarStateService) {}
}
