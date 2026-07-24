// Branded wrapper for the shared Store Admin host (store.<tenant>). Resolves the
// tenant from the host and applies its branding + the store manifest — product
// agnostic, so it works for both Laundry and Commerce tenants.
import type { Metadata, Viewport } from "next"
import { resolveStoreHostTenant } from "@/lib/store-host"

export async function generateMetadata(): Promise<Metadata> {
  const t = await resolveStoreHostTenant().catch(() => null)
  const name = t?.name || "Store Admin"
  return {
    title: `${name} · Store Admin`,
    manifest: "/manifest.json?app=store",
    appleWebApp: { capable: true, statusBarStyle: "default", title: name },
    ...(t?.logo ? { icons: { icon: t.logo, apple: t.logo, shortcut: t.logo } } : {}),
  }
}

export async function generateViewport(): Promise<Viewport> {
  const t = await resolveStoreHostTenant().catch(() => null)
  return { themeColor: t?.primaryColor || "#2563EB", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false }
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children
}
