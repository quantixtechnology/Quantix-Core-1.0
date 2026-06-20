import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DEFAULT_STAGES = [
  { code: "STORE_AUDIT",              name: "Store Audit",             sequence: 1,  description: "Initial audit at store reception", isDefault: true },
  { code: "STORE_DISPATCH",           name: "Store Dispatch",          sequence: 2,  description: "Dispatch from store to processing center", isDefault: false },
  { code: "PROCESSING_ENTRY_AUDIT",   name: "Processing Entry Audit",  sequence: 3,  description: "Audit at processing center arrival", isDefault: true },
  { code: "BARCODE_TAGGING",          name: "Barcode Tagging",         sequence: 4,  description: "Tag items with barcodes", isDefault: false },
  { code: "WASHING_QUEUE",            name: "Washing Queue",           sequence: 5,  description: "Items queued for washing", isDefault: true },
  { code: "WASHING",                  name: "Washing",                 sequence: 6,  description: "Washing process", isDefault: true },
  { code: "DRYING",                   name: "Drying",                  sequence: 7,  description: "Drying process", isDefault: true },
  { code: "IRONING",                  name: "Ironing",                 sequence: 8,  description: "Ironing process", isDefault: true },
  { code: "FOLDING",                  name: "Folding",                 sequence: 9,  description: "Folding process", isDefault: true },
  { code: "PACKING",                  name: "Packing",                 sequence: 10, description: "Packing finished items", isDefault: true },
  { code: "DISPATCH_TO_STORE",        name: "Dispatch to Store",       sequence: 11, description: "Dispatch back to store", isDefault: false },
  { code: "STORE_RECEIVED",           name: "Store Received",          sequence: 12, description: "Items received back at store", isDefault: true },
  { code: "READY_FOR_DELIVERY",       name: "Ready for Delivery",      sequence: 13, description: "Items ready for customer delivery", isDefault: true },
  { code: "DELIVERED",                name: "Delivered",               sequence: 14, description: "Items delivered to customer", isDefault: true },
]

const DEFAULT_ROLES = [
  { code: "STORE_SUPERVISOR",           name: "Store Supervisor",           description: "Oversees store operations" },
  { code: "STORE_MANAGER",             name: "Store Manager",              description: "Manages store" },
  { code: "PROC_ENTRY_SUPERVISOR",     name: "Processing Entry Supervisor", description: "Supervises processing entry" },
  { code: "PROCESSING_MANAGER",        name: "Processing Manager",         description: "Manages processing center" },
  { code: "WASH_SUPERVISOR",           name: "Wash Supervisor",            description: "Supervises washing" },
  { code: "DRYING_SUPERVISOR",         name: "Drying Supervisor",          description: "Supervises drying" },
  { code: "IRONING_SUPERVISOR",        name: "Ironing Supervisor",         description: "Supervises ironing" },
  { code: "PACKING_SUPERVISOR",        name: "Packing Supervisor",         description: "Supervises packing" },
  { code: "DISPATCH_SUPERVISOR",       name: "Dispatch Supervisor",        description: "Supervises dispatch" },
  { code: "DELIVERY_MANAGER",          name: "Delivery Manager",           description: "Manages delivery operations" },
  { code: "ADMIN",                     name: "Admin",                      description: "Full system access" },
]

// STANDARD plan gets these stages enabled
const STANDARD_STAGES = new Set([
  "STORE_AUDIT",
  "STORE_DISPATCH",
  "PROCESSING_ENTRY_AUDIT",
  "PACKING",
  "STORE_RECEIVED",
  "READY_FOR_DELIVERY",
  "DELIVERED",
])

