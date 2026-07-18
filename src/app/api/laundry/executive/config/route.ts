// GET /api/laundry/executive/config — public bootstrap for the Executive PWA:
// which tenant this app serves + its white-label branding (name, logo, colour).
// Business is inferred from the host (dedicated branded deployment). No Quantix
// branding is returned — the PWA renders fully as the business's own app.
import { NextResponse } from "next/server"
import { resolveExecutiveTenant } from "@/lib/laundry-executive-tenant"
import { resolveImageUrl } from "@/lib/image-url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const t = await resolveExecutiveTenant(request).catch(() => null)
  if (!t) return NextResponse.json({ success: true, data: null })
  return NextResponse.json({
    success: true,
    data: {
      businessId: t.laundryBusinessId,
      name: t.name,
      logo: t.logo ? resolveImageUrl(t.logo) : null,
      primaryColor: t.primaryColor,
    },
  })
}
