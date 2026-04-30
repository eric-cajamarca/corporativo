# Migraciones — actualizaciones

Solo para el **escenario de actualización**: cada versión publicada tiene una subcarpeta con los scripts **nuevos** de esa entrega.

## Estructura

```text
deploy/sql/migrations/
  1.2.0/
    010_descripcion.sql
    020_otra_migracion.sql
  1.3.0/
    ...
```

- El nombre de la carpeta debe coincidir con el parámetro **`-Version`** de `build-update.ps1` (ej. `1.2.0`).
- Orden de ejecución en el servidor: por **nombre de archivo** (por eso el prefijo numérico).
- No duplicar en carpetas viejas scripts ya aplicados en producción; cada versión contiene **solo lo agregado** desde la versión anterior.
