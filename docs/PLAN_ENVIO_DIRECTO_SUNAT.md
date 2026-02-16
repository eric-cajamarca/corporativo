# Plan: Envío directo de comprobantes a SUNAT (sin Facturador)

Documento basado en la documentación oficial y en referencias como el [Manual de Servicios REST SUNAT](https://orientacion.sunat.gob.pe/10-manual-de-servicios-rest), [Greenter FE Primer - Servicios Web](https://fe-primer.greenter.dev/docs/webservices) y especificaciones del receptor de comprobantes electrónicos.

---

## 1. ¿Qué implica enviar directo a SUNAT?

SUNAT expone **servicios SOAP** para recibir comprobantes. Tu sistema se conecta a esos servicios con el **usuario secundario** y la **contraseña del usuario secundario** (no la Clave SOL del titular), envía el XML firmado (empaquetado en ZIP en base64) y recibe la respuesta (CDR en base64).

- **No se usa** el Facturador SFS (ni carpetas DATA/Firma/RPTA ni su API HTTP).
- **Sí se usa** el certificado digital para firmar el XML (el que ya tienes en `certificadoDigital` / `claveCertificado`).
- **Sí se necesitan** usuario secundario y contraseña del usuario secundario (campos `usuarioSunat` y `claveSunat` en `ConfiguracionFacturacionElectronica`).

---

## 2. Requisitos técnicos (resumen)

| Requisito | Descripción |
|-----------|-------------|
| **Certificado digital** | PFX para firmar el XML (ya lo tienes en la app). |
| **Usuario secundario** | Usuario secundario creado en SUNAT para facturación (puede tardar hasta 24 h en activarse). No es la Clave SOL del titular. |
| **Contraseña usuario secundario** | Contraseña del usuario secundario. |
| **Usuario SOAP** | Formato: `RUC` + `Usuario secundario` (ej: `20123456789MODDATOS`). |
| **Clave SOAP** | La contraseña del usuario secundario. |
| **XML UBL 2.1** | Factura/Boleta/Notas según catálogos SUNAT (ya lo generas). |
| **Nombre de archivo** | `{RUC}-{TIPO}-{SERIE}-{CORRELATIVO}.xml` (ej: `20123456789-03-B001-9.xml`). |
| **Envío** | El XML (firmado) se comprime en **ZIP** (mismo nombre, solo extensión .zip) y se envía en **base64** en la trama SOAP. |

---

## 3. Servicios SUNAT relevantes

### 3.1 BillService (envío de comprobantes)

- **sendBill**: Envía comprobantes (Factura 01, Boleta 03, Notas 07/08, etc.).
- **sendSummary**: Resumen diario, comunicaciones de baja, reversiones.
- **getStatus**: Estado de envíos de resúmenes/bajas/reversiones.

**Endpoints (ejemplos):**

| Ambiente | Facturas, Boletas, Notas |
|---------|---------------------------|
| **BETA (pruebas)** | `https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService` |
| **Producción**     | `https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService` |

(WSDL: añadir `?wsdl` a la URL.)

### 3.2 BillConsultService (solo producción)

- **getStatusCdr**: Obtener el CDR de un comprobante ya procesado.
- **getStatus**: Consultar estado de un comprobante enviado.

Solo aplica a facturas y notas de crédito/débito relacionadas; no reemplaza la respuesta inmediata del `sendBill`.

---

## 4. Flujo técnico de envío directo

1. **Generar** el XML UBL 2.1 (como hoy con `generadorXmlUblSunat.service.js`).
2. **Firmar** el XML con el certificado (como hoy con `firmaXmlSunat.service.js`).
3. **Nombrar** el archivo: `{RUC}-{TIPO}-{SERIE}-{CORRELATIVO}.xml`.
4. **Comprimir** en ZIP un solo archivo: `{mismoNombre}.zip`.
5. **Codificar** el ZIP en base64.
6. **Armar** la petición SOAP de `sendBill` con:
   - Cabecera de seguridad: usuario SOAP = RUC+Usuario secundario, clave SOAP = contraseña del usuario secundario.
   - Nombre del archivo: `{RUC}-{TIPO}-{SERIE}-{CORRELATIVO}.zip`.
   - Contenido: base64 del ZIP.
7. **Enviar** POST al endpoint del BillService (Content-Type: text/xml).
8. **Recibir** respuesta SOAP (base64 del ZIP de respuesta).
9. **Decodificar** el ZIP, extraer el XML del CDR (ej: `R-{RUC}-{TIPO}-{SERIE}-{CORRELATIVO}.xml`).
10. **Interpretar** `cbc:ResponseCode` (0 = aceptado, 2xxx–3xxx = rechazado, etc.) y actualizar `ComprobantesElectronicos` / `Ventas` (idEstadoSunat, CDR, etc.).

---

## 5. Plan de implementación sugerido

### Fase 1: Preparación

1. **Usuario secundario**
   - Crear usuario secundario en el portal SUNAT (solo facturación electrónica) y esperar activación (hasta 24 h).
   - Definir en configuración: “Usuario secundario” (ej: `MODDATOS`) y "Contraseña del usuario secundario". El usuario SOAP será `RUC + Usuario secundario`. No se usa la Clave SOL del titular.

2. **Configuración en BD**
   - Usar `usuarioSunat` como **usuario secundario** (solo el sufijo, ej: `MODDATOS`) o como usuario SOAP completo (`RUC+UsuarioSecundario`).
   - Usar `claveSunat` como **contraseña del usuario secundario**.
   - Añadir en configuración (o reutilizar si existe) un campo para **URL de envío directo** (o modo “directo” vs “facturador”): por ejemplo `urlEnvio` para el endpoint del BillService (BETA o producción).

3. **Documentación oficial**
   - Descargar [Manual de Servicios Rest](https://orientacion.sunat.gob.pe/sites/default/files/inline-files/10_Manual%20de%20servicios%20Rest.pdf) y anexos de especificaciones del receptor (Anexo 01 y 02) para validaciones y formatos exactos.

### Fase 2: Backend

4. **Servicio SOAP SUNAT**
   - Crear un módulo (ej: `backAppC/services/envioDirectoSunat.service.js`) que:
     - Reciba: XML firmado (string), nombre de archivo (ej: `20614636930-03-B001-9`), usuario SOAP, clave SOAP, URL del BillService (BETA/producción).
     - Arme el ZIP con un solo archivo `{nombre}.xml`, convierta a base64.
     - Construya la petición SOAP de `sendBill` (con cabecera de seguridad y cuerpo con nombre del zip + base64).
     - Use `axios` o `soap` (npm) para POST al endpoint.
     - Parsee la respuesta SOAP, decodifique el base64 del ZIP de respuesta, extraiga el CDR y devuelva `{ ok, codigoRespuesta, descripcionRespuesta, cdr, idEstadoSunat }`.

5. **Integración en el flujo de envío**
   - En el repositorio/servicio de facturación, según configuración (ej: “envío directo” activo y `usuarioSunat`/`claveSunat` y `urlEnvio` configurados):
     - Generar UBL y firmar (como hoy).
     - En lugar de llamar al Facturador (escribir en Firma y llamar a su API), llamar al nuevo servicio de envío directo.
   - Mantener el flujo actual por Facturador como opción (configuración “usar Facturador” vs “envío directo”).

6. **Mapeo de respuesta y persistencia**
   - Mapear `ResponseCode` del CDR a `idEstadoSunat` (como ya haces con el CDR del Facturador).
   - Guardar el CDR en `ComprobantesElectronicos` y actualizar estado en venta/comprobante.

### Fase 3: Pruebas y producción

7. **Pruebas en BETA**
   - Usar endpoint BETA del BillService y usuario secundario de pruebas.
   - Probar con una boleta/factura de prueba hasta recibir CDR correcto.

8. **Producción**
   - Cambiar a endpoint de producción y credenciales de producción.
   - Opcional: implementar consulta con BillConsultService (solo producción) para recuperar CDR si en algún caso no se recibe en la respuesta inmediata.

---

## 6. ¿Es recomendable o no?

### Ventajas del envío directo

- **Control total**: no dependes del Facturador ni de sus actualizaciones.
- **Menos componentes**: no necesitas instalar/mantener el SFS ni sus carpetas.
- **Respuesta inmediata**: el CDR suele venir en la misma respuesta SOAP (salvo casos que requieran BillConsultService).
- **Coste**: solo necesitas certificado y usuario secundario; no licencias de facturador de terceros (si aplica).

### Desventajas / riesgos

- **Mantenimiento**: cualquier cambio en endpoints, WSDL o reglas de SUNAT lo asumes tú (actualizar SOAP, validaciones, reintentos).
- **Seguridad**: debes custodiar bien la contraseña del usuario secundario y el certificado (tu app ya los usa; en directo son críticos para producción).
- **Reintentos y errores**: debes definir política de reintentos, timeouts y manejo de caídas de SUNAT.
- **Resúmenes y bajas**: si más adelante quieres resumen diario, comunicaciones de baja o reversiones, hay que implementar `sendSummary` y `getStatus` con la misma disciplina.

### Cuándo suele recomendarse

- **Recomendable** si tienes equipo técnico que pueda mantener la integración SOAP y quieres independencia del Facturador.
- **Menos recomendable** si prefieres que un tercero (Facturador) asuma cambios de SUNAT y disponibilidad del servicio, y no quieres mantener código SOAP ni credenciales sensibles en tu backend.

### Recomendación práctica

- **Corto plazo**: Mantener el flujo actual con Facturador y dejarlo estable (incluido el modo “XML ya firmado” si el Facturador lo soporta).
- **Mediano plazo**: Implementar envío directo en paralelo (modo configurable por empresa o global). Así puedes probar en BETA y, si te convence, usar directo en producción y conservar el Facturador como respaldo o para clientes que lo prefieran.

---

## 7. Referencias

- [Manual de Servicios Rest SUNAT (PDF)](https://orientacion.sunat.gob.pe/sites/default/files/inline-files/10_Manual%20de%20servicios%20Rest.pdf)
- [Greenter - Servicios Web de SUNAT](https://fe-primer.greenter.dev/docs/webservices)
- [Orientación SUNAT - Manual Servicios REST](https://orientacion.sunat.gob.pe/10-manual-de-servicios-rest)
- Catálogos SUNAT (tipos de documento, tributos, etc.) para validar UBL según especificaciones del receptor.

---

*Documento elaborado como plan de implementación; las URLs y detalles de SUNAT pueden cambiar. Verificar siempre en la web oficial de SUNAT y en el manual del programador vigente.*
