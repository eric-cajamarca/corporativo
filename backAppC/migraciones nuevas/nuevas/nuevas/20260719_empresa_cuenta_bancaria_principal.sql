/*
  OBSOLETO / NO EJECUTAR para cobro SaaS.

  El checkout de suscripción lee dbo.CuentasBancarias de la empresa con
  Empresas.esPrincipal = 1 (cuentas con estado = 1).

  No se agregan columnas de cuenta en Empresas.
  Si ya ejecutó una versión anterior de este script que añadió
  cuentaBancariaTitular / cuentaBancariaBanco / etc., puede ignorarlas
  o eliminarlas manualmente; el código ya no las usa.
*/
