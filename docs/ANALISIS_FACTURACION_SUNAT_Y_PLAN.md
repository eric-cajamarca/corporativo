# Análisis: Facturación directa a SUNAT y plan de implementación

Documento de revisión de lo implementado y lo pendiente según APIs SUNAT, manual del programador y documentación oficial (FE Primer, orientación SUNAT). Incluye propuesta de tablas de credenciales y plan por fases.

---

## 1. Resumen ejecutivo

| Área | Estado actual | Falta |
|------|----------------|-------|
| **Facturas (01)** | Emisión en crear-venta, envío individual sendBill, directo o Facturador | - |
| **Boletas (03)** | Igual que facturas; envío individual | Resumen diario (RC) a las 24 h y componente para ver resúmenes |
| **Notas de crédito (07) / débito (08)** | Registro en CE y catálogo motivo NC (09) | Generación UBL 07/08, componente que jale comprobante relacionado |
| **Comunicación de baja (RA)** | Plantilla JSON | sendSummary RA, solo a facturas aceptadas, componente aparte |
| **Guía de remisión (09)** | No implementado | Componente, UBL, endpoint guías |
| **Guía transportista** | No implementado | Componente y endpoint guías (si aplica) |
| **Credenciales API SUNAT** | Una config por empresa (facturación) | Opcional: credenciales/URL para guías (tabla o campos) |

---

## 2. Lo que está implementado

### 2.1 Configuración y credenciales (facturación)

- **Tabla:** `ConfiguracionFacturacionElectronica` (una fila por empresa).
- **Campos usados para envío directo:**  
  `usuarioSunat`, `claveSunat`, `urlEnvio`, `envioDirectoSunat`, `certificadoDigital`, `claveCertificado`, `serieFactura`, `serieBoleta`, `serieNotaCredito`, `serieNotaDebito`.
- **Usuario SOAP:** se arma como `RUC + usuarioSunat` si `usuarioSunat` no es largo ni numérico; si no, se usa tal cual.
- No existe hoy una tabla separada “credenciales API SUNAT”; todo va en esta configuración por empresa.

### 2.2 Flujo crear-venta → comprobante → SUNAT

1. **Crear venta:** En `ventas.service.js` / `ventasController.js`, al insertar la venta se llama a `registrarComprobanteElectronicoPorVentaRepo` dentro de la misma transacción.
2. **Registro en ComprobantesElectronicos:** Solo si el tipo de comprobante de la venta es 01, 03, 07 u 08 (según `Comprobantes.codigo`). Se guarda con `idEstadoSunat = 7` (pendiente).
3. **Envío:** Manual (botón “Enviar a SUNAT” en listado de ventas) o automático por job cada 10 min (`envioSunat.job.js` → `ejecutarEnvioAutomaticoService` → `enviarLotePendientesService`).
4. **Envío directo:** `envioDirectoSunat.service.js` implementa **sendBill** (SOAP): ZIP del XML firmado en base64, cabecera WS-Security (usuario/clave SOAP). URLs: BETA y producción de BillService **facturación** (facturas, boletas, notas, resumen, bajas).
5. **Generación XML:** Solo Factura (01) y Boleta (03) en `generadorXmlUblSunat.service.js` (`generarXmlUblFacturaBoleta`). El XML se firma con `firmaXmlSunat.service.js` y se envía con `sendBill`.

Conclusión: **Facturas y boletas** se emiten en crear-venta y se envían **de forma individual** con sendBill. No hay envío de **resumen diario (RC)** ni uso de **sendSummary**.

### 2.3 Catálogos en base de datos

- **MotivoNotaCredito:** tabla por empresa con `codigoSunat` (Catálogo 09: códigos 01–13). API: `GET /api/.../motivo-nota-credito`, `codigos-sunat`.
- **EstadosSunat:** estados de comprobante (Pendiente, Aceptado, Observaciones, Rechazado, etc.).
- **Comprobantes:** por empresa, con `codigo` (01, 03, 07, 08, RC, RA, etc.). En datos de ejemplo aparecen también 10/11 para guías (en SUNAT suele usarse 09 para guía remisión).
- **Tributos / Impuestos:** códigos SUNAT (ej. Catálogo 05) en `Query/sunat.sql` y migraciones.

### 2.4 Plantillas y referencias

- `backAppC/plantillas-facturacion-electronica/resumen-diario.json`: estructura tipo resumen diario (RC).
- `backAppC/plantillas-facturacion-electronica/comunicacion-baja.json`: estructura tipo comunicación de baja (RA).
- No hay servicio que arme el XML de RC/RA ni que llame a **sendSummary**.

### 2.5 Documentación interna

