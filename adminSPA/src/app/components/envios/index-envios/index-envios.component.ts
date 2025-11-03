import { Component } from '@angular/core';
import { ProgramacionService } from '../../../services/programacion.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

@Component({
  selector: 'app-index-envios',
  imports: [FormsModule,RouterModule,CommonModule,TopnavComponent],
  templateUrl: './index-envios.component.html',
  styleUrl: './index-envios.component.css'
})
export class IndexEnviosComponent {
  public token: any = "";
  public enviosProgramados: any = [];

  constructor(
    private _programacionService: ProgramacionService,
  ) { 
    //this.token = this._cookieService.get('token');

  }

  ngOnInit(): void {
    
    this._programacionService.obtener_all_programaciones().subscribe(
      response=>{
        this.enviosProgramados = response.data;
        console.log('this.enviosProgramados',this.enviosProgramados);

        //quiero buscar los datos unicos en el campo FEnvio y contar cuantos registros hay de con ese dato unico
         let unique = [...new Set(this.enviosProgramados.map((item: { FEnvio: any; }) => item.FEnvio))];
          console.log('unique',unique);
          
          //ahora quiero que cada unique sea un objeto con el campo FEnvio y la cantidad de registros que hay con ese campo
          this.enviosProgramados = unique.map((item: any) => {
            return {
              FEnvio: item,
              cantidad: this.enviosProgramados.filter((item2: { FEnvio: any; }) => item2.FEnvio === item).length
            }
          })
          console.log('unique2',this.enviosProgramados);

          //ahora quiero convertir en un objeto a this.enviosProgramados
          this.enviosProgramados = this.enviosProgramados.map((item: any) => {
            return {
              FEnvio: item.FEnvio,
              cantidad: item.cantidad,
              data: this.enviosProgramados.filter((item2: { FEnvio: any; }) => item2.FEnvio === item.FEnvio)

              
            }
          })
          console.log('unique2',this.enviosProgramados);

          


      },
      error=>{
        console.log(<any>error);
      }
    )

  }
}
