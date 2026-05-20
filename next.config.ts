import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  async rewrites() {
    return {
      // Subdomain → storefront routing is handled by src/middleware.ts at runtime.
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
