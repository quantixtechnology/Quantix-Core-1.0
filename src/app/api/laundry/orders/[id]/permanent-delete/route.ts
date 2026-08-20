// ============================================================================
// POST /api/laundry/orders/[id]/permanent-delete
//
// TRUE permanent deletion of a laundry order — Quantix Super Admin ONLY.
// This is NOT an archive, soft-delete, or recoverable delete. The order and
// EVERY dependent operational record are removed inside a single transaction
// (all-or-nothing). The order number is permanently retired (never reissued).
// A minimal system-security event is retained (who/when + the retired
// identifier) with NO customer / garment / pricing / order-content data.
//
// Body: { businessId: string, password: string, confirm: "DELETE" }
// ============================================================================
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password-utils"
import { unlink } from "fs/promises"
import { forgetUpload } from "@/lib/storage-guard"
import { join } from "path"

export const runtime = "nodejs"

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || "./public/uploads"

// Resolve the caller's user id from a NextAuth session cookie (desktop admin) or
// a Laundry OS Bearer access token — same dual scheme the rest of Laundry OS uses.
async function resolveUserId(request: Request): Promise<string | null> {
  const session = await getServerSession(authOptions).catch(() => null)
  if (session?.user?.id) return session.user.id
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim()
  if (token) {
    const rt = await prisma.refreshToken.findUnique({ where: { token }, select: { expiresAt: true, userId: true } })
    if (rt && rt.expiresAt >= new Date()) return rt.userId
  }
  return null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { businessId?: string; password?: string; confirm?: string }

    // ── 1. Authenticate + authorise: Super Admin ONLY ────────────────────────
    const userId = await resolveUserId(request)
    if (!userId) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })

    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true, platformRole: true, passwordHash: true },
    })
    if (!admin || !admin.isActive || admin.platformRole !== "QUANTIX_SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden — permanent deletion is restricted to the Quantix Super Admin." }, { status: 403 })
    }

    // ── 2. Re-authentication: Super Admin password ───────────────────────────
    if (body.confirm !== "DELETE") {
      return NextResponse.json({ success: false, error: 'Type DELETE to confirm.' }, { status: 400 })
    }
    if (!body.password || !admin.passwordHash || !(await verifyPassword(body.password, admin.passwordHash))) {
      return NextResponse.json({ success: false, error: "Incorrect Super Admin password." }, { status: 401 })
    }

    // ── 3. Load the order (behaves as 404 if it doesn't exist) ───────────────
    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, businessId: true, storeId: true, auditPhotos: true },
    })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    // Files to remove AFTER the DB transaction commits (the filesystem is not
    // transactional; unlinking before commit could orphan on rollback).
    let auditPhotos: string[] = []
    try { const p = JSON.parse(order.auditPhotos || "[]"); if (Array.isArray(p)) auditPhotos = p.filter((x): x is string => typeof x === "string") } catch { /* ignore */ }

    // ── 4. Delete EVERYTHING referencing the order — one atomic transaction ──
    // The 7 relational children (items, services, payments, invoice, packet,
    // stage timestamps, order events) are removed by the order's ON DELETE
    // CASCADE. The standalone tables below carry a bare orderId (no FK) and must
    // be deleted explicitly. Reusable bags are RELEASED (not deleted). Business
    // audit-log rows that reference this order number are removed too. Any
    // failure rolls the whole set back — no partial deletion.
    await prisma.$transaction([
      // Release reusable bags currently held by this order (bags are physical assets).
      prisma.laundryBag.updateMany({ where: { currentOrderId: id }, data: { status: "AVAILABLE", currentOrderId: null, currentOrderNumber: null } }),
      // Standalone per-order tables (no cascade).
      prisma.laundryItemEvent.deleteMany({ where: { orderId: id } }),
      prisma.laundryBagAssignment.deleteMany({ where: { orderId: id } }),
      prisma.laundryBagRelease.deleteMany({ where: { orderId: id } }),
      prisma.laundryPickupBag.deleteMany({ where: { orderId: id } }),
      prisma.laundryProcessingPackage.deleteMany({ where: { orderId: id } }),
      // Business audit-trail rows that reference this order number.
      prisma.laundryAuditLog.deleteMany({ where: { businessId: order.businessId, OR: [{ newValue: order.orderNumber }, { oldValue: order.orderNumber }] } }),
      // The order itself — cascades the 7 relational children.
      prisma.laundryOrder.delete({ where: { id } }),
      // Minimal security event + order-number retirement (no order content).
      prisma.laundryDeletedOrderLog.create({
        data: {
          businessId: order.businessId, orderNumber: order.orderNumber, storeId: order.storeId,
          deletedById: admin.id, deletedByName: admin.name, deletedByEmail: admin.email,
        },
      }),
    ])

    // ── 5. Storage cleanup — remove uploaded files (no orphans) ──────────────
    for (const url of auditPhotos) {
      if (!url.startsWith("/uploads/")) continue
      const filePath = join(UPLOAD_ROOT, url.replace(/^\/uploads\//, ""))
      await unlink(filePath).catch(() => {}) // best-effort; already-gone files are fine
      // The bytes are gone, so the ledger must stop charging for them —
      // otherwise a deleted order's photos consume the quota forever.
      await forgetUpload(url)
    }

    console.warn(`[laundry-permanent-delete] ${order.orderNumber} permanently deleted by ${admin.email} (${admin.id})`)
    return NextResponse.json({ success: true, message: "Order permanently deleted.", orderNumber: order.orderNumber })
  } catch (e) {
    console.error("[laundry-permanent-delete] POST", e)
    return NextResponse.json({ success: false, error: "Permanent deletion failed — nothing was deleted." }, { status: 500 })
  }
}
