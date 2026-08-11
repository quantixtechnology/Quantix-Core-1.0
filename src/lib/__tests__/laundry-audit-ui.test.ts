import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-audit.tsx'), 'utf8')

// The file holds TWO components. The correction state must live in the one that
// owns detail.items; putting it in IntakeAudit is what broke the last attempt.
const OWNER = SRC.slice(SRC.indexOf('export function LaundryStoreAudit'), SRC.indexOf('function IntakeAudit'))
const INTAKE = SRC.slice(SRC.indexOf('function IntakeAudit'))

describe('edit state lives in the component that owns the rows', () => {
  it('LaundryStoreAudit holds it', () => {
    for (const sym of ['editRow', 'editForm', 'useGarmentMaster', 'saveItem', 'removeItem']) {
      expect(OWNER).toContain(sym)
    }
  })

  it('IntakeAudit is untouched by it', () => {
    for (const sym of ['editRow', 'setEditForm', 'beginEdit']) {
      expect(INTAKE).not.toContain(sym)
    }
  })

  it('the rows render inside that component', () => {
    expect(OWNER).toContain('detail.items.map')
  })
})

describe('every garment row exposes Edit and Delete', () => {
  it('both controls exist', () => {
    expect(OWNER).toMatch(/<Pencil[^>]*\/>\s*Edit/)
    expect(OWNER).toMatch(/<Trash2[^>]*\/>\s*Delete/)
  })

  it('delete confirms first', () => {
    expect(OWNER).toContain('window.confirm(`Remove ${garmentName} from this order?`)')
  })

  it('edit pre-selects the current garment and service', () => {
    expect(OWNER).toContain('garmentId: it.garmentId || ""')
    expect(OWNER).toContain('serviceId: it.serviceId || ""')
  })
})

describe('it calls the deployed APIs and trusts the server for money', () => {
  it('PATCH and DELETE hit the item endpoint', () => {
    expect(OWNER).toContain('method: "PATCH"')
    expect(OWNER).toContain('method: "DELETE"')
    expect(OWNER).toMatch(/\/items\/\$\{itemId\}/)
  })

  it('reloads the order from the server after every change', () => {
    expect(OWNER.match(/await openOrder\(selectedId\)/g)?.length).toBe(2)
  })

  // Totals must never be recomputed in the browser. Scoped to the correction
  // handlers — elsewhere the screen legitimately DISPLAYS stored rates.
  it('the correction handlers do no pricing arithmetic', () => {
    const handlers = OWNER.slice(OWNER.indexOf('const saveItem'), OWNER.indexOf('const beginEdit') > OWNER.indexOf('const saveItem') ? OWNER.length : OWNER.indexOf('return ('))
    expect(handlers).not.toMatch(/grandTotal\s*=|unitPrice\s*\*|subtotal\s*\+/)
  })

  it('surfaces the server reason for an NA combination', () => {
    expect(OWNER).toContain('j.error || "Could not update this garment"')
  })
})

describe('subscription eligibility is shown per row', () => {
  it('requires the service AND the garment', () => {
    expect(OWNER).toContain('!!g?.subscriptionIncluded && !!sv?.subscriptionEligible')
  })

  it('states both outcomes in plain words', () => {
    expect(SRC).toContain('✓ Subscription eligible')
    expect(SRC).toContain('✕ Not covered by subscription')
    expect(SRC).toContain('Normal pricing applies')
  })

  it('names another service that would cover it', () => {
    expect(SRC).toContain('Subscription eligible for {alternatives.join(", ")}')
  })

  // Shown for the PENDING selection too, so the consequence is visible first.
  it('evaluates the pending edit, not only the saved row', () => {
    expect(OWNER).toContain('isEligible(editForm.garmentId, editForm.serviceId)')
  })
})

describe('history reuses the order timeline', () => {
  it('reads events already returned by the detail API', () => {
    expect(OWNER).toContain('detail.events')
    expect(SRC).toContain('AUDIT_ITEM_CHANGED: "Garment changed"')
    expect(SRC).toContain('REOPEN_AUDIT: "Returned to Audit"')
  })

  it('shows actor and time', () => {
    expect(OWNER).toContain('{ev.actorName || "—"} · {fmt(ev.createdAt)}')
  })
})

describe('the shared garment master is used', () => {
  it('no second selector or hardcoded list', () => {
    expect(OWNER).toContain('<LaundryGarmentSelect')
    for (const n of ['Shirt', 'Blanket', 'Trouser']) expect(OWNER).not.toContain(`"${n}"`)
  })
})
