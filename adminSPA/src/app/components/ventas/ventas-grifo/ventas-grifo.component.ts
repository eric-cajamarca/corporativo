import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

@Component({
  selector: 'app-ventas-grifo',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './ventas-grifo.component.html',
  styleUrl: './ventas-grifo.component.css'
})
export class VentasGrifoComponent {
  constructor(public sidebarState: SidebarStateService) {}
}
