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

describe('the owner list is CRM lead ownership, not the staff list', () => {
  it('it reads owners off CRM leads and opportunities', () => {
    expect(OWNERS).toContain('prisma.laundryCrmLead.findMany')
    expect(OWNERS).toContain('prisma.laundryCrmOpportunity.findMany')
    expect(OWNERS).toContain('distinct: ["assignedToName"]')
  })

  it('the generic staff list is gone', () => {
    // A store manager or delivery executive is not a sales owner; offering
    // the whole payroll made the field meaningless.
    expect(OWNERS).not.toContain('prisma.businessUser.findMany')
  })

  it('no parallel owner master was introduced', () => {
    expect(SCHEMA).not.toContain('model LaundrySalesTeamMember')
    expect(SCHEMA).not.toContain('model LaundrySalesOwner')
    expect(SCHEMA).not.toContain('model LaundryCrmLeadOwner')
  })

  it('the id stays whatever CRM uses, so the two agree', () => {
    expect(OWNERS).toContain('id: row.assignedToId || name')
  })

  it('CRM behaviour is only READ — nothing is written', () => {
    for (const w of ['.update(', '.create(', '.delete(', '.upsert(']) {
      expect(OWNERS).not.toContain(w)
    }
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

// ── UI surfaces ─────────────────────────────────────────────────────────────
describe('the feature is reachable, not just implemented', () => {
  const SETTINGS = read('src/components/laundry/views/laundry-workspace-settings.tsx')
  const FORM = read('src/components/laundry/views/laundry-customer-sources-form.tsx')
  const FIELDS = read('src/components/laundry/customers/acquisition-fields.tsx')
  const CUSTOMERS = read('src/components/laundry/views/laundry-customers-view.tsx')
  const NEW_ORDER = read('src/components/laundry/views/laundry-new-order.tsx')
  const CREATE = read('src/app/api/laundry/customers/route.ts')
  const UPDATE = read('src/app/api/laundry/customers/[id]/route.ts')

  it('Workspace Settings renders the Customer Sources section', () => {
    expect(SETTINGS).toContain('<LaundryCustomerSourcesForm businessId={businessId} />')
  })

  it('the section can add, rename, toggle and reorder', () => {
    expect(FORM).toContain('const add = async ()')
    expect(FORM).toContain('const rename = async (id: string)')
    expect(FORM).toContain('const toggle = (r: Source)')
    expect(FORM).toContain('order: next.map((r) => r.id)')
  })

  it('one field component serves both forms, so they cannot drift', () => {
    expect(CUSTOMERS).toContain('<AcquisitionFields')
    expect(NEW_ORDER).toContain('<AcquisitionFields')
  })

  it('a new customer starts on Direct', () => {
    expect(FIELDS).toContain('s.name.toLowerCase() === "direct"')
    expect(NEW_ORDER).toContain('setNewCustSourceId(defaultSourceId(custSources))')
    // And the server defaults too, for callers that send nothing.
    expect(CREATE).toContain('await defaultCustomerSourceId(laundryBusiness.id)')
  })

  it('an inactive source is not offered, but is kept where already used', () => {
    expect(FIELDS).toContain('sources.filter((s) => s.active || s.id === sourceId)')
  })

  it('the owner is optional', () => {
    expect(FIELDS).toContain('<option value="">Select Sales Team Owner</option>')
  })

  it('an owner already on a customer survives leaving the CRM list', () => {
    // Opening the form must not quietly reassign the customer.
    expect(FIELDS).toContain('ownerId && !owners.some((o) => o.id === ownerId)')
    expect(CUSTOMERS).toContain('ownerName={form.salesTeamOwnerName')
  })

  it('both fields persist on create and on edit', () => {
    expect(CREATE).toContain('customerSourceId: body.customerSourceId')
    expect(UPDATE).toContain('b.customerSourceId !== undefined')
    expect(UPDATE).toContain('b.salesTeamOwnerId !== undefined')
  })

  it('the profile shows Source and Owner, with a dash for no owner', () => {
    expect(CUSTOMERS).toContain('Acquisition')
    expect(CUSTOMERS).toContain('{detail.customerSourceName || "Direct"}')
    expect(CUSTOMERS).toContain('{detail.salesTeamOwnerName || "—"}')
  })

  it('a customer with no source reads as Direct without a migration', () => {
    expect(UPDATE).toContain('customerSourceName: src?.name ?? "Direct"')
  })

  it('the CRM workflow was not touched', () => {
    // No conversion, no stage behaviour — the fields are manual by design.
    for (const src of [CREATE, UPDATE, FIELDS, FORM]) {
      expect(src).not.toContain('laundryCrmOpportunity')
      expect(src).not.toContain('laundryCrmLead')
    }
  })
})
