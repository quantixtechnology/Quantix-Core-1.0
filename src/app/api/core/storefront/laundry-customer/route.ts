import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { resolveOrCreateLaundryCustomer, normalizePhone } from "@/lib/customer-identity"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId } = body
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })

    const authHeader = request.headers.get("authorization") || ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })

    const rt = await prisma.refreshToken.findFirst({ where: { token, expiresAt: { gte: new Date() } }, select: { userId: true } })
    if (!rt?.userId) return NextResponse.json({ success: false, error: "Invalid or expired session" }, { status: 401 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz?.platformBusinessId) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const user = await prisma.user.findUnique({ where: { id: rt.userId }, select: { id: true, name: true, email: true, phone: true } })
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })

    const result = await resolveOrCreateLaundryCustomer({
      platformBusinessId: biz.platformBusinessId,
      businessCodeForCode: biz.businessCode,
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      source: "STOREFRONT",
      emailRequiredForNew: true,
    })

    if (!result.customer) return NextResponse.json({ success: false, error: result.error || "Could not resolve customer" }, { status: 400 })

    // Apply profile updates if name/phone are provided in the request body.
    // This allows the storefront checkout to set/overwrite name and phone after
    // registration or during profile completion — without needing a separate
    // endpoint or laundry admin RBAC.
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.phone !== undefined) updates.phone = normalizePhone(body.phone)
    if (Object.keys(updates).length) {
      await prisma.customer.update({ where: { id: result.customer.id }, data: updates as never })
      result.customer = { ...result.customer, ...updates } as typeof result.customer
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.customer.id,
        name: result.customer.name,
        phone: result.customer.phone,
        email: result.customer.email,
        customerCode: result.customer.customerCode,
        created: result.created,
      },
    })
  } catch (e) {
    console.error("[laundry-customer] POST", e)
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
  }
}
