// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
    // Exclude shell scripts and other non-runtime files from the standalone
    // output.  Without this, Next.js file-traces the entire project tree into
    // .next/standalone/, including scripts/deploy-local.sh.  Because
    // standalone/server.js calls process.chdir(__dirname) at startup, the API
    // route's path resolver finds the STALE standalone copy first and executes
    // it instead of the live git working-tree script.
    outputFileTracingExcludes: {
      '*': [
        'scripts/**',
        '.git/**',
        'docs/**',
        'examples/**',
        'skills/**',
        'apps/**',
        '*.sh',
        '*.md',
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
