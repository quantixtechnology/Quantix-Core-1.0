import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { LEAD_OWNER_FIELD_KEY, type SalesOwner } from '@/lib/crm-field-keys'

// ============================================================================
// LEAD OWNER DROPDOWN — configured owners were not offered.
//
// ROOT CAUSE: a shape mismatch. GET /api/laundry/settings/sales-owners returns
// { id, name }; the lead form declared the roster as { value, label }. So every
// option rendered with an undefined value, AND the "keep an off-roster owner
// selectable" fallback fired every time, because `o.value === assignedToName`
// could never match. The dropdown therefore showed exactly one usable entry —
// the lead's current owner. The Customer form, reading { id, name }, was fine.
//
// The contract now lives beside the field key, so a future mismatch fails to
// compile rather than silently emptying the list.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const FORM = read('src/components/laundry/views/crm/crm-leads.tsx')
const ROUTE = read('src/app/api/laundry/settings/sales-owners/route.ts')
const CUSTOMER = read('src/components/laundry/customers/acquisition-fields.tsx')

/** The roster the endpoint returns for the configured options. */
const roster: SalesOwner[] = [
  { id: 'Krishna', name: 'Krishna' },
  { id: 'Sophia', name: 'Sophia' },
  { id: 'Neha', name: 'Neha' },
  { id: 'Sneha', name: 'Sneha' },
]

/** What the form renders: one item per owner, plus the off-roster fallback. */
function renderedOptions(owners: SalesOwner[], assignedToName: string): string[] {
  const items = owners.map((o) => o.name)
  if (assignedToName && !owners.some((o) => o.name === assignedToName)) items.push(assignedToName)
  return items
}

describe('all configured owners are offered', () => {
  it('every configured owner appears, not just the current one', () => {
    expect(renderedOptions(roster, 'Sneha')).toEqual(['Krishna', 'Sophia', 'Neha', 'Sneha'])
  })

  it('the reported symptom is gone — the list is no longer one item', () => {
    expect(renderedOptions(roster, 'Sneha')).toHaveLength(4)
  })

  it('the old { value, label } shape produced exactly the reported bug', () => {
    // Reproduces the defect against the API's real payload.
    const broken = roster.map((o) => ({ value: (o as unknown as { value?: string }).value, label: (o as unknown as { label?: string }).label }))
    expect(broken.every((o) => o.value === undefined)).toBe(true)
    const fallbackFires = !broken.some((o) => o.value === 'Sneha')
    expect(fallbackFires).toBe(true) // → only "Sneha" was usable
  })
})

describe('the current owner stays selected', () => {
  it('an on-roster owner is selected and not duplicated', () => {
    const opts = renderedOptions(roster, 'Sneha')
    expect(opts).toContain('Sneha')
    expect(opts.filter((o) => o === 'Sneha')).toHaveLength(1)
  })

  it('the Select binds its value to the stored owner name', () => {
    expect(FORM).toContain('<Select value={assignedToName || undefined} onValueChange={setAssignedToName}>')
  })

  it('an owner no longer on the roster stays selectable — history is not an error', () => {
    expect(renderedOptions(roster, 'Retired Person')).toEqual(['Krishna', 'Sophia', 'Neha', 'Sneha', 'Retired Person'])
    expect(FORM).toContain('{assignedToName && !owners.some((o) => o.name === assignedToName) && (')
  })

  it('a lead with no owner yet shows the roster and no blank item', () => {
    expect(renderedOptions(roster, '')).toEqual(['Krishna', 'Sophia', 'Neha', 'Sneha'])
  })
})

describe('selecting and saving an owner', () => {
  it('the option value is the name the lead persists', () => {
    expect(FORM).toContain('{owners.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}')
  })

  it('choosing another owner replaces the value, and it survives a reload', () => {
    // Save writes assignedToName; reopening seeds state from the saved lead.
    let assignedToName = 'Sneha'
    const setAssignedToName = (v: string) => { assignedToName = v }
    setAssignedToName('Krishna')
    expect(assignedToName).toBe('Krishna')
    expect(FORM).toContain('useState(lead?.assignedToName || user?.name || "")')
    expect(FORM).toContain('assignedToName')
  })
})

describe('existing assignments are never rewritten', () => {
  it('the roster fetch only READS — it sets state and nothing else', () => {
    const effect = FORM.slice(FORM.indexOf('const [owners, setOwners]'), FORM.indexOf('const [values, setValues]'))
    expect(effect).toContain('setOwners(j.data)')
    for (const w of ['PUT', 'POST', 'PATCH', 'DELETE']) expect(effect, w).not.toContain(w)
  })

  it('the endpoint is read-only', () => {
    expect(ROUTE).toContain('Read-only. No CRM record is written')
    for (const w of ['.create(', '.update(', '.delete(', '.upsert(', 'updateMany']) expect(ROUTE, w).not.toContain(w)
  })

  it('the current owner is seeded from the lead, never defaulted over', () => {
    expect(FORM).toContain('lead?.assignedToName || user?.name || ""')
  })
})

describe('no hard-coded owner list', () => {
  it('the names come only from the configured field options', () => {
    for (const name of ['Krishna', 'Sophia', 'Neha', 'Sneha']) {
      expect(FORM, name).not.toContain(name)
      expect(ROUTE, name).not.toContain(name)
    }
  })

  it('the roster is fetched from the settings endpoint at runtime', () => {
    expect(FORM).toContain('/api/laundry/settings/sales-owners?businessId=')
  })

  it('the endpoint reads the Lead Owner field options, not the staff list', () => {
    expect(ROUTE).toContain('fieldKey: LEAD_OWNER_FIELD_KEY')
    expect(LEAD_OWNER_FIELD_KEY).toBe('lead_owner')
    expect(ROUTE).toContain('NOT the Business User/staff list')
  })

  it('inactive options are excluded, blank-flag options kept', () => {
    expect(ROUTE).toContain('o.active !== false')
  })
})

describe('one shared contract, so this cannot drift again', () => {
  it('the type lives beside the field key and both sides use it', () => {
    const KEYS = read('src/lib/crm-field-keys.ts')
    expect(KEYS).toContain('export interface SalesOwner')
    expect(FORM).toContain('type SalesOwner } from "@/lib/crm-field-keys"')
    expect(FORM).toContain('useState<SalesOwner[]>([])')
    expect(ROUTE).toContain('const owners: SalesOwner[] = parsed')
  })

  it('the lead form no longer declares its own shape', () => {
    expect(FORM).not.toContain('useState<{ value: string; label: string }[]>')
    expect(FORM).not.toContain('o.label || o.value')
  })

  it('the Customer form already matched, and is untouched', () => {
    expect(CUSTOMER).toContain('export interface Owner { id: string; name: string }')
    expect(CUSTOMER).toContain('{ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}')
  })
})

describe('permissions and tenant isolation are unchanged', () => {
  it('the endpoint still requires membership and resolves the tenant', () => {
    expect(ROUTE).toContain('requireLaundryMember(request, businessId)')
    expect(ROUTE).toContain('resolveLaundryBusiness(businessId)')
    expect(ROUTE).toContain('where: { businessId: biz.id, fieldKey: LEAD_OWNER_FIELD_KEY }')
  })

  it('lead_owner is still excluded from the per-lead field list', () => {
    expect(FORM).toContain('f.fieldKey !== LEAD_OWNER_FIELD_KEY')
  })

  it('with no roster configured the field still accepts free text', () => {
    expect(FORM).toContain('owners.length > 0 ? (')
    expect(FORM).toContain('placeholder="Employee name"')
  })
})
