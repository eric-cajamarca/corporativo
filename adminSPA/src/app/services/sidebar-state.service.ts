import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Estado global del sidebar (colapsado/expandido).
 * Se inicializa desde localStorage para que el layout sea correcto desde el primer render al recargar.
 */
@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  private readonly storageKey = 'sidebarCollapsed';

  private readonly initialValue =
    typeof localStorage !== 'undefined' ? localStorage.getItem(this.storageKey) === 'true' : false;

  readonly sidebarCollapsed = signal<boolean>(this.initialValue);

  /** SidebarComponent (móvil) se suscribe: abrir/cerrar drawer al pulsar la hamburguesa del topnav. */
  private readonly mobileSidebarToggleRequest$ = new Subject<void>();
  readonly mobileSidebarToggleRequest = this.mobileSidebarToggleRequest$.asObservable();

  setCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, String(collapsed));
    }
  }

  /** Llamado desde Topnav al pulsar el menú en pantallas pequeñas (antes el evento no estaba enlazado). */
  requestMobileSidebarToggle(): void {
    this.mobileSidebarToggleRequest$.next();
  }
}
