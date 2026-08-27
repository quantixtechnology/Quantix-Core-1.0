import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// BULK CUSTOMER CREATION — additive, and it must never invent a second customer.
//
// The importer reuses the single-customer path: the same creator
// (createLaundryCustomer), the same duplicate rule (one mobile per platform
// business), the same permission (laundry.customers.create) and the same
// business resolution. These tests pin that reuse as much as the behaviour —
// a copy of the creation logic would drift, and an imported customer would
// slowly stop looking like one created at the counter.
// ============================================================================

const H = vi.hoisted(() => {
  const state = { customers: [] as { id: string; businessId: string; phone: string | null; name: string }[], nextId: 1 }
  const prisma = {
    customer: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (a: any) => state.customers.find((c) => c.businessId === a.where.businessId && c.phone === a.where.phone) ?? null),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: vi.fn(async (a: any) => state.customers.filter((c) => c.businessId === a.where.businessId && c.phone !== null).map((c) => ({ phone: c.phone }))),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async (a: any) => {
        const row = { id: `cus-${state.nextId++}`, businessId: a.data.businessId, phone: a.data.phone, name: a.data.name }
        state.customers.push(row)
        return { ...row, customerCode: a.data.customerCode }
      }),
    },
    // Typed arg so the assertions below can read the recorded call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    address: { create: vi.fn(async (a: any) => ({ id: 'addr-1', ...a.data })) },
  }
  return { state, prisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('@/lib/customer-code', () => ({ generateCustomerCode: vi.fn(async () => 'CUS-BUS-202608-0008-000001') }))
vi.mock('@/lib/laundry-customer-source', () => ({ defaultCustomerSourceId: vi.fn(async () => 'src-direct') }))

import {
  CUSTOMER_IMPORT_COLUMNS, MAX_IMPORT_ROWS, EXAMPLE_MARKER,
  templateHeaders, templateExampleRow, mapImportRow, normaliseMobile,
  isImportableEmail, classifyRow, summarise, type RowVerdict,
} from '@/lib/laundry-customer-import'
import { createLaundryCustomer, findCustomerByMobile } from '@/lib/laundry-customer-create'

const { state } = H
const BIZ = 'BUS-202608-0008'
const OTHER_BIZ = 'BUS-202606-0005'
const LB = 'lb_vastrasudha'

const row = (over: Record<string, string> = {}) => ({
  'Customer Name': 'Ramesh Kumar', Mobile: '9876543210', Email: 'ramesh@example.com',
  'Address Line 1': '12 MG Road', City: 'Bengaluru', State: 'Karnataka', Pincode: '560038', ...over,
})

/** Classify a whole file the way the route does. */
function classifyFile(raws: Record<string, unknown>[], businessId = BIZ): RowVerdict[] {
  const existing = new Set(state.customers.filter((c) => c.businessId === businessId).map((c) => String(c.phone)))
  const seen = new Set<string>()
  const out: RowVerdict[] = []
  raws.forEach((r, i) => {
    const v = classifyRow(r, i + 2, { existsInBusiness: (m) => existing.has(m), seen })
    if (!v) return
    if (v.status === 'VALID' && v.values) seen.add(v.values.mobile)
    out.push(v)
  })
  return out
}

/** Commit the way the route does — valid rows only, one at a time. */
async function commit(verdicts: RowVerdict[], businessId = BIZ) {
  let created = 0
  for (const v of verdicts) {
    if (v.status !== 'VALID' || !v.values) continue
    if (await findCustomerByMobile(businessId, v.values.mobile)) { v.status = 'DUPLICATE'; continue }
    await createLaundryCustomer(businessId, LB, { name: v.values.name, mobile: v.values.mobile, email: v.values.email })
    created++
  }
  return created
}

beforeEach(() => { state.customers = []; state.nextId = 1; vi.clearAllMocks() })

// ── 1. Template ─────────────────────────────────────────────────────────────
describe('1 · template generation', () => {
  it('headers come from the one shared column contract', () => {
    expect(templateHeaders()).toEqual(CUSTOMER_IMPORT_COLUMNS.map((c) => c.header))
    expect(templateHeaders()).toContain('Customer Name')
    expect(templateHeaders()).toContain('Mobile')
  })

  it('carries exactly one example row, clearly marked', () => {
    const ex = templateExampleRow()
    expect(ex['Customer Name']).toBe(EXAMPLE_MARKER)
    expect(Object.keys(ex)).toEqual(templateHeaders())
  })

  it('the example row can NEVER be imported as a real customer', () => {
    const v = classifyFile([templateExampleRow()])
    expect(v[0].status).toBe('INVALID')
    expect(v[0].reason).toContain('Example row')
  })

  it('every template column maps back to a creator field', () => {
    const mapped = mapImportRow(row())
    for (const c of CUSTOMER_IMPORT_COLUMNS) expect(mapped).toHaveProperty(c.key)
  })
})

// ── 2-3. Valid rows ─────────────────────────────────────────────────────────
describe('2,3 · valid rows', () => {
  it('a single valid row is accepted and created', async () => {
    const v = classifyFile([row()])
    expect(v[0].status).toBe('VALID')
    expect(await commit(v)).toBe(1)
    expect(state.customers).toHaveLength(1)
    expect(state.customers[0].phone).toBe('9876543210')
  })

  it('multiple valid rows all import', async () => {
    const v = classifyFile([row(), row({ Mobile: '9812345670' }), row({ Mobile: '9700000001' })])
    expect(summarise(v).valid).toBe(3)
    expect(await commit(v)).toBe(3)
  })

  it('normalises the shapes an operator actually pastes', () => {
    for (const raw of ['+91 98765 43210', '098765-43210', '9876543210', '91 9876543210']) {
      expect(normaliseMobile(raw)).toBe('9876543210')
    }
  })

  it('blank rows are skipped silently, not reported as errors', () => {
    const blank = Object.fromEntries(templateHeaders().map((h) => [h, '']))
    expect(classifyFile([row(), blank])).toHaveLength(1)
  })
})

// ── 4. Duplicates ───────────────────────────────────────────────────────────
describe('4 · duplicates', () => {
  it('an existing mobile is marked Already exists and skipped', async () => {
    state.customers.push({ id: 'c1', businessId: BIZ, phone: '9876543210', name: 'Existing' })
    const v = classifyFile([row()])
    expect(v[0].status).toBe('DUPLICATE')
    expect(v[0].reason).toContain('Already exists')
    expect(await commit(v)).toBe(0)
  })

  it('the same mobile twice INSIDE one file creates one customer', async () => {
    const v = classifyFile([row(), row({ 'Customer Name': 'Ramesh Again' })])
    expect(v[0].status).toBe('VALID')
    expect(v[1].status).toBe('DUPLICATE')
    expect(v[1].reason).toContain('more than once in the file')
    expect(await commit(v)).toBe(1)
  })

  it('uses the SAME duplicate rule as single creation — mobile per business', () => {
    const CREATE = readFileSync(join(process.cwd(), 'src/lib/laundry-customer-create.ts'), 'utf8')
    expect(CREATE).toContain('where: { businessId: platformBusinessId, phone: mobile }')
    const ROUTE = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/route.ts'), 'utf8')
    expect(ROUTE).toContain('findCustomerByMobile(laundryBusiness.platformBusinessId, mobile)')
  })
})

// ── 5-8. Validation ─────────────────────────────────────────────────────────
describe('5,6,7,8 · validation', () => {
  it('rejects an invalid mobile with the reason', () => {
    for (const bad of ['12345', '1234567890', 'abcdefghij', '98765432101234']) {
      const v = classifyFile([row({ Mobile: bad })])
      expect(v[0].status).toBe('INVALID')
      expect(v[0].reason).toContain('10-digit Indian number')
    }
  })

  it('rejects a missing required field, naming it', () => {
    expect(classifyFile([row({ 'Customer Name': '' })])[0].reason).toContain('Customer Name is required')
    expect(classifyFile([row({ Mobile: '' })])[0].reason).toContain('Mobile is required')
  })

  it('rejects an invalid email but allows a blank one', () => {
    expect(classifyFile([row({ Email: 'not-an-email' })])[0].status).toBe('INVALID')
    expect(classifyFile([row({ Email: '' })])[0].status).toBe('VALID')
    expect(isImportableEmail('')).toBe(true)
  })

  it('applies the SAME pincode rule as single creation', () => {
    expect(classifyFile([row({ Pincode: '12' })])[0].reason).toContain('6-digit Indian pincode')
    expect(classifyFile([row({ Pincode: '' })])[0].status).toBe('VALID')
    const CONTRACT = readFileSync(join(process.cwd(), 'src/lib/laundry-customer-import.ts'), 'utf8')
    expect(CONTRACT).toContain('import { isValidPincode } from "@/lib/india"')
  })

  it('a mixed file reports each row independently', async () => {
    const v = classifyFile([
      row(), row({ Mobile: '9812345670' }),
      row({ Mobile: 'nope' }), row({ 'Customer Name': '' }),
    ])
    expect(summarise(v)).toMatchObject({ total: 4, valid: 2, invalid: 2, duplicates: 0 })
    expect(await commit(v)).toBe(2)
  })
})

// ── 9. Never overwrite ──────────────────────────────────────────────────────
describe('9 · an existing customer is never overwritten', () => {
  it('leaves the stored record untouched', async () => {
    state.customers.push({ id: 'c1', businessId: BIZ, phone: '9876543210', name: 'Original Name' })
    await commit(classifyFile([row({ 'Customer Name': 'Replacement Name' })]))
    expect(state.customers).toHaveLength(1)
    expect(state.customers[0].name).toBe('Original Name')
    expect(H.prisma.customer.create).not.toHaveBeenCalled()
  })

  it('the importer never calls update or upsert', () => {
    const ROUTE = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/import/route.ts'), 'utf8')
    expect(ROUTE).not.toContain('customer.update')
    expect(ROUTE).not.toContain('customer.upsert')
    expect(ROUTE).not.toContain('customer.delete')
  })
})

// ── 10-11. Tenant isolation ─────────────────────────────────────────────────
describe('10,11 · tenant isolation', () => {
  it('creates against the business from the request context', async () => {
    await commit(classifyFile([row()]))
    expect(state.customers[0].businessId).toBe(BIZ)
  })

  it('the file can NEVER choose the business', () => {
    const ROUTE = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/import/route.ts'), 'utf8')
    // businessId is resolved once from the guarded body, then only that value is used.
    expect(ROUTE).toContain('const biz = await resolveLaundryBusiness(body.businessId)')
    expect(ROUTE).toContain('const platformBusinessId = biz.platformBusinessId')
    expect(ROUTE).toContain('createLaundryCustomer(platformBusinessId, biz.id,')
    // No row field is ever read as a business.
    expect(ROUTE).not.toMatch(/rows\[[^\]]*\]\.businessId/)
    expect(CUSTOMER_IMPORT_COLUMNS.map((c) => c.key)).not.toContain('businessId')
  })

  it("another business's customer with the same mobile is not a duplicate here", async () => {
    state.customers.push({ id: 'c1', businessId: OTHER_BIZ, phone: '9876543210', name: 'Other tenant' })
    const v = classifyFile([row()], BIZ)
    expect(v[0].status).toBe('VALID')
    expect(await commit(v, BIZ)).toBe(1)
    expect(state.customers.filter((c) => c.businessId === BIZ)).toHaveLength(1)
  })
})

