import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-barcode-scanner-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bcs-wrap">
      <div class="bcs-top">
        <span>Apunte al código de barras</span>
        <button type="button" class="btn btn-light btn-sm" (click)="cancelar()">Cerrar</button>
      </div>
      <div class="bcs-video-box">
        <video #video autoplay muted playsinline></video>
        <div class="bcs-frame" aria-hidden="true"></div>
      </div>
      <p class="bcs-msg">{{ mensaje }}</p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .bcs-wrap {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 100%;
      background: #0f172a;
      color: #fff;
    }
    .bcs-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      font-weight: 700;
    }
    .bcs-video-box {
      position: relative;
      flex: 1 1 auto;
      min-height: 240px;
      background: #000;
      overflow: hidden;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .bcs-frame {
      position: absolute;
      left: 10%;
      right: 10%;
      top: 30%;
      height: 28%;
      border: 3px solid #22c55e;
      border-radius: 12px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
      pointer-events: none;
    }
    .bcs-msg {
      margin: 0;
      padding: 0.85rem 1rem 1.1rem;
      font-size: 0.9rem;
      color: #cbd5e1;
    }
  `]
})
export class BarcodeScannerModalComponent implements OnDestroy {
  @ViewChild('video', { static: true }) video?: ElementRef<HTMLVideoElement>;

  stream: MediaStream | null = null;
  mensaje = 'Buscando código…';

  private reader: { decodeFromStream?: unknown } | null = null;
  private controls: { stop: () => void } | null = null;
  private cerrado = false;

  constructor(
    private readonly activeModal: NgbActiveModal,
    private readonly ngZone: NgZone
  ) {}

  ngOnDestroy(): void {
    this.detener();
  }

  async usarStream(stream: MediaStream): Promise<void> {
    this.stream = stream;
    await this.iniciar();
  }

  cancelar(): void {
    if (this.cerrado) return;
    this.cerrado = true;
    this.detener();
    this.activeModal.dismiss('cancel');
  }

  private async iniciar(): Promise<void> {
    const videoEl = this.video?.nativeElement;
    if (!videoEl || !this.stream) {
      this.mensaje = 'No se pudo iniciar la cámara.';
      return;
    }
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library')
      ]);
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      this.reader = reader;
      this.controls = await reader.decodeFromStream(this.stream, videoEl, (result) => {
        const texto = result?.getText()?.trim();
        if (!texto || this.cerrado) return;
        this.cerrado = true;
        this.ngZone.run(() => {
          this.detener();
          this.activeModal.close(texto);
        });
      });
    } catch {
      this.mensaje = 'No se pudo leer la cámara. Revise el permiso e inténtelo de nuevo.';
    }
  }

  private detener(): void {
    try {
      this.controls?.stop();
    } catch {
      /* ignore */
    }
    this.controls = null;
    this.reader = null;
    const tracks = this.stream?.getTracks() ?? [];
    for (const t of tracks) {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    }
    this.stream = null;
    const videoEl = this.video?.nativeElement;
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }
}
