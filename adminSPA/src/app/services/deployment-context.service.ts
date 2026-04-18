import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DeploymentConfig } from '../models/saas-public.model';

@Injectable({ providedIn: 'root' })
export class DeploymentContextService {
  private readonly baseUrl = environment.API_URL;
  private readonly subject = new BehaviorSubject<DeploymentConfig | null>(null);

  constructor(private http: HttpClient) {}

  get config$(): Observable<DeploymentConfig | null> {
    return this.subject.asObservable();
  }

  get snapshot(): DeploymentConfig | null {
    return this.subject.value;
  }

  cargarSiNecesario(): Observable<DeploymentConfig | null> {
    if (this.subject.value) {
      return of(this.subject.value);
    }
    return this.http
      .get<{ data: DeploymentConfig }>(`${this.baseUrl}public/config/deployment`, {
        withCredentials: false
      })
      .pipe(
        map((r) => r.data),
        tap((c) => this.subject.next(c)),
        catchError(() => {
          const fallback: DeploymentConfig = {
            deploymentMode: environment.deploymentMode,
            mostrarPlanesPublicos: environment.deploymentMode === 'saas'
          };
          this.subject.next(fallback);
          return of(fallback);
        })
      );
  }
}
