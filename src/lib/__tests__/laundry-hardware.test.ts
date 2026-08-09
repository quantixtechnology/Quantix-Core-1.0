import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ScanEngine } from '@/lib/hardware/scan-engine'
import { PrintEngine } from '@/lib/hardware/print-engine'
import { diagnostics } from '@/lib/hardware/diagnostics'
import { loadProfile, saveProfile, setRole, deviceForRole, setScannerPreferences, DEFAULT_SCANNER_PREFERENCES } from '@/lib/hardware/profiles'
import { eventLog } from '@/lib/hardware/event-log'
import { hardwareHealth } from '@/lib/hardware/health'
import { probeCapabilities } from '@/lib/hardware/capabilities'
import { browserPrintDevice, deviceSummary } from '@/lib/hardware/registry'
import { BROWSER_PRINT_ID } from '@/lib/hardware/types'

// ============================================================================
// The hardware layer sits under every scan and every print, so its contract is
// simple and absolute: a workflow hands over a code or a job and never learns
// which transport served it, and nothing here may ever block the workflow —
// an unidentifiable printer still prints, an absent scanner still lets someone
// type.
// ============================================================================

beforeEach(() => {
  ScanEngine.resetForTests()
  PrintEngine.resetForTests()
  diagnostics.reset()
  window.localStorage.clear()
})

describe('ScanEngine — dispatch', () => {
  it('delivers a scanned code to the attached handler', () => {
    const seen: string[] = []
    ScanEngine.attach((e) => seen.push(e.code))
    ScanEngine.submit('GAR-000123')
    expect(seen).toEqual(['GAR-000123'])
  })

  it('gives the scanner to the most recent attachment, so a dialog takes over', () => {
    const screen: string[] = []
    const dialog: string[] = []
    ScanEngine.attach((e) => screen.push(e.code))
    const closeDialog = ScanEngine.attach((e) => dialog.push(e.code))
    ScanEngine.submit('AAA')
    closeDialog()
    ScanEngine.submit('BBB')
    expect(dialog).toEqual(['AAA'])
    expect(screen).toEqual(['BBB'])
  })

  it('swallows the same code twice in quick succession', () => {
    const seen: string[] = []
    ScanEngine.attach((e) => seen.push(e.code))
    expect(ScanEngine.submit('DUP-1')).toBe(true)
    expect(ScanEngine.submit('DUP-1')).toBe(false)
    expect(seen).toEqual(['DUP-1'])
  })

  it('ignores blank input rather than dispatching an empty scan', () => {
    const seen: string[] = []
    ScanEngine.attach((e) => seen.push(e.code))
    expect(ScanEngine.submit('   ')).toBe(false)
    expect(seen).toEqual([])
  })

  it('records every scan for the diagnostics panel', () => {
    ScanEngine.attach(() => {})
    ScanEngine.submit('GAR-1', 'CAMERA')
    ScanEngine.submit('GAR-2', 'MANUAL')
    const s = diagnostics.snapshot().scanner
    expect(s.totalScansToday).toBe(2)
    expect(s.lastBarcode).toBe('GAR-2')
    expect(s.lastSource).toBe('MANUAL')
  })
})

describe('ScanEngine — the ladder', () => {
  it('falls to manual entry when there is no scanner and no camera', () => {
    ScanEngine.setCameraAvailable(false)
    expect(ScanEngine.status()).toBe('MANUAL_ENTRY')
  })

  it('prefers the camera over manual entry', () => {
    ScanEngine.setCameraAvailable(true)
    expect(ScanEngine.status()).toBe('CAMERA_READY')
  })

  it('prefers a scanner over the camera once one has been seen', () => {
    ScanEngine.setCameraAvailable(true)
    ScanEngine.submit('WEDGE-1', 'USB_SCANNER')
    expect(ScanEngine.status()).toBe('SCANNER_READY')
  })

  it('names Bluetooth only when a Bluetooth scanner is actually paired', () => {
    ScanEngine.submit('X1', 'USB_SCANNER')
    expect(ScanEngine.statusLabel()).toBe('Scanner ready')
    ScanEngine.setKnownScannerConnection('BLUETOOTH')
    expect(ScanEngine.statusLabel()).toBe('Bluetooth scanner ready')
  })

  it('reports status changes to subscribers', () => {
    const seen: string[] = []
    ScanEngine.subscribe((s) => seen.push(s))
    ScanEngine.setCameraAvailable(true)
    expect(seen).toContain('CAMERA_READY')
  })
})

