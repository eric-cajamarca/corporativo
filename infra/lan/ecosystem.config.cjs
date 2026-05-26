/**
 * PM2 — arrancar backAppC + pdf-backend en el servidor (LAN / producción).
 * Desde la raíz del repo clonado:
 *   pm2 start infra/lan/ecosystem.config.cjs
 *
 * Variables de BD/JWT siguen en backAppC/.env (y opcional pdf-backend/.env).
 */
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

module.exports = {
  apps: [
    {
      name: 'backapp-api',
      cwd: path.join(repoRoot, 'backAppC'),
      script: 'app.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
        TRUST_PROXY: '1',
        // En LAN aceptamos *.local + RFC1918. En despliegues publicos
        // (internet) cambiar a '0' y listar dominios en CORS_EXTRA_ORIGINS.
        CORS_ALLOW_LAN: '1'
      }
    },
    {
      name: 'pdf-backend',
      cwd: path.join(repoRoot, 'pdf-backend'),
      script: 'index.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
        // pdf-backend solo escucha en loopback; backAppC lo llama
        // por axios al mismo host. Si lo mueves a otro host, cambia
        // a 0.0.0.0 y define PDF_BACKEND_TOKEN igual en ambos .env.
        PDF_BACKEND_BIND_HOST: '127.0.0.1',
        CORS_ALLOW_LAN: '1'
      }
    },
    {
      name: 'whatsapp-gateway',
      cwd: path.join(repoRoot, 'whatsapp-gateway'),
      script: 'src/app.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        // Solo loopback: backAppC lo llama por http://127.0.0.1:3010.
        HOST: '127.0.0.1',
        PORT: '3010'
      }
    }
  ]
};
