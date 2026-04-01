RESPALDO - Scripts de base de datos SistemaInventario
=====================================================

Contenido:
- base_datos_mejorada.sql   Esquema unificado (2026-03): incluye lo que antes estaba en
  migrations_backAppC y migrations_sjb (Factiliza, ProductosImagen, Gastos, columnas extra, etc.).
- instalar_base_completa.sql   Crea la base (sqlcmd) y ejecuta solo base_datos_mejorada.sql.
- generar_estructura_bd.ps1   PowerShell para exportar solo la estructura (schema) de la BD a un .sql.

Nota: Las migraciones incrementales sueltas del backend continúan en backAppC/migrations/
para bases que ya existían antes del unificado.

CÓMO GENERAR UN ARCHIVO CON TODA LA ESTRUCTURA DE LA BD (schema real, con referencias)
--------------------------------------------------------------------------------------
Tienes la base ya creada y quieres un único .sql con tablas, índices, FK, defaults, etc. (sin datos).

Método 1 - SSMS (recomendado, más fiable):
  1. Abrir SQL Server Management Studio y conectar al servidor donde está la base.
  2. En el Explorador de objetos: clic derecho en la base de datos (ej. SistemaInventario) > Tasks > Generate Scripts...
  3. Introduction: Next.
  4. Choose Objects: marcar "Script entire database and all database objects" (o elegir solo tablas si quieres). Next.
  5. Set Scripting Options:
     - Click "Advanced".
     - Types of data to script: "Schema only" (importante: solo estructura, sin datos).
     - Script Indexes: True.
     - Script Primary Keys, Foreign Keys, etc.: según quieras (recomendado True).
     - Generar a archivo: elegir ruta, ej. respaldo\estructura_bd_completa.sql.
  6. Next > Next > Finish. Se generará el archivo con toda la estructura.

Método 2 - PowerShell (generar_estructura_bd.ps1):
  Requiere tener instalado SSMS o el SDK de SQL Server (para SMO). Ejecutar desde la carpeta respaldo:

  cd c:\EFAF2026\respaldo
  .\generar_estructura_bd.ps1 -ServerInstance "." -Database "SistemaInventario" -OutputFile "estructura_bd_completa.sql"

  Si usas autenticación SQL (usuario/contraseña):
  .\generar_estructura_bd.ps1 -ServerInstance "localhost" -Database "SistemaInventario" -UseWindowsAuth:$false -User "sa" -Password "tuPassword"

  El archivo se crea en la misma carpeta respaldo.

Método 3 - mssql-scripter (línea de comandos, opcional):
  pip install mssql-scripter
  mssql-scripter -S localhost -d SistemaInventario -f estructura_bd_completa.sql --schema-only -U usuario -P contraseña

CÓMO REGENERAR LA BASE DESDE CERO
---------------------------------
1. En SQL Server Management Studio: eliminar la base de datos SistemaInventario si existe.
2. Activar modo sqlcmd: en SSMS, menú Query > SQLCMD Mode.
3. Abrir instalar_base_completa.sql desde ESTA carpeta (respaldo).
4. Asegurarse de que el "working directory" sea la carpeta respaldo (File > Open y abrir desde aquí, o ejecutar desde cmd en esta carpeta).
5. Ejecutar instalar_base_completa.sql.

Desde línea de comandos (ejecutar desde la carpeta respaldo):
  sqlcmd -S . -E -i instalar_base_completa.sql

Opcional: después ejecutar datos_iniciales.sql y datos_adicionales.sql desde Query\sjb si los utiliza.
