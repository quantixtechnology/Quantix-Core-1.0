// White-label wrapper for the Store Admin PWA. Resolves the tenant from the host
// (store.<tenant>) and applies the BUSINESS branding — per-tenant manifest, theme
// colour, title and icon. Same architecture as the Executive PWA layout.
import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import { resolveStoreTenant } from "@/lib/laundry-executive-tenant"
import { resolveImageUrl } from "@/lib/image-url"

async function tenant() {
  const h = await headers()
  const host = h.get("host") || ""
  return resolveStoreTenant(new Request("http://internal", { headers: { host } })).catch(() => null)
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await tenant()
  const name = t?.name || "Store Admin"
  const logo = t?.logo ? resolveImageUrl(t.logo) : null
  return {
    title: `${name} Admin App`,
    manifest: "/manifest.json?app=store",
    appleWebApp: { capable: true, statusBarStyle: "default", title: `${name} Admin App` },
    ...(logo ? { icons: { icon: logo, apple: logo, shortcut: logo } } : {}),
  }
}

export async function generateViewport(): Promise<Viewport> {
  const t = await tenant()
  return { themeColor: t?.primaryColor || "#2563EB", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false }
}

export default function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  // .pwa-shell locks the app to a phone-width column on wide/desktop-mode
  // viewports so the mobile layout never stretches (see globals.css).
  return <div className="pwa-shell">{children}</div>
}
