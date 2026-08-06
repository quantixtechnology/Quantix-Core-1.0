// ============================================================================
// CHECK: Customer Location (Customer GPS)
// Verifies customers have geocoded delivery addresses so the serviceability
// engine and map picker can locate them. Missing coordinates block service.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { db } from "@/lib/db"

registerHealthCheck({
  id: "customer-gps",
  label: "Customer Location",
  apiName: "Customer GPS Data",
  async run() {
    const [total, withCoords] = await Promise.all([
      db.address.count(),
      db.address.count({ where: { NOT: { OR: [{ latitude: null }, { longitude: null }] } } }),
    ])

    return {
      id: "customer-gps",
      label: "Customer Location",
      status: total === 0 ? "warning" : withCoords > 0 ? "healthy" : "warning",
      summary: withCoords > 0 ? "Available" : total === 0 ? "No addresses" : "No coordinates",
      detail:
        total === 0
          ? "No saved customer addresses yet."
          : `${withCoords} of ${total} saved customer address(es) have coordinates (lat/lng). Addresses without coordinates cannot be located on the map or served by the serviceability engine.`,
      apiName: "Customer GPS Data",
      suggestedFix:
        withCoords === total
          ? undefined
          : "Ask customers to re-save their addresses using the map picker so lat/lng (and Place ID) are captured.",
      data: { total, withCoords, coveragePct: total === 0 ? 0 : Math.round((withCoords / total) * 100) },
    }
  },
})