describe('ScanEngine — one-shot test capture', () => {
  it('resolves with the next scan', async () => {
    const p = ScanEngine.scanOnce(1000)
    ScanEngine.submit('TEST-CODE')
    await expect(p).resolves.toMatchObject({ code: 'TEST-CODE' })
  })

  it('resolves null when nothing is scanned, instead of hanging', async () => {
    vi.useFakeTimers()
    const p = ScanEngine.scanOnce(5000)
    vi.advanceTimersByTime(5001)
    await expect(p).resolves.toBeNull()
    vi.useRealTimers()
  })

  it('hands the scanner back afterwards', async () => {
    const screen: string[] = []
    ScanEngine.attach((e) => screen.push(e.code))
    const p = ScanEngine.scanOnce(1000)
    ScanEngine.submit('ONE')
    await p
    ScanEngine.submit('TWO')
    expect(screen).toEqual(['TWO'])
  })
})

describe('PrintEngine — routing', () => {
  it('falls back to browser print when no default is configured', () => {
    expect(PrintEngine.resolveTarget('BARCODE')).toBe(BROWSER_PRINT_ID)
  })

  it('uses the store default once one is bound', () => {
    PrintEngine.setStore('store-a')
    setRole('store-a', 'BARCODE', 'usb:0x1234:0x5678:')
    expect(PrintEngine.resolveTarget('BARCODE')).toBe('usb:0x1234:0x5678:')
  })

  it('honours a one-time override without changing the saved default', () => {
    PrintEngine.setStore('store-a')
    setRole('store-a', 'BARCODE', 'printer-default')
    expect(PrintEngine.resolveTarget('BARCODE', 'printer-once')).toBe('printer-once')
    expect(deviceForRole('store-a', 'BARCODE')).toBe('printer-default')
  })

  it('keeps roles independent, so labels and invoices can differ', () => {
    setRole('store-a', 'BARCODE', 'label-printer')
    setRole('store-a', 'INVOICE', 'office-laser')
    expect(deviceForRole('store-a', 'BARCODE')).toBe('label-printer')
    expect(deviceForRole('store-a', 'INVOICE')).toBe('office-laser')
  })
})

describe('PrintEngine — offline queue', () => {
  it('holds a job instead of dropping it when the printer is offline', async () => {
    PrintEngine.setOffline('cable unplugged')
    const sent = await PrintEngine.print({ role: 'BARCODE', html: '<p>label</p>', isLabel: true })
    expect(sent).toBe(false)
    expect(PrintEngine.pending()).toHaveLength(1)
  })

  it('records the failure so the technician can see why', () => {
    PrintEngine.setOffline('cable unplugged')
    expect(diagnostics.snapshot().printer.lastError).toBe('cable unplugged')
  })

  it('a queued job can be cancelled', async () => {
    PrintEngine.setOffline()
    await PrintEngine.print({ role: 'BARCODE', html: '<p>a</p>' })
    PrintEngine.cancel(PrintEngine.pending()[0].id)
    expect(PrintEngine.pending()).toHaveLength(0)
    expect(PrintEngine.allJobs()[0].status).toBe('CANCELLED')
  })

  it('keeps every job visible with its status, not just the pending ones', async () => {
    PrintEngine.setOffline()
    await PrintEngine.print({ role: 'BARCODE', html: '<p>1</p>', title: 'first' })
    await PrintEngine.print({ role: 'BARCODE', html: '<p>2</p>', title: 'second' })
    expect(PrintEngine.allJobs().map((j) => j.title)).toEqual(['second', 'first'])
    expect(PrintEngine.allJobs().every((j) => j.status === 'PENDING')).toBe(true)
    expect(PrintEngine.queueLength()).toBe(2)
  })

  it('a cancelled job can be retried', async () => {
    PrintEngine.setOffline()
    await PrintEngine.print({ role: 'BARCODE', html: '<p>a</p>', title: 'retry-me' })
    const id = PrintEngine.pending()[0].id
    PrintEngine.cancel(id)
    await PrintEngine.retry(id)
    // Still offline, so it goes back to PENDING rather than printing.
    expect(PrintEngine.allJobs()[0].status).toBe('PENDING')
  })

  it('reports offline status to subscribers', () => {
    let calls = 0
    PrintEngine.subscribe(() => { calls++ })
    PrintEngine.setOffline()
    expect(calls).toBeGreaterThan(0)
    expect(PrintEngine.status()).toBe('OFFLINE')
  })
})

