import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Subscription eligibility must be REVERSIBLE on a garment.
//
// Coverage is an AND — LaundryService.subscriptionEligible AND
// LaundryGarment.subscriptionIncluded. The service half has always been
// editable; the garment half had its control removed from Garment Details, so a
// garment sitting at the schema default (false) could never be included again
// except through a bulk Excel import. "Not Included" was effectively permanent.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const state = { garment: null as Record<string, unknown> | null, updates: [] as Record<string, unknown>[] }

vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: vi.fn(async () => ({ id: 'lb1', platformBusinessId: 'pb1' })) }))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: vi.fn(async () => ({ ok: true, platformBusinessId: 'pb1', ctx: { laundryBusinessId: 'lb1' } })) }))
vi.mock('@/lib/laundry-pricing-matrix', () => ({ saveGarmentCells: vi.fn(async () => {}) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryGarment: {
      findFirst: vi.fn(async () => (state.garment ? { ...state.garment } : null)),
      update: vi.fn(async ({ data }: never) => {
        state.updates.push(data as Record<string, unknown>)
        Object.assign(state.garment!, data as Record<string, unknown>)
        return { ...state.garment }
      }),
    },
    laundryService: { findMany: vi.fn(async () => []) },
  },
}))

const GARMENT = {
  id: 'g_sofa', name: 'Sofa Cover', code: 'GAR00042', categoryId: 'cat_home',
  averageWeight: 1.2, subscriptionIncluded: false,
}
const reset = () => { state.garment = { ...GARMENT }; state.updates = [] }

const put = async (body: Record<string, unknown>) => {
  const { PUT } = await import('@/app/api/laundry/garments/[id]/pricing/route')
  const res = await PUT(
    new Request('http://internal/x', { method: 'PUT', body: JSON.stringify({ businessId: 'pb1', ...body }) }),
    { params: Promise.resolve({ id: 'g_sofa' }) },
  )
  return { status: res.status, body: await res.json() }
}

describe('a garment can be moved into and out of subscription', () => {
  beforeEach(reset)

  it('Not Included → Included persists', async () => {
    expect(state.garment!.subscriptionIncluded).toBe(false)
    const { status } = await put({ subscriptionIncluded: true, cells: [] })
    expect(status).toBe(200)
    expect(state.garment!.subscriptionIncluded).toBe(true)
  })

  it('Included → Not Included persists — false is a value, not "unset"', async () => {
    state.garment!.subscriptionIncluded = true
    const { status } = await put({ subscriptionIncluded: false, cells: [] })
    expect(status).toBe(200)
    expect(state.garment!.subscriptionIncluded).toBe(false)
  })

  it('round-trips repeatedly in both directions', async () => {
    for (const want of [true, false, true, false, true]) {
      await put({ subscriptionIncluded: want, cells: [] })
      expect(state.garment!.subscriptionIncluded).toBe(want)
    }
  })

  it('omitting the field leaves the current value alone', async () => {
    state.garment!.subscriptionIncluded = true
    await put({ averageWeight: 2, cells: [] })
    expect(state.garment!.subscriptionIncluded).toBe(true)
    for (const u of state.updates) expect(u).not.toHaveProperty('subscriptionIncluded')
  })

  it('the code, name and category are never written by this change', async () => {
    await put({ subscriptionIncluded: true, cells: [] })
    for (const u of state.updates) {
      expect(u).not.toHaveProperty('code')
      expect(u).not.toHaveProperty('name')
    }
    expect(state.garment!.code).toBe('GAR00042')
    expect(state.garment!.name).toBe('Sofa Cover')
    expect(state.garment!.categoryId).toBe('cat_home')
  })

  it('toggling subscription alone does not disturb pricing', async () => {
    const { saveGarmentCells } = await import('@/lib/laundry-pricing-matrix')
    await put({ subscriptionIncluded: true, cells: [] })
    // Called with an empty cell set — no rule is created, changed or removed.
    expect(saveGarmentCells).toHaveBeenCalled()
    const cells = (saveGarmentCells as ReturnType<typeof vi.fn>).mock.calls.at(-1)![3]
    expect(cells).toEqual([])
  })
})

describe('the surfaces read and write the canonical field', () => {
  const UI = read('src/components/laundry/views/laundry-pricing-matrix.tsx')
  const MATRIX_API = read('src/app/api/laundry/pricing-matrix/route.ts')
  const CREATE_API = read('src/app/api/laundry/garments/route.ts')

  it('Garment Details offers BOTH states, so the choice is reversible', () => {
    expect(UI).toContain('Include in Subscription')
    expect(UI).toContain('Not Included in Subscription')
    expect(UI).toContain('setSubIncluded(true)')
    expect(UI).toContain('setSubIncluded(false)')
    // The note that said it could not be set here is gone.
    expect(UI).not.toContain('Subscription eligibility is configured per service in Services → Edit Service.')
  })

  it('the editor seeds from the server value and sends it back on save', () => {
    expect(UI).toContain('useState(!!row?.subscriptionIncluded)')
    expect(UI).toContain('subscriptionIncluded: subIncluded')
  })

  it('the matrix shows each garment its own state, read from the server', () => {
    expect(MATRIX_API).toContain('subscriptionIncluded: g.subscriptionIncluded')
    expect(UI).toContain('Subscription: {g.subscriptionIncluded ? "Included" : "Not included"}')
  })

  it('a NEW garment can be created already included', () => {
    expect(CREATE_API).toContain('subscriptionIncluded: !!subscriptionIncluded')
  })

  it('no second subscription flag was invented', () => {
    const SCHEMA = read('prisma/schema.prisma')
    const model = SCHEMA.slice(SCHEMA.indexOf('model LaundryGarment {'), SCHEMA.indexOf('\n}', SCHEMA.indexOf('model LaundryGarment {')))
    expect(model.match(/subscription/gi) || []).toHaveLength(2)   // the comment + the one field
    // Coverage is still the AND over service AND garment — unchanged.
    const SERVER = read('src/lib/laundry-subscription-server.ts')
    expect(SERVER).toContain('subscriptionEligible: true')
    expect(SERVER).toContain('subscriptionIncluded: true')
  })
})
