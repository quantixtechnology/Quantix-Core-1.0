import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { browserName, deviceApiResult, scannerResult, RESULT_LABEL, RESULT_TONE } from '@/lib/hardware'

// ============================================================================
// Laundry OS tells the truth about hardware.
//
// A browser cannot enumerate what is plugged into a computer — that is a
// security boundary, not a fault — and a keyboard-emulation barcode scanner is
// a keyboard to it, provable only by scanning. So "failed", "you have not
// granted this yet" and "cannot be seen from here" are three different answers,
// and collapsing them is how working hardware gets reported as broken.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const HW = read('src/components/laundry/views/laundry-hardware-manager.tsx')

// ── The vocabulary ────────────────────────────────────────────────────────
describe('a hardware result is one of five things', () => {
  it('only a genuine failure is red', () => {
    expect(RESULT_TONE.FAIL).toBe('bad')
    expect(RESULT_TONE.PASS).toBe('ok')
    // States, not faults.
    expect(RESULT_TONE.NOT_AVAILABLE).toBe('info')
    expect(RESULT_TONE.PERMISSION_REQUIRED).toBe('info')
    expect(RESULT_TONE.NOT_DETECTABLE).toBe('info')
  })

  it('each answer reads as itself', () => {
    expect(RESULT_LABEL.PERMISSION_REQUIRED).toBe('Permission required')
    expect(RESULT_LABEL.NOT_DETECTABLE).toBe('Not detectable')
    expect(RESULT_LABEL.NOT_AVAILABLE).toBe('Not available')
  })
})

// ── Device APIs ───────────────────────────────────────────────────────────
describe('WebUSB, WebHID and Web Serial', () => {
  it('supported with a granted device → Pass', () => {
    expect(deviceApiResult(true, 1)).toBe('PASS')
    expect(deviceApiResult(true, 4)).toBe('PASS')
  })

  it('supported with nothing granted → Permission required, NEVER Fail', () => {
    // Nothing has been attempted, so nothing has failed.
    expect(deviceApiResult(true, 0)).toBe('PERMISSION_REQUIRED')
    expect(deviceApiResult(true, 0)).not.toBe('FAIL')
  })

  it('unsupported browser → Not available, NEVER Fail', () => {
    // Safari and Firefox ship none of these. That is not a fault either.
    expect(deviceApiResult(false, 0)).toBe('NOT_AVAILABLE')
    expect(deviceApiResult(false, 3)).toBe('NOT_AVAILABLE')
    expect(deviceApiResult(false, 0)).not.toBe('FAIL')
  })
})

// ── The scanner is the exception ──────────────────────────────────────────
describe('the barcode scanner is proved by scanning, not by enumeration', () => {
  it('a real scan is the proof', () => {
    expect(scannerResult(true)).toBe('PASS')
  })

  it('no scan yet → Not detectable, never Fail and never Disconnected', () => {
    expect(scannerResult(false)).toBe('NOT_DETECTABLE')
    expect(scannerResult(false)).not.toBe('FAIL')
  })

  it('it is never reported as a USB device', () => {
    const t = read('src/lib/hardware/terminal.ts')
    const fn = t.slice(t.indexOf('export function scannerResult'))
    for (const forbidden of ['usb', 'hid', 'serial', 'getDevices']) {
      expect(fn.toLowerCase(), forbidden).not.toContain(forbidden)
    }
    // Its row is keyboard emulation, and its status comes from the engine.
    expect(HW).toContain('scannerResult(ScanEngine.everScanned())')
    expect(HW).toContain('<td className="px-3 py-2 text-slate-500">Keyboard Emulation</td>')
  })

  it('the existing scan pipeline is untouched', () => {
    const engine = read('src/lib/hardware/scan-engine.ts')
    expect(engine).toContain('diagnostics.recordScan(code, resolved, durationMs)')
    expect(engine.match(/diagnostics\.recordScan/g)).toHaveLength(1)
    expect(engine).toContain('data-scan-sink')
    expect(engine).toContain('e.key === "Enter" || e.key === "Tab"')
    expect(read('src/lib/hardware/use-scan-sink.ts')).toContain('ScanEngine.submit(')
    // Ordinary typing still belongs to the person typing.
    expect(engine).toContain('if (isScanSink(el)) return false')
  })
})

