import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { SidebarStateService } from './services/sidebar-state.service';
import { ConnectionTimerService } from './services/connection-timer.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
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
      url.includes('/crear-empresa')
    );
  }

  ngOnInit() {
     this.authService.initialize();
  }
}
