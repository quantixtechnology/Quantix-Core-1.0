import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CONSOLE = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-processing-console.tsx'), 'utf8')

// One dialog per order is workable for one order and a bottleneck at a hundred.
describe('Dispatch to Store is scan-and-go', () => {
  it('the section has its own scan field', () => {
    expect(CONSOLE).toContain('Scan bag or order to dispatch…')
    expect(CONSOLE).toContain('const scanDispatch = async')
  })

  it('a scan dispatches, so a wedge scanner needs no button', () => {
    // Superseded: the field used to handle its own Enter, which made Enter the
    // only terminator that worked and hid the scan from diagnostics. It is now
    // a scan sink on the shared engine, so Enter, Tab and a no-suffix scanner
    // all dispatch — see laundry-scan-sink.test.ts.
    expect(CONSOLE).toContain('const dispatchScanProps = useScanSink(')
    expect(CONSOLE).toContain('void scanDispatch(c)')
    expect(CONSOLE).toContain('{...dispatchScanProps}')
  })

  it('the field autofocuses and clears, so scans can run back to back', () => {
    expect(CONSOLE).toContain('autoFocus value={dispatchScan}')
    expect(CONSOLE).toContain('setDispatchScan("")')
  })

  it('a camera scan goes straight through the same path', () => {
    expect(CONSOLE).toContain('onScan={(c) => scanDispatch(c)}')
  })

  // No dialog, no typing, no per-row clicking.
  it('dispatch happens without opening the row dialog', () => {
    const fn = CONSOLE.slice(CONSOLE.indexOf('const scanDispatch'), CONSOLE.indexOf('const returnToStore'))
    expect(fn).toContain('returnToStore(')
    expect(fn).not.toContain('setDispatchRow(')
  })
})

describe('resolution is cheap before it is clever', () => {
  it('matches an order already on the list without a request', () => {
    expect(CONSOLE).toContain('readyToReturn.find(')
    expect(CONSOLE).toContain('o.transportCode?.toUpperCase() === q.toUpperCase() || o.orderNumber.toUpperCase() === q.toUpperCase()')
  })

  it('falls back to the existing transport resolver for packets and order numbers', () => {
    expect(CONSOLE).toContain('direction=PROCESSING_TO_STORE')
  })

  it('says so when a code matches nothing, instead of failing silently', () => {
    expect(CONSOLE).toContain('does not match an order ready to dispatch.')
  })
})

describe('the manual path survives', () => {
  it('the per-row dialog is still available', () => {
    expect(CONSOLE).toContain('setDispatchRow(o)')
    expect(CONSOLE).toContain('Return bag')
  })
})
