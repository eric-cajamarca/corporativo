// DEPRECATED: Usar environment en su lugar (regla 2.2)
// Este archivo se mantiene por compatibilidad pero debería ser reemplazado

import { environment } from '../../environments/environment';

export var global = {
    url: environment.API_URL,
};