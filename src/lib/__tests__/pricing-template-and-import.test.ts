import { describe, it, expect, beforeEach, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The import template and the importer, against the same rule the Pricing
// Matrix follows: ONLY active services, one Subscription column per service,
// and NA kept distinct from "not in the subscription".
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const state = {
  services: [] as { name: string; isActive: boolean; id: string }[],
  inactive: [] as { name: string }[],
  garments: [] as { id: string; code: string; name: string }[],
  saved: [] as { garmentId: string; cells: unknown[] }[],
}

vi.mock('@/lib/laundry-business', () => ({ resolveLaundryBusiness: vi.fn(async () => ({ id: 'lb1', platformBusinessId: 'pb1' })) }))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: vi.fn(async () => ({ ok: true, platformBusinessId: 'pb1', ctx: { laundryBusinessId: 'lb1' } })) }))
vi.mock('@/lib/laundry-garment-codes', () => ({ ensureGarmentCodes: vi.fn(async () => {}) }))
vi.mock('@/lib/laundry-pricing-matrix', () => ({
  saveGarmentCells: vi.fn(async (_lb: string, garmentId: string, _n: string, cells: unknown[]) => { state.saved.push({ garmentId, cells }) }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryService: {
      findMany: vi.fn(async ({ where }: never) => {
        const active = (where as { isActive?: boolean }).isActive
        if (active === false) return state.inactive
        return state.services.filter((s) => s.isActive)
      }),
    },
    laundryCategory: { findMany: vi.fn(async () => [{ name: 'Men' }]) },
    laundryGarment: {
      findFirst: vi.fn(async () => state.garments[0] ?? null),
      findMany: vi.fn(async () => state.garments),
    },
    laundryPricingRule: { deleteMany: vi.fn(async () => ({ count: 0 })) },
  },
}))

const ACTIVE = ['Wash & Fold', 'Wash & Iron', 'Dry Clean']
const reset = () => {
  state.services = ACTIVE.map((name, i) => ({ id: `s${i}`, name, isActive: true }))
  state.inactive = []
  state.garments = [{ id: 'g1', code: 'GAR00001', name: 'Shirt' }]
  state.saved = []
}

const buildTemplate = async () => {
  const { GET } = await import('@/app/api/laundry/pricing-matrix/template/route')
  const res = await GET(new Request('http://internal/x?businessId=pb1'))
  expect(res.status).toBe(200)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await res.arrayBuffer())
  const ws = wb.getWorksheet('Pricing')!
  return { ws, headers: (ws.getRow(1).values as unknown[]).slice(1).map(String) }
}

const runImport = async (rows: unknown[]) => {
  const { POST } = await import('@/app/api/laundry/pricing-matrix/import/route')
  const res = await POST(new Request('http://internal/x', { method: 'POST', body: JSON.stringify({ businessId: 'pb1', rows }) }))
  return { status: res.status, body: await res.json() }
}

describe('D + E + J. only ACTIVE services appear', () => {
  beforeEach(reset)

  it('the template has three columns for each active service and nothing else', async () => {
    const { headers } = await buildTemplate()
    expect(headers.slice(0, 3)).toEqual(['Garment Code', 'Garment Name', 'Category'])
    expect(headers).toEqual([
      'Garment Code', 'Garment Name', 'Category',
      'Wash & Fold', 'Wash & Fold Type', 'Wash & Fold Subscription',
      'Wash & Iron', 'Wash & Iron Type', 'Wash & Iron Subscription',
      'Dry Clean', 'Dry Clean Type', 'Dry Clean Subscription',
    ])
  })

  it('E. a deactivated service is absent from the template entirely', async () => {
    state.services = state.services.map((s) => (s.name === 'Dry Clean' ? { ...s, isActive: false } : s))
    state.inactive = [{ name: 'Dry Clean' }]
    const { headers } = await buildTemplate()
    expect(headers.join('|')).not.toContain('Dry Clean')
    expect(headers).toHaveLength(3 + 2 * 3)
  })

  it('F. activating a service makes its columns appear, with no second list to edit', async () => {
    state.services.push({ id: 's9', name: 'Premium Wash', isActive: false })
    state.inactive = [{ name: 'Premium Wash' }]
    expect((await buildTemplate()).headers.join('|')).not.toContain('Premium Wash')

    state.services = state.services.map((s) => (s.name === 'Premium Wash' ? { ...s, isActive: true } : s))
    state.inactive = []
    const after = (await buildTemplate()).headers
    expect(after).toContain('Premium Wash')
    expect(after).toContain('Premium Wash Type')
    expect(after).toContain('Premium Wash Subscription')
  })

  it('the matrix and the importer read the same active-only list', () => {
    expect(read('src/app/api/laundry/pricing-matrix/route.ts')).toContain('isActive: true')
    const imp = read('src/app/api/laundry/pricing-matrix/import/route.ts')
    expect(imp).toContain('isActive: true')
    expect(imp).toContain('is deactivated in Services')
  })

  it('an inactive service cannot be imported through the template', async () => {
    state.services = state.services.map((s) => (s.name === 'Dry Clean' ? { ...s, isActive: false } : s))
    state.inactive = [{ name: 'Dry Clean' }]
    const { status, body } = await runImport([{ code: 'GAR00001', cells: [{ service: 'Dry Clean', billing: 'PER_PIECE', price: 99, subscription: 'YES' }] }])
    expect(status).toBe(422)
    expect(body.errors[0].message).toContain('deactivated in Services')
    expect(state.saved).toHaveLength(0)
  })
})

