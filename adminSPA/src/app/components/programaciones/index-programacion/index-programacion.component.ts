import { Component, OnInit, inject } from '@angular/core';
import { ProgramacionService } from '../../../services/programacion.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-index-programacion',
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './index-programacion.component.html',
  styleUrl: './index-programacion.component.css'
})
export class IndexProgramacionComponent implements OnInit {
  public sidebarState = inject(SidebarStateService);
  public programado: any[] = [];
  public loading = false;

  constructor(private _programacionService: ProgramacionService) {}

  ngOnInit(): void {
    this.cargarProgramaciones();
  }

  cargarProgramaciones(): void {
    this.loading = true;
    this._programacionService.obtener_all_programaciones().subscribe({
      next: (response) => {
        this.programado = response?.data ?? response?.programacion ?? [];
      },
      error: (err) => {
        console.error('Error al cargar programaciones:', err);
        this.programado = [];
      },
      complete: () => { this.loading = false; }
    });
  }
}
