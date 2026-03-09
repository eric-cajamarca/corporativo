# Error 0100 SUNAT: "El sistema no puede responder su solicitud"

Código de excepción SOAP: `Client.0100` (o similar). Mensaje típico: *"El sistema no puede responder su solicitud. Intente nuevamente o comuníquese con su Administrador"*.

Es un **error genérico** de SUNAT. Puede ser temporal (servidor sobrecargado) o indicar un problema en la petición que SUNAT no detalla con un código más específico.

---

## Causas habituales y qué revisar

### 1. **URL de envío (beta vs producción)**

- **Problema:** Usar la URL de **producción** con credenciales de **prueba (beta)** o al revés.
- **Solución:**
  - **Modo prueba:** URL = `https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService`
  - **Producción:** URL = `https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService`
- En la app: en **Configuración > Facturación**, active **Modo prueba** si usa certificado y clave SOL de ambiente beta. Si deja **URL de envío** vacía, el sistema usa la URL correcta según **Modo prueba** (sí/no).

### 2. **Credenciales SOL (usuario y clave)**

- **Problema:** Usuario secundario o clave SOL incorrectos, o clave SOL de otro ambiente.
- **Solución:**
  - Usuario SOAP = **RUC + usuario secundario** (ej. `20123456789MODDATOS`). En la app, si pone solo el usuario secundario (ej. `MODDATOS`), se concatena el RUC automáticamente.
  - Clave = **clave del usuario secundario SOL** (no la del certificado .pfx).
  - Probar en **Configuración > Facturación** el botón **Validar credenciales SOL** antes de enviar comprobantes.

### 3. **Certificado digital**

- **Problema:** Certificado vencido, no es del mismo RUC, o la firma del XML falla.
- **Solución:**
  - Certificado .pfx vigente y asociado al RUC que emite.
  - Clave del certificado correcta (y si se cambió `CERT_ENCRYPTION_KEY` en el servidor, volver a guardar certificado y clave en la configuración).
  - Validar certificado en **Configuración > Facturación** (validar credenciales).

### 4. **Formato del comprobante (XML UBL)**

- **Problema:** XML con estructura, nombres o catálogos que SUNAT no acepta y responde con 0100 en lugar de un rechazo con código.
- **Solución:**
  - Revisar que el XML generado cumpla UBL 2.1 Perú (Invoice, CustomizationID, catálogos SUNAT).
  - Nombre del archivo dentro del ZIP: `{RUC}-{TIPO}-{SERIE}-{NUMERO}.xml` (ej. `20123456789-03-B001-00000001.xml` para boleta).
  - Los XML enviados se guardan en `backAppC/xml_firmados_sunat/` y las respuestas de error en `backAppC/sunat_respuestas/*-error-400-soap.xml` para depuración.

### 5. **Disponibilidad de SUNAT**

- **Problema:** Caída o sobrecarga del servicio SUNAT.
- **Solución:** Reintentar el envío más tarde. El 0100 es una **excepción** (no rechazo definitivo); el documento puede reenviarse.

---

## Checklist rápido

| Revisión | Acción |
|----------|--------|
| Modo prueba | Coincide con certificado y clave SOL (beta ↔ modo prueba, producción ↔ modo producción). |
| URL de envío | Correcta para el ambiente o vacía para que se use la URL por defecto según modo prueba. |
| Usuario SOL | RUC + usuario secundario (ej. `MODDATOS`); en la app puede ir solo el sufijo. |
| Clave SOL | La del usuario secundario; probar con "Validar credenciales SOL". |
| Certificado | .pfx vigente, mismo RUC; clave del .pfx correcta. |
| Reintento | Si todo está bien configurado, volver a enviar; puede ser fallo temporal de SUNAT. |

---

## Respuestas guardadas para depuración

Cuando SUNAT devuelve HTTP 4xx/5xx, el backend guarda el XML de la respuesta en:

- `backAppC/sunat_respuestas/{nombreBase}-error-{status}-soap.xml`

Ahí puede verse el `<faultcode>` y `<faultstring>` completos por si SUNAT envía un detalle adicional.
