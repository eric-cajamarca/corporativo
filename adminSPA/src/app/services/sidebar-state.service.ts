import { Injectable, signal } from '@angular/core';

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

  setCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, String(collapsed));
    }
  }
}
