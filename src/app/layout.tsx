import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ApiProvider } from "@/lib/api-provider";
import { CacheBuster } from "@/components/cache-buster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Default theme color — PwaMetaUpdater overwrites this at runtime per business
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10B981" },
    { media: "(prefers-color-scheme: dark)",  color: "#10B981" },
  ],
  // viewport-fit=cover: lets content extend under the iPhone notch/home bar.
  // The storefront layout applies safe-area-inset padding so nothing is hidden.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Quantix Technology - Managed White-Label SaaS Platform",
  description: "Run Your Business Smarter. Managed white-label multi-tenant SaaS platform for Grocery, Food Delivery, Laundry, Car Wash, Pharmacy, Home Services and more.",
  keywords: ["Quantix", "SaaS", "White-Label", "Multi-Tenant", "Business Platform", "India"],
  authors: [{ name: "Quantix Technology" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // black-translucent lets the app extend behind the iOS status bar in
    // standalone mode; PwaMetaUpdater sets the actual background colour.
    statusBarStyle: "black-translucent",
    title: "Quantix Store",
  },
  // Default apple-touch-icon — overwritten per-business by PwaMetaUpdater
  icons: {
    apple: [{ url: "/quantix-logo.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Quantix Technology",
    description: "Run Your Business Smarter - Managed White-Label SaaS Platform",
    siteName: "Quantix Technology",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quantix Technology",
    description: "Run Your Business Smarter - Managed White-Label SaaS Platform",
  },
};

// ── Early-capture script for beforeinstallprompt ──────────────────────────────
// Chrome can fire `beforeinstallprompt` within milliseconds of HTML parsing —
// before React hydrates and before any useEffect can register a listener.
// This inline script runs synchronously before React touches the DOM, stores
// the event on window.__bip, and records the capture timestamp.
// usePwaInstall reads window.__bip on mount so the missed event is recovered.
const EARLY_CAPTURE_SCRIPT = `
(function(){
  window.__bip = null;
  window.__bipCapturedAt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window.__bip = e;
    window.__bipCapturedAt = Date.now();
  }, { once: true });
})();
`.trim()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Early-capture: must execute before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_CAPTURE_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ApiProvider>
          <CacheBuster />
          {children}
        </ApiProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
