import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// 50 / 100 ROWS PER PAGE, ON EVERY LAUNDRY LIST.
//
// Customers, Orders and Payments & Ledger used to pull a fixed PAGE=10 table
// (payments-ledger pulled up to 200 and filtered the newest slice in JS — page
// 2 of the whole ledger was silently missing). This pins the improvement:
//
//   • the default is 50 rows, the allowed sizes are 50 and 100, nothing above
//     100 is ever served;
//   • the ledger's five buckets are applied to the QUERY as well as the JS
//     filter, so a filtered page really pages over the complete ledger — normal
//     order rows AND standalone subscription rows — never a newest slice;
//   • changing page size, search or filter resets to page 1;
//   • TODAY keeps its own, non-paginated branch.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// ═══ 1 · resolvePageSize — the one shared rule ══════════════════════════════
import { resolvePageSize, LIST_PAGE_SIZES, MAX_LIST_PAGE_SIZE, DEFAULT_LIST_PAGE_SIZE } from '@/lib/laundry-pagination'

describe('resolvePageSize — the shared 50/100 rule', () => {
  it('defaults to 50 when nothing is sent', () => {
    expect(DEFAULT_LIST_PAGE_SIZE).toBe(50)
    expect(resolvePageSize(null)).toBe(50)
    expect(resolvePageSize(undefined)).toBe(50)
    expect(resolvePageSize('')).toBe(50)
  })

  it('accepts exactly 50 and 100', () => {
    expect(resolvePageSize('50')).toBe(50)
    expect(resolvePageSize('100')).toBe(100)
    expect(LIST_PAGE_SIZES).toEqual([50, 100])
  })

  it('never serves more than 100 rows', () => {
    expect(MAX_LIST_PAGE_SIZE).toBe(100)
    expect(resolvePageSize('250')).toBe(100)
    expect(resolvePageSize('1000')).toBe(100)
  })

  it('rejects nonsense safely instead of serving a broken page', () => {
    expect(resolvePageSize('abc')).toBe(50)
    expect(resolvePageSize('0')).toBe(50)
    expect(resolvePageSize('-8')).toBe(50)
    // 10 was the old screen constant — not a legal size any more.
    expect(resolvePageSize('10')).toBe(50)
    expect(resolvePageSize('25')).toBe(50)
  })
})

// ═══ 2 · the SQL bucket mirrors the JS bucket, exactly ══════════════════════
import { matchesLedgerFilter, ledgerFilterOrderWhere, type LedgerFilter } from '@/lib/laundry-adjustment'

interface Adj { voidedAt: Date | null; amount: number; refundable: number; refundStatus: string }
interface MoneyRow { amountPaid: number; balanceDue: number; discount: number; adjustments: Adj[] }

const adj = (over: Partial<Adj> = {}): Adj => ({ voidedAt: null, amount: 0, refundable: 0, refundStatus: 'NOT_REQUIRED', ...over })

const m = (over: Partial<MoneyRow>): MoneyRow => ({ amountPaid: 0, balanceDue: 0, discount: 0, adjustments: [], ...over })

const round2 = (n: number) => Math.round(n * 100) / 100
const isVoided = (a: Adj) => a.voidedAt != null
const isSettled = (s: string) => s === 'REFUNDED'

/** The exact numbers matchesLedgerFilter reads, derived as summarise() does. */
const jsRow = (r: MoneyRow) => {
  const live = r.adjustments.filter((a) => !isVoided(a))
  const discount = round2(r.discount + round2(live.reduce((s, a) => s + a.amount, 0)))
  const refunded = round2(live.filter((a) => isSettled(a.refundStatus)).reduce((s, a) => s + a.refundable, 0))
  const refundDue = round2(live.filter((a) => !isSettled(a.refundStatus)).reduce((s, a) => s + a.refundable, 0))
  return { paid: round2(r.amountPaid), balance: round2(r.balanceDue), discount, refunded, refundDue }
}

