/**
 * PM2 — VPS internet (Hostinger / Linux)
 * Desde la raíz del repo:
 *   pm2 start infra/vps/ecosystem.config.cjs
 *   pm2 save && pm2 startup
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
        CORS_ALLOW_LAN: '0'
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
        PDF_BACKEND_BIND_HOST: '127.0.0.1',
        CORS_ALLOW_LAN: '0'
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
        HOST: '127.0.0.1',
        PORT: '3010'
      }
    }
  ]
};
