// SIEMPRE declara interfaces/models para todos los datos de APIs (regla 2.1)
// SIEMPRE usa PascalCase para interfaces/models en TypeScript (regla 6.1)

export interface UserData {
  idEmpresa?: string | null;
  razonSocial: string;
  nombres: string;
  rol: string;
  lastVerified: number;
  email?: string;
  ruc?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  ruc: string;
}

export interface LoginResponse {
  message: string;
  data: any;
}

export interface EmpresaData {
  idEmpresa: string;
  razonSocial: string;
  ruc: string;
  logo?: string;
  configuraciones?: any;
}