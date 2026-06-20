import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const SYSTEM_STAGES = [
  { code: "STORE_ORDER_CREATED",           name: "Store Order Created",       sequence: 1,  description: "Order created at store" },
  { code: "STORE_AUDIT",                   name: "Store Audit",               sequence: 2,  description: "Initial audit at store reception" },
  { code: "READY_FOR_PROCESSING",          name: "Ready for Processing",      sequence: 3,  description: "Items ready to send to processing" },
  { code: "IN_TRANSIT_TO_PROCESSING",      name: "In Transit to Processing",  sequence: 4,  description: "Items in transit to processing center" },
  { code: "PROCESSING_ENTRY_AUDIT",        name: "Processing Entry Audit",    sequence: 5,  description: "Audit at processing center arrival" },
  { code: "BARCODE_TAGGING",               name: "Barcode Tagging",           sequence: 6,  description: "Tag items with barcodes" },
  { code: "WASHING",                       name: "Washing",                   sequence: 7,  description: "Washing process" },
  { code: "DRYING",                        name: "Drying",                    sequence: 8,  description: "Drying process" },
  { code: "IRONING",                       name: "Ironing",                   sequence: 9,  description: "Ironing process" },
  { code: "FOLDING",                       name: "Folding",                   sequence: 10, description: "Folding process" },
  { code: "PACKING",                       name: "Packing",                   sequence: 11, description: "Packing finished items" },
  { code: "READY_FOR_STORE_DISPATCH",      name: "Ready for Store Dispatch",  sequence: 12, description: "Items ready to dispatch to store" },
  { code: "IN_TRANSIT_TO_STORE",           name: "In Transit to Store",       sequence: 13, description: "Items in transit back to store" },
  { code: "READY_FOR_DELIVERY",            name: "Ready for Delivery",        sequence: 14, description: "Items ready for customer delivery" },
  { code: "DELIVERED",                     name: "Delivered",                 sequence: 15, description: "Items delivered to customer" },
]

const SYSTEM_ROLES = [
  { code: "STORE_SUPERVISOR",           name: "Store Supervisor",           description: "Oversees store operations" },
  { code: "STORE_MANAGER",             name: "Store Manager",              description: "Full store visibility" },
  { code: "PROCESSING_ENTRY_SUPERVISOR", name: "Processing Entry Supervisor", description: "Supervises processing entry and tagging" },
  { code: "PROCESSING_MANAGER",        name: "Processing Manager",         description: "Full processing visibility" },
  { code: "WASHING_SUPERVISOR",         name: "Washing Supervisor",          description: "Supervises washing" },
  { code: "DRYING_SUPERVISOR",          name: "Drying Supervisor",          description: "Supervises drying" },
  { code: "IRONING_SUPERVISOR",         name: "Ironing Supervisor",         description: "Supervises ironing" },
  { code: "PACKING_SUPERVISOR",         name: "Packing Supervisor",         description: "Supervises folding and packing" },
  { code: "DISPATCH_SUPERVISOR",        name: "Dispatch Supervisor",        description: "Supervises dispatch to store" },
  { code: "DELIVERY_MANAGER",           name: "Delivery Manager",           description: "Manages delivery operations" },
  { code: "ADMIN",                      name: "Admin",                      description: "Full system access" },
]

const ALL_STAGE_CODES = SYSTEM_STAGES.map((s) => s.code)

const PROCESSING_STAGES = [
  "PROCESSING_ENTRY_AUDIT",
  "BARCODE_TAGGING",
  "WASHING",
  "DRYING",
  "IRONING",
  "FOLDING",
  "PACKING",
  "READY_FOR_STORE_DISPATCH",
  "IN_TRANSIT_TO_STORE",
]

const ROLE_STAGE_PERMISSIONS: Record<string, string[]> = {
  STORE_SUPERVISOR:           ["STORE_ORDER_CREATED", "STORE_AUDIT"],
  STORE_MANAGER:             ALL_STAGE_CODES,
  PROCESSING_ENTRY_SUPERVISOR: ["PROCESSING_ENTRY_AUDIT", "BARCODE_TAGGING"],
  PROCESSING_MANAGER:        PROCESSING_STAGES,
  WASHING_SUPERVISOR:        ["WASHING"],
  DRYING_SUPERVISOR:         ["DRYING"],
  IRONING_SUPERVISOR:        ["IRONING"],
  PACKING_SUPERVISOR:        ["FOLDING", "PACKING"],
  DISPATCH_SUPERVISOR:       ["READY_FOR_STORE_DISPATCH", "IN_TRANSIT_TO_STORE"],
  DELIVERY_MANAGER:          ["READY_FOR_DELIVERY", "DELIVERED"],
  ADMIN:                     ALL_STAGE_CODES,
}

