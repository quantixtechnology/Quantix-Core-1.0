import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ScanEngine, diagnostics } from '@/lib/hardware'

// ============================================================================
// A physical scan must reach Garment Lookup — whatever suffix the scanner is
// configured with, and through ONE pipeline.
//
// THE BUG: Garment Lookup's Scan Mode bar is an <input> that the screen keeps
// permanently focused ("Ready — scan a garment (no need to click here)"). The
// engine stands aside for a focused editable element — correct for a customer
// name, wrong for a field that exists only to catch a scanner — so on the one
// screen built around the scanner the engine deferred every time, dispatched
// nothing and recorded nothing. Everything then rested on the input's own
// handler, which accepted Enter alone and called search() behind the engine's
// back: a Tab-suffix or no-suffix scanner failed silently, and even a working
// scan left no trace for Hardware Manager.
//
// The fix is a DOM marker (data-scan-sink), two more terminators, and one route.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const LOOKUP = read('src/components/laundry/views/laundry-garment-lookup.tsx')

/** The barcode that exists in production, on ORD-STR-LND-BUS-202606-0005-002-000002. */
const GAR = 'GAR000000000084'

let clock = 0
const advance = (ms: number) => { clock += ms }

/** Types a code the way a hardware wedge does: fast, into `target`. */
function burst(code: string, opts: { target?: HTMLElement; gapMs?: number; suffix?: 'Enter' | 'Tab' | null } = {}) {
  const target = opts.target ?? document.body
  const gap = opts.gapMs ?? 6
  for (const ch of code) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }))
    advance(gap)
  }
  if (opts.suffix) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: opts.suffix, bubbles: true, cancelable: true }))
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  clock = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => clock)
  ScanEngine.resetForTests()
  ScanEngine.start()
  document.body.innerHTML = ''
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

const sink = () => {
  const el = document.createElement('input')
  el.setAttribute('data-scan-sink', '')
  document.body.appendChild(el)
  return el
}
const plainField = () => {
  const el = document.createElement('input')
  document.body.appendChild(el)
  return el
}
const collect = () => {
  const got: string[] = []
  ScanEngine.attach((e) => got.push(e.code))
  return got
}

// ── The three scanner configurations ──────────────────────────────────────
describe('every terminator a wedge can be configured with', () => {
  it('Enter suffix → one scan', () => {
    const got = collect()
    burst(GAR, { suffix: 'Enter' })
    expect(got).toEqual([GAR])
  })

  it('Tab suffix → one scan, and the Tab is not part of the barcode', () => {
    // A Tab-suffix scanner used to end the burst with no dispatch whatsoever.
    const got = collect()
    burst(GAR, { suffix: 'Tab' })
    expect(got).toEqual([GAR])
    expect(got[0]).not.toContain('\t')
  })

  it('NO suffix → the finished burst is flushed', () => {
    const got = collect()
    burst(GAR, { suffix: null })
    expect(got).toEqual([])       // nothing has terminated it yet
    vi.advanceTimersByTime(200)
    expect(got).toEqual([GAR])
  })

  it('the flush waits for the burst to finish, never mid-barcode', () => {
    const got = collect()
    for (const ch of GAR) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }))
      advance(6)
      vi.advanceTimersByTime(6)   // time passes DURING the burst
      expect(got).toEqual([])
    }
    vi.advanceTimersByTime(200)
    expect(got).toEqual([GAR])
  })

  it('a Tab suffix does not move focus off the scan bar', () => {
    // Otherwise the operator is thrown out of the scan bar between garments.
    const el = sink()
    collect()
    let ev: KeyboardEvent | null = null
    el.addEventListener('keydown', (e) => { ev = e as KeyboardEvent })
    burst(GAR, { target: el, suffix: 'Tab' })
    expect(ev!.defaultPrevented).toBe(true)
  })
})

