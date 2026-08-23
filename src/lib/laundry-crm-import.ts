// ============================================================================
// CRM bulk lead import — the column contract.
//
// The template is NOT a file. It is generated, every time, from the tenant's
// own Lead Fields: whichever are active, in the order the administrator put
// them, with the labels they chose and the options they configured. Deactivate
// a field and the next download has one fewer column; add a custom one and it
// appears. No developer is involved and no template is stored.
//
// That also makes the configuration the authority on the way IN. A file may
// carry any columns at all; only fields that are active on THIS tenant are read
// from it, so an upload can never reach a field the administrator switched off
// and never introduces a field of its own.
//
// Pure: no XLSX, no Prisma, no I/O. The route does the file and the database;
// this decides what a column means.
// ============================================================================

/** The subset of LaundryCrmLeadField this module needs. */
export interface LeadFieldLike {
  fieldKey: string
  label: string
  type: string
  required: boolean
  active: boolean
  isSystem: boolean
  displayOrder: number
  options?: string | null
  showInCreate?: boolean
}

export interface ImportColumn {
  fieldKey: string
  label: string
  type: string
  required: boolean
  /** Allowed values for SELECT-like fields, active ones only. */
  choices: string[]
}

export const SHEET_LEADS = "Leads"
export const SHEET_INSTRUCTIONS = "Instructions"

function activeChoices(options: string | null | undefined): string[] {
  if (!options) return []
  try {
    const parsed = JSON.parse(options) as { value?: string; label?: string; active?: boolean; order?: number }[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((o) => o && o.active !== false && typeof o.value === "string")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((o) => o.value as string)
  } catch {
    return [] // malformed options are no choices, never a crash
  }
}

/**
 * The columns of the template, and the only columns an import will read.
 *
 * Active fields only, in the administrator's order. A field that is active but
 * hidden from the create form is excluded too: the importer creates leads, so
 * a column the create path would refuse is a column that cannot be filled in.
 */
export function importColumns(fields: LeadFieldLike[]): ImportColumn[] {
  return fields
    .filter((f) => f.active && f.showInCreate !== false)
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label))
    .map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      type: f.type,
      required: f.required,
      choices: activeChoices(f.options),
    }))
}

/** Header cells: the label, with a marker so a required column is obvious. */
export const headerRow = (cols: ImportColumn[]): string[] =>
  cols.map((c) => (c.required ? `${c.label} *` : c.label))

/** Strip the required marker and normalise, so a returned file still matches. */
const normaliseHeader = (h: string): string =>
  String(h ?? "").replace(/\s*\*\s*$/, "").trim().toLowerCase()

export interface MappedRow {
  values: Record<string, unknown>
  /** Columns in the file that this tenant will not read, and why. */
  ignored: string[]
}

/**
 * Turn one spreadsheet row into values keyed by fieldKey.
 *
 * Matched on the label the tenant sees (with or without the required marker)
 * and on the fieldKey, so both a downloaded template and a hand-built file
 * work. Anything else is IGNORED and reported — a column for a deactivated
 * field must not quietly write to it, and an unknown column must not invent
 * one.
 */
export function mapRow(cols: ImportColumn[], row: Record<string, unknown>): MappedRow {
  const byHeader = new Map<string, ImportColumn>()
  for (const c of cols) {
    byHeader.set(normaliseHeader(c.label), c)
    byHeader.set(normaliseHeader(c.fieldKey), c)
  }

  const values: Record<string, unknown> = {}
  const ignored: string[] = []
  for (const [rawKey, raw] of Object.entries(row)) {
    const col = byHeader.get(normaliseHeader(rawKey))
    if (!col) {
      if (String(rawKey ?? "").trim()) ignored.push(String(rawKey).trim())
      continue
    }
    const v = typeof raw === "string" ? raw.trim() : raw
    if (v === "" || v === null || v === undefined) continue
    values[col.fieldKey] = col.type === "MULTISELECT" ? String(v).split(/\s*[;|]\s*/).filter(Boolean) : v
  }
  return { values, ignored }
}

/** True when every cell of the row is blank — how a spreadsheet ends. */
export const isBlankRow = (row: Record<string, unknown>): boolean =>
  Object.values(row).every((v) => v === "" || v === null || v === undefined || String(v).trim() === "")

/**
 * The identity used to spot a lead that is already on file.
 *
 * There was no duplicate rule in CRM to reuse — lead creation never checked —
 * so this is the first one, and it is deliberately the narrowest defensible
 * choice: the phone number, which is the field the schema already promotes and
 * indexes, falling back to email when a tenant does not collect phones.
 * Normalised to digits so "+91 98765 43210" and "9876543210" are one person.
 */
export function duplicateKey(values: Record<string, unknown>): { kind: "phone" | "email"; key: string } | null {
  const phone = String(values.phone ?? "").replace(/\D/g, "")
  if (phone.length >= 6) return { kind: "phone", key: phone.slice(-10) }
  const email = String(values.email ?? "").trim().toLowerCase()
  if (email) return { kind: "email", key: email }
  return null
}

/** The Instructions sheet, built from the same live configuration. */
export function instructionRows(cols: ImportColumn[], inactive: LeadFieldLike[]): string[][] {
  const rows: string[][] = [
    ["How to use this template"],
    [""],
    ["1.", "Fill in the Leads sheet. One lead per row. Do not rename or reorder the columns."],
    ["2.", "Columns marked * are required. A row missing one is reported and not imported."],
    ["3.", "Upload the file through CRM → Leads → Import. Nothing is created until you confirm."],
    ["4.", "Invalid rows do not stop the rest: valid rows import, the others come back in an error report."],
    [""],
    ["Formats"],
    ["Phone", "Digits, with or without spaces or a country code. Duplicates are matched on the last 10 digits."],
    ["Email", "name@example.com"],
    ["Date", "YYYY-MM-DD"],
    ["Yes / No", "Yes, No, true or false"],
    ["Multi-select", "Separate several values with a semicolon, e.g. Wash;Iron"],
    [""],
    ["Duplicates"],
    ["", "A lead is treated as already on file when its phone number matches an existing lead (or its email, when no phone is given)."],
    [""],
    ["Columns in this template"],
    ["Column", "Required", "Type", "Accepted values"],
  ]
  for (const c of cols) {
    rows.push([c.label, c.required ? "Yes" : "No", c.type, c.choices.length ? c.choices.join(", ") : ""])
  }
  if (inactive.length) {
    rows.push([""])
    rows.push(["Not in this template"])
    rows.push(["", "These fields are switched off in CRM → Settings → Lead Fields. A column for one of them is ignored on import."])
    for (const f of inactive) rows.push([f.label, "", "", ""])
  }
  return rows
}
