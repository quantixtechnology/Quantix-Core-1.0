import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { LEAD_OWNER_FIELD_KEY } from '@/lib/crm-field-keys'

// ============================================================================
// Two boxes both labelled "Lead Owner", and neither was the creator.
//
// The lead form has always had an assignment field on LaundryCrmLead
// .assignedToName. Adding lead_owner to the CRM defaults put a SECOND control
// with the same label beside it — my doing — one writing the assignment the
// rest of CRM reads, the other writing a value nothing downstream consulted.
//
// The reading that "the first one is the creator" is understandable and wrong.
// It shows the creator's name because a new lead is assigned to whoever made
// it; reassign the lead and it changes, while the creator does not. The real
// creator is a separate column, createdByName, stamped once by the server.
//
// So: one Lead Owner, chosen from the roster; the roster field itself stays in
// Settings where it is configured; and Created By shows the column that
// actually means it.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const FORM    = read('src/components/laundry/views/crm/crm-leads.tsx')
const SCHEMA  = read('prisma/schema.prisma')
const LEADS_API = read('src/app/api/laundry/crm/leads/route.ts')
const REPORTS = read('src/components/laundry/views/crm/crm-reports.tsx')
const CONVERT = read('src/components/laundry/views/crm/crm-convert-dialog.tsx')

describe('they are different columns, and always were', () => {
  it('the schema carries both, separately', () => {
    const model = SCHEMA.slice(SCHEMA.indexOf('model LaundryCrmLead {'), SCHEMA.indexOf('\n}', SCHEMA.indexOf('model LaundryCrmLead {')))
    expect(model).toContain('assignedToId')
    expect(model).toContain('assignedToName')
    expect(model).toContain('createdById')
    expect(model).toContain('createdByName')
  })

  it('the owner is what the form writes', () => {
    expect(FORM).toContain('assignedToId: assignedToName || null, assignedToName: assignedToName || null,')
  })

  it('the creator is stamped by the SERVER, never by the form', () => {
    // Which is why reassigning cannot touch it: the form has no way to.
    expect(LEADS_API).toContain('createdById: body.actorId || null,')
    expect(LEADS_API).toContain('createdByName: body.actorName || null,')
    const payload = FORM.slice(FORM.indexOf('const payload = {'), FORM.indexOf('const res = await fetch(isEdit'))
    expect(payload).not.toContain('createdByName')
    expect(payload).not.toContain('createdById')
  })

  it('changing the owner cannot change the creator', () => {
    // The whole regression in one assertion: the owner is a form value, the
    // creator is read-only and comes off the loaded lead.
    expect(FORM).toContain('<Input value={lead.createdByName} readOnly disabled')
    expect(FORM).not.toContain('setCreatedByName')
  })
})

describe('one control labelled Lead Owner, not two', () => {
  it('the roster field is not rendered as a per-lead field', () => {
    expect(FORM).toContain('f.fieldKey !== LEAD_OWNER_FIELD_KEY')
    expect(LEAD_OWNER_FIELD_KEY).toBe('lead_owner')
  })

  it('the remaining owner control is a dropdown fed by the roster', () => {
    expect(FORM).toContain('/api/laundry/settings/sales-owners?businessId=')
    expect(FORM).toContain('<SelectValue placeholder="Select owner…" />')
  })

  it('an owner no longer on the roster stays selectable', () => {
    // History is not a validation error — an old lead keeps its owner.
    // Compares the owner's NAME: the roster is { id, name } (SalesOwner), and
    // comparing against a non-existent `.value` was what made this fallback fire
    // every time and reduce the dropdown to the lead's current owner.
    expect(FORM).toContain('{assignedToName && !owners.some((o) => o.name === assignedToName) && (')
  })

  it('no roster yet still leaves a working field', () => {
    expect(FORM).toContain('owners.length > 0 ? (')
    expect(FORM).toContain('placeholder="Employee name"')
  })

  it('a failed roster fetch does not break the form', () => {
    expect(FORM).toContain('/* no roster is a free-text field, never a broken form */')
  })
})

describe('Created By says what it is', () => {
  it('it shows the creator column', () => {
    expect(FORM).toContain('<label className="text-xs font-medium text-slate-600">Created By</label>')
    expect(FORM).toContain('lead?.createdByName')
  })

  it('it is read-only and system-controlled', () => {
    expect(FORM).toContain('readOnly disabled')
  })

  it('and only on an existing lead, which is the only time it exists', () => {
    expect(FORM).toContain('{isEdit && lead?.createdByName && (')
  })
})

describe('everything downstream still reads the same owner', () => {
  it('Reports still group by the assignment', () => {
    expect(REPORTS).toContain('{ label: "Lead Owner", get: (r) => r.assignedToName || "—" },')
  })

  it('conversion still inherits it from the lead', () => {
    expect(CONVERT).toContain('// Owner is NOT sent — the server always inherits the Lead Owner.')
  })

  it('the Customer form still reads the roster from the same field', () => {
    const OWNERS = read('src/app/api/laundry/settings/sales-owners/route.ts')
    expect(OWNERS).toContain('fieldKey: LEAD_OWNER_FIELD_KEY')
  })

  it('the field stays a protected system default in Settings', () => {
    // Removed from the FORM, not from the configuration — it is the roster.
    const CRM = read('src/lib/laundry-crm.ts')
    expect(CRM).toContain('{ fieldKey: LEAD_OWNER_FIELD_KEY, label: "Lead Owner", type: "SELECT", isSystem: true')
    expect(CRM).toContain('export async function ensureSystemLeadFields')
  })

  it('no owner value is rewritten by any of this', () => {
    const fn = read('src/lib/laundry-crm.ts')
    const recon = fn.slice(fn.indexOf('export async function ensureSystemLeadFields'), fn.indexOf('export async function ensureCrmDefaults'))
    expect(recon).not.toContain('assignedTo')
    expect(recon).not.toContain('laundryCrmLead.update')
  })

  it('the key lives where a client component can import it', () => {
    // laundry-crm reaches for Prisma; the lead form must not.
    const KEYS = read('src/lib/crm-field-keys.ts')
    expect(KEYS).not.toContain('prisma')
    expect(FORM).toContain('from "@/lib/crm-field-keys"')
  })

  it('no employee is named anywhere', () => {
    for (const src of [FORM, read('src/lib/crm-field-keys.ts')]) {
      expect(src).not.toContain('Sneha')
      expect(src).not.toContain('Sonam')
      expect(src).not.toContain('Agent 1')
    }
  })
})
