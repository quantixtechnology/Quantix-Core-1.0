import { describe, it, expect } from 'vitest'
import {
  validateProcessFlow, normalizeFlow, getFlow, resolveFlow, nextStageOf,
  reworkStagesOf, hasPassedQc, WORKSTATIONS, FINISHING_STAGES,
} from '../laundry-processing'

// ============================================================================
// Container-based finishing workflow — route engine behaviour.
//
// Garment barcodes are scanned through the cleaning stages and Quality Check.
// QC is the FINAL garment-barcode stage; Iron / Folding then operate on the
// Processing Container. A canonical route therefore places finishing AFTER QC.
// Stored snapshots are order-preserving (legacy in-flight garments never get
// rewritten); the canonical order is applied when a NEW service route is saved.
// ============================================================================

describe('validateProcessFlow (service route write — canonicalises finishing after QC)', () => {
  it('places finishing stages after Quality Check', () => {
    expect(validateProcessFlow(['WASH', 'DRY', 'IRON', 'FOLD'])).toEqual({ ok: true, flow: ['WASH', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'] })
  })

  it('keeps relative cleaning order, finishing always last', () => {
    expect(validateProcessFlow(['DRYCLEAN', 'DRY'])).toEqual({ ok: true, flow: ['DRYCLEAN', 'DRY', 'QC', 'PACKED'] })
    expect(validateProcessFlow(['IRON', 'WASH', 'FOLD', 'DRY'])).toEqual({ ok: true, flow: ['WASH', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'] })
  })

  it('re-normalises a legacy fully-formed route on re-save', () => {
    // Old stored config (finishing before QC) is migrated to the canonical order.
    expect(validateProcessFlow(['WASH', 'DRY', 'IRON', 'FOLD', 'QC', 'PACKED'])).toEqual({ ok: true, flow: ['WASH', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'] })
  })

  it('allows a service with only cleaning stages', () => {
    expect(validateProcessFlow(['CLEAN'])).toEqual({ ok: true, flow: ['CLEAN', 'QC', 'PACKED'] })
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

  it('keeps a canonical snapshot with finishing after QC untouched', () => {
    expect(normalizeFlow(['WASH', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'])).toEqual(['WASH', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'])
  })

  it('appends QC → PACKED when the snapshot lacks them', () => {
    expect(normalizeFlow(['WASH', 'DRY', 'IRON'])).toEqual(['WASH', 'DRY', 'IRON', 'QC', 'PACKED'])
  })

  it('de-duplicates and drops invalid codes', () => {
    expect(normalizeFlow(['WASH', 'WASH', 'DRY', 'QC', 'DRY', 'QC', 'PACKED', 'PACKED'])).toEqual(['WASH', 'DRY', 'QC', 'PACKED'])
  })
})

describe('getFlow (legacy name heuristic — new canonical order)', () => {
  it('routes washed garments through DRY + QC before finishing', () => {
    expect(getFlow('Wash & Fold')).toEqual(['WASH', 'DRY', 'QC', 'FOLD', 'PACKED'])
    expect(getFlow('Wash & Iron')).toEqual(['WASH', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'])
  })

  it('routes dry cleaning through Drying + QC before finishing', () => {
    expect(getFlow('Dry Clean')).toEqual(['DRYCLEAN', 'DRY', 'QC', 'IRON', 'PACKED'])
  })

  it('routes iron-only through QC first (finishing is post-QC)', () => {
    expect(getFlow('Ironing Service')).toEqual(['QC', 'IRON', 'PACKED'])
  })

  it('defaults to wash → dry → QC → fold → packed', () => {
    expect(getFlow('Something')).toEqual(['WASH', 'DRY', 'QC', 'FOLD', 'PACKED'])
  })
})

describe('nextStageOf + resolveFlow on canonical routes', () => {
  const flow = resolveFlow({ serviceName: 'Wash & Iron' })

  it('resolves the heuristic to the canonical order', () => {
    expect(flow).toEqual(['WASH', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'])
  })

  it('moves QC → IRON (finishing starts after QC)', () => {
    expect(nextStageOf(flow, 'QC')).toBe('IRON')
  })

  it('moves IRON → FOLD, FOLD → PACKED', () => {
    expect(nextStageOf(flow, 'IRON')).toBe('FOLD')
    expect(nextStageOf(flow, 'FOLD')).toBe('PACKED')
  })
})

describe('reworkStagesOf — QC failure never reworks forward into finishing', () => {
  it('returns only pre-QC cleaning stages for a canonical route', () => {
    expect(reworkStagesOf(['WASH', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'])).toEqual(['WASH', 'DRY'])
  })

  it('returns the pre-QC stages of a legacy route too', () => {
    expect(reworkStagesOf(['DRYCLEAN', 'DRY', 'QC', 'PACKED'])).toEqual(['DRYCLEAN', 'DRY'])
  })
})

describe('hasPassedQc + stage classification', () => {
  it('false for pre-QC stages and QC itself', () => {
    expect(hasPassedQc('WASH')).toBe(false)
    expect(hasPassedQc('DRY')).toBe(false)
    expect(hasPassedQc('QC')).toBe(false)
    expect(hasPassedQc(null)).toBe(false)
  })

  it('true once a garment is at/past a finishing stage or packed', () => {
    expect(hasPassedQc('IRON')).toBe(true)
    expect(hasPassedQc('FOLD')).toBe(true)
    expect(hasPassedQc('PACKED')).toBe(true)
  })
})

describe('workstation layout', () => {
  it('orders workstations cleaning → QC → finishing → packing', () => {
    expect([...WORKSTATIONS]).toEqual(['WASH', 'DRYCLEAN', 'DRY', 'QC', 'IRON', 'FOLD', 'PACKED'])
    expect([...FINISHING_STAGES]).toEqual(['IRON', 'FOLD'])
  })
})
