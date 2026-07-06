import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
      url.includes('/crear-empresa') ||
      url === '/' ||
      url.includes('/publico') ||
      url.includes('/politicas')
    );
  }

  ngOnInit() {
     this.authService.initialize();
     // #region agent log
     this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
       fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'acf3ea'},body:JSON.stringify({sessionId:'acf3ea',location:'app.component.ts:NavigationEnd',message:'router navigation',data:{url:e.url,urlAfterRedirects:e.urlAfterRedirects,browserPath:globalThis.location?.pathname},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
     });
     // #endregion
  }
}
