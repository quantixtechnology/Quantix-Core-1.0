// POST /api/laundry/crm/leads/import
//
// Two modes over one body:
//   { mode: "validate" } → classify every row, create nothing
//   { mode: "commit" }   → create the rows that are valid and new
//
// The browser parses the file (the same way Categories and Pricing already do)
// and sends rows; it does NOT decide what is importable. This route re-derives
// the columns from the tenant's own active Lead Fields and reads only those, so
// a file cannot reach a field the administrator switched off and cannot
// introduce one of its own. Validation is buildLeadValues — the same engine
// that guards single lead creation, not a second set of rules.
//
// Partial by design: one bad row in a thousand rejects that row, not the file.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  requireCrmBusiness, ensureCrmDefaults, generateLeadCode, crmEvent,
  buildLeadValues, promoteSystemFields, CrmValidationError, CrmAccessError,
} from "@/lib/laundry-crm"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { importColumns, mapRow, isBlankRow, duplicateKey, type LeadFieldLike } from "@/lib/laundry-crm-import"

export const runtime = "nodejs"

/** A file larger than this is a mistake, not a lead list. */
const MAX_ROWS = 5000

type RowStatus = "NEW" | "DUPLICATE" | "INVALID"

interface RowReport {
  row: number
  status: RowStatus
  name: string
  phone: string
  reason?: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const guard = await requireLaundryPermission(request, body.businessId, "crm.leads.create")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(body.businessId)
    await ensureCrmDefaults(biz.id)

    const rows: Record<string, unknown>[] = Array.isArray(body.rows) ? body.rows : []
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `That file has ${rows.length} rows. Import up to ${MAX_ROWS} at a time.` }, { status: 400 })
    }
    const commit = body.mode === "commit"

    // The tenant's OWN configuration decides the columns — never the file.
    const fields = (await prisma.laundryCrmLeadField.findMany({
      where: { businessId: biz.id },
      orderBy: { displayOrder: "asc" },
    })) as unknown as LeadFieldLike[]
    const cols = importColumns(fields)
    if (cols.length === 0) {
      return NextResponse.json({ error: "No active lead fields are configured" }, { status: 400 })
    }

    // Existing identities, for duplicate detection. Scoped to this business, so
    // another tenant's leads can neither be matched nor revealed.
    const existing = await prisma.laundryCrmLead.findMany({
      where: { businessId: biz.id },
      select: { phone: true, email: true },
    })
    const seenPhone = new Set<string>()
    const seenEmail = new Set<string>()
    for (const l of existing) {
      const p = String(l.phone ?? "").replace(/\D/g, "")
      if (p.length >= 6) seenPhone.add(p.slice(-10))
      const e = String(l.email ?? "").trim().toLowerCase()
      if (e) seenEmail.add(e)
    }

    const report: RowReport[] = []
    const ignoredColumns = new Set<string>()
    const ready: { values: Record<string, unknown>; row: number }[] = []

    rows.forEach((raw, i) => {
      const rowNo = i + 2 // header is row 1
      if (isBlankRow(raw)) return // how a spreadsheet ends, not a mistake

      const { values, ignored } = mapRow(cols, raw)
      ignored.forEach((c) => ignoredColumns.add(c))

      let built: Record<string, unknown>
      try {
        built = buildLeadValues(fields as never, values, "create")
      } catch (err) {
        report.push({
          row: rowNo, status: "INVALID",
          name: String(values.first_name ?? values.business_name ?? ""),
          phone: String(values.phone ?? ""),
          reason: err instanceof CrmValidationError ? err.message : "Could not be read",
        })
        return
      }

      const promoted = promoteSystemFields(built)
      const dup = duplicateKey(built)
      const isDup = dup ? (dup.kind === "phone" ? seenPhone.has(dup.key) : seenEmail.has(dup.key)) : false

      if (isDup) {
        report.push({ row: rowNo, status: "DUPLICATE", name: promoted.displayName, phone: promoted.phone ?? "", reason: `Already on file by ${dup!.kind}` })
        return
      }
      // Claim the identity so a file repeating a lead does not import it twice.
      if (dup?.kind === "phone") seenPhone.add(dup.key)
      if (dup?.kind === "email") seenEmail.add(dup.key)

      report.push({ row: rowNo, status: "NEW", name: promoted.displayName, phone: promoted.phone ?? "" })
      ready.push({ values: built, row: rowNo })
    })

    const counts = {
      total: report.length,
      new: report.filter((r) => r.status === "NEW").length,
      duplicate: report.filter((r) => r.status === "DUPLICATE").length,
      invalid: report.filter((r) => r.status === "INVALID").length,
    }
    // Named so the preview can say WHICH columns were disregarded rather than
    // leaving the user to wonder why a value never arrived.
    const ignored = [...ignoredColumns]

    if (!commit) {
      return NextResponse.json({ success: true, mode: "validate", counts, ignored, report: report.slice(0, 500) })
    }

    let imported = 0
    const failed: RowReport[] = []
    for (const item of ready) {
      try {
        const promoted = promoteSystemFields(item.values)
        await prisma.laundryCrmLead.create({
          data: {
            businessId: biz.id,
            leadCode: await generateLeadCode(),
            displayName: promoted.displayName,
            phone: promoted.phone,
            email: promoted.email,
            fieldValues: JSON.stringify(item.values),
            // From the session, not the body: an importer must not be able to
            // attribute leads to someone else.
            createdById: guard.ctx.userId ?? null,
            createdByName: guard.ctx.userName ?? null,
          },
        })
        imported++
      } catch {
        // One row failing is one row failing.
        failed.push({ row: item.row, status: "INVALID", name: "", phone: "", reason: "Could not be saved" })
      }
    }

    // Audit through the CRM's own event trail — tenant-scoped already, and
    // visible where the rest of the CRM's history is.
    await crmEvent(biz.id, "LEAD_IMPORT", `Imported ${imported} lead(s)`, {
      meta: {
        fileName: String(body.fileName ?? "").slice(0, 200),
        totalRows: counts.total, imported,
        rejected: counts.invalid + failed.length,
        duplicates: counts.duplicate,
        ignoredColumns: ignored,
      },
      actor: { id: guard.ctx.userId, name: guard.ctx.userName },
    }).catch(() => null)

    return NextResponse.json({
      success: true, mode: "commit", imported,
      counts: { ...counts, invalid: counts.invalid + failed.length },
      ignored,
      report: [...report.filter((r) => r.status !== "NEW"), ...failed].slice(0, 500),
    })
  } catch (e) {
    if (e instanceof CrmAccessError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error("[crm/leads/import] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
