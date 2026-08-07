// GET /api/laundry/crm/recordings/[id]/file — stream the audio for playback/download.
import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { extname } from "path"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { recordingFileAbsPath } from "@/lib/laundry-crm-comms"

export const runtime = "nodejs"

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.leads.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const rec = await prisma.crmCallRecording.findFirst({ where: { id, businessId: biz.id } })
    if (!rec) return NextResponse.json({ error: "Recording not found" }, { status: 404 })

    let data: Buffer
    try { data = await readFile(recordingFileAbsPath(biz.id, rec.storageName)) } catch {
      return NextResponse.json({ error: "File missing on disk" }, { status: 404 })
    }
    const ext = extname(rec.storageName).toLowerCase()
    const headers = new Headers({ "Content-Type": MIME[ext] || rec.mimeType || "application/octet-stream", "Content-Length": String(data.length) })
    if (sp.get("download") === "1") headers.set("Content-Disposition", `attachment; filename="${rec.fileName.replace(/"/g, "")}"`)
    return new Response(new Uint8Array(data), { status: 200, headers })
  } catch (e) { return crmError(e) }
}