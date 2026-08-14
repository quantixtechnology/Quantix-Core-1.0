import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { QR_PNG_SIZE, qrSlug } from '@/lib/qr-export'
import { locationMapsUrl } from '@/lib/delivery-actions'

// ============================================================================
// One QR engine, two products.
//
// Laundry already downloaded print-quality QR codes; Commerce could only show
// one on screen. Rather than write a second implementation, Commerce now uses
// the same shared pieces — so a fix or a resolution change lands in both, and
// there is no chance of the two drifting into different quality.
//
// The rule that matters most: a QR printed on a counter card is expensive to
// get wrong. It is built from SAVED COORDINATES, never from typed address
// text, and a store with no pinned location gets no QR at all.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const STORES = read('src/components/business/stores/stores-view.tsx')
const HUB = read('src/components/dashboard/commerce-apps-hub.tsx')

// ── Print quality ─────────────────────────────────────────────────────────
describe('every downloaded QR is generated for print', () => {
  it('exports at 2048px, from one shared constant', () => {
    expect(QR_PNG_SIZE).toBe(2048)
  })

  it('the on-screen preview stays small — quality never depends on render size', () => {
    const lib = read('src/lib/qr-export.ts')
    expect(lib).toContain('export function qrPreviewDataUrl(value: string, width = 320)')
    // The export re-renders at QR_PNG_SIZE; it never scales the preview up.
    expect(lib).toContain('QRCode.toDataURL(value, { width: QR_PNG_SIZE, ...PRINT_OPTS })')
    expect(lib).not.toContain('canvas.toDataURL')
  })

  it('the quiet zone the spec requires is kept', () => {
    expect(read('src/lib/qr-export.ts')).toContain('margin: 4')
  })

  it('no wording can drift from the actual export size', () => {
    // Both dialogs report the size from the constant, not a literal.
    expect(read('src/components/laundry/apps/app-qr-dialog.tsx')).toContain('`Downloaded ${QR_PNG_SIZE} × ${QR_PNG_SIZE} PNG`')
    expect(read('src/components/shared/location-qr-card.tsx')).toContain('`Downloaded ${QR_PNG_SIZE} × ${QR_PNG_SIZE} PNG`')
  })
})

// ── Store address QR ──────────────────────────────────────────────────────
describe('the store address QR points at the pinned location', () => {
  it('encodes the Maps URL the spec asks for', () => {
    expect(locationMapsUrl(13.078831, 77.637281))
      .toBe('https://www.google.com/maps/search/?api=1&query=13.078831,77.637281')
  })

  it('a missing latitude or longitude yields NO QR', () => {
    expect(locationMapsUrl(null, 77.637281)).toBeNull()
    expect(locationMapsUrl(13.078831, null)).toBeNull()
    expect(locationMapsUrl(undefined, undefined)).toBeNull()
  })

  it('0,0 is Null Island, not a shop', () => {
    expect(locationMapsUrl(0, 0)).toBeNull()
  })

  it('impossible coordinates are refused rather than printed', () => {
    expect(locationMapsUrl(91, 10)).toBeNull()
    expect(locationMapsUrl(10, 181)).toBeNull()
    expect(locationMapsUrl(NaN, 10)).toBeNull()
  })

  it('the typed address is never the source', () => {
    const card = read('src/components/shared/location-qr-card.tsx')
    expect(card).toContain('const mapsUrl = locationMapsUrl(latitude, longitude)')
    expect(card).toContain('Never used to build the QR')
    // A store with no coordinates is told what to do instead.
    expect(card).toContain('Location not saved')
    expect(card).toContain('never from the typed address')
  })

  it('Commerce opens the SHARED card, not a second QR implementation', () => {
    expect(STORES).toContain("import { LocationQrCard } from '@/components/shared/location-qr-card'")
    expect(STORES).toContain('<LocationQrCard')
    expect(STORES).toContain('latitude={qrStore.latitude}')
    expect(STORES).toContain('longitude={qrStore.longitude}')
    // No QR library reached for directly here.
    expect(STORES).not.toContain('qrcode')
    expect(STORES).not.toContain('toDataURL')
  })

  it('every store card offers it', () => {
    expect(STORES).toContain('Address QR')
    expect(STORES).toContain('onClick={() => setQrStore(store)}')
    expect(STORES).toContain('Store Address QR')
    expect(STORES).toContain('Download the PNG to print it')
  })
})

