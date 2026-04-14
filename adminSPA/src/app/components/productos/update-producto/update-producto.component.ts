import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';
import { CategoriaService } from '../../../services/categoria.service';
import { MarcaService } from '../../../services/marca.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { Producto } from '../../../models/producto.models';

declare var iziToast: any;

interface Categoria {
  idCategoria: string;
  nombre: string;
}

interface Marca {
  idMarca: string;
  nombre: string;
}

interface Presentacion {
  idPresentacion: string;
  codigo: string;
  descripcion: string;
}

@Component({
  selector: 'app-update-producto',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './update-producto.component.html',
  styleUrl: './update-producto.component.css'
})
export class UpdateProductoComponent implements OnInit {
  @Input() idProducto!: string;

  productoForm!: FormGroup;
  categorias: Categoria[] = [];
  marcas: Marca[] = [];
  presentaciones: Presentacion[] = [];

  cargando = true;
  guardando = false;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private productoService: ProductoService,
    private categoriaService: CategoriaService,
    private marcaService: MarcaService,
    private presentacionService: PresentacionService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarCatalogosYProducto();
  }

  private initForm(): void {
    this.productoForm = this.fb.group({
      codigo: ['', [Validators.required, Validators.minLength(2)]],
      descripcion: ['', [Validators.required, Validators.minLength(3)]],
      idCategoria: ['', Validators.required],
      idMarca: ['', Validators.required],
      idPresentacion: ['', Validators.required],
      tipoProducto: ['S', Validators.required],
      cUnitario: [0, [Validators.required, Validators.min(0)]],
      fProduccion: [''],
      fVencimiento: [''],
      alertaMinimo: [0, Validators.min(0)],
      alertaMaximo: [0, Validators.min(0)],
      estado: [true],
      permiteDescripcionEnVenta: [false]
    });
  }

  private cargarCatalogosYProducto(): void {
    this.cargando = true;
    let catalogosListos = 0;
    const totalCatalogos = 3;

    const onCatalogosListos = () => {
      catalogosListos++;
      if (catalogosListos >= totalCatalogos && !this.idProducto) {
        this.cargando = false;
      }
    };

    this.categoriaService.obtener_categorias().subscribe({
      next: (r: any) => { this.categorias = r.data || []; onCatalogosListos(); },
      error: () => onCatalogosListos()
    });
    this.marcaService.obtener_marcas().subscribe({
      next: (r: any) => { this.marcas = r.data || []; onCatalogosListos(); },
      error: () => onCatalogosListos()
    });
    this.presentacionService.obtener_presentaciones().subscribe({
      next: (r: any) => { this.presentaciones = r.data || []; onCatalogosListos(); },
      error: () => onCatalogosListos()
    });

    if (this.idProducto) {
      this.productoService.obtenerProductoPorId(this.idProducto).subscribe({
        next: (response) => {
          const data = response.data;
          if (data && !Array.isArray(data)) {
            this.patchForm(data as Producto);
          }
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error al cargar producto:', error);
          iziToast.error({ title: 'Error', message: 'No se pudo cargar el producto', position: 'topRight' });
          this.cargando = false;
        }
      });
    } else {
      this.cargando = false;
    }
  }

  /** Convierte fecha API (VARCHAR 19 o solo fecha) a yyyy-MM-dd para input date */
  private toDateInput(value: string | undefined): string {
    if (!value) return '';
    const s = String(value).trim();
    if (s.length >= 10) return s.substring(0, 10);
    return s;
  }

  private patchForm(p: Producto): void {
    this.productoForm.patchValue({
      codigo: p.Codigo ?? p.codigo ?? '',
      descripcion: p.descripcion,
      idCategoria: p.idCategoria ?? '',
      idMarca: p.idMarca ?? '',
      idPresentacion: p.idPresentacion ?? '',
      tipoProducto: p.tipoProducto ?? 'S',
      cUnitario: p.cUnitario ?? 0,
      fProduccion: this.toDateInput(p.fechaProduccion ?? p.fProduccion),
      fVencimiento: this.toDateInput(p.fechaVencimiento ?? p.fVencimiento),
      alertaMinimo: p.alertaMinimo ?? 0,
      alertaMaximo: p.alertaMaximo ?? 0,
      estado: !!p.estado,
      permiteDescripcionEnVenta: !!p.permiteDescripcionEnVenta
    });
  }

  hasError(field: string): boolean {
    const c = this.productoForm.get(field);
    return !!(c?.invalid && c?.touched);
  }

  getError(field: string): string {
    const c = this.productoForm.get(field);
    if (c?.errors?.['required']) return 'Requerido';
    if (c?.errors?.['minlength']) return `Mín. ${c.errors['minlength'].requiredLength} caracteres`;
    if (c?.errors?.['min']) return `Valor mínimo: ${c.errors['min'].min}`;
    return '';
  }

  guardar(): void {
    if (this.productoForm.invalid) {
      Object.keys(this.productoForm.controls).forEach(k => this.productoForm.get(k)?.markAsTouched());
      iziToast.warning({ title: 'Validación', message: 'Complete los campos requeridos', position: 'topRight' });
      return;
    }

    this.guardando = true;
    const v = this.productoForm.value;
    const payload = {
      Codigo: v.codigo,
      idCategoria: Number(v.idCategoria),
      idMarca: Number(v.idMarca),
      descripcion: v.descripcion,
      idPresentacion: Number(v.idPresentacion),
      cUnitario: Number(v.cUnitario),
      fProduccion: v.fProduccion || undefined,
      fVencimiento: v.fVencimiento || undefined,
      alertaMinimo: Number(v.alertaMinimo),
      alertaMaximo: Number(v.alertaMaximo),
      estado: !!v.estado,
      tipoProducto: v.tipoProducto || 'S',
      permiteDescripcionEnVenta: !!v.permiteDescripcionEnVenta
    };

    this.productoService.actualizarProducto(this.idProducto, payload).subscribe({
      next: () => {
        iziToast.success({ title: 'Guardado', message: 'Producto actualizado correctamente', position: 'topRight' });
        this.guardando = false;
        this.activeModal.close(true);
      },
      error: (error) => {
        console.error('Error al actualizar producto:', error);
        iziToast.error({
          title: 'Error',
          message: error?.error?.message || 'No se pudieron guardar los cambios',
          position: 'topRight'
        });
        this.guardando = false;
      }
    });
  }

  cerrar(): void {
    this.activeModal.dismiss();
  }
}
