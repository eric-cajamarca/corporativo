# Guía paso a paso: Envío directo a SUNAT

Esta guía explica cómo configurar y usar el **envío directo** de comprobantes electrónicos a SUNAT (sin usar el Facturador SFS). El sistema mantiene el **Facturador con archivos planos** como respaldo.

---

## Paso 1: Ejecutar la migración en la base de datos

En SQL Server, ejecute el script que agrega la opción de envío directo:

```sql
-- Archivo: Query/migration_envio_directo_sunat.sql
-- Agrega la columna envioDirectoSunat a ConfiguracionFacturacionElectronica
```

Contenido del script (si no lo tiene a mano):

```sql
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('ConfiguracionFacturacionElectronica') AND name = 'envioDirectoSunat'
)
BEGIN
  ALTER TABLE ConfiguracionFacturacionElectronica
  ADD envioDirectoSunat BIT NOT NULL DEFAULT 0;
END
GO
```

---

## Paso 2: Obtener usuario secundario y su contraseña

Para el envío directo a SUNAT se usa el **usuario secundario** y la **contraseña del usuario secundario** (no la Clave SOL del titular).

1. Ingrese al **Portal SUNAT** (SOL) con su RUC y Clave SOL del titular.
2. Cree un **usuario secundario** solo para facturación electrónica (recomendado).
3. Anote:
   - **Usuario secundario**: por ejemplo `MODDATOS` (o el nombre que haya dado al usuario secundario).
   - **Contraseña del usuario secundario**: la contraseña de ese usuario secundario.
4. El **Usuario SOAP** que usará el sistema será: **RUC + Usuario secundario** (ej: `20123456789MODDATOS`).  
   Puede guardar solo el usuario secundario (ej: `MODDATOS`) y el sistema armará RUC+Usuario automáticamente, o guardar el valor completo.

**Nota:** La activación del usuario secundario puede tardar hasta 24 horas.

---

## Paso 3: Tener el certificado digital (.pfx) y su clave

- Necesita el archivo **.pfx** del certificado digital con el que se firmarán los XML.
- Y la **clave (contraseña)** de ese certificado.
- Debe subirlo en la misma configuración de Facturación (bloque “Certificado digital para firma de XML”).

Sin certificado y clave no se puede usar envío directo (el XML debe ir firmado).

---

## Paso 4: Configurar en la aplicación (Configuración > Facturación)

1. Vaya a **Configuración** y abra la pestaña **Facturación**.
2. **Certificado:**  
   Suba el archivo **.pfx** y la **clave del certificado** en el bloque “Certificado digital para firma de XML” y pulse **Subir certificado**.
3. **Envío directo a SUNAT:**  
   - Marque **“Usar envío directo (SOAP BillService)”**.
   - **URL BillService SUNAT:**  
     - Pruebas (BETA): `https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService`  
     - Producción: `https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService`
   - **Usuario secundario:**  
     Escriba solo el usuario secundario (ej: `MODDATOS`) o el valor completo RUC+Usuario (ej: `20123456789MODDATOS`).
   - **Contraseña del usuario secundario:**  
     La contraseña del usuario secundario (no la Clave SOL del titular).
4. **Respaldo Facturador (opcional):**  
   Si más adelante desea volver a usar el Facturador, deje configurados **Carpeta del Facturador SUNAT** y **URL del Facturador SUNAT**. Así puede desmarcar “Usar envío directo” y seguir enviando por archivos planos.
5. Pulse **Guardar cambios**.

---

## Paso 5: Enviar un comprobante (manual)

1. En **Ventas** (o el módulo donde esté el historial de comprobantes), localice la venta/comprobante que quiera enviar a SUNAT.
2. Use el botón de envío a SUNAT (por ejemplo **“SUNAT”** o **“Enviar a SUNAT”**).
3. El sistema:
   - Generará el XML UBL 2.1.
   - Lo firmará con el certificado que subió.
   - Lo enviará directo al BillService de SUNAT (sin pasar por el Facturador).
4. Revisar el resultado (aceptado, rechazado, observaciones) en la pantalla o en el estado del comprobante.

---

## Paso 6: Envío por lotes (manual)

1. En **Configuración > Facturación**, en “Opciones de envío a SUNAT”, active **“Envío por lotes”** si lo desea.
2. Use el botón **“Enviar lote ahora (manual)”**.
3. Se enviarán todos los comprobantes pendientes de la empresa usando el mismo modo configurado (directo o Facturador).

---

## Paso 7: Envío automático (opcional)

1. En **Configuración > Facturación**, active **“Envío automático en segundo plano”** y el intervalo en minutos.
2. El job del backend enviará periódicamente los pendientes:
   - Si **envío directo** está activo: usará SOAP (BillService).
   - Si no: usará el Facturador con archivos planos (o UBL si en el futuro se habilita esa opción para este flujo).

---

## Volver a usar el Facturador (respaldo)

1. En **Configuración > Facturación**, **desmarque** “Usar envío directo (SOAP BillService)”.
2. Asegúrese de tener configurados **Carpeta del Facturador SUNAT** y **URL del Facturador SUNAT**.
3. Guarde los cambios.
4. Los siguientes envíos (manual, lote o automático) se harán de nuevo por el Facturador con **archivos planos** (y opcionalmente UBL si lo usa).

---

## Resumen de flujos

| Modo configurado        | Qué se usa                         | Requisitos                                                                 |
|-------------------------|------------------------------------|----------------------------------------------------------------------------|
| **Envío directo**       | SOAP BillService (envío directo)   | Certificado .pfx, clave cert., URL BillService, usuario secundario, contraseña usuario secundario |
| **Facturador (respaldo)**| Carpeta DATA + Facturador SFS     | Ruta carpeta Facturador, URL Facturador; opcional certificado para UBL   |

Si **envío directo** está activo y tiene URL + usuario secundario + contraseña del usuario secundario + certificado, siempre se usa el envío directo. En caso contrario (o si lo desactiva), se usa el Facturador con archivos planos como respaldo.

---

## Errores frecuentes

- **“Para envío directo a SUNAT debe subir el certificado digital y su clave”**  
  Suba el .pfx y la clave en Configuración > Facturación y vuelva a intentar.

- **“No se pudo conectar con SUNAT”**  
  Compruebe la URL del BillService (BETA o producción) y que el servidor tenga acceso a internet y a SUNAT.

- **Fault SOAP (ej. 0101 o mensaje de seguridad)**  
  Revise que el usuario secundario y su contraseña sean correctos y que el usuario esté activo (puede tardar hasta 24 h si es nuevo).

- **CDR rechazado (código 2xxx, 3xxx)**  
  Son rechazos de SUNAT por contenido del comprobante (datos, montos, formato). Revise la descripción en el CDR y ajuste el comprobante o los datos maestros.

---

*Documento de referencia para el envío directo a SUNAT. Ante cambios en portales o servicios de SUNAT, consulte la documentación oficial vigente.*
