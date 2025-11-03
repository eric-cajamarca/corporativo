import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TopnavComponent } from '../../topnav/topnav.component';

@Component({
  selector: 'app-create-programacion',
  imports: [FormsModule, RouterModule,CommonModule,TopnavComponent],
  templateUrl: './create-programacion.component.html',
  styleUrl: './create-programacion.component.css'
})
export class CreateProgramacionComponent {

}