// ── 12. Permission ──────────────────────────────────────────────────────────
describe('12 · permission', () => {
  it('uses the EXISTING create permission — no new one', () => {
    const IMPORT = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/import/route.ts'), 'utf8')
    const SINGLE = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/route.ts'), 'utf8')
    expect(IMPORT).toContain('requireLaundryPermission(request, body.businessId, "laundry.customers.create")')
    expect(SINGLE).toContain('"laundry.customers.create"')
  })

  it('the guard runs before anything is read or written', () => {
    // Handler body only — the import block naturally names everything first.
    const IMPORT = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/import/route.ts'), 'utf8')
    const handler = IMPORT.slice(IMPORT.indexOf('export async function POST'))
    expect(handler.indexOf('requireLaundryPermission')).toBeLessThan(handler.indexOf('resolveLaundryBusiness'))
    expect(handler.indexOf('requireLaundryPermission')).toBeLessThan(handler.indexOf('createLaundryCustomer('))
    expect(handler.indexOf('requireLaundryPermission')).toBeLessThan(handler.indexOf('prisma.customer.findMany'))
  })

  it('the button is hidden without the permission', () => {
    const VIEW = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-customers-view.tsx'), 'utf8')
    expect(VIEW).toContain('can("laundry.customers.create") && (')
    expect(VIEW).toContain('Bulk Customer Creation')
  })
})

