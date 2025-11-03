import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-index-ventas',
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './index-ventas.component.html',
  styleUrl: './index-ventas.component.css'
})
export class IndexVentasComponent {

}