// ── Ordinary typing is untouched ──────────────────────────────────────────
describe('a normal field still belongs to the person typing in it', () => {
  it('a fast burst into a plain input is NOT taken by the engine', () => {
    const got = collect()
    burst(GAR, { target: plainField(), suffix: 'Enter' })
    expect(got).toEqual([])
  })

  it('…not even with no terminator, so the idle flush cannot steal it', () => {
    const got = collect()
    burst(GAR, { target: plainField(), suffix: null })
    vi.advanceTimersByTime(500)
    expect(got).toEqual([])
  })

  it('a textarea and a contenteditable are equally safe', () => {
    const got = collect()
    const ta = document.createElement('textarea'); document.body.appendChild(ta)
    burst(GAR, { target: ta, suffix: 'Enter' })
    const ce = document.createElement('div'); ce.contentEditable = 'true'
    Object.defineProperty(ce, 'isContentEditable', { value: true })
    document.body.appendChild(ce)
    burst('ANOTHERCODE1', { target: ce, suffix: 'Enter' })
    expect(got).toEqual([])
  })

  it('human-speed typing is never mistaken for a scanner', () => {
    const got = collect()
    burst(GAR, { gapMs: 120, suffix: 'Enter' })   // 120ms/char — a person
    vi.advanceTimersByTime(500)
    expect(got).toEqual([])
  })

  it('a short burst is not a barcode', () => {
    const got = collect()
    burst('AB', { suffix: 'Enter' })
    vi.advanceTimersByTime(500)
    expect(got).toEqual([])
  })
})

// ── The sink ──────────────────────────────────────────────────────────────
describe('a field marked data-scan-sink is the scanner\'s, not the keyboard\'s', () => {
  it('Enter into the sink reaches the engine', () => {
    const got = collect()
    burst(GAR, { target: sink(), suffix: 'Enter' })
    expect(got).toEqual([GAR])
  })

  it('Tab and no-suffix reach it too', () => {
    let got = collect()
    burst(GAR, { target: sink(), suffix: 'Tab' })
    expect(got).toEqual([GAR])

    ScanEngine.resetForTests(); ScanEngine.start(); document.body.innerHTML = ''
    got = collect()
    burst('GAR000000000085', { target: sink(), suffix: null })
    vi.advanceTimersByTime(200)
    expect(got).toEqual(['GAR000000000085'])
  })

  it('the marker works on a child of the marked element', () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('data-scan-sink', '')
    const inner = document.createElement('input')
    wrap.appendChild(inner); document.body.appendChild(wrap)
    const got = collect()
    burst(GAR, { target: inner, suffix: 'Enter' })
    expect(got).toEqual([GAR])
  })

  it('the engine consumes the key, so the sink knows to stand down', () => {
    // This is what keeps one physical scan to one lookup.
    const el = sink()
    collect()
    let ev: KeyboardEvent | null = null
    el.addEventListener('keydown', (e) => { ev = e as KeyboardEvent })
    burst(GAR, { target: el, suffix: 'Enter' })
    expect(ev!.defaultPrevented).toBe(true)
  })
})

// ── One scan, one lookup ──────────────────────────────────────────────────
describe('one physical scan produces exactly one lookup', () => {
  it('the handler runs once per scan', () => {
    const got = collect()
    burst(GAR, { target: sink(), suffix: 'Enter' })
    expect(got).toHaveLength(1)
  })

  it('the engine dedupes a code repeated instantly', () => {
    const got = collect()
    burst(GAR, { target: sink(), suffix: 'Enter' })
    advance(100)
    burst(GAR, { target: sink(), suffix: 'Enter' })
    expect(got).toEqual([GAR])
  })

  it('but the same garment CAN be scanned again a moment later', () => {
    const got = collect()
    burst(GAR, { target: sink(), suffix: 'Enter' })
    advance(2000)
    burst(GAR, { target: sink(), suffix: 'Enter' })
    expect(got).toEqual([GAR, GAR])
  })

  it('a different garment always comes through', () => {
    const got = collect()
    burst(GAR, { target: sink(), suffix: 'Enter' })
    advance(50)
    burst('GAR000000000085', { target: sink(), suffix: 'Enter' })
    expect(got).toEqual([GAR, 'GAR000000000085'])
  })
})

