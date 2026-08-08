// GET / PUT /api/laundry/crm/settings/config — per-tenant CRM behaviour
// switches (as opposed to the configurable LISTS: stages, priorities, sources…).
//
// Currently: probabilityMode
//   AUTO_FROM_STAGE — an opportunity's probability always follows its sales
//                     stage's configured probability; operators never type it.
//   MANUAL          — probability is typed by hand and a stage move never
//                     overwrites it.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, getCrmConfig, normalizeProbabilityMode } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryLevel, Level } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryLevel(request, sp.get("businessId"), "crm.settings", Level.VIEW)
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    return NextResponse.json({ success: true, data: await getCrmConfig(biz.id) })
  } catch (e) { return crmError(e) }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const guard = await requireLaundryLevel(request, body.businessId, "crm.settings", Level.EDIT)
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)

    const probabilityMode = normalizeProbabilityMode(body.probabilityMode)
    // Created on demand — a tenant that never opened Settings has no row.
    await prisma.laundryCrmConfig.upsert({
      where: { businessId: biz.id },
      create: { businessId: biz.id, probabilityMode },
      update: { probabilityMode },
    })
    return NextResponse.json({ success: true, data: { probabilityMode } })
  } catch (e) { return crmError(e) }
}
