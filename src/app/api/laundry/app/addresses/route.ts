// GET  /api/laundry/app/addresses — saved addresses (Phase 3)
// POST /api/laundry/app/addresses — add (Home/Office/Other, default, pickup/
//   delivery defaults, landmark, map coordinates)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"
import { isValidPincode } from "@/lib/india"

export const runtime = "nodejs"
const ADDR_TYPES = new Set(["HOME", "OFFICE", "OTHER"])

export async function GET(request: Request) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const addresses = await prisma.address.findMany({ where: { customerId: sess.customerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] })
  return NextResponse.json({ success: true, data: addresses })
}

export async function POST(request: Request) {
  const sess = await resolveSession(bearerToken(request))
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  if (!b.addressLine1?.trim()) return NextResponse.json({ error: "Address Line 1 is required" }, { status: 400 })
  if (b.pincode && !isValidPincode(b.pincode)) return NextResponse.json({ error: "PIN Code must be a valid 6-digit Indian pincode" }, { status: 400 })
  const addressType = ADDR_TYPES.has(String(b.addressType).toUpperCase()) ? String(b.addressType).toUpperCase() : "HOME"

  const clearData: Record<string, boolean> = {}
  if (b.isDefault) clearData.isDefault = false
  if (b.isPickupDefault) clearData.isPickupDefault = false
  if (b.isDeliveryDefault) clearData.isDeliveryDefault = false
  if (Object.keys(clearData).length) await prisma.address.updateMany({ where: { customerId: sess.customerId }, data: clearData as never })

  const count = await prisma.address.count({ where: { customerId: sess.customerId } })
  const address = await prisma.address.create({ data: {
    customerId: sess.customerId, addressType, label: b.label || addressType,
    addressLine1: b.addressLine1.trim(), addressLine2: b.addressLine2 || null, area: b.area || null, landmark: b.landmark || null,
    city: b.city || "", state: b.state || "", pincode: b.pincode || "", country: b.country || "India",
    latitude: b.latitude != null ? Number(b.latitude) : null, longitude: b.longitude != null ? Number(b.longitude) : null,
    instructions: b.instructions || null, isDefault: !!b.isDefault || count === 0, isPickupDefault: !!b.isPickupDefault, isDeliveryDefault: !!b.isDeliveryDefault,
  } })
  return NextResponse.json({ success: true, data: address }, { status: 201 })
}
