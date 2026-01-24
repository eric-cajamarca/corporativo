# 📊 SISTEMA INVENTARIO MULTIEMPRESA - COMPLETO

## 📋 Descripción General

Sistema completo de inventario multiempresa con funcionalidades avanzadas de caja, créditos, despachos, envíos y facturación electrónica.

## 🗂️ Archivos del Sistema

1. **`base_datos_mejorada.sql`** - Estructura completa de la base de datos
2. **`datos_iniciales.sql`** - Datos básicos (empresas, usuarios, productos)
3. **`datos_adicionales.sql`** - Datos para funcionalidades avanzadas
4. **`vistas_utiles.sql`** - Vistas para consultas y reportes

## 🚀 Funcionalidades Implementadas

### 1. 💰 Sistema de Caja
- **Apertura y cierre de cajas** por sucursal
- **Movimientos de caja** (ingresos/egresos) con detalle por forma de pago
- **Control de diferencias** al cierre
- **Múltiples cajas** por sucursal

**Tablas principales:**
- `Cajas` - Definición de cajas
- `AperturasCaja` - Registro de aperturas
- `CierresCaja` - Registro de cierres
- `MovimientosCaja` - Movimientos detallados
- `TiposMovimientoCaja` - Categorías de movimientos

**Procedimientos:**
- `sp_AbrirCaja` - Apertura de caja
- `sp_RegistrarMovimientoCaja` - Registrar movimientos
- `sp_CerrarCaja` - Cierre con cálculo de diferencias

### 2. 💳 Sistema de Cuentas por Cobrar
- **Créditos a clientes** con plazos y tasas de interés
- **Sistema de cuotas** automáticas
- **Pagos parciales** que generan nuevas cuotas
- **Seguimiento por usuario** que otorgó el crédito
- **Estados de cuotas** (Pendiente, Pagado, Vencido)

**Tablas principales:**
- `CreditosClientes` - Créditos otorgados
- `CuotasCredito` - Cuotas generadas
- `PagosCuotas` - Registro de pagos

**Funcionalidad especial:**
- Los pagos parciales generan automáticamente nuevas cuotas con el saldo restante
- Seguimiento de eficiencia de cobros por usuario

### 3. 📦 Sistema de Despachos
- **Dos modos de despacho:**
  - **Automático:** Se despacha automáticamente al registrar la venta
  - **Controlado:** Permite especificar cantidades despachadas manualmente
- **Seguimiento detallado** por producto
- **Estados de despacho** por producto individual

**Tablas principales:**
- `TiposDespacho` - Definición de tipos
- `Despachos` - Registro de despachos por venta
- `DetalleDespachos` - Detalle por producto

### 4. 🚚 Sistema de Envíos
- **Múltiples tipos de envío:**
  - Delivery local
  - Delivery provincial
  - Servicio a obra (ferretería)
  - Retiro en tienda
- **Estados completos:** Agendado → En preparación → En camino → Entregado
- **Transportistas** registrados
- **Historial de cambios** de estado
- **Coordenadas GPS** y evidencia fotográfica

**Tablas principales:**
- `TiposEnvio` - Categorías de envío
- `EstadosEnvio` - Estados del proceso
- `Transportistas` - Registro de transportistas
- `Envios` - Envíos registrados
- `HistorialEstadosEnvio` - Seguimiento de cambios

### 5. 📄 Facturación Electrónica
- **Integración con SUNAT** (Perú)
- **Estados de SUNAT** detallados
- **Almacenamiento de XML** enviados y recibidos
- **Configuración por empresa**
- **Hashes y archivos PDF** generados

**Tablas principales:**
- `EstadosSunat` - Estados de respuesta de SUNAT
- `ComprobantesElectronicos` - Registro de comprobantes
- `ConfiguracionFacturacionElectronica` - Configuración por empresa

## 📊 Vistas Útiles Incluidas

### Sistema de Caja
- `vw_ResumenCajaDiario` - Resumen diario por caja
- `vw_MovimientosCajaDetallado` - Movimientos detallados

