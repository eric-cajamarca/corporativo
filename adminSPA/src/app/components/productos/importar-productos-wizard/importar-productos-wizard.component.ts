import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ProductoService } from '../../../services/producto.service';
import { ExcelService } from '../../../services/excel.service';
import { AuthService } from '../../../services/auth.service';
import {
  ImportacionProductosEjecutarData,
  ImportacionProductosValidarData
} from '../../../models/producto.models';

declare var iziToast: any;

type PasoWizard = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-importar-productos-wizard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './importar-productos-wizard.component.html',
  styleUrl: './importar-productos-wizard.component.css'
})
export class ImportarProductosWizardComponent implements OnInit {
  paso: PasoWizard = 1;
  descargandoPlantilla = false;
  validando = false;
  importando = false;

  archivo: File | null = null;
  nombreArchivo = '';

  validacion: ImportacionProductosValidarData | null = null;
  resultado: ImportacionProductosEjecutarData | null = null;

  readonly columnasPlantilla = [
    { col: 'codigo', desc: 'Código único del producto (obligatorio)' },
    { col: 'descripcion', desc: 'Nombre o descripción (obligatorio)' },
    { col: 'presentacion', desc: 'Unidad SUNAT, ej. NIU (obligatorio)' },
    { col: 'cantidadInicial', desc: 'Stock inicial en sucursal principal (0 si vacío)' },
    { col: 'costoUnitario', desc: 'Costo unitario (≥ 0)' },
    { col: 'precioNormal', desc: 'Precio lista Normal (obligatorio)' },
    { col: 'precioCliente', desc: 'Precio lista Cliente (obligatorio)' },
    { col: 'precioMayorista', desc: 'Precio lista Mayorista (obligatorio)' },
    { col: 'categoria', desc: 'Vacío = Varios' },
    { col: 'marca', desc: 'Vacío = SM (sin marca)' },
    {
      col: 'ubicacion',
      desc: 'Código de la hoja Ubicaciones. Si se indica, cantidadInicial debe ser > 0 y el stock se asigna ahí'
    }
  ];

  constructor(
    private productoService: ProductoService,
    private excelService: ExcelService,
    private authService: AuthService,
    private router: Router,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    if (!this.esAdministrador()) {
      void this.router.navigate(['/productos']);
    }
  }

  esAdministrador(): boolean {
    const r = this.authService.userData()?.rol;
    return r === 'Administrador' || r === 'superAdmin';
  }

  get puedeAvanzarPaso2(): boolean {
    return !!this.archivo;
  }

  get puedeImportar(): boolean {
    return !!this.validacion && this.validacion.validas > 0 && !this.validando && !this.importando;
  }

  get progresoPct(): number {
    if (this.paso === 4) return 100;
    return Math.round(((this.paso - 1) / 3) * 100);
  }

  descargarPlantilla(): void {
    this.descargandoPlantilla = true;
    this.productoService.descargarPlantillaImportacionProductos().subscribe({
      next: (blob) => {
        this.descargandoPlantilla = false;
        this.excelService.descargar(blob, 'plantilla_importacion_productos.xlsx');
      },
      error: (err) => {
        this.descargandoPlantilla = false;
        this.toastError(err?.error?.message || 'No se pudo descargar la plantilla.');
      }
    });
  }

  onArchivoChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.archivo = f;
    this.nombreArchivo = f?.name ?? '';
    this.validacion = null;
    this.resultado = null;
  }

  irPaso(n: PasoWizard): void {
    this.paso = n;
  }

  continuarDesdePlantilla(): void {
    this.paso = 2;
  }

  validarYContinuar(): void {
    if (!this.archivo) return;
    this.validando = true;
    this.resultado = null;
    this.productoService.validarImportacionProductos(this.archivo).subscribe({
      next: (res) => {
        this.validando = false;
        this.validacion = res.data;
        this.paso = 3;
        if (typeof iziToast !== 'undefined') {
          iziToast.info({
            title: 'Validación',
            message: `${res.data.validas} fila(s) válida(s), ${res.data.conError} con error.`,
            position: 'topRight'
          });
        }
      },
      error: (err) => {
        this.validando = false;
        this.toastError(err?.error?.message || 'Error al validar el archivo.');
      }
    });
  }

  ejecutarImportacion(): void {
    if (!this.archivo || !this.puedeImportar) return;
    this.importando = true;
    this.productoService.ejecutarImportacionProductos(this.archivo).subscribe({
      next: (res) => {
        this.importando = false;
        this.resultado = res.data;
        this.paso = 4;
        const noImport = res.data?.noImportadosExcel;
        if (noImport?.base64) {
          const blob = this.base64AExcelBlob(noImport.base64, noImport.mimeType);
          this.excelService.descargar(blob, noImport.fileName || 'productos_no_importados.xlsx');
        }
        if (typeof iziToast !== 'undefined') {
          iziToast.success({
            title: 'Importación',
            message: `Se registraron ${res.data.insertados} producto(s).`,
            position: 'topRight'
          });
        }
      },
      error: (err) => {
        this.importando = false;
        this.toastError(err?.error?.message || 'Error al importar.');
      }
    });
  }

  reiniciarWizard(): void {
    this.paso = 1;
    this.archivo = null;
    this.nombreArchivo = '';
    this.validacion = null;
    this.resultado = null;
  }

  volverAListado(): void {
    void this.router.navigate(['/productos']);
  }

  private base64AExcelBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64 || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  private toastError(message: string): void {
    if (typeof iziToast !== 'undefined') {
      iziToast.error({ title: 'Error', message, position: 'topRight' });
    }
  }
}
