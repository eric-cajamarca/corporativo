-- =============================================================================
-- Ejecutar TODAS las migraciones desde SQL Server Management Studio (SQLCMD)
-- =============================================================================
-- 1) Consulta > Opciones de consulta de SQL > activar "Modo SQLCMD".
-- 2) En el desplegable de bases de datos, elige la BD destino (las migraciones
--    suelen asumir que ya estás conectado a esa base).
-- 3) Si tu carpeta no es la de abajo, buscar/reemplazar UNA vez esta ruta:
--    C:\EFAF2026\backAppC\migraciones nuevas
-- =============================================================================

:r "C:\EFAF2026\backAppC\migraciones nuevas\20260324_modo_envio_sunat.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\20260325_cotizacion_agrupada_gestora.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\20260406_descuento_config_descripcion_linea.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\20260406_nota_credito_f7_b7.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\add_comunicaciones_baja_xml_enviado.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\add_empresa_admin_requiere_2fa.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\add_estado_baja_aceptada.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\add_guias_emitidas_datos_json.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\add_guias_emitidas_xml_firmado.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\add_movimientos_inventario_grupo_tipo.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\add_ruc_api_guias.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\add_totp_2fa_admin.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\alter_seguridad_login_intento_ip.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\create_auditoria_y_refresh_token.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\create_guias_electronicas_emitidas.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\create_seguridad_login_intento.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\fix_comprobante_baja_aceptada.sql"
:r "C:\EFAF2026\backAppC\migraciones nuevas\insert_comprobante_tf_empresas_existentes.sql"
