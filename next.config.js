// @ts-check
const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Pin the file-tracing root to the project directory.
  // WHY: if this is left as the implicit default, Next.js may resolve it as
  // the PARENT directory (/root/ on the VPS).  That causes server.js to be
  // placed at .next/standalone/Quantix-Core-1.0/server.js instead of
  // .next/standalone/server.js, and ecosystem.config.js would need updating
  // on every directory rename.  Explicit __dirname guarantees the flat layout.
  outputFileTracingRoot: path.join(__dirname),

  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
    // ── Tracing exclusions ──────────────────────────────────────────────────
    // CRITICAL: .next/** MUST be excluded.
    //   Next.js file-traces every file reachable from outputFileTracingRoot.
    //   A previous .next/standalone/ build is a full project-tree copy, so
    //   without this exclusion each new build absorbs the previous standalone
    //   into itself, producing recursive paths such as:
    //     .next/standalone/Quantix-Core-1.0/.next/standalone/Quantix-Core-1.0/…
    //   That breaks the ecosystem.config.js server.js path, hangs PM2
    //   startOrRestart, and makes every subsequent build deeper.
    //
    // The other entries prevent large non-runtime directories from bloating
    // the standalone and stop deploy-local.sh (scripts/**) from being
    // snapshotted as a stale copy inside the output.
    outputFileTracingExcludes: {
      '*': [
        '.next/**',
        'scripts/**',
        '.git/**',
        'docs/**',
        'download/**',
        'examples/**',
        'skills/**',
        'apps/**',
        'mini-services/**',
        'agent-ctx/**',
        'openapi/**',
        '*.sh',
        '*.md',
        'bun.lock',
        'worklog.md',
      ],
    },
  },

  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/uploads/:path*",
          destination: "/api/core/files/:path*",
        },
      ],
    };
  },
};

module.exports = nextConfig;
