"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { X, Loader2, MapPin, Navigation, Check, ChevronDown, ChevronUp } from "lucide-react"
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps"
import { reverseGeocodeAddress, formatAddressLine } from "@/lib/delivery-address"
import type { DeliveryAddress } from "@/stores/cart-store"
import { PlacesAutocomplete } from "./places-autocomplete"
import { ServiceabilityPreview } from "./serviceability-preview"

interface GoogleAddressPickerProps {
  open: boolean
  initial?: DeliveryAddress | null
  brandColor: string
  businessId?: string | null
  saveLabel?: string
  onSave: (address: DeliveryAddress) => Promise<boolean>
  onClose: () => void
}

// Extreme fallback only: no saved address, no browser position and no business
// store location. Neutral India-wide point (never a brand-specific city like
// Mumbai/Bengaluru — customers are spread across the country).
const DEFAULT_CENTER = { lat: 22.5937, lng: 78.9629 }
const LABELS = ["Home", "Office", "Other"]

/**
 * Map-first Google address picker (Swiggy / Blinkit style). Full screen map with
 * a draggable pin, Places search on top, current-location, reverse geocoding,
 * live serviceability preview and a Save button gated until a valid coordinate
 * has been resolved. Degrades to manual entry + GPS when no Maps key is set.
 */
