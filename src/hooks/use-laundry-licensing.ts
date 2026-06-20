"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export type LicensingInfo = Record<string, boolean>

const CACHE: Record<string, { data: LicensingInfo; ts: number }> = {}
const CACHE_TTL = 60_000

function emptyLicensing(): LicensingInfo {
  return {
    transportEnabled: true,
    barcodeTaggingEnabled: true,
    ironingEnabled: true,
    homeDeliveryEnabled: true,
    photoAuditEnabled: false,
    multiStoreEnabled: false,
    multiProcessingEnabled: false,
    employeeManagementEnabled: false,
    membershipEnabled: false,
    loyaltyEnabled: false,
    whatsappIntegrationEnabled: false,
    smsIntegrationEnabled: false,
    advancedReportsEnabled: false,
  }
}

export function useLaundryLicensing(businessId?: string | null) {
  const [licensing, setLicensing] = useState<LicensingInfo>(emptyLicensing())
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchLicensing = useCallback(async () => {
    if (!businessId) {
      if (mountedRef.current) {
        setLicensing(emptyLicensing())
        setLoading(false)
      }
      return
    }

    const cached = CACHE[businessId]
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (mountedRef.current) {
        setLicensing(cached.data)
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}`)
      if (res.ok) {
        const data = await res.json()
        const extracted: LicensingInfo = {
          transportEnabled: !!data.transportEnabled,
          barcodeTaggingEnabled: !!data.barcodeTaggingEnabled,
          ironingEnabled: !!data.ironingEnabled,
          homeDeliveryEnabled: !!data.homeDeliveryEnabled,
          photoAuditEnabled: !!data.photoAuditEnabled,
          multiStoreEnabled: !!data.multiStoreEnabled,
          multiProcessingEnabled: !!data.multiProcessingEnabled,
          employeeManagementEnabled: !!data.employeeManagementEnabled,
          membershipEnabled: !!data.membershipEnabled,
          loyaltyEnabled: !!data.loyaltyEnabled,
          whatsappIntegrationEnabled: !!data.whatsappIntegrationEnabled,
          smsIntegrationEnabled: !!data.smsIntegrationEnabled,
          advancedReportsEnabled: !!data.advancedReportsEnabled,
        }
        CACHE[businessId] = { data: extracted, ts: Date.now() }
        if (mountedRef.current) setLicensing(extracted)
      }
    } catch { /* ignore */ }
    finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [businessId])

  useEffect(() => { fetchLicensing() }, [fetchLicensing])

  const isEnabled = useCallback((feature: string): boolean => {
    return !!(licensing as Record<string, boolean | undefined>)[feature]
  }, [licensing])

  return { licensing, loading, isEnabled, refetch: fetchLicensing }
}
