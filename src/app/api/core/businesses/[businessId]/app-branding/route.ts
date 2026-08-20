// PUT /api/core/businesses/[businessId]/app-branding
// Body: { app: "customer" | "delivery" | "admin" | "store", logo: string | null }
//
// Sets ONE application's launcher icon for ONE business. `logo: null` clears the
// override, so the app falls back to the business logo and then to its
// generated default — resetting is a first-class action, not a missing feature.
//
// Only the named app is touched: the map is read, one key is changed, and the
// rest is written back untouched. Changing the Delivery icon cannot disturb
// Customer, Admin, Store, or the website logo.
//
// Tenant isolation: the businessId in the path is the ownership boundary, and
// the caller must be able to administer THAT business.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withMiddleware } from "@/lib/middleware"
import { isAppKey, parseAppLogos } from "@/lib/app-branding"

export const runtime = "nodejs"

export const PUT = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    // /api/core/businesses/<id>/app-branding
    const parts = new URL(req.url).pathname.split("/").filter(Boolean)
    const businessId = parts[parts.indexOf("businesses") + 1]
    if (!businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })

    // A tenant may only brand its OWN apps. Platform staff may brand any.
    const user = req.user!
    if (!user.isPlatformAdmin && user.businessId && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: "Not your business" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const app = (body as { app?: string }).app
    const logo = (body as { logo?: unknown }).logo

    if (!isAppKey(app)) {
      return NextResponse.json({ success: false, error: "Unknown application" }, { status: 400 })
    }
    if (logo !== null && typeof logo !== "string") {
      return NextResponse.json({ success: false, error: "logo must be a path or null" }, { status: 400 })
    }
    // Only our own uploads — never an arbitrary external URL supplied by a client.
    if (typeof logo === "string" && !logo.startsWith("/uploads/")) {
      return NextResponse.json({ success: false, error: "logo must be an uploaded file" }, { status: 400 })
    }

    const existing = await db.businessBranding.findUnique({
      where: { businessId },
      select: { appLogos: true },
    })
    const map = parseAppLogos(existing?.appLogos)
    if (logo) map[app] = logo
    else delete map[app]

    const appLogos = JSON.stringify(map)
    await db.businessBranding.upsert({
      where: { businessId },
      update: { appLogos },
      create: { businessId, appLogos },
    })

    return NextResponse.json({ success: true, data: { app, logo: logo ?? null, appLogos: map } })
  } catch (error) {
    console.error("[app-branding] PUT", error)
    return NextResponse.json({ success: false, error: "Could not save app branding" }, { status: 500 })
  }
})
