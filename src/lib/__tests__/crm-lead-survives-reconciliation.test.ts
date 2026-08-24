import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// A lead that exists must stay visible across CRM field reconciliation.
//
// A lead went missing from the Leads list right after the Sales Team Owner /
// Created By work, and "No Leads Yet" was read as "the lead was deleted".
// Three separate facts had been collapsed into that one sentence:
//
//   • the list was EMPTY,
//   • the request had FAILED, and
//   • the lead had been ARCHIVED (hidden, but present)
//
// all rendered identically. This file pins the two guarantees that matter:
// reconciliation never touches lead ROWS, and an archived lead is reachable
// again instead of being a one-way trip.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const CRM   = read('src/lib/laundry-crm.ts')
const LIST  = read('src/app/api/laundry/crm/leads/route.ts')
const UI    = read('src/components/laundry/views/crm/crm-leads.tsx')

const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/** The body of a named function, so assertions cannot drift into a neighbour. */
function fnBody(src: string, decl: string): string {
  const start = src.indexOf(decl)
  if (start < 0) throw new Error(`not found: ${decl}`)
  let i = src.indexOf('{', start), depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1)
  }
  throw new Error(`unterminated: ${decl}`)
}

// ─── 1. Reconciliation cannot reach a lead row ──────────────────────────────

describe('CRM field reconciliation never touches lead records', () => {
  const ensure = codeOnly(fnBody(CRM, 'export async function ensureSystemLeadFields'))
  const defaults = codeOnly(fnBody(CRM, 'export async function ensureCrmDefaults'))

  it('ensureSystemLeadFields only ever addresses the FIELD table', () => {
    const models = [...ensure.matchAll(/prisma\.(\w+)\./g)].map((m) => m[1])
    expect(models.length).toBeGreaterThan(0)
    expect(new Set(models)).toEqual(new Set(['laundryCrmLeadField']))
  })

  it('ensureCrmDefaults never writes a lead row', () => {
    expect(defaults).not.toMatch(/prisma\.laundryCrmLead\./)
  })

  for (const forbidden of ['delete', 'deleteMany', 'updateMany', 'upsert']) {
    it(`reconciliation never calls ${forbidden} on anything`, () => {
      expect(ensure).not.toMatch(new RegExp(`\\.${forbidden}\\(`))
    })
  }

  it('a lead is never hard-deleted anywhere in the product', () => {
    // Archiving is the only removal. If this ever fails, a lead can be lost.
    const srcs = ['src/app/api/laundry/crm/leads/[id]/route.ts', 'src/app/api/laundry/crm/leads/route.ts']
    for (const f of srcs) {
      expect(codeOnly(read(f))).not.toMatch(/laundryCrmLead\.delete(Many)?\(/)
    }
  })
})

// ─── 2. Behavioural: run it against a lead and prove the lead is unchanged ───

const leadRow = {
  id: 'lead_krishma', leadCode: 'LED-CRM-202608-000001', businessId: 'biz_vastrasudha',
  displayName: 'Krishma', phone: '8968871139', email: 'krishma76543@gmail.com',
  archived: false, converted: false, statusId: 'st_new',
  createdById: 'u_sneha', createdByName: 'Sneha',
  assignedToId: 'u_sneha', assignedToName: 'Sneha',
  fieldValues: JSON.stringify({ first_name: 'Krishma', lead_owner: 'Sonam' }),
}

const leadWrites: string[] = []
const leadStore = { ...leadRow }
let fields: Record<string, unknown>[] = []

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryCrmLeadField: {
      findMany: vi.fn(async () => fields),
      create: vi.fn(async ({ data }: never) => { fields.push({ ...(data as object) }); return data }),
      update: vi.fn(async ({ where, data }: never) => {
        const f = fields.find((x) => x.id === (where as { id: string }).id)
        Object.assign(f as object, data as object)
        return f
      }),
      count: vi.fn(async () => fields.length),
    },
    laundryCrmLead: {
      // Any call at all is a failure of the guarantee.
      update: vi.fn(async () => { leadWrites.push('update'); return leadStore }),
      delete: vi.fn(async () => { leadWrites.push('delete'); return leadStore }),
      deleteMany: vi.fn(async () => { leadWrites.push('deleteMany'); return { count: 0 } }),
      updateMany: vi.fn(async () => { leadWrites.push('updateMany'); return { count: 0 } }),
      findMany: vi.fn(async () => [leadStore]),
      count: vi.fn(async () => 1),
    },
  },
}))

