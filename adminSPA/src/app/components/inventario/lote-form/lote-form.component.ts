import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, NgModelGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LotesService } from '../../../services/lotes.service';
import { ActivatedRoute, Router } from '@angular/router';
import { LoteCreate } from '../../../models/inventario.model';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

@Component({
  selector: 'app-lote-form',
  standalone: true,
  imports: [CommonModule,ReactiveFormsModule],
  templateUrl: './lote-form.component.html',
  styleUrl: './lote-form.component.css'
})
export class LoteFormComponent {
  // Formulario reactivo
  loteForm: FormGroup;
  
  // Modo edición o creación
  isEditMode = false;
  
  // ID del lote en modo edición
  idLote: string | null = null;

  constructor(
    private fb: FormBuilder,
    private loteService: LotesService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Inicializa el formulario con validaciones
    this.loteForm = this.fb.group({
      idProducto: ['', [Validators.required]],
      idSucursal: ['', [Validators.required]],
      costoUnitario: [0, [Validators.required, Validators.min(0)]],
      cantidadIngresada: [0, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    // Detecta si estamos editando
    this.idLote = this.route.snapshot.paramMap.get('id');
    if (this.idLote) {
      this.isEditMode = true;
      console.log('Modo edición para lote ID:', this.idLote);
      this.cargarLote();
    }
  }

  /**
   * Carga datos del lote en modo edición
   */
  cargarLote(): void {
    if (!this.idLote) return;
    
    this.loteService.obtener_lote_id(this.idLote).subscribe({
      next: (lote) => {
        // Carga datos en el formulario
        
        this.loteForm.patchValue({
          idProducto: lote.idProducto,
          idSucursal: lote.idSucursal,
          costoUnitario: lote.costoUnitario,
          cantidadIngresada: lote.cantidadIngresada
        });
      },
      error: (error) => {
        console.error('Error al cargar lote', error);
        alert('No se pudo cargar el lote');
      }
    });
  }

  /**
   * Guarda el lote (crear o actualizar)
   */
  guardarLote(): void {
    if (this.loteForm.invalid) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    const loteData = this.loteForm.value;

    if (this.isEditMode && this.idLote) {
      // Modo edición
      this.loteService.actualizar_lote(this.idLote, loteData).subscribe({
        next: () => {
          alert('Lote actualizado correctamente');
          this.router.navigate(['/inventario/lotes']);
        },
        error: (error) => {
          alert('Error: ' + error.message);
        }
      });
    } else {
      // Modo creación
      const nuevoLote: LoteCreate = {
        ...loteData,
        cantidadDisponible: loteData.cantidadIngresada // Al crear, disponible = ingresado
      };

      this.loteService.crear_lote(nuevoLote).subscribe({
        next: () => {
          alert('Lote creado correctamente');
          this.router.navigate(['/inventario/lotes']);
        },
        error: (error) => {
          alert('Error: ' + error.message);
        }
      });
    }
  }

  /**
   * Cancela y vuelve al listado
   */
  cancelar(): void {
    this.router.navigate(['/inventario/lotes']);
  }

}
