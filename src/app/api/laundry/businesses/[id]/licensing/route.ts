// Business Licensing / Resource Allocation — QUANTIX SUPER ADMIN ONLY.
//
// This endpoint decides what a tenant is entitled to: subscription plan,
// provisioning state, operational config, and the scaling limits behind the
// Store / User / Storage quotas. It is platform commercial administration, not
// business self-service — no tenant role may read or write it.
//
// It previously had NO authentication of any kind: both verbs were reachable
// unauthenticated, so anyone who knew a business id could read a tenant's
// commercial terms and raise its own quotas.
//
// Guarded with requiredRoles: ['QUANTIX_SUPER_ADMIN'] rather than a permission
// key on purpose — a permission is something a business role could later be
// granted, and this access must never be grantable to a tenant.
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { withMiddleware } from "@/lib/middleware"

export const runtime = "nodejs"

/** Quantix Super Admin only. Not a permission — a role gate. */
const superAdminOnly = withMiddleware({ requireAuth: true, requiredRoles: ["QUANTIX_SUPER_ADMIN"] })

const DEFAULT_SUBSCRIPTION = {
  plan: "STARTER",
  templatePreset: "STARTER",
  billingCycle: "MONTHLY",
  status: "ACTIVE",
  workspaceType: "LAUNDRY_OS",
  businessCategory: "LAUNDRY",
}

const DEFAULT_OPERATIONAL_CONFIG = {
  transportEnabled: true,
  barcodeEnabled: true,
  homeDeliveryEnabled: true,
  ironingEnabled: true,
}

const DEFAULT_WORKFLOW_QUALITY = {
  photoAudit: true,
  auditModule: true,
}

const DEFAULT_PLATFORM_PROVISIONING = {
  customerWebsite: false,
  customerPWA: true,
  androidCustomerApp: false,
  deliveryApp: false,
  adminApp: true,
  ssl: true,
  cloudStorage: true,
  automatedBackups: true,
  pushNotifications: true,
}

const DEFAULT_SCALING = {
  storesAllowed: 1,
  processingCentersAllowed: 1,
  storeCapacityKg: 500,
  processingCapacityKg: 1000,
  employeesAllowed: 5,
  deliveryStaffAllowed: 2,
  ordersPerDay: 50,
  ordersPerMonthLimit: 500,
  storageLimitMB: 500,
}

const DEFAULT_BRANDING = {
  logoUploaded: false,
  faviconUploaded: false,
  brandColorsConfigured: false,
  dedicatedApk: false,
  customPackageName: false,
  customSplashScreen: false,
  customAppIcon: false,
  playStorePublished: false,
  customDomain: false,
  status: "PENDING",
}

