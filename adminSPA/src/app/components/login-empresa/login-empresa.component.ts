import { Component } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

declare var $:any;
declare var iziToast:any;

@Component({
  selector: 'app-login-empresa',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-empresa.component.html',
  styleUrl: './login-empresa.component.css'
})
export class LoginEmpresaComponent {

  
  public user:any = {};
  public usuario:any = {};
  //isBrowser: boolean;
 
  constructor(
    //@Inject(PLATFORM_ID) private platformId: Object,
     private _adminService:AdminService,
    private _router:Router,
    private authService: AuthService,) { 
    //this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {    
    this.user = {
      email: '',
      password: '',
      ruc: ''
    };

    this.usuario = {};
    // if (this.isBrowser) {
    //   //$('body').addClass('align-items-center');
    // }
    // Verifica si el usuario ya está autenticado y redirige si es necesario  
    
  }

  login(loginform: any) {
    if (loginform.valid) {
      let data = {
        email: this.user.email,
        password: this.user.password,
        ruc: this.user.ruc
      };
      
      console.log(data);

      this._adminService.admin_login(data).subscribe(
        response => {
          if (response.data == undefined) {
            //if (typeof window !== 'undefined') {
              iziToast.show({
                title: 'ERROR',
                titleColor: '#FF0000',
                color: '#FFF',
                class: 'text-danger',
                position: 'topRight',
                message: response.message
              });
            //}
            
            
          } else {
            // Si necesitas guardar solo el ID del usuario para navegación, está bien
            this.usuario = response.data.idUsuario;

            // if (typeof window !== 'undefined') {
            //   this._router.navigate(['/empresa/' + response.data.idUsuario]);
            // }
            
            //Redirige con ID del usuario
             this._router.navigate(['/colaborador']);
            //this._router.navigate(['/empresa/' + response.data.idUsuario]);
            this.authService.initialize();
            console.log('Usuario autenticado:', this.usuario);
          }
        },
        error => {
          console.error('Login error:', error);
          //if (typeof window !== 'undefined') {
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              color: '#FFF',
              class: 'text-danger',
              position: 'topRight',
              message: 'Error en el servidor o credenciales inválidas'
            });
          //}
          
          
        }
      );
    } else {
      //if (typeof window !== 'undefined') {
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'Llene todos los campos'
        });
      //}
      
      
    }
  }
}
