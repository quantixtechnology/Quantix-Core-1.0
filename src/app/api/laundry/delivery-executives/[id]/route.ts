// PUT  /api/laundry/delivery-executives/[id]  — edit / activate / deactivate /
//                                                assign store / availability
// POST /api/laundry/delivery-executives/[id]  — { action: "reset-password" }
// The linked auth User is kept in sync (name/phone/active) so login stays valid.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { hashPassword } from "@/lib/password-utils"

export const runtime = "nodejs"
const genPassword = () => `Delivery@${Math.random().toString(36).slice(2, 7).toUpperCase()}`

async function loadOwned(id: string, businessId: string) {
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return { biz: null, exec: null }
  const exec = await prisma.laundryDeliveryExecutive.findFirst({ where: { id, businessId: biz.id } })
  return { biz, exec }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff.edit")
    if (!guard.ok) return guard.res
    const { exec } = await loadOwned(id, b.businessId)
    if (!exec) return NextResponse.json({ error: "Executive not found" }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (b.name !== undefined) data.name = String(b.name).trim()
    if (b.mobile !== undefined) data.mobile = String(b.mobile).trim()
    if (b.storeId !== undefined) data.storeId = b.storeId || null
    if (b.vehicleType !== undefined) data.vehicleType = b.vehicleType || null
    if (b.isActive !== undefined) data.isActive = !!b.isActive
    if (b.availability !== undefined) data.availability = String(b.availability)
    // employeeCode is immutable (the operational key).
    const updated = await prisma.laundryDeliveryExecutive.update({ where: { id }, data })

    // Keep the linked auth User consistent so login state matches the master.
    if (exec.userId && (b.name !== undefined || b.mobile !== undefined || b.isActive !== undefined)) {
      await prisma.user.update({
        where: { id: exec.userId },
        data: {
          ...(b.name !== undefined ? { name: String(b.name).trim() } : {}),
          ...(b.mobile !== undefined ? { phone: String(b.mobile).trim() } : {}),
          ...(b.isActive !== undefined ? { isActive: !!b.isActive } : {}),
        },
      })
    }
    return NextResponse.json({ success: true, data: { id: updated.id } })
  } catch (e) {
    console.error("[delivery-executives] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff.edit")
    if (!guard.ok) return guard.res
    const { exec } = await loadOwned(id, b.businessId)
    if (!exec) return NextResponse.json({ error: "Executive not found" }, { status: 404 })
    if (b.action !== "reset-password") return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    if (!exec.userId) return NextResponse.json({ error: "No login account for this executive" }, { status: 400 })

    const rawPassword = String(b.password || "").trim() || genPassword()
    if (rawPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    await prisma.user.update({ where: { id: exec.userId }, data: { passwordHash: await hashPassword(rawPassword), hasPassword: true, mustChangePassword: true } })
    return NextResponse.json({ success: true, tempPassword: rawPassword })
  } catch (e) {
    console.error("[delivery-executives] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
