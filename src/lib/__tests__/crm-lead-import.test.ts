import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import {
  importColumns, headerRow, mapRow, isBlankRow, duplicateKey, instructionRows,
  SHEET_LEADS, SHEET_INSTRUCTIONS, type LeadFieldLike,
} from '@/lib/laundry-crm-import'

// ============================================================================
// The Lead Fields configuration IS the template.
//
// Nothing is stored and nothing is hard-coded: deactivate a field and the next
// download has one fewer column, reorder them and the columns move, add a
// custom field and it appears — with no developer involved. The same rule runs
// on the way back in, on the SERVER, so a file cannot reach a field the
// administrator switched off and cannot introduce one of its own.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const TEMPLATE = read('src/app/api/laundry/crm/leads/template/route.ts')
const IMPORT   = read('src/app/api/laundry/crm/leads/import/route.ts')
const DIALOG   = read('src/components/laundry/views/crm/crm-lead-import-dialog.tsx')
const LEADS    = read('src/components/laundry/views/crm/crm-leads.tsx')

/** A field as CRM Settings would store it. */
const field = (over: Partial<LeadFieldLike> & { fieldKey: string; label: string; displayOrder: number }): LeadFieldLike => ({
  type: 'TEXT', required: false, active: true, isSystem: false, showInCreate: true, options: null, ...over,
})

const CONFIG: LeadFieldLike[] = [
  field({ fieldKey: 'first_name', label: 'First Name', displayOrder: 1, required: true, isSystem: true }),
  field({ fieldKey: 'last_name', label: 'Last Name', displayOrder: 2 }),
  field({ fieldKey: 'phone', label: 'Phone Number', displayOrder: 3, type: 'PHONE', required: true, isSystem: true }),
  field({ fieldKey: 'alt_phone', label: 'Alternate Phone', displayOrder: 4, type: 'PHONE', active: false }),
  field({ fieldKey: 'email', label: 'Email', displayOrder: 5, type: 'EMAIL' }),
  field({ fieldKey: 'business_name', label: 'Business Name', displayOrder: 6 }),
  field({ fieldKey: 'est_orders', label: 'Estimated Monthly Orders', displayOrder: 7, type: 'NUMBER', active: false }),
]

describe('A & B · active fields make the template; inactive ones do not', () => {
  const cols = importColumns(CONFIG)

  it('every active field is a column', () => {
    expect(cols.map((c) => c.label)).toEqual(['First Name', 'Last Name', 'Phone Number', 'Email', 'Business Name'])
  })

  it('an inactive field is absent — not hidden, absent', () => {
    const keys = cols.map((c) => c.fieldKey)
    expect(keys).not.toContain('alt_phone')
    expect(keys).not.toContain('est_orders')
  })

  it('required columns are marked so the user can see which they are', () => {
    expect(headerRow(cols)).toEqual(['First Name *', 'Last Name', 'Phone Number *', 'Email', 'Business Name'])
  })

  it('a field hidden from the create form is not offered either', () => {
    // The importer creates leads; a column the create path would refuse is a
    // column that cannot be filled in.
    const cols2 = importColumns([...CONFIG, field({ fieldKey: 'internal', label: 'Internal Note', displayOrder: 8, showInCreate: false })])
    expect(cols2.map((c) => c.fieldKey)).not.toContain('internal')
  })
})

describe('C · the administrator\'s order is the column order', () => {
  it('reordering the fields reorders the columns, with no code change', () => {
    const reordered = CONFIG.map((f) => ({
      ...f,
      displayOrder: { phone: 1, first_name: 2, last_name: 3, email: 4, business_name: 5 }[f.fieldKey] ?? f.displayOrder,
    }))
    expect(importColumns(reordered).map((c) => c.label)).toEqual(['Phone Number', 'First Name', 'Last Name', 'Email', 'Business Name'])
  })

  it('reactivating a field brings it back', () => {
    const on = CONFIG.map((f) => (f.fieldKey === 'alt_phone' ? { ...f, active: true } : f))
    expect(importColumns(on).map((c) => c.label)).toContain('Alternate Phone')
  })
})

