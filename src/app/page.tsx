// Server entry for "/".
//
// The whole app shell is a client component (home-shell.tsx, unchanged). It
// lives behind this thin server page for ONE reason: generateMetadata.
//
// A tenant sharing its own website was getting the platform's Open Graph block
// from app/layout.tsx — Quantix Technology's name, strapline and logo — because
// that is the only metadata the server emitted. WhatsApp and every other
// crawler read the first HTML response and never run React, so the tags have to
// be correct there.
//
// This is deliberately on the PAGE and not on the root layout. Reading headers()
// in the root layout opts the ENTIRE app out of prerendering; here the cost is
// this one route, which was only ever a client shell anyway.
import type { Metadata } from "next"
import { resolveStorefrontBranding } from "@/lib/storefront-metadata"
import HomeShell from "./home-shell"

export async function generateMetadata(): Promise<Metadata> {
  const t = await resolveStorefrontBranding().catch(() => null)
  // Not a tenant host (or it maps to nothing) → the platform's own metadata
  // from app/layout.tsx stands, which is the honest answer for the platform site.
  if (!t) return {}

  const url = `https://${t.host}`
  const images = t.image ? [{ url: t.image, alt: t.name }] : undefined

  return {
    title: t.name,
    description: t.description,
    // Platform values in the root layout are inherited unless overridden, so
    // every field a tenant preview shows is set here explicitly.
    openGraph: {
      title: t.name,
      description: t.description,
      siteName: t.name,
      type: "website",
      url,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: t.image ? "summary_large_image" : "summary",
      title: t.name,
      description: t.description,
      ...(t.image ? { images: [t.image] } : {}),
    },
    ...(t.image ? { icons: { icon: t.image, apple: t.image, shortcut: t.image } } : {}),
    alternates: { canonical: url },
  }
}

export default function Page() {
  return <HomeShell />
}
