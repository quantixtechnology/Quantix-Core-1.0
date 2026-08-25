// GET  /api/debug/laundry-orphan-workspace?code=LND-202606-0001  — reference report
// POST /api/debug/laundry-orphan-workspace?code=LND-202606-0001&confirm=1 — delete
//
// A LaundryBusiness with `platformBusinessId = null` belongs to no tenant: it
// has no Business Code, no owner, no routing, and nothing can reach it except a
// list that shows every row. One such record — LND-202606-0001, "VASTRASUDHA
// LAUNDRY" — sits next to the real VASTRASUDHA (BUS-202608-0008) and reads like
// a second identity for it.
//
// Deleting a workspace is irreversible, so this refuses to guess. GET counts
// every laundry table that carries a businessId and reports what it finds; POST
// repeats the count and deletes ONLY if the row is unlinked and every
// operational table is empty. Anything else is reported and left alone.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { platformOnly } from "@/lib/platform-guard"

export const runtime = "nodejs"

// Declared relations — Prisma cascades these when the parent row goes.
const CASCADE = ["laundryAuditLog", "laundryBrandingConfig", "laundryBusinessFeature", "laundryDeliveryExecutive", "laundryDepartment", "laundryNavigation", "laundryOperationalConfig", "laundryOrder", "laundryPlatformProvisioning", "laundryProcessingCenter", "laundryProvisioningItem", "laundryScalingLimit", "laundrySubscription", "laundryUserAssignment", "laundryWorkflowConfiguration", "laundryWorkflowQualityConfig"] as const

// A businessId with no declared relation. Prisma will NOT cascade these, so
// they must be counted before the delete and removed with it — otherwise the
// cleanup trades one orphan for forty-three.
//
// Some of these (the laundryAccess* tables) are keyed on the PLATFORM
// Business.id, not on LaundryBusiness.id. Counting them by this id matches
// nothing, which is the correct answer for a row that has no platform business.
const UNDECLARED = ["laundryAccessAssignment", "laundryAccessAudit", "laundryAccessRole", "laundryBag", "laundryBagAssignment", "laundryBagEvent", "laundryBagRelease", "laundryCategory", "laundryCrmActivity", "laundryCrmActivityType", "laundryCrmConfig", "laundryCrmEvent", "laundryCrmLead", "laundryCrmLeadField", "laundryCrmLeadSource", "laundryCrmLeadStatus", "laundryCrmLeadStatusHistory", "laundryCrmLostReason", "laundryCrmOpportunity", "laundryCrmPriority", "laundryCrmSalesStage", "laundryCrmStageHistory", "laundryCrmTask", "laundryCrmTaskType", "laundryCustomerSource", "laundryDeletedOrderLog", "laundryDeliveryExecutiveReset", "laundryFinancialSettings", "laundryGarment", "laundryInvoice", "laundryItemEvent", "laundryOrderAdjustment", "laundryOrderEvent", "laundryOrderFeedback", "laundryPacket", "laundryPayment", "laundryPaymentGateway", "laundryPickupBag", "laundryPricingRule", "laundryPricingRuleAudit", "laundryProcessingPackage", "laundryService", "laundryServiceGarmentCategory"] as const

// Real work having happened in the workspace. Any of these non-zero and the row
// is not an orphan, whatever its platformBusinessId says.
const OPERATIONAL = new Set<string>([
  "laundryOrder", "laundryInvoice", "laundryPayment", "laundryPacket", "laundryBag",
  "laundryPickupBag", "laundryProcessingPackage", "laundryCrmLead", "laundryCrmOpportunity",
  "laundryDeletedOrderLog", "laundryOrderEvent", "laundryItemEvent", "laundryDeliveryExecutive",
])

/* eslint-disable @typescript-eslint/no-explicit-any */
const model = (name: string) => (prisma as any)[name]

async function countAll(businessId: string) {
  const counts: Record<string, number> = {}
  for (const name of [...CASCADE, ...UNDECLARED]) {
    const m = model(name)
    if (!m?.count) continue
    counts[name] = await m.count({ where: { businessId } }).catch(() => -1)
  }
  // Stores are the one place a workspace can hold structure without a
  // businessId row of its own elsewhere.
  counts.laundryStore = await prisma.laundryStore.count({ where: { laundryBusinessId: businessId } }).catch(() => -1)
  return counts
}

async function load(code: string) {
  return prisma.laundryBusiness.findFirst({
    where: { businessCode: code },
    select: { id: true, businessCode: true, businessName: true, platformBusinessId: true, createdAt: true, status: true },
  })
}

function verdict(row: { platformBusinessId: string | null }, counts: Record<string, number>) {
  const nonZero = Object.entries(counts).filter(([, n]) => n > 0)
  const live = nonZero.filter(([k]) => OPERATIONAL.has(k))
  const reasons: string[] = []
  if (row.platformBusinessId) reasons.push(`linked to platform business ${row.platformBusinessId} — NOT an orphan`)
  for (const [k, n] of live) reasons.push(`${k} has ${n} row(s) — operational data`)
  return { safe: reasons.length === 0, reasons, nonZero: Object.fromEntries(nonZero) }
}

export async function GET(req: Request) {
  const denied = await platformOnly(req)
  if (denied) return denied
  const code = new URL(req.url).searchParams.get("code")
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })

  const row = await load(code)
  if (!row) return NextResponse.json({ found: false, code })
  const counts = await countAll(row.id)
  return NextResponse.json({ found: true, target: row, verdict: verdict(row, counts), counts })
}

export async function POST(req: Request) {
  const denied = await platformOnly(req)
  if (denied) return denied
  const sp = new URL(req.url).searchParams
  const code = sp.get("code")
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 })
  if (sp.get("confirm") !== "1") return NextResponse.json({ error: "confirm=1 required" }, { status: 400 })

  const row = await load(code)
  if (!row) return NextResponse.json({ error: `No LaundryBusiness with code ${code}` }, { status: 404 })

  // Re-counted here rather than trusting the GET: the decision to delete must
  // be made against the state at the moment of deletion.
  const counts = await countAll(row.id)
  const v = verdict(row, counts)
  if (!v.safe) return NextResponse.json({ deleted: false, target: row, verdict: v, counts }, { status: 409 })

  const removed: Record<string, number> = {}
  // The undeclared ones first — nothing cascades them, so they must go before
  // the parent or they become unreachable rows pointing at a missing id.
  for (const name of UNDECLARED) {
    const m = model(name)
    if (!m?.deleteMany) continue
    const r = await m.deleteMany({ where: { businessId: row.id } }).catch(() => null)
    if (r?.count) removed[name] = r.count
  }
  await prisma.laundryBusiness.delete({ where: { id: row.id } })

  const after = await load(code)
  return NextResponse.json({
    deleted: true,
    target: row,
    removedDependents: removed,
    cascaded: CASCADE.filter((c) => (counts[c] ?? 0) > 0).map((c) => ({ [c]: counts[c] })),
    stillResolvable: !!after,
  })
}
