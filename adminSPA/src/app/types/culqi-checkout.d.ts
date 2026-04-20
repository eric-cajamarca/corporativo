/** Culqi Checkout v4 (https://checkout.culqi.com/js/v4) — tipado mínimo para integración en Angular. */
export interface CulqiCheckoutGlobal {
  publicKey: string;
  settings: (s: CulqiSettings) => void;
  options: (o: CulqiOptions) => void;
  open: () => void;
  close: () => void;
  token?: { id: string };
  error?: { user_message?: string; merchant_message?: string; type?: string };
}

export interface CulqiSettings {
  title: string;
  currency: string;
  description?: string;
  amount?: number;
  order?: string;
}

export interface CulqiPaymentMethods {
  tarjeta?: boolean;
  yape?: boolean;
  bancaMovil?: boolean;
  agente?: boolean;
  billetera?: boolean;
  cuotealo?: boolean;
}

export interface CulqiOptions {
  lang?: string;
  installments?: boolean;
  paymentMethods?: CulqiPaymentMethods;
}

/** Culqi 3DS v1 — https://3ds.culqi.com (ver demo culqi-php-demo-jsv4-culqi3ds) */
export interface Culqi3DSGlobal {
  publicKey: string;
  options?: {
    showModal?: boolean;
    showLoading?: boolean;
    showIcon?: boolean;
    closeModalAction?: () => void;
  };
  /** Obligatorio antes de initAuthentication cuando el primer cargo devuelve action_code REVIEW. */
  settings?: {
    charge: { totalAmount: number; returnUrl: string };
    card: { email: string };
  };
  generateDevice: () => Promise<string | null>;
  /** Recibe el id del token de Culqi Checkout (tkn_...), igual que el primer cargo. */
  initAuthentication: (tokenId?: string) => Promise<void>;
  reset: () => void;
}

declare global {
  interface Window {
    Culqi?: CulqiCheckoutGlobal;
    Culqi3DS?: Culqi3DSGlobal;
    /** Callback global que invoca Culqi tras tokenizar o error. */
    culqi?: () => void;
  }
}