// ── Diagnostics ───────────────────────────────────────────────────────────
describe('a real scan now proves the scanner exists', () => {
  it('the scan is recorded, so Hardware Manager stops saying "Presence not verified"', () => {
    diagnostics.reset()
    expect(ScanEngine.everScanned()).toBe(false)   // "Presence not verified"
    collect()
    burst(GAR, { target: sink(), suffix: 'Enter' })
    const snap = diagnostics.snapshot().scanner
    expect(snap.lastScanAt).not.toBeNull()
    expect(snap.lastBarcode).toBe(GAR)
    expect(ScanEngine.everScanned()).toBe(true)
  })

  it('and the scanner becomes the live rung of the ladder', () => {
    collect()
    burst(GAR, { target: sink(), suffix: 'Enter' })
    expect(ScanEngine.scannerPresent()).toBe(true)
    expect(ScanEngine.status()).toBe('SCANNER_READY')
  })

  it('nothing fakes presence — it only ever comes from a real dispatch', () => {
    const engine = read('src/lib/hardware/scan-engine.ts')
    expect(engine).toContain('diagnostics.recordScan(code, resolved, durationMs)')
    expect(engine.match(/diagnostics\.recordScan/g)).toHaveLength(1)
    expect(read('src/lib/hardware/diagnostics.ts')).not.toContain('everScanned = true')
  })
})

// ── Garment Lookup is wired to that one pipeline ──────────────────────────
describe('Garment Lookup takes the scanner from the engine and nowhere else', () => {
  it('the Scan Mode bar is the sink, and there is only one of them', () => {
    expect(LOOKUP).toContain('useScanSink(')
    expect(LOOKUP).toContain('inputRef: scanInputRef')
    // The existing visible bar — no second, hidden scanner input was added.
    expect(LOOKUP.match(/\{\.\.\.scanProps\}/g)).toHaveLength(1)
  })

  it('the scanner path no longer calls search() behind the engine', () => {
    // The lookup runs from the ENGINE's dispatch, not from a keystroke.
    expect(LOOKUP).toContain('const scanProps = useScanSink((q) => { setCode(q); void search(q) }')
    expect(LOOKUP).not.toContain('onKeyDown={handleScanInput}')
    expect(LOOKUP).not.toContain('ScanEngine.attach')
  })

  it('the sink is armed only in Scan Mode', () => {
    expect(LOOKUP).toContain('enabled: scanMode')
  })

  it('there is no second deduplication implementation', () => {
    expect(LOOKUP).not.toContain('scanGuard')
    expect(LOOKUP).not.toContain('lastTime')
  })

  it('the bar stays focused, so the operator never clicks before a scan', () => {
    expect(LOOKUP).toContain('scanInputRef.current.focus()')
    expect(LOOKUP).toContain('}, [scanMode, result])')
    expect(LOOKUP).toContain('Ready — scan a garment (no need to click here)')
  })

  it('manual search, camera and the lookup API are untouched', () => {
    expect(LOOKUP).toContain('/api/laundry/scan?barcode=${encodeURIComponent(query)}')
    expect(LOOKUP).toContain('Search by GAR, ITM, Order Number, or Customer')
    expect(LOOKUP).toContain('<CameraScanner')
    // No businessId is invented client-side; the server resolves the tenant.
    expect(LOOKUP).not.toContain('businessId=${')
  })

  it('a code that finds nothing shows "No garment found", never a blank page', () => {
    expect(LOOKUP).toContain('setSearched(true)')
    expect(LOOKUP).toContain('!loading && searched && !result')
    expect(LOOKUP).toContain('No garment found')
  })
})

