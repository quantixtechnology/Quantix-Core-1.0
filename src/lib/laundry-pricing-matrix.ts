// Pricing Matrix — writes garment×service pricing as the SAME base-scope
// LaundryPricingRule rows the Pricing Engine already reads (garment+service,
// storeId/customerType/categoryId null). No engine change; fully backward
// compatible. A cell is NOT_AVAILABLE (rule deactivated, history kept),
// PER_PIECE or PER_KG. Reused by the garment editor + bulk import.
import { prisma } from "@/lib/prisma"

export type CellMode = "NOT_AVAILABLE" | "PER_PIECE" | "PER_KG"
export interface Cell { serviceId: string; mode: CellMode; price?: number | null; minWeightKg?: number | null }

export async function saveGarmentCells(lbId: string, garmentId: string, garmentName: string, cells: Cell[], serviceName: (id: string) => string) {
  for (const c of cells) {
    const existing = await prisma.laundryPricingRule.findFirst({
      where: { businessId: lbId, serviceId: c.serviceId, garmentId, storeId: null, customerType: null },
      orderBy: { updatedAt: "desc" },
    })
    if (c.mode === "NOT_AVAILABLE") {
      // Keep history — just deactivate any existing garment+service rule.
      if (existing) await prisma.laundryPricingRule.updateMany({ where: { businessId: lbId, serviceId: c.serviceId, garmentId, storeId: null, customerType: null }, data: { isActive: false, status: "INACTIVE" } })
      continue
    }
    const price = Math.max(0, Number(c.price) || 0)
    const minW = c.mode === "PER_KG" && c.minWeightKg != null ? Number(c.minWeightKg) : null
    if (existing) {
      await prisma.laundryPricingRule.update({ where: { id: existing.id }, data: { price, pricingType: c.mode, categoryId: null, minWeightKg: minW, isActive: true, status: "ACTIVE" } })
    } else {
      await prisma.laundryPricingRule.create({ data: { businessId: lbId, name: `${serviceName(c.serviceId)} · ${garmentName}`, serviceId: c.serviceId, garmentId, categoryId: null, storeId: null, customerType: null, pricingType: c.mode, price, minWeightKg: minW, gstPercent: 0, priority: 0, status: "ACTIVE", isActive: true } })
    }
  }
}
