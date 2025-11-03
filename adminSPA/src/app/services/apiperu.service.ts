import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';


@Injectable({
  providedIn: 'root'
})
export class ApiperuService {

  private apiUrlRuc = 'https://dniruc.apisperu.com/api/v1/ruc';
  private apiUrlDni = 'https://dniruc.apisperu.com/api/v1/dni'

  constructor(
    private _http: HttpClient,
  ) { }

  getRucInfo(filtro: string): Observable<any> {
    console.log('getRucInfo apisperu', filtro);
    let headers = new HttpHeaders().set('Content-Type', 'application/json');
    const apitoken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVyaWNvcnRpemd1ZXZhcmFAZ21haWwuY29tIn0.-cs9eKiQegcTM0bbaz7O-BT_sS7_BpV_6cndIqCeHfk'; // Reemplaza con tu token
    const url = `${this.apiUrlRuc}/${filtro}?token=${apitoken}`;
  
    return this._http.get(url, { headers: headers })
      .pipe(
        catchError(err => {
          console.log('err', err);
          return throwError(err);
        })
      );
  }

  getDniInfo(filtro: string): Observable<any> {
    console.log('getRucInfo', filtro);
    let headers = new HttpHeaders().set('Content-Type', 'application/json');
    const apitoken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVyaWNvcnRpemd1ZXZhcmFAZ21haWwuY29tIn0.-cs9eKiQegcTM0bbaz7O-BT_sS7_BpV_6cndIqCeHfk'; // Reemplaza con tu token
    const url = `${this.apiUrlDni}/${filtro}?token=${apitoken}`;
  
    return this._http.get(url, { headers: headers })
      .pipe(
        catchError(err => {
          console.log('err', err);
          return throwError(err);
        })
      );
  }
  
  //quiero agregar un nuevo servicio para dni pero evitando este error: SyntaxError: Unexpected token e in JSON at position 0 at JSON.parse (<anonymous>)

  // let headers = new HttpHeaders().set('Content-Type', 'application/json');
  //   return this._http.post(this.url + 'admin_login', data, { headers: headers });


  // getDniInfo(filtro: string): Observable<any> {
  //   const apitoken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVyaWNvcnRpemd1ZXZhcmFAZ21haWwuY29tIn0.-cs9eKiQegcTM0bbaz7O-BT_sS7_BpV_6cndIqCeHfk'; // Reemplaza con tu token
  //   const url = `${this.apiUrlDni}/${filtro}?token=${apitoken}`;

  //   //return this._http.get(url);

  //   return this._http.get(url)
  //     .pipe(
  //       map((resp: any) => {
  //         console.log('resp', resp);
  //         let data;
  //         try {
  //           data = JSON.parse(resp);
  //         } catch (error) {
  //           console.error('Error parsing JSON:', error);
  //           // Maneja el error de la manera que prefieras aquí
  //           //quiero convertir el string a json valido
  //           //data = resp;

  //         }
  //         return data;
  //       }),
  //       catchError(err => {
  //         console.log('err', err);
  //         return throwError(err);
  //       })
  //     );
  // }

  // getDniInfo(filtro: string): Observable<any> {
  //   let headers = new HttpHeaders().set('Content-Type', 'application/json');
  //   const apitoken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVyaWNvcnRpemd1ZXZhcmFAZ21haWwuY29tIn0.-cs9eKiQegcTM0bbaz7O-BT_sS7_BpV_6cndIqCeHfk'; // Reemplaza con tu token
  //   const url1 = `https://dniruc.apisperu.com/api/v1/dni/${filtro}?token=${apitoken}`;
  
  //   return this._http.get(url1, { headers: headers})
  //     .pipe(
  //       map((resp: any) => {
  //         console.log('resp', resp);
  //         let data;
  //         try {
  //           data = JSON.parse(resp);
  //         } catch (error) {
  //           console.error('Error parsing JSON:', error);
  //           // Maneja el error de la manera que prefieras aquí
  //         }
  //         return data;
  //       }),
  //       catchError(err => {
  //         console.log('err', err);
  //         return throwError(err);
  //       })
  //     );
  //}



}


