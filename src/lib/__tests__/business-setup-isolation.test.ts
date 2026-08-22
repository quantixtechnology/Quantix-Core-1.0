import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { businessCategoryLabel, getProductCategories } from '@/lib/products/product-categories'
import { commerceCategoryLabel } from '@/lib/commerce/commerce-categories'

// ============================================================================
// The business on the screen is the business in the state.
//
// One wizard component serves Create and Manage for every tenant, and it read
// its business id into useState — which runs once, at mount. Both cases render
// the same component at the same position in the same switch, so React reused
// the instance across them and the id never moved. Everything downstream — the
// loaded record, the form, the Business Category field, every save — went on
// answering for the business before it, under a header naming the new one.
//
// Separately: the same stored category was spelled two ways. The read-only
// field labelled it through the COMMERCE vocabulary, which does not contain
// LAUNDRY and falls back to the raw enum, while the product-scoped list gave it
// its real name. "LAUNDRY" here and "Laundry & Dry Cleaning" there reads like
// one business showing another's data, and is what makes the leak plausible on
// sight.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const PAGE   = read('src/app/page.tsx')
const WIZARD = read('src/components/admin/businesses/business-management-wizard.tsx')
const FIELD  = read('src/components/admin/businesses/commerce-category-field.tsx')

describe('a different business is a different instance', () => {
  it('both render sites key the wizard by its business', () => {
    expect(PAGE).toContain('key={`create:${resumeBusinessId ?? "new"}`}')
    expect(PAGE).toContain('key={`manage:${manageBusinessId ?? "none"}`}')
  })

  it('the key changes with the business, not with the mode', () => {
    // Keying on the mode alone ("create"/"manage") would still reuse one
    // instance across two businesses, which is the bug.
    const create = PAGE.slice(PAGE.indexOf('case "create-business"'), PAGE.indexOf('case "account-billing"'))
    expect(create).toContain('resumeBusinessId')
    expect(create).toContain('manageBusinessId')
  })
})

describe('the wizard follows its prop instead of freezing it', () => {
  it('the id is resynced when the prop changes', () => {
    expect(WIZARD).toContain('setBizId(businessId)')
    expect(WIZARD).toContain('}, [businessId])')
  })

  it('the previous business is dropped, not left on screen', () => {
    // Without this, the old record paints under the new heading for as long as
    // the fetch takes — which is exactly long enough to be believed.
    const sync = WIZARD.slice(WIZARD.indexOf('setBizId(businessId)'), WIZARD.indexOf('}, [businessId])'))
    expect(sync).toContain('setBiz(null)')
    expect(sync).toContain('setProvStatus(null)')
    expect(sync).toContain("setForm({ country: 'India', primaryColor: '#10B981' })")
  })

  it('creating a business still keeps the id it was given', () => {
    // The create flow calls setBizId(id) after POST while the prop stays
    // undefined; a resync keyed on the prop must not undo that.
    expect(WIZARD).toContain('setBizId(id)')
    expect(WIZARD).not.toContain('}, [businessId, bizId])')
  })

  it('every load is addressed to one id', () => {
    expect(WIZARD).toContain('const load = useCallback(async (id: string)')
    expect(WIZARD).toContain('list.find((b) => b.id === id)')
  })

  it('the category field is told which business it is for', () => {
    expect(WIZARD).toContain('<CommerceCategoryField businessId={bizId ?? null}')
  })
})

describe('one stored category, one spelling', () => {
  it('a laundry category is named, not spelled out in enum', () => {
    expect(businessCategoryLabel('LAUNDRY', 'LAUNDRY')).toBe('Laundry & Dry Cleaning')
    // What it used to render as, everywhere the Commerce labeller was used.
    expect(commerceCategoryLabel('LAUNDRY')).toBe('LAUNDRY')
  })

  it('Commerce categories are unchanged', () => {
    expect(businessCategoryLabel('COMMERCE', 'GROCERY')).toBe('Grocery')
    expect(businessCategoryLabel('COMMERCE', 'MEAT_DELIVERY')).toBe('Meat Delivery')
  })

  it('a category outside its product still resolves rather than blanking', () => {
    // Preserved, never rewritten: an existing value that does not belong to the
    // product is shown as it is, not replaced with a guess.
    expect(businessCategoryLabel('LAUNDRY', 'GROCERY')).toBe('Grocery')
    expect(businessCategoryLabel(null, 'ECOMMERCE')).toBe('General E-Commerce')
  })

  it('nothing was renamed to achieve it', () => {
    // The label already existed in the product vocabulary; this only reads it.
    expect(getProductCategories('LAUNDRY')).toEqual([
      { value: 'LAUNDRY', label: 'Laundry & Dry Cleaning', description: 'Laundry, wash-&-fold and dry cleaning' },
    ])
  })

  it('an absent category reads as absent', () => {
    expect(businessCategoryLabel('LAUNDRY', null)).toBe('—')
    expect(businessCategoryLabel('LAUNDRY', '')).toBe('—')
  })

  it('both surfaces use the same labeller', () => {
    expect(FIELD).toContain('businessCategoryLabel(productCode, value)')
    expect(WIZARD).toContain('businessCategoryLabel(biz?.productCode, biz?.businessType)')
  })
})

describe('the category is still written only through its own endpoint', () => {
  it('a generic save never carries businessType', () => {
    // Unchanged by this fix, and worth keeping true: the category has one
    // controlled write path.
    expect(WIZARD).toContain('// NOTE: businessType is intentionally NOT sent here.')
  })
})
