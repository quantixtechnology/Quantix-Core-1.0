import type { Metadata, Viewport } from "next"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#10B981",
}

export const metadata: Metadata = {
  title: "Commission Calculator — Quantix",
  description: "Calculate and save sales commissions. Quantix internal tool.",
  manifest: "/commission-manifest.json",
  appleWebApp: {
    capable: true,
    title: "Commission",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: [{ url: "/quantix-logo.png", sizes: "180x180" }],
  },
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
