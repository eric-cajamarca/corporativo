/** Aplica un proveedor elegido al contexto de registro/edición de compras. */
export function aplicarProveedorEnCompra(
  proveedor: Record<string, unknown> | null | undefined
): { proveedores: Record<string, unknown>; ruc: string; idProveedor: string | number; idDocumento: string | number; rSocial: string } | null {
  if (!proveedor) return null;
  const idProveedor = proveedor['idProveedor'] ?? proveedor['IdProveedor'];
  if (idProveedor == null || idProveedor === '') return null;
  const rSocial = String(
    proveedor['rSocial'] ?? proveedor['RSocial'] ?? proveedor['razonSocial'] ?? ''
  ).trim();
  return {
    proveedores: { ...proveedor },
    ruc: String(proveedor['ruc'] ?? proveedor['Ruc'] ?? '').trim(),
    idProveedor: idProveedor as string | number,
    idDocumento: (proveedor['idDocumento'] ?? proveedor['IdDocumento'] ?? '') as string | number,
    rSocial
  };
}
