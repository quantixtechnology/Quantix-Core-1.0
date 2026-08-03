import { describe, it, expect } from 'vitest'
import {
  validateProcessFlow, normalizeFlow, getFlow, resolveFlow, nextStageOf,
  reworkStagesOf, hasPassedQc, isProcessingTerminal, TERMINAL_STAGE,
  WORKSTATIONS, FINISHING_STAGES, ROUTE_STAGES, ROUTE_TERMINALS,
} from '../laundry-processing'

// ============================================================================
// Approved operational model — route engine behaviour.
//
// Garment barcodes are the tracking identity through cleaning and the merged
// Dry & Quality Check (QC) workstation. Sorting is the permanent garment→bag
// transition point (one order = one bag); Iron / Folding / Transit then operate
// on the bag. A canonical route therefore reads:
//     cleaning → QC (Dry & Quality Check) → SORTING → finishing → DISPATCHED.
// Stored snapshots are order-preserving (legacy in-flight garments never get
// rewritten); the canonical order is applied when a NEW service route is saved.
// ============================================================================

describe('validateProcessFlow (service route write — canonicalises the approved model)', () => {
  it('injects Dry & Quality Check → Sorting → Transit around the cleaning/finishing stages', () => {
    expect(validateProcessFlow(['WASH', 'IRON', 'FOLD'])).toEqual({ ok: true, flow: ['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'] })
  })

  it('keeps relative cleaning order, finishing always after Sorting', () => {
    expect(validateProcessFlow(['DRYCLEAN'])).toEqual({ ok: true, flow: ['DRYCLEAN', 'QC', 'SORTING', 'DISPATCHED'] })
    expect(validateProcessFlow(['IRON', 'WASH', 'FOLD'])).toEqual({ ok: true, flow: ['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'] })
  })

  it('re-normalises a legacy fully-formed route on re-save (idempotent)', () => {
    // Old stored config (finishing before QC, PACKED terminal) is migrated to the
    // canonical order — QC / SORTING / terminal placement is tolerated, not required.
    expect(validateProcessFlow(['WASH', 'IRON', 'FOLD', 'QC', 'SORTING', 'PACKED'])).toEqual({ ok: true, flow: ['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'] })
  })

  it('tolerates a legacy DRY stage on write (read-only on new configs)', () => {
    expect(validateProcessFlow(['WASH', 'DRY'])).toEqual({ ok: true, flow: ['WASH', 'DRY', 'QC', 'SORTING', 'DISPATCHED'] })
  })

  it('allows a service with only cleaning stages', () => {
    expect(validateProcessFlow(['CLEAN'])).toEqual({ ok: true, flow: ['CLEAN', 'QC', 'SORTING', 'DISPATCHED'] })
  })

  it('rejects STEAM, duplicates, and invalid stages', () => {
    expect(validateProcessFlow(['STEAM'])).toMatchObject({ ok: false, code: 'INVALID_PROCESS_FLOW' })
    expect(validateProcessFlow(['WASH', 'WASH'])).toMatchObject({ ok: false, code: 'INVALID_PROCESS_FLOW' })
    expect(validateProcessFlow(['SORTING'])).toMatchObject({ ok: false, code: 'INVALID_PROCESS_FLOW' })
    expect(validateProcessFlow('WASH')).toMatchObject({ ok: false })
  })

  it('clears the route on null / empty', () => {
    expect(validateProcessFlow(null)).toEqual({ ok: true, flow: null })
    expect(validateProcessFlow([])).toEqual({ ok: true, flow: null })
  })
})

describe('normalizeFlow (stored snapshot — ORDER PRESERVING)', () => {
  it('keeps a legacy snapshot with finishing before QC untouched', () => {
    expect(normalizeFlow(['WASH', 'DRY', 'IRON', 'FOLD', 'QC', 'PACKED'])).toEqual(['WASH', 'DRY', 'IRON', 'FOLD', 'QC', 'PACKED'])
  })

  it('keeps a canonical snapshot untouched', () => {
    expect(normalizeFlow(['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'])).toEqual(['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'])
  })

  it('keeps a legacy PACKED terminal for pre-existing routes', () => {
    expect(normalizeFlow(['WASH', 'QC', 'SORTING', 'FOLD', 'PACKED'])).toEqual(['WASH', 'QC', 'SORTING', 'FOLD', 'PACKED'])
  })

  it('appends the DISPATCHED terminal when the snapshot lacks one', () => {
    expect(normalizeFlow(['WASH', 'QC', 'SORTING', 'IRON', 'FOLD'])).toEqual(['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'])
  })

  it('de-duplicates and drops invalid codes', () => {
    expect(normalizeFlow(['WASH', 'WASH', 'QC', 'SORTING', 'QC', 'DISPATCHED', 'DISPATCHED'])).toEqual(['WASH', 'QC', 'SORTING', 'DISPATCHED'])
  })
})

