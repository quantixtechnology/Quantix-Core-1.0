// Bulk Customer Import — the ONE column contract, shared by the template the
// browser downloads, the parser that reads the file back, and the server that
// validates and commits it. One list, so a template can never offer a column
// the importer ignores.
//
// The fields mirror the single-customer form exactly (POST /api/laundry/customers).
// No second customer schema, no fields the normal flow does not have.
import { isValidPincode } from "@/lib/india"

export interface ImportColumn {
  /** Header text in the spreadsheet — what the operator sees. */
  header: string
  /** Key on CustomerCreateInput. */
  key: string
  required?: boolean
  example: string
}

export const CUSTOMER_IMPORT_COLUMNS: ImportColumn[] = [
  { header: "Customer Name", key: "name", required: true, example: "Ramesh Kumar" },
  { header: "Mobile", key: "mobile", required: true, example: "9876543210" },
  { header: "Alternate Mobile", key: "alternateMobile", example: "9812345670" },
  { header: "Email", key: "email", example: "ramesh@example.com" },
  { header: "Address Line 1", key: "addressLine1", example: "12 MG Road" },
  { header: "Address Line 2", key: "addressLine2", example: "Near Central Mall" },
  { header: "Area", key: "area", example: "Indiranagar" },
  { header: "Landmark", key: "landmark", example: "Opposite the park" },
  { header: "City", key: "city", example: "Bengaluru" },
  { header: "State", key: "state", example: "Karnataka" },
  { header: "Pincode", key: "pincode", example: "560038" },
  { header: "GST Number", key: "gstNumber", example: "" },
  { header: "Notes", key: "notes", example: "Prefers evening pickup" },
]

/** Marks the sample row. A row whose Customer Name is this is never imported. */
export const EXAMPLE_MARKER = "EXAMPLE — DELETE THIS ROW"

/** A file bigger than this is a mistake, not a customer list. */
export const MAX_IMPORT_ROWS = 1000

export const templateHeaders = (): string[] => CUSTOMER_IMPORT_COLUMNS.map((c) => c.header)

/** The single example row, clearly marked so it cannot be imported by accident. */
export function templateExampleRow(): Record<string, string> {
  const row: Record<string, string> = {}
  for (const c of CUSTOMER_IMPORT_COLUMNS) row[c.header] = c.key === "name" ? EXAMPLE_MARKER : c.example
  return row
}

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim())

/** Read one spreadsheet row into the shape the creator expects. */
export function mapImportRow(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of CUSTOMER_IMPORT_COLUMNS) out[c.key] = str(raw[c.header])
  return out
}

export const isBlankRow = (row: Record<string, string>): boolean =>
  Object.values(row).every((v) => v === "")

export const isExampleRow = (row: Record<string, string>): boolean =>
  row.name.toUpperCase().startsWith("EXAMPLE")

// Indian mobile: 10 digits starting 6-9. Spaces, dashes, +91 and a leading 0
// are tolerated and stripped — an operator pasting from a phone book should not
// have to reformat a thousand cells.
const MOBILE_RE = /^[6-9][0-9]{9}$/
export function normaliseMobile(raw: string): string | null {
  let v = raw.replace(/[\s\-()]/g, "")
  if (v.startsWith("+91")) v = v.slice(3)
  else if (v.startsWith("91") && v.length === 12) v = v.slice(2)
  if (v.startsWith("0") && v.length === 11) v = v.slice(1)
  return MOBILE_RE.test(v) ? v : null
}

// Deliberately permissive — the single-create form does not validate email at
// all, so rejecting a shape it would have accepted would make the importer
// stricter than the counter.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const isImportableEmail = (v: string): boolean => v === "" || EMAIL_RE.test(v)

export type RowStatus = "VALID" | "DUPLICATE" | "INVALID"

export interface RowVerdict {
  row: number
  status: RowStatus
  name: string
  mobile: string
  email: string
  reason?: string
  /** Present only for VALID rows — the normalised values to create with. */
  values?: Record<string, string>
}

/**
 * Classify one row. Pure: no database, no tenant. The caller supplies the
 * duplicate check, which is the SAME mobile-per-business rule single creation
 * uses — the importer never invents its own identity rule.
 *
 * `seen` carries mobiles already accepted earlier in THIS file, so one upload
 * cannot create two customers with the same number.
 */
export function classifyRow(
  raw: Record<string, unknown>,
  rowNumber: number,
  opts: { existsInBusiness: (mobile: string) => boolean; seen: Set<string> },
): RowVerdict | null {
  const row = mapImportRow(raw)
  if (isBlankRow(row)) return null
  const base = { row: rowNumber, name: row.name, mobile: row.mobile, email: row.email }

  if (isExampleRow(row)) {
    return { ...base, status: "INVALID", reason: "Example row from the template — delete it before importing" }
  }
  if (!row.name) return { ...base, status: "INVALID", reason: "Customer Name is required" }
  if (!row.mobile) return { ...base, status: "INVALID", reason: "Mobile is required" }

  const mobile = normaliseMobile(row.mobile)
  if (!mobile) return { ...base, status: "INVALID", reason: "Mobile must be a 10-digit Indian number starting 6-9" }
  if (!isImportableEmail(row.email)) return { ...base, status: "INVALID", reason: "Email is not a valid address" }
  if (row.pincode && !isValidPincode(row.pincode)) {
    return { ...base, status: "INVALID", reason: "PIN Code must be a valid 6-digit Indian pincode" }
  }

  if (opts.seen.has(mobile)) {
    return { ...base, mobile, status: "DUPLICATE", reason: "This mobile appears more than once in the file" }
  }
  if (opts.existsInBusiness(mobile)) {
    return { ...base, mobile, status: "DUPLICATE", reason: "Already exists — this customer was left unchanged" }
  }

  return { ...base, mobile, status: "VALID", values: { ...row, mobile } }
}

export interface ImportSummary { total: number; valid: number; duplicates: number; invalid: number }

export function summarise(verdicts: RowVerdict[]): ImportSummary {
  return {
    total: verdicts.length,
    valid: verdicts.filter((v) => v.status === "VALID").length,
    duplicates: verdicts.filter((v) => v.status === "DUPLICATE").length,
    invalid: verdicts.filter((v) => v.status === "INVALID").length,
  }
}