- `docs/PLAN_ENVIO_DIRECTO_SUNAT.md`: plan sendBill y requisitos (usuario secundario, certificado, ZIP, base64).
- `docs/GUIA_ENVIO_DIRECTO_SUNAT_PASO_A_PASO.md`: pasos de configuración en la app.

---

## 3. Lo que falta (detalle)

### 3.1 Resumen diario de boletas (RC)

- **Norma SUNAT:** Las boletas (03) y las notas de crédito/débito vinculadas a boletas (07/08) pueden declararse en un **resumen diario (RC)** que se envía con **sendSummary** (mismo BillService de facturación). Plazo típico: hasta 24 horas desde la emisión.
- **Estado:** Hoy todas las boletas se envían con **sendBill** de forma individual. No existe:
  - Generación del XML de resumen (RC) a partir de las boletas/notas del día.
  - Llamada a **sendSummary** con ese XML (ZIP + base64, misma seguridad SOAP).
  - Consulta de estado del resumen con **getStatus** (opcional).
- **Componente sugerido:** Módulo para **visualizar y gestionar resúmenes diarios** por día, mes y rango de fechas (listado, estado, reenvío si aplica).

### 3.2 Notas de crédito (07) y notas de débito (08)

- **Estado:**  
  - Se pueden registrar en `ComprobantesElectronicos` (tipos 07/08) si la venta se crea con ese tipo de comprobante.  
  - No hay generador UBL para 07/08 (solo 01/03).  
  - No hay pantalla específica para “emitir NC/ND a una factura ya aceptada” ni para cargar datos del comprobante por el cual se emite.
- **Falta:**  
  - Generador XML UBL para CreditNote (07) y DebitNote (08) según catálogos SUNAT (motivo, documento de referencia, etc.).  
  - **Componente aparte** “Notas de crédito / débito”: selección de comprobante origen (factura aceptada), motivo (catálogo 09 para NC; para ND revisar catálogo si existe), ítems/montos y emisión + envío (sendBill).  
  - Catálogo de motivos para nota de débito si SUNAT lo exige (consultar anexos).

### 3.3 Comunicación de baja (RA)

- **Norma:** Solo se puede dar de baja comprobantes **aceptados** por SUNAT (facturas y, según norma, notas vinculadas). Se envía con **sendSummary** (tipo RA).
- **Estado:** Hay plantilla JSON de comunicación de baja; no hay servicio que arme el XML VoidedDocuments ni que llame a sendSummary(RA).
- **Falta:**  
  - Generación del XML de comunicación de baja (RA) con motivo y lista de comprobantes (tipo, serie, número).  
  - Catálogo de **motivos de baja** (SUNAT: ej. deterioro, robo, extravío, etc.); crear tabla o usar catálogo fijo si no existe en BD.  
  - Servicio sendSummary para RA (mismo BillService facturación, mismas credenciales).  
  - **Componente aparte** “Comunicación de baja”: selección de facturas (solo aceptadas), motivo, envío y estado.

### 3.4 Guías de remisión

- **Norma:** Guía de remisión electrónica (GRE) tiene **endpoint distinto** al de facturación:
  - Facturación: `https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService` (y producción equivalente).
  - Guías: `https://e-beta.sunat.gob.pe/ol-ti-itemision-guia-gem-beta/billService` (y producción).
- **Credenciales:** Según documentación (FE Primer), se usa la misma clave SOL (RUC + usuario, contraseña). No se menciona usuario distinto para guías; sí **URL distinta**.
- **Estado:** No hay generación UBL de guía ni envío ni pantalla.
- **Falta:**  
  - Generador UBL para guía de remisión (09) según especificación SUNAT (motivo de traslado, peso, transportista si aplica, etc.).  
  - Servicio de envío al **BillService de guías** (sendBill con URL de guías).  
  - **Componente aparte** “Guías de remisión”: datos de la guía, relación con venta/comprobantes, emisión y estado.  
  - Catálogos: motivo de traslado, tipo de transporte, etc. (consultar anexos SUNAT).

### 3.5 Guía transportista

- **Norma:** Si la empresa es transportista, puede emitir guía en ese carácter (modalidad “transportista”). Suele usar el mismo servicio de guías con tipo o indicador distinto.
- **Estado:** No implementado.
- **Falta:** Mismo endpoint de guías; en el componente y en el UBL distinguir “remitente” vs “transportista” y llenar los datos según el caso.

### 3.6 Credenciales API SUNAT (multiempresa)