describe('an existing lead survives reconciliation byte for byte', () => {
  beforeEach(() => {
    leadWrites.length = 0
    Object.assign(leadStore, leadRow)
    // A tenant that already had the owner field, configured by hand.
    fields = [
      { id: 'f1', businessId: 'biz_vastrasudha', fieldKey: 'first_name', label: 'First Name', isSystem: true, active: true, displayOrder: 0 },
      { id: 'f2', businessId: 'biz_vastrasudha', fieldKey: 'lead_owner', label: 'Lead Owner', isSystem: false, active: true, displayOrder: 1 },
    ]
  })

  it('leaves every field of the lead exactly as it was', async () => {
    const { ensureSystemLeadFields } = await import('@/lib/laundry-crm')
    await ensureSystemLeadFields('biz_vastrasudha')

    expect(leadWrites).toEqual([])            // no write of any kind
    expect(leadStore).toEqual(leadRow)        // and nothing changed
  })

  it('holds each identity the report asked about', async () => {
    const { ensureSystemLeadFields } = await import('@/lib/laundry-crm')
    await ensureSystemLeadFields('biz_vastrasudha')

    expect(leadStore.leadCode).toBe('LED-CRM-202608-000001')   // Lead ID
    expect(leadStore.businessId).toBe('biz_vastrasudha')       // Tenant ID
    expect(leadStore.createdByName).toBe('Sneha')              // Created By
    expect(leadStore.assignedToName).toBe('Sneha')             // Lead Owner
    expect(leadStore.statusId).toBe('st_new')                  // Status
    expect(leadStore.archived).toBe(false)                     // still visible
    expect(JSON.parse(leadStore.fieldValues).lead_owner).toBe('Sonam') // Sales Team Owner
  })

  it('is idempotent — a second run still writes nothing', async () => {
    const { ensureSystemLeadFields } = await import('@/lib/laundry-crm')
    await ensureSystemLeadFields('biz_vastrasudha')
    const after = JSON.parse(JSON.stringify(fields))
    await ensureSystemLeadFields('biz_vastrasudha')
    expect(fields).toEqual(after)
    expect(leadWrites).toEqual([])
  })

  it('adopts a hand-made owner field instead of orphaning the lead beside a new one', async () => {
    fields = [{ id: 'f9', businessId: 'biz_vastrasudha', fieldKey: 'owner_name', label: 'Lead Owner', isSystem: false, active: true, displayOrder: 3 }]
    const { ensureSystemLeadFields } = await import('@/lib/laundry-crm')
    await ensureSystemLeadFields('biz_vastrasudha')
    expect(fields.filter((f) => /owner/i.test(String(f.label)))).toHaveLength(1)
    expect(leadWrites).toEqual([])
  })
})

// ─── 3. The list query, and the archived escape hatch ───────────────────────

describe('the Leads list hides archived leads but no longer strands them', () => {
  it('defaults to archived: false and filters only by the tenant', () => {
    expect(codeOnly(LIST)).toMatch(/businessId: biz\.id, archived: sp\.get\("archived"\) === "1"/)
  })

  it('the list is scoped to the resolved business, never a hardcoded tenant', () => {
    expect(LIST).not.toMatch(/vastrasudha/i)
    expect(UI).not.toMatch(/vastrasudha/i)
  })

  it('the UI can now ask for archived leads', () => {
    expect(codeOnly(UI)).toMatch(/params\.set\("archived", "1"\)/)
    expect(codeOnly(UI)).toMatch(/value="ARCHIVED"/)
  })

  it('archiving has a counterpart — restore', () => {
    const ui = codeOnly(UI)
    expect(ui).toMatch(/archived: false/)      // restore path exists
    expect(ui).toMatch(/Restore/)
  })

  it('a failed request is no longer reported as an empty list', () => {
    const ui = codeOnly(UI)
    expect(ui).toMatch(/setLoadError\(!j\.success\)/)
    expect(ui).toMatch(/Could not load leads/)
    // and the old lie — success-or-not, always "No Leads Yet" — is gone
    expect(ui).not.toMatch(/catch \{ setRows\(\[\]\) \}/)
  })

  it('an empty filtered list says so, and points at Archived', () => {
    expect(codeOnly(UI)).toMatch(/No Leads Match These Filters/)
    expect(UI).toMatch(/Archived Leads/)
  })
})

// ─── 4. Created By and Lead Owner stayed distinct through all of it ─────────

describe('Created By and Lead Owner remain separate fields', () => {
  it('the form never sends a creator column', () => {
    const ui = codeOnly(UI)
    expect(ui).not.toMatch(/createdById:/)
    expect(ui).not.toMatch(/createdByName:\s*[^)]/)
  })

  it('Created By is rendered read-only from the stored lead', () => {
    expect(UI).toMatch(/createdByName/)
    expect(UI).toMatch(/readOnly/)
  })

  it('restoring a lead sends only the archived flag and the actor', () => {
    const body = fnBody(UI, 'async function restoreOne')
    expect(body).toMatch(/archived: false/)
    expect(body).not.toMatch(/assignedTo/)
    expect(body).not.toMatch(/createdBy/)
    expect(body).not.toMatch(/statusId/)
  })
})