async function createAuditLog(businessId: string, actorName: string | null, ipAddress: string | null, section: string, changes: Record<string, { oldValue: unknown; newValue: unknown }>) {
  for (const [field, vals] of Object.entries(changes)) {
    if (vals.oldValue !== vals.newValue) {
      await prisma.laundryAuditLog.create({
        data: {
          businessId,
          actorName,
          section,
          field,
          oldValue: String(vals.oldValue ?? ""),
          newValue: String(vals.newValue ?? ""),
          ipAddress,
        },
      }).catch(() => {})
    }
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return superAdminOnly(async () => {
  try {
    const { id } = await params
    const business = await prisma.laundryBusiness.findUnique({
      where: { id },
      include: {
        subscription: true,
        provisioning: { orderBy: { item: "asc" } },
        operationalConfig: true,
        workflowQuality: true,
        scalingLimit: true,
        brandingConfig: true,
        platformProvisioning: true,
        auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    })
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    return NextResponse.json({
      subscription: business.subscription || null,
      provisioning: business.provisioning || [],
      operationalConfig: business.operationalConfig || null,
      workflowQuality: business.workflowQuality || null,
      scalingLimit: business.scalingLimit || null,
      brandingConfig: business.brandingConfig || null,
      platformProvisioning: business.platformProvisioning || null,
      auditLogs: business.auditLogs || [],
    })
  } catch (error) {
    console.error("Error fetching licensing:", error)
    return NextResponse.json({ error: "Failed to fetch licensing" }, { status: 500 })
  }
  })(request)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return superAdminOnly(async (req) => {
  try {
    const { id } = await params
    const body = await req.json()
    const { subscription, provisioning, operationalConfig, workflowQuality, scalingLimit, brandingConfig, platformProvisioning } = body

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null

    if (subscription) {
      const prev = await prisma.laundrySubscription.findUnique({ where: { businessId: id } })
      await prisma.laundrySubscription.upsert({
        where: { businessId: id },
        update: { ...subscription },
        create: { businessId: id, ...DEFAULT_SUBSCRIPTION, ...subscription, renewalDate: subscription.renewalDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      })
      if (prev) {
        await createAuditLog(id, null, ipAddress, "subscription", {
          plan: { oldValue: prev.plan, newValue: subscription.plan ?? prev.plan },
          billingCycle: { oldValue: prev.billingCycle, newValue: subscription.billingCycle ?? prev.billingCycle },
          status: { oldValue: prev.status, newValue: subscription.status ?? prev.status },
        })
      }
    }

    if (provisioning && Array.isArray(provisioning)) {
      for (const item of provisioning) {
        const prev = await prisma.laundryProvisioningItem.findUnique({
          where: { businessId_item: { businessId: id, item: item.item } },
        })
        await prisma.laundryProvisioningItem.upsert({
          where: { businessId_item: { businessId: id, item: item.item } },
          update: { status: item.status, notes: item.notes ?? undefined },
          create: { businessId: id, item: item.item, status: item.status, notes: item.notes ?? undefined },
        })
        if (prev && prev.status !== item.status) {
          await createAuditLog(id, null, ipAddress, "provisioning", {
            [item.item]: { oldValue: prev.status, newValue: item.status },
          })
        }
      }
    }

    if (operationalConfig) {
      const prev = await prisma.laundryOperationalConfig.findUnique({ where: { businessId: id } })
      await prisma.laundryOperationalConfig.upsert({
        where: { businessId: id },
        update: operationalConfig,
        create: { businessId: id, ...DEFAULT_OPERATIONAL_CONFIG, ...operationalConfig },
      })
      if (prev) {
        await createAuditLog(id, null, ipAddress, "operationalConfig", {
          transportEnabled: { oldValue: prev.transportEnabled, newValue: operationalConfig.transportEnabled ?? prev.transportEnabled },
          barcodeEnabled: { oldValue: prev.barcodeEnabled, newValue: operationalConfig.barcodeEnabled ?? prev.barcodeEnabled },
          homeDeliveryEnabled: { oldValue: prev.homeDeliveryEnabled, newValue: operationalConfig.homeDeliveryEnabled ?? prev.homeDeliveryEnabled },
          ironingEnabled: { oldValue: prev.ironingEnabled, newValue: operationalConfig.ironingEnabled ?? prev.ironingEnabled },
        })
      }
    }

    if (workflowQuality) {
      const prev = await prisma.laundryWorkflowQualityConfig.findUnique({ where: { businessId: id } })
      await prisma.laundryWorkflowQualityConfig.upsert({
        where: { businessId: id },
        update: workflowQuality,
        create: { businessId: id, ...DEFAULT_WORKFLOW_QUALITY, ...workflowQuality },
      })
      if (prev) {
        await createAuditLog(id, null, ipAddress, "workflowQuality", {
          photoAudit: { oldValue: prev.photoAudit, newValue: workflowQuality.photoAudit ?? prev.photoAudit },
          auditModule: { oldValue: prev.auditModule, newValue: workflowQuality.auditModule ?? prev.auditModule },
        })
      }
    }

    if (scalingLimit) {
      const prev = await prisma.laundryScalingLimit.findUnique({ where: { businessId: id } })
      await prisma.laundryScalingLimit.upsert({
        where: { businessId: id },
        update: scalingLimit,
        create: { businessId: id, ...DEFAULT_SCALING, ...scalingLimit },
      })
      if (prev) {
        await createAuditLog(id, null, ipAddress, "scalingLimit", {
          storesAllowed: { oldValue: prev.storesAllowed, newValue: scalingLimit.storesAllowed ?? prev.storesAllowed },
          processingCentersAllowed: { oldValue: prev.processingCentersAllowed, newValue: scalingLimit.processingCentersAllowed ?? prev.processingCentersAllowed },
          employeesAllowed: { oldValue: prev.employeesAllowed, newValue: scalingLimit.employeesAllowed ?? prev.employeesAllowed },
          deliveryStaffAllowed: { oldValue: prev.deliveryStaffAllowed, newValue: scalingLimit.deliveryStaffAllowed ?? prev.deliveryStaffAllowed },
          ordersPerMonthLimit: { oldValue: prev.ordersPerMonthLimit, newValue: scalingLimit.ordersPerMonthLimit ?? prev.ordersPerMonthLimit },
          storageLimitMB: { oldValue: prev.storageLimitMB, newValue: scalingLimit.storageLimitMB ?? prev.storageLimitMB },
        })
      }
    }

    if (brandingConfig) {
      const prev = await prisma.laundryBrandingConfig.findUnique({ where: { businessId: id } })
      await prisma.laundryBrandingConfig.upsert({
        where: { businessId: id },
        update: brandingConfig,
        create: { businessId: id, ...DEFAULT_BRANDING, ...brandingConfig },
      })
      if (prev) {
        await createAuditLog(id, null, ipAddress, "brandingConfig", {
          logoUploaded: { oldValue: prev.logoUploaded, newValue: brandingConfig.logoUploaded ?? prev.logoUploaded },
          faviconUploaded: { oldValue: prev.faviconUploaded, newValue: brandingConfig.faviconUploaded ?? prev.faviconUploaded },
          dedicatedApk: { oldValue: prev.dedicatedApk, newValue: brandingConfig.dedicatedApk ?? prev.dedicatedApk },
          playStorePublished: { oldValue: prev.playStorePublished, newValue: brandingConfig.playStorePublished ?? prev.playStorePublished },
          status: { oldValue: prev.status, newValue: brandingConfig.status ?? prev.status },
        })
      }
    }

    if (platformProvisioning) {
      const prev = await prisma.laundryPlatformProvisioning.findUnique({ where: { businessId: id } })
      await prisma.laundryPlatformProvisioning.upsert({
        where: { businessId: id },
        update: platformProvisioning,
        create: { businessId: id, ...DEFAULT_PLATFORM_PROVISIONING, ...platformProvisioning },
      })
      if (prev) {
        await createAuditLog(id, null, ipAddress, "platformProvisioning", {
          customerWebsite: { oldValue: prev.customerWebsite, newValue: platformProvisioning.customerWebsite ?? prev.customerWebsite },
          customerPWA: { oldValue: prev.customerPWA, newValue: platformProvisioning.customerPWA ?? prev.customerPWA },
          androidCustomerApp: { oldValue: prev.androidCustomerApp, newValue: platformProvisioning.androidCustomerApp ?? prev.androidCustomerApp },
          deliveryApp: { oldValue: prev.deliveryApp, newValue: platformProvisioning.deliveryApp ?? prev.deliveryApp },
          adminApp: { oldValue: prev.adminApp, newValue: platformProvisioning.adminApp ?? prev.adminApp },
          ssl: { oldValue: prev.ssl, newValue: platformProvisioning.ssl ?? prev.ssl },
          cloudStorage: { oldValue: prev.cloudStorage, newValue: platformProvisioning.cloudStorage ?? prev.cloudStorage },
          automatedBackups: { oldValue: prev.automatedBackups, newValue: platformProvisioning.automatedBackups ?? prev.automatedBackups },
          pushNotifications: { oldValue: prev.pushNotifications, newValue: platformProvisioning.pushNotifications ?? prev.pushNotifications },
        })
      }
    }

    const updated = await prisma.laundryBusiness.findUnique({
      where: { id },
      include: {
        subscription: true,
        provisioning: { orderBy: { item: "asc" } },
        operationalConfig: true,
        workflowQuality: true,
        scalingLimit: true,
        brandingConfig: true,
        platformProvisioning: true,
        auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    })

    return NextResponse.json({
      subscription: updated?.subscription || null,
      provisioning: updated?.provisioning || [],
      operationalConfig: updated?.operationalConfig || null,
      workflowQuality: updated?.workflowQuality || null,
      scalingLimit: updated?.scalingLimit || null,
      brandingConfig: updated?.brandingConfig || null,
      platformProvisioning: updated?.platformProvisioning || null,
      auditLogs: updated?.auditLogs || [],
    })
  } catch (error) {
    console.error("Error updating licensing:", error)
    return NextResponse.json({ error: "Failed to update licensing" }, { status: 500 })
  }
  })(request)
}