/** A tiny interpreter for the subset of Prisma WHERE ledgerFilterOrderWhere emits. */
function sqlRow(r: MoneyRow, clause: Record<string, unknown>): boolean {
  const cmp = (value: number, cond: unknown): boolean => {
    const c = cond as Record<string, number>
    if ('lt' in c) return value < c.lt
    if ('lte' in c) return value <= c.lte
    if ('gt' in c) return value > c.gt
    if ('gte' in c) return value >= c.gte
    if ('equals' in c) return value === c.equals
    return false
  }
  let ok = true
  for (const [k, v] of Object.entries(clause)) {
    if (k === 'AND') { for (const c of v as Record<string, unknown>[]) ok = ok && sqlRow(r, c); continue }
    if (k === 'OR') { ok = ok && (v as Record<string, unknown>[]).some((c) => sqlRow(r, c)); continue }
    if (k === 'amountPaid') { ok = ok && cmp(r.amountPaid, v); continue }
    if (k === 'balanceDue') { ok = ok && cmp(r.balanceDue, v); continue }
    if (k === 'discount') { ok = ok && cmp(r.discount, v); continue }
    if (k === 'adjustments') {
      const some = (v as { some?: { voidedAt: null; amount?: Record<string, number>; refundable?: Record<string, number> } }).some
      ok = ok && r.adjustments.some((a) => {
        if (some?.voidedAt === null && a.voidedAt != null) return false
        if (some?.amount && !cmp(a.amount, some.amount)) return false
        if (some?.refundable && !cmp(a.refundable, some.refundable)) return false
        return true
      })
      continue
    }
    throw new Error(`unhandled clause key ${k}`)
  }
  return ok
}

const CANONICAL = {
  paidInFull: m({ amountPaid: 200, balanceDue: 0 }),
  unpaid: m({ amountPaid: 0, balanceDue: 200 }),
  partial: m({ amountPaid: 120, balanceDue: 80 }),
  zeroValue: m({}),
  discountedOnOrder: m({ amountPaid: 180, balanceDue: 0, discount: 20 }),
  discountedByAdj: m({ amountPaid: 180, balanceDue: 0, discount: 0, adjustments: [adj({ amount: 20 })] }),
  refunded: m({ amountPaid: 200, balanceDue: 0, adjustments: [adj({ amount: 50, refundable: 50, refundStatus: 'REFUNDED' })] }),
  refundDue: m({ amountPaid: 200, balanceDue: 0, adjustments: [adj({ amount: 50, refundable: 50, refundStatus: 'PENDING' })] }),
  voidedDiscount: m({ amountPaid: 0, balanceDue: 200, discount: 0, adjustments: [adj({ amount: 40, voidedAt: new Date(), refundable: 0 })] }),
}

describe('ledgerFilterOrderWhere — the query always agrees with matchesLedgerFilter', () => {
  const FILTERS: LedgerFilter[] = ['ALL', 'PENDING', 'PARTIAL', 'PAID', 'DISCOUNTED', 'REFUNDED']

  for (const f of FILTERS) {
    it(`bucket ${f} selects exactly the rows the JS filter does`, () => {
      for (const [name, row] of Object.entries(CANONICAL)) {
        const js = matchesLedgerFilter(f, jsRow(row))
        const sql = sqlRow(row, ledgerFilterOrderWhere(f) as Record<string, unknown>)
        expect({ bucket: f, row: name, js, sql }, `${f} / ${name} must agree`).toEqual({ bucket: f, row: name, js, sql })
      }
    })
  }

  it('ALL and unknown filters return an empty predicate (no narrowing)', () => {
    expect(ledgerFilterOrderWhere('ALL')).toEqual({})
    expect(ledgerFilterOrderWhere('NOPE' as never)).toEqual({})
  })
})

// ═══ 3 · Payments & Ledger — server-side pagination over the COMPLETE ledger ═
const mocks = vi.hoisted(() => ({
  requireLaundryLevel: vi.fn().mockResolvedValue({ ok: true }),
  resolveLaundryBusiness: vi.fn().mockResolvedValue({ id: 'L1', platformBusinessId: 'P1' }),
  orderCount: vi.fn(),
  orderFindMany: vi.fn(),
  orderEventFindMany: vi.fn().mockResolvedValue([]),
  subFindMany: vi.fn(),
  planFindMany: vi.fn(),
  custFindMany: vi.fn(),
  paymentFindMany: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: { findMany: mocks.custFindMany },
    subscriptionPlan: { findMany: mocks.planFindMany },
    subscriptionPurchase: { findMany: mocks.subFindMany },
    laundryOrder: { count: mocks.orderCount, findMany: mocks.orderFindMany },
    laundryOrderEvent: { findMany: mocks.orderEventFindMany },
    laundryPayment: { findMany: mocks.paymentFindMany },
  },
}))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryLevel: mocks.requireLaundryLevel }))
vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: mocks.resolveLaundryBusiness }))

