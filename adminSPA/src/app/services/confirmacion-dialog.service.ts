import { ApplicationRef, Injectable, createComponent, EnvironmentInjector } from '@angular/core';
import {
  ConfirmacionDialogComponent,
  ConfirmacionDialogData
} from '../components/shared/confirmacion-dialog/confirmacion-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmacionDialogService {
  constructor(
    private readonly appRef: ApplicationRef,
    private readonly env: EnvironmentInjector
  ) {}

  confirmar(data: ConfirmacionDialogData): Promise<boolean> {
    const compRef = createComponent(ConfirmacionDialogComponent, {
      environmentInjector: this.env
    });
    compRef.instance.data = data;
    this.appRef.attachView(compRef.hostView);
    document.body.appendChild(compRef.location.nativeElement);

    return new Promise<boolean>((resolve) => {
      const finish = (ok: boolean) => {
        this.appRef.detachView(compRef.hostView);
        compRef.destroy();
        resolve(ok);
      };
      compRef.instance.setResolver(finish);
    });
  }
}
