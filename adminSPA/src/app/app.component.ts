import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { SidebarStateService } from './services/sidebar-state.service';
import { ConnectionTimerService } from './services/connection-timer.service';
import { environment } from '../environments/environment';
import { ChatComercialPublicoComponent } from './components/public/chat-comercial-publico/chat-comercial-publico.component';

@Component({
    selector: 'app-root',
    imports: [CommonModule, RouterOutlet, ChatComercialPublicoComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'adminSPA';
  appVersion = environment.APP_VERSION;
  constructor(
    private authService: AuthService,
    private sidebarState: SidebarStateService,
    private connectionTimer: ConnectionTimerService,
    private router: Router
  ) {}

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  isSidebarCollapsed(): boolean {
    return this.sidebarState.sidebarCollapsed();
  }

  connectedSeconds(): number {
    return this.connectionTimer.connectedSeconds();
  }

  shouldHideFooter(): boolean {
    const url = (this.router.url || '').toLowerCase();
    return (
      url.includes('/login-empresa') ||
      url.includes('/planes') ||
      url.includes('/crear-empresa') ||
      url === '/' ||
      url.includes('/publico') ||
      url.includes('/politicas')
    );
  }

  shouldShowPublicChat(): boolean {
    const url = (this.router.url || '').toLowerCase().split('?')[0];
    if (
      url.includes('/login') ||
      url.includes('/crear-empresa') ||
      url.includes('/suscribirse') ||
      url.includes('/recuperar')
    ) {
      return false;
    }
    return url === '/' || url.includes('/publico') || url.includes('/planes') || url.includes('/politicas');
  }

  ngOnInit() {
    this.authService.initialize();
  }
}
