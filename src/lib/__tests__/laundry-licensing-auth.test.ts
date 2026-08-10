import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// GET and PUT /api/laundry/licensing must authenticate identically.
//
// They did not. PUT was guarded and GET was not, so reading a licence appeared
// to work for an unauthenticated caller while saving returned "Not
// authenticated" — which read as a save bug rather than a missing token, and
// meanwhile left every tenant's commercial entitlements publicly readable to
// anyone who knew the business id.
// ============================================================================

const mocks = vi.hoisted(() => ({
  requireLaundryPermission: vi.fn(),
  resolveLaundryBusiness: vi.fn(),
  licenceSnapshot: vi.fn(),
  saveLicence: vi.fn(),
}))

vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: mocks.requireLaundryPermission }))
vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: mocks.resolveLaundryBusiness }))
vi.mock('@/lib/laundry-licensing-server', () => ({
  licenceSnapshot: mocks.licenceSnapshot,
  saveLicence: mocks.saveLicence,
}))

import { GET, PUT } from '@/app/api/laundry/licensing/route'

const NOT_AUTH = { ok: false as const, res: new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 }) }
const OK = { ok: true as const, ctx: { userId: 'u-1', userName: 'Admin' }, platformBusinessId: 'pb-1' }

const getReq = (qs = 'businessId=biz-1') => new Request(`http://x/api/laundry/licensing?${qs}`)
const putReq = (body: unknown) => new Request('http://x/api/laundry/licensing', { method: 'PUT', body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveLaundryBusiness.mockResolvedValue({ id: 'lb-1' })
  mocks.licenceSnapshot.mockResolvedValue({ modules: [], enabledScreens: ['marketing.coupons'] })
  mocks.saveLicence.mockResolvedValue(undefined)
})

describe('both verbs are guarded', () => {
  it('GET refuses an unauthenticated caller', async () => {
    mocks.requireLaundryPermission.mockResolvedValue(NOT_AUTH)
    expect((await GET(getReq())).status).toBe(401)
    expect(mocks.licenceSnapshot).not.toHaveBeenCalled()
  })

  it('PUT refuses an unauthenticated caller', async () => {
    mocks.requireLaundryPermission.mockResolvedValue(NOT_AUTH)
    const res = await PUT(putReq({ businessId: 'biz-1', screenKeys: ['marketing.coupons'] }))
    expect(res.status).toBe(401)
    expect(mocks.saveLicence).not.toHaveBeenCalled()
  })

  it('uses the same guard for both, differing only in level', async () => {
    mocks.requireLaundryPermission.mockResolvedValue(OK)
    await GET(getReq())
    await PUT(putReq({ businessId: 'biz-1', screenKeys: [] }))
    const keys = mocks.requireLaundryPermission.mock.calls.map((c) => c[2])
    expect(keys).toEqual(['laundry.settings.view', 'laundry.settings.edit'])
  })
})

describe('an authenticated administrator', () => {
  beforeEach(() => mocks.requireLaundryPermission.mockResolvedValue(OK))

  it('reads the licence', async () => {
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    expect((await res.json()).data.enabledScreens).toContain('marketing.coupons')
  })

  it('saves the selection it was given', async () => {
    const res = await PUT(putReq({ businessId: 'biz-1', screenKeys: ['marketing.coupons'] }))
    expect(res.status).toBe(200)
    expect(mocks.saveLicence).toHaveBeenCalledWith('lb-1', ['marketing.coupons'])
  })

  // The client re-seeds its checkboxes from this, so a save must answer with
  // what was persisted rather than an echo of the request.
  it('returns the persisted snapshot so the UI cannot drift from the database', async () => {
    const res = await PUT(putReq({ businessId: 'biz-1', screenKeys: ['marketing.coupons'] }))
    expect((await res.json()).data.enabledScreens).toEqual(['marketing.coupons'])
    expect(mocks.licenceSnapshot).toHaveBeenCalledWith('lb-1')
  })
})

describe('input validation happens before any work', () => {
  it('GET requires a businessId', async () => {
    expect((await GET(getReq(''))).status).toBe(400)
    expect(mocks.requireLaundryPermission).not.toHaveBeenCalled()
  })

  it('PUT requires a screenKeys array', async () => {
    const res = await PUT(putReq({ businessId: 'biz-1' }))
    expect(res.status).toBe(400)
    expect(mocks.saveLicence).not.toHaveBeenCalled()
  })
})
