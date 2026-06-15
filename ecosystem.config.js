// PM2 ecosystem config for Quantix Core on Hostinger VPS
// Env vars (DATABASE_URL, NEXTAUTH_SECRET) are loaded from the system environment
// or /home/ubuntu/Quantix-Core-1.0/.env on the VPS.
// Do NOT commit secrets into this file.

module.exports = {
  apps: [
    {
      name: 'quantix-core',
      script: 'node',
      // server.js sits at the root of .next/standalone/ because next.config.js
      // sets outputFileTracingRoot: __dirname (the project directory itself).
      // When the tracing root equals the project root, Next.js places all files
      // directly under standalone/ with no extra subdirectory nesting.
      // Path: .next/standalone/server.js
      args: '.next/standalone/server.js',
      cwd: '/home/ubuntu/Quantix-Core-1.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        OTP_MODE: 'EMAIL',         // force full DB OTP validation (not dev bypass)
        UPLOAD_ROOT: '/var/www/uploads',
        // Absolute path so the value is stable regardless of CWD.
        // Must match DB_FILE in deploy-local.sh or similar deployment script. (e.g. /home/ubuntu/data/custom.db)
        DATABASE_URL: 'file:/home/ubuntu/data/custom.db',
        // Explicit project root used by /api/deploy to locate deploy-local.sh.
        // WHY: standalone/server.js calls process.chdir(__dirname), shifting
        // process.cwd() to .next/standalone/.  Without this, /api/deploy
        // resolves to the stale standalone copy of deploy-local.sh (frozen at
        // build time) instead of the live git working-tree script.
        QUANTIX_PROJECT_DIR: '/home/ubuntu/Quantix-Core-1.0',
      },
      error_file: '/home/ubuntu/logs/quantix-error.log',
      out_file:   '/home/ubuntu/logs/quantix-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
