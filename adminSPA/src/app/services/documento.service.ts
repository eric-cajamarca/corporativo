import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global.js'; // Asegúrate de que la ruta sea correcta
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DocumentoService {

  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  //Metodo para obtener todos los documentos
  obtener_documento():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'documentos',{withCredentials:true,headers:headers});  
  }

  //Metodo para obtener un documento por id
  obtener_documento_id(token:any,id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':token});
    return this._http.get(this.url+'documentos/'+id,{headers:headers});
  }

  //Metodo para crear un documento
  crear_documento(token:any,data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':token});
    return this._http.post(this.url+'documentos',data,{headers:headers});
  }

  //Metodo para editar un documento por id
  editar_documento(token:any,id:any,data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':token});
    return this._http.put(this.url+'documentos/'+id,data,{headers:headers});
  }

  //Metodo para eliminar un documento por id
  eliminar_documento(token:any,id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':token});
    return this._http.delete(this.url+'documentos/'+id,{headers:headers});
  }

  //aqui consulto comprobantes
  getFormasPago():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'formaPago',{withCredentials:true,headers:headers}); 
  }
}
