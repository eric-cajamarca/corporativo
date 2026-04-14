/*
  Si 02_eliminar_tres_empresas_TRAN.sql falla con error de FK, ejecuta esta consulta
  para ver qué tablas referencian dbo.Empresas y si la eliminación es CASCADE o NO ACTION.
*/

SELECT
    OBJECT_SCHEMA_NAME(f.parent_object_id) AS esquema_tabla_hijo,
    OBJECT_NAME(f.parent_object_id)        AS tabla_hijo,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS columna,
    f.name AS nombre_fk,
    CASE f.delete_referential_action
        WHEN 0 THEN 'NO ACTION'
        WHEN 1 THEN 'CASCADE'
        WHEN 2 THEN 'SET NULL'
        WHEN 3 THEN 'SET DEFAULT'
    END AS al_borrar_en_padre
FROM sys.foreign_keys AS f
INNER JOIN sys.foreign_key_columns AS fc
    ON f.object_id = fc.constraint_object_id
WHERE f.referenced_object_id = OBJECT_ID('dbo.Empresas')
ORDER BY tabla_hijo, nombre_fk;
