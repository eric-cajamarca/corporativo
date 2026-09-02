import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

declare const iziToast: {
  question: (options: Record<string, unknown>) => void;
  info: (options: Record<string, unknown>) => void;
};

/**
 * Aviso de nueva versión PWA. Solo activo en producción con Service Worker habilitado.
 * No cachea APIs: solo escucha actualizaciones del shell Angular.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private initialized = false;

  init(): void {
    if (this.initialized || !environment.production || !this.swUpdate?.isEnabled) {
      return;
    }
    this.initialized = true;

    const sw = this.swUpdate;
    if (!sw) {
      return;
    }

    sw.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => this.mostrarAvisoActualizacion());

    sw.unrecoverable.subscribe(() => {
      if (typeof iziToast !== 'undefined') {
        iziToast.info({
          title: 'EFAFERP',
          message: 'Se aplicará una actualización. Recargando…',
          position: 'topCenter'
        });
      }
      window.setTimeout(() => window.location.reload(), 1500);
    });

    // Revisión periódica suave (no bloquea uso ni APIs).
    window.setInterval(() => {
      sw.checkForUpdate().catch(() => undefined);
    }, 6 * 60 * 60 * 1000);
  }

  private mostrarAvisoActualizacion(): void {
    if (typeof iziToast === 'undefined') {
      return;
    }
    iziToast.question({
      timeout: false,
      close: false,
      overlay: true,
      drag: false,
      id: 'pwa-update',
      title: 'Nueva versión',
      message: 'Hay una actualización de EFAFERP disponible. ¿Recargar ahora?',
      position: 'topCenter',
      buttons: [
        ['<button><b>Sí, actualizar</b></button>', () => { window.location.reload(); }, true],
        ['<button>Después</button>', (_instance: unknown, toast: { hide: (args: unknown, msg: string) => void }) => {
          toast.hide({ transitionOut: 'fadeOut' }, 'button');
        }, false]
      ]
    });
  }
}
