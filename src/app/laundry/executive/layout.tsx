// White-label wrapper for the Executive PWA. Resolves the tenant from the host
// and applies the BUSINESS branding — per-tenant manifest, theme colour, title
// and favicon/apple-touch icon (its logo). No Quantix branding is exposed.
import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import { resolveExecutiveTenant } from "@/lib/laundry-executive-tenant"
import { resolveImageUrl } from "@/lib/image-url"

async function tenant() {
  const h = await headers()
  const host = h.get("host") || ""
  return resolveExecutiveTenant(new Request("http://internal", { headers: { host } })).catch(() => null)
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await tenant()
  const name = t?.name || "Pickup & Delivery"
  const logo = t?.logo ? resolveImageUrl(t.logo) : null
  return {
    title: `${name} · Pickup & Delivery`,
    manifest: "/manifest.json?app=executive",
    appleWebApp: { capable: true, statusBarStyle: "default", title: name },
    ...(logo ? { icons: { icon: logo, apple: logo, shortcut: logo } } : {}),
  }
}

export async function generateViewport(): Promise<Viewport> {
  const t = await tenant()
  return { themeColor: t?.primaryColor || "#2563EB", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false }
}

export default function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  return children
}
