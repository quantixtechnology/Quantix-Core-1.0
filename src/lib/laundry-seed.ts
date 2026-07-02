// Laundry demo seed — populates a workspace's operational masters (Categories,
// Services, Garments) and Pricing so an order can be created immediately.
// Idempotent PER TABLE: each table is seeded only when empty, so it never
// duplicates and never overwrites a tenant's real data.

import { prisma } from "@/lib/prisma"

const CATEGORIES = ["Men", "Women", "Kids", "Household", "Winter Wear", "Premium Wear", "Accessories"]

const SERVICES: { name: string; tat: number }[] = [
  { name: "Wash", tat: 24 }, { name: "Wash & Iron", tat: 24 }, { name: "Iron Only", tat: 12 },
  { name: "Dry Clean", tat: 48 }, { name: "Steam Iron", tat: 12 }, { name: "Premium Wash", tat: 48 },
  { name: "Express Wash", tat: 6 }, { name: "Curtain Cleaning", tat: 72 }, { name: "Blanket Cleaning", tat: 72 },
  { name: "Shoe Cleaning", tat: 72 },
]

const GARMENTS: { name: string; cat: string }[] = [
  { name: "Shirt", cat: "Men" }, { name: "Pant", cat: "Men" }, { name: "Jeans", cat: "Men" },
  { name: "T-Shirt", cat: "Men" }, { name: "Kurta", cat: "Men" }, { name: "Blazer", cat: "Premium Wear" },
  { name: "Suit", cat: "Premium Wear" }, { name: "Coat", cat: "Winter Wear" }, { name: "Sherwani", cat: "Premium Wear" },
  { name: "Saree", cat: "Women" }, { name: "Blanket", cat: "Household" }, { name: "Curtain", cat: "Household" },
  { name: "Bedsheet", cat: "Household" }, { name: "Pillow Cover", cat: "Household" }, { name: "Jacket", cat: "Winter Wear" },
  { name: "Sweater", cat: "Winter Wear" },
]

const PRICING: { service: string; garment: string; price: number }[] = [
  { service: "Wash", garment: "Shirt", price: 40 }, { service: "Wash", garment: "Pant", price: 50 },
  { service: "Wash", garment: "Jeans", price: 60 }, { service: "Wash", garment: "T-Shirt", price: 35 },
  { service: "Wash & Iron", garment: "Shirt", price: 70 }, { service: "Wash & Iron", garment: "Pant", price: 80 },
  { service: "Wash & Iron", garment: "Jeans", price: 90 },
  { service: "Iron Only", garment: "Shirt", price: 20 }, { service: "Iron Only", garment: "Pant", price: 25 },
  { service: "Dry Clean", garment: "Blazer", price: 180 }, { service: "Dry Clean", garment: "Suit", price: 350 },
  { service: "Dry Clean", garment: "Sherwani", price: 450 }, { service: "Dry Clean", garment: "Saree", price: 250 },
  { service: "Dry Clean", garment: "Curtain", price: 300 }, { service: "Dry Clean", garment: "Blanket", price: 450 },
  { service: "Steam Iron", garment: "Shirt", price: 35 }, { service: "Steam Iron", garment: "Pant", price: 40 },
]

export interface SeedResult { categories: number; services: number; garments: number; pricing: number; alreadySeeded: boolean }

// businessId here is the LaundryBusiness.id (masters + pricing are keyed by it).
export async function seedLaundryDemo(businessId: string): Promise<SeedResult> {
  const [catCount, svcCount, grmCount, priceCount] = await Promise.all([
    prisma.laundryCategory.count({ where: { businessId } }),
    prisma.laundryService.count({ where: { businessId } }),
    prisma.laundryGarment.count({ where: { businessId } }),
    prisma.laundryPricingRule.count({ where: { businessId } }),
  ])
  const res: SeedResult = { categories: 0, services: 0, garments: 0, pricing: 0, alreadySeeded: false }

  // Categories
  const catMap = new Map<string, string>()
  if (catCount === 0) {
    for (let i = 0; i < CATEGORIES.length; i++) {
      const c = await prisma.laundryCategory.create({ data: { businessId, name: CATEGORIES[i], displayOrder: i, isActive: true } })
      catMap.set(CATEGORIES[i], c.id); res.categories++
    }
  } else {
    (await prisma.laundryCategory.findMany({ where: { businessId }, select: { id: true, name: true } })).forEach((c) => catMap.set(c.name, c.id))
  }

  // Services
  const svcMap = new Map<string, string>()
  if (svcCount === 0) {
    for (let i = 0; i < SERVICES.length; i++) {
      const s = await prisma.laundryService.create({ data: { businessId, name: SERVICES[i].name, defaultTurnaroundHours: SERVICES[i].tat, defaultPricingType: "PER_PIECE", availableInStore: true, availableForPickup: true, isActive: true, displayOrder: i } })
      svcMap.set(SERVICES[i].name, s.id); res.services++
    }
  } else {
    (await prisma.laundryService.findMany({ where: { businessId }, select: { id: true, name: true } })).forEach((s) => svcMap.set(s.name, s.id))
  }

  // Garments
  const grmMap = new Map<string, string>()
  if (grmCount === 0) {
    for (let i = 0; i < GARMENTS.length; i++) {
      const g = GARMENTS[i]
      const created = await prisma.laundryGarment.create({ data: { businessId, name: g.name, categoryId: catMap.get(g.cat) || null, defaultUnit: "PIECE", isActive: true, displayOrder: i } })
      grmMap.set(g.name, created.id); res.garments++
    }
  } else {
    (await prisma.laundryGarment.findMany({ where: { businessId }, select: { id: true, name: true } })).forEach((g) => grmMap.set(g.name, g.id))
  }

  // Pricing (PER_PIECE rules linking service + garment)
  if (priceCount === 0) {
    for (const p of PRICING) {
      const serviceId = svcMap.get(p.service), garmentId = grmMap.get(p.garment)
      if (!serviceId || !garmentId) continue
      await prisma.laundryPricingRule.create({ data: { businessId, name: `${p.service} — ${p.garment}`, serviceId, garmentId, pricingType: "PER_PIECE", price: p.price, gstPercent: 0, status: "ACTIVE", isActive: true, priority: 10 } })
      res.pricing++
    }
  }

  res.alreadySeeded = res.categories === 0 && res.services === 0 && res.garments === 0 && res.pricing === 0
  return res
}
