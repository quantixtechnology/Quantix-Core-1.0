// POST /api/laundry/customers/import
//
// Two modes over one body, the same shape the CRM lead importer uses:
//   { mode: "validate" } → classify every row, create nothing
//   { mode: "commit" }   → create the rows that are valid and new
//
// The browser parses the file and sends rows; it does NOT decide what is
// importable. This route re-reads only the columns in the shared contract, so a
// file cannot introduce a field of its own, and it creates through
// createLaundryCustomer() — the same function the single-customer form uses, so
// customer codes, acquisition source, metadata and addresses come out identical.
//
// Partial by design: one bad row rejects that row, not the file.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { createLaundryCustomer } from "@/lib/laundry-customer-create"
import { classifyRow, summarise, MAX_IMPORT_ROWS, type RowVerdict } from "@/lib/laundry-customer-import"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    // Same permission as creating one customer by hand — no new permission, and
    // no way to bulk-create without being allowed to create.
    const guard = await requireLaundryPermission(request, body.businessId, "laundry.customers.create")
    if (!guard.ok) return guard.res

    // TENANT BOUNDARY. The business comes from the guarded request context, never
    // from the file: a row cannot name another businessId and be believed.
    const biz = await resolveLaundryBusiness(body.businessId)
    if (!biz?.platformBusinessId) {
      return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    }
    const platformBusinessId = biz.platformBusinessId

    const rows: Record<string, unknown>[] = Array.isArray(body.rows) ? body.rows : []
    if (rows.length === 0) return NextResponse.json({ error: "That file has no rows." }, { status: 400 })
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `That file has ${rows.length} rows. Import up to ${MAX_IMPORT_ROWS} at a time.` },
        { status: 400 },
      )
    }

    // Existing mobiles for THIS business only — one indexed read instead of one
    // query per row. The rule is the same as single creation: one customer per
    // mobile, per business.
    const existing = await prisma.customer.findMany({
      where: { businessId: platformBusinessId, phone: { not: null } },
      select: { phone: true },
    })
    const existingMobiles = new Set(existing.map((c) => String(c.phone)))

    const seen = new Set<string>()
    const verdicts: RowVerdict[] = []
    for (let i = 0; i < rows.length; i++) {
      const v = classifyRow(rows[i], i + 2, { // +2: header is row 1, data starts at 2
        existsInBusiness: (m) => existingMobiles.has(m),
        seen,
      })
      if (!v) continue // blank row
      if (v.status === "VALID" && v.values) seen.add(v.values.mobile)
      verdicts.push(v)
    }

    if (body.mode !== "commit") {
      return NextResponse.json({ success: true, mode: "validate", summary: summarise(verdicts), rows: verdicts })
    }

    // ── Commit ────────────────────────────────────────────────────────────────
    // Row by row, NOT one transaction: a thousand customers in a single
    // transaction is a long lock for no benefit, and a failure at row 900 would
    // throw away 899 good records. Each row stands or falls on its own and the
    // report says exactly what happened to each.
    let created = 0
    const failures: RowVerdict[] = []
    for (const v of verdicts) {
      if (v.status !== "VALID" || !v.values) continue
      try {
        // Re-check immediately before writing: another operator (or a second tab)
        // may have created this mobile since the preview was generated.
        const clash = await prisma.customer.findFirst({
          where: { businessId: platformBusinessId, phone: v.values.mobile },
          select: { id: true },
        })
        if (clash) {
          v.status = "DUPLICATE"
          v.reason = "Already exists — this customer was left unchanged"
          continue
        }
        await createLaundryCustomer(platformBusinessId, biz.id, {
          name: v.values.name,
          mobile: v.values.mobile,
          alternateMobile: v.values.alternateMobile || null,
          email: v.values.email || null,
          addressLine1: v.values.addressLine1 || null,
          addressLine2: v.values.addressLine2 || null,
          area: v.values.area || null,
          landmark: v.values.landmark || null,
          city: v.values.city || null,
          state: v.values.state || null,
          pincode: v.values.pincode || null,
          gstNumber: v.values.gstNumber || null,
          notes: v.values.notes || null,
        })
        created++
      } catch (e) {
        console.error("[laundry-customer-import] row", v.row, e)
        v.status = "INVALID"
        v.reason = "Could not be created — please check this row and try again"
        failures.push(v)
      }
    }

    return NextResponse.json({
      success: true,
      mode: "commit",
      created,
      summary: summarise(verdicts),
      rows: verdicts,
      failures,
    })
  } catch (e) {
    console.error("[laundry-customer-import] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