describe('diagnostics', () => {
  it("counts labels and documents separately for the day's tally", () => {
    diagnostics.recordPrint('BARCODE', 'LABEL', 3)
    diagnostics.recordPrint('INVOICE', 'DOCUMENT')
    const p = diagnostics.snapshot().printer
    expect(p.labelsPrintedToday).toBe(3)
    expect(p.documentsPrintedToday).toBe(1)
    expect(p.lastPrintRole).toBe('INVOICE')
  })

  it('averages scan duration across samples', () => {
    diagnostics.recordScan('A', 'USB_SCANNER', 100)
    diagnostics.recordScan('B', 'USB_SCANNER', 200)
    expect(diagnostics.snapshot().scanner.averageScanMs).toBe(150)
  })

  it('survives storage being unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => diagnostics.recordScan('A', 'MANUAL')).not.toThrow()
    spy.mockRestore()
  })
})

describe('profiles', () => {
  it('keeps a separate profile per store', () => {
    setRole('store-a', 'BARCODE', 'tsc-te244')
    setRole('store-b', 'BARCODE', 'zebra-zd220')
    expect(deviceForRole('store-a', 'BARCODE')).toBe('tsc-te244')
    expect(deviceForRole('store-b', 'BARCODE')).toBe('zebra-zd220')
  })

  it('clearing a role returns the terminal to browser printing', () => {
    setRole('store-a', 'BARCODE', 'tsc-te244')
    setRole('store-a', 'BARCODE', null)
    expect(deviceForRole('store-a', 'BARCODE')).toBeNull()
  })

  it('an unconfigured terminal is a working terminal', () => {
    expect(loadProfile('never-configured').printers).toEqual({})
  })

  it('round-trips a saved profile', () => {
    saveProfile({ storeId: 's1', printers: { QR: 'q1' }, labelSize: '60 × 40 mm', scanner: DEFAULT_SCANNER_PREFERENCES })
    expect(loadProfile('s1').labelSize).toBe('60 × 40 mm')
  })

  // Older builds wrote profiles without a scanner block; they must still load.
  it('fills in preferences missing from a profile saved by an older build', () => {
    window.localStorage.setItem('qx-hardware-profile-v1:legacy', JSON.stringify({ storeId: 'legacy', printers: {} }))
    expect(loadProfile('legacy').scanner).toEqual(DEFAULT_SCANNER_PREFERENCES)
  })

  it('stores scanner preferences per store', () => {
    setScannerPreferences('store-a', { fallback: 'MANUAL', autoDetect: false })
    expect(loadProfile('store-a').scanner.fallback).toBe('MANUAL')
    expect(loadProfile('store-a').scanner.autoDetect).toBe(false)
    expect(loadProfile('store-b').scanner).toEqual(DEFAULT_SCANNER_PREFERENCES)
  })
})

describe('honesty about what the browser exposes', () => {
  it('always offers browser print as a target', () => {
    const d = browserPrintDevice()
    expect(d.id).toBe(BROWSER_PRINT_ID)
    expect(d.status).toBe('ONLINE')
  })

  it('says so plainly when a device reports no model, rather than guessing', () => {
    expect(deviceSummary(browserPrintDevice())).toMatch(/model unknown/i)
  })

  it('reports only vendor and product the device actually declared', () => {
    const summary = deviceSummary({
      ...browserPrintDevice(), manufacturer: 'TSC', model: null, vendorId: 0x1203, productId: 0x0230,
    })
    expect(summary).toContain('TSC')
    expect(summary).toContain('0x1203')
    expect(summary).not.toMatch(/TE244/) // never inferred from the vendor id
  })

  it('probes capabilities without requesting any permission', () => {
    const c = probeCapabilities()
    expect(typeof c.webUsb).toBe('boolean')
    expect(typeof c.browserPrint).toBe('boolean')
  })
})

