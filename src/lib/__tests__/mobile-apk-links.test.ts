import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The APK on a card is the APK for THAT app.
//
// URLs come from the mobile-provision pipeline that already exists — the
// apkUrl recorded on Deployment rows — not from a second APK registry and not
// hardcoded. Each card reads its own Deployment type, so a customer can never
// be handed the delivery build.
//
// A build that is not LIVE has no artifact, whatever URL its row carries, so
// the button says so rather than offering a 404.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const ROUTE = read('src/app/api/laundry/app-provisioning/route.ts')
const CARD = read('src/components/laundry/apps/app-share-card.tsx')
const VIEW = read('src/components/laundry/views/laundry-mobile-apps.tsx')

describe('the URL comes from the existing build pipeline', () => {
  it('it reads Deployment rows, not a new store', () => {
    expect(ROUTE).toContain('prisma.deployment.findMany')
    expect(ROUTE).toContain('type: { in: ["CUSTOMER_APP", "DELIVERY_APP", "ADMIN_APP"] }')
  })

  it('it prefers the pipeline apkUrl, falling back to liveUrl', () => {
    expect(ROUTE).toContain('typeof cfg.apkUrl === "string"')
    expect(ROUTE).toContain('const url = cfgApk ?? d.liveUrl ?? null')
  })

  it('nothing is hardcoded', () => {
    for (const src of [ROUTE, CARD, VIEW]) {
      expect(src).not.toMatch(/https?:\/\/[^\s"']*\.apk/)
    }
  })

  it('no second endpoint was created for it', () => {
    // This route had already resolved the platform business AND proved the
    // caller belongs to it; a separate call is another place to get that wrong.
    expect(ROUTE).toContain('guard.platformBusinessId')
  })
})

describe('each app gets its own build', () => {
  it('the three cards read three different deployment types', () => {
    expect(VIEW).toContain('apk={prov?.apk?.CUSTOMER_APP')
    expect(VIEW).toContain('apk={prov?.apk?.DELIVERY_APP')
    expect(VIEW).toContain('apk={prov?.apk?.ADMIN_APP')
  })

  it('Laundry OS gets none, having no artifact', () => {
    // Slice to the START of the next card, not its title — the apk prop is
    // written before the title, so a looser boundary swallows it.
    const os = VIEW.slice(VIEW.indexOf('title="Laundry OS"'), VIEW.indexOf('apk={prov?.apk?.ADMIN_APP'))
    expect(os).not.toContain('apk=')
  })

  it('the rows are scoped to the business of the caller', () => {
    expect(ROUTE).toContain('where: { businessId: guard.platformBusinessId')
  })
})

describe('an unavailable build says so', () => {
  it('only a LIVE build yields a URL', () => {
    expect(ROUTE).toContain('url: d.status === "LIVE" && url ? url : null')
  })

  it('the button is disabled and labelled when there is nothing to download', () => {
    expect(CARD).toContain('APK Not Available')
    expect(CARD).toContain('disabled title={apk.status')
  })

  it('a missing deployment row is treated as not built', () => {
    expect(VIEW).toContain('?? { url: null, status: "NOT_BUILT" }')
  })

  it('malformed hosting config yields no URL rather than a crash', () => {
    expect(ROUTE).toContain('/* malformed config is no URL, never a crash */')
  })
})

describe('the APK is downloadable AND sharable', () => {
  it('download is a real link, not a route into the PWA', () => {
    expect(CARD).toContain('<a href={apk.url} target="_blank" rel="noreferrer" download>')
    expect(CARD).toContain('Download APK')
  })

  it('the link can be copied and sent on', () => {
    expect(CARD).toContain('<CopyButton value={apk.url}')
    expect(CARD).toContain('Share APK')
    expect(CARD).toContain('const whatsappApk =')
  })

  it('existing PWA sharing is untouched', () => {
    // The APK carries its own message; folding it in would change what every
    // existing share sends.
    expect(CARD).toContain('const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\\n${url}`)}`, "_blank")')
    expect(CARD).toContain('<CopyButton value={url} label="Link"')
    expect(CARD).toContain('QR Code')
  })
})
