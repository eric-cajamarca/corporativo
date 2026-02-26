# Verificación post-migración Angular 19 → 20

## 1. Revisión de los pasos en tu máquina

### Opción A – PowerShell (recomendada)

1. Cierra Cursor/IDE y cualquier terminal que use el proyecto (o deja solo una).
2. Abre una terminal nueva y ve a la raíz del proyecto:
   ```powershell
   cd c:\project172026\adminSPA
   ```
3. Si `Remove-Item` falla por rutas largas en Windows, usa **cmd** solo para borrar:
   ```cmd
   cmd /c "rmdir /s /q node_modules"
   cmd /c "del package-lock.json"
   ```
   Luego en la misma PowerShell:
   ```powershell
   npm install
   ```
4. Build y tests:
   ```powershell
   npx ng build
   npx ng test
   ```

### Opción B – Solo reinstalar (sin borrar)

Si no puedes borrar `node_modules` (permisos o rutas largas):

1. Borra solo el lock para forzar resolución nueva:
   ```powershell
   del package-lock.json
   npm install
   ```
2. Si sigue fallando con "Invalid Version" o módulos faltantes, tendrás que borrar `node_modules` desde **cmd** (no PowerShell) o desde el Explorador de Windows.

### Si `ng test` falla por Jest

- En `setup-jest.ts` prueba:
  ```ts
  import 'jest-preset-angular/setup-jest.mjs';
  ```
- O revisa la documentación de tu versión de `jest-preset-angular` para el path correcto del setup.

---

## 2. Probar que backend y frontend funcionen

### Backend (Node/Express – puerto 3000)

1. En una terminal:
   ```powershell
   cd c:\project172026\backAppC
   npm install
   npm start
   ```
2. Debe aparecer algo como: `Servidor escuchando en el puerto 3000`.
3. Comprueba el health:
   - Navegador: `http://localhost:3000/health`
   - O en otra terminal: `curl http://localhost:3000/health`
   - Debe responder JSON: `{"status":"ok","service":"backAppC"}`.

### Frontend (Angular – puerto 4200 por defecto)

1. En **otra** terminal (con el backend ya corriendo):
   ```powershell
   cd c:\project172026\adminSPA
   npm start
   ```
   (o `npx ng serve`).
2. Abre en el navegador: `http://localhost:4200`.
3. Verifica:
   - La app carga (login o pantalla principal).
   - Las llamadas a la API se hacen contra el backend (proxy en `proxy.conf.json` apunta a `http://localhost:3000` para `/api/**`). Si puedes iniciar sesión o cargar datos, backend y frontend están funcionando correctamente.

### Resumen rápido

| Qué              | Dónde      | Comando / URL                          |
|------------------|------------|----------------------------------------|
| Backend          | `backAppC` | `npm start` → http://localhost:3000/health |
| Frontend         | `adminSPA` | `npm start` → http://localhost:4200   |
| Proxy API        | adminSPA  | `/api/**` → `http://localhost:3000`    |

Los cambios de la migración están en la rama `feat/angular-20-migration`. Cuando `npm install`, `ng build`, `ng test` y las pruebas de backend y frontend pasen, puedes hacer merge a `main`.