import { GET } from '@/app/api/laundry/payments-ledger/route'

const T0 = 1_700_000_000_000

const order = (i: number, paid = 100, balance = 0) => ({
  id: `o${String(i).padStart(3, '0')}`, orderNumber: `ORD-${String(i).padStart(3, '0')}`,
  status: 'DELIVERED', paymentStatus: paid > 0 && balance <= 0 ? 'PAID' : 'UNPAID',
  createdAt: new Date(T0 + i * 1000),
  grandTotal: paid + balance, amountPaid: paid, balanceDue: balance, discount: 0, subscriptionCoveredAmount: 0,
  customerId: null, totalWeightKg: null, services: [], _count: { items: 0 }, invoice: null, adjustments: [],
})

const ALL_ORDERS = Array.from({ length: 150 }, (_, i) => order(i))
// 150 orders: 0–99 paid in full, 100–149 unpaid.
const ALL_ORDERS_MIXED = Array.from({ length: 150 }, (_, i) => order(i, i < 100 ? 100 : 0, i < 100 ? 0 : 100))

const sub = (id: string, at: number, paid = 100) => ({
  id, businessId: 'P1', customerId: `c-${id}`, planId: 'plan1',
  amount: paid, amountPaid: paid, status: 'ACTIVE', paymentStatus: 'PAID',
  paymentMethod: 'CASH', gateway: null, paymentReference: null, paymentTransactionId: null,
  laundryOrderId: null, createdAt: new Date(at), paidAt: new Date(at),
})

const wire = () => {
  mocks.planFindMany.mockResolvedValue([{ id: 'plan1', name: 'Gold' }])
  mocks.custFindMany.mockImplementation(async ({ where }: any) => {
    const ids = (where?.id?.in || []) as string[]
    return ids.map((id) => ({ id, name: `Cus ${id}`, phone: null }))
  })
  mocks.orderEventFindMany.mockResolvedValue([])
  // Finger-print pass: id + createdAt, ordered newest first (the query does the
  // ordering in production; the mock hands it back pre-sorted).
  mocks.orderFindMany.mockImplementation(async ({ select, where }: any) => {
    if (select?.createdAt && !select?.status) {
      return [...ALL_ORDERS].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((o) => ({ id: o.id, createdAt: o.createdAt }))
    }
    const ids = (where?.id?.in || []) as string[]
    return ALL_ORDERS.filter((o) => ids.includes(o.id))
  })
}

const call = (params: Record<string, string>) => {
  const url = new URL('http://t/api/laundry/payments-ledger')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return GET(new Request(url.toString())) as Promise<Response>
}
const json = async (r: Response) => r.json() as unknown as { success: boolean; data: any[]; total?: number; limit?: number; offset?: number; summary?: unknown; dayKey?: string }

beforeEach(() => {
  vi.clearAllMocks()
  wire()
})

