import { moduloMenuRequeridoParaUrl } from './ruta-plan-modulo.map';

describe('ruta-plan-modulo.map (Fase 2)', () => {
  it('mapea rutas de tesorería', () => {
    expect(moduloMenuRequeridoParaUrl('/analisis')).toBe('ANALISIS');
    expect(moduloMenuRequeridoParaUrl('/reportes')).toBe('REPORTES');
    expect(moduloMenuRequeridoParaUrl('/creditos')).toBe('CAJA');
    expect(moduloMenuRequeridoParaUrl('/caja/arqueo')).toBe('CAJA');
  });

  it('mapea rutas comerciales', () => {
    expect(moduloMenuRequeridoParaUrl('/ventas/create')).toBe('VENTAS');
    expect(moduloMenuRequeridoParaUrl('/cotizaciones')).toBe('VENTAS');
    expect(moduloMenuRequeridoParaUrl('/clientes')).toBe('CLIENTES');
    expect(moduloMenuRequeridoParaUrl('/cliente/create')).toBe('CLIENTES');
    expect(moduloMenuRequeridoParaUrl('/precios')).toBe('PRODUCTOS');
  });

  it('mapea distribución y fiscal', () => {
    expect(moduloMenuRequeridoParaUrl('/programaciones')).toBe('DESPACHOS');
    expect(moduloMenuRequeridoParaUrl('/vales-despacho/nuevo')).toBe('DESPACHOS');
    expect(moduloMenuRequeridoParaUrl('/facturacion/resumenes-diarios')).toBe('FACTURACION');
    expect(moduloMenuRequeridoParaUrl('/facturacion')).toBe('FACTURACION');
  });

  it('mapea configuración y WhatsApp', () => {
    expect(moduloMenuRequeridoParaUrl('/configuracion/whatsapp-bot')).toBe('CONFIGURACION');
    expect(moduloMenuRequeridoParaUrl('/configuracion/whatsapp')).toBe('CONFIGURACION');
    expect(moduloMenuRequeridoParaUrl('/configuracion/integraciones')).toBe('CONFIGURACION');
  });

  it('exenta rutas de cuenta y plataforma', () => {
    expect(moduloMenuRequeridoParaUrl('/cuenta/mi-suscripcion')).toBeNull();
    expect(moduloMenuRequeridoParaUrl('/empresa')).toBeNull();
  });
});
