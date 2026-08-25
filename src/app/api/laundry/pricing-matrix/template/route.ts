// GET /api/laundry/pricing-matrix/template?businessId= — the bulk-pricing
// import template, as a formatted .xlsx.
//
// Generated on the SERVER, from the ACTIVE services, for two reasons:
//
//   • the column list must come from the same canonical service configuration
//     the Pricing Matrix itself is built from. Nothing here is hardcoded, so
//     deactivating a service removes its columns and reactivating one restores
//     them, with no second list to keep in step.
//   • the community build of `xlsx` (which the browser side uses) silently
//     drops cell styling, freeze panes and data validation — verified against
//     the installed version. ExcelJS writes all three, and keeping it on the
//     server keeps it out of the client bundle.
//
// Column contract per service, matching the importer exactly:
//     <Service>  ·  <Service> Type  ·  <Service> Subscription
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

/** One header band, so a service's three columns read as one group. */
const BANDS = ["FFE8F0FE", "FFF1F8E9"] as const
const FIXED = ["Garment Code", "Garment Name", "Category"] as const

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get("businessId")
  if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 })
  const guard = await requireLaundryPermission(request, businessId, "laundry.pricing.view")
  if (!guard.ok) return guard.res
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

  const [services, categories, garment] = await Promise.all([
    prisma.laundryService.findMany({ where: { businessId: biz.id, isActive: true }, orderBy: { displayOrder: "asc" }, select: { name: true } }),
    prisma.laundryCategory.findMany({ where: { businessId: biz.id, isActive: true }, orderBy: { displayOrder: "asc" }, select: { name: true }, take: 1 }),
    prisma.laundryGarment.findFirst({ where: { businessId: biz.id, isActive: true }, orderBy: { displayOrder: "asc" }, select: { code: true, name: true } }),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = "Quantix Laundry OS"
  const ws = wb.addWorksheet("Pricing", { views: [{ state: "frozen", ySplit: 1 }] })

  ws.columns = [
    { header: FIXED[0], key: "code", width: 16 },
    { header: FIXED[1], key: "name", width: 24 },
    { header: FIXED[2], key: "cat", width: 18 },
    ...services.flatMap((s) => [
      { header: s.name, key: `p_${s.name}`, width: 13 },
      { header: `${s.name} Type`, key: `t_${s.name}`, width: 14 },
      { header: `${s.name} Subscription`, key: `s_${s.name}`, width: 15 },
    ]),
  ]

  // ── Header row: one consistent look for every column, wrapped and centred so
  //    a long service name is never clipped and never overlaps its neighbour.
  const head = ws.getRow(1)
  head.height = 38
  head.font = { bold: true, size: 11, color: { argb: "FF1F2937" } }
  head.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  head.eachCell((cell, col) => {
    // The three fixed columns first, then one alternating band per service, so
    // a service's price / type / subscription read as a single group.
    const fill = col <= FIXED.length ? "FFF3F4F6" : BANDS[Math.floor((col - FIXED.length - 1) / 3) % BANDS.length]
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "medium", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    }
  })

  // ── One example row, aligned to the header exactly. The first service is
  //    priced and included; the rest are NA, which is what a garment that only
  //    uses one service actually looks like.
  const example = [
    garment?.code || "GAR00001",
    garment?.name || "Shirt",
    categories[0]?.name || "",
    ...services.flatMap((_, i) => (i === 0 ? [100, "PER_KG", "YES"] : ["NA", "NA", "NO"])),
  ]
  const sample = ws.addRow(example)
  sample.alignment = { horizontal: "center", vertical: "middle" }
  sample.getCell(1).alignment = { horizontal: "left", vertical: "middle" }
  sample.getCell(2).alignment = { horizontal: "left", vertical: "middle" }
  sample.font = { italic: true, color: { argb: "FF6B7280" } }

  // ── Dropdowns, so the two constrained columns cannot be typed wrong. Applied
  //    over a generous row range because the sheet is filled in by hand.
  const LAST = 2000
  services.forEach((_, i) => {
    const typeCol = ws.getColumn(FIXED.length + i * 3 + 2).letter
    const subCol = ws.getColumn(FIXED.length + i * 3 + 3).letter
    for (let r = 2; r <= LAST; r++) {
      ws.getCell(`${typeCol}${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: ['"PER_PIECE,PER_KG,NA"'],
        showErrorMessage: true, errorTitle: "Pricing Type",
        error: "Choose PER_PIECE, PER_KG, or NA.",
      }
      ws.getCell(`${subCol}${r}`).dataValidation = {
        type: "list", allowBlank: true, formulae: ['"YES,NO"'],
        showErrorMessage: true, errorTitle: "Subscription",
        // NA and NO are different statements and the sheet should say so.
        error: "Choose YES or NO. This is separate from the pricing type — a priced service can still be excluded from the subscription.",
      }
    }
  })

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pricing-template.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
