// GET  /api/laundry/delivery-executives/[id] — full detail + reset history + login info
// PUT  — edit / activate / assign store / availability
// POST — { action: "reset-password" | "lock" | "unlock" | "force-logout" | "archive" | "restore" | "delete" }
// The linked auth User is kept in sync. No change to the platform auth system —
// these are operational admin controls on the executive model.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { hashPassword } from "@/lib/password-utils"

export const runtime = "nodejs"
const genPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

async function loadOwned(id: string, businessId: string) {
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return { biz: null, exec: null }
  const exec = await prisma.laundryDeliveryExecutive.findFirst({ where: { id, businessId: biz.id } })
  return { biz, exec }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.staff.view")
    if (!guard.ok) return guard.res
    const { exec } = await loadOwned(id, businessId!)
    if (!exec) return NextResponse.json({ error: "Executive not found" }, { status: 404 })
    const [user, resets] = await Promise.all([
      exec.userId ? prisma.user.findUnique({ where: { id: exec.userId }, select: { lastLoginAt: true, mustChangePassword: true } }) : Promise.resolve(null),
      prisma.laundryDeliveryExecutiveReset.findMany({ where: { executiveId: exec.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ])
    return NextResponse.json({
      success: true,
      data: {
        id: exec.id, employeeCode: exec.employeeCode, name: exec.name, mobile: exec.mobile, canReject: exec.canReject,
        isLocked: exec.isLocked, lockedUntil: exec.lockedUntil, failedAttempts: exec.failedAttempts,
        lastLoginIp: exec.lastLoginIp, lastLoginDevice: exec.lastLoginDevice, lastLoginAt: user?.lastLoginAt ?? null,
        mustChangePassword: user?.mustChangePassword ?? false,
        resets: resets.map((r) => ({ id: r.id, adminName: r.adminName, mode: r.mode, forceChange: r.forceChange, reason: r.reason, createdAt: r.createdAt })),
      },
    })
  } catch (e) {
    console.error("[delivery-executives] GET detail", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
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
    if (b.canReject !== undefined) data.canReject = !!b.canReject
    if (b.storeId !== undefined) data.storeId = b.storeId || null
    if (b.vehicleType !== undefined) data.vehicleType = b.vehicleType || null
    if (b.vehicleNumber !== undefined) data.vehicleNumber = b.vehicleNumber ? String(b.vehicleNumber).trim() : null
    if (b.photo !== undefined) data.photo = b.photo ? String(b.photo).trim() : null
    if (b.isActive !== undefined) data.isActive = !!b.isActive
    if (b.availability !== undefined) data.availability = String(b.availability)
    const updated = await prisma.laundryDeliveryExecutive.update({ where: { id }, data })

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
    const adminName = guard.ctx.userName || "Admin"

    switch (b.action) {
      case "reset-password": {
        if (!exec.userId) return NextResponse.json({ error: "No login account for this executive" }, { status: 400 })
        const mode = b.password ? "MANUAL" : "RANDOM"
        const rawPassword = String(b.password || "").trim() || genPassword()
        if (rawPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
        const forceChange = b.forceChange !== false
        await prisma.user.update({ where: { id: exec.userId }, data: { passwordHash: await hashPassword(rawPassword), hasPassword: true, mustChangePassword: forceChange } })
        // Reset any lock and reveal the credential to the admin.
        await prisma.laundryDeliveryExecutive.update({ where: { id }, data: { failedAttempts: 0, lockedUntil: null } })
        await prisma.laundryDeliveryExecutiveReset.create({ data: { executiveId: exec.id, businessId: exec.businessId, adminName, mode, forceChange, reason: b.reason ? String(b.reason).trim() : null } })
        return NextResponse.json({ success: true, tempPassword: rawPassword, mode, forceChange })
      }
      case "lock":
        await prisma.laundryDeliveryExecutive.update({ where: { id }, data: { isLocked: true } })
        return NextResponse.json({ success: true })
      case "unlock":
        await prisma.laundryDeliveryExecutive.update({ where: { id }, data: { isLocked: false, lockedUntil: null, failedAttempts: 0 } })
        return NextResponse.json({ success: true })
      case "force-logout": {
        // Revoke every active session token for this executive (all devices).
        const count = exec.userId ? (await prisma.refreshToken.deleteMany({ where: { userId: exec.userId } })).count : 0
        return NextResponse.json({ success: true, revoked: count })
      }
      case "archive":
        await prisma.laundryDeliveryExecutive.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } })
        if (exec.userId) await prisma.user.update({ where: { id: exec.userId }, data: { isActive: false } }).catch(() => {})
        return NextResponse.json({ success: true })
      case "restore":
        await prisma.laundryDeliveryExecutive.update({ where: { id }, data: { isActive: true, archivedAt: null } })
        if (exec.userId) await prisma.user.update({ where: { id: exec.userId }, data: { isActive: true } }).catch(() => {})
        return NextResponse.json({ success: true })
      case "delete": {
        // Hard delete ONLY when the executive carries no operational history.
        // Orders reference the executive by id for pickup/delivery attribution;
        // removing one that appears on an order would blank that history and
        // break the audit trail, so those must be archived instead.
        const linked = await prisma.laundryOrder.count({
          where: { businessId: exec.businessId, OR: [{ pickupExecutiveId: id }, { deliveryExecutiveId: id }] },
        })
        if (linked > 0) {
          return NextResponse.json({
            error: `${exec.name} appears on ${linked} order(s) and cannot be deleted — their pickup/delivery history would be lost. Deactivate or archive them instead.`,
            code: "HAS_HISTORY", linked,
          }, { status: 409 })
        }
        // No history: remove the executive and their login account for real.
        await prisma.laundryDeliveryExecutive.delete({ where: { id } })
        if (exec.userId) {
          await prisma.refreshToken.deleteMany({ where: { userId: exec.userId } }).catch(() => {})
          await prisma.user.delete({ where: { id: exec.userId } }).catch(() => {})
        }
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (e) {
    console.error("[delivery-executives] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
