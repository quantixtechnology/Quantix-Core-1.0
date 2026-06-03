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
