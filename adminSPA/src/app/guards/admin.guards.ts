import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { AdminService } from "../services/admin.service";



@Injectable({
    providedIn: 'root'
  })

  export class AdminGuard implements CanActivate {
  
    constructor(
      private _adminService:AdminService,
      private _router:Router
    ){
    }
  
     canActivate(): any {}
      
    //   //quiero agregar mas roles al array allowedRoles
    //   const allowedRoles = ['Administrador', 'Despachador', 'Almacen', 'Vendedor'];
  
    
    //   if (!this._adminService.isAuthenticated(allowedRoles)) {
    //     // El usuario no tiene permisos, redirige a la página de login
    //     this._router.navigate(['/login']);
    //     return false;
    //   }
    
    //   // Usuario autenticado y con roles permitidos, permite la activación de la ruta
    //   return true;
    // }
    }