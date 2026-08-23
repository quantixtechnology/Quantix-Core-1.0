// GET /api/laundry/crm/leads/template?businessId=&format=xlsx|csv
//
// The import template, generated NOW from this tenant's Lead Fields. Nothing is
// stored: deactivate a field and the next download has one fewer column;
// reorder them and the columns move; add a custom field and it appears. The
// configuration is the template.
//
// Generated on the SERVER precisely so the browser cannot decide what is
// importable — the same reason the import route re-derives the columns rather
// than trusting the file's headers.
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults, CrmAccessError } from "@/lib/laundry-crm"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import {
  importColumns, headerRow, instructionRows, SHEET_LEADS, SHEET_INSTRUCTIONS,
  type LeadFieldLike,
} from "@/lib/laundry-crm-import"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    // Viewing leads is not enough to be handed the shape of the import; this is
    // the same permission that creates them.
    const guard = await requireLaundryPermission(request, businessId, "crm.leads.create")
    if (!guard.ok) return guard.res
    // Entitlement, not navigation: an unlicensed tenant gets 403 here even if
    // it somehow reaches the URL.
    const biz = await requireCrmBusiness(businessId)
    await ensureCrmDefaults(biz.id)

    const fields = (await prisma.laundryCrmLeadField.findMany({
      where: { businessId: biz.id },
      orderBy: { displayOrder: "asc" },
    })) as unknown as LeadFieldLike[]

    const cols = importColumns(fields)
    if (cols.length === 0) {
      return NextResponse.json({ error: "No active lead fields are configured" }, { status: 400 })
    }
    const inactive = fields.filter((f) => !f.active)
    const header = headerRow(cols)
    const format = (sp.get("format") || "xlsx").toLowerCase()

    if (format === "csv") {
      // Header only: a CSV has one sheet, so instructions would become rows the
      // importer then had to skip.
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([header]))
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="lead-import-template.csv"`,
          "Cache-Control": "no-store",
        },
      })
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header]), SHEET_LEADS)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructionRows(cols, inactive)), SHEET_INSTRUCTIONS)
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lead-import-template.xlsx"`,
        // The template is a snapshot of a configuration that can change at any
        // moment. A cached copy is a wrong copy.
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    if (e instanceof CrmAccessError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error("[crm/leads/template] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
