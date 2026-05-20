import type { NextConfig } from "next";

const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  async rewrites() {
    return {
      beforeFiles: [
        // Pass API, Next.js internals, and static files through unchanged
        // for subdomain requests — nothing to rewrite there.

        // For storefront subdomains (slug.quantixtechnology.in or custom domains),
        // rewrite all page requests to the root SPA and inject the slug as a
        // query param so the client can switch to customer mode automatically.
        {
          source: "/((?!api|_next|favicon\\.ico).*)",
          has: [
            {
              type: "host",
              // Captures e.g. "mygrocery" from "mygrocery.quantixtechnology.in"
              value: `(?<slug>[^\\.]+)\\.${storefrontBase.replace(/\./g, "\\.")}`,
            },
          ],
          destination: "/?_storefront=:slug",
        },
      ],
      // In standalone production mode, the static server only serves files
      // from .next/standalone/public/ (copied at build time). Uploaded files
      // land in project/public/uploads/ after the build, so they're invisible
      // to the static server. This afterFiles rewrite catches any /uploads/*
      // request that wasn't resolved as a static file and routes it to the
      // file-serving API route which reads directly from process.cwd()/public/.
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
