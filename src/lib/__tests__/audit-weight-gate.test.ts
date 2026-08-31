import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrderItem: { findMany: vi.fn() },
    laundryOrder: { findUnique: vi.fn() },
  },
}))

import { checkAuditComplete } from '@/lib/laundry-audit'
import { prisma } from '@/lib/prisma'

const mItems = prisma.laundryOrderItem.findMany as ReturnType<typeof vi.fn>
const mOrder = prisma.laundryOrder.findUnique as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

/** n audited garments, each with the given own-weight. */
const audited = (n: number, weightKg = 0) =>
  Array.from({ length: n }, () => ({ id: 'i', inspectedAt: new Date(), weightKg }))

function setup(items: unknown[], totalWeightKg: number | null) {
  mItems.mockResolvedValue(items)
  mOrder.mockResolvedValue({ totalWeightKg })
}

describe('A · missing total weight blocks Audit → Payment', () => {
  it('10 garments, no total weight → blocked', async () => {
    setup(audited(10), 0)
    const v = await checkAuditComplete('o1', { requireWeight: true })
    expect(v.ok).toBe(false)
    expect(v.code).toBe('WEIGHT_REQUIRED')
    expect(v.message).toContain('total garment weight has not been captured')
  })

  it('a null total weight is treated as missing, not as zero-is-fine', async () => {
    setup(audited(3), null)
    expect((await checkAuditComplete('o1', { requireWeight: true })).ok).toBe(false)
  })

  it('a negative weight is not a weight', async () => {
    setup(audited(3), -1)
    expect((await checkAuditComplete('o1', { requireWeight: true })).ok).toBe(false)
  })
})

describe('B · a valid total weight lets the existing flow proceed', () => {
  it('10 garments, 4.80 kg → allowed', async () => {
    setup(audited(10), 4.8)
    const v = await checkAuditComplete('o1', { requireWeight: true })
    expect(v).toMatchObject({ ok: true, expected: 10, audited: 10, totalWeightKg: 4.8 })
  })

  it('any positive weight passes, however small', async () => {
    setup(audited(1), 0.01)
    expect((await checkAuditComplete('o1', { requireWeight: true })).ok).toBe(true)
  })
})

describe('C/D · per-KG and per-piece are treated the same for WEIGHT', () => {
  // The gate reads the ORDER's total, which is how both models record the load.
  // Pricing is untouched either way — see the pricing assertion below.
  it('per-KG: weight missing → blocked, present → allowed', async () => {
    setup(audited(4, 0), 0)
    expect((await checkAuditComplete('o1', { requireWeight: true })).ok).toBe(false)
    setup(audited(4, 1.2), 4.8)
    expect((await checkAuditComplete('o1', { requireWeight: true })).ok).toBe(true)
  })

  it('per-piece: weight missing → blocked, present → allowed', async () => {
    setup(audited(4, 0), 0)
    expect((await checkAuditComplete('o1', { requireWeight: true })).ok).toBe(false)
    setup(audited(4, 0), 3.5)   // garments carry no own weight; the load was weighed
    expect((await checkAuditComplete('o1', { requireWeight: true })).ok).toBe(true)
  })

  it('the gate never touches an amount — weight and price stay separate', () => {
    const gate = code('src/lib/laundry-audit.ts')
    for (const w of ['unitPrice', 'lineAmount', 'grandTotal', 'gstAmount', 'total:']) {
      expect(gate, `the audit gate must not reference ${w}`).not.toContain(w)
    }
  })
})

describe('E · partial garment weights with no order total are blocked, and named', () => {
  it('3 of 10 unweighed and no total → blocked, and says how many', async () => {
    setup([...audited(7, 1), ...audited(3, 0)], 0)
    const v = await checkAuditComplete('o1', { requireWeight: true })
    expect(v.ok).toBe(false)
    expect(v.code).toBe('WEIGHT_REQUIRED')
    expect(v.message).toContain('3 of 10 garments have no weight recorded')
    expect(v.garmentsWithoutWeight).toBe(3)
  })

  it('but a captured order total is authoritative — no per-garment re-entry', async () => {
    // 500 garments, none carrying its own weight, one weighed load.
    setup(audited(500, 0), 42.6)
    const v = await checkAuditComplete('o1', { requireWeight: true })
    expect(v.ok).toBe(true)
    expect(v.expected).toBe(500)
  })
})

