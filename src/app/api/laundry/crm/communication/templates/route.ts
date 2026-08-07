// GET/POST /api/laundry/crm/communication/templates — WhatsApp + Email template
// master. Query ?channel=WHATSAPP|EMAIL to filter; includeInactive=1 to list all.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"
const CHANNELS = new Set(["WHATSAPP", "EMAIL"])

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.settings.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const channel = sp.get("channel") || ""
    const where: Record<string, unknown> = { businessId: biz.id }
    if (CHANNELS.has(channel)) where.channel = channel
    if (sp.get("includeInactive") !== "1") where.active = true
    const rows = await prisma.crmCommunicationTemplate.findMany({
      where, orderBy: [{ channel: "asc" }, { createdAt: "desc" }],
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (e) { return crmError(e) }
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(b.businessId)
    const channel = CHANNELS.has(b.channel) ? b.channel : "WHATSAPP"
    const name = String(b.name || "").trim()
    const body = String(b.body || "").trim()
    if (!name) return NextResponse.json({ error: "Template name is required" }, { status: 400 })
    if (!body && channel === "WHATSAPP") return NextResponse.json({ error: "Message is required" }, { status: 400 })
    if (channel === "EMAIL" && !String(b.subject || "").trim()) {
      return NextResponse.json({ error: "Subject is required for email templates" }, { status: 400 })
    }
    const row = await prisma.crmCommunicationTemplate.create({
      data: {
        businessId: biz.id,
        channel,
        name,
        category: b.category ? String(b.category).trim() : null,
        subject: channel === "EMAIL" ? String(b.subject || "").trim() : null,
        body,
        active: b.active !== false,
        createdById: b.actorId || null,
        createdByName: b.actorName || null,
      },
    })
    return NextResponse.json({ success: true, data: row })
  } catch (e) { return crmError(e) }
}