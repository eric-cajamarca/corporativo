# Plantillas JSON - Facturación electrónica SUNAT

Plantillas para generar los JSON de cada comprobante, rellenando datos desde la base de datos y la empresa que lo solicite. Los archivos se guardan de forma local según el [Instructivo del Facturador SUNAT](otros/Facturador%20Sunat%20-%20Instructivo.pdf).

## Estructura de carpetas del Facturador

La ruta configurada en **Configuración > Facturación > Carpeta del Facturador SUNAT** es la carpeta **padre** (ej: `D:\SFS_v1.2` o `C:\Emp_A`). El sistema mantiene la estructura:

- `[ruta]\sunat_archivos\sfs\DATA\` — Aquí se escriben los archivos `.json` (y opcionalmente `.xml`, `.txt`) para que el Facturador los liste y procese.

Otras carpetas que usa el Facturador (no las escribe este sistema):

- `sunat_archivos\sfs\Firma` — XML generados y firmados pendientes de envío
- `sunat_archivos\sfs\ENVIO` — Comprobantes enviados y aceptados (ZIP)
- `sunat_archivos\sfs\RPTA` — CDR de SUNAT

## Nomenclatura de archivos

| Tipo              | Código | Ejemplo nombre archivo        |
|-------------------|--------|------------------------------|
| Factura           | 01     | `20100066603-01-F001-1.json` |
| Boleta            | 03     | `20100066603-03-B001-1.json` |
| Nota de crédito   | 07     | `20100066603-07-FC01-1.json` |
| Nota de débito    | 08     | `20100066603-08-FD01-1.json` |
| Resumen diario    | RC     | `20100066603-RC-20250215-1.json` |
| Comunicación baja | RA     | `20100066603-RA-20250215-1.json` |

Formato: `[RUC]-[TT]-[SERIE]-[NUMERO].json` (para RC/RA: `[RUC]-[TT]-[YYYYMMDD]-[CORREL].json`).

## Plantillas incluidas

- **factura.json** — Factura electrónica (01)
- **boleta.json** — Boleta de venta (03)
- **nota-credito.json** — Nota de crédito (07), con documento de referencia
- **nota-debito.json** — Nota de débito (08), con documento de referencia
- **resumen-diario.json** — Resumen diario (RC), envío por `sendSummary`
- **comunicacion-baja.json** — Comunicación de baja (RA), envío por `sendSummary`

## Uso en el servidor

1. Obtener la configuración de facturación de la empresa (`rutaCarpetaFacturadorSunat`).
2. Cargar la plantilla correspondiente al tipo de comprobante.
3. Rellenar con datos de venta, cliente y empresa desde la BD.
4. Escribir el JSON en `[rutaCarpetaFacturadorSunat]/sunat_archivos/sfs/DATA/[nombre].json`.

La utilidad `facturadorSunat.util.js` expone la función para obtener la ruta DATA y escribir el archivo.
