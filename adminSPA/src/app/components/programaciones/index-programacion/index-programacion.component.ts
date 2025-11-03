import { Component } from '@angular/core';
import { ProgramacionService } from '../../../services/programacion.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

@Component({
  selector: 'app-index-programacion',
  imports: [FormsModule,RouterModule,CommonModule,TopnavComponent],
  templateUrl: './index-programacion.component.html',
  styleUrl: './index-programacion.component.css'
})
export class IndexProgramacionComponent {
  public token:any = '';
  public programado:any = [];

  constructor(
    private _progamacionService: ProgramacionService,
  ) {
    //this.token = this._cookieService.get('token');
   }


  ngOnInit() {
    this._progamacionService.obtener_all_programaciones().subscribe(
      response=>{
        
        this.programado = response.programacion;
        console.log('this.programado',this.programado);
      },
      error=>{
        console.log(<any>error);
      }
    )
  }
}
