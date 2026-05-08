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
        TRUST_PROXY: '1'
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
        PORT: '3002'
      }
    }
  ]
};
