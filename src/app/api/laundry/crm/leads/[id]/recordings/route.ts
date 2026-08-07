// GET/POST /api/laundry/crm/leads/[id]/recordings — list and upload manual call
// recordings for a lead. POST accepts multipart/form-data (file + durationSec +
// remarks). mp3/m4a/wav/aac, max 25MB. Uses the generic CrmCallRecording with
// entityType "LEAD" so recordings can later attach to Customer/Opportunity/Activity.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import {
  isRecordingMime, isRecordingExt, RECORDING_MAX_SIZE, persistRecording,
} from "@/lib/laundry-crm-comms"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.leads.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const lead = await prisma.laundryCrmLead.findFirst({ where: { id, businessId: biz.id }, select: { id: true } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    const rows = await prisma.crmCallRecording.findMany({
      where: { businessId: biz.id, entityType: "LEAD", entityId: id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (e) { return crmError(e) }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    let form: FormData
    let businessId = ""
    try {
      form = await request.formData()
      businessId = String(form.get("businessId") || "")
    } catch {
      return NextResponse.json({ error: "Could not read upload body" }, { status: 400 })
    }
    const guard = await requireLaundryPermission(request, businessId, "crm.leads.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(businessId)
    const lead = await prisma.laundryCrmLead.findFirst({ where: { id, businessId: biz.id }, select: { id: true } })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    const fileSize = file.size
    if (fileSize > RECORDING_MAX_SIZE) {
      return NextResponse.json({ error: "Recording is too large. Maximum size is 25 MB." }, { status: 400 })
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!isRecordingExt(ext) || !isRecordingMime(file.type)) {
      return NextResponse.json({ error: "Unsupported format. Use .mp3, .m4a, .wav or .aac." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const storageName = await persistRecording(biz.id, file.name, buffer)

    let durationSec: number | null = null
    const durRaw = String(form.get("durationSec") || "").trim()
    if (durRaw) { const n = Math.round(Number(durRaw)); if (Number.isFinite(n) && n > 0) durationSec = n }
    const remarks = String(form.get("remarks") || "").trim() || null
    const actorId = String(form.get("actorId") || "") || null
    const actorName = String(form.get("actorName") || "") || null

    const rec = await prisma.crmCallRecording.create({
      data: {
        businessId: biz.id,
        entityType: "LEAD",
        entityId: id,
        fileName: file.name,
        storageName,
        mimeType: file.type || "audio/mpeg",
        size: fileSize,
        durationSec,
        remarks,
        uploadedById: actorId,
        uploadedByName: actorName,
      },
    })
    if (actorName || actorId) {
      await prisma.laundryCrmEvent.create({ data: {
        businessId: biz.id, leadId: id, kind: "RECORDING_UPLOADED",
        label: `Call recording uploaded${rec.fileName ? ` — ${rec.fileName}` : ""}`,
        actorId, actorName,
      } }).catch(() => {})
    }
    return NextResponse.json({ success: true, data: rec })
  } catch (e) { return crmError(e) }
}