### Cuentas por Cobrar
- `vw_ResumenCreditosCliente` - Resumen por cliente
- `vw_CuotasPendientes` - Cuotas pendientes con alertas
- `vw_EficienciaCobros` - Eficiencia de cobros por usuario

### Despachos y Envíos
- `vw_EstadoDespachos` - Estado de despachos por venta
- `vw_EstadoEnvios` - Estado actual de envíos

### Facturación Electrónica
- `vw_ComprobantesElectronicos` - Comprobantes con estado SUNAT
- `vw_ConfiguracionFacturacion` - Configuración por empresa

### Reportes Generales
- `vw_ResumenDiario` - Resumen diario de operaciones
- `vw_ProductosMasVendidos` - Ranking de productos

## 🛠️ Instalación y Configuración

### Paso 1: Crear la Base de Datos
```sql
-- Ejecutar en orden:
1. base_datos_mejorada.sql
2. datos_iniciales.sql
3. datos_adicionales.sql
4. vistas_utiles.sql
```

### Paso 2: Configurar Empresa
```sql
-- Actualizar el ID de empresa en las vistas según corresponda
-- Cambiar '42099529-43C9-4B7F-921A-3D6FB946E93E' por el ID de tu empresa
```

### Paso 3: Usuario Administrador
- **Email:** ericortizguevara@gmail.com
- **Contraseña:** $2a$08$iD7U/5D7Kc.BOH06wQg/.uGB7pY9CNSd2LYwEabV3QM9GCHIYQmby (bcrypt)

## 🔐 Seguridad Implementada

- **Multiempresa completo** - Todas las consultas filtran por `idEmpresa`
- **Sistema de roles y permisos** granular
- **Control de sesiones** con expiración automática
- **Auditoría completa** de todas las operaciones
- **Bloqueo automático** por intentos fallidos de login
- **Validaciones de negocio** en procedimientos almacenados

## 📈 Rendimiento Optimizado

- **25+ índices estratégicos** para consultas frecuentes
- **Estructuras de tablas** optimizadas
- **Vistas materializadas** para reportes complejos
- **Constraints únicos** apropiados
- **Foreign keys** con cascade donde corresponde

## 🎯 Casos de Uso Específicos

### Para Ferretería
- **Envíos a obra** con transportistas registrados
- **Despachos controlados** para materiales pesados
- **Créditos por proyecto** con seguimiento de pagos
- **Control de stock** por ubicación física

### Para Sistema Multiusuario
- **Permisos granulares** por módulo
- **Auditoría completa** de quién hizo qué
- **Sesiones controladas** con timeout automático
- **Reportes de eficiencia** por usuario

## 🔧 Personalización

### Agregar Nueva Empresa
```sql
-- 1. Ejecutar script de empresa en datos_iniciales.sql
-- 2. Configurar permisos específicos
-- 3. Crear sucursales y cajas
-- 4. Configurar facturación electrónica
```

### Agregar Nuevos Tipos de Envío
```sql
INSERT INTO TiposEnvio (nombre, descripcion, costoBase, requiereTransportista)
VALUES ('NUEVO_TIPO', 'Descripción', 10.00, 1);
```

### Modificar Estados de Envío
```sql
INSERT INTO EstadosEnvio (nombre, descripcion, color, orden)
VALUES ('NUEVO_ESTADO', 'Descripción', '#COLOR', 99);
```

## 📋 Próximas Mejoras Sugeridas

1. **API REST** para integración con frontend
2. **Notificaciones automáticas** por email/SMS
3. **Integración con GPS** para rastreo en tiempo real
4. **Análisis predictivo** de demanda
5. **Códigos QR** para entregas
6. **Integración con marketplaces**

## 📞 Soporte

Para soporte técnico o consultas sobre la implementación, revisar:
- Los procedimientos almacenados para lógica de negocio
- Las vistas para reportes y consultas
- Los índices para optimización de rendimiento

---

**Versión:** 3.0 - Sistema Completo Multiempresa
**Fecha:** 2026-01-24
**Autor:** Sistema Automatizado

*Sistema robusto, ligero y completamente funcional para gestión integral de inventario multiempresa.*