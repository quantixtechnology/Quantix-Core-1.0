import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Active is the master's word, and everything forward-looking asks it.
//
// One flag — LaundryService.isActive — decides what appears in the Pricing
// Matrix, its template, its export, the import and the customer storefront.
// Nothing keeps a second list, nothing infers availability from licensing, and
// nothing names a service.
//
// The other half matters more: deactivating is not deleting. Pricing rules
// survive it, so reactivating brings the prices back untouched, and an order
// placed while a service was active goes on reading correctly for ever because
// the line item snapshots the NAME rather than pointing at a row that can
// change under it.
//
// These are the assertions the audit rested on. They exist so the rule cannot
// quietly come apart at one surface while holding at the others.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const MATRIX_API   = read('src/app/api/laundry/pricing-matrix/route.ts')
const MATRIX_UI    = read('src/components/laundry/views/laundry-pricing-matrix.tsx')
const IMPORT_API   = read('src/app/api/laundry/pricing-matrix/import/route.ts')
const STOREFRONT   = read('src/app/api/core/storefront/laundry-home/route.ts')
const SERVICES_API = read('src/app/api/laundry/services/route.ts')
const SERVICE_ONE  = read('src/app/api/laundry/services/[id]/route.ts')
const SCHEMA       = read('prisma/schema.prisma')

describe('1 & 2 · the Pricing Matrix shows active services and nothing else', () => {
  it('the columns come from the master, filtered on isActive', () => {
    expect(MATRIX_API).toContain('prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true }')
  })

  it('categories and garments obey the same flag', () => {
    expect(MATRIX_API).toContain('prisma.laundryCategory.findMany({ where: { businessId: lbId, isActive: true }')
    expect(MATRIX_API).toContain('prisma.laundryGarment.findMany({ where: { businessId: lbId, isActive: true }')
  })

  it('the filter is on the SERVER, not a client afterthought', () => {
    // The screen renders whatever the API returns; there is no second list.
    expect(MATRIX_UI).toContain('/api/laundry/pricing-matrix?businessId=')
    expect(MATRIX_UI).not.toContain('isActive')
  })

  it('no service is named anywhere in the matrix or its API', () => {
    // Read the CODE: a comment explaining subscription inclusion names a
    // service as an example, which is prose, not a hardcoded column.
    const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    for (const src of [MATRIX_API, MATRIX_UI, IMPORT_API]) {
      for (const name of ['Wash & Fold', 'Steam Iron', 'Dry Clean', 'Shoe Cleaning', 'Carpet Cleaning']) {
        expect(codeOnly(src)).not.toContain(name)
      }
    }
  })

  it('licensing is not used as a stand-in for active', () => {
    // A licensed service can still be switched off; they are different questions.
    expect(MATRIX_API).not.toContain('isScreenEnabled')
    expect(MATRIX_API).not.toContain('resolveLicence')
  })
})

describe('3 · deactivating is not deleting', () => {
  it('a service referenced by orders is deactivated, never removed', () => {
    expect(SERVICE_ONE).toContain('data: { isActive: false }')
    expect(SERVICE_ONE).toContain('reason: "referenced-by-orders"')
  })

  it('that path does not touch pricing, so reactivating restores it', () => {
    const soft = SERVICE_ONE.slice(SERVICE_ONE.indexOf('reason: "referenced-by-orders"') - 400, SERVICE_ONE.indexOf('reason: "referenced-by-orders"'))
    expect(soft).not.toContain('laundryPricingRule.deleteMany')
  })

  it('pricing rows are keyed by service, so they simply stop being read', () => {
    expect(MATRIX_API).toContain('prisma.laundryPricingRule.findMany({ where: { businessId: lbId, isActive: true, garmentId: { not: null }, serviceId: { not: null }')
  })
})

describe('5 · template and export carry the same columns as the screen', () => {
  it('headers are built from the services the API returned', () => {
    // Three columns per service now — price, billing type, and subscription.
    expect(MATRIX_UI).toContain('...services.flatMap((s) => [s.name, `${s.name} Type`, `${s.name} Subscription`])')
    expect(MATRIX_UI).toContain('[services],')
  })

  it('both the template and the export come from that same active list', () => {
    const exp = MATRIX_UI.slice(MATRIX_UI.indexOf('const exportMatrix'))
    expect(exp).toContain('aoa_to_sheet([headers, ...rows])')
    // The template is generated server-side — the community build of `xlsx`
    // drops the styling, freeze pane and dropdowns it needs — but from the SAME
    // canonical active-service query, so there is still no second list.
    const tpl = readFileSync(join(process.cwd(), 'src/app/api/laundry/pricing-matrix/template/route.ts'), 'utf8')
    expect(tpl).toContain('isActive: true')
    expect(tpl).toContain('`${s.name} Type`')
    expect(tpl).toContain('`${s.name} Subscription`')
  })

  it('so a deactivated service cannot reach either', () => {
    // There is no second source to drift from — one array feeds screen,
    // template and export.
    expect(MATRIX_UI.match(/\.\.\.services\.flatMap/g)?.length).toBeGreaterThanOrEqual(2)
  })
})

