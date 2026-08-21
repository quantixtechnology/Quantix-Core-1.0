// GET /api/laundry/settings/sales-owners?businessId=
//
// The people who can be named as a customer's Sales Team Owner.
//
// SOURCE: the CRM "Lead Owner" field's own options — CRM → Settings → Lead
// Fields → Lead Owner. That field is a SELECT whose options carry an `active`
// flag, which is exactly the configured list of sales people, so the customer
// dropdown and the lead dropdown offer the same names by construction.
//
// NOT the Business User/staff list: a store manager or a delivery executive is
// not a sales owner, and offering the whole payroll made the field meaningless.
//
// Deactivating an option in CRM removes it here too. A customer already
// carrying that person keeps them — the name is stored on the customer row, and
// the form re-adds it to its own dropdown so editing cannot silently reassign.
//
// Read-only. No CRM record is written and no workflow is touched.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

/** The CRM field that holds the configured owners. */
const LEAD_OWNER_FIELD_KEY = "lead_owner"

interface FieldOption { value: string; label?: string; order?: number; active?: boolean }

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryMember(request, businessId)
    if (!guard.ok) return guard.res
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const field = await prisma.laundryCrmLeadField.findFirst({
      where: { businessId: biz.id, fieldKey: LEAD_OWNER_FIELD_KEY },
      select: { options: true, active: true },
    })

    // No Lead Owner field configured yet, or the field itself is switched off —
    // an empty list is the truthful answer. Inventing names from the staff list
    // is what this replaced.
    if (!field || !field.active || !field.options) {
      return NextResponse.json({ success: true, data: [] })
    }

    let parsed: FieldOption[] = []
    try {
      const raw = JSON.parse(field.options)
      if (Array.isArray(raw)) parsed = raw as FieldOption[]
    } catch {
      // Malformed options are no options, never a crash.
      return NextResponse.json({ success: true, data: [] })
    }

    const owners = parsed
      // `active !== false` matches how CRM itself reads these: an option
      // written before the flag existed counts as active.
      .filter((o) => o && typeof o.value === "string" && o.value.trim() && o.active !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((o) => ({ id: o.value, name: (o.label || o.value).trim() }))

    return NextResponse.json({ success: true, data: owners })
  } catch (e) {
    console.error("[sales-owners] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
