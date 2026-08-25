import { describe, it, expect } from 'vitest'
import {
  parseBusinessCode, isValidBusinessCode, deriveTenantPrefix, tenantPrefixCandidates,
  formatEmployeeId, parseEmployeeId, looksLikeEmployeeId, isValidTenantPrefix,
  businessInitial, businessNumber, EMPLOYEE_NAMESPACES,
} from '@/lib/tenant-identity'

// ============================================================================
// Business Code ─▶ Tenant Prefix ─▶ Employee ID
//
// This file tests the derivation ALONE — no Prisma, no Laundry OS import —
// because the whole point of §18 is that Commerce can adopt the same identity
// without inheriting a laundry. If this file ever needs a database, the module
// has stopped being a platform primitive.
// ============================================================================

const A = 'BUS-202606-0005'   // VASTRASUDHA
const B = 'BUS-202606-0012'   // Laundry & Drycleaners
const NAME_A = 'VASTRASUDHA'
const NAME_B = 'Laundry & Drycleaners'

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
    expect(deriveTenantPrefix('  bus-202606-0005 ', NAME_A)).toBe(deriveTenantPrefix(A, NAME_A))
  })

  it('reads the business NUMBER, not the month or the padded string', () => {
    expect(businessNumber(A)).toBe(5)
    expect(businessNumber(B)).toBe(12)
    expect(businessNumber(A)).not.toBe(202606)
    expect(businessNumber(A)).not.toBe(2026)
    expect(String(businessNumber(A))).not.toBe('0005')
  })

  it('takes the first letter of the name, with no abbreviation rules', () => {
    expect(businessInitial(NAME_A)).toBe('V')
    expect(businessInitial(NAME_B)).toBe('L')
    expect(businessInitial('  quick wash ')).toBe('Q')
    expect(businessInitial('&Co Laundry')).toBe('C')   // skips punctuation
    expect(businessInitial('')).toBe('Q')              // never empty
  })
})

describe('the prefix is [Business Initial][Business Number]', () => {
  it('produces the documented prefixes', () => {
    expect(deriveTenantPrefix(A, NAME_A)).toBe('V5')
    expect(deriveTenantPrefix(B, NAME_B)).toBe('L12')
  })

  it('the same inputs always give the same prefix', () => {
    const runs = Array.from({ length: 50 }, () => deriveTenantPrefix(A, NAME_A))
    expect(new Set(runs).size).toBe(1)
  })

  it('the number comes from the Business Code — §10', () => {
    // Same name, different code ⇒ different prefix.
    expect(deriveTenantPrefix('BUS-202606-0009', NAME_A)).toBe('V9')
    expect(deriveTenantPrefix(A, NAME_A)).toBe('V5')
  })

  it('nothing but the name and the code is an input', () => {
    // Two arguments, so an email, phone, store or row id cannot reach it — §13.
    expect(deriveTenantPrefix.length).toBe(2)
  })

  it('an unparseable code still yields a usable prefix', () => {
    expect(deriveTenantPrefix('NOT-A-CODE', NAME_A)).toBe('V0')
  })

  it('same initial + same code sequence WANTS the same prefix — the clash the registry settles', () => {
    // Documented, not hidden: this is exactly why TenantIdentity.prefix is
    // unique and allocated through the candidate list.
    expect(deriveTenantPrefix('BUS-202707-0005', 'Vikram Laundry')).toBe(deriveTenantPrefix(A, NAME_A))
  })

  it('candidates are ordered, distinct, and keep the ends-in-a-digit rule', () => {
    const c = tenantPrefixCandidates(A, NAME_A)
    expect(c[0]).toBe('V5')
    expect(c[1]).toBe('V5A1')
    expect(new Set(c).size).toBe(c.length)
    for (const p of c) expect(isValidTenantPrefix(p)).toBe(true)
  })

  it('a clash prefix still splits unambiguously', () => {
    expect(parseEmployeeId('V5A1EMP001')).toEqual({ prefix: 'V5A1', namespace: 'EMP', sequence: 1 })
  })
})

describe('employee ids', () => {
  const pa = deriveTenantPrefix(A, NAME_A)
  const pb = deriveTenantPrefix(B, NAME_B)

  it('formats the two Laundry namespaces', () => {
    expect(formatEmployeeId(pa, 'EMP', 1)).toBe('V5EMP001')
    expect(formatEmployeeId(pa, 'EMP', 2)).toBe('V5EMP002')
    expect(formatEmployeeId(pa, 'EMP', 3)).toBe('V5EMP003')
    expect(formatEmployeeId(pa, 'DL', 1)).toBe('V5DL001')
    expect(formatEmployeeId(pa, 'DL', 2)).toBe('V5DL002')
    expect(formatEmployeeId(pb, 'EMP', 1)).toBe('L12EMP001')
    expect(formatEmployeeId(pb, 'DL', 1)).toBe('L12DL001')
  })

  it('carries a Commerce namespace on the SAME prefix (§18)', () => {
    expect(formatEmployeeId(pa, 'COM', 1)).toBe('V5COM001')
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
    expect(parseEmployeeId('v5dl001')).toEqual({ prefix: 'V5', namespace: 'DL', sequence: 1 })
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
