// PUT    /api/laundry/customers/[id]/addresses/[addressId]  — edit
// DELETE /api/laundry/customers/[id]/addresses/[addressId]  — remove
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { isValidPincode } from "@/lib/india"

export const runtime = "nodejs"
const ADDR_TYPES = new Set(["HOME", "OFFICE", "OTHER"])

async function scoped(businessId: string | null, customerId: string, addressId: string) {
  if (!businessId) return null
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz?.platformBusinessId) return null
  const cust = await prisma.customer.findFirst({ where: { id: customerId, businessId: biz.platformBusinessId }, select: { id: true } })
  if (!cust) return null
  return prisma.address.findFirst({ where: { id: addressId, customerId } })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  try {
    const { id, addressId } = await params
    const b = await request.json()
    const addr = await scoped(b.businessId, id, addressId)
    if (!addr) return NextResponse.json({ error: "Address not found" }, { status: 404 })
    if (b.pincode && !isValidPincode(b.pincode)) return NextResponse.json({ error: "PIN Code must be a valid 6-digit Indian pincode" }, { status: 400 })

    // Single default / pickup / delivery per customer (clear siblings first).
    const clearData: Record<string, boolean> = {}
    if (b.isDefault) clearData.isDefault = false
    if (b.isPickupDefault) clearData.isPickupDefault = false
    if (b.isDeliveryDefault) clearData.isDeliveryDefault = false
    if (Object.keys(clearData).length) await prisma.address.updateMany({ where: { customerId: id, NOT: { id: addressId } }, data: clearData as never })

    const updated = await prisma.address.update({ where: { id: addressId }, data: {
      ...(b.addressType !== undefined && { addressType: ADDR_TYPES.has(String(b.addressType).toUpperCase()) ? String(b.addressType).toUpperCase() : addr.addressType }),
      ...(b.label !== undefined && { label: b.label || null }),
      ...(b.addressLine1 !== undefined && { addressLine1: b.addressLine1 }),
      ...(b.addressLine2 !== undefined && { addressLine2: b.addressLine2 || null }),
      ...(b.area !== undefined && { area: b.area || null }),
      ...(b.landmark !== undefined && { landmark: b.landmark || null }),
      ...(b.city !== undefined && { city: b.city }),
      ...(b.state !== undefined && { state: b.state }),
      ...(b.pincode !== undefined && { pincode: b.pincode }),
      ...(b.latitude !== undefined && { latitude: b.latitude != null ? Number(b.latitude) : null }),
      ...(b.longitude !== undefined && { longitude: b.longitude != null ? Number(b.longitude) : null }),
      ...(b.instructions !== undefined && { instructions: b.instructions || null }),
      ...(b.isDefault !== undefined && { isDefault: !!b.isDefault }),
      ...(b.isPickupDefault !== undefined && { isPickupDefault: !!b.isPickupDefault }),
      ...(b.isDeliveryDefault !== undefined && { isDeliveryDefault: !!b.isDeliveryDefault }),
    } })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    console.error("[laundry-customer-address] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; addressId: string }> }) {
  try {
    const { id, addressId } = await params
    const businessId = new URL(request.url).searchParams.get("businessId")
    const addr = await scoped(businessId, id, addressId)
    if (!addr) return NextResponse.json({ error: "Address not found" }, { status: 404 })
    await prisma.address.delete({ where: { id: addressId } })
    // Promote another address to default if we removed the default one.
    if (addr.isDefault) {
      const next = await prisma.address.findFirst({ where: { customerId: id }, orderBy: { createdAt: "asc" } })
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-customer-address] DELETE", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
