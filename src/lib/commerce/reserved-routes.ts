// Reserved storefront routes — template custom pages must NEVER shadow these
// functional Commerce routes/actions. Derived from the actual storefront
// WebPage set + PWA/system paths audited in Phase 3 (storefront-website.tsx,
// customer app, product host). A template page whose slug/route collides with
// one of these is rejected at mutation/publish time (see templates/[id]/pages).
//
// Keep this list in sync when new functional storefront routes are added.
export const RESERVED_STOREFRONT_ROUTES: readonly string[] = [
  // Storefront web pages (storefront-website.tsx WebPage union)
  "home",
  "category",
  "categories",
  "product",
  "products",
  "auth",
  "login",
  "account",
  "checkout",
  "cart",
  "order-tracking",
  "orders",
  "order",
  "profile",
  "addresses",
  "password",
  "search",
  "wishlist",
  "coupons",
  "invoices",
  "notifications",
  "support",
  // System / PWA / platform
  "api",
  "delivery",
  "admin",
  "sw",
  "manifest",
  "_next",
]

const RESERVED = new Set(RESERVED_STOREFRONT_ROUTES)

// Normalise a slug/route to its first path segment, lowercased, no leading slash.
export function routeKey(input: string): string {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/^\/+/, "")
    .split(/[/?#]/)[0]
    .replace(/[^a-z0-9-]/g, "")
}

// True when a template custom-page slug/route would collide with a reserved
// functional route. The template HOME page (slug "home", route "/") is allowed —
// it is the template's own home and does not shadow a catalogue route.
export function isReservedRoute(slugOrRoute: string): boolean {
  const key = routeKey(slugOrRoute)
  if (!key) return false
  return RESERVED.has(key)
}
