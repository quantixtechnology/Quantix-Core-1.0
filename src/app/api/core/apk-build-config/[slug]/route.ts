// GET /api/core/apk-build-config/<slug>
//
// What the APK builder needs to package one tenant's apps: where each opens,
// what it is called, its Android id, its flavour and its icon — all derived
// from that tenant's own configuration, none of it composed by the builder.
//
// The builder used to make its own hosts as <slug>.<base>. That is right only
// for a tenant who never brought a domain, and wrong for everyone who did: the
// APK opened a hostname with no certificate on it. This is the same canonical
// host the manifest, the storefront and the certificate use.
//
// Public, because everything in it already is: a tenant's domain, its name and
// its icons are served to every visitor of the storefront. It exposes no
// credential, no path and no build machinery, and it grants nothing — reading
// this does not build anything.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apkBuildConfig } from "@/lib/apk-build-config"
import { appIconVersion, effectiveAppLogo, parseAppLogos } from "@/lib/app-branding"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || "quantixtechnology.in"

export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
    }

    const business = await db.business.findUnique({
      where: { slug: slug.toLowerCase() },
      select: {
        slug: true, name: true,
        domain: { select: { domain: true } },
        branding: { select: { appLogos: true } },
      },
    })
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

    // Versioned icon URLs, from the same rule the manifest stamps — so a
    // rebuilt APK picks up an icon the tenant has since replaced.
    const logos = parseAppLogos(business.branding?.appLogos)
    const iconVersions = {
      customer: appIconVersion(effectiveAppLogo(logos, "customer")),
      delivery: appIconVersion(effectiveAppLogo(logos, "delivery")),
      store: appIconVersion(effectiveAppLogo(logos, "store")),
    }

    const config = apkBuildConfig(business, SF_BASE, iconVersions)
    if (!config) return NextResponse.json({ error: "Business has no slug or mapped domain" }, { status: 400 })

    return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    console.error("[apk-build-config] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
