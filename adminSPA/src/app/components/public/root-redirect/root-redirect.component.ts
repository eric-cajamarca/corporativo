import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-root-redirect',
  standalone: true,
  template: `
    <div class="root-redirect">
      <p class="text-muted mb-0">Cargando…</p>
    </div>
  `,
  styles: [
    `
      .root-redirect {
        min-height: 40vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `
  ]
})
export class RootRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.auth
      .peekSession()
      .pipe(take(1))
      .subscribe({
        next: (valid) => {
          void this.router.navigateByUrl(valid ? '/home' : '/publico', { replaceUrl: true });
        },
        error: () => {
          void this.router.navigateByUrl('/publico', { replaceUrl: true });
        }
      });
  }
}
