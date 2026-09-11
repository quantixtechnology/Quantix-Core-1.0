import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { validateIndianMobile } from '@/lib/laundry-customer-create'

// ============================================================================
// STRICT 10-DIGIT INDIAN MOBILE VALIDATION — staff/admin customer creation and
// editing paths.
//
// Rule (user-set): exactly 10 digits, numeric only, first digit 6-9. Reject
// 0xxxxxxxxxx, +91xxxxxxxxxx, 91xxxxxxxxxx, short and long numbers. NO prefix
// stripping or conversion — the caller must send the raw 10-digit number so the
// stored value and the duplicate rule (businessId+phone) agree.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('validateIndianMobile — the exact user rule', () => {
  it('accepts only exactly-10-digit numbers starting 6-9', () => {
    for (const good of ['9876543210', '6123456789', '9000000000', '7999999999', '8888888888']) {
      expect(validateIndianMobile(good), good).toBeNull()
    }
  })

  it('rejects 0-prefixed, +91, 91-prefixed, short, long and non-numeric inputs', () => {
    const cases: [string, string][] = [
      ['09876543210', 'exactly 10 digits'],   // 11 digits — leading 0
      ['+919876543210', 'exactly 10 digits'], // +91 prefix
      ['919876543210', 'exactly 10 digits'],  // 91 prefix, 12 digits
      ['98765', 'exactly 10 digits'],         // short
      ['98765432100', 'exactly 10 digits'],   // long
      ['1234567890', 'must start with'],      // starts with 1
      ['5876543210', 'must start with'],      // starts with 5
      ['abcdefghij', 'exactly 10 digits'],    // non-numeric
      ['98765 43210', 'exactly 10 digits'],   // spaces
      ['', 'required'],                       // empty
    ]
    for (const [input, fragment] of cases) {
      const err = validateIndianMobile(input)
      expect(err, `"${input}" should be rejected`).not.toBeNull()
      expect(err, `"${input}" message should mention "${fragment}"`).toContain(fragment)
    }
  })

  it('never echoes the constant class of a garbage input — every message is about the 10-digit rule', () => {
    expect(validateIndianMobile('+919876543210')).toContain('10 digits')
    expect(validateIndianMobile('0')).toContain('10 digits')
  })
})

// ============================================================================
// The rule is enforced server-side on every staff/admin creation/edit path.
// ============================================================================
describe('validation is applied on all staff/admin customer paths', () => {
  it('POST /api/laundry/customers validates the mobile before creating', () => {
    const ROUTE = read('src/app/api/laundry/customers/route.ts')
    expect(ROUTE).toContain('import { createLaundryCustomer, findCustomerByMobile, findCustomerByEmail, validateIndianMobile }')
    expect(ROUTE).toContain('validateIndianMobile(mobile)')
  })

  it('PUT /api/laundry/customers/[id] validates a changed mobile and names the clash', () => {
    const ROUTE = read('src/app/api/laundry/customers/[id]/route.ts')
    expect(ROUTE).toContain('import { findCustomerByEmail, validateIndianMobile }')
    expect(ROUTE).toContain('validateIndianMobile(String(b.mobile))')
    expect(ROUTE).toContain('PHONE_TAKEN')
  })

  it('POST /api/core/businesses/[businessId]/customers validates the mobile', () => {
    const ROUTE = read('src/app/api/core/businesses/[businessId]/customers/route.ts')
    expect(ROUTE).toContain("import { validateIndianMobile } from '@/lib/laundry-customer-create'")
    expect(ROUTE).toContain('validateIndianMobile(body.phone)')
  })

  it('PUT /api/core/businesses/[businessId]/customers/[customerId] validates the mobile', () => {
    const ROUTE = read('src/app/api/core/businesses/[businessId]/customers/[customerId]/route.ts')
    expect(ROUTE).toContain('validateIndianMobile(body.phone)')
  })

  it('POST /api/laundry/dispatch/pickup validates an inline-created mobile', () => {
    const ROUTE = read('src/app/api/laundry/dispatch/pickup/route.ts')
    expect(ROUTE).toContain('import { validateIndianMobile } from "@/lib/laundry-customer-create"')
    expect(ROUTE).toContain('validateIndianMobile(phone)')
  })

  it('the storefront +91 identity behaviour is untouched', () => {
    // The user requirement: DO NOT change storefront identity resolution. The
    // strict helper is only imported where staff/admin create or edit — the
    // storefront routes must not pull it in as a replacement for their own
    // normalisation.
    for (const p of [
      'src/app/api/core/storefront/laundry-customer/route.ts',
      'src/app/api/core/storefront/laundry-checkout/route.ts',
    ]) {
      expect(read(p)).not.toContain('validateIndianMobile')
    }
  })

  it('operational workflows are untouched', () => {
    for (const p of [
      'src/lib/laundry-order-bags.ts',
      'src/lib/laundry-delivery-bags.ts',
      'src/lib/laundry-bag-assign.ts',
      'src/lib/laundry-payment-correction.ts',
      'src/lib/laundry-subscription-plan.ts',
    ]) {
      expect(read(p)).not.toContain('validateIndianMobile')
    }
  })
})

