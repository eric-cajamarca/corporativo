import { Component, Input, effect, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppBannerService } from '../../services/app-banner.service';
import { AppBannerItem } from '../../models/app-banner.model';

@Component({
  selector: 'app-banner-ribbon',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-banner-ribbon.component.html',
  styleUrl: './app-banner-ribbon.component.css'
})
export class AppBannerRibbonComponent implements OnDestroy {
  @Input() sidebarCollapsed = false;

  readonly banner = inject(AppBannerService);

  constructor() {
    effect(() => {
      const n = this.banner.avisos().length;
      this.toggleBodyClass(n > 0);
    });
  }

  ngOnDestroy(): void {
    this.toggleBodyClass(false);
  }

  trackById(_i: number, a: AppBannerItem): string {
    return a.id;
  }

  clasePorSeveridad(s: AppBannerItem['severity']): string {
    switch (s) {
      case 'danger':
        return 'ribbon-strip ribbon-danger';
      case 'warning':
        return 'ribbon-strip ribbon-warning';
      case 'success':
        return 'ribbon-strip ribbon-success';
      default:
        return 'ribbon-strip ribbon-info';
    }
  }

  descartar(a: AppBannerItem, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    if (a.dismissible !== false) {
      this.banner.descartar(a);
    }
  }

  private toggleBodyClass(on: boolean): void {
    try {
      document.body.classList.toggle('app-has-banner-ribbon', on);
    } catch {
      /* ignore */
    }
  }
}
