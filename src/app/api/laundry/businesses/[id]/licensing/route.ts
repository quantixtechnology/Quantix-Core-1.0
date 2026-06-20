import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const DEFAULT_LICENSE = {
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

const DEFAULT_SCALING = {
  storesAllowed: 1, processingCentersAllowed: 1, employeesAllowed: 5,
  deliveryStaffAllowed: 2, ordersPerMonthLimit: 500, storageLimitMB: 500,
}

const DEFAULT_PROVISIONING = {
  workspaceCreated: true, sslConfigured: true, pwaGenerated: true,
  androidApkGenerated: false, domainMapped: false, playStorePublished: false,
  backupEnabled: true, monitoringEnabled: true,
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await prisma.laundryBusiness.findUnique({
      where: { id },
      include: {
        subscription: true,
        license: true,
        scalingLimit: true,
        provisioningStatus: true,
      },
    })
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    return NextResponse.json({
      subscription: business.subscription || null,
      license: business.license || DEFAULT_LICENSE,
      scalingLimit: business.scalingLimit || DEFAULT_SCALING,
      provisioningStatus: business.provisioningStatus || DEFAULT_PROVISIONING,
    })
  } catch (error) {
    console.error("Error fetching licensing:", error)
    return NextResponse.json({ error: "Failed to fetch licensing" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { subscription, license, scalingLimit, provisioningStatus } = body

    // Update subscription
    if (subscription) {
      await prisma.laundrySubscription.upsert({
        where: { businessId: id },
        update: subscription,
        create: { businessId: id, ...subscription, renewalDate: subscription.renewalDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      })
    }

    // Update license
    if (license) {
      await prisma.laundryLicense.upsert({
        where: { businessId: id },
        update: license,
        create: { businessId: id, ...DEFAULT_LICENSE, ...license },
      })
    }

    // Update scaling limits
    if (scalingLimit) {
      await prisma.laundryScalingLimit.upsert({
        where: { businessId: id },
        update: scalingLimit,
        create: { businessId: id, ...DEFAULT_SCALING, ...scalingLimit },
      })
    }

    // Update provisioning status
    if (provisioningStatus) {
      await prisma.laundryProvisioningStatus.upsert({
        where: { businessId: id },
        update: provisioningStatus,
        create: { businessId: id, ...DEFAULT_PROVISIONING, ...provisioningStatus },
      })
    }

    // Return updated data
    const updated = await prisma.laundryBusiness.findUnique({
      where: { id },
      include: { subscription: true, license: true, scalingLimit: true, provisioningStatus: true },
    })

    return NextResponse.json({
      subscription: updated?.subscription || null,
      license: updated?.license || DEFAULT_LICENSE,
      scalingLimit: updated?.scalingLimit || DEFAULT_SCALING,
      provisioningStatus: updated?.provisioningStatus || DEFAULT_PROVISIONING,
    })
  } catch (error) {
    console.error("Error updating licensing:", error)
    return NextResponse.json({ error: "Failed to update licensing" }, { status: 500 })
  }
}
