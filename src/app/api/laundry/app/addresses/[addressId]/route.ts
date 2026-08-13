// PUT    /api/laundry/app/addresses/[addressId] — edit (Phase 3)
// DELETE /api/laundry/app/addresses/[addressId] — delete
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"
import { isValidPincode } from "@/lib/india"

export const runtime = "nodejs"
const ADDR_TYPES = new Set(["HOME", "OFFICE", "OTHER"])

async function own(customerId: string, addressId: string) {
  return prisma.address.findFirst({ where: { id: addressId, customerId } })
}

export async function PUT(request: Request, { params }: { params: Promise<{ addressId: string }> }) {
  const sess = await resolveSession(request)
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { addressId } = await params
  const addr = await own(sess.customerId, addressId)
  if (!addr) return NextResponse.json({ error: "Address not found" }, { status: 404 })
  const b = await request.json().catch(() => ({}))
  if (b.pincode && !isValidPincode(b.pincode)) return NextResponse.json({ error: "PIN Code must be a valid 6-digit Indian pincode" }, { status: 400 })

  const clearData: Record<string, boolean> = {}
  if (b.isDefault) clearData.isDefault = false
  if (b.isPickupDefault) clearData.isPickupDefault = false
  if (b.isDeliveryDefault) clearData.isDeliveryDefault = false
  if (Object.keys(clearData).length) await prisma.address.updateMany({ where: { customerId: sess.customerId, NOT: { id: addressId } }, data: clearData as never })

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
}

export async function DELETE(request: Request, { params }: { params: Promise<{ addressId: string }> }) {
  const sess = await resolveSession(request)
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { addressId } = await params
  const addr = await own(sess.customerId, addressId)
  if (!addr) return NextResponse.json({ error: "Address not found" }, { status: 404 })
  await prisma.address.delete({ where: { id: addressId } })
  if (addr.isDefault) {
    const next = await prisma.address.findFirst({ where: { customerId: sess.customerId }, orderBy: { createdAt: "asc" } })
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
  }
  return NextResponse.json({ success: true })
}
