import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmpresaService } from '../../../services/empresa.service';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

declare var iziToast: any;

@Component({
  selector: 'app-verificar-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './verificar-empresa.component.html',
  styleUrl: './verificar-empresa.component.css'
})
export class VerificarEmpresaComponent implements OnInit {
  idEmpresa = signal('');
  codigo = signal('');
  enviando = signal(false);

  constructor(
    private empresaService: EmpresaService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('idEmpresa');
    if (id) this.idEmpresa.set(id);
  }

  verificar(): void {
    const id = this.idEmpresa().trim();
    const cod = this.codigo().trim();
    if (!id) {
      iziToast.warning({ title: 'Falta ID de empresa', message: 'Ingresa el ID de empresa.' });
      return;
    }
    if (!cod || cod.length !== 6) {
      iziToast.warning({ title: 'Código inválido', message: 'El código debe tener 6 dígitos.' });
      return;
    }
    this.enviando.set(true);
    this.empresaService.verificarEmpresa(id, cod).subscribe({
      next: (res) => {
        this.enviando.set(false);
        iziToast.success({ title: 'Cuenta activada', message: res.message || 'Ya puedes iniciar sesión.' });
        this.router.navigate(['/login-empresa']);
      },
      error: (err) => {
        this.enviando.set(false);
        const msg = err?.error?.message || 'No se pudo verificar. Revisa el código.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  irALogin(): void {
    this.router.navigate(['/login-empresa']);
  }
}
