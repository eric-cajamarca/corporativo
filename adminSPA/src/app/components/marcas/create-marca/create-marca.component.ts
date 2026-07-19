import { Component, Optional } from '@angular/core';
import { variosService } from '../../../services/varios.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
declare var iziToast: any;

@Component({
  selector: 'app-create-marca',
  imports: [FormsModule, CommonModule],
  templateUrl: './create-marca.component.html',
  styleUrl: './create-marca.component.css'
})
export class CreateMarcaComponent {
  public marca: any = {};
  public token: any = '';
  
  public btn_registrar = false;
  esModal = false;
  /** Empresa gestora: crear marca en empresa gestionada. */
  idEmpresaDestino = '';

  constructor(
    private _marcaService: variosService,
    private _router: Router,
    @Optional() public activeModal: NgbActiveModal
  ) { 
    //this.token = this._cookieService.get('token');
    this.esModal = !!this.activeModal;
  }

  ngOnInit(): void {
  }

  registrar(_registroForm: unknown): void {
    const payload = { ...this.marca };
    if (this.idEmpresaDestino?.trim()) {
      payload.idEmpresaDestino = this.idEmpresaDestino.trim();
    }
    this._marcaService.crearMarca(payload).subscribe({
      next: (response: { data?: { idMarca?: number; IdMarca?: number } }) => {
        const raw = response?.data ?? response;
        const idMarca = raw != null && typeof raw === 'object' ? Number((raw as { idMarca?: number }).idMarca) : NaN;
        iziToast.show({
          title: 'SUCCESS',
          titleColor: '#008000',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'La marca se creó correctamente'
        });
        if (this.activeModal) {
          this.activeModal.close(
            Number.isFinite(idMarca) && idMarca > 0 ? { idMarca } : { ok: true }
          );
        } else {
          this._router.navigate(['/marcas']);
        }
      },
      error: () => {
        iziToast.show({
          title: 'Error',
          titleColor: '#c00',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'No se pudo crear la marca'
        });
      }
    });
  }

  cancelar(): void {
    if (this.activeModal) {
      this.activeModal.dismiss();
      return;
    }
    this._router.navigate(['/marcas']);
  }
}
