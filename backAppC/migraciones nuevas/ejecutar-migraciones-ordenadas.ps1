<#
.SYNOPSIS
  Ejecuta en orden fijo todas las migraciones de esta carpeta y de .\nuevas\
  (mismo orden que instalar-migraciones-completas.sqlcmd.sql).

.DESCRIPTION
  Usa sqlcmd. No depende del orden alfabético de archivos. Útil en otra PC
  cuando prefieres consola a SSMS.

.EXAMPLE
  .\ejecutar-migraciones-ordenadas.ps1 -ServerInstance "SERVIDOR\INSTANCIA" -Database "MiERP"

.EXAMPLE
  .\ejecutar-migraciones-ordenadas.ps1 -ServerInstance "." -Database "MiERP" -SqlUser "sa" -SqlPassword "***" -TrustServerCertificate
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $ServerInstance,

  [Parameter(Mandatory = $true)]
  [string] $Database,

  [string] $SqlUser,
  [string] $SqlPassword,

  [switch] $TrustServerCertificate
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$sqlcmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if (-not $sqlcmd) {
  throw "No se encontró 'sqlcmd'. Instala las herramientas de línea de comandos de SQL Server."
}

$relativos = @(
  "20260324_modo_envio_sunat.sql",
  "20260325_cotizacion_agrupada_gestora.sql",
  "20260406_descuento_config_descripcion_linea.sql",
  "20260406_nota_credito_f7_b7.sql",
  "saas_planes_catalogo.sql",
  "saas_plan_modulos_y_factiliza.sql",
  "saas_empresa_suscripcion_checkout.sql",
  "saas_plan_comprobantes_sunat_cuota.sql",
  "saas_plan_demo_limites_1_usuario_1_sucursal.sql",
  "saas_plan_demo_sin_catalogos.sql",
  "saas_planes_reestructura_v2.sql",
  "saas_onboarding_operativo_fase4.sql",
  "nuevas\add_index_suscripcion_checkout_cliente_fcreacion.sql",
  "comprobantes_compra_sunat.sql",
  "comprobantes_compra_sunat_credito_cuotas.sql",
  "create_auditoria_y_refresh_token.sql",
  "create_seguridad_login_intento.sql",
  "alter_seguridad_login_intento_ip.sql",
  "create_guias_electronicas_emitidas.sql",
  "add_guias_emitidas_datos_json.sql",
  "add_guias_emitidas_xml_firmado.sql",
  "add_ruc_api_guias.sql",
  "add_movimientos_inventario_grupo_tipo.sql",
  "add_comunicaciones_baja_xml_enviado.sql",
  "add_estado_baja_aceptada.sql",
  "add_empresa_admin_requiere_2fa.sql",
  "add_totp_2fa_admin.sql",
  "fix_comprobante_baja_aceptada.sql",
  "create_inventario_fisico_sesion_linea.sql",
  "insert_comprobante_tf_empresas_existentes.sql",
  "insert_comprobante_gre31_transportista_empresas_existentes.sql",
  "nuevas\20260503_serie_comprobante_por_sucursal.sql"
)

$usarSqlAuth = -not [string]::IsNullOrWhiteSpace($SqlUser)

Write-Host "Raíz migraciones: $root"
Write-Host "Servidor: $ServerInstance | Base: $Database | Archivos: $($relativos.Count)`n"

foreach ($rel in $relativos) {
  $full = Join-Path -LiteralPath $root -ChildPath $rel
  if (-not (Test-Path -LiteralPath $full)) {
    throw "No existe el archivo: $full"
  }
  Write-Host ">>> $rel" -ForegroundColor Cyan

  $args = @(
    "-S", $ServerInstance,
    "-d", $Database,
    "-b",
    "-i", $full,
    "-I"
  )
  if ($TrustServerCertificate) { $args += "-C" }
  if ($usarSqlAuth) {
    if ([string]::IsNullOrWhiteSpace($SqlPassword)) {
      $secure = Read-Host "Contraseña para $SqlUser" -AsSecureString
      $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      $SqlPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    }
    $args += "-U", $SqlUser, "-P", $SqlPassword
  }
  else {
    $args += "-E"
  }

  & sqlcmd @args
  if ($LASTEXITCODE -ne 0) {
    throw "Falló: $rel (código $LASTEXITCODE)"
  }
  Write-Host "    OK`n" -ForegroundColor Green
}

Write-Host "Todas las migraciones terminaron correctamente." -ForegroundColor Green
