import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// The save/load lifecycle, end to end through the storage layer:
//
//   selection -> saveLicence -> rows -> resolveLicence -> enabledScreens
//
// The pure rules are covered elsewhere. What this pins is persistence, which
// is where a checkbox silently loses its value between one page load and the
// next — and where the legacy uppercase entitlement keys collide with the new
// lowercase module keys.
// ============================================================================

/** An in-memory stand-in for LaundryBusinessFeature with real upsert semantics. */
const store = new Map<string, boolean>()
const key = (businessId: string, featureKey: string) => `${businessId}::${featureKey}`

const mocks = vi.hoisted(() => ({ resolveLaundryBusiness: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryBusinessFeature: {
      findMany: async ({ where }: { where: { businessId: string } }) =>
        [...store.entries()]
          .filter(([k]) => k.startsWith(`${where.businessId}::`))
          .map(([k, enabled]) => ({ featureKey: k.split('::')[1], enabled })),
      upsert: async ({ where, update, create }: {
        where: { businessId_featureKey: { businessId: string; featureKey: string } }
        update: { enabled: boolean }; create: { businessId: string; featureKey: string; enabled: boolean }
      }) => {
        const k = key(where.businessId_featureKey.businessId, where.businessId_featureKey.featureKey)
        store.set(k, store.has(k) ? update.enabled : create.enabled)
        return {}
      },
    },
    // saveLicence hands an array of promises; the real client executes them.
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}))
vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: mocks.resolveLaundryBusiness }))

import { saveLicence, resolveLicence, licenceSnapshot } from '@/lib/laundry-licensing-server'

const BIZ = 'lb-1'
const seed = (featureKey: string, enabled: boolean) => store.set(key(BIZ, featureKey), enabled)

beforeEach(() => {
  store.clear()
  vi.clearAllMocks()
  mocks.resolveLaundryBusiness.mockResolvedValue({ id: BIZ })
})

describe('a saved selection survives a reload', () => {
  it('keeps a single child feature selected — the reported Marketing → Coupons case', async () => {
    await saveLicence(BIZ, ['marketing.coupons'])
    const licence = await resolveLicence(BIZ)
    expect(licence.isScreenEnabled('marketing.coupons')).toBe(true)
    expect(licence.isScreenEnabled('marketing.discounts')).toBe(false)
  })

  it('returns that child in the snapshot the UI re-checks its boxes from', async () => {
    await saveLicence(BIZ, ['marketing.coupons'])
    const snap = await licenceSnapshot(BIZ)
    expect(snap.enabledScreens).toContain('marketing.coupons')
    const marketing = snap.modules.find((m) => m.key === 'marketing')!
    expect(marketing.enabled).toBe(true)
    expect(marketing.screens.find((s) => s.key === 'coupons')!.enabled).toBe(true)
    expect(marketing.screens.find((s) => s.key === 'discounts')!.enabled).toBe(false)
  })

  it('survives repeated saves without drift', async () => {
    await saveLicence(BIZ, ['marketing.coupons'])
    await saveLicence(BIZ, ['marketing.coupons', 'marketing.dashboard'])
    await saveLicence(BIZ, ['marketing.coupons'])
    const licence = await resolveLicence(BIZ)
    expect(licence.isScreenEnabled('marketing.coupons')).toBe(true)
    expect(licence.isScreenEnabled('marketing.dashboard')).toBe(false)
  })

  it('turns a screen off again when it is deselected', async () => {
    await saveLicence(BIZ, ['marketing.coupons'])
    await saveLicence(BIZ, ['marketing.dashboard'])
    expect((await resolveLicence(BIZ)).isScreenEnabled('marketing.coupons')).toBe(false)
  })
})

// The old features card wrote "CRM" and "MARKETING"; the module catalog uses
// "crm" and "marketing". Both land in the same table, and a case-insensitive
// read collapses them — so the two must not be able to contradict each other.
describe('legacy uppercase rows alongside new lowercase ones', () => {
  it('does not let a stale MARKETING=false row undo a fresh save', async () => {
    seed('MARKETING', false)
    await saveLicence(BIZ, ['marketing.coupons'])
    const licence = await resolveLicence(BIZ)
    expect(licence.isModuleEnabled('marketing')).toBe(true)
    expect(licence.isScreenEnabled('marketing.coupons')).toBe(true)
  })

  it('does not let a stale CRM=true row resurrect a module that was just disabled', async () => {
    seed('CRM', true)
    await saveLicence(BIZ, ['marketing.coupons'])
    const licence = await resolveLicence(BIZ)
    expect(licence.isModuleEnabled('crm')).toBe(false)
    expect(licence.isScreenEnabled('crm.leads')).toBe(false)
  })

  it('is stable no matter which order the rows come back in', async () => {
    seed('MARKETING', false)
    await saveLicence(BIZ, ['marketing.coupons'])
    const first = (await resolveLicence(BIZ)).isModuleEnabled('marketing')
    // Re-insert the legacy row last so it would win a naive last-write-wins read.
    store.delete(key(BIZ, 'MARKETING'))
    seed('MARKETING', false)
    const second = (await resolveLicence(BIZ)).isModuleEnabled('marketing')
    expect(second).toBe(first)
    expect(second).toBe(true)
  })
})

describe('an untouched tenant', () => {
  it('has everything except the opt-in modules', async () => {
    const licence = await resolveLicence(BIZ)
    expect(licence.isScreenEnabled('laundry.orders')).toBe(true)
    expect(licence.isScreenEnabled('marketing.coupons')).toBe(true)
    expect(licence.isModuleEnabled('crm')).toBe(false)
  })

  it('honours the legacy CRM entitlement that predates licensing', async () => {
    seed('CRM', true)
    expect((await resolveLicence(BIZ)).isModuleEnabled('crm')).toBe(true)
  })
})
