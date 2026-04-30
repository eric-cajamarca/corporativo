# SQL bootstrap — primera instalación

Scripts opcionales ejecutados **una sola vez** al instalar (creación de BD desde cero, permisos, datos mínimos), si no usás solo restore de `.bacpac` / `.bak`.

Convención sugerida: prefijo numérico para orden, por ejemplo:

- `001_create_login_and_db.sql` (si aplica)
- `002_schema.sql`
- `003_seed_minimo.sql`

El instalador o `build-first-install.ps1` documenta el orden; este repositorio no impone un motor de migraciones para bootstrap salvo que lo agreguéis aquí.
