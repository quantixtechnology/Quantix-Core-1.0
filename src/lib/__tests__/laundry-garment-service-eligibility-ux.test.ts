import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  garmentAvailableForService, unavailableNotice, garmentsForService,
  unavailableOrderLines,
} from '@/lib/laundry-garment-availability'

// ============================================================================
// STORE AUDIT — say WHICH garment and WHICH service are in conflict, at the
// moment the garment is chosen.
//
// Production: an online order booked Wash & Fold; the auditor picked Blanket
// (Single) · GAR00052. The server refused correctly with
// SERVICE_NOT_AVAILABLE_FOR_GARMENT, but the form said nothing, so the owner
// saw a garment sitting in a form that would not save and concluded the
// workflow was broken.
//
// The check reads the SAME map the refusal is derived from — active Pricing
// Matrix rules, served by GET /api/laundry/garment-services — so there is no
// second eligibility matrix, and a pair the form allows is exactly a pair the
// server accepts. The server remains the authority.
// ============================================================================

const WF = 's_washfold'      // Wash & Fold
const WI = 's_washiron'      // Wash & Iron
const BLANKET = 'g_blanket'  // Blanket (Single) — not priced for Wash & Fold
const SHIRT = 'g_shirt'
const TROUSER = 'g_trouser'

// Blanket is priced only for Wash & Iron; shirt and trouser for both.
const PRICED = {
  [SHIRT]: [WF, WI],
  [TROUSER]: [WF, WI],
  [BLANKET]: [WI],
}

describe('THE PRODUCTION CASE — Wash & Fold + Blanket (Single)', () => {
  it('is detected as unavailable', () => {
    expect(garmentAvailableForService(BLANKET, WF, PRICED)).toBe(false)
  })

  it('names the garment, the service and the way out', () => {
    const n = unavailableNotice('Blanket (Single)', 'Wash & Fold')
    expect(n.title).toBe('Not available for Wash & Fold')
    expect(n.detail).toBe('Blanket (Single) cannot be processed under Wash & Fold. Select a supported garment or change the service.')
  })

  it('the dropdown row says why, rather than hiding the garment', () => {
    expect(unavailableNotice('Blanket (Single)', 'Wash & Fold').optionLabel)
      .toBe('Blanket (Single) — Not available for Wash & Fold')
  })

  it('carries no ids or error codes the counter cannot use', () => {
    const text = JSON.stringify(unavailableNotice('Blanket (Single)', 'Wash & Fold'))
    for (const leak of [BLANKET, WF, 'SERVICE_NOT_AVAILABLE', '400', 'pricingRuleId']) {
      expect(text, leak).not.toContain(leak)
    }
  })
})

describe('a valid pair is not obstructed', () => {
  it('Wash & Fold + Shirt is available', () => {
    expect(garmentAvailableForService(SHIRT, WF, PRICED)).toBe(true)
  })

  it('Wash & Iron + Blanket is available — the same garment, a different service', () => {
    expect(garmentAvailableForService(BLANKET, WI, PRICED)).toBe(true)
  })
})

describe('changing the service revalidates every garment', () => {
  // The screen derives the invalid set from (rows × current serviceId), so a
  // service change re-answers for all rows with no extra wiring.
  const rows = [SHIRT, BLANKET]
  const invalidUnder = (serviceId: string) =>
    rows.filter((g) => !garmentAvailableForService(g, serviceId, PRICED))

  it('switching to a compatible service clears the error', () => {
    expect(invalidUnder(WF)).toEqual([BLANKET])
    expect(invalidUnder(WI)).toEqual([])   // Wash & Iron prices both
  })

  it('switching to an incompatible service raises it', () => {
    expect(invalidUnder(WI)).toEqual([])
    expect(invalidUnder(WF)).toEqual([BLANKET])
  })
})

describe('multiple garments — each offender is identified', () => {
  it('only the invalid ones are flagged, and they are named individually', () => {
    const rows = [SHIRT, BLANKET, TROUSER]
    const invalid = rows
      .map((g, i) => ({ g, n: i + 1 }))
      .filter(({ g }) => !garmentAvailableForService(g, WF, PRICED))
    expect(invalid).toHaveLength(1)
    expect(invalid[0]).toMatchObject({ g: BLANKET, n: 2 })
  })

  it('two invalid garments are both reported', () => {
    const priced = { ...PRICED, [TROUSER]: [WI] }
    const invalid = [SHIRT, BLANKET, TROUSER].filter((g) => !garmentAvailableForService(g, WF, priced))
    expect(invalid).toEqual([BLANKET, TROUSER])
  })
})

