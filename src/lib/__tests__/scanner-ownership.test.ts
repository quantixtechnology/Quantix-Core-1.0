import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ScanEngine } from '@/lib/hardware/scan-engine'

// ============================================================================
// SCANNER OWNERSHIP — one barcode, exactly one handler.
//
// THE BUG: dispatch picked `attachments[attachments.length - 1]`. That is
// ORDERING, not ownership. LaundryBarcodeScanner re-focuses its input 10ms
// after ANY focus loss, and a sink re-attaches on focus — so opening the Scan
// Bag dialog made the workstation steal focus back, re-attach, and become the
// winner again. V8BAG002 went to handleGarmentScan() and the operator saw
// "No garment found for barcode V8BAG002" while the dialog still said
// "Waiting for scan…".
//
// THE RULE: a dialog CLAIMS the scanner. While a claim is live it receives
// every scan and the workstation receives none — regardless of focus,
// attachment order, or how many times anything re-attaches.
// ============================================================================

const GARMENT = 'GAR000000000086'
const BAG = 'V8BAG002'

let garment: string[]
let bag: string[]

beforeEach(() => {
  ScanEngine.resetForTests()
  garment = []
  bag = []
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-27T10:00:00.000Z'))
})

// Each submit must look like a distinct scan — the engine drops a repeat of the
// same code inside its duplicate window.
let clock = 0
const scan = (code: string, source: Parameters<typeof ScanEngine.submit>[1] = 'USB_SCANNER') => {
  clock += 5000
  vi.setSystemTime(new Date(Date.parse('2026-08-27T10:00:00.000Z') + clock))
  return ScanEngine.submit(code, source)
}

const attachGarment = () => ScanEngine.attach((e) => { garment.push(e.code) })
const claimBag = () => ScanEngine.claim((e) => { bag.push(e.code) })

describe('scanner routing', () => {
  // TEST 1
  it('1 · with no dialog open, a garment scan reaches the workstation', () => {
    attachGarment()
    scan(GARMENT)
    expect(garment).toEqual([GARMENT])
    expect(bag).toEqual([])
  })

  // TEST 2 — the reported failure
  it('2 · with the bag dialog open, ONLY the bag handler receives the scan', () => {
    attachGarment()
    const release = claimBag()
    scan(BAG)
    expect(bag).toEqual([BAG])
    expect(garment).toEqual([]) // the exact regression
    release()
  })

  it('2b · the workstation re-attaching does NOT take the scanner back', () => {
    attachGarment()
    claimBag()
    // Simulates the focus-steal → sink re-attach loop that caused the bug.
    for (let i = 0; i < 5; i++) attachGarment()
    scan(BAG)
    expect(bag).toEqual([BAG])
    expect(garment).toEqual([])
  })

  // TEST 3
  it('3 · an invalid code still goes only to the bag handler', () => {
    attachGarment()
    claimBag()
    scan('NOT-A-REAL-BAG')
    expect(bag).toEqual(['NOT-A-REAL-BAG'])
    expect(garment).toEqual([])
  })

  // TEST 4 + 5
  it('4,5 · releasing hands the scanner back to the workstation', () => {
    attachGarment()
    const release = claimBag()
    scan(BAG)
    release()
    scan(GARMENT)
    expect(bag).toEqual([BAG])
    expect(garment).toEqual([GARMENT])
  })

  // TESTS 6-9 — every input surface obeys ownership
  it('6,7,8,9 · wedge, manual and camera scans all route to the owner', () => {
    attachGarment()
    claimBag()
    scan('ENTER-SUFFIX', 'USB_SCANNER')      // Enter / Tab / no-suffix all arrive
    scan('BT-SCAN', 'BLUETOOTH_SCANNER')     //  as one submit() call
    scan('TYPED', 'MANUAL')                  // manual entry in the dialog
    scan('CAM', 'CAMERA')                    // camera
    expect(bag).toEqual(['ENTER-SUFFIX', 'BT-SCAN', 'TYPED', 'CAM'])
    expect(garment).toEqual([])
  })

  // TEST 10
  it('10 · repeated open/close leaves no stale owner and no duplicate dispatch', () => {
    attachGarment()
    for (let i = 0; i < 25; i++) {
      const release = claimBag()
      scan(`BAG-${i}`)
      release()
    }
    expect(ScanEngine.hasOwner()).toBe(false)
    expect(bag).toHaveLength(25)
    expect(garment).toEqual([])
    scan(GARMENT)
    expect(garment).toEqual([GARMENT]) // ownership genuinely returned
  })

  it('10b · releasing twice is safe and does not free someone else', () => {
    attachGarment()
    const first = claimBag()
    const second = claimBag()
    first(); first(); first()
    scan(BAG)
    expect(bag).toEqual([BAG]) // the second claim still owns it
    second()
    expect(ScanEngine.hasOwner()).toBe(false)
  })

  // TEST 11
  it('11 · with two claims, only the most recent owns the scanner', () => {
    attachGarment()
    const a: string[] = []
    const b: string[] = []
    const relA = ScanEngine.claim((e) => a.push(e.code))
    const relB = ScanEngine.claim((e) => b.push(e.code))
    scan('FIRST')
    expect(b).toEqual(['FIRST'])
    expect(a).toEqual([])
    // Closing the top dialog hands ownership DOWN, not back to the workstation.
    relB()
    scan('SECOND')
    expect(a).toEqual(['SECOND'])
    expect(garment).toEqual([])
    relA()
  })

  // TEST 12
  it('12 · unmounting the workstation while the dialog is open is safe', () => {
    const detachGarment = attachGarment()
    const release = claimBag()
    detachGarment() // workstation unmounts underneath the dialog
    scan(BAG)
    expect(bag).toEqual([BAG])
    release()
    expect(ScanEngine.hasOwner()).toBe(false)
    scan(GARMENT)
    expect(garment).toEqual([]) // nothing left listening — no crash, no leak
  })

  it('12b · resetForTests() clears owners so navigation cannot strand one', () => {
    claimBag()
    expect(ScanEngine.hasOwner()).toBe(true)
    ScanEngine.resetForTests()
    expect(ScanEngine.hasOwner()).toBe(false)
  })

  it('a single scan is never delivered twice', () => {
    attachGarment()
    const release = claimBag()
    scan(BAG)
    expect(bag.length + garment.length).toBe(1)
    release()
  })
})

