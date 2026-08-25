import { describe, it, expect } from 'vitest'
import {
  parseBusinessCode, isValidBusinessCode, deriveTenantPrefix, tenantPrefixCandidates,
  formatEmployeeId, parseEmployeeId, looksLikeEmployeeId, isValidTenantPrefix,
  EMPLOYEE_NAMESPACES,
} from '@/lib/tenant-identity'

// ============================================================================
// Business Code ─▶ Tenant Prefix ─▶ Employee ID
//
// This file tests the derivation ALONE — no Prisma, no Laundry OS import —
// because the whole point of §18 is that Commerce can adopt the same identity
// without inheriting a laundry. If this file ever needs a database, the module
// has stopped being a platform primitive.
// ============================================================================

const A = 'BUS-202606-0005'   // the spec's tenant A
const B = 'BUS-202606-0012'   // the spec's tenant B

describe('Business Code is the source of truth', () => {
  it('parses the canonical shape', () => {
    const p = parseBusinessCode(A)
    expect(p).toMatchObject({ domain: 'BUS', sequence: 5 })
    expect(p!.monthIndex).toBe((2026 - 2000) * 12 + 5)
  })

  it('accepts the other live generator (LND-…) — the sample is not the only format', () => {
    expect(isValidBusinessCode('LND-202606-0001')).toBe(true)
  })

  it('rejects nonsense rather than inventing an identity', () => {
    for (const bad of ['', 'BUS', 'BUS-2026-0005', 'BUS-219906-0005', 'BUS-202613-0001', 'BUS-199906-0001', null, undefined]) {
      expect(parseBusinessCode(bad as string)).toBeNull()
    }
  })

  it('is case- and whitespace-insensitive', () => {
    expect(deriveTenantPrefix('  bus-202606-0005 ')).toBe(deriveTenantPrefix(A))
  })
})

describe('the prefix is deterministic and depends on nothing mutable', () => {
  it('the same code always gives the same prefix', () => {
    const runs = Array.from({ length: 50 }, () => deriveTenantPrefix(A))
    expect(new Set(runs).size).toBe(1)
  })

  it('matches the documented derivation', () => {
    expect(deriveTenantPrefix(A)).toBe('8T5')
    expect(deriveTenantPrefix(B)).toBe('8T12')
  })

  it('takes ONLY the code — name, email, domain, stores cannot be passed in', () => {
    // The signature is (code) => string. There is nowhere to put a business
    // name, so a rename provably cannot move a namespace.
    expect(deriveTenantPrefix.length).toBe(1)
  })

  it('same sequence in a different month does not collide', () => {
    expect(deriveTenantPrefix('BUS-202710-0005')).not.toBe(deriveTenantPrefix(A))
  })

  it('is injective across 16 years × 2000 businesses a month', () => {
    const seen = new Map<string, string>()
    for (let y = 2020; y <= 2035; y++) {
      for (let m = 1; m <= 12; m++) {
        for (let s = 1; s <= 2000; s++) {
          const code = `BUS-${y}${String(m).padStart(2, '0')}-${String(s).padStart(4, '0')}`
          const pre = deriveTenantPrefix(code)
          expect(seen.has(pre)).toBe(false)
          seen.set(pre, code)
        }
      }
    }
    expect(seen.size).toBe(16 * 12 * 2000)
  })

  it('never returns the one-letter-of-the-name prefix that would collide', () => {
    // VASTRASUDHA and VXYZ would both be "V5" under the rejected scheme.
    expect(deriveTenantPrefix(A)).not.toBe('V5')
    expect(isValidTenantPrefix(deriveTenantPrefix(A))).toBe(true)
  })

  it('unparseable codes still get a stable, differentiated prefix', () => {
    const x = deriveTenantPrefix('WEIRD_CODE_1')
    const y = deriveTenantPrefix('WEIRD_CODE_2')
    expect(x).toBe(deriveTenantPrefix('WEIRD_CODE_1'))
    expect(x).not.toBe(y)
  })

  it('an empty code is refused, not silently shared', () => {
    expect(() => deriveTenantPrefix('')).toThrow()
  })

  it('collision candidates are deterministic and distinct', () => {
    const c1 = tenantPrefixCandidates('WEIRD_CODE_1')
    expect(c1).toEqual(tenantPrefixCandidates('WEIRD_CODE_1'))
    expect(new Set(c1).size).toBe(c1.length)
    expect(c1[0]).toBe(deriveTenantPrefix('WEIRD_CODE_1'))
  })
})

describe('employee ids', () => {
  const pa = deriveTenantPrefix(A)
  const pb = deriveTenantPrefix(B)

  it('formats the two Laundry namespaces', () => {
    expect(formatEmployeeId(pa, 'EMP', 1)).toBe('8T5EMP001')
    expect(formatEmployeeId(pa, 'DL', 1)).toBe('8T5DL001')
    expect(formatEmployeeId(pb, 'EMP', 1)).toBe('8T12EMP001')
  })

  it('carries a Commerce namespace on the SAME prefix (§18)', () => {
    expect(formatEmployeeId(pa, 'COM', 1)).toBe('8T5COM001')
    expect(EMPLOYEE_NAMESPACES).toContain('COM')
  })

  it('round-trips, so a login can read the tenant off the identifier', () => {
    for (const ns of EMPLOYEE_NAMESPACES) {
      for (const seq of [1, 2, 9, 10, 99, 100, 999, 1000, 12345]) {
        const id = formatEmployeeId(pa, ns, seq)
        expect(parseEmployeeId(id)).toEqual({ prefix: pa, namespace: ns, sequence: seq })
      }
    }
  })

  it('EMP and DL of the same number are different identifiers', () => {
    expect(formatEmployeeId(pa, 'EMP', 1)).not.toBe(formatEmployeeId(pa, 'DL', 1))
  })

  it('the same number in two tenants gives two different ids', () => {
    expect(formatEmployeeId(pa, 'EMP', 1)).not.toBe(formatEmployeeId(pb, 'EMP', 1))
  })

  it('is case-insensitive on input (typed on a phone)', () => {
    expect(parseEmployeeId('8t5dl001')).toEqual({ prefix: '8T5', namespace: 'DL', sequence: 1 })
  })

  it('rejects the legacy unprefixed forms that named no tenant', () => {
    for (const bad of ['EMP001', 'DL001', 'EXE001', '001', 'EMP', '', null, undefined]) {
      expect(parseEmployeeId(bad as string)).toBeNull()
      expect(looksLikeEmployeeId(bad as string)).toBe(false)
    }
  })

  it('an email is never mistaken for an employee id', () => {
    expect(looksLikeEmployeeId('jane@business.com')).toBe(false)
    expect(looksLikeEmployeeId('owner@vastrasudha.co.in')).toBe(false)
  })

  it('refuses to format an invalid sequence rather than emit a broken id', () => {
    expect(() => formatEmployeeId(pa, 'EMP', 0)).toThrow()
    expect(() => formatEmployeeId(pa, 'EMP', -1)).toThrow()
    expect(() => formatEmployeeId('', 'EMP', 1)).toThrow()
    expect(() => formatEmployeeId(pa, 'NOPE' as never, 1)).toThrow()
  })
})