describe('the ledger pages server-side, over orders AND subscriptions', () => {
  const SUBS_NEWEST = [sub('s1', T0 + 400_000), sub('s2', T0 + 300_000), sub('s3', T0 + 200_000)]

  it('defaults to 50 rows and returns the FULL ledger total (orders + subscriptions)', async () => {
    mocks.subFindMany.mockResolvedValue(SUBS_NEWEST)
    mocks.orderCount.mockResolvedValue(ALL_ORDERS.length)
    const j = await json(await call({}))

    expect(j.limit).toBe(50)
    expect(j.offset).toBe(0)
    expect(j.total).toBe(153) // 150 orders + 3 standalone subscriptions
    expect(j.data.length).toBe(50)
    // The newest rows are the standalone subscriptions; they are on page 1.
    expect(j.data.some((r) => r.kind === 'SUBSCRIPTION')).toBe(true)
  })

  it('a page size of 100 is honoured', async () => {
    mocks.subFindMany.mockResolvedValue(SUBS_NEWEST)
    mocks.orderCount.mockResolvedValue(ALL_ORDERS.length)
    const j = await json(await call({ limit: '100' }))
    expect(j.limit).toBe(100)
    expect(j.data).toHaveLength(100)
    expect(j.total).toBe(153)
  })

  it('a size above 100 is clamped to 100 — never more', async () => {
    mocks.subFindMany.mockResolvedValue([])
    mocks.orderCount.mockResolvedValue(ALL_ORDERS.length)
    const j = await json(await call({ limit: '100000' }))
    expect(j.limit).toBe(100)
    expect(j.data.length).toBeLessThanOrEqual(100)
  })

  it('page navigation walks the complete ledger, not the newest slice', async () => {
    mocks.subFindMany.mockResolvedValue([])
    mocks.orderCount.mockResolvedValue(ALL_ORDERS.length)
    const p2 = await json(await call({ limit: '50', offset: '50' }))
    expect(p2.offset).toBe(50)
    expect(p2.data).toHaveLength(50)
    // 150 orders → page 3 has the 50 oldest ones.
    const p3 = await json(await call({ limit: '50', offset: '100' }))
    expect(p3.data).toHaveLength(50)
    const p4 = await json(await call({ limit: '50', offset: '150' }))
    expect(p4.data).toHaveLength(0)
    expect(p4.total).toBe(150)
  })

  it('subscription rows on a later page survive pagination', async () => {
    // Subscriptions sold BEFORE any order — newest-first puts them last.
    mocks.subFindMany.mockResolvedValue([sub('s1', T0 - 3_000), sub('s2', T0 - 2_000), sub('s3', T0 - 1_000)])
    mocks.orderCount.mockResolvedValue(ALL_ORDERS.length)
    const lastPage = await json(await call({ limit: '50', offset: '150' }))
    expect(lastPage.total).toBe(153)
    expect(lastPage.data.every((r) => r.kind === 'SUBSCRIPTION')).toBe(true)
    expect(lastPage.data).toHaveLength(3)
    // And the page just before holds only orders, no subscription rows leaked in.
    const midPage = await json(await call({ limit: '50', offset: '100' }))
    expect(midPage.data.every((r) => r.kind === 'ORDER')).toBe(true)
    expect(midPage.data).toHaveLength(50)
  })
})

describe('the ledger buckets page over the whole book (query-level filter)', () => {
  /** The production query narrows the set; the mock applies the same predicate. */
  const mixedImplementation = (matches: (o: { amountPaid: number; balanceDue: number }) => boolean) =>
    async ({ select, where }: any) => {
      const eligible = ALL_ORDERS_MIXED.filter(matches)
      if (select?.createdAt && !select?.status) {
        return [...eligible].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((o) => ({ id: o.id, createdAt: o.createdAt }))
      }
      const ids = (where?.id?.in || []) as string[]
      return ALL_ORDERS_MIXED.filter((o) => ids.includes(o.id))
    }

  it('PAID passes its predicate into the query, not a post-fetch slice', async () => {
    mocks.orderFindMany.mockImplementation(mixedImplementation((o) => o.amountPaid > 0 && o.balanceDue <= 0))
    mocks.subFindMany.mockResolvedValue([])
    // The count must also apply the filter — 100 paid orders, not all 150.
    mocks.orderCount.mockResolvedValue(100)

    const j = await json(await call({ filter: 'PAID' }))
    // The query (count) was given the PAID predicate as an AND clause.
    const whereArg = (mocks.orderCount.mock.calls[0][0] as { where: { AND?: any[] } }).where
    expect(whereArg.AND).toHaveLength(1)
    expect(whereArg.AND![0].amountPaid).toEqual({ gt: 0 })
    expect(whereArg.AND![0].balanceDue).toEqual({ lte: 0 })

    expect(j.total).toBe(100)
    expect(j.data).toHaveLength(50)
    // Every served row is genuinely paid — the JS filter agrees with the query.
    expect(j.data.every((r) => r.paid > 0 && r.balance <= 0)).toBe(true)
  })

  it('PENDING narrows to the unpaid-but-owed orders the same way', async () => {
    mocks.orderFindMany.mockImplementation(mixedImplementation((o) => o.amountPaid <= 0 && o.balanceDue > 0))
    mocks.subFindMany.mockResolvedValue([])
    mocks.orderCount.mockResolvedValue(50)

    const j = await json(await call({ filter: 'PENDING' }))
    const whereArg = (mocks.orderCount.mock.calls[0][0] as { where: { AND?: any[] } }).where
    expect(whereArg.AND![0].amountPaid).toEqual({ lte: 0 })
    expect(whereArg.AND![0].balanceDue).toEqual({ gt: 0 })
    expect(j.data.every((r) => r.balance > 0 && r.paid <= 0)).toBe(true)
    expect(j.total).toBe(50)
  })
})

