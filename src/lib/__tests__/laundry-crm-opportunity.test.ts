import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Opportunity module rules:
//   · probability is owned by the sales stage unless the tenant chose MANUAL
//   · ownership is ONE concept — the deal is owned by the Lead Owner
// ============================================================================

const mocks = vi.hoisted(() => ({
  configFindUnique: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { laundryCrmConfig: { findUnique: mocks.configFindUnique } },
}))

import {
  getCrmConfig, normalizeProbabilityMode, probabilityForStage, DEFAULT_CRM_CONFIG,
  ownerForNewOpportunity, ownerPatchFromRequest, OWNER_SOURCE_INHERITED,
} from '@/lib/laundry-crm'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.configFindUnique.mockResolvedValue(null)
})

// Phase 1: exactly ONE owner. The Lead Owner owns the deal; an opportunity has
// no separately editable owner and the server never trusts a client-sent one.
describe('opportunity ownership', () => {
  const LEAD = { assignedToId: 'u-anita', assignedToName: 'Anita' }

  it('a new opportunity takes the Lead Owner', () => {
    const o = ownerForNewOpportunity(LEAD)
    expect(o.assignedToId).toBe('u-anita')
    expect(o.assignedToName).toBe('Anita')
  })

  it('records HOW the owner got there, so a future sync can target inherited rows', () => {
    expect(ownerForNewOpportunity(LEAD).ownerSource).toBe(OWNER_SOURCE_INHERITED)
  })

  it('an unowned lead yields an unowned opportunity rather than a guess', () => {
    const o = ownerForNewOpportunity({ assignedToId: null, assignedToName: null })
    expect(o.assignedToId).toBeNull()
    expect(o.assignedToName).toBeNull()
    expect(o.ownerSource).toBe(OWNER_SOURCE_INHERITED)
  })

  it('the server writes NOTHING for an owner sent by a client', () => {
    expect(ownerPatchFromRequest({ assignedToId: 'u-hacker', assignedToName: 'Someone Else' })).toEqual({})
    expect(ownerPatchFromRequest({})).toEqual({})
    expect(ownerPatchFromRequest(null)).toEqual({})
  })

  it('the owner patch is the ONE seam a future dedicated owner opens', () => {
    // Phase 1 contract: never writable. If this starts returning a patch, the
    // UI must gain an owner control and this test must be updated deliberately.
    expect(Object.keys(ownerPatchFromRequest({ assignedToName: 'X' }))).toHaveLength(0)
  })
})

describe('probability mode configuration', () => {
  it('defaults to AUTO_FROM_STAGE when the tenant has no config row', async () => {
    expect(await getCrmConfig('biz-1')).toEqual({ probabilityMode: 'AUTO_FROM_STAGE' })
    expect(DEFAULT_CRM_CONFIG.probabilityMode).toBe('AUTO_FROM_STAGE')
  })

  it('reads MANUAL from the stored row', async () => {
    mocks.configFindUnique.mockResolvedValue({ probabilityMode: 'MANUAL' })
    expect(await getCrmConfig('biz-1')).toEqual({ probabilityMode: 'MANUAL' })
  })

  it('falls back to AUTO_FROM_STAGE on a bad stored value', async () => {
    mocks.configFindUnique.mockResolvedValue({ probabilityMode: 'NONSENSE' })
    expect(await getCrmConfig('biz-1')).toEqual({ probabilityMode: 'AUTO_FROM_STAGE' })
  })

  it('survives a database error rather than breaking the stage move', async () => {
    mocks.configFindUnique.mockRejectedValue(new Error('db down'))
    expect(await getCrmConfig('biz-1')).toEqual({ probabilityMode: 'AUTO_FROM_STAGE' })
  })

  it('normalizes unknown / missing input to the automatic default', () => {
    expect(normalizeProbabilityMode(undefined)).toBe('AUTO_FROM_STAGE')
    expect(normalizeProbabilityMode(null)).toBe('AUTO_FROM_STAGE')
    expect(normalizeProbabilityMode('WHATEVER')).toBe('AUTO_FROM_STAGE')
    expect(normalizeProbabilityMode('MANUAL')).toBe('MANUAL')
  })
})

describe('probabilityForStage — what a stage move applies', () => {
  it('AUTO_FROM_STAGE takes the stage percentage (Qualification 10% → 10)', () => {
    expect(probabilityForStage('AUTO_FROM_STAGE', 10, null)).toBe(10)
    expect(probabilityForStage('AUTO_FROM_STAGE', 60, 25)).toBe(60)
  })

  it('AUTO_FROM_STAGE overwrites whatever was there before', () => {
    expect(probabilityForStage('AUTO_FROM_STAGE', 90, 5)).toBe(90)
  })

  it('MANUAL never lets a stage move overwrite a typed value', () => {
    expect(probabilityForStage('MANUAL', 90, 25)).toBe(25)
    expect(probabilityForStage('MANUAL', 100, null)).toBeNull()
  })

  it('a 0% stage (Lost) still applies in automatic mode', () => {
    expect(probabilityForStage('AUTO_FROM_STAGE', 0, 75)).toBe(0)
  })
})
