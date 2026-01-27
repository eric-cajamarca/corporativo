import { Component } from '@angular/core';
import { RolService } from '../../../services/rol.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';


@Component({
  selector: 'app-index-rol',
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent, NgbPagination],
  templateUrl: './index-rol.component.html',
  styleUrl: './index-rol.component.css'
})
export class IndexRolComponent {

  public token:any;
  public roles:Array<any> = [];
  
  
  // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;


  constructor(
    private _rolService: RolService,
    private _route: Router,
  ) {
    //this.token = this._cookieService.get('token');
   }


  ngOnInit(): void {
    this._rolService.obtenerRoles().subscribe(
      response=>{
        console.log('response: ',response.data);
        this.roles = response.data;
        console.log('this.roles: ',this.roles);
      },
      error=>{
        console.log('error: ',error);
      }
    )

  }

  redirigirCrearRol(){
    this._route.navigate(['/rol/create']);
  }

  onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }
}