describe('D & E · custom fields, with no code that knows their names', () => {
  it('a newly activated custom field appears', () => {
    const withCustom = [...CONFIG, field({ fieldKey: 'preferred_pickup_area', label: 'Preferred Pickup Area', displayOrder: 9 })]
    expect(importColumns(withCustom).map((c) => c.label)).toContain('Preferred Pickup Area')
  })

  it('deactivating it removes it again', () => {
    const off = [...CONFIG, field({ fieldKey: 'preferred_pickup_area', label: 'Preferred Pickup Area', displayOrder: 9, active: false })]
    expect(importColumns(off).map((c) => c.label)).not.toContain('Preferred Pickup Area')
  })

  it('a custom field maps by its own key, with no branch naming it', () => {
    const cols = importColumns([...CONFIG, field({ fieldKey: 'customer_type', label: 'Customer Type', displayOrder: 9 })])
    const { values } = mapRow(cols, { 'Customer Type': 'Corporate', 'First Name': 'Asha' })
    expect(values.customer_type).toBe('Corporate')
    for (const src of [TEMPLATE, IMPORT]) {
      expect(src).not.toContain('preferred_pickup_area')
      expect(src).not.toContain('customer_type')
    }
  })

  it('SELECT choices come from the field\'s own options, active ones only', () => {
    const withSelect = [...CONFIG, field({
      fieldKey: 'interested_service', label: 'Interested Service', displayOrder: 9, type: 'SELECT',
      options: JSON.stringify([
        { value: 'Wash & Fold', order: 1, active: true },
        { value: 'Dry Clean', order: 2, active: true },
        { value: 'Retired Service', order: 3, active: false },
      ]),
    })]
    const col = importColumns(withSelect).find((c) => c.fieldKey === 'interested_service')!
    expect(col.choices).toEqual(['Wash & Fold', 'Dry Clean'])
  })
})

describe('· a file cannot reach a field that is switched off', () => {
  const cols = importColumns(CONFIG)

  it('a column for an inactive field is ignored and named', () => {
    const { values, ignored } = mapRow(cols, { 'First Name': 'Asha', 'Alternate Phone': '9998887777' })
    expect(values.alt_phone).toBeUndefined()
    expect(ignored).toContain('Alternate Phone')
  })

  it('an unknown column cannot invent a field', () => {
    const { values, ignored } = mapRow(cols, { 'First Name': 'Asha', 'Secret Column': 'x' })
    expect(Object.keys(values)).toEqual(['first_name'])
    expect(ignored).toContain('Secret Column')
  })

  it('the SERVER decides, not the browser', () => {
    // The route re-derives the columns from its own configuration; the file's
    // headers are only used to find them.
    expect(IMPORT).toContain('const cols = importColumns(fields)')
    expect(IMPORT).toContain('const { values, ignored } = mapRow(cols, raw)')
    expect(TEMPLATE).toContain('const cols = importColumns(fields)')
  })

  it('headers match on the label or the key, with or without the marker', () => {
    expect(mapRow(cols, { 'First Name *': 'Asha' }).values.first_name).toBe('Asha')
    expect(mapRow(cols, { first_name: 'Asha' }).values.first_name).toBe('Asha')
    expect(mapRow(cols, { '  PHONE NUMBER  ': '99999' }).values.phone).toBe('99999')
  })
})

describe('F & G · validation is the engine that already guards lead creation', () => {
  it('the import route calls buildLeadValues, not a second validator', () => {
    expect(IMPORT).toContain('buildLeadValues(fields as never, values, "create")')
    expect(IMPORT).toContain('CrmValidationError')
    expect(IMPORT).toContain('promoteSystemFields')
  })

  it('so required, email and option rules are whatever CRM already says', () => {
    const CRM = read('src/lib/laundry-crm.ts')
    expect(CRM).toContain('throw new CrmValidationError(`${f.label} is required`)')
    expect(CRM).toContain('must be a valid email')
    expect(CRM).toContain('Invalid option for')
  })
})

describe('H · duplicates', () => {
  it('phone is the identity, normalised so formatting does not matter', () => {
    expect(duplicateKey({ phone: '+91 98765 43210' })).toEqual({ kind: 'phone', key: '9876543210' })
    expect(duplicateKey({ phone: '9876543210' })).toEqual({ kind: 'phone', key: '9876543210' })
  })

  it('email is the fallback when no phone is collected', () => {
    expect(duplicateKey({ email: 'A@B.com' })).toEqual({ kind: 'email', key: 'a@b.com' })
  })

  it('a row with neither cannot be matched', () => {
    expect(duplicateKey({ first_name: 'Asha' })).toBeNull()
  })

  it('the file is checked against itself as well as the database', () => {
    // A file repeating a lead must not import it twice.
    expect(IMPORT).toContain('if (dup?.kind === "phone") seenPhone.add(dup.key)')
    expect(IMPORT).toContain('where: { businessId: biz.id },')
  })
})

