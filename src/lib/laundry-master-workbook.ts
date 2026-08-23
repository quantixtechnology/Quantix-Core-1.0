// ============================================================================
// The master-data workbook: one contract, four uses.
//
// The blank template, the example template, the export of a tenant's own data
// and the parser that reads a filled-in file all come from here — so a column
// cannot mean one thing when it is written and another when it is read.
//
// The columns are the fields /api/laundry/masters/bulk-import ACTUALLY accepts,
// read off that route rather than designed here. A template offering a column
// the importer ignores is worse than no template: the user fills it in, the
// import succeeds, and the value silently disappears.
//
// Deliberately NOT offered, because the importer has nowhere to put them:
//   • "Active" on any sheet — the importer only ever creates.
//   • "Description" on Services.
//   • "Service" on Garments — a garment is linked to a CATEGORY. Garment×service
//     pricing is the Pricing Matrix's job and has its own workbook.
//
// Pure: no I/O, no XLSX, no Prisma. The dialog does the file work; this decides
// what the rows mean.
// ============================================================================

export type Unit = "PIECE" | "KG"

export const SHEET = {
  categories: "Categories",
  services: "Services",
  garments: "Garments",
} as const

/** Header row per sheet. Order is the column order in the file. */
export const COLUMNS = {
  categories: ["Name", "Code", "Color", "GST %", "Display Order"],
  services: ["Name", "Code", "Category", "Pricing Type", "Turnaround Hours", "Express Available", "Subscription Eligible", "Display Order"],
  garments: ["Name", "Code", "Category", "Unit", "Avg Weight (kg)", "Material", "Display Order"],
} as const

/** Shown in the example workbook so the shape of a real row is obvious. */
export const EXAMPLE_ROWS = {
  categories: [
    ["Laundry", "LND", "#3B82F6", 5, 1],
    ["Household", "HSH", "#10B981", 5, 2],
  ],
  services: [
    ["Wash & Fold", "WF", "Laundry", "PER_KG", 24, "No", "Yes", 1],
    ["Dry Clean", "DC", "Laundry", "PER_PIECE", 48, "Yes", "No", 2],
  ],
  garments: [
    ["Shirt", "SHT", "Laundry", "PIECE", 0.2, "Cotton", 1],
    ["Blanket", "BLK", "Household", "PIECE", 2, "Wool", 2],
    ["Mixed Wash", "MXW", "Laundry", "KG", 1, "", 3],
  ],
} as const

export interface ParsedCategory { name: string; code?: string; color?: string; defaultGstPercent?: number; displayOrder: number }
export interface ParsedService { name: string; code?: string; category?: string; defaultPricingType: string; defaultTurnaroundHours: number; expressAvailable: boolean; subscriptionEligible: boolean; displayOrder: number }
export interface ParsedGarment { name: string; code?: string; category?: string; defaultUnit: Unit; averageWeight?: number; material?: string; displayOrder: number }

export interface RowError { sheet: string; row: number; field: string; message: string }

export interface ParseCounts { total: number; new: number; existing: number; invalid: number }

export interface ParseResult {
  categories: ParsedCategory[]
  services: ParsedService[]
  garments: ParsedGarment[]
  errors: RowError[]
  counts: { categories: ParseCounts; services: ParseCounts; garments: ParseCounts }
}

/** Existing tenant names, so the preview can say what will be skipped. */
export interface ExistingNames { categories: string[]; services: string[]; garments: string[] }

const norm = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim())
const lower = (v: unknown): string => norm(v).toLowerCase()

/** Header lookup that survives case, spacing and a missing unit suffix. */
function pick(row: Record<string, unknown>, ...names: string[]): unknown {
  const keys = Object.keys(row)
  for (const wanted of names) {
    const hit = keys.find((k) => k.trim().toLowerCase().replace(/\s+/g, " ") === wanted.toLowerCase())
    if (hit !== undefined) return row[hit]
  }
  // "Avg Weight (kg)" should still be found when someone types "Avg Weight".
  for (const wanted of names) {
    const hit = keys.find((k) => k.trim().toLowerCase().startsWith(wanted.toLowerCase().split(" (")[0]))
    if (hit !== undefined) return row[hit]
  }
  return undefined
}

