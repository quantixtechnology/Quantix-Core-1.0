// Delivery Executives — dedicated operational master for field pickup/delivery
// staff. GET lists them (with store + today's job counts + live status). POST
// creates one: it provisions an auth User (login flows through the EXISTING auth
// system — no second auth) + a business membership, then the executive record.
// Only these executives can log into the Pickup & Delivery PWA.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { hashPassword } from "@/lib/password-utils"

export const runtime = "nodejs"

const BASE_EMPLOYEE_ROLE = "STORE_EXECUTIVE"
const genPassword = () => `Delivery@${Math.random().toString(36).slice(2, 7).toUpperCase()}`

async function nextEmployeeCode(businessId: string): Promise<string> {
  const rows = await prisma.laundryDeliveryExecutive.findMany({ where: { businessId }, select: { employeeCode: true } })
  let max = 0
  for (const r of rows) { const m = /^EXE(\d+)$/i.exec(r.employeeCode.trim()); if (m) max = Math.max(max, parseInt(m[1], 10)) }
  return `EXE${String(max + 1).padStart(3, "0")}`
}

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    const guard = await requireLaundryPermission(request, businessId, "laundry.staff.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId!)
    if (!biz) return NextResponse.json({ success: true, data: [], stores: [] })
    const lbId = biz.id

    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 1)

    const [execs, stores, pickupGroups, deliveryGroups] = await Promise.all([
      prisma.laundryDeliveryExecutive.findMany({ where: { businessId: lbId }, orderBy: { createdAt: "asc" }, include: { store: { select: { storeName: true } } } }),
      prisma.laundryStore.findMany({ where: { laundryBusinessId: lbId }, select: { id: true, storeName: true } }),
      prisma.laundryOrder.groupBy({ by: ["pickupExecutiveId"], where: { businessId: lbId, pickupDate: { gte: start, lt: end }, pickupExecutiveId: { not: null } }, _count: true }),
      prisma.laundryOrder.groupBy({ by: ["deliveryExecutiveId"], where: { businessId: lbId, status: "READY_FOR_DELIVERY", deliveryExecutiveId: { not: null } }, _count: true }),
    ])
    const pickupCount = new Map(pickupGroups.map((g) => [g.pickupExecutiveId, g._count]))
    const deliveryCount = new Map(deliveryGroups.map((g) => [g.deliveryExecutiveId, g._count]))

    const data = execs.map((e) => ({
      id: e.id, employeeCode: e.employeeCode, name: e.name, mobile: e.mobile,
      storeId: e.storeId, storeName: e.store?.storeName ?? null, vehicleType: e.vehicleType,
      isActive: e.isActive, availability: e.availability, currentStatus: e.currentStatus,
      hasLogin: !!e.userId,
      todaysPickups: pickupCount.get(e.id) ?? 0,
      todaysDeliveries: deliveryCount.get(e.id) ?? 0,
    }))
    return NextResponse.json({ success: true, data, stores })
  } catch (e) {
    console.error("[delivery-executives] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.staff.create")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const platformBusinessId = guard.platformBusinessId

    const name = String(b.name || "").trim()
    const mobile = String(b.mobile || "").trim()
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    if (!/^\d{7,15}$/.test(mobile.replace(/\D/g, ""))) return NextResponse.json({ error: "A valid mobile number is required" }, { status: 400 })

    let employeeCode = String(b.employeeCode || "").trim()
    if (employeeCode) {
      const clash = await prisma.laundryDeliveryExecutive.findFirst({ where: { businessId: lbId, employeeCode }, select: { id: true } })
      if (clash) return NextResponse.json({ error: `Employee code "${employeeCode}" already exists` }, { status: 409 })
    } else {
      employeeCode = await nextEmployeeCode(lbId)
    }

    // Provision an auth User (existing auth system). Synthesised unique email; the
    // executive logs in with mobile + password via the PWA (Slice 2).
    const rawPassword = String(b.password || "").trim() || genPassword()
    if (rawPassword.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    const email = `del.${employeeCode.toLowerCase()}.${Math.random().toString(36).slice(2, 8)}@delivery.quantix.local`
    const passwordHash = await hashPassword(rawPassword)

    const user = await prisma.user.create({
      data: {
        email, loginId: email, name, phone: mobile,
        passwordHash, authProvider: "PASSWORD", isActive: true, hasPassword: true,
        mustChangePassword: true, emailVerified: true, createdBy: guard.ctx.userId,
      },
    })
    await prisma.businessUser.create({
      data: { userId: user.id, businessId: platformBusinessId, role: BASE_EMPLOYEE_ROLE, storeId: null, isActive: true, invitedAt: new Date(), acceptedAt: new Date() },
    })
    const exec = await prisma.laundryDeliveryExecutive.create({
      data: {
        businessId: lbId, userId: user.id, employeeCode, name, mobile,
        storeId: b.storeId || null, vehicleType: b.vehicleType || null,
        isActive: b.isActive !== undefined ? !!b.isActive : true,
      },
    })
    return NextResponse.json({ success: true, data: { id: exec.id, employeeCode, tempPassword: rawPassword } }, { status: 201 })
  } catch (e) {
    console.error("[delivery-executives] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
