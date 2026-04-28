import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { MovimientoInventarioFormBase } from './movimiento-inventario-form.base';
import {
  CODIGOS_COMPROBANTE_SALIDA,
  TIPOS_MOVIMIENTO_SALIDA
} from './movimiento-inventario.constants';

@Component({
  selector: 'app-salida-inventario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './movimiento-inventario-split.component.html',
  styleUrl: './movimiento-inventario-split.component.css'
})
export class SalidaInventarioComponent extends MovimientoInventarioFormBase {
  readonly modoIngreso = false;
  protected readonly tiposCodigoPermitidos = TIPOS_MOVIMIENTO_SALIDA as unknown as readonly string[];
  protected readonly codigosComprobantePermitidos = CODIGOS_COMPROBANTE_SALIDA as unknown as readonly string[];

  esEntrada(): boolean {
    return false;
  }

  get tituloPagina(): string {
    return 'Salidas de inventario';
  }

  get subtituloPagina(): string {
    return 'Registre reajustes negativos, salidas o mermas y transferencias entre sucursales. Compras y ventas tienen módulos propios.';
  }

  get textoAyudaComprobantes(): string {
    return 'Documentos de egreso: SA (salidas / ajustes negativos) y TF (transferencia entre sucursales).';
  }

  get etiquetaBotonGuardar(): string {
    return 'Guardar salida';
  }
}
