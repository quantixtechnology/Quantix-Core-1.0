import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Opportunity module rules:
//   · probability is owned by the sales stage unless the tenant chose MANUAL
//   · ownership is ONE concept — the deal is owned by the Lead Owner
// ============================================================================

const mocks = vi.hoisted(() => ({
  configFindUnique: vi.fn().mockResolvedValue(null),
  stageHistoryCreate: vi.fn().mockResolvedValue({ id: 'h-1' }),
  leadStatusHistoryCreate: vi.fn().mockResolvedValue({ id: 'lh-1' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryCrmConfig: { findUnique: mocks.configFindUnique },
    laundryCrmStageHistory: { create: mocks.stageHistoryCreate },
    laundryCrmLeadStatusHistory: { create: mocks.leadStatusHistoryCreate },
  },
}))

import {
  getCrmConfig, normalizeProbabilityMode, probabilityForStage, DEFAULT_CRM_CONFIG,
  ownerForNewOpportunity, ownerPatchFromRequest, OWNER_SOURCE_INHERITED,
  normalizeChangeSource, durationSince, movementLabel,
  recordStageChange, recordLeadStatusChange,
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

// Every stage/status movement leaves a permanent, append-only entry. Nothing
// bypasses it — the recorders are the only writers, shared by both entities.
describe('stage / status audit trail', () => {
  it('records where a change came from, defaulting unknown callers to API', () => {
    expect(normalizeChangeSource('GRID')).toBe('GRID')
    expect(normalizeChangeSource('kanban')).toBe('KANBAN')
    expect(normalizeChangeSource('DETAIL')).toBe('DETAIL')
    expect(normalizeChangeSource('AUTOMATION')).toBe('AUTOMATION')
    expect(normalizeChangeSource(undefined)).toBe('API')
    expect(normalizeChangeSource('SOMETHING_ELSE')).toBe('API')
  })

  it('captures the full audit row for an opportunity move', async () => {
    await recordStageChange({
      businessId: 'biz-1', opportunityId: 'opp-1',
      fromStageId: 's-1', fromStageName: 'Qualification',
      toStageId: 's-2', toStageName: 'Proposal',
      durationMs: 3600000, probability: 60,
      reason: null, comments: 'Sent revised quote',
      source: 'GRID', actor: { id: 'u-1', name: 'Anita' },
    })
    expect(mocks.stageHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStageName: 'Qualification', toStageName: 'Proposal',
        probability: 60, comments: 'Sent revised quote',
        source: 'GRID', changedByName: 'Anita', durationMs: 3600000,
      }),
    })
  })

  it('snapshots probability so history survives a stage being retuned', async () => {
    await recordStageChange({
      businessId: 'b', opportunityId: 'o', fromStageId: null, fromStageName: null,
      toStageId: 's', toStageName: 'Qualification', durationMs: null,
      probability: 10, source: 'API',
    })
    expect(mocks.stageHistoryCreate.mock.calls[0][0].data.probability).toBe(10)
  })

  it('uses the SAME mechanism for a lead status change', async () => {
    await recordLeadStatusChange({
      businessId: 'biz-1', leadId: 'lead-1',
      fromStatusId: 'st-1', fromStatusName: 'New',
      toStatusId: 'st-2', toStatusName: 'Contacted',
      reason: 'Called back', source: 'DETAIL', actor: { id: 'u-2', name: 'Mukhtar Khan' },
    })
    expect(mocks.leadStatusHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatusName: 'New', toStatusName: 'Contacted',
        reason: 'Called back', source: 'DETAIL', changedByName: 'Mukhtar Khan',
      }),
    })
  })

  it('writes through a transaction client when one is given (atomic with the move)', async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: 'x' })
    await recordStageChange({
      businessId: 'b', opportunityId: 'o', fromStageId: null, fromStageName: null,
      toStageId: 's', toStageName: 'X', durationMs: null, probability: null, source: 'API',
    }, { laundryCrmStageHistory: { create: txCreate } })
    expect(txCreate).toHaveBeenCalled()
    expect(mocks.stageHistoryCreate).not.toHaveBeenCalled()
  })

  it('timeline labels always name both ends, never the destination alone', () => {
    expect(movementLabel('Opportunity', 'Qualification', 'Proposal')).toBe('Opportunity moved: Qualification → Proposal')
    expect(movementLabel('Lead', null, 'Contacted')).toBe('Lead moved: None → Contacted')
    expect(movementLabel('Lead', undefined, 'New')).not.toBe('Lead moved to New')
  })

  it('measures time spent in the previous stage, tolerating a missing start', () => {
    const now = new Date('2026-08-08T10:00:00Z')
    expect(durationSince(new Date('2026-08-08T09:00:00Z'), now)).toBe(3600000)
    expect(durationSince(null, now)).toBeNull()
    expect(durationSince(undefined, now)).toBeNull()
  })
})
