import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { MovimientoInventarioFormBase } from './movimiento-inventario-form.base';
import {
  CODIGOS_COMPROBANTE_INGRESO,
  TIPOS_MOVIMIENTO_INGRESO
} from './movimiento-inventario.constants';

@Component({
  selector: 'app-ingreso-inventario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './movimiento-inventario-split.component.html',
  styleUrl: './movimiento-inventario-split.component.css'
})
export class IngresoInventarioComponent extends MovimientoInventarioFormBase {
  readonly modoIngreso = true;
  protected readonly tiposCodigoPermitidos = TIPOS_MOVIMIENTO_INGRESO as unknown as readonly string[];
  protected readonly codigosComprobantePermitidos = CODIGOS_COMPROBANTE_INGRESO as unknown as readonly string[];

  esEntrada(): boolean {
    return true;
  }

  get tituloPagina(): string {
    return 'Ingresos de inventario';
  }

  get subtituloPagina(): string {
    return 'Registre inventario inicial, entradas varias, reajustes positivos y devoluciones. Compras y ventas tienen módulos propios.';
  }

  get textoAyudaComprobantes(): string {
    return 'Documentos de ingreso: II (inventario inicial), IN (ingresos / ajustes positivos) e IV según la configuración de su empresa.';
  }

  get etiquetaBotonGuardar(): string {
    return 'Guardar ingreso';
  }
}