export function GoogleAddressPicker({
  open,
  initial,
  brandColor,
  businessId,
  saveLabel = "Save Address",
  onSave,
  onClose,
}: GoogleAddressPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<{ setCenter: (c: { lat: number; lng: number }) => void } | null>(null)
  const markerInstance = useRef<{ setPosition: (c: { lat: number; lng: number }) => void } | null>(null)
  const reverseGeocoderRef = useRef<unknown | null>(null)
  const initialRef = useRef<DeliveryAddress | null>(null)
  // Holds the most recent user-selected coordinates until the map is ready so a
  // search performed while the map is still loading is never lost (fixes the
  // "searched Hegde Nagar but the marker stayed in Mumbai" bug).
  const pendingCoordsRef = useRef<{ lat: number | null; lng: number | null; placeId?: string | null } | null>(null)

  /**
   * Resolve an initial map center in priority order:
   *   1. Customer's existing address (or a pending user selection)
   *   2. Browser geolocation, when the user consents
   *   3. The business store location (from /store-context)
   *   4. Neutral India-wide fallback (never a brand-specific city)
   *
   * Browser location takes precedence over the store so a new visitor in
   * Delhi/Chennai/etc. isn't thrown to the store's city.
   */
  async function resolveInitialCenter(
    init: DeliveryAddress | null,
    pending: { lat: number | null; lng: number | null } | null,
  ): Promise<{ lat: number; lng: number }> {
    const fromUser = pending?.lat != null && pending?.lng != null
      ? { lat: pending.lat, lng: pending.lng }
      : init?.latitude != null && init?.longitude != null
        ? { lat: init.latitude, lng: init.longitude }
        : null
    if (fromUser) return fromUser

    // Browser geolocation is the preferred source for a pan-India customer but
    // it is still best-effort — if the user denies or it times out we fall back
    // to the store, and only then to the neutral default.
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((ok, bad) =>
          navigator.geolocation.getCurrentPosition(ok, bad, { timeout: 5000, enableHighAccuracy: false }),
        )
        return { lat: pos.coords.latitude, lng: pos.coords.longitude }
      } catch {
        // browser denied / timed out — try the business store next
      }
    }

    // Fetch the active main store location for this business so the map at least
    // lands in the right region of India even without browser permission.
    try {
      if (businessId) {
        const res = await fetch(`/api/core/storefront/store-context?businessId=${encodeURIComponent(businessId)}`)
        if (res.ok) {
          const json = await res.json()
          const store = json?.data?.store ?? json?.store
          if (store && typeof store.latitude === "number" && typeof store.longitude === "number") {
            return { lat: store.latitude, lng: store.longitude }
          }
        }
      }
    } catch {
      // ignore — fall through to default
    }
    return DEFAULT_CENTER
  }

  const [mapsReady, setMapsReady] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [locating, setLocating] = useState(false)
  const [address, setAddress] = useState<DeliveryAddress | null>(null)
  const [saving, setSaving] = useState(false)
  const [svcStatus, setSvcStatus] = useState<"idle" | "loading" | "done">("idle")
  const [error, setError] = useState("")
  const [showDetails, setShowDetails] = useState(false)
  const [isEdit, setIsEdit] = useState(false)

  // Snapshot the initial address whenever the picker opens.
  useEffect(() => {
    if (open) {
      initialRef.current = initial ?? null
      setAddress(initial ?? null)
      setIsEdit(!!initial?.id)
      setError("")
      setSaving(false)
      setGeocoding(false)
      setLocating(false)
      setShowDetails(false)
      setMapsReady(false)
      setSvcStatus("idle")
      pendingCoordsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /**
   * Single path for every way a location is chosen (search / marker drag / My
   * Location). Keeps marker, map center, coordinates and address strictly in
   * sync. When the map isn't ready yet the coordinates are parked in
   * `pendingCoordsRef` and applied as soon as the map initializes — so the
   * marker ALWAYS follows the last selection and stale coordinates never leak.
   */
  const syncLocation = useCallback((google: any, lat: number, lng: number, precomputed?: Partial<DeliveryAddress>) => {
    pendingCoordsRef.current = { lat, lng, placeId: precomputed?.googlePlaceId ?? null }
    if (mapInstance.current && markerInstance.current) {
      mapInstance.current.setCenter({ lat, lng })
      markerInstance.current.setPosition({ lat, lng })
    }
    setError("")
    setGeocoding(true)
    reverseGeocodeAddress(google, lat, lng)
      .then((addr) => {
        const keep = initialRef.current
        setAddress((prev) => ({
          ...(addr ?? {}),
          ...(precomputed ?? {}),
          latitude: lat,
          longitude: lng,
          googlePlaceId: precomputed?.googlePlaceId || addr?.googlePlaceId || null,
          formattedAddress: precomputed?.formattedAddress || addr?.formattedAddress || null,
          id: keep?.id ?? prev?.id,
          label: prev?.label ?? keep?.label ?? addr?.label ?? "Home",
          instructions: prev?.instructions ?? keep?.instructions,
        }))
      })
      .catch(() => {
        // Reverse geocode failed — keep coordinates + any search data, but flag
        // it so an incomplete address can never be silently saved.
        setError("Could not resolve this location. Drag the pin to retry.")
      })
      .finally(() => setGeocoding(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    if (!hasGoogleMapsKey()) return
    let mounted = true

    loadGoogleMaps()
      .then(async (google) => {
        if (!mounted || !mapRef.current) return
        const init = initialRef.current
        const pending = pendingCoordsRef.current

        // Resolve the true initial center BEFORE painting the map so the first
        // frame is already correct (browser location → store → India default).
        // The picker's loading overlay covers this brief async wait.
        const center = await resolveInitialCenter(init, pending)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map = new google.maps.Map(mapRef.current as HTMLElement, {
          center,
          zoom: 16,
          disableDefaultUI: false,
          gestureHandling: "cooperative",
        })
        mapInstance.current = map

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const marker = new google.maps.Marker({
          position: center,
          map,
          draggable: true,
          animation: google.maps.Animation.DROP,
        })
        markerInstance.current = marker
        reverseGeocoderRef.current = google

        if (pending && typeof pending.lat === "number" && typeof pending.lng === "number") {
          // A search happened before the map was ready — now the marker follows it.
          syncLocation(google, pending.lat, pending.lng, { googlePlaceId: pending.placeId ?? null })
        } else if (typeof init?.latitude === "number" && typeof init?.longitude === "number") {
          setAddress(init)
        } else if (center && typeof center.lat === "number" && typeof center.lng === "number") {
          // The resolved center came from browser location / store / neutral
          // default: reverse geocode it so the address reflects where we landed
          // and the marker is never a lone dot with no address text.
          syncLocation(google, center.lat, center.lng)
        }

        marker.addListener("dragend", () => {
          const pos = marker.getPosition()
          if (!pos) return
          syncLocation(google, pos.lat(), pos.lng())
        })

        setMapsReady(true)
      })
      .catch(() => {
        if (mounted) setError("Could not load the map. Please try again.")
      })

    return () => {
      mounted = false
      mapInstance.current = null
      markerInstance.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not available on this device.")
      return
    }
    setLocating(true)
    setError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (reverseGeocoderRef.current) {
          syncLocation(reverseGeocoderRef.current, pos.coords.latitude, pos.coords.longitude)
        } else {
          pendingCoordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setAddress((p) => ({ ...(p ?? {}), label: p?.label ?? "My Location", latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
        }
        setLocating(false)
      },
      () => {
        setError("Location access denied. Search for your address or drop a pin instead.")
        setLocating(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const onPlaceSelected = (addr: DeliveryAddress) => {
    if (reverseGeocoderRef.current && addr.latitude != null && addr.longitude != null) {
      // Route the search through the SAME sync path so marker, map, coordinates
      // and reverse geocoding always reference one location.
      syncLocation(reverseGeocoderRef.current, addr.latitude, addr.longitude, {
        googlePlaceId: addr.googlePlaceId ?? null,
        formattedAddress: addr.formattedAddress ?? null,
        addressLine1: addr.addressLine1,
        area: addr.area,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
      })
    } else {
      pendingCoordsRef.current = {
        lat: addr.latitude ?? null,
        lng: addr.longitude ?? null,
        placeId: addr.googlePlaceId ?? null,
      }
      const keep = initialRef.current
      setAddress({ ...addr, id: keep?.id, label: address?.label ?? keep?.label ?? addr.label ?? "Home", instructions: address?.instructions ?? keep?.instructions })
      setError("")
    }
  }

  const patch = (updates: Partial<DeliveryAddress>) => setAddress((p) => ({ ...(p ?? {}), ...updates }))

  const noKey = !hasGoogleMapsKey()

  const hasCoords =
    typeof address?.latitude === "number" && typeof address?.longitude === "number"
  const resolved =
    !geocoding && !!address && !!(address.addressLine1 || address.city || address.pincode)
  // PHASE 6 — an address is only complete when it carries BOTH coordinates and a
  // Google Place ID. Never save coords without a Place ID, never save text
  // without coordinates.
  const hasPlaceId = !!address?.googlePlaceId
  // PHASE 4 — the Save button stays disabled until the serviceability
  // calculation for the current pin has finished.
  const canSave = noKey
    ? !!(address?.addressLine1 && address?.city && address?.pincode) && !saving
    : hasCoords && hasPlaceId && resolved && svcStatus !== "loading" && !saving

  const submit = async () => {
    if (!address) return
    setSaving(true)
    setError("")
    try {
      const ok = await onSave(address)
      if (ok) onClose()
    } catch {
      setError("Could not save this address. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputCls = "w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 bg-white"

  return (
    <div className="fixed inset-0 z-[230] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100 shrink-0">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-bold text-gray-900 text-[15px]">
          {isEdit ? "Edit Address" : "Add Address"}
        </h2>
        <button
          onClick={useMyLocation}
          disabled={locating || (!noKey && !mapsReady)}
          className="ml-auto flex items-center gap-1.5 px-3 h-9 text-xs font-semibold rounded-full border"
          style={{ borderColor: `${brandColor}55`, color: brandColor }}
        >
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
          My location
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <PlacesAutocomplete onSelect={onPlaceSelected} />
      </div>

      {noKey ? (
        /* ── Manual entry fallback (only when no Maps key is baked in) ────── */
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex gap-2 mb-3">
            {LABELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => patch({ label: l })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={address?.label === l ? { borderColor: brandColor, backgroundColor: `${brandColor}10`, color: brandColor } : { borderColor: "#e5e7eb", color: "#4b5563" }}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed rounded-xl text-xs font-medium transition-colors mb-4 disabled:opacity-60"
            style={{ borderColor: `${brandColor}60`, color: brandColor }}
          >
            {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            Use Current Location
          </button>
          {hasCoords && (
            <p className="text-[10px] text-center text-green-600 mb-3">
              Location captured ({address!.latitude!.toFixed(4)}, {address!.longitude!.toFixed(4)})
            </p>
          )}
          <div className="space-y-3">
            <input type="text" placeholder="Area / Locality" value={address?.area ?? ""} onChange={(e) => patch({ area: e.target.value })} className={inputCls} />
            <input type="text" placeholder="House No / Street *" value={address?.addressLine1 ?? ""} onChange={(e) => patch({ addressLine1: e.target.value })} className={inputCls} />
            <input type="text" placeholder="Landmark (optional)" value={address?.landmark ?? ""} onChange={(e) => patch({ landmark: e.target.value })} className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="City *" value={address?.city ?? ""} onChange={(e) => patch({ city: e.target.value })} className={inputCls} />
              <input type="text" placeholder="State" value={address?.state ?? ""} onChange={(e) => patch({ state: e.target.value })} className={inputCls} />
            </div>
            <input type="text" placeholder="Pincode *" value={address?.pincode ?? ""} onChange={(e) => patch({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} className={inputCls} />
          </div>
        </div>
      ) : (
        /* ── Map-first picker ──────────────────────────────────────────────── */
        <div className="relative flex-1">
          {!mapsReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-[2]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                <p className="text-xs text-gray-400">Loading map…</p>
              </div>
            </div>
          )}
          <div ref={mapRef} className="absolute inset-0" />
          {error && !mapsReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-[2]">
              <div className="max-w-xs text-center px-4">
                <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{error}</p>
              </div>
            </div>
          )}

          {mapsReady && (
            <div className="absolute bottom-4 inset-x-4 sm:max-w-md sm:mx-auto z-[3]">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 max-h-[60vh] overflow-y-auto">
                {/* Selected location */}
                <div className="flex items-start gap-2 mb-3">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: brandColor }} />
                  <div className="flex-1 min-w-0">
                    {geocoding ? (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Resolving location…
                      </p>
                    ) : address?.addressLine1 || address?.city ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900">{formatAddressLine(address)}</p>
                        {address?.formattedAddress && address.formattedAddress !== formatAddressLine(address) && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{address.formattedAddress}</p>
                        )}
                        {hasCoords && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            ({address!.latitude!.toFixed(5)}, {address!.longitude!.toFixed(5)})
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Search for your address, use my location, or drag the pin.</p>
                    )}
                  </div>
                </div>

                {/* Label chips */}
                <div className="flex gap-2 mb-3">
                  {LABELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => patch({ label: l })}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                      style={address?.label === l ? { borderColor: brandColor, backgroundColor: `${brandColor}10`, color: brandColor } : { borderColor: "#e5e7eb", color: "#4b5563" }}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                {/* Instructions */}
                <textarea
                  placeholder="Delivery instructions (optional) — e.g. call on arrival"
                  value={address?.instructions ?? ""}
                  onChange={(e) => patch({ instructions: e.target.value })}
                  rows={1}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400 resize-none bg-white mb-3"
                />

                {/* Editable detail fields (auto-populated by reverse geocoding) */}
                <button
                  type="button"
                  onClick={() => setShowDetails((s) => !s)}
                  className="flex items-center gap-1 text-xs font-semibold mb-3"
                  style={{ color: brandColor }}
                >
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showDetails ? "Hide address details" : "Edit address details"}
                </button>
                {showDetails && (
                  <div className="space-y-3 mb-3">
                    <input type="text" placeholder="House No / Street" value={address?.addressLine1 ?? ""} onChange={(e) => patch({ addressLine1: e.target.value })} className={inputCls} />
                    <input type="text" placeholder="Area / Locality" value={address?.area ?? ""} onChange={(e) => patch({ area: e.target.value })} className={inputCls} />
                    <input type="text" placeholder="Landmark (optional)" value={address?.landmark ?? ""} onChange={(e) => patch({ landmark: e.target.value })} className={inputCls} />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="City" value={address?.city ?? ""} onChange={(e) => patch({ city: e.target.value })} className={inputCls} />
                      <input type="text" placeholder="State" value={address?.state ?? ""} onChange={(e) => patch({ state: e.target.value })} className={inputCls} />
                    </div>
                    <input type="text" placeholder="Pincode" value={address?.pincode ?? ""} onChange={(e) => patch({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} className={inputCls} />
                  </div>
                )}

                {/* Live serviceability preview (never blocks saving) */}
                <div className="mb-3">
                  <ServiceabilityPreview lat={address?.latitude} lng={address?.longitude} brandColor={brandColor} businessId={businessId} onStatus={setSvcStatus} />
                </div>

                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

                <button
                  onClick={submit}
                  disabled={!canSave}
                  className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: brandColor }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saveLabel}
                </button>
                {!canSave && !saving && (
                  <p className="text-[10px] text-gray-400 text-center mt-1.5">
                    {svcStatus === "loading"
                      ? "Checking delivery availability…"
                      : "Drop the pin, search or use my location to select your delivery point."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer save for manual fallback */}
      {noKey && (
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <button
            onClick={submit}
            disabled={!canSave}
            className="w-full h-11 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  )
}
