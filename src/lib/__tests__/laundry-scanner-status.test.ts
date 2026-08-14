import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { scannerStatus, physicalConnection, PHYSICAL_CONNECTION_UNKNOWN, NOT_VERIFIED_DETAIL } from '@/lib/hardware'

// ============================================================================
// A scan proves a scanner WAS here. It never proves one IS here.
//
// A keyboard-emulation scanner is a keyboard to the browser: no handle, nothing
// to poll, no disconnect event. Unplug it and every fact the page holds stays
// exactly as it was — so the dashboard went on reading "Active · last 8:33:36
// AM" with the scanner lying unplugged on the desk. The detection was right;
// the word was wrong.
//
// Nothing about how a scan is captured changes here. This is what Hardware
// Manager is entitled to SAY about the result.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const HW = read('src/components/laundry/views/laundry-hardware-manager.tsx')
const at = (iso: string) => new Date(iso).toLocaleTimeString('en-IN')
const SCAN_AT = '2026-08-13T08:33:36.000Z'

describe('what the terminal may claim', () => {
  it('Test 3 — never scanned here: Not Verified', () => {
    const s = scannerStatus({ lastScanAt: null, recentlyScanned: false }, at)
    expect(s.state).toBe('NOT_VERIFIED')
    expect(s.verified).toBe(false)
    expect(s.tile).toBe('Not Verified')
    expect(s.tileNote).toBe(NOT_VERIFIED_DETAIL)
    expect(s.status).toBe('Scanner Not Verified')
    expect(NOT_VERIFIED_DETAIL).toBe('No barcode scan has been received on this terminal.')
  })

  it('Test 1 — a real scan verifies the scanner', () => {
    const s = scannerStatus({ lastScanAt: SCAN_AT, recentlyScanned: true }, at)
    expect(s.state).toBe('VERIFIED')
    expect(s.verified).toBe(true)
    expect(s.status).toBe('Scanner Verified')
    // The tile names what was verified — a SCAN — and keeps the evidence on
    // its own line, so the green dot beside it cannot be read as "plugged in".
    expect(s.tile).toBe('Scan Verified')
    expect(s.tileNote).toBe(`Last scan: ${at(SCAN_AT)}`)
  })

  it('Test 2 — unplugged after a successful scan: still Verified, never Active', () => {
    // Nothing observable changes when the cable is pulled, so the honest
    // reading is unchanged historical verification — not a demotion, and
    // certainly not a claim that it is running.
    const s = scannerStatus({ lastScanAt: SCAN_AT, recentlyScanned: false }, at)
    expect(s.verified).toBe(true)
    expect(s.state).toBe('AWAITING_SCAN')
    expect(s.status).toBe(`Awaiting Scan · last successful scan ${at(SCAN_AT)}`)
    expect(s.status).not.toContain('Active')
    expect(s.status).not.toContain('Disconnected')
    expect(s.tile).toBe('Scan Verified')
    expect(s.tileNote).toBe(`Last scan: ${at(SCAN_AT)}`)
  })

  it('the word "Active" is gone from every scanner state', () => {
    for (const input of [
      { lastScanAt: null, recentlyScanned: false },
      { lastScanAt: SCAN_AT, recentlyScanned: false },
      { lastScanAt: SCAN_AT, recentlyScanned: true },
    ]) {
      const s = scannerStatus(input, at)
      expect(`${s.tile} ${s.tileNote} ${s.status}`).not.toMatch(/\bActive\b/)
    }
  })

  it('Awaiting Scan is about silence, not about the cable', () => {
    const s = scannerStatus({ lastScanAt: SCAN_AT, recentlyScanned: false }, at)
    expect(s.status).toContain('last successful scan')
    expect(s.status.toLowerCase()).not.toContain('disconnect')
    expect(s.status.toLowerCase()).not.toContain('unplug')
    expect(s.status.toLowerCase()).not.toContain('offline')
  })

  it('recency comes from the caller — no second timer is invented here', () => {
    const src = read('src/lib/hardware/scanner-status.ts')
    expect(src).not.toContain('Date.now')
    expect(src).not.toContain('setTimeout')
    expect(src).not.toContain('IDLE_MS')
    expect(src).toContain('recentlyScanned')
  })
})

describe('physical connection is reported only where it can be observed', () => {
  it('a keyboard wedge is never claimed to be connected or disconnected', () => {
    // Wording sharpened to "…by browser" so the limit names whose limit it is.
    expect(physicalConnection(null)).toEqual({ detectable: false, label: PHYSICAL_CONNECTION_UNKNOWN })
    expect(physicalConnection({ source: 'KEYBOARD_WEDGE' })).toEqual({ detectable: false, label: 'Not detectable by browser' })
  })

  it('a device held through a real API may report its connection', () => {
    for (const source of ['WEBHID', 'WEBUSB', 'WEBSERIAL', 'BLUETOOTH'] as const) {
      const p = physicalConnection({ source, connection: 'USB' })
      expect(p.detectable).toBe(true)
      expect(p.label).toContain('Connected')
    }
  })

  it('the answer is never derived from scan history', () => {
    const src = read('src/lib/hardware/scanner-status.ts')
    const fn = src.slice(src.indexOf('export function physicalConnection'))
    expect(fn).not.toContain('lastScanAt')
    expect(fn).not.toContain('everScanned')
  })
})

