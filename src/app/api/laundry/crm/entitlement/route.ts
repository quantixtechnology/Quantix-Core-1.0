// GET /api/laundry/crm/entitlement?businessId=
// Tells the workspace shell whether CRM is enabled for this tenant. When
// enabled, lazily initializes tenant CRM defaults (idempotent).
import { NextResponse } from "next/server"
import { resolveCrmAccess, ensureCrmDefaults } from "@/lib/laundry-crm"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const access = await resolveCrmAccess(businessId)
    if (!access) return NextResponse.json({ success: true, enabled: false })
    if (access.enabled) await ensureCrmDefaults(access.biz.id)
    return NextResponse.json({ success: true, enabled: access.enabled })
  } catch (e) {
    console.error("[crm/entitlement] GET", e)
    return NextResponse.json({ success: true, enabled: false })
  }
}