// ── The terminal ──────────────────────────────────────────────────────────
describe('this terminal, as the browser reports it', () => {
  it('names the browsers an operator will recognise', () => {
    expect(browserName('Mozilla/5.0 ... Chrome/120 Safari/537.36')).toBe('Chrome')
    // Chrome's UA contains "Safari", so order matters.
    expect(browserName('Mozilla/5.0 ... Version/17 Safari/605.1.15')).toBe('Safari')
    expect(browserName('Mozilla/5.0 ... Chrome/120 Safari/537.36 Edg/120')).toBe('Microsoft Edge')
    expect(browserName('Mozilla/5.0 ... Firefox/121')).toBe('Firefox')
    expect(browserName('')).toBe('Browser')
  })

  it('installation, display mode, HTTPS and the service worker are shown', () => {
    for (const row of ['Application', 'Installation', 'Display mode', 'Browser', 'Secure (HTTPS)', 'Service worker']) {
      expect(HW, row).toContain(`k="${row}"`)
    }
    expect(HW).toContain('Installed — running as an app')
  })

  it('a service worker counts only when it controls this page', () => {
    expect(read('src/lib/hardware/terminal.ts')).toContain('!!navigator.serviceWorker?.controller')
  })

  it('nothing sensitive is exposed', () => {
    // The header promises "no token, no session, no tenant" — check the CODE
    // keeps that promise rather than the prose that states it.
    const code = read('src/lib/hardware/terminal.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    for (const forbidden of ['token', 'session', 'businessId', 'fetch(', 'prisma', 'localStorage', 'apiKey']) {
      expect(code.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase())
    }
  })
})

// ── Connected hardware ────────────────────────────────────────────────────
describe('Connected Hardware lists what the browser can name, and says so', () => {
  it('the table carries the columns an operator needs', () => {
    for (const col of ['Device', 'Type', 'Connection', 'Status', 'Manufacturer', 'Model', 'Product ID', 'Last used']) {
      expect(HW, col).toContain(`"${col}"`)
    }
  })

  it('an absent device is never called disconnected', () => {
    expect(HW).toContain('an absent\n                device is not a disconnected one')
    expect(HW).toContain('A browser is not allowed to enumerate everything plugged into the computer')
  })

  it('Scan for Hardware leads to the chooser, and explains itself', () => {
    expect(HW).toContain('Scan for Hardware')
    expect(HW).toContain('Your browser only lets Laundry OS see hardware after you grant it')
    expect(HW).toContain('Nothing is scanned silently')
    expect(HW).toContain('permission required')
  })

  it('only granted devices are listed — the existing registry, unchanged', () => {
    const reg = read('src/lib/hardware/registry.ts')
    expect(reg).toContain('n.usb?.getDevices()')
    expect(reg).toContain('n.hid?.getDevices()')
    expect(reg).toContain('n.serial?.getPorts()')
    // Pairing is user-initiated only.
    expect(reg).toContain('export async function requestUsbDevice')
    expect(reg).toContain('export async function requestHidDevice')
    expect(reg).toContain('export async function requestSerialPort')
  })

  it('the physical-connection limit is still stated', () => {
    expect(HW).toContain('<Row k="Physical connection" v={physical.label} />')
    expect(HW).toContain('PHYSICAL_CONNECTION_NOTE')
  })
})

// ── Scope ─────────────────────────────────────────────────────────────────
describe('hardware discovery changes nothing else', () => {
  it('no hardware inventory is sent anywhere', () => {
    // Everything here is read in the browser and rendered; nothing is posted.
    const t = read('src/lib/hardware/terminal.ts')
    expect(t).not.toContain('fetch(')
    expect(read('src/lib/hardware/registry.ts')).not.toContain('fetch(')
  })

  it('RBAC, tenant resolution and the workspace gate are untouched', () => {
    expect(read('src/lib/laundry-rbac.ts')).toContain('export async function requireLaundryLevel')
    expect(read('src/lib/workspace-tenant.ts')).toContain('export function resolveWorkspaceTenant')
    expect(read('src/lib/pwa-tenant-boundary.ts')).toContain('if (host.kind === "unknown-tenant") return false')
  })

  it('the device guard and the other PWAs are unchanged', () => {
    expect(read('src/components/laundry/laundry-device-guard.tsx')).toContain('Laundry OS is designed for Desktop &amp; Tablet')
    expect(read('src/app/store/page.tsx')).toContain('LaundryStoreApp')
  })
})