// ── 13-14. Existing behaviour ───────────────────────────────────────────────
describe('13,14 · existing customer creation still works', () => {
  it('the shared creator produces the same record the form always did', async () => {
    const c = await createLaundryCustomer(BIZ, LB, { name: 'Counter Customer', mobile: '9700000009' })
    const data = H.prisma.customer.create.mock.calls[0][0].data
    expect(data.businessId).toBe(BIZ)
    expect(data.source).toBe('LAUNDRY_OS')          // channel, unchanged
    expect(data.customerSourceId).toBe('src-direct') // acquisition default
    expect(data.isGuest).toBe(false)
    expect(data.customerCode).toBe('CUS-BUS-202608-0008-000001')
    expect(data.tags).toBe('[]')
    expect(c.id).toBe('cus-1')
  })

  it('creates the default address only when an address part is given', async () => {
    await createLaundryCustomer(BIZ, LB, { name: 'A', mobile: '9700000001' })
    expect(H.prisma.address.create).not.toHaveBeenCalled()
    await createLaundryCustomer(BIZ, LB, { name: 'B', mobile: '9700000002', city: 'Bengaluru' })
    expect(H.prisma.address.create).toHaveBeenCalledTimes(1)
    expect(H.prisma.address.create.mock.calls[0][0].data.isDefault).toBe(true)
  })

  it('imported customers are ordinary Customer rows — no second type or table', () => {
    const IMPORT = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/import/route.ts'), 'utf8')
    expect(IMPORT).toContain('createLaundryCustomer(')
    expect(IMPORT).not.toContain('prisma.customer.create')  // never writes directly
    expect(IMPORT).not.toMatch(/importedCustomer|BulkCustomer/)
  })

  it('the single-create route still guards, resolves and refuses duplicates', () => {
    const SINGLE = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/route.ts'), 'utf8')
    expect(SINGLE).toContain('Missing required fields: businessId, name, mobile')
    expect(SINGLE).toContain('requireLaundryPermission(request, businessId, "laundry.customers.create")')
    expect(SINGLE).toContain('isValidPincode(pincode)')
    expect(SINGLE).toContain('Customer with this mobile number already exists')
    expect(SINGLE).toContain('{ status: 201 }')
  })
})

