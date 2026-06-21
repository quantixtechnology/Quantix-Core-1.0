"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface LaundrySubscription {
  id: string
  businessId: string
  plan: string
  templatePreset: string
  billingCycle: string
  status: string
  startDate: string
  renewalDate: string
  trialExpiry: string | null
  lastPaymentDate: string | null
  nextInvoiceDate: string | null
  workspaceType: string
  businessCategory: string
}

export interface LaundryProvisioningItem {
  id: string
  businessId: string
  item: string
  status: string
  notes: string | null
}

export interface LaundryOperationalConfig {
  id: string
  businessId: string
  transportEnabled: boolean
  barcodeEnabled: boolean
  homeDeliveryEnabled: boolean
  ironingEnabled: boolean
}

export interface LaundryWorkflowQualityConfig {
  id: string
  businessId: string
  photoAudit: boolean
  auditModule: boolean
}

export interface LaundryScalingLimit {
  storesAllowed: number
  storesUsed: number
  processingCentersAllowed: number
  processingCentersUsed: number
  storeCapacityKg: number
  processingCapacityKg: number
  employeesAllowed: number
  employeesUsed: number
  deliveryStaffAllowed: number
  deliveryStaffUsed: number
  ordersPerDay: number
  ordersPerMonthLimit: number
  storageLimitMB: number
}

export interface LaundryBrandingConfig {
  id: string
  businessId: string
  logoUploaded: boolean
  faviconUploaded: boolean
  brandColorsConfigured: boolean
  dedicatedApk: boolean
  customPackageName: boolean
  customSplashScreen: boolean
  customAppIcon: boolean
  playStorePublished: boolean
  customDomain: boolean
  status: string
}

export interface LaundryPlatformProvisioning {
  customerWebsite: boolean
  customerPWA: boolean
  androidCustomerApp: boolean
  deliveryApp: boolean
  adminApp: boolean
  ssl: boolean
  cloudStorage: boolean
  automatedBackups: boolean
  pushNotifications: boolean
}

export interface LaundryAuditLog {
  id: string
  businessId: string
  actorId: string | null
  actorName: string | null
  section: string
  field: string
  oldValue: string | null
  newValue: string | null
  ipAddress: string | null
  createdAt: string
}

export interface LicensingData {
  subscription: LaundrySubscription | null
  provisioning: LaundryProvisioningItem[]
  operationalConfig: LaundryOperationalConfig | null
  workflowQuality: LaundryWorkflowQualityConfig | null
  platformProvisioning: LaundryPlatformProvisioning | null
  scalingLimit: LaundryScalingLimit | null
  brandingConfig: LaundryBrandingConfig | null
  auditLogs: LaundryAuditLog[]
}

export const FEATURE_NAV_MAP: Record<string, string> = {
  stores: "storesAllowed",
  "processing-centers": "processingCentersAllowed",
}

const CACHE: Record<string, { data: LicensingData; ts: number }> = {}
const CACHE_TTL = 60_000

const DEFAULT_DATA: LicensingData = {
  subscription: null,
  provisioning: [],
  operationalConfig: null,
  workflowQuality: null,
  platformProvisioning: null,
  scalingLimit: null,
  brandingConfig: null,
  auditLogs: [],
}

export function useLaundryLicensing(businessId?: string | null) {
  const [data, setData] = useState<LicensingData>(DEFAULT_DATA)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchLicensing = useCallback(async () => {
    if (!businessId) {
      if (mountedRef.current) {
        setData(DEFAULT_DATA)
        setLoading(false)
      }
      return
    }

    const cached = CACHE[businessId]
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (mountedRef.current) {
        setData(cached.data)
        setLoading(false)
      }
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${businessId}/licensing`)
      if (res.ok) {
        const result: LicensingData = await res.json()
        CACHE[businessId] = { data: result, ts: Date.now() }
        if (mountedRef.current) setData(result)
      }
    } catch { /* ignore */ }
    finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [businessId])

  useEffect(() => { fetchLicensing() }, [fetchLicensing])

  const isEnabled = useCallback((feature: string): boolean => {
    if (feature === "multiStoreEnabled") return (data.scalingLimit?.storesAllowed ?? 1) > 1
    if (feature === "multiProcessingEnabled") return (data.scalingLimit?.processingCentersAllowed ?? 1) > 1
    if (feature === "employeeManagementEnabled") return (data.scalingLimit?.employeesAllowed ?? 1) > 1
    // Check operational config toggles
    const cfg = data.operationalConfig as Record<string, boolean | undefined> | null
    if (cfg?.[feature] !== undefined) return !!cfg[feature]
    // Check platform provisioning toggles
    const pp = data.platformProvisioning as Record<string, boolean | undefined> | null
    if (pp?.[feature] !== undefined) return !!pp[feature]
    return false
  }, [data])

  const refetch = useCallback(() => {
    if (businessId) delete CACHE[businessId]
    fetchLicensing()
  }, [businessId, fetchLicensing])

  return { ...data, loading, isEnabled, refetch }
}
