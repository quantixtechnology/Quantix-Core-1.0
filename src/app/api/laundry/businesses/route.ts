import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateBusinessCode } from "@/lib/laundry-codes"
import { hashPassword, generateTempPassword } from "@/lib/password-utils"
import { ensureScalingLimitForNewBusiness } from "@/lib/laundry-scaling-limits"

export const runtime = "nodejs"

const SYSTEM_STAGE_CODES = [
  "STORE_ORDER_CREATED",
  "STORE_AUDIT",
  "READY_FOR_PROCESSING",
  "IN_TRANSIT_TO_PROCESSING",
  "PROCESSING_ENTRY_AUDIT",
  "BARCODE_TAGGING",
  "WASHING",
  "DRYING",
  "IRONING",
  "FOLDING",
  "PACKING",
  "READY_FOR_STORE_DISPATCH",
  "IN_TRANSIT_TO_STORE",
  "READY_FOR_DELIVERY",
  "DELIVERED",
]

const DEFAULT_DEPARTMENTS = [
  { code: "STORE_FRONT", name: "Store Front", sequence: 1 },
  { code: "PROCESSING", name: "Processing Unit", sequence: 2 },
  { code: "DELIVERY", name: "Delivery", sequence: 3 },
]

const STAGE_DEPARTMENT_ROLE: Record<string, { departmentCode: string; roleCode: string }> = {
  STORE_ORDER_CREATED:      { departmentCode: "STORE_FRONT", roleCode: "STORE_SUPERVISOR" },
  STORE_AUDIT:              { departmentCode: "STORE_FRONT", roleCode: "STORE_SUPERVISOR" },
  READY_FOR_PROCESSING:     { departmentCode: "STORE_FRONT", roleCode: "STORE_SUPERVISOR" },
  IN_TRANSIT_TO_PROCESSING: { departmentCode: "STORE_FRONT", roleCode: "STORE_SUPERVISOR" },
  PROCESSING_ENTRY_AUDIT:   { departmentCode: "PROCESSING",  roleCode: "PROCESSING_ENTRY_SUPERVISOR" },
  BARCODE_TAGGING:          { departmentCode: "PROCESSING",  roleCode: "PROCESSING_ENTRY_SUPERVISOR" },
  WASHING:                  { departmentCode: "PROCESSING",  roleCode: "WASHING_SUPERVISOR" },
  DRYING:                   { departmentCode: "PROCESSING",  roleCode: "DRYING_SUPERVISOR" },
  IRONING:                  { departmentCode: "PROCESSING",  roleCode: "IRONING_SUPERVISOR" },
  FOLDING:                  { departmentCode: "PROCESSING",  roleCode: "PACKING_SUPERVISOR" },
  PACKING:                  { departmentCode: "PROCESSING",  roleCode: "PACKING_SUPERVISOR" },
  READY_FOR_STORE_DISPATCH: { departmentCode: "PROCESSING",  roleCode: "DISPATCH_SUPERVISOR" },
  IN_TRANSIT_TO_STORE:      { departmentCode: "PROCESSING",  roleCode: "DISPATCH_SUPERVISOR" },
  READY_FOR_DELIVERY:       { departmentCode: "DELIVERY",    roleCode: "DELIVERY_MANAGER" },
  DELIVERED:                { departmentCode: "DELIVERY",    roleCode: "DELIVERY_MANAGER" },
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const plan = searchParams.get("plan") || ""

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { businessCode: { contains: search } },
        { ownerName: { contains: search } },
        { mobile: { contains: search } },
      ]
    }
    if (status) where.status = status
    if (plan) where.plan = plan

    const businesses = await prisma.laundryBusiness.findMany({
      where,
      include: { _count: { select: { stores: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(businesses)
  } catch (error) {
    console.error("Error fetching laundry businesses:", error)
    return NextResponse.json({ error: "Failed to fetch laundry businesses" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessName, legalName, ownerName, mobile, email, gstNumber, logo, favicon, address, plan, status } = body

    if (!businessName || !ownerName || !mobile) {
      return NextResponse.json({ error: "Business name, owner name, and mobile are required" }, { status: 400 })
    }

    const businessCode = await generateBusinessCode()
    const slug = businessCode.toLowerCase()

    // Create a platform Business record so the business owner can log in
    // through the existing auth flow with businessType LAUNDRY
    const platformBusiness = await prisma.business.create({
      data: {
        name: businessName,
        slug,
        businessType: "LAUNDRY",
        status: status === "ACTIVE" ? "ACTIVE" : "ONBOARDING",
        businessCode,
        contactEmail: email || null,
        contactPhone: mobile,
        address: address || undefined,
        gstNumber: gstNumber || null,
      },
    })

    const business = await prisma.laundryBusiness.create({
      data: {
        businessCode,
        businessName,
        legalName: legalName || null,
        ownerName,
        mobile,
        email: email || null,
        gstNumber: gstNumber || null,
        logo: logo || null,
        favicon: favicon || null,
        address: address || null,
        plan: plan || "STANDARD",
        status: status || "ONBOARDING",
        platformBusinessId: platformBusiness.id,
      },
    })

    // Auto-create workflow configurations with stage→department→role mapping
    const systemStages = await prisma.laundryWorkflowStage.findMany({
      where: { code: { in: SYSTEM_STAGE_CODES } },
      orderBy: { sequence: "asc" },
    })

    // Create departments first so we can reference them in configs
    const createdDepartments = await Promise.all(
      DEFAULT_DEPARTMENTS.map((dept) =>
        prisma.laundryDepartment.create({
          data: {
            businessId: business.id,
            code: dept.code,
            name: dept.name,
            sequence: dept.sequence,
            enabled: true,
          },
        })
      )
    )
    const deptByCode = new Map(createdDepartments.map((d) => [d.code, d.id]))

    const roles = await prisma.laundryRole.findMany()
    const roleByCode = new Map(roles.map((r) => [r.code, r.id]))

    for (const stage of systemStages) {
      const mapping = STAGE_DEPARTMENT_ROLE[stage.code]
      const responsibleDepartmentId = mapping ? deptByCode.get(mapping.departmentCode) ?? null : null
      const responsibleRoleId = mapping ? roleByCode.get(mapping.roleCode) ?? null : null

      await prisma.laundryWorkflowConfiguration.create({
        data: {
          businessId: business.id,
          stageId: stage.id,
          enabled: true,
          sequence: stage.sequence,
          responsibleRoleId,
          responsibleDepartmentId,
          canView: true,
          canUpdate: mapping?.roleCode === "STORE_SUPERVISOR" || mapping?.roleCode === "ADMIN" || mapping?.roleCode === "STORE_MANAGER" || mapping?.roleCode === "PROCESSING_MANAGER",
          canApprove: mapping?.roleCode === "ADMIN" || mapping?.roleCode === "STORE_MANAGER" || mapping?.roleCode === "PROCESSING_MANAGER",
        },
      })
    }

    // Auto-assign default roles
    const adminRole = roleByCode.get("ADMIN")
    if (adminRole) {
      await prisma.laundryUserAssignment.create({
        data: {
          businessId: business.id,
          roleId: adminRole,
          active: true,
        },
      })
    }
    const storeManagerRole = roleByCode.get("STORE_MANAGER")
    if (storeManagerRole) {
      await prisma.laundryUserAssignment.create({
        data: {
          businessId: business.id,
          roleId: storeManagerRole,
          active: true,
        },
      })
    }

    // Auto-create licensing records
    const now = new Date()
    await prisma.laundrySubscription.create({
      data: {
        businessId: business.id,
        plan: plan || "STARTER",
        templatePreset: "STARTER",
        status: status === "ACTIVE" ? "ACTIVE" : "ONBOARDING",
        startDate: now,
        renewalDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        trialExpiry: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        lastPaymentDate: now,
        nextInvoiceDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        billingCycle: "MONTHLY",
      },
    })

    await prisma.laundryOperationalConfig.create({
      data: { businessId: business.id },
    })

    await prisma.laundryWorkflowQualityConfig.create({
      data: { businessId: business.id },
    })

    // Seeded from the plan's branchLimit — the number the plan selector shows.
    // Previously created bare, so storesAllowed fell to the default of 1 no
    // matter which plan the business was sold.
    await ensureScalingLimitForNewBusiness(business.id, business.platformBusinessId)

    await prisma.laundryBrandingConfig.create({
      data: { businessId: business.id },
    })

    await prisma.laundryPlatformProvisioning.create({
      data: { businessId: business.id },
    })

    const PROVISIONING_ITEMS = [
      "workspace", "databaseProvisioned", "storageProvisioned", "domain", "ssl",
      "pwa", "customerApp", "deliveryApp", "adminApp", "apkBuild",
      "playStore", "monitoring", "backup",
    ]
    for (const item of PROVISIONING_ITEMS) {
      await prisma.laundryProvisioningItem.create({
        data: { businessId: business.id, item, status: "PENDING" },
      })
    }

    // ── Auto-create Laundry Owner user account ──────────────────────────
    const ownerEmail = email || `owner-${businessCode.toLowerCase()}@laundry.lan`
    const ownerPassword = generateTempPassword()
    const ownerPasswordHash = await hashPassword(ownerPassword)

    const ownerUser = await prisma.user.create({
      data: {
        email: ownerEmail,
        loginId: ownerEmail,
        name: ownerName,
        phone: mobile,
        passwordHash: ownerPasswordHash,
        authProvider: "PASSWORD",
        emailVerified: false,
        isActive: true,
      },
    })

    await prisma.businessUser.create({
      data: {
        userId: ownerUser.id,
        businessId: platformBusiness.id,
        role: "LAUNDRY_OWNER",
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    })

    // ── Auto-create Store Manager user account ──────────────────────────
    const storeEmail = `store-${businessCode.toLowerCase()}@laundry.lan`
    const storeManagerPassword = generateTempPassword()
    const storeManagerPasswordHash = await hashPassword(storeManagerPassword)

    const storeManagerUser = await prisma.user.create({
      data: {
        email: storeEmail,
        loginId: storeEmail,
        name: `${businessName} - Store Manager`,
        passwordHash: storeManagerPasswordHash,
        authProvider: "PASSWORD",
        isActive: true,
      },
    })

    await prisma.businessUser.create({
      data: {
        userId: storeManagerUser.id,
        businessId: platformBusiness.id,
        role: "LAUNDRY_STORE_MANAGER",
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    })

    // ── Auto-create Processing Center Manager user account ──────────────
    const processingEmail = `processing-${businessCode.toLowerCase()}@laundry.lan`
    const processingPassword = generateTempPassword()
    const processingPasswordHash = await hashPassword(processingPassword)

    const processingUser = await prisma.user.create({
      data: {
        email: processingEmail,
        loginId: processingEmail,
        name: `${businessName} - Processing Manager`,
        passwordHash: processingPasswordHash,
        authProvider: "PASSWORD",
        isActive: true,
      },
    })

    await prisma.businessUser.create({
      data: {
        userId: processingUser.id,
        businessId: platformBusiness.id,
        role: "PROCESSING_MANAGER",
        isActive: true,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    })

    // ── Link users to LaundryRole assignments ──────────────────────────
    const laundryOwnerRole = roleByCode.get("ADMIN")
    const laundryStoreMgrRole = roleByCode.get("STORE_MANAGER")
    const processingMgrRole = roleByCode.get("PROCESSING_MANAGER")

    if (laundryOwnerRole) {
      await prisma.laundryUserAssignment.create({
        data: {
          businessId: business.id,
          roleId: laundryOwnerRole,
          userId: ownerUser.id,
          active: true,
        },
      })
    }

    if (laundryStoreMgrRole) {
      await prisma.laundryUserAssignment.create({
        data: {
          businessId: business.id,
          roleId: laundryStoreMgrRole,
          userId: storeManagerUser.id,
          active: true,
        },
      })
    }

    if (processingMgrRole) {
      await prisma.laundryUserAssignment.create({
        data: {
          businessId: business.id,
          roleId: processingMgrRole,
          userId: processingUser.id,
          active: true,
        },
      })
    }

    return NextResponse.json({
      ...business,
      credentials: {
        owner: {
          email: ownerEmail,
          password: ownerPassword,
          name: ownerName,
          role: "LAUNDRY_OWNER",
        },
        storeManager: {
          email: storeEmail,
          password: storeManagerPassword,
          name: `${businessName} - Store Manager`,
          role: "LAUNDRY_STORE_MANAGER",
        },
        processingManager: {
          email: processingEmail,
          password: processingPassword,
          name: `${businessName} - Processing Manager`,
          role: "PROCESSING_MANAGER",
        },
      },
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating laundry business:", error)
    return NextResponse.json({ error: "Failed to create laundry business" }, { status: 500 })
  }
}