describe('F/G · nothing else is affected', () => {
  it('identification still fails first, with its own code', async () => {
    setup([], 0)
    expect(await checkAuditComplete('o1', { requireWeight: true })).toMatchObject({ ok: false, code: 'AUDIT_INCOMPLETE' })
    setup([{ id: 'a', inspectedAt: null, weightKg: 0 }], 5)
    expect(await checkAuditComplete('o1', { requireWeight: true })).toMatchObject({ ok: false, code: 'AUDIT_INCOMPLETE' })
  })

  it('WITHOUT requireWeight the rule does not apply — packing is untouched', async () => {
    setup(audited(10), 0)
    expect((await checkAuditComplete('o1')).ok).toBe(true)
    expect((await checkAuditComplete('o1', {})).ok).toBe(true)
  })

  it('packing deliberately does not opt in, so in-flight orders cannot strand', () => {
    expect(code('src/app/api/laundry/orders/[id]/pack/route.ts')).toContain('checkAuditComplete(order.id)')
    expect(code('src/app/api/laundry/orders/[id]/pack/route.ts')).not.toContain('requireWeight')
  })
})

describe('the gate sits on the ONE transition, before any write', () => {
  const t = code('src/app/api/laundry/orders/[id]/transition/route.ts')

  it('both Audit → Payment paths opt in', () => {
    expect(t).toContain('checkAuditComplete(id, { requireWeight: true })')
    expect(code('src/app/api/laundry/orders/[id]/payment/route.ts')).toContain('checkAuditComplete(orderId, { requireWeight: true })')
  })

  it('it runs before the status update, the event and the OTP side effect', () => {
    const at = t.indexOf('checkAuditComplete')
    expect(at).toBeGreaterThan(-1)
    expect(at).toBeLessThan(t.indexOf('prisma.laundryOrder.update'))
    expect(at).toBeLessThan(t.indexOf('laundryOrderEvent.create'))
    expect(at).toBeLessThan(t.indexOf('ensureDeliveryVerification'))
  })

  it('a refusal returns 409 and writes nothing', () => {
    const branch = t.slice(t.indexOf('if (!audit.ok)'), t.indexOf('if (transition.internal)'))
    expect(branch).toContain('{ status: 409 }')
    for (const w of ['update', 'create', 'delete']) expect(branch, w).not.toContain(w)
  })

  it('the refusal carries the code and the figures the UI needs', () => {
    expect(t).toContain('code: audit.code')
    expect(t).toContain('totalWeightKg: audit.totalWeightKg')
    expect(t).toContain('garmentsWithoutWeight: audit.garmentsWithoutWeight')
  })
})

describe('the operator can actually satisfy the gate', () => {
  // RAW source here: these are JSX props and expressions, which a comment cannot
  // impersonate — and the block-comment stripper mis-pairs across {/* … */}.
  const ui = read('src/components/laundry/views/laundry-store-audit.tsx')

  it('every audited order shows a weight field, not only per-KG ones', () => {
    // A server rule the UI gives no way to satisfy is a stuck order.
    expect(ui).not.toContain('{hasKgItems && (')
    expect(ui).toContain('const needsWeight = orderWeightKg <= 0')
  })

  it('per-garment weights captured at intake count as the total', () => {
    expect(ui).toContain('const orderWeightKg = hasPerGarmentWeight ? (detail?.totalWeightKg ?? 0) : totalWeightKg')
  })

  it('the approve button and the pre-check use the same rule as the server', () => {
    // The weight gate still disables the button. It now shares that button with
    // the garment gate (an order with no garments can never be approved either),
    // so the assertion is on the weight term, not the whole expression.
    expect(ui).toMatch(/disabled=\{acting \|\| needsWeight\b/)
    expect(ui).toContain('toStatus === "PAYMENT_PENDING" && needsWeight')
  })

  it('a per-piece order is told the weight does not change its price', () => {
    expect(ui).toContain('does not change a per-piece price')
  })
})
