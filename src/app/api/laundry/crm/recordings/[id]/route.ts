// DELETE /api/laundry/crm/recordings/[id] — delete a recording (file + record).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { deleteRecordingFile } from "@/lib/laundry-crm-comms"

export const runtime = "nodejs"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.leads.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const rec = await prisma.crmCallRecording.findFirst({ where: { id, businessId: biz.id } })
    if (!rec) return NextResponse.json({ error: "Recording not found" }, { status: 404 })
    await deleteRecordingFile(biz.id, rec.storageName)
    await prisma.crmCallRecording.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) { return crmError(e) }
}