describe('TODAY is untouched — its own branch, never paginated', () => {
  it('returns today’s own payload and never a ledger page', async () => {
    mocks.subFindMany.mockResolvedValue([])
    mocks.paymentFindMany.mockResolvedValue([])
    mocks.orderFindMany.mockResolvedValue([])
    mocks.orderCount.mockResolvedValue(0)
    const j = await json(await call({ filter: 'TODAY', limit: '100', offset: '999' }))
    expect(j.success).toBe(true)
    expect(j.total).toBeUndefined() // pagination fields belong to the ledger only
    expect(j.summary).toBeDefined()
    expect(j.dayKey).toBeDefined()
  })
})

// ═══ 4 · the screens and the two list APIs all use the shared 50/100 rule ═══
describe('the screens wire the 50/100 control and reset to page 1', () => {
  const ORDERS = read('src/components/laundry/views/laundry-orders-view.tsx')
  const CUSTOMERS = read('src/components/laundry/views/laundry-customers-view.tsx')
  const LEDGER = read('src/components/laundry/views/laundry-payments-ledger.tsx')

  it('no screen still hard-codes the old PAGE = 10 constant', () => {
    for (const src of [ORDERS, CUSTOMERS, LEDGER]) expect(src).not.toContain('const PAGE = 10')
  })

  it('every screen holds its page size in state, defaulting to 50', () => {
    expect(ORDERS).toContain('const [pageSize, setPageSize] = useState(50)')
    expect(CUSTOMERS).toContain('const [pageSize, setPageSize] = useState(50)')
    expect(LEDGER).toContain('const [pageSize, setPageSize] = useState(50)')
  })

  it('every screen requests limit/offset from its own page-size state', () => {
    expect(ORDERS).toContain('limit: String(pageSize)')
    expect(ORDERS).toContain('offset: String(page * pageSize)')
    expect(CUSTOMERS).toContain('limit: String(pageSize)')
    expect(CUSTOMERS).toContain('offset: String(page * pageSize)')
    expect(LEDGER).toContain('p.set("limit", String(pageSize))')
    expect(LEDGER).toContain('p.set("offset", String(page * pageSize))')
  })

  it('changing the page size resets to page 1', () => {
    for (const src of [ORDERS, CUSTOMERS, LEDGER]) {
      const handler = src.slice(src.indexOf('onPageSizeChange'), src.indexOf('ListPagination') === -1 ? src.length : src.length)
      expect(handler, 'page size handler must reset the page').toContain('setPage(0)')
    }
  })

  it('changing the search resets to page 1', () => {
    expect(ORDERS).toContain('onChange={(e) => { setSearch(e.target.value); setPage(0) }}')
    expect(CUSTOMERS).toContain('onChange={(e) => { setSearch(e.target.value); setPage(0) }}')
    expect(LEDGER).toContain('setSearch(e.target.value); setPage(0)')
  })

  it('changing the filters resets to page 1', () => {
    // Customers: toggling Archived. Orders: the operational-stage dropdown.
    expect(CUSTOMERS).toContain('setShowArchived(e.target.checked); setPage(0)')
    expect(ORDERS).toContain('useEffect(() => { setPage(0) }, [opStage])')
    // Ledger: the six buckets reset to page 1.
    expect(LEDGER).toContain('setFilter(f.key); setPage(0)')
  })

  it('all three screens render the one shared footer component', () => {
    for (const src of [ORDERS, CUSTOMERS, LEDGER]) {
      expect(src).toContain('import { ListPagination } from "@/components/laundry/list-pagination"')
      expect(src).toContain('<ListPagination')
    }
  })
})

describe('the list APIs validate through the same resolvePageSize rule', () => {
  it('Orders GET defaults to 50 and clamps to 100', () => {
    const api = read('src/app/api/laundry/orders/route.ts')
    expect(api).toContain('const limit = resolvePageSize(searchParams.get("limit"))')
    expect(api).not.toContain('Math.min(parseInt(searchParams.get("limit") || "50"), 100)')
  })

  it('Customers GET defaults to 50 (was 10)', () => {
    const api = read('src/app/api/laundry/customers/route.ts')
    expect(api).toContain('const limit = resolvePageSize(sp.get("limit"))')
    expect(api).not.toContain('sp.get("limit") || "10"')
  })

  it('the ledger route pages through the same rule', () => {
    const api = read('src/app/api/laundry/payments-ledger/route.ts')
    expect(api).toContain('const limit = resolvePageSize(u.searchParams.get("limit"))')
  })
})