// ── Every station is on the one pipeline ──────────────────────────────────
//
// Audited scan surfaces, and what each one is:
//
//   Garment Lookup            sink            laundry-garment-lookup.tsx
//   Washing / Dry Cleaning    shared scanner  laundry-barcode-scanner.tsx
//   Dry & Quality Check       shared scanner  ″
//   Sorting                   shared scanner  ″  + bag modal
//   Ironing / Folding         sink            laundry-finishing-workstation.tsx
//   Console & Receive         sink ×2         laundry-processing-console.tsx
//   Packing & QR              sink            laundry-store-stages.tsx
//   Transit / Dispatch        sink            ″
//   Store Receive             sink            ″
//   Order Detail item scan    sink            laundry-order-detail.tsx
//   Store Audit · Pickup Bags · Bag Management · Transit  bag modal (bag-scanner.tsx)
//   Barcode Generation, Ready for Delivery  — no scan surface (list + print only)
//   Hardware Manager          scanOnce()      diagnostic probe, unchanged
//
// Executive, Store Admin and Customer PWAs are deliberately out of scope.
describe('every Laundry OS scan station submits through the shared engine', () => {
  const STATIONS: [string, string][] = [
    ['Garment Lookup', 'src/components/laundry/views/laundry-garment-lookup.tsx'],
    ['Workstations (Wash / Dry Clean / QC / Sorting)', 'src/components/laundry/laundry-barcode-scanner.tsx'],
    ['Bag & packet QR modal (Store Audit, Pickup Bags, Bag Mgmt, Transit)', 'src/components/laundry/bag-scanner.tsx'],
    ['Ironing / Folding', 'src/components/laundry/views/laundry-finishing-workstation.tsx'],
    ['Console & Receive / Dispatch to Store', 'src/components/laundry/views/laundry-processing-console.tsx'],
    ['Packing, Transit-Dispatch, Store Receive', 'src/components/laundry/views/laundry-store-stages.tsx'],
    ['Order Detail item scan', 'src/components/laundry/views/laundry-order-detail.tsx'],
  ]

  for (const [name, file] of STATIONS) {
    it(`${name} is bound to ScanEngine`, () => {
      const src = read(file)
      expect(src).toMatch(/useScanSink|data-scan-sink/)
    })
  }

  it('no station reaches its workflow straight from a keystroke', () => {
    // The pattern that made every station Enter-only and invisible to
    // diagnostics: onKeyDown === "Enter" → the screen's action.
    for (const [name, file] of STATIONS) {
      const src = read(file)
      expect(src, name).not.toMatch(/onKeyDown=\{?\(e[^)]*\) =>\s*e\.key === "Enter" &&/)
      expect(src, name).not.toMatch(/if \(e\.key === "Enter"\) \{?\s*(submit|search|resolve|runPack|dispatchByScan)\(/)
    }
  })

  it('no station carries its own duplicate guard any more', () => {
    // Two windows (2000ms here, 900ms in the engine) disagreeing about what
    // counts as one scan is how a re-scan silently did nothing.
    for (const [name, file] of STATIONS) {
      const src = read(file)
      expect(src, name).not.toContain('lastTime.current')
      expect(src, name).not.toMatch(/const guard = \(code: string\)/)
    }
  })

  it('nobody re-implemented the wedge timing', () => {
    for (const [, file] of STATIONS) {
      const src = read(file)
      expect(src).not.toContain('MAX_WEDGE_GAP')
      expect(src).not.toContain('isFastBurst')
    }
    // …and no second engine was created.
    for (const forbidden of ['ProcessingScanEngine', 'WashingScanner', 'DispatchScanner', 'QCLookupScanner']) {
      for (const [, file] of STATIONS) expect(read(file)).not.toContain(forbidden)
    }
  })

  it('the camera still works, and is recorded like any other scan', () => {
    expect(read('src/components/laundry/laundry-barcode-scanner.tsx')).toContain('ScanEngine.submit(code.trim().toUpperCase(), "CAMERA")')
    expect(read('src/components/laundry/bag-scanner.tsx')).toContain('"CAMERA"')
    expect(read('src/components/laundry/views/laundry-garment-lookup.tsx')).toContain('<CameraScanner')
  })

  it('manual entry and existing lookups are untouched', () => {
    // Every station keeps its own workflow call; only the way the code
    // ARRIVES changed.
    expect(read('src/components/laundry/views/laundry-store-stages.tsx')).toContain('runPack(')
    expect(read('src/components/laundry/views/laundry-processing-console.tsx')).toContain('lookupAndReceive(')
    expect(read('src/components/laundry/views/laundry-finishing-workstation.tsx')).toContain('resolve(')
    expect(read('src/components/laundry/views/laundry-order-detail.tsx')).toContain('/api/laundry/scan?barcode=')
  })

  it('no station invents a businessId for the scanner to carry', () => {
    // A scanner supplies a code; the server decides whose garment it is.
    for (const [name, file] of STATIONS) {
      const src = read(file)
      const sink = src.slice(Math.max(0, src.indexOf('useScanSink')))
      expect(sink.slice(0, 400), name).not.toContain('businessId:')
    }
  })

  it('the shared binding holds no scanner logic of its own', () => {
    const hook = read('src/lib/hardware/use-scan-sink.ts')
    expect(hook).toContain('ScanEngine.submit(')
    expect(hook).toContain('ScanEngine.attach(')
    for (const forbidden of ['setTimeout', 'Date.now', 'lastCode', 'gaps', 'fetch(']) {
      expect(hook, forbidden).not.toContain(forbidden)
    }
  })
})

// ── Station families, through the real engine ─────────────────────────────
describe('a scan reaches the station handler, whatever the terminator', () => {
  /** One physical scan at a station: the sink is focused, as it is in the app. */
  const station = (handler: (code: string) => void) => {
    const el = sink()
    ScanEngine.attach((e) => handler(e.code))
    return el
  }

  it.each([
    ['Enter', 'Enter' as const],
    ['Tab', 'Tab' as const],
  ])('garment barcode at a processing workstation — %s suffix', (_label, suffix) => {
    const seen: string[] = []
    const el = station((c) => seen.push(c))
    burst(GAR, { target: el, suffix })
    expect(seen).toEqual([GAR])
  })

  it('garment barcode at a processing workstation — no suffix', () => {
    const seen: string[] = []
    const el = station((c) => seen.push(c))
    burst(GAR, { target: el, suffix: null })
    vi.advanceTimersByTime(200)
    expect(seen).toEqual([GAR])
  })

  it('a packet/bag QR at Packing, Dispatch or Store Receive', () => {
    const seen: string[] = []
    const el = station((c) => seen.push(c))
    burst('PKT-000123', { target: el, suffix: 'Tab' })
    expect(seen).toEqual(['PKT-000123'])
  })

  it('an order number at Console & Receive', () => {
    const seen: string[] = []
    const el = station((c) => seen.push(c))
    burst('ORD-STR-LND-BUS-202606-0005-002-000002', { target: el, suffix: 'Enter' })
    expect(seen).toEqual(['ORD-STR-LND-BUS-202606-0005-002-000002'])
  })

  it('an ITM code at Order Detail', () => {
    const seen: string[] = []
    const el = station((c) => seen.push(c))
    burst('ITM-ORD-STR-LND-BUS-202606-0005-002-000002-0001', { target: el, suffix: 'Enter' })
    expect(seen).toEqual(['ITM-ORD-STR-LND-BUS-202606-0005-002-000002-0001'])
  })

  it('a dialog opened over a station takes the scanner, and hands it back', () => {
    // The bag/packet modal over a workstation — one scanner, never two
    // handlers firing on the same scan.
    const workstation: string[] = []
    const modal: string[] = []
    const el = sink()
    ScanEngine.attach((e) => workstation.push(e.code))
    const closeModal = ScanEngine.attach((e) => modal.push(e.code))

    burst(GAR, { target: el, suffix: 'Enter' })
    expect(modal).toEqual([GAR])
    expect(workstation).toEqual([])

    closeModal()
    advance(2000)
    burst(GAR, { target: el, suffix: 'Enter' })
    expect(workstation).toEqual([GAR])
    expect(modal).toEqual([GAR])
  })

  it('one physical scan is one station action, everywhere', () => {
    let calls = 0
    const el = station(() => { calls += 1 })
    burst(GAR, { target: el, suffix: 'Enter' })
    expect(calls).toBe(1)
  })

  it('and it is recorded once, whichever station received it', () => {
    diagnostics.reset()
    const el = station(() => {})
    burst('PKT-000999', { target: el, suffix: 'Tab' })
    const snap = diagnostics.snapshot().scanner
    expect(snap.lastBarcode).toBe('PKT-000999')
    expect(snap.totalScansToday).toBe(1)
  })
})
