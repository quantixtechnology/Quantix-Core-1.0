import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// A CORRECTION HAS TO BE POSSIBLE, AND A REFUSAL HAS TO BE AUDIBLE.
//
// Staff could not fix a wrong mobile number. Three separate things stood in the
// way, and only the first was about mobile at all:
//
//  1. Two customers in one business may not share a phone — @@unique([businessId,
//     phone]), and that rule is right. But it surfaced as Prisma's P2002 falling
//     into a generic catch, so the API answered 500 "Internal server error" and
//     the WHOLE save was discarded: the name and address typed in the same form
//     went with it. Nothing named the record already holding the number.
//
//  2. The Customers screen raised every message through useToast(), whose
//     <Toaster /> is mounted nowhere — the app renders sonner's. So the refusal
//     was silent. Staff typed a new number, pressed Save, saw no change and no
//     error, and concluded the field was read-only.
//
//  3. The inline address block ran on truthiness, so a form submitted with every
//     address box emptied looked exactly like a request that never mentioned an
//     address, and the old one stayed. An address could be written but never
//     cleared.
//
// The constraint is kept. It is now reported as a 409 naming the customer, the
// message reaches the toaster that is actually on screen, and the address block
// asks whether the caller SAID anything rather than whether it said something
// non-empty.
//
// Verified in the real browser, signed in, on the running app:
//   Edit -> Mobile +9110002241706 -> 9123400099, City -> Nagpur -> Save
//   list row shows 9123400099 · reopen shows 9123400099/Nagpur
//   FULL PAGE REFRESH -> still 9123400099/Nagpur
//   duplicate attempt -> dialog stays open, edits preserved, toast reads
//   "Update failed — +9110002196894 already belongs to E2E CRUD
//    (CUS-LND-202606-0001-000015). Correct that record or merge the two."
//   customers 20 -> 20 (no duplicate), orders 128 -> 128, payments 11 -> 11
// ============================================================================

const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/[id]/route.ts'), 'utf8')
const VIEW = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-customers-view.tsx'), 'utf8')
const PUT = API.slice(API.indexOf('export async function PUT'), API.indexOf('export async function DELETE'))

describe('1 · mobile is editable, through the ordinary field mapping', () => {
  it('the form field maps to the phone column', () => {
    expect(PUT).toContain('...(b.mobile !== undefined && { phone: b.mobile })')
  })

  it('the input is a plain editable control — not disabled or readOnly', () => {
    const field = VIEW.slice(VIEW.indexOf('Mobile *'), VIEW.indexOf('Mobile *') + 260)
    expect(field).toContain('onChange')
    expect(field).not.toMatch(/disabled|readOnly/)
  })

  it('and the payload carries it — the form is spread whole', () => {
    expect(VIEW).toContain('JSON.stringify({ businessId: currentBusinessId, ...form, tags })')
  })
})

describe('2 · the uniqueness rule is kept, and explained', () => {
  it('a number held by another customer is refused with 409, not 500', () => {
    expect(PUT).toContain('code: "PHONE_TAKEN"')
    expect(PUT).toContain('{ status: 409 }')
    expect(PUT).toContain('already belongs to')
  })

  it('the refusal names the record holding it', () => {
    expect(PUT).toContain('select: { id: true, name: true, customerCode: true }')
    expect(PUT).toContain('conflictCustomerId: clash.id')
  })

  it('it only looks when the number actually changed', () => {
    expect(PUT).toContain('b.mobile !== customer.phone')
    expect(PUT).toContain('id: { not: id }')
  })

  it('and the database is still the authority — P2002 is caught too', () => {
    expect(API).toContain(".code === \"P2002\"")
    expect(API.slice(API.indexOf('.code === "P2002"'))).toContain('{ status: 409 }')
  })

  it('the generic 500 remains for genuinely unexpected failures', () => {
    expect(API).toContain('return NextResponse.json({ error: "Internal server error" }, { status: 500 })')
  })
})

describe('3 · an emptied address is a change, not an absence', () => {
  it('the address block runs on presence of the keys', () => {
    expect(PUT).toContain('const hasAddr = ADDRESS_KEYS.some((k) => b[k] !== undefined)')
    expect(PUT).not.toContain('.some((v) => v)')
  })

  it('a caller that says nothing about the address still skips it', () => {
    // The restore button sends only a status — no address keys, so undefined.
    expect(VIEW).toContain('JSON.stringify({ businessId: currentBusinessId, status: "ACTIVE" })')
    const keys = PUT.slice(PUT.indexOf('const ADDRESS_KEYS'), PUT.indexOf('const hasAddr'))
    for (const k of ['addressLine1', 'addressLine2', 'area', 'landmark', 'city', 'state', 'pincode']) {
      expect(keys).toContain(`"${k}"`)
    }
  })
})

describe('4 · the screen can actually be heard', () => {
  it('messages go to the toaster the app mounts', () => {
    expect(VIEW).toContain('sonnerToast.error(body)')
    expect(VIEW).toContain('sonnerToast.success(body)')
  })

  it('and no longer to the one it does not', () => {
    expect(VIEW).not.toContain('@/hooks/use-toast')
    // The app mounts sonner's Toaster, and only that one.
    const LAYOUT = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    expect(LAYOUT).toContain('import { Toaster } from "sonner"')
  })

  it('a destructive message stays an error, so a refusal reads as one', () => {
    const adapter = VIEW.slice(VIEW.indexOf('const toast = useCallback('), VIEW.indexOf('const [rows, setRows]'))
    expect(adapter).toContain('o.variant === "destructive"')
    expect(adapter).toContain('o.description ? `${o.title} — ${o.description}` : o.title')
  })
})

describe('5 · authorization and validation are untouched', () => {
  it('editing still requires the customers-edit permission', () => {
    expect(PUT).toContain('requireLaundryPermission(request, b.businessId, "laundry.customers.edit")')
    expect(PUT).toContain('if (!guard.ok) return guard.res')
  })

  it('the customer is still scoped to the business before anything is written', () => {
    expect(PUT).toContain('const customer = await scopedCustomer(b.businessId, id)')
    expect(PUT).toContain('if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })')
    // and the conflict lookup is scoped to that same business
    expect(PUT).toContain('where: { businessId: customer.businessId, phone: b.mobile, id: { not: id } }')
  })

  it('pincode validation still runs, and still ahead of the write', () => {
    expect(PUT).toContain('if (b.pincode && !isValidPincode(b.pincode))')
    expect(PUT.indexOf('isValidPincode')).toBeLessThan(PUT.indexOf('prisma.customer.update'))
  })

  it('the edit updates one customer by id — it never creates a second', () => {
    expect(PUT).toContain('prisma.customer.update({\n      where: { id },')
    expect(PUT).not.toContain('prisma.customer.create')
  })
})
