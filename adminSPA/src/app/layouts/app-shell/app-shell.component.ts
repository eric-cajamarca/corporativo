import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { TopnavComponent } from '../../components/topnav/topnav.component';
import { SidebarStateService } from '../../services/sidebar-state.service';

/**
 * Layout autenticado: sidebar + topnav fijos; el contenido de cada ruta
 * se renderiza en el router-outlet (no se recrean en cada navegación).
 */
@Component({
  selector: 'app-layout-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopnavComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css'
})
export class AppShellComponent {
  readonly sidebarState = inject(SidebarStateService);
}
