export interface CuentaBancaria {
  idCuentaBancaria: string;
  idEmpresa: string;
  nombreBanco: string;
  numeroCuenta: string;
  tipoCuenta: string;
  moneda: string;
  saldoActual: number;
  fechaApertura: string;
  fechaCierre: string | null;
  estado: boolean | number;
  idCuentaContable: string | null;
}

export interface CuentasBancariasListResponse {
  esEmpresaPrincipal: boolean;
  items: CuentaBancaria[];
}

export interface CuentaBancariaPayload {
  nombreBanco: string;
  numeroCuenta: string;
  tipoCuenta: string;
  moneda: string;
  estado?: boolean;
  fechaApertura?: string;
  idCuentaContable?: string | null;
}
