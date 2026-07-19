import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-create-programacion',
  imports: [FormsModule, RouterModule,CommonModule],
  templateUrl: './create-programacion.component.html',
  styleUrl: './create-programacion.component.css'
})
export class CreateProgramacionComponent {

}
