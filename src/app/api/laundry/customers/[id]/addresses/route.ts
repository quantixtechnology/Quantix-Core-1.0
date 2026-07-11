// GET  /api/laundry/customers/[id]/addresses  — list (Part 2)
// POST /api/laundry/customers/[id]/addresses  — add (Home/Office/Other, default,
//   pickup/delivery defaults, landmark, map coordinates)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { isValidPincode } from "@/lib/india"

export const runtime = "nodejs"

async function scopedCustomer(businessId: string | null, id: string) {
  if (!businessId) return null
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return null
  return prisma.customer.findFirst({ where: { id, businessId: biz.platformBusinessId }, select: { id: true } })
}
const ADDR_TYPES = new Set(["HOME", "OFFICE", "OTHER"])

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!(await scopedCustomer(businessId, id))) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    const addresses = await prisma.address.findMany({ where: { customerId: id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] })
    return NextResponse.json({ success: true, data: addresses })
  } catch (e) {
    console.error("[laundry-customer-addresses] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    if (!(await scopedCustomer(b.businessId, id))) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    if (!b.addressLine1?.trim()) return NextResponse.json({ error: "Address Line 1 is required" }, { status: 400 })
    if (b.pincode && !isValidPincode(b.pincode)) return NextResponse.json({ error: "PIN Code must be a valid 6-digit Indian pincode" }, { status: 400 })
    const addressType = ADDR_TYPES.has(String(b.addressType).toUpperCase()) ? String(b.addressType).toUpperCase() : "HOME"

    // Enforce single default / pickup-default / delivery-default per customer
    // (clear the flag on all siblings before setting it here).
    const clearData: Record<string, boolean> = {}
    if (b.isDefault) clearData.isDefault = false
    if (b.isPickupDefault) clearData.isPickupDefault = false
    if (b.isDeliveryDefault) clearData.isDeliveryDefault = false
    if (Object.keys(clearData).length) await prisma.address.updateMany({ where: { customerId: id }, data: clearData as never })

    const existingCount = await prisma.address.count({ where: { customerId: id } })
    const address = await prisma.address.create({
      data: {
        customerId: id, addressType, label: b.label || addressType,
        addressLine1: b.addressLine1.trim(), addressLine2: b.addressLine2 || null, area: b.area || null, landmark: b.landmark || null,
        city: b.city || "", state: b.state || "", pincode: b.pincode || "", country: b.country || "India",
        latitude: b.latitude != null ? Number(b.latitude) : null, longitude: b.longitude != null ? Number(b.longitude) : null,
        instructions: b.instructions || null,
        isDefault: !!b.isDefault || existingCount === 0, // first address is default
        isPickupDefault: !!b.isPickupDefault, isDeliveryDefault: !!b.isDeliveryDefault,
      },
    })
    return NextResponse.json({ success: true, data: address }, { status: 201 })
  } catch (e) {
    console.error("[laundry-customer-addresses] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