// Stage → Department code → Role code mapping.
// Used to set responsibleRoleId and responsibleDepartmentId on each
// business's LaundryWorkflowConfiguration.
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

async function upsertStages(): Promise<Map<string, string>> {
  const stageMap = new Map<string, string>()
  for (const stage of SYSTEM_STAGES) {
    const existing = await prisma.laundryWorkflowStage.findUnique({ where: { code: stage.code } })
    if (existing) {
      await prisma.laundryWorkflowStage.update({
        where: { id: existing.id },
        data: { ...stage, isSystem: true, isActive: true },
      })
      stageMap.set(stage.code, existing.id)
      console.log(`  Stage ${stage.code} updated (system)`)
    } else {
      const created = await prisma.laundryWorkflowStage.create({
        data: { ...stage, isSystem: true, isActive: true },
      })
      stageMap.set(stage.code, created.id)
      console.log(`  Stage ${stage.code} created (system)`)
    }
  }
  return stageMap
}

async function upsertRoles(): Promise<Map<string, string>> {
  const roleMap = new Map<string, string>()
  for (const role of SYSTEM_ROLES) {
    const existing = await prisma.laundryRole.findUnique({ where: { code: role.code } })
    if (existing) {
      await prisma.laundryRole.update({
        where: { id: existing.id },
        data: { ...role, isSystem: true, isActive: true },
      })
      roleMap.set(role.code, existing.id)
      console.log(`  Role ${role.code} updated (system)`)
    } else {
      const created = await prisma.laundryRole.create({
        data: { ...role, isSystem: true, isActive: true },
      })
      roleMap.set(role.code, created.id)
      console.log(`  Role ${role.code} created (system)`)
    }
  }
  return roleMap
}

async function upsertStagePermissions(stageMap: Map<string, string>, roleMap: Map<string, string>) {
  for (const [roleCode, stageCodes] of Object.entries(ROLE_STAGE_PERMISSIONS)) {
    const roleId = roleMap.get(roleCode)
    if (!roleId) {
      console.log(`  Warning: Role ${roleCode} not found, skipping permissions`)
      continue
    }
    for (const stageCode of stageCodes) {
      const stageId = stageMap.get(stageCode)
      if (!stageId) {
        console.log(`  Warning: Stage ${stageCode} not found, skipping`)
        continue
      }
      await prisma.laundryStagePermission.upsert({
        where: { stageId_roleId: { stageId, roleId } },
        update: {},
        create: { stageId, roleId },
      })
    }
  }
  console.log("  Stage permissions synced")
}

async function ensureBusinessConfigs(stageMap: Map<string, string>) {
  const businesses = await prisma.laundryBusiness.findMany()
  for (const business of businesses) {
    const departments = await prisma.laundryDepartment.findMany({
      where: { businessId: business.id },
    })
    const deptByCode = new Map(departments.map((d) => [d.code, d.id]))

    const roles = await prisma.laundryRole.findMany()
    const roleByCode = new Map(roles.map((r) => [r.code, r.id]))

    for (const stage of SYSTEM_STAGES) {
      const stageId = stageMap.get(stage.code)
      if (!stageId) continue

      const mapping = STAGE_DEPARTMENT_ROLE[stage.code]
      const responsibleDepartmentId = mapping ? deptByCode.get(mapping.departmentCode) ?? null : null
      const responsibleRoleId = mapping ? roleByCode.get(mapping.roleCode) ?? null : null

      await prisma.laundryWorkflowConfiguration.upsert({
        where: { businessId_stageId: { businessId: business.id, stageId } },
        update: {
          responsibleRoleId,
          responsibleDepartmentId,
        },
        create: {
          businessId: business.id,
          stageId,
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
    console.log(`  Workflow configs synced for business: ${business.businessName}`)
  }
}

async function main() {
  console.log("Seeding Laundry OS Master Data...\n")

  console.log("1. System Stages")
  const stageMap = await upsertStages()

  console.log("\n2. System Roles")
  const roleMap = await upsertRoles()

  console.log("\n3. Default Stage Permissions")
  await upsertStagePermissions(stageMap, roleMap)

  console.log("\n4. Business Workflow Configurations")
  await ensureBusinessConfigs(stageMap)

  console.log("\nSeeding complete!")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
