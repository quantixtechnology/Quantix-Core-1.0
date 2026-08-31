import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { intakeServiceChoice } from '@/lib/laundry-intake-service'
import { assertServiceAllowedOnOrder } from '@/lib/laundry-one-service'

// ============================================================================
// THE SERVICE BELONGS TO THE ORDER, NOT TO THE PICKER.
//
// A Pickup-First order is booked with a service and no garments. The intake
// endpoint enforces ONE SERVICE = ONE ORDER, so only that service can be
// recorded against it. Both Store Audit screens were offering the WHOLE
// configured master list and defaulting to the first of it, so the counter was
// invited to pick something the server would refuse — and the order sat at
// Store Audit with zero garments, unable to move.
//
// Every case below is stated as: what may the operator choose, given what this
// order was actually booked with?
// ============================================================================

const MASTER = [
  { id: 's_wf', name: 'Wash & Fold' },
  { id: 's_wi', name: 'Wash & Iron' },
  { id: 's_dc', name: 'Dry Clean' },
]

describe('an order booked with one service does not ask', () => {
  const choice = intakeServiceChoice([{ serviceId: 's_wi', serviceName: 'Wash & Iron' }], MASTER)

  it('locks to the booked service', () => {
    expect(choice.locked).toBe(true)
    expect(choice.serviceId).toBe('s_wi')
    expect(choice.lockedName).toBe('Wash & Iron')
  })

  it('never offers a service the order was not booked with', () => {
    expect(choice.options.map((o) => o.id)).toEqual(['s_wi'])
  })

  it('is NOT the first of the master list — the bug being fixed', () => {
    expect(choice.serviceId).not.toBe(MASTER[0].id)
  })
})

describe('the locked answer is one the server will accept', () => {
  // The screen and the guard must agree, or the operator is invited to fail.
  const booked = [{ serviceId: 's_wi', serviceName: 'Wash & Iron' }]

  it('what the lock returns passes the ONE SERVICE rule', () => {
    const { serviceId } = intakeServiceChoice(booked, MASTER)
    expect(assertServiceAllowedOnOrder(booked, [{ serviceId, serviceName: null }]).ok).toBe(true)
  })

  it('what the old default returned is exactly what the server refuses', () => {
    const verdict = assertServiceAllowedOnOrder(booked, [{ serviceId: MASTER[0].id, serviceName: MASTER[0].name }])
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.code).toBe('MULTIPLE_SERVICES')
  })
})

describe('garments already on the order establish it too', () => {
  it('reads the service off an existing item when no service row survives', () => {
    const choice = intakeServiceChoice([{ serviceId: 's_dc', serviceName: 'Dry Clean' }], MASTER)
    expect(choice).toMatchObject({ locked: true, serviceId: 's_dc' })
  })

  it('the same service booked AND on an item is still one answer', () => {
    const choice = intakeServiceChoice([
      { serviceId: 's_wi', serviceName: 'Wash & Iron' },
      { serviceId: 's_wi', serviceName: 'Wash & Iron' },
    ], MASTER)
    expect(choice.options).toHaveLength(1)
    expect(choice.locked).toBe(true)
  })
})

describe('it never guesses when there is a real choice', () => {
  it('a legacy two-service order asks, and offers only its own two', () => {
    const choice = intakeServiceChoice([
      { serviceId: 's_wi', serviceName: 'Wash & Iron' },
      { serviceId: 's_dc', serviceName: 'Dry Clean' },
    ], MASTER)
    expect(choice.locked).toBe(false)
    expect(choice.serviceId).toBe('')
    expect(choice.options.map((o) => o.id)).toEqual(['s_wi', 's_dc'])
  })

  it('an order with nothing booked offers the master and pre-selects nothing', () => {
    const choice = intakeServiceChoice([], MASTER)
    expect(choice).toMatchObject({ locked: false, serviceId: '', lockedName: null })
    expect(choice.options).toEqual(MASTER)
  })

  it('the first garment establishing the service is a deliberate pick, not a default', () => {
    expect(intakeServiceChoice(null, MASTER).serviceId).toBe('')
    expect(intakeServiceChoice(undefined, undefined).options).toEqual([])
  })
})

describe('a booked service that the master no longer lists', () => {
  it('is still offered — it is what the server accepts', () => {
    const choice = intakeServiceChoice([{ serviceId: 's_retired', serviceName: 'Starch & Press' }], MASTER)
    expect(choice).toMatchObject({ locked: true, serviceId: 's_retired', lockedName: 'Starch & Press' })
  })

  it('uses the master name when the id still resolves, not the frozen one', () => {
    const choice = intakeServiceChoice([{ serviceId: 's_wi', serviceName: 'Wash and Iron (old label)' }], MASTER)
    expect(choice.lockedName).toBe('Wash & Iron')
  })
})

describe('a name-only booking is resolved, never invented', () => {
  it('matches a configured service by name, case and space insensitive', () => {
    const choice = intakeServiceChoice([{ serviceId: null, serviceName: '  wash & iron ' }], MASTER)
    expect(choice).toMatchObject({ locked: true, serviceId: 's_wi' })
  })

  it('a name matching nothing is NOT offered — it cannot be priced', () => {
    // Saving an unpriceable line is the ₹0 "Service" billing hole; the operator
    // picks a real service instead.
    const choice = intakeServiceChoice([{ serviceId: null, serviceName: 'Service' }], MASTER)
    expect(choice.locked).toBe(false)
    expect(choice.options).toEqual(MASTER)
  })
})

// ── the two screens, and what they did NOT change ───────────────────────────
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const DESKTOP = read('src/components/laundry/views/laundry-store-audit.tsx')
const PWA = read('src/app/laundry/store/page.tsx')
const LIB = read('src/lib/laundry-intake-service.ts')

describe('both Store Audit surfaces use the one rule', () => {
  it('each resolves the service through the shared helper', () => {
    for (const src of [DESKTOP, PWA]) expect(src).toContain('intakeServiceChoice(')
  })

  it('neither builds its intake picker from the whole services master any more', () => {
    // The old default. Its absence is the fix.
    expect(DESKTOP).not.toContain('services[0]?.serviceId')
    expect(PWA).not.toContain('<option value="">Service</option>{services.map(')
  })

  it('each reads the order\'s OWN booked services', () => {
    expect(DESKTOP).toContain('...(detail.services || []), ...detail.items')
    expect(PWA).toContain('order.services || []')
  })

  it('a locked order states the service instead of asking for it', () => {
    for (const src of [DESKTOP, PWA]) expect(src).toContain('choice.locked')
  })
})

describe('the rule decides nothing else', () => {
  it('is pure — no fetch, no database, no pricing, no workflow', () => {
    const code = LIB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const w of ['fetch(', 'prisma', 'transition', 'price', 'Price', 'status', 'POST']) {
      expect(code, w).not.toContain(w)
    }
  })

  it('the server guard is untouched — it, not the screen, is the authority', () => {
    expect(LIB).toContain('from "@/lib/laundry-one-service"')
  })
})

describe('an order with no garments cannot be approved', () => {
  it('the desktop Approve button says what is missing rather than failing', () => {
    // checkAuditComplete refuses expected === 0; this is that refusal, before
    // the click. The gate itself is unchanged.
    expect(DESKTOP).toContain('const needsGarments = !!detail && detail.items.length === 0')
    expect(DESKTOP).toContain('Record Garments First')
  })
})
