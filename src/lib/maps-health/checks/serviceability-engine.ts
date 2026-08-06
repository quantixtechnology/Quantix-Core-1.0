// ============================================================================
// CHECK: Serviceability Engine
// Runs a live sample calculation through the SAME engine the storefront uses
// (checkAddressServiceability). For each active, coordinate-bearing store it
// computes a sample customer point and reports distance + inside/outside.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { db } from "@/lib/db"
import { checkAddressServiceability } from "@/lib/core/address-serviceability"
import { haversineDistance, type ServiceLocation } from "@/lib/core/service-location"
import { loadServiceLocations } from "@/lib/core/service-location-providers"
import type { ServiceabilitySample } from "../types"

registerHealthCheck({
  id: "serviceability-engine",
  label: "Serviceability Engine",
  apiName: "Serviceability Engine",
  async run() {
    // Enumerate the distinct businesses that have service locations, and run a
    // sample check per business. We load locations per business (the engine
    // does this internally too) to keep the abstraction seam.
    const businessIds = new Set<string>()

    const genericBizs = await db.store.findMany({ select: { businessId: true }, distinct: ["businessId"] })
    genericBizs.forEach((s) => businessIds.add(s.businessId))

    const laundryBizs = await db.laundryStore.findMany({ select: { laundryBusinessId: true }, distinct: ["laundryBusinessId"] })
    laundryBizs.forEach((s) => businessIds.add(s.laundryBusinessId))

    // Also include businesses that link a launder business to a platform business.
    const linked = await db.laundryBusiness.findMany({
      where: { platformBusinessId: { not: null } },
      select: { id: true, platformBusinessId: true },
    })
    linked.forEach((l) => {
      businessIds.add(l.id)
      if (l.platformBusinessId) businessIds.add(l.platformBusinessId)
    })

    const samples: ServiceabilitySample[] = []
    const businessNames = new Map<string, string>()
    ;(await db.business.findMany({ select: { id: true, name: true } })).forEach((b) =>
      businessNames.set(b.id, b.name),
    )
    ;(await db.laundryBusiness.findMany({ select: { id: true, businessName: true } })).forEach((b) =>
      businessNames.set(b.id, b.businessName),
    )

    for (const businessId of businessIds) {
      const locations = await loadServiceLocations(businessId)
      // Pick the nearest store to a fixed reference point (Bengaluru) as the
      // "sample customer location" — ensures a deterministic live calculation.
      // Stores whose coordinates are unset (null → 0,0 placeholder) are skipped
      // so the sample never reports a bogus ~8600 km distance.
      const refLat = 12.9352
      const refLng = 77.6245
      let sampleLocation: ServiceLocation | null = null
      let sampleDistance = Infinity
      for (const loc of locations) {
        if (!loc.isActive) continue
        if (typeof loc.latitude !== "number" || typeof loc.longitude !== "number") continue
        if (loc.latitude === 0 && loc.longitude === 0) continue
        const d = haversineDistance(refLat, refLng, loc.latitude, loc.longitude)
        if (d < sampleDistance) {
          sampleDistance = d
          sampleLocation = loc
        }
      }
      if (!sampleLocation) continue

      const result = await checkAddressServiceability({
        businessId,
        lat: refLat,
        lng: refLng,
        orderAmount: 1000,
      })

      const radiusKm =
        sampleLocation.serviceRadiusKm > 0
          ? sampleLocation.serviceRadiusKm
          : sampleLocation.maxDeliveryDistanceKm && sampleLocation.maxDeliveryDistanceKm > 0
            ? sampleLocation.maxDeliveryDistanceKm
            : 5

      samples.push({
        businessId,
        businessName: businessNames.get(businessId) ?? "Unknown business",
        storeId: sampleLocation.id,
        storeName: sampleLocation.name,
        storeLat: sampleLocation.latitude,
        storeLng: sampleLocation.longitude,
        customerLabel: "Sample customer point",
        customerLat: refLat,
        customerLng: refLng,
        distanceKm: Math.round(sampleDistance * 100) / 100,
        radiusKm,
        inside: sampleDistance <= radiusKm,
        serviceable: result.serviceable,
        reason: result.reason ?? null,
      })
    }

    return {
      id: "serviceability-engine",
      label: "Serviceability Engine",
      status: samples.some((s) => s.serviceable) ? "healthy" : samples.length === 0 ? "warning" : "warning",
      summary:
        samples.length === 0
          ? "No stores"
          : `${samples.filter((s) => s.serviceable).length}/${samples.length} sample runs serviceable`,
      detail:
        samples.length === 0
          ? "No active stores with coordinates found — nothing to calculate against."
          : `Ran a live sample calculation for ${samples.length} business(es). Each shows store → sample customer → distance → inside/outside using the shared serviceability engine.`,
      apiName: "Serviceability Engine",
      suggestedFix:
        samples.some((s) => s.serviceable)
          ? undefined
          : "Verify stores carry coordinates and a delivery radius; re-pin them with the Store Location picker.",
      data: { samples },
    }
  },
})