import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { SCREEN_PAGE_MAP, defaultNavigationConfig } from '@/lib/laundry-nav-config'
import { allScreenKeys, isValidScreenKey } from '@/lib/laundry-rbac-registry'

// ============================================================================
// Categories and Garments are pricing-master DATA, not modules of their own.
// They are managed from Pricing and from the Excel import; the standalone
// entry points are gone. Services are NOT affected — they decide what the
// product offers, which is configuration.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const RETIRED = ['laundry.categories', 'laundry.garments']
const navKeys = () => defaultNavigationConfig().flatMap((s) => s.items.map((i) => i.screenKey))

describe('§6 + §10 · the standalone entry points are gone', () => {
  it('neither key is a navigable screen any more', () => {
    for (const key of RETIRED) {
      expect(SCREEN_PAGE_MAP[key]).toBeUndefined()
      expect(isValidScreenKey(key)).toBe(false)
      expect(allScreenKeys()).not.toContain(key)
    }
  })

  it('no default nav section still lists them', () => {
    const keys = navKeys()
    for (const key of RETIRED) expect(keys).not.toContain(key)
  })

  it('§11. no route renders them, so there are no dead links', () => {
    const router = read('src/components/laundry/laundry-page-router.tsx')
    expect(router).not.toContain('case "categories"')
    expect(router).not.toContain('case "garments"')
    for (const f of ['src/components/laundry/laundry-page-router.tsx', 'src/app/page.tsx']) {
      const src = read(f)
      expect(src).not.toContain('LaundryCategoriesMaster')
      expect(src).not.toContain('LaundryGarmentsMaster')
    }
  })

  it('the COMMERCE categories module is a different thing and is untouched', () => {
    // src/app/page.tsx has its own `case "categories"` rendering the business
    // CategoriesView. That is platform config for Commerce, not the laundry
    // pricing master, and §6 says only the redundant laundry entries go.
    const page = read('src/app/page.tsx')
    expect(page).toContain('case "categories": return <CategoriesView />')
    expect(page).toContain('components/business/categories/categories-view')
  })

  it('§11. existing tenants have the stored items DELETED, not left dangling', () => {
    const nav = read('src/lib/laundry-nav-config.ts')
    expect(nav).toContain('removeRetiredNavItems')
    expect(nav).toContain('laundry.categories')   // named in the retired list
    expect(nav).toContain('laundry.garments')
    expect(nav).toContain('laundryNavItem.deleteMany')
  })

  it('§7. Services and every other module are untouched', () => {
    const keys = navKeys()
    for (const kept of ['laundry.services', 'laundry.pricing', 'laundry.stores', 'laundry.staff', 'laundry.delivery_executives', 'laundry.orders', 'laundry.customers', 'laundry.reports']) {
      expect(keys).toContain(kept)
      expect(isValidScreenKey(kept)).toBe(true)
      expect(SCREEN_PAGE_MAP[kept]).toBeTruthy()
    }
  })
})

describe('§2 + §5 · garments are still managed, from Pricing', () => {
  it('the Garments master survives as a tab inside the pricing screen', () => {
    const engine = read('src/components/laundry/views/laundry-pricing-engine.tsx')
    expect(engine).toContain('LaundryGarmentsMaster')
    expect(engine).toContain('value="garments"')
  })

  it('the Pricing Matrix still edits code, name, category and per-service pricing', () => {
    const ui = read('src/components/laundry/views/laundry-pricing-matrix.tsx')
    expect(ui).toContain('Garment Name')
    expect(ui).toContain('Garment Code')
    expect(ui).toContain('Category')
    expect(ui).toContain('Included in Subscription')
  })

  it('§8. the underlying APIs are untouched — this was a UI consolidation', () => {
    // Both still exist and still guard on the pricing permission, which is why
    // retiring the two screen keys cost no access.
    expect(read('src/app/api/laundry/garments/route.ts')).toContain('laundry.pricing.edit_pricing')
    expect(read('src/app/api/laundry/categories/route.ts')).toContain('laundry.pricing.edit_pricing')
  })
})

describe('§10 · none of the pricing work regressed', () => {
  const imp = read('src/app/api/laundry/pricing-matrix/import/route.ts')
  const del = read('src/app/api/laundry/pricing-matrix/bulk-delete/route.ts')
  const tpl = read('src/app/api/laundry/pricing-matrix/template/route.ts')

  it('import still creates missing garments and reactivates archived ones', () => {
    expect(imp).toContain('laundryGarment.create')
    expect(imp).toContain('reactivate')
  })

  it('bulk delete still archives rather than destroys', () => {
    expect(del).toContain('isActive: false')
    expect(del).not.toContain('laundryGarment.deleteMany')
  })

  it('per garment x service subscription survives', () => {
    expect(imp).toContain('subscriptionIncluded')
    expect(tpl).toContain('`${s.name} Subscription`')
  })

  it('active services only, everywhere', () => {
    for (const src of [imp, tpl, read('src/app/api/laundry/pricing-matrix/route.ts')]) {
      expect(src).toContain('isActive: true')
    }
  })
})
