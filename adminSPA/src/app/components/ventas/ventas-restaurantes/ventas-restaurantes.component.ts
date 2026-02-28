import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

@Component({
  selector: 'app-ventas-restaurantes',
  standalone: true,
  imports: [CommonModule, SidebarComponent, TopnavComponent],
  templateUrl: './ventas-restaurantes.component.html',
  styleUrl: './ventas-restaurantes.component.css'
})
export class VentasRestaurantesComponent {
  constructor(public sidebarState: SidebarStateService) {}
}
