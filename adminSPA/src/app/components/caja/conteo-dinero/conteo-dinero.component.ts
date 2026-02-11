import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-conteo-dinero',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './conteo-dinero.component.html',
  styleUrl: './conteo-dinero.component.css'
})
export class ConteoDineroComponent {}

