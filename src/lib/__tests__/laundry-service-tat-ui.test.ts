import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { toHours, fromHours, effectiveTatHours } from '@/lib/laundry-tat'

const CREATOR = readFileSync(join(process.cwd(), 'src/components/laundry/views/pricing/laundry-services-pricing.tsx'), 'utf8')
const API_PUT = readFileSync(join(process.cwd(), 'src/app/api/laundry/services/[id]/route.ts'), 'utf8')
const API_GET = readFileSync(join(process.cwd(), 'src/app/api/laundry/services/route.ts'), 'utf8')

describe('the Service Creator exposes the controls', () => {
  it('has a Delivery / Turnaround section, before Processing Route', () => {
    const tat = CREATOR.indexOf('title="Delivery / Turnaround"')
    const order = CREATOR.indexOf('title="Order Configuration"')
    const route = CREATOR.indexOf('title="Processing Route"')
    expect(tat).toBeGreaterThan(order)
    expect(tat).toBeLessThan(route)
  })

  it('explains the standard case when the toggle is off', () => {
    expect(CREATOR).toContain('Uses standard delivery time')
  })

  it('hides the value field until the toggle is on', () => {
    expect(CREATOR).toContain('{form.tatEnabled && (')
  })

  it('offers Hours and Days, in plain words', () => {
    expect(CREATOR).toContain('Hours')
    expect(CREATOR).toContain('Days')
    expect(CREATOR).toContain('Custom Turnaround Time')
    expect(CREATOR).toContain('Delivery Time')
  })

  it('shows the exact validation message the brief specifies', () => {
    expect(CREATOR).toContain('Enter a valid delivery time.')
  })

  // No jargon may reach the owner.
  it('never exposes internal terminology in the UI', () => {
    for (const word of ['effectiveTAT', 'orderTAT', 'override engine', 'calculation engine']) {
      expect(CREATOR).not.toContain(word)
    }
  })
})

describe('save behaviour', () => {
  it('reuses the existing service API — no new endpoint', () => {
    expect(CREATOR).toContain('/api/laundry/services')
    expect(CREATOR.match(/fetch\(edit \? `\/api\/laundry\/services\/\$\{edit\.id\}` : `\/api\/laundry\/services`/)).toBeTruthy()
  })

  it('writes the hours only while enabled, so switching off preserves the stored value', () => {
    expect(CREATOR).toContain('...(form.tatEnabled ? { defaultTurnaroundHours:')
  })

  it('always sends the flag, so turning it OFF actually persists', () => {
    expect(CREATOR).toContain('tatEnabled: form.tatEnabled,')
  })

  it('blocks a save with an invalid time', () => {
    expect(CREATOR).toContain('if (tatInvalid)')
    expect(CREATOR).toContain('const tatInvalid = form.tatEnabled && !(Number(form.tatValue) > 0)')
  })
})

describe('editing must not lose an existing turnaround', () => {
  // The PUT only writes keys that are present, so a screen that never sends
  // them cannot clear them.
  it('the API leaves TAT untouched when a field is absent', () => {
    expect(API_PUT).toContain('...(b.tatEnabled !== undefined && { tatEnabled: !!b.tatEnabled })')
    expect(API_PUT).toContain('...(b.defaultTurnaroundHours !== undefined && { defaultTurnaroundHours: b.defaultTurnaroundHours })')
  })

  it('the list API returns the fields, so Edit can show them', () => {
    // `include` returns every scalar; a `select` would have to name them.
    expect(API_GET).toContain('include: {')
    expect(API_GET).not.toMatch(/select: \{[^}]*defaultTurnaroundHours/)
  })

  it('reopens the value in the unit it was saved in', () => {
    expect(CREATOR).toContain('fromHours(s.defaultTurnaroundHours ?? 24, s.tatUnit)')
    expect(fromHours(24, 'DAYS')).toEqual({ value: 1, unit: 'DAYS' })
    expect(fromHours(12, 'HOURS')).toEqual({ value: 12, unit: 'HOURS' })
  })
})

describe('the two services from the brief round-trip correctly', () => {
  it('Express Wash & Fold — 12 Hours', () => {
    const stored = toHours(12, 'HOURS')
    expect(stored).toBe(12)
    expect(fromHours(stored, 'HOURS').value).toBe(12)
    expect(effectiveTatHours({ tatEnabled: true, defaultTurnaroundHours: stored })).toBe(12)
  })

  it('Express Wash & Iron — 6 Hours', () => {
    const stored = toHours(6, 'HOURS')
    expect(effectiveTatHours({ tatEnabled: true, defaultTurnaroundHours: stored })).toBe(6)
  })

  it('a standard service saved from this screen still uses standard delivery', () => {
    expect(effectiveTatHours({ tatEnabled: false, defaultTurnaroundHours: 12 })).toBe(24)
  })
})