const STANDARD_ROLE_STAGE_MAP: Record<string, string[]> = {
  STORE_SUPERVISOR:      ["STORE_AUDIT", "STORE_DISPATCH", "STORE_RECEIVED", "READY_FOR_DELIVERY"],
  STORE_MANAGER:         ["STORE_AUDIT", "STORE_DISPATCH", "STORE_RECEIVED", "READY_FOR_DELIVERY", "DELIVERED"],
  PROC_ENTRY_SUPERVISOR: ["PROCESSING_ENTRY_AUDIT", "BARCODE_TAGGING", "PACKING", "DISPATCH_TO_STORE"],
  PROCESSING_MANAGER:    ["PROCESSING_ENTRY_AUDIT", "BARCODE_TAGGING", "WASHING_QUEUE", "WASHING", "DRYING", "IRONING", "FOLDING", "PACKING", "DISPATCH_TO_STORE"],
  WASH_SUPERVISOR:       ["WASHING_QUEUE", "WASHING"],
  DRYING_SUPERVISOR:     ["DRYING"],
  IRONING_SUPERVISOR:    ["IRONING"],
  PACKING_SUPERVISOR:    ["PACKING"],
  DISPATCH_SUPERVISOR:   ["DISPATCH_TO_STORE"],
  DELIVERY_MANAGER:      ["READY_FOR_DELIVERY", "DELIVERED"],
  ADMIN:                 DEFAULT_STAGES.map((s) => s.code),
}

async function main() {
  console.log("Seeding Laundry Workflow Engine...")

  // 1. Create default stages
  const stageMap = new Map<string, string>()
  for (const stage of DEFAULT_STAGES) {
    const existing = await prisma.laundryWorkflowStage.findUnique({ where: { code: stage.code } })
    if (existing) {
      stageMap.set(stage.code, existing.id)
      console.log(`  Stage ${stage.code} already exists (${existing.id})`)
    } else {
      const created = await prisma.laundryWorkflowStage.create({ data: stage })
      stageMap.set(stage.code, created.id)
      console.log(`  Created stage: ${stage.code} (${created.id})`)
    }
  }

  // 2. Create default roles
  const roleMap = new Map<string, string>()
  for (const role of DEFAULT_ROLES) {
    const existing = await prisma.laundryRole.findUnique({ where: { code: role.code } })
    if (existing) {
      roleMap.set(role.code, existing.id)
      console.log(`  Role ${role.code} already exists (${existing.id})`)
    } else {
      const created = await prisma.laundryRole.create({ data: role })
      roleMap.set(role.code, created.id)
      console.log(`  Created role: ${role.code} (${created.id})`)
    }
  }

  // 3. Create stage-role permissions
  for (const [roleCode, stageCodes] of Object.entries(STANDARD_ROLE_STAGE_MAP)) {
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
      const existing = await prisma.laundryStagePermission.findUnique({
        where: { stageId_roleId: { stageId, roleId } },
      })
      if (!existing) {
        await prisma.laundryStagePermission.create({
          data: { stageId, roleId },
        })
        console.log(`  Created permission: ${roleCode} -> ${stageCode}`)
      }
    }
  }

  // 4. Create workflow configurations for existing businesses
  const businesses = await prisma.laundryBusiness.findMany()
  for (const business of businesses) {
    const enabledStages = business.plan === "PRO"
      ? DEFAULT_STAGES.map((s) => s.code)
      : Array.from(STANDARD_STAGES)

    for (const stageCode of enabledStages) {
      const stageId = stageMap.get(stageCode)
      if (!stageId) continue

      const existing = await prisma.laundryWorkflowConfiguration.findUnique({
        where: { businessId_stageId: { businessId: business.id, stageId } },
      })
      if (!existing) {
        await prisma.laundryWorkflowConfiguration.create({
          data: { businessId: business.id, stageId, enabled: true },
        })
        console.log(`  Config: ${business.businessName} -> ${stageCode} (enabled)`)
      }
    }

    // Add disabled configs for PRO plan for stages not in STANDARD
    if (business.plan === "PRO") {
      // All stages already enabled above
    }
  }

  console.log("Seeding complete!")
}

main()
  .catch((e) => {
    console.error("Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