// ── 12. Size limit ──────────────────────────────────────────────────────────
describe('large file safety', () => {
  it('caps the upload and says so', () => {
    expect(MAX_IMPORT_ROWS).toBe(1000)
    const IMPORT = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/import/route.ts'), 'utf8')
    expect(IMPORT).toContain('rows.length > MAX_IMPORT_ROWS')
    expect(IMPORT).toContain('Import up to ${MAX_IMPORT_ROWS} at a time')
  })

  it('validate mode creates nothing', () => {
    const IMPORT = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/import/route.ts'), 'utf8')
    const handler = IMPORT.slice(IMPORT.indexOf('export async function POST'))
    const beforeCommit = handler.slice(0, handler.indexOf('if (body.mode !== "commit")'))
    expect(beforeCommit).not.toContain('createLaundryCustomer(')
    expect(beforeCommit).not.toContain('customer.create')
  })
})

// ── 19. THE ACCEPTANCE TEST ─────────────────────────────────────────────────
describe('19 · acceptance — 10 rows, then the SAME file again', () => {
  const file = () => [
    ...Array.from({ length: 7 }, (_, i) => row({ 'Customer Name': `New ${i + 1}`, Mobile: `98000000${String(i + 10)}` })),
    row({ 'Customer Name': 'Existing One', Mobile: '9911111111' }),
    row({ 'Customer Name': 'Existing Two', Mobile: '9922222222' }),
    row({ 'Customer Name': 'Broken Row', Mobile: 'not-a-number' }),
  ]

  beforeEach(() => {
    state.customers.push(
      { id: 'e1', businessId: BIZ, phone: '9911111111', name: 'Existing One' },
      { id: 'e2', businessId: BIZ, phone: '9922222222', name: 'Existing Two' },
    )
  })

  it('first upload → Created 7, Skipped 2, Invalid 1', async () => {
    const v = classifyFile(file())
    expect(summarise(v)).toMatchObject({ total: 10, valid: 7, duplicates: 2, invalid: 1 })
    expect(await commit(v)).toBe(7)
    expect(state.customers).toHaveLength(9) // 2 pre-existing + 7 new
  })

  it('SAME file again → Created 0, Skipped 9, Invalid 1, no duplicates', async () => {
    await commit(classifyFile(file()))
    const before = state.customers.length

    const second = classifyFile(file())
    expect(summarise(second)).toMatchObject({ total: 10, valid: 0, duplicates: 9, invalid: 1 })
    expect(await commit(second)).toBe(0)

    expect(state.customers).toHaveLength(before)
    const mobiles = state.customers.map((c) => c.phone)
    expect(new Set(mobiles).size).toBe(mobiles.length) // absolutely no duplicates
  })
})