describe('scanner preferences steer the ladder', () => {
  it('pins the fallback to manual entry when the administrator chooses it', () => {
    ScanEngine.setCameraAvailable(true)
    ScanEngine.applyPreferences({ fallback: 'MANUAL' })
    expect(ScanEngine.status()).toBe('MANUAL_ENTRY')
  })

  it('a present scanner still outranks a manual fallback', () => {
    ScanEngine.applyPreferences({ fallback: 'MANUAL' })
    ScanEngine.submit('X', 'USB_SCANNER')
    expect(ScanEngine.status()).toBe('SCANNER_READY')
  })

  it('reports whether a scanner is currently present', () => {
    expect(ScanEngine.scannerPresent()).toBe(false)
    ScanEngine.submit('X', 'USB_SCANNER')
    expect(ScanEngine.scannerPresent()).toBe(true)
  })
})

describe('event log', () => {
  it('records newest first', () => {
    eventLog.record('SCANNER_CONNECTED', 'first')
    eventLog.record('PRINT_OK', 'second')
    expect(eventLog.all().map((e) => e.message)).toEqual(['second', 'first'])
    expect(eventLog.latest()?.message).toBe('second')
  })

  it('classifies severity so a failure stands out', () => {
    eventLog.record('PRINT_FAILED', 'boom')
    eventLog.record('PRINTER_OFFLINE', 'gone')
    eventLog.record('SCAN', 'ok')
    expect(eventLog.all().find((e) => e.message === 'boom')?.level).toBe('ERROR')
    expect(eventLog.all().find((e) => e.message === 'gone')?.level).toBe('WARN')
    expect(eventLog.all().find((e) => e.message === 'ok')?.level).toBe('INFO')
  })

  it('counts only today’s errors', () => {
    eventLog.record('PRINT_FAILED', 'a')
    eventLog.record('SCAN', 'b')
    expect(eventLog.errorCount()).toBe(1)
  })

  it('searches message, type and detail', () => {
    eventLog.record('PRINT_OK', 'Label printed', 'TSC TE244')
    expect(eventLog.search('te244')).toHaveLength(1)
    expect(eventLog.search('print_ok')).toHaveLength(1)
    expect(eventLog.search('nothing')).toHaveLength(0)
  })

  it('filters by level', () => {
    eventLog.record('PRINT_FAILED', 'bad')
    eventLog.record('SCAN', 'good')
    expect(eventLog.search('', 'ERROR')).toHaveLength(1)
    expect(eventLog.search('', 'ALL')).toHaveLength(2)
  })

  it('exports CSV with a header and escaped quotes', () => {
    eventLog.record('PRINT_OK', 'He said "go"')
    const csv = eventLog.toCsv()
    expect(csv.split('\n')[0]).toBe('Timestamp,Level,Type,Message,Detail')
    expect(csv).toContain('""go""')
  })

  it('stays bounded so it can never grow without limit', () => {
    for (let i = 0; i < 520; i++) eventLog.record('SCAN', `s${i}`)
    expect(eventLog.all().length).toBe(500)
    expect(eventLog.latest()?.message).toBe('s519')
  })
})

describe('health rollup — one verdict for the header and the dashboard', () => {
  it('is healthy with a scanner present and nothing queued', () => {
    ScanEngine.submit('X', 'USB_SCANNER')
    expect(hardwareHealth().level).toBe('HEALTHY')
  })

  it('is critical when the printer is offline, because that blocks the counter', () => {
    ScanEngine.submit('X', 'USB_SCANNER')
    PrintEngine.setOffline('unplugged')
    const h = hardwareHealth()
    expect(h.level).toBe('CRITICAL')
    expect(h.label).toBe('Printer Offline')
  })

  it('is only degraded when the scanner is missing, because typing still works', () => {
    ScanEngine.setCameraAvailable(false)
    const h = hardwareHealth()
    expect(h.level).toBe('DEGRADED')
    expect(h.issues).toContain('Scanner Missing')
  })

  it('reports the queue length it shares with the queue view', async () => {
    PrintEngine.setOffline()
    await PrintEngine.print({ role: 'BARCODE', html: '<p>x</p>' })
    expect(hardwareHealth().queueLength).toBe(1)
  })
})

afterEach(() => { vi.useRealTimers() })
