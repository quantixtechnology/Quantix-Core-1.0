import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-stages.tsx'), 'utf8')
const FN = SRC.slice(SRC.indexOf('const resolveAndReceive'), SRC.indexOf('return (', SRC.indexOf('const resolveAndReceive')))

describe('Store Receive never accepts without a deliberate act', () => {
  // The reported symptom: clicking Scan received the order although nothing was
  // scanned — the camera path fell back to whatever was left in the box.
  it('the scanner path uses ONLY what it was given', () => {
    expect(FN).toContain('const q = (raw !== undefined ? raw : code).trim()')
    expect(FN).not.toContain('(raw ?? code)')
  })

  it('an empty scan is refused, with a reason', () => {
    expect(FN).toContain('Nothing scanned — scan the bag or packet QR.')
  })

  it('the manual receipt names the order and asks first', () => {
    expect(SRC).toContain('Confirm receipt of ${selected.orderNumber} without scanning?')
    expect(SRC).toContain('Use this only when the QR cannot be scanned.')
  })

  it('the manual path still exists as a fallback', () => {
    expect(SRC).toContain('receiveOrder(selected.id)')
  })

  it('receiving still goes through the one existing endpoint', () => {
    expect(SRC).toContain('/store-receive`')
  })
})
