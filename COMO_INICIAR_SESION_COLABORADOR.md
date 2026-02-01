# Cómo iniciar sesión como colaborador

## Cambios realizados

El login ahora permite **dos formas** de acceso con el mismo formulario (RUC + email + contraseña):

1. **Login como colaborador**: RUC de la empresa + **tu email de colaborador** + **tu contraseña de colaborador**  
   → Si existe un usuario en **UsuarioWeb** con ese email y esa empresa, se valida tu contraseña y entras con tu rol (Administrador, Vendedor, etc.).

2. **Login como empresa**: RUC + **correo de la empresa** + **contraseña de la empresa**  
   → Si el email coincide con el correo registrado de la empresa, se valida la contraseña de la empresa y entras como administrador del sistema.

## Cómo iniciar sesión en la aplicación

1. Abre el login: **http://localhost:2400/login-empresa** (o la URL donde corra tu Angular).

2. **Paso 1 – Empresa**  
   - RUC de la empresa: **20614636930**  
   - Clic en **Continuar** (o Enter).

3. **Paso 2 – Usuario**  
   - Correo: **valentidiaz@gmail.com**  
   - Clic en **Continuar** (o Enter).

4. **Paso 3 – Acceso**  
   - Contraseña: **123456789**  
   - Opcional: marcar **Recordar empresa**.  
   - Clic en **Acceder al Sistema**.

Si todo es correcto, entrarás al panel con tu usuario colaborador.

## Prueba realizada con tus credenciales

Se ejecutó el script `node test_login.js` contra el backend con:

- RUC: **20614636930**
- Email: **valentidiaz@gmail.com**
- Contraseña: **123456789**

Resultado: **401 – "El email no existe o no tiene permisos para acceder"**.

Eso significa que el backend **sí encontró la empresa** por RUC, pero **no encontró un colaborador** con ese email en esa empresa. Por tanto, intentó login como empresa (correo de la empresa) y al no coincidir el email mostró ese mensaje.

## Qué debes revisar para que funcione

Para poder iniciar sesión como **valentidiaz@gmail.com** en la empresa con RUC **20614636930**:

1. **Que el colaborador exista en la base de datos**  
   Debe haber un registro en **UsuarioWeb** con:
   - `idEmpresa` = id de la empresa con RUC 20614636930  
   - `email` = `valentidiaz@gmail.com`  
   - `estado` = 1 (activo)

2. **Que la contraseña sea la correcta**  
   En la BD se guarda el hash (bcrypt) de la contraseña. La que ingresas al crear/editar el colaborador es la que debes usar para entrar (por ejemplo **123456789** si así la definiste).

3. **Crear el colaborador si no existe**  
   - Un administrador debe entrar primero con el **correo y contraseña de la empresa** (no con tu email).  
   - En el panel, ir a Colaboradores y **crear un nuevo colaborador** con:
     - Email: **valentidiaz@gmail.com**
     - Contraseña: **123456789** (o la que quieras usar)
     - Rol: por ejemplo Administrador  
   - Guardar. A partir de ahí podrás iniciar sesión con RUC + valentidiaz@gmail.com + esa contraseña.

## Consulta rápida en SQL Server

Para comprobar si el colaborador existe en esa empresa:

```sql
-- Reemplaza @RUC por '20614636930'
DECLARE @idEmpresa UNIQUEIDENTIFIER;
SELECT @idEmpresa = idEmpresa FROM Empresas WHERE ruc = '20614636930' AND estado = 1;

SELECT UW.idUsuario, UW.nombres, UW.apellidos, UW.email, UW.estado, R.descripcion AS rol
FROM UsuarioWeb UW
INNER JOIN Rol R ON R.idRol = UW.idRol
WHERE UW.idEmpresa = @idEmpresa
  AND UW.email = 'valentidiaz@gmail.com';
```

- Si no devuelve filas: el colaborador no está creado; créalo desde el panel (como en el punto 3).
- Si devuelve una fila con `estado = 0`: el usuario está deshabilitado; un admin debe activarlo.

## Resumen

- **Inicio de sesión como colaborador**: mismo formulario, mismo flujo de 3 pasos; solo cambia que usas **tu email y tu contraseña de colaborador**.
- **Backend**: se modificó `auth.service.js` para intentar primero login como colaborador (UsuarioWeb) y, si no aplica, login como empresa.
- Para que **valentidiaz@gmail.com** + **123456789** funcione con RUC **20614636930**, debe existir ese colaborador en esa empresa y la contraseña en BD debe ser la hash de **123456789**. Si el script de prueba sigue fallando, revisa la consulta SQL anterior y la creación del usuario en el panel.
