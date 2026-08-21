import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CUSTOMER_SOURCES, DEFAULT_CUSTOMER_SOURCE_NAME } from '@/lib/laundry-customer-source'

// ============================================================================
// How a customer was WON is a different question from how the record ARRIVED.
//
// Customer.source has held channel values — STORE_FRONT, WEBSITE_INQUIRY, API,
// META_ADS — since long before this feature, written from a dozen places.
// Acquisition is a separate field for that reason: overloading the old one
// would have rewritten the meaning of every existing row.
//
// And a source customers already carry is retired, never deleted: their history
// of how they were won should outlive a tidy-up of the dropdown.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const SCHEMA = read('prisma/schema.prisma')
const LIB = read('src/lib/laundry-customer-source.ts')
const LIST = read('src/app/api/laundry/settings/customer-sources/route.ts')
const ONE = read('src/app/api/laundry/settings/customer-sources/[id]/route.ts')
const OWNERS = read('src/app/api/laundry/settings/sales-owners/route.ts')

describe('acquisition is stored apart from the channel', () => {
  it('the long-standing Customer.source is untouched', () => {
    expect(SCHEMA).toContain('source                   String                 @default("MANUAL")')
  })

  it('acquisition gets its own columns', () => {
    for (const f of ['customerSourceId', 'salesTeamOwnerId', 'salesTeamOwnerName']) {
      expect(SCHEMA).toContain(f)
    }
  })

  it('they are indexed for the reports this exists to enable', () => {
    expect(SCHEMA).toContain('@@index([businessId, customerSourceId])')
    expect(SCHEMA).toContain('@@index([businessId, salesTeamOwnerId])')
  })

  it('the owner name is stored beside the id', () => {
    // So a customer keeps the person who won them after that person leaves.
    expect(SCHEMA).toContain('salesTeamOwnerName       String?')
  })
})

describe('the source list is configurable, not an enum', () => {
  it('it starts as Direct, Sales, Event — in that order', () => {
    expect(DEFAULT_CUSTOMER_SOURCES.map((s) => s.name)).toEqual(['Direct', 'Sales', 'Event'])
    expect(DEFAULT_CUSTOMER_SOURCE_NAME).toBe('Direct')
  })

  it('the master carries order and an active flag', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model LaundryCustomerSource'), SCHEMA.indexOf('model LaundryCrmLeadSource'))
    expect(model).toContain('displayOrder Int      @default(0)')
    expect(model).toContain('active       Boolean  @default(true)')
    expect(model).toContain('@@unique([businessId, name])')
  })

  it('defaults seed on first read, so older businesses need no migration', () => {
    expect(LIB).toContain('if (existing.length > 0) return existing')
    expect(LIB).toContain('createMany')
  })

  it('add, rename, recolour, activate and reorder are all supported', () => {
    expect(LIST).toContain('export async function POST')
    expect(LIST).toContain('export async function PATCH')   // reorder
    expect(ONE).toContain('export async function PATCH')    // rename / colour / active
    expect(ONE).toContain('typeof body.active === "boolean"')
  })

  it('a source in use cannot be deleted, only deactivated', () => {
    expect(ONE).toContain('const inUse = await customerSourceUsage(id)')
    expect(ONE).toContain('Deactivate it instead')
    expect(LIB).toContain('prisma.customer.count({ where: { customerSourceId: sourceId } })')
  })

  it('an unused one can be deleted outright', () => {
    expect(ONE).toContain('prisma.laundryCustomerSource.delete({ where: { id } })')
  })
})

describe('the owner list is the staff list, not a second master', () => {
  it('it reads existing BusinessUser records', () => {
    expect(OWNERS).toContain('prisma.businessUser.findMany')
    expect(OWNERS).toContain('role: { not: "CUSTOMER" }')
  })

  it('no parallel sales-team model was introduced', () => {
    expect(SCHEMA).not.toContain('model LaundrySalesTeamMember')
    expect(SCHEMA).not.toContain('model LaundrySalesOwner')
  })

  it('only active staff can be picked for a new customer', () => {
    expect(OWNERS).toContain('s.user?.isActive')
  })
})

describe('every route is scoped to one tenant', () => {
  for (const [label, src] of [['list', LIST], ['single', ONE], ['owners', OWNERS]] as const) {
    it(`${label} requires membership of the business it is asked about`, () => {
      expect(src).toContain('requireLaundryMember(request')
      expect(src).toContain('resolveLaundryBusiness(businessId)')
    })
  }

  it('a source id from another business cannot be edited', () => {
    expect(ONE).toContain('where: { id, businessId: biz.id }')
  })
})