- **Hoy:** Una sola configuración por empresa en `ConfiguracionFacturacionElectronica`: usuario/clave SOAP y URL para **facturación** (sendBill/sendSummary de facturas, boletas, notas, RC, RA).
- **Guías:** **No usan SOAP.** Usan **API REST**. Flujo: (1) Generar XML GRE, (2) Firmar XML, (3) Enviar vía API. Endpoint fijo: **POST /v1/contribuyente/gem**. Credenciales de la API: **ID** y **CLAVE** (distintas del usuario/clave SOL de facturación). Se añade en `ConfiguracionFacturacionElectronica`: `urlBaseApiGuias` (URL base del API, sin el path), `idApiGuias` (ID), `claveApiGuias` (CLAVE).

---

## 4. Tablas propuestas para credenciales API SUNAT (multiempresa)

Si se opta por tener un modelo explícito de “credenciales por servicio SUNAT” (recomendable a medio plazo), se propone lo siguiente.

### 4.1 Catálogo de servicios SUNAT

```sql
-- Servicios SUNAT que pueden requerir credenciales/URL distintas
CREATE TABLE ServiciosSunat (
    idServicioSunat INT PRIMARY KEY IDENTITY(1,1),
    codigo VARCHAR(20) NOT NULL UNIQUE,   -- 'FACTURACION', 'GUIAS'
    nombre VARCHAR(100) NOT NULL,
    urlBeta VARCHAR(500) NULL,
    urlProduccion VARCHAR(500) NULL,
    activo BIT NOT NULL DEFAULT 1
);

INSERT INTO ServiciosSunat (codigo, nombre, urlBeta, urlProduccion) VALUES
('FACTURACION', 'Facturación electrónica (Facturas, Boletas, Notas, RC, RA)',
 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService'),
('GUIAS', 'Guías de remisión electrónicas (API REST, no SOAP). Endpoint: POST /v1/contribuyente/gem',
 'https://e-beta.sunat.gob.pe/',
 'https://e-factura.sunat.gob.pe/');
```

### 4.2 Credenciales por empresa y servicio

```sql
-- Credenciales por empresa y servicio (multiempresa)
CREATE TABLE CredencialesApiSunat (
    idCredencialApiSunat UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    idServicioSunat INT NOT NULL,
    usuarioSol VARCHAR(100) NULL,          -- usuario secundario (ej. MODDATOS) o RUC+Usuario
    claveSol VARCHAR(256) NULL,           -- cifrada igual que claveCertificado
    urlEnvio VARCHAR(500) NULL,           -- si NULL, usar url de ServiciosSunat según modoPrueba
    usarBeta BIT NOT NULL DEFAULT 1,
    activo BIT NOT NULL DEFAULT 1,
    fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    fechaModificacion DATETIME2 NULL,
    CONSTRAINT UQ_CredencialesApiSunat_EmpresaServicio UNIQUE (idEmpresa, idServicioSunat),
    CONSTRAINT FK_CredencialesApiSunat_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_CredencialesApiSunat_Servicio FOREIGN KEY (idServicioSunat) REFERENCES ServiciosSunat(idServicioSunat)
);

CREATE INDEX IX_CredencialesApiSunat_Empresa ON CredencialesApiSunat(idEmpresa);
```

- **Certificado digital:** Sigue en `ConfiguracionFacturacionElectronica` (es común para firmar todos los XML de la empresa).
- **Compatibilidad:** El flujo actual puede seguir leyendo usuario/clave/url desde `ConfiguracionFacturacionElectronica` para el servicio “FACTURACION” y, si existe fila en `CredencialesApiSunat` para esa empresa y servicio, usarla con prioridad (o migrar por fases).

---

## 5. Catálogos SUNAT a revisar o crear

- **Catálogo 01 – Tipo de comprobante:** Ya reflejado en `Comprobantes.codigo` (01, 03, 07, 08, 09, RC, RA, etc.).
- **Catálogo 09 – Motivo de nota de crédito:** Ya en `MotivoNotaCredito` (códigos 01–13).
- **Motivo de nota de débito:** Verificar si SUNAT publica catálogo; si existe, crear tabla o lista.
- **Motivo de baja (comunicación de baja):** Ver Resolución 124-2006/SUNAT y anexos; crear tabla `MotivoBajaSunat` o equivalente si no existe.
- **Guías:** Motivo de traslado, tipo de transporte, etc. (consultar manual del programador / anexos GRE).

---

## 6. Plan de implementación sugerido

### Fase 1 – Resumen diario (RC) y visualización