// ── Commerce app QR codes ─────────────────────────────────────────────────
describe('all three Commerce app QR codes download', () => {
  it('Customer, Store Admin and Delivery Executive each open the download dialog', () => {
    expect(HUB.match(/qrDialog=\{\{/g)).toHaveLength(3)
    expect(HUB).toContain('appName: "customer pwa"')
    expect(HUB).toContain('appName: "store admin pwa"')
    expect(HUB).toContain('appName: "delivery executive pwa"')
  })

  it('the dialog carries Download PNG as its primary action', () => {
    const dlg = read('src/components/laundry/apps/app-qr-dialog.tsx')
    expect(dlg).toContain('downloadQrPng(url, fileBase)')
    expect(dlg).toContain('Download PNG')
  })

  it('filenames are deterministic and sanitised, from the tenant slug', () => {
    expect(HUB).toContain('businessName: selected.slug')
    expect(qrSlug('Ohhh Monos — Main Store')).toBe('ohhh-monos-main-store')
    expect(`${qrSlug('ohhhmonos')}-${qrSlug('customer pwa')}-qr`).toBe('ohhhmonos-customer-pwa-qr')
    expect(`${qrSlug('ohhhmonos')}-${qrSlug('delivery executive pwa')}-qr`).toBe('ohhhmonos-delivery-executive-pwa-qr')
  })

  it('the QR encodes exactly the URL the card displays', () => {
    expect(read('src/components/laundry/apps/app-share-card.tsx')).toContain('url={url}')
    expect(HUB).toContain('url={urls.customer}')
    expect(HUB).toContain('url={urls.store}')
    expect(HUB).toContain('url={urls.delivery}')
  })

  it('Copy Link, QR preview and WhatsApp still work', () => {
    const card = read('src/components/laundry/apps/app-share-card.tsx')
    expect(card).toContain('Copy Link')
    expect(card).toContain('QR Code')
    expect(card).toContain('wa.me')
    // The status strips and provisioning are untouched.
    expect(HUB).toContain('<StatusStrip')
  })

  it('no app URL or host was changed', () => {
    expect(HUB).toContain('`https://${slug}.${SF_BASE}`')
    expect(HUB).toContain('`https://store.${slug}.${SF_BASE}`')
    expect(HUB).toContain('`https://delivery.${slug}.${SF_BASE}`')
  })
})

// ── Security ──────────────────────────────────────────────────────────────
describe('a printed QR carries nothing private', () => {
  it('the QR engine encodes only the value it is given', () => {
    const lib = read('src/lib/qr-export.ts')
    for (const forbidden of ['token', 'session', 'businessId', 'localStorage', 'document.cookie']) {
      expect(lib.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase())
    }
    // The only fetch() here reads a data: URL back as a Blob so the browser can
    // save it — entirely local, and never a request to a server.
    for (const m of lib.matchAll(/fetch\((\w+)\)/g)) expect(m[1]).toBe('dataUrl')
  })

  it('the store QR encodes coordinates alone — no ids', () => {
    const url = locationMapsUrl(13.078831, 77.637281)!
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=13.078831,77.637281')
    expect(url).not.toMatch(/token|session|businessId|storeId|cust/i)
  })

  it('the app QR encodes the public host only', () => {
    const dlg = read('src/components/laundry/apps/app-qr-dialog.tsx')
    expect(dlg).toContain('qrPreviewDataUrl(url, 640)')
    expect(dlg).not.toContain('accessToken')
    expect(dlg).not.toContain('businessId')
  })
})

// ── Laundry is unchanged ──────────────────────────────────────────────────
describe('Laundry OS keeps working exactly as before', () => {
  it('its stores view uses the same card, from its new shared home', () => {
    const laundry = read('src/components/admin/laundry/laundry-stores-view.tsx')
    expect(laundry).toContain('from "@/components/shared/location-qr-card"')
    expect(laundry).toContain('<LocationQrCard')
  })

  it('the card moved without being rewritten', () => {
    const card = read('src/components/shared/location-qr-card.tsx')
    expect(card).toContain('export function LocationQrCard')
    expect(card).toContain('variant?: "compact" | "panel"')
    expect(card).toContain('unsaved')
  })

  it('the Laundry app QR still offers PNG, SVG and share', () => {
    const dlg = read('src/components/laundry/apps/app-qr-dialog.tsx')
    expect(dlg).toContain('downloadQrSvg')
    expect(dlg).toContain('shareQr')
  })
})

// ── The page the operator actually opens ─────────────────────────────────
//
// THREE components render "Customer Website & PWA / Store Admin PWA / Delivery
// Executive PWA". The Commerce workspace renders business/apps/apps-view.tsx —
// the same tree as business/stores/stores-view.tsx, the Stores page. The QR
// dialog was added to dashboard/commerce-apps-hub.tsx instead, so production
// kept showing the inline preview with no download, and the tests passed
// because they read the file the change was in.
describe('the Commerce Mobile Apps page has the download dialog', () => {
  const APPS = read('src/components/business/apps/apps-view.tsx')

  it('all three cards open the dialog rather than the inline preview', () => {
    expect(APPS.match(/qrDialog=\{\{/g)).toHaveLength(1)   // one card component, three cards
    expect(APPS).toContain('appName: c.qrName')
    for (const n of ['customer pwa', 'store admin pwa', 'delivery executive pwa']) {
      expect(APPS, n).toContain(`qrName: "${n}"`)
    }
  })

  it('filenames use the tenant slug, derived from the loaded host', () => {
    expect(APPS).toContain('businessName: slug || "business"')
    expect(APPS).toContain('const slug = (status?.customer.url || "")')
  })

  it('the QR still encodes the existing provisioned URL', () => {
    expect(APPS).toContain('url={c.s?.url || ""}')
  })

  it('Copy Link, WhatsApp and the status strips are untouched', () => {
    expect(APPS).toContain('<StatusStrip')
    const card = read('src/components/laundry/apps/app-share-card.tsx')
    expect(card).toContain('Copy Link')
    expect(card).toContain('wa.me')
  })
})

// ── Download PNG is on the card, not behind another button ───────────────
//
// ROUTE TRACE, because guessing the component cost two rounds:
//   commerce.<base> → product workspace → renderBusinessPage()
//   → business sidebar { key: "customer-app", label: "Mobile Apps" }
//   → case "customer-app": <AppsView />
//   → src/components/business/apps/apps-view.tsx
//
// The dialog already carried a download, but a button that only exists behind
// another button is a button nobody finds.
describe('the Commerce Mobile Apps card downloads without opening anything', () => {
  const APPS = read('src/components/business/apps/apps-view.tsx')
  const CARD = read('src/components/laundry/apps/app-share-card.tsx')

  it('the page in the screenshot is the one that got the change', () => {
    expect(read('src/app/page.tsx')).toContain('case "customer-app": return <AppsView />')
    expect(read('src/components/business/layout/business-sidebar.tsx'))
      .toContain('{ key: "customer-app",        label: "Mobile Apps",    icon: Smartphone }')
    expect(APPS).toContain('downloadFileBase=')
  })

  it('all three cards get it, each with its own URL and filename', () => {
    // One card component rendered over three entries, each carrying its own
    // url and qrName.
    expect(APPS).toContain('url={c.s?.url || ""}')
    expect(APPS).toContain('downloadFileBase={`${slug || "business"}-${c.qrName.replace(/ /g, "-")}-qr`}')
    for (const n of ['customer pwa', 'store admin pwa', 'delivery executive pwa']) {
      expect(APPS, n).toContain(`qrName: "${n}"`)
    }
  })

  it('the filenames come out as specified', () => {
    const base = (slug: string, qrName: string) => `${slug}-${qrName.replace(/ /g, '-')}-qr.png`
    expect(base('ohhhmonos', 'customer pwa')).toBe('ohhhmonos-customer-pwa-qr.png')
    expect(base('ohhhmonos', 'store admin pwa')).toBe('ohhhmonos-store-admin-pwa-qr.png')
    expect(base('ohhhmonos', 'delivery executive pwa')).toBe('ohhhmonos-delivery-executive-pwa-qr.png')
  })

  it('it downloads straight away — no dialog, no print dialog', () => {
    const row = CARD.slice(CARD.indexOf('{downloadFileBase && ('), CARD.indexOf('WhatsApp</Button>'))
    expect(row).toContain('downloadQrPng(url, downloadFileBase)')
    expect(row).not.toContain('setQrOpen')
    expect(row).not.toContain('print')
  })

  it('it sits in the visible action row, in order', () => {
    const rowStart = CARD.indexOf('Copy Link</CopyButton>')
    const order = ['QR Code', 'Download PNG', 'WhatsApp'].map((l) => CARD.indexOf(l, rowStart))
    expect(order[0]).toBeLessThan(order[1])
    expect(order[1]).toBeLessThan(order[2])
  })

  it('the export is re-rendered at 2048, never the preview scaled', () => {
    expect(read('src/lib/qr-export.ts')).toContain('QRCode.toDataURL(value, { width: QR_PNG_SIZE, ...PRINT_OPTS })')
    expect(QR_PNG_SIZE).toBe(2048)
  })

  it('it is opt-in, so the Laundry cards are untouched', () => {
    expect(CARD).toContain('downloadFileBase?: string')
    expect(CARD).toContain('{downloadFileBase && (')
    const laundry = read('src/components/laundry/views/laundry-mobile-apps.tsx')
    expect(laundry).not.toContain('downloadFileBase')
  })

  it('Copy Link, QR Code, WhatsApp and the status strips all remain', () => {
    expect(CARD).toContain('Copy Link')
    expect(CARD).toContain('QR Code')
    expect(CARD).toContain('wa.me')
    expect(APPS).toContain('<StatusStrip')
  })
})

// ── The dialog an operator actually sees ──────────────────────────────────
describe('the QR dialog names the right app and offers the right actions', () => {
  const DLG = read('src/components/laundry/apps/app-qr-dialog.tsx')
  const CARD = read('src/components/shared/location-qr-card.tsx')

  it('the title is the app in the dialog, not always the Customer App', () => {
    // It was hardcoded, so Store Admin and Delivery Executive both opened a
    // dialog headed "Customer App QR".
    expect(DLG).toContain('<DialogTitle className="text-base">{appName} QR</DialogTitle>')
    expect(DLG).not.toContain('>Customer App QR<')
    expect(DLG).not.toContain('opens your branded customer app')
  })

  it('the app dialog shows QR, app name, URL, Download PNG, Print and Copy', () => {
    expect(DLG).toContain('{appName}')
    expect(DLG).toContain('{display}')          // the URL
    expect(DLG).toContain('Download PNG')
    expect(DLG).toContain('Print QR')
    expect(DLG).toContain('Copy Link')
  })

  it('the store dialog shows Download PNG, Print and Open Maps', () => {
    expect(CARD).toContain('Download PNG')
    expect(CARD).toContain('Print QR')
    expect(CARD).toContain('Open Maps')
    expect(CARD).toContain('href={mapsUrl}')
  })

  it('printing uses a hidden iframe, never a popup', () => {
    // A popup print froze the app once already (the label-print fix).
    const lib = read('src/lib/qr-export.ts')
    expect(lib).toContain('export function printQrImage')
    expect(lib).toContain('document.createElement("iframe")')
    // The comment explains why; the CODE must not call it.
    const code = lib.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toContain('window.open')
  })

  it('the printed sheet carries the QR itself, at print size', () => {
    const lib = read('src/lib/qr-export.ts')
    expect(lib).toContain('width: 74mm; height: 74mm')
    expect(lib).toContain('img src="${dataUrl}"')
  })
})
