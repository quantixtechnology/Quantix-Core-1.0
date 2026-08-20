// ============================================================================
// Tenant reconciliation audit — READ ONLY.
//
// A tenant is one platform Business row. Everything else — LaundryBusiness,
// stores, users, customers, orders — belongs to a tenant and is never counted
// as one.
//
// The sweep is generic rather than a hand-written list of models: it asks the
// database which tables carry a business foreign key and group-counts each one.
// A hand-written list goes stale the moment someone adds a model, and an audit
// that silently misses a table is worse than no audit — it would report a
// deletion as safe while rows sat behind it.
//
// NOTHING here writes. No INSERT, UPDATE, DELETE or DDL is issued, and the only
// statements are SELECT and PRAGMA.
// ============================================================================
import { prisma } from "@/lib/prisma"

/** Columns that may point at a tenant, in either direction. */
const FK_COLUMNS = ["businessId", "platformBusinessId", "laundryBusinessId"] as const

/** SQLite identifiers we will interpolate — validated before use. */
const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

export interface TenantRow {
  id: string
  name: string
  slug: string
  status: string
  businessType: string | null
  productCode: string | null
  subscriptionPlanCode: string | null
  createdAt: string
  updatedAt: string
}

export interface TenantAudit {
  generatedAt: string
  businesses: TenantRow[]
  totalBusinesses: number
  /** tables scanned and how the FK resolved */
  tablesScanned: number
  /** businessId → { table → row count } for every non-empty table */
  recordsByBusiness: Record<string, Record<string, number>>
  /**
   * Rows whose tenant id resolves to no Business.
   *
   * `dangling` — the id matches nothing at all; the tenant is gone.
   * `unlinked` — it matches a LaundryBusiness that has no platformBusinessId,
   *   so the workspace exists but was never tied to a tenant. A different
   *   problem with a different fix, and collapsing the two would hide it.
   */
  orphans: { table: string; column: string; referencedId: string; rows: number; kind: "dangling" | "unlinked" }[]
  /** LaundryBusiness rows and which platform business they belong to */
  laundryBusinesses: { id: string; name: string | null; platformBusinessId: string | null }[]
  /** FileUpload ledger totals per business */
  files: Record<string, { count: number; bytes: number }>
  /**
   * Every domain mapping, live or stale.
   *
   * Both `domain` and `businessId` are unique, so a mapping left behind by a
   * deleted business permanently reserves that hostname — the reason stale
   * mappings matter more than their row count suggests.
   */
  domains: {
    id: string; businessId: string; domain: string; subdomain: string | null
    status: string; createdAt: string; orphaned: boolean
  }[]
  /** Record ids behind each orphan group, so a cleanup can be reviewed row by row. */
  orphanDetail: { table: string; column: string; referencedId: string; ids: string[] }[]
}

interface TableFk { table: string; column: string }

/** Every table that carries a tenant foreign key, discovered at run time. */
async function discoverTenantTables(): Promise<TableFk[]> {
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'`,
  )
  const out: TableFk[] = []
  for (const t of tables) {
    if (!SAFE_IDENT.test(t.name)) continue
    const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${t.name}")`)
    for (const c of cols) {
      if ((FK_COLUMNS as readonly string[]).includes(c.name)) out.push({ table: t.name, column: c.name })
    }
  }
  return out
}

export async function auditTenants(opts: { detail?: boolean } = {}): Promise<TenantAudit> {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, slug: true, status: true, businessType: true,
      productCode: true, subscriptionPlanCode: true, createdAt: true, updatedAt: true,
    },
  })
  const businessIds = new Set(businesses.map((b) => b.id))

  // A laundry id is not a tenant — it resolves TO one. Without this map every
  // laundry-scoped row would be reported as an orphan.
  const laundries = await prisma.laundryBusiness.findMany({
    select: { id: true, businessName: true, platformBusinessId: true },
  })
  const platformIdByLaundryId = new Map(
    laundries.filter((l) => l.platformBusinessId).map((l) => [l.id, l.platformBusinessId as string]),
  )
  const unlinkedLaundryIds = new Set(laundries.filter((l) => !l.platformBusinessId).map((l) => l.id))

  const tenantTables = await discoverTenantTables()
  const recordsByBusiness: Record<string, Record<string, number>> = {}
  const orphans: TenantAudit["orphans"] = []

  for (const { table, column } of tenantTables) {
    // The Business table's own id is the tenant, not a reference to one.
    if (table === "Business") continue

    let rows: { key: string | null; n: bigint | number }[]
    try {
      rows = await prisma.$queryRawUnsafe<{ key: string | null; n: bigint | number }[]>(
        `SELECT "${column}" AS key, COUNT(*) AS n FROM "${table}" GROUP BY "${column}"`,
      )
    } catch {
      continue // view, or a table Prisma knows and SQLite does not — skip quietly
    }

    for (const r of rows) {
      if (!r.key) continue
      const n = Number(r.n)
      const resolved = businessIds.has(r.key)
        ? r.key
        : platformIdByLaundryId.get(r.key) ?? null

      if (!resolved) {
        orphans.push({
          table, column, referencedId: r.key, rows: n,
          kind: unlinkedLaundryIds.has(r.key) ? "unlinked" : "dangling",
        })
        continue
      }
      const bucket = (recordsByBusiness[resolved] ??= {})
      // A laundry table and a platform table can both land on the same tenant.
      bucket[table] = (bucket[table] ?? 0) + n
    }
  }

  // File ledger totals, straight from the rows the storage screen counts.
  const fileRows = await prisma.fileUpload.groupBy({
    by: ["businessId"],
    where: { status: "COMPLETED" },
    _count: { _all: true },
    _sum: { size: true },
  })
  const files: TenantAudit["files"] = {}
  for (const f of fileRows) {
    files[f.businessId] = { count: f._count._all, bytes: f._sum.size ?? 0 }
  }

  // Domain mappings — the whole table, flagged by whether their tenant survives.
  const domainRows = await prisma.domainMapping.findMany({
    select: { id: true, businessId: true, domain: true, subdomain: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  const domains = domainRows.map((d) => ({
    id: d.id,
    businessId: d.businessId,
    domain: d.domain,
    subdomain: d.subdomain,
    status: String(d.status),
    createdAt: d.createdAt.toISOString(),
    orphaned: !businessIds.has(d.businessId) && !platformIdByLaundryId.has(d.businessId),
  }))

  // Row ids behind each orphan group, so a proposed cleanup can be checked one
  // record at a time instead of trusting a count.
  const orphanDetail: TenantAudit["orphanDetail"] = []
  if (opts.detail) {
    for (const o of orphans) {
      try {
        const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "${o.table}" WHERE "${o.column}" = ? LIMIT 200`,
          o.referencedId,
        )
        orphanDetail.push({ table: o.table, column: o.column, referencedId: o.referencedId, ids: rows.map((r) => r.id) })
      } catch {
        // No `id` column on this table — the count still stands, the ids do not.
        orphanDetail.push({ table: o.table, column: o.column, referencedId: o.referencedId, ids: [] })
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    businesses: businesses.map((b) => ({
      ...b,
      businessType: b.businessType as string | null,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    })),
    totalBusinesses: businesses.length,
    tablesScanned: tenantTables.length,
    recordsByBusiness,
    orphans: orphans.sort((a, b) => b.rows - a.rows),
    laundryBusinesses: laundries.map((l) => ({
      id: l.id, name: l.businessName, platformBusinessId: l.platformBusinessId,
    })),
    files,
    domains,
    orphanDetail,
  }
}