describe('getFlow (legacy name heuristic — approved canonical order)', () => {
  it('routes washed garments through QC + Sorting before finishing', () => {
    expect(getFlow('Wash & Fold')).toEqual(['WASH', 'QC', 'SORTING', 'FOLD', 'DISPATCHED'])
    expect(getFlow('Wash & Iron')).toEqual(['WASH', 'QC', 'SORTING', 'IRON', 'DISPATCHED'])
    expect(getFlow('Wash & Iron & Fold')).toEqual(['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'])
  })

  it('routes dry cleaning through QC + Sorting (no finishing when not needed)', () => {
    expect(getFlow('Dry Clean')).toEqual(['DRYCLEAN', 'QC', 'SORTING', 'DISPATCHED'])
  })

  it('routes iron-only through QC + Sorting first (finishing is bag-based, post-Sorting)', () => {
    expect(getFlow('Ironing Service')).toEqual(['QC', 'SORTING', 'IRON', 'DISPATCHED'])
  })

  it('defaults to wash → QC → sorting → dispatched', () => {
    expect(getFlow('Something')).toEqual(['WASH', 'QC', 'SORTING', 'DISPATCHED'])
  })
})

describe('nextStageOf + resolveFlow on canonical routes', () => {
  const flow = ['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED']

  it('moves WASH → QC → SORTING → IRON → FOLD → DISPATCHED', () => {
    expect(nextStageOf(flow, 'WASH')).toBe('QC')
    expect(nextStageOf(flow, 'QC')).toBe('SORTING')
    expect(nextStageOf(flow, 'SORTING')).toBe('IRON')
    expect(nextStageOf(flow, 'IRON')).toBe('FOLD')
    expect(nextStageOf(flow, 'FOLD')).toBe('DISPATCHED')
  })

  it('has no next stage at the terminal', () => {
    expect(nextStageOf(flow, 'DISPATCHED')).toBeNull()
  })

  it('resolveFlow falls back heuristic → canonical (no config, no snapshot)', () => {
    expect(resolveFlow({ serviceName: 'Dry Clean' })).toEqual(['DRYCLEAN', 'QC', 'SORTING', 'DISPATCHED'])
  })
})

describe('reworkStagesOf — QC failure never reworks forward into finishing', () => {
  it('returns only pre-QC cleaning stages for a canonical route', () => {
    expect(reworkStagesOf(['WASH', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'])).toEqual(['WASH'])
  })

  it('returns the pre-QC stages of a dry-clean-only route', () => {
    expect(reworkStagesOf(['DRYCLEAN', 'QC', 'SORTING', 'DISPATCHED'])).toEqual(['DRYCLEAN'])
  })
})

describe('hasPassedQc + stage classification', () => {
  it('false for pre-QC stages and QC itself', () => {
    expect(hasPassedQc('WASH')).toBe(false)
    expect(hasPassedQc('DRY')).toBe(false)
    expect(hasPassedQc('DRYCLEAN')).toBe(false)
    expect(hasPassedQc('QC')).toBe(false)
    expect(hasPassedQc(null)).toBe(false)
  })

  it('true from Sorting onward (garment→bag transition counts as passed QC)', () => {
    expect(hasPassedQc('SORTING')).toBe(true)
    expect(hasPassedQc('IRON')).toBe(true)
    expect(hasPassedQc('FOLD')).toBe(true)
    expect(hasPassedQc('DISPATCHED')).toBe(true)
    expect(hasPassedQc('PACKED')).toBe(true)
  })
})

describe('terminal + workstation layout', () => {
  it('treats DISPATCHED (Transit) and the legacy PACKED terminal as terminal', () => {
    expect(TERMINAL_STAGE).toBe('DISPATCHED')
    expect(isProcessingTerminal('DISPATCHED')).toBe(true)
    expect(isProcessingTerminal('PACKED')).toBe(true)
    expect(isProcessingTerminal('IRON')).toBe(false)
    expect(isProcessingTerminal('QC')).toBe(false)
    expect(isProcessingTerminal(null)).toBe(false)
  })

  it('orders workstations cleaning → QC → Sorting → finishing → transit', () => {
    expect([...WORKSTATIONS]).toEqual(['WASH', 'DRYCLEAN', 'QC', 'SORTING', 'IRON', 'FOLD', 'DISPATCHED'])
    expect([...FINISHING_STAGES]).toEqual(['IRON', 'FOLD'])
  })

  it('exposes configurable + injected stage lists', () => {
    expect([...ROUTE_STAGES]).toEqual(['WASH', 'DRYCLEAN', 'IRON', 'FOLD', 'CLEAN'])
    expect([...ROUTE_TERMINALS]).toEqual(['QC', 'SORTING', 'DISPATCHED'])
  })
})
