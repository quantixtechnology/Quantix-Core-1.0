// DELETE /api/core/admin/customers/[customerId]  — PERMANENT customer deletion.
//
// SUPER ADMIN ONLY (QUANTIX_SUPER_ADMIN). Deletes the customer and ALL dependent
// data within the given tenant in FK-safe order inside ONE transaction; any
// failure rolls back the whole thing. Writes a CRITICAL PlatformAuditLog with
// the actor, tenant, customer and per-entity deleted counts. Never exposed to
// Business Admin / Staff (role-gated in middleware, not just the UI).
//
// Body/query: businessId (tenant scope, mandatory).
import { NextResponse } from "next/server"
import { withMiddleware } from "@/lib/middleware"
import { prisma } from "@/lib/prisma"
import { hardDeleteCustomer } from "@/lib/customer-hard-delete"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export const DELETE = withMiddleware({ requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN"] })(async (req, context) => {
  try {
    const params = await context?.params
    const customerId = params?.customerId as string | undefined
    const url = new URL(req.url)
    let businessId = url.searchParams.get("businessId") || undefined
    if (!businessId) { try { businessId = (await req.json())?.businessId } catch { /* no body */ } }
    if (!customerId) return NextResponse.json({ success: false, error: "customerId is required" }, { status: 400 })
    if (!businessId) return NextResponse.json({ success: false, error: "businessId (tenant scope) is required" }, { status: 400 })

    // Tenant scope: the customer must belong to this business. Accept either the
    // platform Business.id or a LaundryBusiness.id (resolved to its platform id).
    const scopeIds = [businessId]
    const lb = await resolveLaundryBusiness(businessId).catch(() => null)
    if (lb?.platformBusinessId) scopeIds.push(lb.platformBusinessId)
    const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId: { in: scopeIds } }, select: { id: true, name: true, email: true, phone: true, customerCode: true, businessId: true } })
    if (!customer) return NextResponse.json({ success: false, error: "Customer not found in this business" }, { status: 404 })

    const user = req.user!
    const counts = await prisma.$transaction(async (tx) => {
      const c = await hardDeleteCustomer(tx, customerId)
      await tx.platformAuditLog.create({
        data: {
          userId: user.id, userName: user.name || null, email: user.email || null, role: user.role,
          module: "CUSTOMERS", action: "DELETE", resourceType: "Customer", resourceId: customerId,
          severity: "CRITICAL",
          description: `Super Admin permanently deleted customer ${customer.name} (${customer.customerCode || customerId}) and all related data in business ${customer.businessId}`,
          oldValues: JSON.stringify({ businessId: customer.businessId, customer }),
          newValues: JSON.stringify({ deletedCounts: c }),
        },
      })
      return c
    })

    return NextResponse.json({ success: true, data: { customerId, businessId, deletedCounts: counts } })
  } catch (e) {
    console.error("[admin/customers DELETE]", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Delete failed" }, { status: 500 })
  }
})
