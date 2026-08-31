import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { explodePieces } from '@/lib/laundry-order-items'

// ============================================================================
// "5 × SHIRT" IS FIVE GARMENTS, NOT A ROW CARRYING A 5.
//
// Barcode Generation, processing, QC and delivery all operate on individual
// LaundryOrderItem records, so every write path normalises through
// explodePieces — createLaundryOrder does, the intake/add-garment endpoint
// does. The Store Audit CORRECTION path (PATCH .../items/[itemId]) did not: it
// wrote the quantity straight onto the single row. An audited "5 shirts"
// therefore reached Barcode Generation as ONE garment with ONE barcode, and
// the screen's "Total Garments 1" was reporting the data correctly.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const PATCH = read('src/app/api/laundry/orders/[id]/items/[itemId]/route.ts')
const INTAKE = read('src/app/api/laundry/orders/[id]/items/route.ts')
const ENGINE = read('src/lib/laundry-order-engine.ts')
const AUDIT_UI = read('src/components/laundry/views/laundry-store-audit.tsx')

const line = (quantity: number) => ({
  pricingType: 'PER_PIECE', quantity, weightKg: 0,
  unitPrice: 50, lineAmount: 50 * quantity, gstPercent: 0, gstAmount: 0, total: 50 * quantity,
})

describe('the split itself', () => {
  it('a quantity of 5 becomes five garments of one', () => {
    const out = explodePieces([line(5)])
    expect(out).toHaveLength(5)
    expect(out.every((u) => u.quantity === 1)).toBe(true)
  })

  it('the money is unchanged by the split', () => {
    const out = explodePieces([line(5)])
    expect(out.reduce((s, u) => s + u.total, 0)).toBe(250)
  })

  it('a quantity of 1 is left alone', () => {
    expect(explodePieces([line(1)])).toHaveLength(1)
  })
})

describe('EVERY write path normalises — the correction path included', () => {
  it('order creation explodes', () => {
    expect(ENGINE).toContain('explodePieces(')
  })

  it('the intake / add-garment endpoint explodes', () => {
    expect(INTAKE).toContain('explodePieces(')
  })

  it('the audit correction endpoint explodes — this is the fix', () => {
    expect(PATCH).toContain('explodePieces(')
    expect(PATCH).toContain('const units = explodePieces([{ ...line, quantity, weightKg }])')
  })

  it('the correction no longer writes a raw quantity onto the single row', () => {
    // The old line. Its absence is the fix.
    expect(PATCH).not.toContain('data: { serviceId, garmentId, quantity, weightKg, serviceName: line.serviceName, garmentName: line.garmentName },')
  })
})

describe('the edited garment keeps its identity', () => {
  it('the existing row is updated, never deleted and recreated', () => {
    expect(PATCH).toContain('where: { id: itemId },')
    expect(PATCH).not.toContain('laundryOrderItem.deleteMany')
  })

  it('siblings inherit the inspection rather than resetting the audit gate', () => {
    // checkAuditComplete requires inspectedAt on EVERY item; new siblings with
    // a null stamp would silently un-approve an order that was already audited.
    expect(PATCH).toContain('inspectedAt: item.inspectedAt')
    expect(PATCH).toContain('condition: item.condition')
  })

  it('siblings get their own GAR code, minted serially and healed first', () => {
    expect(PATCH).toContain('healGarSequenceCounter()')
    expect(PATCH).toContain('nextGarScanCode()')
    expect(PATCH.indexOf('healGarSequenceCounter()')).toBeLessThan(PATCH.indexOf('garCodes.push'))
  })

  it('the whole split is one transaction', () => {
    expect(PATCH).toContain('prisma.$transaction(')
  })
})

describe('a garment already carrying an operational identity is not split', () => {
  it('refuses once barcoded or in processing, and says why', () => {
    expect(PATCH).toContain('item.barcodeGenerated || item.processingStage')
    expect(PATCH).toContain('has already been barcoded, so its quantity cannot be changed here')
  })

  it('the refusal is a conflict, not a server fault', () => {
    expect(PATCH).toContain('{ status: 409 }')
  })
})

describe('the correction is visible on the timeline', () => {
  it('says how many garments the line became', () => {
    expect(PATCH).toContain('recorded as ${units.length} individual garments')
    expect(PATCH).toContain('AUDIT_ITEM_CHANGED')
  })
})

describe('intake never discards a row in silence', () => {
  it('a half-filled row stops the save and is named', () => {
    // The old filter dropped it with no message, so a garment the operator
    // believed they had entered simply never reached the order.
    expect(AUDIT_UI).toContain('Finish every row first')
    expect(AUDIT_UI).toContain('Nothing was saved.')
    expect(AUDIT_UI).toContain('has no quantity or weight')
    expect(AUDIT_UI).toContain('has no garment')
  })
})