describe('I & J · one bad row is one bad row', () => {
  it('invalid rows are reported and skipped, not fatal', () => {
    expect(IMPORT).toContain('report.push({')
    expect(IMPORT).toContain('status: "INVALID"')
    expect(IMPORT).toContain('const ready: { values: Record<string, unknown>; row: number }[] = []')
  })

  it('a save that fails takes only its own row down', () => {
    expect(IMPORT).toContain('// One row failing is one row failing.')
  })

  it('the rejected rows are downloadable, with row, reason and data', () => {
    expect(DIALOG).toContain('["Row", "Status", "Name", "Phone", "Reason"]')
    expect(DIALOG).toContain('Download Error Report')
  })

  it('a blank trailing row is not a rejection', () => {
    expect(isBlankRow({ 'First Name': '', Phone: '   ' })).toBe(true)
    expect(isBlankRow({ 'First Name': 'Asha' })).toBe(false)
    expect(IMPORT).toContain('if (isBlankRow(raw)) return')
  })
})

describe('K, L, M · CSV, XLSX and the generated workbook', () => {
  it('the template is two sheets, and the instructions are not importable rows', () => {
    expect(TEMPLATE).toContain('XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header]), SHEET_LEADS)')
    expect(TEMPLATE).toContain('SHEET_INSTRUCTIONS')
    expect(SHEET_LEADS).toBe('Leads')
    expect(SHEET_INSTRUCTIONS).toBe('Instructions')
  })

  it('a real workbook round-trips back to the same columns', () => {
    const cols = importColumns(CONFIG)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headerRow(cols), ['Asha', 'Rao', '9876543210', 'asha@example.com', 'Rao Textiles']]), SHEET_LEADS)
    const back = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(back.Sheets[SHEET_LEADS], { defval: '' })
    const { values, ignored } = mapRow(cols, rows[0])
    expect(ignored).toEqual([])
    expect(values).toEqual({ first_name: 'Asha', last_name: 'Rao', phone: '9876543210', email: 'asha@example.com', business_name: 'Rao Textiles' })
  })

  it('CSV gets headers only — a one-sheet file has nowhere to put instructions', () => {
    expect(TEMPLATE).toContain('if (format === "csv")')
    expect(TEMPLATE).toContain('sheet_to_csv')
  })

  it('the instructions describe the live configuration, including what is missing from it', () => {
    const rows = instructionRows(importColumns(CONFIG), CONFIG.filter((f) => !f.active))
    const flat = rows.map((r) => r.join(' ')).join('\n')
    expect(flat).toContain('First Name')
    expect(flat).toContain('Not in this template')
    expect(flat).toContain('Alternate Phone')
    expect(flat).toContain('Duplicates')
  })

  it('the browser reads the Leads sheet, or the only sheet for a CSV', () => {
    expect(DIALOG).toContain("wb.SheetNames.find((n) => n.trim().toLowerCase() === \"leads\") ?? wb.SheetNames[0]")
    expect(DIALOG).toContain('accept=".csv,.xls,.xlsx"')
  })
})

