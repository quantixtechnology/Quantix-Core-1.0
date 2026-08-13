// GET /api/laundry/app/catalog — services + priced garments the customer can
// order (Phase 5). Read-only against the frozen pricing config.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveSession, bearerToken } from "@/lib/laundry-app-auth"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const sess = await resolveSession(request)
  if (!sess) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const biz = await resolveLaundryBusiness(sess.businessId)
  if (!biz) return NextResponse.json({ success: true, data: { services: [] } })

  const [services, garments, rules] = await Promise.all([
    prisma.laundryService.findMany({ where: { businessId: biz.id, isActive: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, description: true, image: true } }),
    prisma.laundryGarment.findMany({ where: { businessId: biz.id, isActive: true }, select: { id: true, name: true, image: true } }),
    prisma.laundryPricingRule.findMany({ where: { service: { businessId: biz.id }, garmentId: { not: null }, isActive: true }, select: { serviceId: true, garmentId: true, price: true, pricingType: true, minWeightKg: true } }),
  ])
  const gName = new Map(garments.map((g) => [g.id, g]))
  const bySvc = new Map<string, { garmentId: string; name: string; image: string | null; price: number; pricingType: string; minWeightKg: number | null }[]>()
  for (const r of rules) {
    if (!r.serviceId || !r.garmentId) continue
    const g = gName.get(r.garmentId); if (!g) continue
    const arr = bySvc.get(r.serviceId) || []
    arr.push({ garmentId: r.garmentId, name: g.name, image: g.image, price: r.price, pricingType: r.pricingType, minWeightKg: r.minWeightKg })
    bySvc.set(r.serviceId, arr)
  }
  const data = services
    .map((s) => ({ id: s.id, name: s.name, description: s.description, image: s.image, garments: bySvc.get(s.id) || [] }))
    .filter((s) => s.garments.length > 0)
  return NextResponse.json({ success: true, data: { services: data } })
}
