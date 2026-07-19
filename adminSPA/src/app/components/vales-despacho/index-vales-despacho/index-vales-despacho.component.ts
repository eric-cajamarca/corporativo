import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ValesDespachoService, ValeDespachoListItem } from '../../../services/vales-despacho.service';

@Component({
  selector: 'app-index-vales-despacho',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './index-vales-despacho.component.html',
  styleUrl: './index-vales-despacho.component.css'
})
export class IndexValesDespachoComponent implements OnInit {
  vales: ValeDespachoListItem[] = [];
  loading = true;

  constructor(
    public sidebarState: SidebarStateService,
    private valesDespachoService: ValesDespachoService
  ) {}

  ngOnInit(): void {
    this.cargarVales();
  }

  cargarVales(): void {
    this.loading = true;
    this.valesDespachoService.listar().subscribe({
      next: (res) => {
        this.vales = res.data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
