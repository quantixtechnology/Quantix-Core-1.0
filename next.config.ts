import type { NextConfig } from "next";

const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixshop.in";

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

        // For storefront subdomains (slug.quantixshop.in or custom domains),
        // rewrite all page requests to the root SPA and inject the slug as a
        // query param so the client can switch to customer mode automatically.
        {
          source: "/((?!api|_next|favicon\\.ico).*)",
          has: [
            {
              type: "host",
              // Captures e.g. "mygrocery" from "mygrocery.quantixshop.in"
              value: `(?<slug>[^\\.]+)\\.${storefrontBase.replace(/\./g, "\\.")}`,
            },
          ],
          destination: "/?_storefront=:slug",
        },
      ],
    };
  },
};

export default nextConfig;
