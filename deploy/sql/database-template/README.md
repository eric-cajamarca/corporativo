# Plantilla de base de datos — primera instalación

## Qué debe contener

- **Una sola empresa** en el sistema.
- **Sin productos** y **sin movimientos** (inventario/ventas/compras en cero o ausentes).
- Objetivo: **estructura** lista para la primera ejecución + lo mínimo para poder entrar (p. ej. usuario administrador), según definan en su proyecto.

## Archivos

Colocar aquí **uno** o ambos formatos según su proceso de instalación:

| Archivo | Uso típico |
|---------|------------|
| `Template.bacpac` | Import con `SqlPackage.exe /Action:Import` |
| `Template.bak` | `RESTORE DATABASE` con `MOVE` a rutas del servidor |

**No** versionar contraseñas reales ni datos productivos de clientes.

El script `build-first-install.ps1` **copia** esta carpeta tal cual al paquete de salida (`sql/database-template/`).
