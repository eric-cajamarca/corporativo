import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-principal-inventario',
  standalone: true,  // Si estás usando componentes standalone
  imports: [CommonModule],
  templateUrl: './principal-inventario.component.html',
  styleUrls: ['./principal-inventario.component.css']
})
export class PrincipalInventarioComponent {
  // Tu lógica aquí
}