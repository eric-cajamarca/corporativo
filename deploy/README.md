# Deploy — primera instalación y actualización

Esta carpeta define la **estructura de empaquetado** y la documentación de **plantilla de BD** y **migraciones**.

Los generadores en **PowerShell** y **`.cmd`** están recogidos en [PAQUETES_Y_SCRIPTS.md](PAQUETES_Y_SCRIPTS.md) (bloques listos para copiar a `build-first-install.ps1`, `build-update.ps1` y los `.cmd` en la raíz de `deploy/`). Si tu entorno de edición permite crear `.ps1` directamente, copiá esos archivos desde ahí una sola vez.

## Requisitos

- Windows con **PowerShell 5.1+**
- **Node.js 20+** y **npm** en el `PATH`
- **Angular CLI** disponible para `adminSPA` (local: `npx ng build` si no está global)

## Plantilla de base de datos (solo primera instalación)

La copia de BD es una **plantilla** para estructura inicial:

- **Una sola empresa**, **sin productos** y **sin movimientos** (solo lo imprescindible para el primer arranque, p. ej. usuario admin), según definan en el proyecto.
- Archivos en `deploy/sql/database-template/` (p. ej. `Template.bacpac` o `Template.bak`); detalle en [sql/database-template/README.md](sql/database-template/README.md).

Las **actualizaciones** no incluyen una BD completa: **solo** los archivos `.sql` nuevos en `deploy/sql/migrations/<versión>/` (una carpeta por versión publicada).

## Escenario A — Primera instalación

Genera una carpeta bajo `deploy/out/` con:

- `app/backAppC`, `app/pdf-backend` (dependencias prod), `app/www` (build Angular prod)
- `sql/bootstrap` (scripts iniciales, si los agregás)
- `sql/database-template` (copia de los archivos de plantilla de BD)
- `manifest-first-install.json` y `BUILD_INFO.txt`

**Ejecutar desde la raíz del repo o desde `deploy/`:**

```bat
deploy\build-first-install.cmd
```

O con versión lógica del paquete:

```bat
deploy\build-first-install.cmd -Version 1.0.0
```

## Escenario B — Actualización

Genera `deploy/out/EFAF-app-<versión>.zip` con la app en prod y **solo** la carpeta de migraciones `sql/migrations/<versión>/` (debe existir y contener los `.sql` nuevos).

```bat
deploy\build-update.cmd -Version 1.2.0
```

Si la carpeta `deploy\sql\migrations\1.2.0` no existe o está vacía, el script falla con mensaje claro.

## Notas

- No se incluyen archivos `.env` con secretos; usá `backAppC/.env.example` como referencia en el destino.
- `deploy/out/` está en `.gitignore` (artefactos locales de build).
