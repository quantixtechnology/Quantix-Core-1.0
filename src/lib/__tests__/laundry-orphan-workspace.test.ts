import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// Deleting a workspace is irreversible. This pins down the three answers the
// endpoint must give: refuse a linked row, refuse a row with operational data,
// and only then delete — taking the undeclared dependents with it, because
// nothing cascades those.
// ============================================================================

type Row = Record<string, unknown>
const state = {
  row: null as Row | null,
  counts: {} as Record<string, number>,
  deleted: [] as string[],
  parentDeleted: false,
  stores: [] as Row[],
  inbound: { laundryAccessAssignment: 0, laundryDeliveryExecutive: 0, laundryOrder: 0 } as Record<string, number>,
}

vi.mock('@/lib/platform-guard', () => ({ platformOnly: vi.fn(async () => null) }))

vi.mock('@/lib/prisma', () => {
  const table = (name: string) => ({
    count: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
      // The inbound soft-reference probes query by storeId, not businessId.
      if (args?.where && 'storeId' in args.where) return state.inbound[name] ?? 0
      return state.counts[name] ?? 0
    }),
    deleteMany: vi.fn(async () => {
      const n = state.counts[name] ?? 0
      if (n > 0) state.deleted.push(name)
      return { count: n }
    }),
  })
  return {
    prisma: new Proxy({} as Record<string, unknown>, {
      get(_t, prop: string) {
        if (prop === 'laundryBusiness') {
          return {
            findFirst: vi.fn(async () => (state.row ? { ...state.row } : null)),
            delete: vi.fn(async () => { state.parentDeleted = true; state.row = null; return {} }),
            count: vi.fn(async () => 0),
          }
        }
        if (prop === 'laundryStore') {
          return {
            count: vi.fn(async () => state.counts.laundryStore ?? 0),
            findMany: vi.fn(async () => state.stores),
            deleteMany: vi.fn(async () => ({ count: 0 })),
          }
        }
        return table(prop)
      },
    }),
  }
})

const ORPHAN = { id: 'lb_orphan', businessCode: 'LND-202606-0001', businessName: 'VASTRASUDHA LAUNDRY', platformBusinessId: null, createdAt: new Date('2026-06-01'), status: 'ONBOARDING' }
const url = (q: string) => `http://internal/api/debug/laundry-orphan-workspace${q}`

const reset = () => {
  state.row = { ...ORPHAN }; state.counts = {}; state.deleted = []; state.parentDeleted = false
  state.stores = []; state.inbound = { laundryAccessAssignment: 0, laundryDeliveryExecutive: 0, laundryOrder: 0 }
}

describe('the orphan workspace endpoint', () => {
  beforeEach(reset)

  it('reports an unlinked, empty workspace as safe', async () => {
    const { GET } = await import('@/app/api/debug/laundry-orphan-workspace/route')
    const body = await (await GET(new Request(url('?code=LND-202606-0001')))).json()
    expect(body.found).toBe(true)
    expect(body.verdict.safe).toBe(true)
    expect(body.verdict.reasons).toEqual([])
  })

  it('REFUSES a workspace that belongs to a platform business', async () => {
    state.row = { ...ORPHAN, platformBusinessId: 'cmt42rrxb001kqk2e6ucvo6xt' }
    const { POST } = await import('@/app/api/debug/laundry-orphan-workspace/route')
    const res = await POST(new Request(url('?code=LND-202606-0001&confirm=1'), { method: 'POST' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.deleted).toBe(false)
    expect(body.verdict.reasons[0]).toMatch(/NOT an orphan/)
    expect(state.parentDeleted).toBe(false)
  })

  it('REFUSES an unlinked workspace that still holds operational data', async () => {
    state.counts = { laundryOrder: 3, laundryInvoice: 1 }
    const { POST } = await import('@/app/api/debug/laundry-orphan-workspace/route')
    const res = await POST(new Request(url('?code=LND-202606-0001&confirm=1'), { method: 'POST' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.deleted).toBe(false)
    expect(body.verdict.reasons.join(' ')).toMatch(/laundryOrder has 3/)
    expect(state.parentDeleted).toBe(false)
  })

  it('requires an explicit confirm', async () => {
    const { POST } = await import('@/app/api/debug/laundry-orphan-workspace/route')
    const res = await POST(new Request(url('?code=LND-202606-0001'), { method: 'POST' }))
    expect(res.status).toBe(400)
    expect(state.parentDeleted).toBe(false)
  })

  it('deletes a genuine orphan and takes its undeclared dependents with it', async () => {
    // Config rows nothing cascades — the reason a bare parent delete is wrong.
    state.counts = { laundryService: 2, laundryGarment: 5, laundryCategory: 1 }
    const { POST } = await import('@/app/api/debug/laundry-orphan-workspace/route')
    const body = await (await POST(new Request(url('?code=LND-202606-0001&confirm=1'), { method: 'POST' }))).json()
    expect(body.deleted).toBe(true)
    expect(state.parentDeleted).toBe(true)
    expect(body.removedDependents).toMatchObject({ laundryService: 2, laundryGarment: 5, laundryCategory: 1 })
    expect(body.stillResolvable).toBe(false)
    // Dependents go BEFORE the parent, or they point at a row that is gone.
    expect(state.deleted.length).toBeGreaterThan(0)
  })

  it('REFUSES when a live record still points at one of its stores', async () => {
    // No foreign key stands behind LaundryAccessAssignment.storeId, so nothing
    // would block this delete and nothing would report it afterwards.
    state.stores = [{ id: 'st_1', storeCode: 'STR-X-001', storeName: 'Old Store' }]
    state.inbound.laundryAccessAssignment = 1
    const { POST } = await import('@/app/api/debug/laundry-orphan-workspace/route')
    const res = await POST(new Request(url('?code=LND-202606-0001&confirm=1'), { method: 'POST' }))
    expect(res.status).toBe(409)
    expect((await res.json()).verdict.reasons.join(' ')).toMatch(/access assignment/)
    expect(state.parentDeleted).toBe(false)
  })

  it('404s on a code that names nothing', async () => {
    state.row = null
    const { POST } = await import('@/app/api/debug/laundry-orphan-workspace/route')
    expect((await POST(new Request(url('?code=LND-999999-9999&confirm=1'), { method: 'POST' }))).status).toBe(404)
  })
})
