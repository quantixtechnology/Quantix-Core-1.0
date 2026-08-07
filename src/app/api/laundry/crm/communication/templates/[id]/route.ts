// PUT/DELETE /api/laundry/crm/communication/templates/[id]
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { requireCrmBusiness } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"
const CHANNELS = new Set(["WHATSAPP", "EMAIL"])

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(b.businessId)
    const existing = await prisma.crmCommunicationTemplate.findFirst({
      where: { id, businessId: biz.id },
    })
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (b.name !== undefined) { const v = String(b.name).trim(); if (!v) return NextResponse.json({ error: "Template name is required" }, { status: 400 }); data.name = v }
    if (b.category !== undefined) data.category = b.category ? String(b.category).trim() : null
    if (b.body !== undefined) { const v = String(b.body).trim(); if (!v) return NextResponse.json({ error: "Message is required" }, { status: 400 }); data.body = v }
    if (b.subject !== undefined) data.subject = b.subject ? String(b.subject).trim() : null
    if (b.channel !== undefined) { if (!CHANNELS.has(b.channel)) return NextResponse.json({ error: "Invalid channel" }, { status: 400 }); data.channel = b.channel }
    if (b.active !== undefined) data.active = !!b.active
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const row = await prisma.crmCommunicationTemplate.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: row })
  } catch (e) { return crmError(e) }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.settings.edit")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    const existing = await prisma.crmCommunicationTemplate.findFirst({
      where: { id, businessId: biz.id },
    })
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 })
    await prisma.crmCommunicationTemplate.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) { return crmError(e) }
}