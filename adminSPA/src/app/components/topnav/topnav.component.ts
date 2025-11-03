import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { EmpresaService } from '../../services/empresa.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-topnav',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './topnav.component.html',
  styleUrl: './topnav.component.css'
})
export class TopnavComponent {

  //public usuario: any = {};
  public user: any = "";
  public empConect: any = "";
  public rol: any = "";
  //public token: any = "";
  // public UserConect: any = {
  //   nombres: ""
  // };

  constructor(
    private _router: Router,
    private _adminService: AdminService,
    private _empresaService: EmpresaService,
    public authService: AuthService,
  ) {


  }

  ngOnInit(){
    
  }

  
}
