import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Explicitly set turbopack root to prevent workspace misdetection
  // when multiple package-lock.json files exist in parent directories on the VPS.
  turbopack: {
    root: process.cwd(),
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
