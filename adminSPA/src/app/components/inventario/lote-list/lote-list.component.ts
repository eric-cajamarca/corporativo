import { Component } from '@angular/core';
import { LotesService } from '../../../services/lotes.service';
import { Router } from '@angular/router';
import { Lote } from '../../../models/inventario.model';
import { TopnavComponent } from '../../topnav/topnav.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lote-list',
  standalone: true,
  imports: [TopnavComponent,CommonModule],
  templateUrl: './lote-list.component.html',
  styleUrl: './lote-list.component.css'
})
export class LoteListComponent {
  // Array que almacena todos los lotes obtenidos del backend
  lotes: Lote[] = [];
  
  // Bandera para mostrar/ocultar spinner de carga
  isLoading = true;
  
  // Mensaje de error si falla la consulta
  errorMessage = '';

  constructor(
    private loteService: LotesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Al iniciar el componente, carga todos los lotes
    this.cargarLotes();
  }

  /**
   * Carga todos los lotes de la empresa
   */
  cargarLotes(): void {
    this.isLoading = true;
    this.loteService.obtener_lotes_todos().subscribe({
      next: (data) => {
        this.lotes = data.data;
        this.isLoading = false;
        console.log('Lotes cargados:', this.lotes);
      },
      error: (error) => {
        console.error('Error al cargar lotes', error);
        this.errorMessage = 'No se pudieron cargar los lotes';
        this.isLoading = false;
      }
    });
  }

  /**
   * Navega al formulario para crear nuevo lote
   */
  crearLote(): void {
    this.router.navigate(['/inventario/lotes/nuevo']);
  }

  /**
   * Navega al formulario para editar lote
   * @param idLote UUID del lote a editar
   */
  editarLote(idLote: string): void {
    this.router.navigate([`/inventario/lotes/editar/${idLote}`]);
  }

  /**
   * Elimina un lote (solo si no tiene movimientos)
   * @param idLote UUID del lote
   */
  eliminarLote(idLote: string): void {
    if (confirm('¿Está seguro de eliminar este lote? Esto solo funciona si no tiene movimientos.')) {
      this.loteService.eliminar_lote(idLote).subscribe({
        next: () => {
          alert('Lote eliminado correctamente');
          this.cargarLotes(); // Recarga la lista
        },
        error: (error) => {
          alert('Error: ' + error.message);
        }
      });
    }
  }

}
