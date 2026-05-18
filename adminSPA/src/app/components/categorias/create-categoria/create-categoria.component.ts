import { Component, Optional } from '@angular/core';
import { CategoriaService } from '../../../services/categoria.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;


@Component({
  selector: 'app-create-categoria',
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent],
  templateUrl: './create-categoria.component.html',
  styleUrl: './create-categoria.component.css'
})
export class CreateCategoriaComponent {

  public categorias: any = {};
  public token: any = '';
  
  public btn_registrar = false;
  esModal = false;
  /** Empresa gestora: crear categoría en empresa gestionada. */
  idEmpresaDestino = '';

  constructor(
    private _categoriaService: CategoriaService,
    private _router: Router,
    @Optional() public activeModal: NgbActiveModal
  ) { 
    //this.token = this._cookieService.get('token');
    this.esModal = !!this.activeModal;
  }

  ngOnInit(): void {
  }

  registrar(_registroForm: unknown): void {
    const payload = { ...this.categorias };
    if (this.idEmpresaDestino?.trim()) {
      payload.idEmpresaDestino = this.idEmpresaDestino.trim();
    }
    this._categoriaService.crear_categoria(payload).subscribe({
      next: (response: { data?: { idCategoria?: number; IdCategoria?: number } }) => {
        const raw = response?.data ?? response;
        const idCategoria =
          raw != null && typeof raw === 'object' ? Number((raw as { idCategoria?: number }).idCategoria) : NaN;
        iziToast.show({
          title: 'SUCCESS',
          titleColor: '#008000',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'La categoría se creó correctamente'
        });
        if (this.activeModal) {
          this.activeModal.close(
            Number.isFinite(idCategoria) && idCategoria > 0 ? { idCategoria } : { ok: true }
          );
        } else {
          this._router.navigate(['/categorias']);
        }
      },
      error: () => {
        iziToast.show({
          title: 'Error',
          titleColor: '#c00',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'No se pudo crear la categoría'
        });
      }
    });
  }

  cancelar(): void {
    if (this.activeModal) {
      this.activeModal.dismiss();
      return;
    }
    this._router.navigate(['/categorias']);
  }
}