const truthy = (v: unknown): boolean => ["yes", "y", "true", "1"].includes(lower(v))

function numberOr(v: unknown, fallback: number | undefined): number | undefined {
  const s = norm(v)
  if (!s) return fallback
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Turn the three sheets into importer payloads, reporting every row that
 * cannot be used and why.
 *
 * A row is INVALID only when it cannot be imported at all. A row naming a
 * category that does not exist is not invalid — the importer stores the item
 * with no category rather than refusing it — so that is reported as a warning
 * the user can act on, and the row still counts.
 */
export function parseMasterWorkbook(
  sheets: { categories?: Record<string, unknown>[]; services?: Record<string, unknown>[]; garments?: Record<string, unknown>[] },
  existing: ExistingNames = { categories: [], services: [], garments: [] },
): ParseResult {
  const errors: RowError[] = []
  const categories: ParsedCategory[] = []
  const services: ParsedService[] = []
  const garments: ParsedGarment[] = []

  const have = {
    categories: new Set(existing.categories.map((n) => n.toLowerCase())),
    services: new Set(existing.services.map((n) => n.toLowerCase())),
    garments: new Set(existing.garments.map((n) => n.toLowerCase())),
  }
  const counts = {
    categories: { total: 0, new: 0, existing: 0, invalid: 0 },
    services: { total: 0, new: 0, existing: 0, invalid: 0 },
    garments: { total: 0, new: 0, existing: 0, invalid: 0 },
  }

  // Names claimed by THIS file, so a duplicate inside one upload is caught too.
  const seen = { categories: new Set<string>(), services: new Set<string>(), garments: new Set<string>() }

  // ── Categories ────────────────────────────────────────────────────────────
  ;(sheets.categories ?? []).forEach((raw, i) => {
    const row = i + 2 // header is row 1
    const name = norm(pick(raw, "Name"))
    if (!name) {
      // A trailing blank row is not an error, it is how spreadsheets end.
      if (Object.values(raw).every((v) => !norm(v))) return
      counts.categories.total++; counts.categories.invalid++
      errors.push({ sheet: SHEET.categories, row, field: "Name", message: "Category name is required" })
      return
    }
    counts.categories.total++
    if (seen.categories.has(name.toLowerCase())) {
      counts.categories.invalid++
      errors.push({ sheet: SHEET.categories, row, field: "Name", message: `Duplicate of an earlier row: "${name}"` })
      return
    }
    seen.categories.add(name.toLowerCase())
    if (have.categories.has(name.toLowerCase())) { counts.categories.existing++; return }

    const gstRaw = pick(raw, "GST %", "GST")
    const gst = numberOr(gstRaw, undefined)
    if (norm(gstRaw) && (gst === undefined || gst < 0 || gst > 100)) {
      counts.categories.invalid++
      errors.push({ sheet: SHEET.categories, row, field: "GST %", message: `"${norm(gstRaw)}" is not a percentage between 0 and 100` })
      return
    }
    counts.categories.new++
    categories.push({
      name, code: norm(pick(raw, "Code")) || undefined, color: norm(pick(raw, "Color")) || undefined,
      defaultGstPercent: gst, displayOrder: numberOr(pick(raw, "Display Order"), 0) ?? 0,
    })
  })

  // Categories the file itself introduces count as known for the sheets below.
  const knownCategories = new Set<string>([...have.categories, ...categories.map((c) => c.name.toLowerCase())])

  // ── Services ──────────────────────────────────────────────────────────────
  ;(sheets.services ?? []).forEach((raw, i) => {
    const row = i + 2
    const name = norm(pick(raw, "Name"))
    if (!name) {
      if (Object.values(raw).every((v) => !norm(v))) return
      counts.services.total++; counts.services.invalid++
      errors.push({ sheet: SHEET.services, row, field: "Name", message: "Service name is required" })
      return
    }
    counts.services.total++
    if (seen.services.has(name.toLowerCase())) {
      counts.services.invalid++
      errors.push({ sheet: SHEET.services, row, field: "Name", message: `Duplicate of an earlier row: "${name}"` })
      return
    }
    seen.services.add(name.toLowerCase())
    if (have.services.has(name.toLowerCase())) { counts.services.existing++; return }

    const category = norm(pick(raw, "Category"))
    if (category && !knownCategories.has(category.toLowerCase())) {
      errors.push({ sheet: SHEET.services, row, field: "Category", message: `No category named "${category}" — the service will be imported without one` })
    }
    const hours = numberOr(pick(raw, "Turnaround Hours"), 24)
    if (hours === undefined || hours < 0) {
      counts.services.invalid++
      errors.push({ sheet: SHEET.services, row, field: "Turnaround Hours", message: `"${norm(pick(raw, "Turnaround Hours"))}" is not a number of hours` })
      return
    }
    counts.services.new++
    services.push({
      name, code: norm(pick(raw, "Code")) || undefined,
      category: category || undefined,
      defaultPricingType: norm(pick(raw, "Pricing Type")).toUpperCase() || "PER_PIECE",
      defaultTurnaroundHours: hours,
      expressAvailable: truthy(pick(raw, "Express Available")),
      subscriptionEligible: truthy(pick(raw, "Subscription Eligible")),
      displayOrder: numberOr(pick(raw, "Display Order"), 0) ?? 0,
    })
  })

  // ── Garments ──────────────────────────────────────────────────────────────
  ;(sheets.garments ?? []).forEach((raw, i) => {
    const row = i + 2
    const name = norm(pick(raw, "Name"))
    if (!name) {
      if (Object.values(raw).every((v) => !norm(v))) return
      counts.garments.total++; counts.garments.invalid++
      errors.push({ sheet: SHEET.garments, row, field: "Name", message: "Garment name is required" })
      return
    }
    counts.garments.total++
    if (seen.garments.has(name.toLowerCase())) {
      counts.garments.invalid++
      errors.push({ sheet: SHEET.garments, row, field: "Name", message: `Duplicate of an earlier row: "${name}"` })
      return
    }
    seen.garments.add(name.toLowerCase())
    if (have.garments.has(name.toLowerCase())) { counts.garments.existing++; return }

    const unitRaw = norm(pick(raw, "Unit"))
    const unit = unitRaw.toUpperCase()
    if (unitRaw && unit !== "PIECE" && unit !== "KG") {
      counts.garments.invalid++
      errors.push({ sheet: SHEET.garments, row, field: "Unit", message: `"${unitRaw}" is not a unit — use PIECE or KG` })
      return
    }
    const weightRaw = pick(raw, "Avg Weight (kg)", "Avg Weight")
    const weight = numberOr(weightRaw, undefined)
    if (norm(weightRaw) && (weight === undefined || weight < 0)) {
      counts.garments.invalid++
      errors.push({ sheet: SHEET.garments, row, field: "Avg Weight (kg)", message: `"${norm(weightRaw)}" is not a weight in kg` })
      return
    }
    const category = norm(pick(raw, "Category"))
    if (category && !knownCategories.has(category.toLowerCase())) {
      errors.push({ sheet: SHEET.garments, row, field: "Category", message: `No category named "${category}" — the garment will be imported without one` })
    }
    counts.garments.new++
    garments.push({
      name, code: norm(pick(raw, "Code")) || undefined,
      category: category || undefined,
      defaultUnit: (unit === "KG" ? "KG" : "PIECE") as Unit,
      averageWeight: weight, material: norm(pick(raw, "Material")) || undefined,
      displayOrder: numberOr(pick(raw, "Display Order"), 0) ?? 0,
    })
  })

  return { categories, services, garments, errors, counts }
}

/** Total records the importer would create. */
export const newRecordCount = (r: ParseResult): number =>
  r.categories.length + r.services.length + r.garments.length
