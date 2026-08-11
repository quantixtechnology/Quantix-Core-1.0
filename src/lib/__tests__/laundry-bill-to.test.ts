import { describe, it, expect } from 'vitest'
import { billToBlock, formatPhone, WALK_IN_NAME } from '@/lib/laundry-bill-to'

// The exact snapshot formatAddressSnapshot() produces for this customer, and
// the exact duplication reported from the generated invoice.
const SNAPSHOT = 'Mukhtar Khan · +917350551170\nBengaluru\nBengaluru, Karnataka - 560064'
const CUSTOMER = { name: 'Mukhtar Khan', phone: '+917350551170', email: 'mukhtarkhan143@gmail.com' }

describe('BILL TO — the customer appears exactly once', () => {
  const b = billToBlock(CUSTOMER, SNAPSHOT)

  it('renders the reported case as a single clean block', () => {
    expect(b.name).toBe('Mukhtar Khan')
    expect(b.phone).toBe('+917350551170')
    expect(b.email).toBe('mukhtarkhan143@gmail.com')
    expect(b.addressLines).toEqual(['Bengaluru, Karnataka - 560064'])
  })

  it('states the name once', () => {
    const all = [b.name, ...b.addressLines].join('\n')
    expect(all.match(/Mukhtar Khan/g)).toHaveLength(1)
  })

  it('states the phone once', () => {
    const all = [b.phone, ...b.addressLines].join('\n')
    expect(all.match(/7350551170/g)).toHaveLength(1)
  })

  it('states the email once', () => {
    const all = [b.email, ...b.addressLines].join('\n')
    expect(all.match(/mukhtarkhan143@gmail\.com/g)).toHaveLength(1)
  })

  it('states the city once', () => {
    expect(b.addressLines.filter((l) => /Bengaluru/i.test(l))).toHaveLength(1)
  })
})

describe('what must NOT be dropped', () => {
  it('keeps real address detail that shares a line with the name', () => {
    const b = billToBlock(CUSTOMER, 'Mukhtar Khan · Flat 4B\nWhitefield, Karnataka - 560066')
    expect(b.addressLines).toContain('Mukhtar Khan · Flat 4B')
  })

  it('keeps a street line that merely starts with the city name', () => {
    const b = billToBlock(CUSTOMER, 'Bengaluru Central Mall, 4th Floor\nBengaluru, Karnataka - 560064')
    expect(b.addressLines).toHaveLength(2)
  })

  it('keeps a landmark and a second address line', () => {
    const snap = 'Mukhtar Khan · +917350551170\n12 Main Road\nApt 7\nLandmark: Near Park\nBengaluru, Karnataka - 560064'
    const b = billToBlock(CUSTOMER, snap)
    expect(b.addressLines).toEqual(['12 Main Road', 'Apt 7', 'Landmark: Near Park', 'Bengaluru, Karnataka - 560064'])
  })

  it('leaves a free-text legacy address completely alone', () => {
    const b = billToBlock(CUSTOMER, 'Behind the old post office, second gate')
    expect(b.addressLines).toEqual(['Behind the old post office, second gate'])
  })
})

describe('matching is on meaning, not punctuation', () => {
  it('drops the identity line when the phone is spaced differently', () => {
    const b = billToBlock({ ...CUSTOMER, phone: '+91 73505 51170' }, SNAPSHOT)
    expect(b.addressLines).toEqual(['Bengaluru, Karnataka - 560064'])
  })

  it('drops it when the snapshot omits the country code', () => {
    const b = billToBlock(CUSTOMER, 'Mukhtar Khan · 7350551170\nBengaluru, Karnataka - 560064')
    expect(b.addressLines).toEqual(['Bengaluru, Karnataka - 560064'])
  })

  it('is case-insensitive on the name', () => {
    const b = billToBlock(CUSTOMER, 'MUKHTAR KHAN · +917350551170\nBengaluru, Karnataka - 560064')
    expect(b.addressLines).toEqual(['Bengaluru, Karnataka - 560064'])
  })
})

describe('edge cases the invoice must survive', () => {
  it('falls back to the walk-in label with no customer', () => {
    const b = billToBlock(null, null)
    expect(b.name).toBe(WALK_IN_NAME)
    expect(b.phone).toBeNull()
    expect(b.addressLines).toEqual([])
  })

  it('handles a missing address', () => {
    expect(billToBlock(CUSTOMER, null).addressLines).toEqual([])
  })

  it('handles a customer with no email', () => {
    const b = billToBlock({ name: 'A B', phone: '9999999999' }, 'A B · 9999999999\nCity, State - 1')
    expect(b.email).toBeNull()
    expect(b.addressLines).toEqual(['City, State - 1'])
  })

  it('does not drop an address line just because it is short', () => {
    const b = billToBlock(CUSTOMER, 'Mukhtar Khan · +917350551170\n4B\nBengaluru, Karnataka - 560064')
    expect(b.addressLines).toContain('4B')
  })
})

describe('formatPhone never mangles what it does not recognise', () => {
  it('spaces an Indian mobile with a country code', () => {
    expect(formatPhone('+917350551170')).toBe('+91 73505 51170')
  })

  it('spaces a bare 10-digit mobile', () => {
    expect(formatPhone('7350551170')).toBe('73505 51170')
  })

  it('returns an international number untouched', () => {
    expect(formatPhone('+1 415 555 0100')).toBe('+1 415 555 0100')
  })

  it('returns a landline untouched', () => {
    expect(formatPhone('080-22334455')).toBe('080-22334455')
  })

  it('passes through null', () => {
    expect(formatPhone(null)).toBeNull()
  })
})
