"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface LaundrySubscription {
  id: string
  businessId: string
  plan: string
  billingCycle: string
  status: string
  startDate: string
  renewalDate: string
  workspaceType: string
  businessCategory: string
}

export interface LaundryLicense {
  // Infrastructure
  customerWebsite: boolean
  customerPWA: boolean
  androidCustomerApp: boolean
  deliveryApp: boolean
  adminApp: boolean
  customDomain: boolean
  ssl: boolean
  cloudStorage: boolean
  automatedBackups: boolean
  pushNotifications: boolean
  // Operational
  transportModule: boolean
  barcodeModule: boolean
  homeDeliveryModule: boolean
  ironingModule: boolean
  pickupRequests: boolean
  deliveryManagement: boolean
  routeManagement: boolean
  auditModule: boolean
  // Workflow
  photoAudit: boolean
  qrOrderLabels: boolean
  barcodeGarmentTracking: boolean
  itemLevelTracking: boolean
  processingChecklists: boolean
  qualityControl: boolean
  dispatchVerification: boolean
  deliveryOTP: boolean
  // Payment
  cashCollection: boolean
  upiPayments: boolean
  razorpay: boolean
  phonePe: boolean
  advancePayment: boolean
  partialPayment: boolean
  corporateBilling: boolean
  creditAccounts: boolean
  // Engagement
  membershipModule: boolean
  loyaltyModule: boolean
  referralProgram: boolean
  coupons: boolean
  walletSystem: boolean
  giftCards: boolean
  // Communication
  smsNotifications: boolean
  whatsappNotifications: boolean
  emailNotifications: boolean
  pushNotificationsModule: boolean
  marketingCampaigns: boolean
  // Reporting
  basicReports: boolean
  advancedReports: boolean
  storeAnalytics: boolean
  processingAnalytics: boolean
  employeeAnalytics: boolean
  revenueAnalytics: boolean
  // White Label
  dedicatedApk: boolean
  customPackageName: boolean
  customSplashScreen: boolean
  customAppIcon: boolean
  playStorePublishing: boolean
  customDomainWL: boolean
}

export interface LaundryScalingLimit {
  storesAllowed: number
  storesUsed: number
  processingCentersAllowed: number
  processingCentersUsed: number
  employeesAllowed: number
  employeesUsed: number
  deliveryStaffAllowed: number
  deliveryStaffUsed: number
  ordersPerMonthLimit: number
  storageLimitMB: number
}

export interface LaundryProvisioningStatus {
  workspaceCreated: boolean
  sslConfigured: boolean
  pwaGenerated: boolean
  androidApkGenerated: boolean
  domainMapped: boolean
  playStorePublished: boolean
  backupEnabled: boolean
  monitoringEnabled: boolean
}

export interface LicensingData {
  subscription: LaundrySubscription | null
  license: LaundryLicense
  scalingLimit: LaundryScalingLimit
  provisioningStatus: LaundryProvisioningStatus
}

// Mapping from feature toggle keys to workspace nav items
// True = feature is licensed, nav item visible
// False = feature not licensed, nav item hidden
export const FEATURE_NAV_MAP: Record<string, string> = {
  stores: "multiStoreEnabled",
  "processing-centers": "multiProcessingEnabled",
}

const CACHE: Record<string, { data: LicensingData; ts: number }> = {}
const CACHE_TTL = 60_000

const DEFAULT_LICENSE: LaundryLicense = {
  customerWebsite: false, customerPWA: true, androidCustomerApp: false,
  deliveryApp: false, adminApp: true, customDomain: false, ssl: true,
  cloudStorage: true, automatedBackups: true, pushNotifications: true,
  transportModule: true, barcodeModule: true, homeDeliveryModule: true,
  ironingModule: true, pickupRequests: false, deliveryManagement: false,
  routeManagement: false, auditModule: false,
  photoAudit: true, qrOrderLabels: false, barcodeGarmentTracking: false,
  itemLevelTracking: false, processingChecklists: false, qualityControl: false,
  dispatchVerification: false, deliveryOTP: true,
  cashCollection: true, upiPayments: true, razorpay: false, phonePe: false,
  advancePayment: false, partialPayment: true, corporateBilling: false,
  creditAccounts: false,
  membershipModule: false, loyaltyModule: false, referralProgram: false,
  coupons: false, walletSystem: false, giftCards: false,
  smsNotifications: false, whatsappNotifications: false,
  emailNotifications: true, pushNotificationsModule: true,
  marketingCampaigns: false,
  basicReports: true, advancedReports: false, storeAnalytics: false,
  processingAnalytics: false, employeeAnalytics: false, revenueAnalytics: false,
  dedicatedApk: false, customPackageName: false, customSplashScreen: false,
  customAppIcon: false, playStorePublishing: false, customDomainWL: false,
}

const DEFAULT_SCALING: LaundryScalingLimit = {
  storesAllowed: 1, storesUsed: 0, processingCentersAllowed: 1,
  processingCentersUsed: 0, employeesAllowed: 5, employeesUsed: 0,
  deliveryStaffAllowed: 2, deliveryStaffUsed: 0, ordersPerMonthLimit: 500,
  storageLimitMB: 500,
}

const DEFAULT_PROVISIONING: LaundryProvisioningStatus = {
  workspaceCreated: true, sslConfigured: true, pwaGenerated: true,
  androidApkGenerated: false, domainMapped: false, playStorePublished: false,
  backupEnabled: true, monitoringEnabled: true,
}

const DEFAULT_DATA: LicensingData = {
  subscription: null,
  license: DEFAULT_LICENSE,
  scalingLimit: DEFAULT_SCALING,
  provisioningStatus: DEFAULT_PROVISIONING,
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
    // Check scaling limits for numeric features
    if (feature === "multiStoreEnabled") return data.scalingLimit.storesAllowed > 1
    if (feature === "multiProcessingEnabled") return data.scalingLimit.processingCentersAllowed > 1
    if (feature === "employeeManagementEnabled") return data.scalingLimit.employeesAllowed > 1
    // Check license booleans
    const lic = data.license as Record<string, boolean | undefined>
    return !!lic[feature]
  }, [data])

  const refetch = useCallback(() => {
    if (businessId) delete CACHE[businessId]
    fetchLicensing()
  }, [businessId, fetchLicensing])

  return { ...data, loading, isEnabled, refetch }
}
