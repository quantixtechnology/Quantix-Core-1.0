import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Store Admin",
  manifest: "/manifest.json?app=store",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Store Admin" },
}

export const viewport: Viewport = {
  themeColor: "#2563EB", width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false,
}

export default function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