// ── Wiring: the rule is actually applied where it matters ──────────────────
describe('the fix is wired into the real components', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('the bag dialog claims the scanner exclusively', () => {
    const BAGSCANNER = read('src/components/laundry/bag-scanner.tsx')
    expect(BAGSCANNER).toContain('useScanSink(run, { exclusive: true })')
  })

  it('an exclusive sink claims and never re-claims on focus', () => {
    const SINK = read('src/lib/hardware/use-scan-sink.ts')
    expect(SINK).toContain('return ScanEngine.claim(receive)')
    // focusSeq (the re-attach churn) drives ONLY the non-exclusive path.
    const exclusiveEffect = SINK.slice(SINK.indexOf('if (!enabled || !exclusive) return'), SINK.indexOf('if (!enabled || exclusive) return'))
    expect(exclusiveEffect).not.toContain('focusSeq')
  })

  it('an owner takes the scan outright, with no fall-through', () => {
    const ENGINE = read('src/lib/hardware/scan-engine.ts')
    expect(ENGINE).toContain('if (owner) owner.handler(event)')
    expect(ENGINE).toContain('else this.attachments[this.attachments.length - 1]?.handler(event)')
  })

  it('the workstation input stops stealing focus while a dialog owns the scanner', () => {
    const WS = read('src/components/laundry/laundry-barcode-scanner.tsx')
    expect(WS).toContain('ScanEngine.hasOwner()')
    expect(WS).toContain("document.querySelector(\"[role='dialog']\")")
    // Every re-focus path is guarded, including the deferred ones.
    expect(WS).toContain('if (!scannerBusyElsewhere()) inputRef.current?.focus()')
  })

  it('the dialog closes on a successful assignment, not on detection', () => {
    const BAGSCANNER = read('src/components/laundry/bag-scanner.tsx')
    expect(BAGSCANNER).toContain('succeeded = (await onScan(c)) !== false')
    expect(BAGSCANNER).toContain('if (succeeded && closeOnScan) { onClose(); return }')
    const SORTING = read('src/components/laundry/views/laundry-sorting-workstation.tsx')
    expect(SORTING).toContain('setScanErr(j.error || "Could not assign the bag."); return false')
    expect(SORTING).toContain('return true')
  })
})
