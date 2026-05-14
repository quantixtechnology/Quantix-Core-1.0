// PM2 ecosystem config for Quantix Core on Hostinger VPS
// Env vars (DATABASE_URL, NEXTAUTH_SECRET) are loaded from the system
// environment or /root/Quantix-Core-1.0/.env on the VPS.
// Do NOT commit secrets into this file.

module.exports = {
  apps: [
    {
      name: 'quantix',
      script: 'node',
      args: '.next/standalone/server.js',
      cwd: '/root/Quantix-Core-1.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      error_file: '/root/logs/quantix-error.log',
      out_file:   '/root/logs/quantix-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
