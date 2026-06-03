import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  experimental: {
    // Raise body size limit for Server Actions to 20 MB.
    // Route Handlers (our upload routes) are NOT affected by this — they read
    // request.formData() directly without a body parser — but setting this
    // ensures the Next.js standalone server doesn't reject large requests
    // before they reach the handler.
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },

  async rewrites() {
    return {
      // Subdomain → storefront routing is handled by src/proxy.ts at runtime.
      // Only the uploads rewrite is needed here (serves uploaded files in standalone mode).
      afterFiles: [
        {
          source: "/uploads/:path*",
          destination: "/api/core/files/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
