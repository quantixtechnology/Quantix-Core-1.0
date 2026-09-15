// GET  /api/laundry/licensing?businessId=  — catalog + what this tenant has.
// PUT  /api/laundry/licensing              — save a whole selection.
//
// The one place licensing is read and written. Sidebar, Navigation Manager,
// Roles & Permissions and the API guards all resolve through the same engine,
// so there is no second switch to keep in step.
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { licenceSnapshot, saveLicence } from "@/lib/laundry-licensing-server"

export const runtime = "nodejs"

async function assertLaundryBusiness(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { productCode: true },
  })
  if (!business || business.productCode !== "LAUNDRY") {
    return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
  }
  return null
}

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })

  const notLaundry = await assertLaundryBusiness(businessId)
  if (notLaundry) return notLaundry

  // Read is guarded too. It shipped without a guard, which meant a tenant's
  // commercial entitlements were readable by anyone who knew the id — and it
  // is why saving failed while loading appeared to work: only the write was
  // ever checking. Read and write now use the identical pipeline, differing
  // only in the level they demand.
  const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
  if (!guard.ok) return guard.res

  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

  return NextResponse.json({ success: true, data: await licenceSnapshot(biz.id) })
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { businessId, screenKeys } = body as { businessId?: string; screenKeys?: string[] }
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })
  if (!Array.isArray(screenKeys)) return NextResponse.json({ error: "screenKeys array required" }, { status: 400 })

  const notLaundry = await assertLaundryBusiness(businessId)
  if (notLaundry) return notLaundry

  // Licensing decides what a tenant may reach at all, so it is an owner-level
  // change — not something a store role can grant itself.
  const guard = await requireLaundryPermission(request, businessId, "laundry.settings.edit")
  if (!guard.ok) return guard.res

  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

  await saveLicence(biz.id, screenKeys)
  return NextResponse.json({ success: true, data: await licenceSnapshot(biz.id) })
}
