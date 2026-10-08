import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
import { BarcodeScannerModalComponent } from '../components/shared/barcode-scanner-modal/barcode-scanner-modal.component';

declare const iziToast: {
  warning: (opts: { title: string; message: string; position?: string }) => void;
};

@Injectable({ providedIn: 'root' })
export class BarcodeScannerModalService {
  constructor(private readonly modalService: NgbModal) {}

  /**
   * Pide la cámara (gesto del usuario) y abre el lector.
   * Devuelve el texto del código o null si se cancela / no hay permiso.
   */
  async abrir(): Promise<string | null> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.aviso('Este navegador no permite usar la cámara para leer códigos.');
      return null;
    }
    if (!window.isSecureContext) {
      this.aviso('La cámara solo funciona en HTTPS (o en localhost).');
      return null;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
    } catch (err) {
      this.aviso(this.mensajePermiso(err));
      return null;
    }

    const ref = this.modalService.open(BarcodeScannerModalComponent, {
      fullscreen: true,
      backdrop: 'static',
      backdropClass: 'barcode-scanner-backdrop',
      windowClass: 'barcode-scanner-modal-window',
      keyboard: true,
      centered: false,
      modalDialogClass: 'barcode-scanner-ngb-dialog'
    });
    const cmp = ref.componentInstance as BarcodeScannerModalComponent;
    ref.shown.pipe(take(1)).subscribe(() => {
      void cmp.usarStream(stream);
    });

    try {
      const codigo = await ref.result;
      return typeof codigo === 'string' && codigo.trim() ? codigo.trim() : null;
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }
  }

  private mensajePermiso(err: unknown): string {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Permita el acceso a la cámara en el navegador para leer el código.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'No se encontró una cámara disponible en este dispositivo.';
    }
    if (name === 'NotReadableError') {
      return 'La cámara está en uso por otra aplicación.';
    }
    return 'No se pudo abrir la cámara para leer el código de barras.';
  }

  private aviso(message: string): void {
    if (typeof iziToast !== 'undefined') {
      iziToast.warning({ title: 'Cámara', message, position: 'topRight' });
    }
  }
}
