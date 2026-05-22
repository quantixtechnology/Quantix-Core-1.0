// GET /manifest.json — Serves the PWA Web App Manifest with the correct MIME type.
//
// WHY THIS EXISTS: same reason as sw.js/route.ts — Next.js standalone mode
// can return text/html for /manifest.json causing "Line 1 column 1 syntax error"
// in the browser. This route handler guarantees Content-Type: application/manifest+json.

export const dynamic = 'force-dynamic'

const manifest = {
  name: "Arbaz Fresh Meat",
  short_name: "Arbaz",
  description: "Fresh chicken, mutton & more delivered fast",
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#10B981",
  orientation: "portrait-primary",
  lang: "en-IN",
  scope: "/",
  categories: ["food", "shopping", "lifestyle"],
  icons: [
    {
      src: "/quantix-logo.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/quantix-logo.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
  shortcuts: [
    {
      name: "Order Now",
      short_name: "Order",
      description: "Browse fresh meat",
      url: "/",
    },
    {
      name: "My Orders",
      short_name: "Orders",
      description: "Track your orders",
      url: "/",
    },
  ],
  prefer_related_applications: false,
}

export async function GET() {
  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
