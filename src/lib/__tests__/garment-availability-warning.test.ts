import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { unavailableOrderLines } from '@/lib/laundry-garment-availability'

// ============================================================================
// THE GUARD WAS RIGHT; THE SILENCE WAS THE BUG.
//
// An online order carrying a garment its service cannot price is refused by the
// server — correctly. Staff saw the refusal with no reason and concluded the
// system was broken. This adds the reason, in the counter's words, from the
// SAME availability the guard is derived from. Nothing about the validation,
// pricing, status or workflow changes.
// ============================================================================

const line = (garmentId: string, serviceId: string, garmentName: string, serviceName: string) =>
  ({ garmentId, serviceId, garmentName, serviceName })

// Curtain is priced for Curtain Wash & Fold only; Shirt for Wash & Fold.
const PRICED = { g_curtain: ['s_curtainwf'], g_shirt: ['s_wf', 's_curtainwf'] }

describe('a valid order says nothing', () => {
  it('every line priced → no warning', () => {
    expect(unavailableOrderLines([line('g_shirt', 's_wf', 'Shirt', 'Wash & Fold')], PRICED)).toEqual([])
  })

  it('an empty order says nothing', () => {
    expect(unavailableOrderLines([], PRICED)).toEqual([])
    expect(unavailableOrderLines(null, PRICED)).toEqual([])
  })
})

describe('an invalid pair is explained, not just refused', () => {
  it('names the garment and the service, in that order', () => {
    const out = unavailableOrderLines([line('g_curtain', 's_wf', 'Curtain', 'Wash & Fold')], PRICED)
    expect(out).toHaveLength(1)
    expect(out[0].message).toBe('Curtain is not available for Wash & Fold.')
    expect(out[0]).toMatchObject({ garmentName: 'Curtain', serviceName: 'Wash & Fold' })
  })

  it('the same garment under its own service is fine', () => {
    expect(unavailableOrderLines([line('g_curtain', 's_curtainwf', 'Curtain', 'Curtain Wash & Fold')], PRICED)).toEqual([])
  })

  it('carries no ids, codes or status numbers a customer-facing operator cannot use', () => {
    const out = unavailableOrderLines([line('g_curtain', 's_wf', 'Curtain', 'Wash & Fold')], PRICED)
    const text = JSON.stringify(out)
    for (const leak of ['g_curtain', 's_wf', 'pricingRuleId', '400', '409', 'SERVICE_NOT_AVAILABLE']) {
      expect(text, leak).not.toContain(leak)
    }
  })
})

describe('every offending line is shown, not only the first', () => {
  it('lists all mismatches', () => {
    const out = unavailableOrderLines([
      line('g_curtain', 's_wf', 'Curtain', 'Wash & Fold'),
      line('g_shirt', 's_wf', 'Shirt', 'Wash & Fold'),          // valid
      line('g_rug', 's_wf', 'Rug', 'Wash & Fold'),               // no rule at all
    ], PRICED)
    expect(out.map((l) => l.message)).toEqual([
      'Curtain is not available for Wash & Fold.',
      'Rug is not available for Wash & Fold.',
    ])
  })

  it('collapses repeats of the SAME pair to one row', () => {
    const out = unavailableOrderLines([
      line('g_curtain', 's_wf', 'Curtain', 'Wash & Fold'),
      line('g_curtain', 's_wf', 'Curtain', 'Wash & Fold'),
    ], PRICED)
    expect(out).toHaveLength(1)
  })
})

describe('it never warns on a guess', () => {
  it('says nothing while availability has not loaded', () => {
    expect(unavailableOrderLines([line('g_curtain', 's_wf', 'Curtain', 'Wash & Fold')], null)).toEqual([])
  })

  it('skips a line missing either id rather than accusing it', () => {
    expect(unavailableOrderLines([
      { garmentId: null, serviceId: 's_wf', garmentName: 'Loose weight', serviceName: 'Wash & Fold' },
      { garmentId: 'g_curtain', serviceId: null, garmentName: 'Curtain', serviceName: null },
    ], PRICED)).toEqual([])
  })

  it('falls back to readable words when a name is missing', () => {
    const out = unavailableOrderLines([{ garmentId: 'g_curtain', serviceId: 's_wf' }], PRICED)
    expect(out[0].message).toBe('This garment is not available for the selected service.')
  })
})

// ── the screens, and what they did NOT change ───────────────────────────────
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const DESKTOP = read('src/components/laundry/views/laundry-store-audit.tsx')
const PWA = read('src/app/laundry/store/page.tsx')
const LIB = read('src/lib/laundry-garment-availability.ts')

describe('both Store Audit surfaces warn, from the one source', () => {
  it('each reads the existing availability endpoint', () => {
    for (const src of [DESKTOP, PWA]) expect(src).toContain('/api/laundry/garment-services?businessId=')
  })

  it('each uses the shared rule rather than its own check', () => {
    for (const src of [DESKTOP, PWA]) expect(src).toContain('unavailableOrderLines(')
  })

  it('the wording is for staff — no ids, codes or status numbers', () => {
    for (const src of [DESKTOP, PWA]) {
      expect(src).toContain('⚠️ This order cannot be processed yet')
      expect(src).toContain('Nothing is changed automatically.')
    }
    expect(DESKTOP).toContain('Use <span className="font-semibold">Edit</span> on the line')
  })

  it('subscription cover stays a separate question', () => {
    // "Not included in the plan" is priced normally; the audit screen already
    // says that, and this must not be confused with "cannot be ordered".
    expect(DESKTOP).toContain('subscription-coverage?businessId=')
    expect(DESKTOP).toContain('EligibilityLine')
    expect(LIB).toContain('SUBSCRIPTION COVER IS A DIFFERENT QUESTION')
  })

  it('nothing about the guard, pricing or workflow is touched', () => {
    // The warning only READS. Asserted on the CODE, not the prose that explains
    // it: the rule is pure — it fetches nothing, touches no database, and
    // writes no price, status or transition.
    const code = LIB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const w of ['fetch(', 'prisma', 'transition', 'PATCH', 'POST', 'status']) {
      expect(code, w).not.toContain(w)
    }
  })
})