// ============================================================================
// Consistent duplicate detection for mobile AND email across those paths.
// ============================================================================
describe('consistent duplicate detection for mobile and email', () => {
  it('the shared helper finds a customer by email within a business', () => {
    const SRC = read('src/lib/laundry-customer-create.ts')
    expect(SRC).toContain('where: { businessId: platformBusinessId, email }')
    expect(SRC).toContain('export async function findCustomerByEmail')
  })

  it('POST /api/laundry/customers rejects an existing email with 409', () => {
    const ROUTE = read('src/app/api/laundry/customers/route.ts')
    expect(ROUTE).toContain('findCustomerByEmail(laundryBusiness.platformBusinessId, email)')
    expect(ROUTE).toContain('Customer with this email address already exists')
  })

  it('PUT /api/laundry/customers/[id] rejects moving onto an existing email', () => {
    const ROUTE = read('src/app/api/laundry/customers/[id]/route.ts')
    expect(ROUTE).toContain('EMAIL_TAKEN')
    expect(ROUTE).toContain('findCustomerByEmail(customer.businessId, b.email)')
  })

  it('core POST and PUT routes also reject an existing email', () => {
    const POST = read('src/app/api/core/businesses/[businessId]/customers/route.ts')
    const PUT = read('src/app/api/core/businesses/[businessId]/customers/[customerId]/route.ts')
    expect(POST).toContain('Customer with this email address already exists')
    expect(PUT).toContain('Another customer with this email already exists')
  })

  it('duplicate checks stay scoped to the tenant (businessId)', () => {
    const SRC = read('src/lib/laundry-customer-create.ts')
    expect(SRC).toContain('businessId: platformBusinessId, phone: mobile')
    expect(SRC).toContain('businessId: platformBusinessId, email')
  })

  it('mobile duplicate handling on edit still routes through the unique constraint', () => {
    const ROUTE = read('src/app/api/laundry/customers/[id]/route.ts')
    expect(ROUTE).toContain('@@unique([businessId, phone])')
    expect(ROUTE).toContain('code === "P2002"')
  })
})

// ============================================================================
// Merge audit fields + reason requirement are wired.
// ============================================================================
describe('merge audit trail', () => {
  it('the Customer schema carries the minimal merge audit fields', () => {
    const SCHEMA = read('prisma/schema.prisma')
    expect(SCHEMA).toContain('mergedIntoId             String?')
    expect(SCHEMA).toContain('mergedAt                 DateTime?')
    expect(SCHEMA).toContain('mergedBy                 String?')
  })

  it('the merge API requires a reason before merging, under the existing permission', () => {
    const ROUTE = read('src/app/api/laundry/customers/merge/route.ts')
    expect(ROUTE).toContain('reason = typeof b.reason === "string" ? b.reason.trim() : ""')
    expect(ROUTE).toContain('A reason/comment is required before merging customers')
    expect(ROUTE).toContain('laundry.customers.merge')
  })

  it('mergeCustomers() accepts and writes the audit fields and reason', () => {
    const LIB = read('src/lib/laundry-customer.ts')
    expect(LIB).toContain('actorName?: string | null, reason?: string | null')
    expect(LIB).toContain('mergedIntoId: primaryId, mergedAt: new Date(), mergedBy: actorName || null')
    expect(LIB).toContain('reason ? ` — ${reason}` : ""')
  })

  it('the merge UI requires select → confirm + reason → merge, gated by the existing permission', () => {
    const VIEW = read('src/components/laundry/views/laundry-customers-view.tsx')
    expect(VIEW).toContain('can("laundry.customers.merge")')
    expect(VIEW).toContain('Merge Duplicate')
    expect(VIEW).toContain('mergeConfirmTarget')
    expect(VIEW).toContain('mergeReason')
    expect(VIEW).toContain('I understand this cannot be undone')
    // The old one-click path must be gone — every merge now goes through the
    // confirmation step with a required reason.
    expect(VIEW).not.toContain('onClick={() => doMerge(c.id)}')
  })
})