describe('it never blocks on a guess', () => {
  it('availability not loaded → allowed; the server still decides', () => {
    expect(garmentAvailableForService(BLANKET, WF, null)).toBe(true)
  })

  it('no service or no garment chosen yet → nothing claimed', () => {
    expect(garmentAvailableForService(BLANKET, null, PRICED)).toBe(true)
    expect(garmentAvailableForService(null, WF, PRICED)).toBe(true)
  })

  it('a garment absent from the matrix is unavailable, not silently allowed', () => {
    expect(garmentAvailableForService('g_unknown', WF, PRICED)).toBe(false)
  })
})

describe('one eligibility source, not two', () => {
  it('the selection check and the order-line warning agree', () => {
    // unavailableOrderLines already guarded SAVED lines; the new check answers
    // the same question for a line being typed. Same map, same verdict.
    const line = { garmentId: BLANKET, serviceId: WF, garmentName: 'Blanket (Single)', serviceName: 'Wash & Fold' }
    expect(unavailableOrderLines([line], PRICED)).toHaveLength(1)
    expect(garmentAvailableForService(BLANKET, WF, PRICED)).toBe(false)
  })

  it('garmentsForService is derived from the same map', () => {
    expect([...garmentsForService(WF, PRICED)!].sort()).toEqual([SHIRT, TROUSER].sort())
    expect([...garmentsForService(WI, PRICED)!].sort()).toEqual([BLANKET, SHIRT, TROUSER].sort())
  })
})

// ── the screen and the server ───────────────────────────────────────────────
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const AUDIT = read('src/components/laundry/views/laundry-store-audit.tsx')
const SELECT = read('src/components/laundry/garment-select.tsx')
const SEARCHABLE = read('src/components/laundry/views/pricing/searchable-select.tsx')
const INTAKE_API = read('src/app/api/laundry/orders/[id]/items/route.ts')
const AUTHORITY = read('src/lib/laundry-garment-services.ts')

describe('the screen validates before the request, not after the failure', () => {
  it('the intake form receives the same availability map the parent loads', () => {
    expect(AUDIT).toContain('priced={priced}')
    expect(AUDIT).toContain('/api/laundry/garment-services?businessId=')
  })

  it('a chosen garment is checked immediately', () => {
    expect(AUDIT).toContain('const garmentBlocked = useCallback')
    expect(AUDIT).toContain('garmentAvailableForService(r.garmentId, serviceId, priced)')
  })

  it('the error appears inline, beneath the selector that caused it', () => {
    expect(AUDIT).toContain('⚠️ {bad.notice.title}')
    expect(AUDIT).toContain('{bad.notice.detail}')
  })

  it('the button counts the offenders, singular and plural', () => {
    expect(AUDIT).toContain('`Fix ${invalidRows.length} garment${invalidRows.length === 1 ? "" : "s"} to continue`')
  })

  it('the selector itself goes into an error state', () => {
    expect(AUDIT).toContain('invalid={!!bad}')
    expect(SELECT).toContain('invalid && "border-rose-400')
  })

  it('Save is disabled while any garment is invalid, and says why', () => {
    expect(AUDIT).toContain('disabled={saving || hasInvalid}')
    expect(AUDIT).toContain('Fix ${invalidRows.length} garment')
  })

  it('a keyboard submit cannot slip past the disabled button', () => {
    expect(AUDIT).toContain('if (hasInvalid) {')
  })
})

describe('unavailable garments are shown, not hidden', () => {
  it('the option is disabled and carries its reason', () => {
    expect(SELECT).toContain('disabled: !!reason')
    expect(SELECT).toContain('hint: reason || undefined')
  })

  it('a disabled option cannot be selected', () => {
    expect(SEARCHABLE).toContain('if (o.disabled) return')
    expect(SEARCHABLE).toContain('disabled={o.disabled}')
  })

  it('the selector never decides availability itself — the caller supplies it', () => {
    expect(SELECT).toContain('unavailable?: (garmentId: string) => string | null')
    expect(SELECT).not.toContain('laundryPricingRule')
    expect(SELECT).not.toContain('garment-services')
  })

  it('existing callers are unaffected — both new props are optional', () => {
    expect(SELECT).toContain('unavailable?:')
    expect(SELECT).toContain('invalid?:')
  })
})

describe('the server remains the authority', () => {
  it('SERVICE_NOT_AVAILABLE_FOR_GARMENT is untouched', () => {
    expect(INTAKE_API).toContain('unavailableCombinationError(lines)')
    expect(INTAKE_API).toContain('SERVICE_NOT_AVAILABLE_FOR_GARMENT')
  })

  it('the authority still derives from the active Pricing Matrix', () => {
    expect(AUTHORITY).toContain('isActive: true')
    expect(AUTHORITY).toContain('garmentServiceAvailability')
  })

  it('the client check writes nothing and decides no price', () => {
    const LIB = read('src/lib/laundry-garment-availability.ts')
    const code = LIB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const w of ['fetch(', 'prisma', 'transition', 'POST', 'unitPrice']) {
      expect(code, w).not.toContain(w)
    }
  })
})
