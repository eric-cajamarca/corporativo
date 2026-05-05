-- =============================================================================
-- Instalar TODAS las migraciones (carpeta raíz + subcarpeta nuevas/)
-- =============================================================================
-- En la OTRA PC: copia toda la carpeta "migraciones nuevas" y ajusta SOLO la
-- variable MIGR_ROOT abajo (ruta absoluta donde quedó la carpeta).
--
-- Opción A — SSMS (rápido, una conexión a la BD destino):
--   Consulta > Opciones de consulta de SQL > activar "Modo SQLCMD".
--   Selecciona la base de datos destino en el desplegable y ejecuta (F5).
--
-- Opción B — sqlcmd desde consola (sin abrir SSMS):
--   sqlcmd -S TU_SERVIDOR -d TU_BASE_DATOS -E -I -i "RUTA\instalar-migraciones-completas.sqlcmd.sql"
--   (con login SQL: -U sa -P *** ; certificado autofirmado ODBC18: añade -C)
--
-- Orden: dependencias SaaS, compras SUNAT, seguridad/auditoría, guías, demás
-- alters, inventario físico, inserts de comprobantes, y al final serie por
-- sucursal (requiere filas Comprobantes compatibles con el backfill).
-- =============================================================================

:setvar MIGR_ROOT "C:\EFAF2026\backAppC\migraciones nuevas"

:r "$(MIGR_ROOT)\20260324_modo_envio_sunat.sql"
:r "$(MIGR_ROOT)\20260325_cotizacion_agrupada_gestora.sql"
:r "$(MIGR_ROOT)\20260406_descuento_config_descripcion_linea.sql"
:r "$(MIGR_ROOT)\20260406_nota_credito_f7_b7.sql"

:r "$(MIGR_ROOT)\saas_planes_catalogo.sql"
:r "$(MIGR_ROOT)\saas_plan_modulos_y_factiliza.sql"
:r "$(MIGR_ROOT)\saas_empresa_suscripcion_checkout.sql"
:r "$(MIGR_ROOT)\saas_plan_comprobantes_sunat_cuota.sql"
:r "$(MIGR_ROOT)\saas_plan_demo_limites_1_usuario_1_sucursal.sql"
:r "$(MIGR_ROOT)\saas_plan_demo_sin_catalogos.sql"
:r "$(MIGR_ROOT)\saas_onboarding_operativo_fase4.sql"

:r "$(MIGR_ROOT)\nuevas\add_index_suscripcion_checkout_cliente_fcreacion.sql"

:r "$(MIGR_ROOT)\comprobantes_compra_sunat.sql"
:r "$(MIGR_ROOT)\comprobantes_compra_sunat_credito_cuotas.sql"

:r "$(MIGR_ROOT)\create_auditoria_y_refresh_token.sql"
:r "$(MIGR_ROOT)\create_seguridad_login_intento.sql"
:r "$(MIGR_ROOT)\alter_seguridad_login_intento_ip.sql"

:r "$(MIGR_ROOT)\create_guias_electronicas_emitidas.sql"
:r "$(MIGR_ROOT)\add_guias_emitidas_datos_json.sql"
:r "$(MIGR_ROOT)\add_guias_emitidas_xml_firmado.sql"
:r "$(MIGR_ROOT)\add_ruc_api_guias.sql"

:r "$(MIGR_ROOT)\add_movimientos_inventario_grupo_tipo.sql"
:r "$(MIGR_ROOT)\add_comunicaciones_baja_xml_enviado.sql"
:r "$(MIGR_ROOT)\add_estado_baja_aceptada.sql"
:r "$(MIGR_ROOT)\add_empresa_admin_requiere_2fa.sql"
:r "$(MIGR_ROOT)\add_totp_2fa_admin.sql"
:r "$(MIGR_ROOT)\fix_comprobante_baja_aceptada.sql"

:r "$(MIGR_ROOT)\create_inventario_fisico_sesion_linea.sql"

:r "$(MIGR_ROOT)\insert_comprobante_tf_empresas_existentes.sql"
:r "$(MIGR_ROOT)\insert_comprobante_gre31_transportista_empresas_existentes.sql"

:r "$(MIGR_ROOT)\nuevas\20260503_serie_comprobante_por_sucursal.sql"

PRINT N'Migraciones completas: ejecución del maestro finalizada (revisar mensajes anteriores por errores).';
GO