describe('I. the template is formatted, not just populated', () => {
  beforeEach(reset)

  it('headers are centred, wrapped, bold and given room', async () => {
    const { ws } = await buildTemplate()
    const head = ws.getRow(1)
    expect(head.height).toBe(38)
    head.eachCell((cell) => {
      expect(cell.alignment?.horizontal).toBe('center')
      expect(cell.alignment?.vertical).toBe('middle')
      expect(cell.alignment?.wrapText).toBe(true)
      expect(cell.font?.bold).toBe(true)
      expect(cell.fill).toBeTruthy()          // service groups are banded
    })
  })

  it('every column has an explicit width, so nothing is clipped', async () => {
    const { ws } = await buildTemplate()
    for (let c = 1; c <= ws.columnCount; c++) expect(ws.getColumn(c).width).toBeGreaterThan(10)
  })

  it('the header row is frozen', async () => {
    const { ws } = await buildTemplate()
    expect(ws.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
  })

  it('Subscription and Type columns are dropdowns', async () => {
    const { ws, headers } = await buildTemplate()
    const subCol = headers.indexOf('Wash & Fold Subscription') + 1
    const typeCol = headers.indexOf('Wash & Fold Type') + 1
    expect(ws.getCell(2, subCol).dataValidation).toMatchObject({ type: 'list', formulae: ['"YES,NO"'] })
    expect(ws.getCell(2, typeCol).dataValidation).toMatchObject({ type: 'list', formulae: ['"PER_PIECE,PER_KG,NA"'] })
  })

  it('the example row lines up with the header — no shifted columns', async () => {
    const { ws, headers } = await buildTemplate()
    const row = (ws.getRow(2).values as unknown[]).slice(1)
    expect(row).toHaveLength(headers.length)
    expect(row[headers.indexOf('Wash & Fold')]).toBe(100)
    expect(row[headers.indexOf('Wash & Fold Type')]).toBe('PER_KG')
    expect(row[headers.indexOf('Wash & Fold Subscription')]).toBe('YES')
  })
})

describe('G + H. YES/NO imports per pair, prices untouched', () => {
  beforeEach(reset)

  const cellsFor = (gid: string) => state.saved.find((s) => s.garmentId === gid)!.cells as { serviceId: string; mode: string; price?: number; subscriptionIncluded?: boolean }[]

  it('G. each service on the row keeps its own YES/NO', async () => {
    const { status } = await runImport([{ code: 'GAR00001', cells: [
      { service: 'Wash & Fold', billing: 'PER_KG', price: 35, subscription: 'YES' },
      { service: 'Wash & Iron', billing: 'PER_KG', price: 45, subscription: 'YES' },
      { service: 'Dry Clean', billing: 'PER_PIECE', price: 99, subscription: 'NO' },
    ] }])
    expect(status).toBe(200)
    const c = cellsFor('g1')
    expect(c.find((x) => x.serviceId === 's0')).toMatchObject({ price: 35, subscriptionIncluded: true })
    expect(c.find((x) => x.serviceId === 's1')).toMatchObject({ price: 45, subscriptionIncluded: true })
    expect(c.find((x) => x.serviceId === 's2')).toMatchObject({ price: 99, subscriptionIncluded: false })
  })

  it('H. a priced service excluded from the subscription keeps its price', async () => {
    await runImport([{ code: 'GAR00001', cells: [{ service: 'Dry Clean', billing: 'PER_PIECE', price: 99, subscription: 'NO' }] }])
    const c = cellsFor('g1')[0]
    expect(c.mode).toBe('PER_PIECE')
    expect(c.price).toBe(99)
    expect(c.subscriptionIncluded).toBe(false)   // priced AND excluded — not NA
  })

  it('NA carries its subscription value too — the two are different statements', async () => {
    await runImport([{ code: 'GAR00001', cells: [{ service: 'Wash & Fold', billing: 'NA', subscription: 'YES' }] }])
    expect(cellsFor('g1')[0]).toMatchObject({ mode: 'NOT_AVAILABLE', subscriptionIncluded: true })
  })

  it('a blank or missing column leaves the stored value alone', async () => {
    await runImport([{ code: 'GAR00001', cells: [
      { service: 'Wash & Fold', billing: 'PER_KG', price: 35 },
      { service: 'Wash & Iron', billing: 'PER_KG', price: 45, subscription: '' },
    ] }])
    const c = cellsFor('g1')
    expect(c[0].subscriptionIncluded).toBeUndefined()
    expect(c[1].subscriptionIncluded).toBeUndefined()
  })

  it('an unrecognised value is a row error, never a silent default', async () => {
    const { status, body } = await runImport([{ code: 'GAR00001', cells: [{ service: 'Wash & Fold', billing: 'PER_KG', price: 35, subscription: 'maybe' }] }])
    expect(status).toBe(422)
    expect(body.errors[0].message).toContain('use YES or NO')
    expect(state.saved).toHaveLength(0)
  })

  it('accepts the obvious synonyms', async () => {
    await runImport([{ code: 'GAR00001', cells: [
      { service: 'Wash & Fold', billing: 'PER_KG', price: 35, subscription: 'yes' },
      { service: 'Wash & Iron', billing: 'PER_KG', price: 45, subscription: 'TRUE' },
      { service: 'Dry Clean', billing: 'PER_PIECE', price: 99, subscription: 'Not Included' },
    ] }])
    const c = cellsFor('g1')
    expect(c.map((x) => x.subscriptionIncluded)).toEqual([true, true, false])
  })
})

describe('the export carries the same contract', () => {
  const UI = read('src/components/laundry/views/laundry-pricing-matrix.tsx')

  it('one Subscription column per active service', () => {
    expect(UI).toContain('`${s.name} Subscription`')
  })

  it('the subscription value is written even for an NA cell', () => {
    expect(UI).toContain('[c.price, typeLabel(c.mode), sub] : ["NA", "NA", sub]')
  })

  it('the template comes from the server, where the formatting survives', () => {
    expect(UI).toContain('/api/laundry/pricing-matrix/template?businessId=')
    expect(UI).not.toContain('aoa_to_sheet([headers, sample])')   // no client-built template
  })

  // The download 401'd as "Not authenticated" because it was a navigation.
  // Laundry OS authenticates with a Bearer token that LaundryAuthBridge
  // attaches by patching window.fetch — a navigation is not a fetch, so it
  // carries no token. Anything that pulls bytes from /api/laundry must go
  // through fetch.
  it('is FETCHED, never navigated to, so the Bearer token is attached', () => {
    const fn = UI.slice(UI.indexOf('const downloadTemplate'), UI.indexOf('const exportMatrix'))
    expect(fn).toContain('await fetch(`/api/laundry/pricing-matrix/template')
    expect(fn).not.toContain('window.location')
    expect(fn).not.toContain('window.open')
    // and the bytes are handed over as a blob
    expect(fn).toContain('URL.createObjectURL(await res.blob())')
    expect(fn).toContain('a.download = "pricing-template.xlsx"')
  })

  it('surfaces a failure instead of downloading an error page', () => {
    const fn = UI.slice(UI.indexOf('const downloadTemplate'), UI.indexOf('const exportMatrix'))
    expect(fn).toContain('if (!res.ok)')
    expect(fn).toContain('toast.error')
  })

  it('the patched fetch covers this URL', () => {
    // LaundryAuthBridge only augments URLs containing /api/laundry.
    expect(UI).toContain('/api/laundry/pricing-matrix/template')
    expect(read('src/components/laundry/laundry-auth-bridge.tsx')).toContain('url.includes("/api/laundry")')
  })
})
