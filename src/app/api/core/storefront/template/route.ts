// GET /api/core/storefront/template — PUBLIC live-storefront render directive.
//
// Called by the customer storefront on load to decide whether to render the
// template renderer or the legacy homepage, and (when template) to receive the
// published page + sections. Public-safe: returns only published presentation +
// data-source descriptors and the template code/name/version — never draft
// content, never another tenant's data, never internal platform config.
//
// Params: businessId (required), storeId (optional), page (optional slug).
import { NextResponse } from "next/server"
import { resolveLiveStorefront } from "@/lib/commerce/live-storefront"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "businessId required" }, { status: 400 })

    const result = await resolveLiveStorefront({
      businessId,
      storeId: sp.get("storeId"),
      pageSlug: sp.get("page"),
    })

    // Unknown requested page → 404 (uses the storefront's own not-found path).
    if (result.fallbackReason === "page-not-found") {
      return NextResponse.json({ success: false, error: "Page not found", data: { rendererMode: result.rendererMode, effective: "legacy" } }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        rendererMode: result.rendererMode,
        effective: result.effective,
        source: result.source,
        configSource: result.configSource,
        template: result.template,
        page: result.page,
        availablePages: result.availablePages,
        fallbackReason: result.fallbackReason,
      },
    })
  } catch (e) {
    console.error("[storefront-template]", e)
    // Never break the storefront — signal legacy on any error.
    return NextResponse.json({ success: true, data: { rendererMode: "LEGACY", effective: "legacy", fallbackReason: "resolver-error", page: null, availablePages: [] } })
  }
}