1. Backend: servicio que, dado un rango de fechas y empresa, agrupe boletas (y notas 07/08 ligadas a boletas) emitidas y no enviadas en resumen, y genere el XML de resumen diario (RC) según nomenclatura SUNAT.
2. Backend: en `envioDirectoSunat.service.js` (o módulo nuevo) implementar **sendSummary** (mismo BillService que sendBill): ZIP en base64, cabecera SOAP, envío y parseo de respuesta/CDR.
3. Backend: opción de “enviar boletas del día como resumen” (o por fecha) y guardar estado del resumen (tabla `ResumenesDiariosSunat` si se desea historial: idEmpresa, fecha, correlativo, idEstadoSunat, ticket getStatus, etc.).
4. Frontend: **componente “Resúmenes diarios”**: filtros por día, mes, rango; listado de resúmenes con estado; botón “Generar y enviar resumen” para una fecha.
5. Ajustar política de envío: para boletas, configurar si se envían individual (sendBill) o solo en resumen (sendSummary); o híbrido (individual opcional y resumen antes del plazo).

### Fase 2 – Notas de crédito y débito

1. Backend: generador UBL para CreditNote (07) y DebitNote (08) con documento de referencia (factura/boleta), motivo (catálogo 09 para NC) y ítems/montos.
2. Backend: API para “crear comprobante electrónico nota de crédito/débito” a partir de idVenta o idComprobanteElectronico origen (validar que esté aceptado).
3. Frontend: **componente “Notas de crédito / Notas de débito”**: búsqueda de factura (o boleta) por serie-número o venta; cargar datos del comprobante; editar ítems/montos y motivo; emitir y enviar (sendBill).
4. Catálogo motivo de débito si aplica.

### Fase 3 – Comunicación de baja

1. Backend: catálogo de motivos de baja (tabla o constante según SUNAT).
2. Backend: generador XML VoidedDocuments (RA) con lista de comprobantes (tipo, serie, número) y motivo.
3. Backend: envío con sendSummary(RA); solo permitir facturas (y según norma notas) en estado “Aceptado”.
4. Frontend: **componente “Comunicación de baja”**: listado de facturas aceptadas; selección de comprobantes a dar de baja; motivo; envío y estado.

### Fase 4 – Guías de remisión

**Importante:** Las guías **no usan SOAP/BillService**. Usan **API REST**.

1. Revisar manual SUNAT / anexos para estructura UBL de guía (09) y catálogos (motivo traslado, tipo transporte, etc.).
2. **Flujo backend:** (1) Generar XML GRE, (2) Firmar XML (mismo certificado que facturación si aplica), (3) Enviar vía **API**: **POST {urlBaseApiGuias}/v1/contribuyente/gem** con credenciales **ID** y **CLAVE** (no usuario/clave SOL).
3. Base de datos: tabla para guías (cabecera, detalle, relación con venta/comprobantes) si no existe; en configuración: `urlBaseApiGuias`, `idApiGuias`, `claveApiGuias`.
4. Frontend: **componente “Guías de remisión”**: alta de guía, selección de venta/comprobantes relacionados, datos de traslado y transportista; emisión y estado.

### Fase 5 – Guía transportista y credenciales

1. Si la empresa actúa como transportista: reutilizar endpoint de guías; en UBL y pantalla marcar modalidad “transportista” y completar datos exigidos.
2. Implementar tabla(s) de credenciales API SUNAT (Fase opcional previa o en paralelo): migrar lectura de usuario/clave/url para facturación desde `CredencialesApiSunat`; añadir credenciales/URL para guías sin duplicar lógica de certificado.

### Orden recomendado

- **Corto plazo:** Fase 1 (resumen diario y componente) y Fase 2 (NC/ND) impactan más el día a día.
- **Después:** Fase 3 (baja) y Fase 4 (guías).
- **Cuando haya uso de guías:** Fase 5 (transportista y, si se desea, tabla de credenciales por servicio).

---

## 7. Referencias

- Manual del programador SUNAT (RS 097-2012 y actualizaciones).
- [FE Primer - Servicios Web SUNAT](https://fe-primer.greenter.dev/docs/webservices/) (BillService, sendBill, sendSummary, getStatus, endpoints facturación vs guías).
- [FE Primer - Resumen diario](https://fe-primer.greenter.dev/docs/resumen_diario/).
- [FE Primer - Comunicación de baja](https://fe-primer.greenter.dev/docs/baja).
- Plan interno: `docs/PLAN_ENVIO_DIRECTO_SUNAT.md`, `docs/GUIA_ENVIO_DIRECTO_SUNAT_PASO_A_PASO.md`.
- Catálogos: Anexos técnicos SUNAT (tipo comprobante 01, motivo NC 09, motivo baja, guías).

---

*Documento generado a partir de la revisión del código y de la documentación SUNAT y FE Primer. Verificar siempre en la web oficial de SUNAT y en el manual del programador vigente.*