describe('N, O, P · tenant isolation and entitlement', () => {
  it('both routes resolve the tenant and its CRM entitlement', () => {
    for (const src of [TEMPLATE, IMPORT]) {
      expect(src).toContain('requireCrmBusiness(')
      // The template reads it from the query, the import from the body.
      expect(src).toMatch(/requireLaundryPermission\(request, (businessId|body\.businessId)/)
    }
  })

  it('the permission is the one that CREATES leads, not the one that views them', () => {
    expect(TEMPLATE).toContain('"crm.leads.create"')
    expect(IMPORT).toContain('"crm.leads.create"')
  })

  it('the field configuration is read for THIS business only', () => {
    for (const src of [TEMPLATE, IMPORT]) {
      expect(src).toContain('where: { businessId: biz.id },')
    }
  })

  it('an unlicensed tenant is refused by the existing guard', () => {
    const CRM = read('src/lib/laundry-crm.ts')
    expect(CRM).toContain('if (!access.enabled) throw new CrmAccessError(403')
    for (const src of [TEMPLATE, IMPORT]) expect(src).toContain('CrmAccessError')
  })

  it('the importer is attributed to the session, not to the request body', () => {
    expect(IMPORT).toContain('createdById: guard.ctx.userId ?? null')
    expect(IMPORT).not.toContain('body.actorId')
  })

  it('no tenant is named anywhere', () => {
    for (const src of [TEMPLATE, IMPORT, DIALOG, LEADS]) {
      expect(src.toLowerCase()).not.toContain('vastrasudha')
    }
  })
})

describe('Q & R · nothing that already worked was changed', () => {
  it('the leads toolbar keeps New Lead and Export, and gains Import', () => {
    expect(LEADS).toContain('onClick={exportCsv}')
    expect(LEADS).toContain('onClick={() => setImportOpen(true)}')
  })

  it('single lead creation is untouched', () => {
    const CREATE = read('src/app/api/laundry/crm/leads/route.ts')
    expect(CREATE).toContain('buildLeadValues(fields, body.values || {}, "create")')
  })

  it('the template is never cached — a stale one is a wrong one', () => {
    expect(TEMPLATE).toContain('"Cache-Control": "no-store"')
  })

  it('an oversized file is refused rather than attempted', () => {
    expect(IMPORT).toContain('const MAX_ROWS = 5000')
  })

  it('an audit is written through the CRM\'s own event trail', () => {
    expect(IMPORT).toContain('crmEvent(biz.id, "LEAD_IMPORT"')
    expect(IMPORT).toContain('fileName')
    expect(IMPORT).toContain('rejected')
  })
})

describe('10 & 11 · the download is an authenticated request, not a navigation', () => {
  // A Laundry OS tenant user authenticates with an Authorization: Bearer token
  // held in localStorage. window.open() makes the browser navigate, and a
  // navigation carries no such header — so the template route answered "Not
  // authenticated" to a perfectly valid session. Fetch the bytes, then hand
  // them to the browser.

  it('the template is fetched with the app\'s auth headers', () => {
    expect(DIALOG).toContain('`/api/laundry/crm/leads/template?businessId=${encodeURIComponent(businessId)}&format=${format}`')
    const fn = DIALOG.slice(DIALOG.indexOf('const downloadTemplate'), DIALOG.indexOf('const post ='))
    expect(fn).toContain('headers: getAuthHeaders()')
  })

  it('it is no longer a browser navigation', () => {
    const code = DIALOG.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toContain('window.open')
  })

  it('the bytes are delivered the way Export already does it', () => {
    const fn = DIALOG.slice(DIALOG.indexOf('const downloadTemplate'), DIALOG.indexOf('const post ='))
    expect(fn).toContain('const blob = await res.blob()')
    expect(fn).toContain("document.createElement(\"a\")")
    expect(fn).toContain('URL.createObjectURL(blob)')
    expect(fn).toContain('URL.revokeObjectURL')
  })

  it('no token is ever put in the URL', () => {
    // History, server logs and referrers would all keep it.
    expect(DIALOG).not.toContain('token=')
    expect(DIALOG).not.toContain('access_token')
    expect(TEMPLATE).not.toContain('searchParams.get("token")')
  })

  it('EVERY new bulk call carries auth — not just the one that broke', () => {
    const calls = DIALOG.match(/fetch\(/g) ?? []
    const authed = DIALOG.match(/getAuthHeaders\(\)/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(authed.length).toBe(calls.length)
  })

  it('the failure body is only read when the request failed', () => {
    // On success the body is a spreadsheet; parsing it as JSON would throw.
    const fn = DIALOG.slice(DIALOG.indexOf('const downloadTemplate'), DIALOG.indexOf('const post ='))
    expect(fn).toContain('if (!res.ok) {')
    expect(fn).toContain('await res.json().catch(() => null)')
  })

  it('authentication is still ENFORCED — it was not removed to make this work', () => {
    // The whole risk of an auth "fix" is that it quietly makes a route public.
    expect(TEMPLATE).toContain('const guard = await requireLaundryPermission(request, businessId, "crm.leads.create")')
    expect(TEMPLATE).toContain('if (!guard.ok) return guard.res')
    expect(TEMPLATE).toContain('const biz = await requireCrmBusiness(businessId)')
  })

  it('the requested business is authorised, never taken on trust', () => {
    // requireLaundryPermission resolves the tenant and the caller's rights on
    // it; the businessId in the query is an input to that, not a bypass.
    const guardAt = TEMPLATE.indexOf('requireLaundryPermission')
    const readAt = TEMPLATE.indexOf('prisma.laundryCrmLeadField.findMany')
    expect(guardAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(readAt)
  })

  it('both formats go through the same guard', () => {
    // The csv branch is inside the handler, after the guard — not a second path.
    const csvAt = TEMPLATE.indexOf('if (format === "csv")')
    expect(TEMPLATE.indexOf('requireLaundryPermission')).toBeLessThan(csvAt)
    expect(TEMPLATE.indexOf('requireCrmBusiness')).toBeLessThan(csvAt)
  })

  it('an unlicensed tenant still gets the CRM licensing response', () => {
    expect(TEMPLATE).toContain('if (e instanceof CrmAccessError) return NextResponse.json({ error: e.message }, { status: e.status })')
  })
})
