// ============================================================================
// CHECK: Store Location (Store GPS)
// Verifies every operational store (Store + LaundryStore) has the fields the
// serviceability engine needs: lat/lng, delivery radius, pickup radius,
// address, and a Google Place ID. Missing fields surface as warnings.
// ============================================================================

import { registerHealthCheck } from "../registry"
import { db } from "@/lib/db"
import type { StoreHealthRow } from "../types"

interface RawStore {
  id: string
  businessId: string
  name: string
  latitude: number | null
  longitude: number | null
  deliveryRadius?: number | null
  pickupRadiusKm?: number | null
  address?: string | null
  googlePlaceId?: string | null
}

function verifyStore(raw: RawStore, kind: "store" | "laundryStore", businessName: string): StoreHealthRow {
  const missing: string[] = []
  const hasLatitude = typeof raw.latitude === "number" && Number.isFinite(raw.latitude)
  const hasLongitude = typeof raw.longitude === "number" && Number.isFinite(raw.longitude)
  const hasDeliveryRadius =
    typeof raw.deliveryRadius === "number" && Number.isFinite(raw.deliveryRadius) && (raw.deliveryRadius ?? 0) > 0
  const hasPickupRadius =
    typeof raw.pickupRadiusKm === "number" && Number.isFinite(raw.pickupRadiusKm) && (raw.pickupRadiusKm ?? 0) > 0
  const hasAddress = typeof raw.address === "string" && raw.address.trim().length > 0
  const hasPlaceId = typeof raw.googlePlaceId === "string" && raw.googlePlaceId.trim().length > 0

  if (!hasLatitude) missing.push("latitude")
  if (!hasLongitude) missing.push("longitude")
  if (!hasDeliveryRadius) missing.push("deliveryRadius")
  if (!hasPickupRadius) missing.push("pickupRadius")
  if (!hasAddress) missing.push("address")
  if (!hasPlaceId) missing.push("placeId")

  return {
    storeId: raw.id,
    kind,
    businessId: raw.businessId,
    businessName,
    name: raw.name,
    fields: {
      latitude: hasLatitude,
      longitude: hasLongitude,
      deliveryRadius: hasDeliveryRadius,
      pickupRadius: hasPickupRadius,
      address: hasAddress,
      placeId: hasPlaceId,
    },
    missing,
    complete: missing.length === 0,
  }
}

registerHealthCheck({
  id: "store-gps",
  label: "Store Location",
  apiName: "Store GPS Data",
  async run() {
    const [stores, laundryStores, businesses, laundryBusinesses] = await Promise.all([
      db.store.findMany({
        select: { id: true, businessId: true, name: true, latitude: true, longitude: true, deliveryRadius: true, pickupRadiusKm: true, address: true, googlePlaceId: true },
      }),
      db.laundryStore.findMany({
        select: { id: true, laundryBusinessId: true, storeName: true, latitude: true, longitude: true, serviceRadiusKm: true, address: true, googlePlaceId: true },
      }),
      db.business.findMany({ select: { id: true, name: true } }),
      db.laundryBusiness.findMany({ select: { id: true, businessName: true } }),
    ])

    const bizNames = new Map(businesses.map((b) => [b.id, b.name]))
    const laundryBizNames = new Map(laundryBusinesses.map((b) => [b.id, b.businessName]))

    const rows: StoreHealthRow[] = [
      ...stores.map((s) =>
        verifyStore(
          { id: s.id, businessId: s.businessId, name: s.name, latitude: s.latitude, longitude: s.longitude, deliveryRadius: s.deliveryRadius, pickupRadiusKm: s.pickupRadiusKm, address: s.address, googlePlaceId: s.googlePlaceId },
          "store",
          bizNames.get(s.businessId) ?? "Unknown business",
        ),
      ),
      ...laundryStores.map((s) =>
        verifyStore(
          { id: s.id, businessId: s.laundryBusinessId, name: s.storeName, latitude: s.latitude, longitude: s.longitude, deliveryRadius: s.serviceRadiusKm, pickupRadiusKm: s.serviceRadiusKm, address: s.address, googlePlaceId: s.googlePlaceId },
          "laundryStore",
          laundryBizNames.get(s.laundryBusinessId) ?? "Unknown business",
        ),
      ),
    ]

    const complete = rows.filter((r) => r.complete).length
    const incomplete = rows.length - complete
    const missingFields = rows.reduce((acc, r) => acc + r.missing.length, 0)

    return {
      id: "store-gps",
      label: "Store Location",
      status: incomplete === 0 ? "healthy" : "warning",
      summary: incomplete === 0 ? "Configured" : `${incomplete} store${incomplete === 1 ? "" : "s"} incomplete`,
      detail:
        rows.length === 0
          ? "No stores configured yet."
          : `${rows.length} store(s) verified across all businesses. ${complete} complete; ${incomplete} missing ${missingFields} field(s) total.`,
      apiName: "Store GPS Data",
      suggestedFix:
        incomplete === 0
          ? undefined
          : "Open each incomplete store and set its coordinates, delivery/pickup radius, address, and Google Place ID using the Store Location picker.",
      data: { rows, totalStores: rows.length, incompleteStores: incomplete },
    }
  },
})