describe('6 · an import cannot revive a service, and says so plainly', () => {
  it('only active services can be matched', () => {
    expect(IMPORT_API).toContain('prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true }, select: { id: true, name: true } })')
    expect(IMPORT_API).toContain('const svcByName = new Map(services.map((s) => [s.name.trim().toLowerCase(), s]))')
  })

  it('a deactivated service is named as deactivated, not as unknown', () => {
    // "Unknown service" sends the user hunting for a typo in a service that is
    // sitting right there in the master.
    expect(IMPORT_API).toContain('is deactivated in Services. Reactivate it there to price it — importing cannot.')
    expect(IMPORT_API).toContain('inactiveByName.has(svcKey)')
  })

  it('a genuinely unknown service still reads as unknown', () => {
    expect(IMPORT_API).toContain('`Unknown service "${c.service}".`')
  })

  it('the import never writes to a service', () => {
    // No reactivation, no duplicate, no status change — it only reads them.
    const svcWrites = IMPORT_API.match(/laundryService\.(create|update|upsert|delete|updateMany)/g)
    expect(svcWrites).toBeNull()
  })

  it('the row is rejected rather than silently dropped', () => {
    expect(IMPORT_API).toContain('errors.push({')
  })
})

describe('7 · customers never see a deactivated service', () => {
  it('the storefront filters on the same flag', () => {
    expect(STOREFRONT).toContain('prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true, displayOnWebsite: true }')
  })

  it('garments too', () => {
    expect(STOREFRONT).toContain('prisma.laundryGarment.findMany({ where: { businessId: lbId, isActive: true }')
  })

  it('website visibility is a SEPARATE switch from active', () => {
    // A service can be active for the counter and still not advertised online;
    // that is a second, deliberate flag, not a substitute for isActive.
    expect(SCHEMA).toContain('displayOnWebsite')
  })
})

describe('8 · history keeps working when a service is switched off', () => {
  it('an order line snapshots the names, it does not point at them', () => {
    const item = SCHEMA.slice(SCHEMA.indexOf('model LaundryOrderItem {'), SCHEMA.indexOf('model LaundryOrderItem {') + 1400)
    expect(item).toContain('serviceName      String')
    expect(item).toContain('garmentName      String')
    // The ids are optional — the record survives without them.
    expect(item).toContain('serviceId        String?')
    expect(item).toContain('garmentId        String?')
  })

  it('so nothing about deactivation can reach an existing order', () => {
    const item = SCHEMA.slice(SCHEMA.indexOf('model LaundryOrderItem {'), SCHEMA.indexOf('model LaundryOrderItem {') + 1400)
    expect(item).not.toMatch(/serviceName\s+String\?/)
  })
})

describe('9 & 10 · one pattern, applied the same way everywhere', () => {
  it('management screens opt IN to seeing inactive rows', () => {
    // The default is active-only; a management screen asks for more.
    expect(SERVICES_API).toContain('const includeInactive = sp.get("includeInactive") === "1"')
    expect(SERVICES_API).toContain('...(includeInactive ? {} : { isActive: true })')
  })

  it('services, categories and garments all use isActive', () => {
    // The whole model block, not a fixed window — LaundryService is long and
    // its flag sits past the first 1200 characters.
    const modelBlock = (name: string) => {
      const start = SCHEMA.indexOf(`model ${name} {`)
      return SCHEMA.slice(start, SCHEMA.indexOf('\n}', start))
    }
    for (const model of ['LaundryService', 'LaundryCategory', 'LaundryGarment']) {
      expect(modelBlock(model)).toContain('isActive')
    }
  })

  it('no new visibility mechanism was introduced', () => {
    for (const src of [MATRIX_API, IMPORT_API, STOREFRONT]) {
      expect(src).not.toContain('hiddenServices')
      expect(src).not.toContain('visibleServices')
    }
  })
})
