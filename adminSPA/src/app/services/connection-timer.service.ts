import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConnectionTimerService {
  private readonly totalMs = signal(0);
  private readonly sessionActive = signal(false);

  readonly connectedSeconds = computed(() => Math.floor(this.totalMs() / 1000));

  startSession(): void {
    this.totalMs.set(0);
    this.sessionActive.set(true);
  }

  stopSession(): void {
    this.sessionActive.set(false);
    this.totalMs.set(0);
  }

  addDuration(ms: number): void {
    if (!this.sessionActive() || ms <= 0) {
      return;
    }
    this.totalMs.update((prev) => prev + ms);
  }

  isActive(): boolean {
    return this.sessionActive();
  }
}
