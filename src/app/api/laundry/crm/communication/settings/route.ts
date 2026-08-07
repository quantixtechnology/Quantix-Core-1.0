// GET/PUT /api/laundry/crm/communication/settings — per-tenant toggles for the
// CRM communication buttons (Call / WhatsApp / Email / Recording Upload).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

const shape = (s: {
  enableCalls: boolean; enableWhatsApp: boolean; enableEmail: boolean; enableRecordingUpload: boolean
}) => ({
  enableCalls: s.enableCalls,
  enableWhatsApp: s.enableWhatsApp,
  enableEmail: s.enableEmail,
  enableRecordingUpload: s.enableRecordingUpload,
})

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "crm.settings.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(businessId)
    const cfg = await prisma.crmCommunicationSetting.upsert({
      where: { businessId: biz.id }, update: {}, create: { businessId: biz.id },
    })
    return NextResponse.json({ success: true, data: shape(cfg) })
  } catch (e) { return crmError(e) }
}

export async function PUT(request: Request) {
  try {
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(b.businessId)
    const data = {
      enableCalls: !!b.enableCalls,
      enableWhatsApp: !!b.enableWhatsApp,
      enableEmail: !!b.enableEmail,
      enableRecordingUpload: !!b.enableRecordingUpload,
      updatedBy: b.actorId || null,
      updatedByName: b.actorName || null,
    }
    const cfg = await prisma.crmCommunicationSetting.upsert({
      where: { businessId: biz.id }, update: data, create: { businessId: biz.id, ...data },
    })
    return NextResponse.json({ success: true, data: shape(cfg) })
  } catch (e) { return crmError(e) }
}