describe('Hardware Manager shows exactly that', () => {
  it('the dashboard tile reads "Scan Verified" over "Last scan: <time>"', () => {
    expect(HW).not.toContain('`Active · last ${time(diag.scanner.lastScanAt)}`')
    expect(HW).toContain('value={scan.tile} note={scan.tileNote}')
  })

  it('the tile never states a device claim, only a scan claim', () => {
    const s = scannerStatus({ lastScanAt: SCAN_AT, recentlyScanned: true }, at)
    for (const word of ['Connected', 'Plugged', 'Online', 'Active', 'Present']) {
      expect(`${s.tile} ${s.tileNote}`, word).not.toContain(word)
    }
  })

  it('the Scanner page carries the physical-connection row and its explanation', () => {
    expect(HW).toContain('<Row k="Physical connection" v={physical.label} />')
    expect(HW).toContain('PHYSICAL_CONNECTION_NOTE')
  })

  it('the tile and the Scanner page read the SAME state', () => {
    // Two readings of one scanner is how they came to disagree in the first place.
    expect(HW).toContain('const scan = scannerStatus(')
    expect(HW).toContain('recentlyScanned: ScanEngine.scannerPresent()')
    expect(HW.match(/scannerStatus\(/g)).toHaveLength(1)
  })

  it('"Scanner Verified · Active" is gone', () => {
    expect(HW).not.toContain('Scanner Verified · Active')
  })

  it('the scan evidence itself is still shown', () => {
    expect(HW).toContain('<Row k="Last scan"')
    expect(HW).toContain('<Row k="Last barcode"')
    // "Type" became "Input", which now names the transport a barcode actually
    // arrives on rather than assuming keyboard emulation.
    expect(HW).toContain('<Row k="Input" v={inputMode} />')
    expect(HW).toContain('scannerInputMode(scanner, ScanEngine.everScanned())')
  })
})

describe('nothing outside Hardware Manager status wording moved', () => {
  it('the capture pipeline is untouched', () => {
    const engine = read('src/lib/hardware/scan-engine.ts')
    expect(engine).toContain('diagnostics.recordScan(code, resolved, durationMs)')
    expect(engine).toContain('data-scan-sink')
    expect(engine).toContain('e.key === "Enter" || e.key === "Tab"')
    // Test 4/5: verification still comes from a real dispatch, and only from one.
    expect(engine.match(/diagnostics\.recordScan/g)).toHaveLength(1)
    expect(read('src/lib/hardware/use-scan-sink.ts')).toContain('ScanEngine.submit(')
  })

  it('the health chip already spoke correctly and was left alone', () => {
    const health = read('src/lib/hardware/health.ts')
    expect(health).toContain('Scanner Verified')
    expect(health).not.toMatch(/\bActive\b/)
  })

  it('the status module touches no workflow, API or device', () => {
    const src = read('src/lib/hardware/scanner-status.ts')
    for (const forbidden of ['fetch(', 'prisma', 'navigator', 'ScanEngine', 'businessId']) {
      expect(src, forbidden).not.toContain(forbidden)
    }
  })
})

// ── Pairing is a browser capability, never a permission ───────────────────
//
// The same terminal, the same tenant, two accounts:
//
//   Chrome · Super Admin      Discover Hardware · Pair USB · Pair HID · Pair Serial
//   Safari · Business Owner   Discover Hardware
//
// which reads as "the owner is not allowed to connect hardware". It is not:
// WebUSB, WebHID and Web Serial are Chromium-only, Safari ships none of them,
// and the buttons are gated on navigator.usb / .hid / .serial alone. No role
// gets them in Safari and every role gets them in Chrome. What was wrong was
// leaving the gap unexplained.
describe('the Hardware Manager treats every role identically', () => {
  it('nothing in the screen consults a role, permission or owner flag', () => {
    // `role` appears only as a PRINTER role (label vs document), and
    // `permission` only as the browser's camera permission.
    for (const forbidden of [
      'useRuntimeAuth', 'screenLevels', 'isOwner', 'requireLaundry',
      'resolveUserPermissions', 'laundry.hardware', 'roleCode',
    ]) {
      expect(HW, forbidden).not.toContain(forbidden)
    }
  })

  it('the pairing buttons are gated on the browser APIs and nothing else', () => {
    expect(HW).toContain('{caps.webUsb && <Button')
    expect(HW).toContain('{caps.webHid && <Button')
    expect(HW).toContain('{caps.webSerial && <Button')
    expect(HW).toContain('const canPair = caps.webUsb || caps.webHid || caps.webSerial')
  })

  it('capability detection asks the browser, not the session', () => {
    const caps = read('src/lib/hardware/capabilities.ts')
    expect(caps).toContain('webUsb: !!n.usb')
    expect(caps).toContain('webHid: !!n.hid')
    expect(caps).toContain('webSerial: !!n.serial')
    // Prose mentions permissions; the CODE must not consult one. Strip the
    // comments and the explanatory strings before looking.
    const code = caps
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/"[^"]*"/g, '""')
    for (const forbidden of ['role', 'permission', 'businessId', 'fetch(', 'prisma']) {
      expect(code.toLowerCase(), forbidden).not.toContain(forbidden)
    }
  })

  it('a browser that cannot pair says so, instead of showing an empty toolbar', () => {
    expect(HW).toContain('{!canPair && (')
    expect(HW).toContain('Pairing is not available in this browser.')
    // …and answers the question the missing buttons provoke.
    expect(HW).toContain('no role can pair a device here')
    expect(HW).toContain('needs no pairing at all')
  })
})
