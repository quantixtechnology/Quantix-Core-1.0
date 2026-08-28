import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { LEAD_OWNER_FIELD_KEY } from '@/lib/crm-field-keys'

// ============================================================================
// One Sales Team Owner field, for every tenant, that nobody has to create.
//
// The Customer form on New Order reads its owner list from a CRM Lead field.
// That field was never in the CRM defaults — it existed only where somebody had
// made it by hand. So a tenant configured after the fact had a form asking for
// an owner and a CRM with nowhere to get one, and the CRM → Customer → Order
// chain was quietly broken from the day the tenant was created.
//
// The canonical key is `lead_owner`, because that is what the Customer form
// already reads. A second key called sales_team_owner would not have been a
// fix; it would have been a second answer to the same question.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const CRM      = read('src/lib/laundry-crm.ts')
const OWNERS   = read('src/app/api/laundry/settings/sales-owners/route.ts')
const FIELD_ID = read('src/app/api/laundry/crm/settings/lead-fields/[id]/route.ts')

/** Code without comments — the comments here explain the key we did NOT pick. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('the canonical field is the one already in use', () => {
  it('the key is lead_owner, not a new one', () => {
    expect(LEAD_OWNER_FIELD_KEY).toBe('lead_owner')
    expect(codeOnly(CRM)).not.toContain('sales_team_owner')
  })

  it('the Customer form and the defaults share ONE definition', () => {
    // Two copies of a key is how they drift apart.
    expect(OWNERS).toContain('LEAD_OWNER_FIELD_KEY')
    expect(OWNERS).toContain('from "@/lib/crm-field-keys"')
    expect(OWNERS).not.toContain('const LEAD_OWNER_FIELD_KEY =')
  })

  it('it is now a default field', () => {
    expect(CRM).toContain('{ fieldKey: LEAD_OWNER_FIELD_KEY, label: "Lead Owner", type: "SELECT", isSystem: true, filterable: true, showInList: true },')
  })
})

describe('every tenant gets it, new and existing', () => {
  it('a new tenant is seeded with it', () => {
    // DEFAULT_FIELDS is the first-run seed.
    const seed = CRM.slice(CRM.indexOf('const DEFAULT_FIELDS'), CRM.indexOf('export async function ensureSystemLeadFields'))
    expect(seed).toContain('LEAD_OWNER_FIELD_KEY')
  })

  it('an existing tenant is reconciled, not re-seeded', () => {
    // ensureCrmDefaults seeds only `if (fieldCount === 0)`, so a field added to
    // the defaults later would otherwise reach new businesses only.
    expect(CRM).toContain('export async function ensureSystemLeadFields(businessId: string)')
    expect(CRM).toContain('await ensureSystemLeadFields(businessId)')
  })

  it('reconciliation runs after the first-time seed', () => {
    const fn = CRM.slice(CRM.indexOf('export async function ensureCrmDefaults'))
    expect(fn.indexOf('if (work.length) await Promise.all(work)')).toBeLessThan(fn.indexOf('await ensureSystemLeadFields(businessId)'))
  })

  it('it runs wherever CRM configuration is loaded', () => {
    // Every CRM route calls ensureCrmDefaults, so opening CRM repairs the tenant.
    const LEADS = read('src/app/api/laundry/crm/leads/route.ts')
    expect(LEADS).toContain('await ensureCrmDefaults(biz.id)')
  })
})

describe('never two fields meaning the same thing', () => {
  const fn = CRM.slice(CRM.indexOf('export async function ensureSystemLeadFields'), CRM.indexOf('export async function ensureCrmDefaults'))

  it('an existing canonical field is left alone but asserted', () => {
    expect(fn).toContain('const canonical = byKey.get(seed.fieldKey)')
    expect(fn).toContain('data: { isSystem: true, active: true },')
  })

  it('a hand-made equivalent is ADOPTED rather than duplicated', () => {
    expect(fn).toContain('const equivalent = aliases.length')
    expect(fn).toContain('data: { fieldKey: seed.fieldKey, isSystem: true, active: true },')
    expect(CRM).toContain('const LEAD_OWNER_ALIASES = ["lead owner", "sales team owner", "sales owner", "owner"]')
  })

  it('adoption only happens when the canonical key is absent', () => {
    expect(fn).toContain('!byKey.has(seed.fieldKey)')
  })

  it('creating is the last resort', () => {
    const createAt = fn.indexOf('prisma.laundryCrmLeadField.create')
    expect(fn.indexOf('const canonical =')).toBeLessThan(createAt)
    expect(fn.indexOf('const equivalent =')).toBeLessThan(createAt)
  })
})

describe('the field is global; the people in it are not', () => {
  it('no employee is ever seeded into it', () => {
    // One tenant's agents are nobody else's.
    expect(CRM).not.toContain('Agent 1')
    expect(CRM).not.toContain('Quantix Super Admin')
    const seedLine = CRM.slice(CRM.indexOf('{ fieldKey: LEAD_OWNER_FIELD_KEY'), CRM.indexOf('\n', CRM.indexOf('{ fieldKey: LEAD_OWNER_FIELD_KEY')))
    expect(seedLine).not.toContain('options')
  })

  it('a tenant\'s own options are never rewritten', () => {
    const fn = CRM.slice(CRM.indexOf('export async function ensureSystemLeadFields'), CRM.indexOf('export async function ensureCrmDefaults'))
    // The UPDATE paths set isSystem/active/fieldKey only. `label: seed.label`
    // appears once, in the create block, which is a new field taking its
    // default name — not an existing one being renamed.
    const updates = fn.match(/data: \{ [^}]*\}/g) ?? []
    expect(updates.length).toBeGreaterThanOrEqual(2)
    for (const u of updates) {
      expect(u).not.toContain('label')
      expect(u).not.toContain('options')
    }
  })

  it('the owner list is read per tenant, from that tenant\'s own field', () => {
    expect(OWNERS).toContain('where: { businessId: biz.id, fieldKey: LEAD_OWNER_FIELD_KEY }')
  })

  it('no tenant is named anywhere', () => {
    for (const src of [CRM, OWNERS]) {
      const lower = src.toLowerCase()
      expect(lower).not.toContain('vastrasudha')
      expect(lower).not.toContain('drycleaners')
    }
  })
})

describe('it cannot be switched off underneath the chain', () => {
  it('a system field cannot be deactivated', () => {
    expect(FIELD_ID).toContain('if (row.isSystem && body.active === false)')
  })

  it('a system field cannot be removed', () => {
    expect(FIELD_ID).toContain('if (row.isSystem) return NextResponse.json({ error: "System fields cannot be removed" }')
  })

  it('protection comes from the existing mechanism, not a new one', () => {
    // isSystem already guarded first_name/phone/email; this field simply joins
    // them rather than inventing a second kind of protection.
    expect(CRM).toContain('{ fieldKey: "first_name", label: "First Name", type: "TEXT", required: true, isSystem: true')
  })

  it('reconciliation restores it if it was switched off before it was protected', () => {
    const fn = CRM.slice(CRM.indexOf('export async function ensureSystemLeadFields'), CRM.indexOf('export async function ensureCrmDefaults'))
    expect(fn).toContain('if (!canonical.isSystem || !canonical.active)')
  })
})

describe('only system fields are reconciled', () => {
  it('an optional default a tenant removed stays removed', () => {
    // Removing "Estimated Monthly Value" is a decision; re-adding it every time
    // CRM loads would be the product arguing with its owner.
    const fn = CRM.slice(CRM.indexOf('export async function ensureSystemLeadFields'), CRM.indexOf('export async function ensureCrmDefaults'))
    expect(fn).toContain('if (!seed.isSystem) continue')
  })

  it('unrelated CRM configuration is untouched', () => {
    const fn = CRM.slice(CRM.indexOf('export async function ensureSystemLeadFields'), CRM.indexOf('export async function ensureCrmDefaults'))
    for (const other of ['LeadStatus', 'LeadSource', 'SalesStage', 'LostReason', 'ActivityType', 'Priority', 'TaskType']) {
      expect(fn).not.toContain(other)
    }
  })

  it('nothing is ever deleted', () => {
    const fn = CRM.slice(CRM.indexOf('export async function ensureSystemLeadFields'), CRM.indexOf('export async function ensureCrmDefaults'))
    expect(fn).not.toContain('delete')
    expect(fn).not.toContain('deleteMany')
  })
})

describe('the ownership chain the field exists for', () => {
  it('a lead stores its owner like any other configured field', () => {
    expect(CRM).toContain('export function buildLeadValues(')
    expect(CRM).toContain('out[f.fieldKey] = v')
  })

  it('conversion carries the lead\'s values across', () => {
    const CONVERT = read('src/app/api/laundry/crm/leads/[id]/route.ts')
    expect(CONVERT).toContain('fieldValues')
  })

  it('the Customer form reads only ACTIVE options', () => {
    // A retired agent stops being offered; leads already assigned keep theirs.
    expect(OWNERS).toContain("o.active !== false")
    expect(OWNERS).toContain('!field.active')
  })
})
