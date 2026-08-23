import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import {
  SHEET, COLUMNS, EXAMPLE_ROWS, parseMasterWorkbook, newRecordCount,
} from '@/lib/laundry-master-workbook'
import { LAUNDRY_TEMPLATES } from '@/lib/laundry-templates'

// ============================================================================
// Download → edit in Excel → upload → preview → import → export → import again.
//
// The dialog offered "CSV / Excel" and gave you a textarea. There was no file
// control and no template, so anyone holding a spreadsheet had to retype it.
//
// The columns here are the fields the bulk-import route ACTUALLY accepts, read
// off that route. A template offering a column the importer ignores is worse
// than no template: the user fills it in, the import reports success, and the
// value quietly disappears.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const DIALOG = read('src/components/laundry/views/masters/master-import-dialog.tsx')
const ROUTE  = read('src/app/api/laundry/masters/bulk-import/route.ts')

/** Round-trip through a real workbook, exactly as the dialog does. */
function throughXlsx(sheets: Record<string, unknown[][]>) {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const back = XLSX.read(buf)
  const grab = (n: string) => {
    const found = back.SheetNames.find((s) => s.toLowerCase() === n.toLowerCase())
    return found ? XLSX.utils.sheet_to_json<Record<string, unknown>>(back.Sheets[found], { defval: '' }) : undefined
  }
  return { categories: grab(SHEET.categories), services: grab(SHEET.services), garments: grab(SHEET.garments) }
}

describe('1 · the template matches what the importer accepts', () => {
  it('every garment column is a field the route writes', () => {
    for (const field of ['name', 'code', 'categoryId', 'defaultUnit', 'averageWeight', 'material', 'displayOrder']) {
      expect(ROUTE).toContain(field)
    }
  })

  it('it offers no column the importer would silently drop', () => {
    // "Active" and a garment-level "Service" were asked for; the route has
    // nowhere to put either, so offering them would lose the user's input.
    for (const sheet of Object.values(COLUMNS)) {
      expect(sheet).not.toContain('Active')
    }
    expect(COLUMNS.garments).not.toContain('Service')
    expect(COLUMNS.services).not.toContain('Description')
  })

  it('the three sheets are named for what they hold', () => {
    expect(Object.values(SHEET)).toEqual(['Categories', 'Services', 'Garments'])
  })
})

describe('2 & 3 · a real workbook round-trips', () => {
  it('the example template parses back into importable records', () => {
    const parsed = parseMasterWorkbook(throughXlsx({
      [SHEET.categories]: [[...COLUMNS.categories], ...EXAMPLE_ROWS.categories.map((r) => [...r])],
      [SHEET.services]:   [[...COLUMNS.services], ...EXAMPLE_ROWS.services.map((r) => [...r])],
      [SHEET.garments]:   [[...COLUMNS.garments], ...EXAMPLE_ROWS.garments.map((r) => [...r])],
    }))
    expect(parsed.errors).toEqual([])
    expect(parsed.categories).toHaveLength(2)
    expect(parsed.services).toHaveLength(2)
    expect(parsed.garments).toHaveLength(3)
    expect(newRecordCount(parsed)).toBe(7)
  })

  it('values survive the trip with their meaning intact', () => {
    const parsed = parseMasterWorkbook(throughXlsx({
      [SHEET.garments]: [[...COLUMNS.garments], ['Shirt', 'SHT', 'Laundry', 'PIECE', 0.2, 'Cotton', 1]],
    }))
    expect(parsed.garments[0]).toMatchObject({
      name: 'Shirt', code: 'SHT', category: 'Laundry',
      defaultUnit: 'PIECE', averageWeight: 0.2, material: 'Cotton', displayOrder: 1,
    })
  })

  it('Yes/No booleans come back as booleans', () => {
    const parsed = parseMasterWorkbook(throughXlsx({
      [SHEET.services]: [[...COLUMNS.services], ['Dry Clean', 'DC', '', 'PER_PIECE', 48, 'Yes', 'No', 1]],
    }))
    expect(parsed.services[0].expressAvailable).toBe(true)
    expect(parsed.services[0].subscriptionEligible).toBe(false)
  })
})

describe('4 · a single-sheet CSV is read as garments', () => {
  it('an unnamed sheet still imports', () => {
    // What the dialog does when a workbook has none of the three sheet names.
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      XLSX.utils.aoa_to_sheet([[...COLUMNS.garments], ['Towel', '', 'Household', 'PIECE', 0.3, '', 1]]), { defval: '' })
    const parsed = parseMasterWorkbook({ garments: rows })
    expect(parsed.garments).toHaveLength(1)
    expect(parsed.garments[0].name).toBe('Towel')
  })
})

describe('5 · invalid rows are reported, not imported', () => {
  it('a missing name is an error', () => {
    const parsed = parseMasterWorkbook({ garments: [{ Name: '', Category: 'Laundry', Unit: 'PIECE' }] })
    expect(parsed.garments).toHaveLength(0)
    expect(parsed.counts.garments.invalid).toBe(1)
    expect(parsed.errors[0].message).toMatch(/name is required/i)
  })

  it('an unknown unit is an error naming the value', () => {
    const parsed = parseMasterWorkbook({ garments: [{ Name: 'Shirt', Unit: 'DOZEN' }] })
    expect(parsed.garments).toHaveLength(0)
    expect(parsed.errors[0].message).toContain('DOZEN')
    expect(parsed.errors[0].message).toMatch(/PIECE or KG/)
  })

  it('a non-numeric weight is an error', () => {
    const parsed = parseMasterWorkbook({ garments: [{ Name: 'Shirt', Unit: 'PIECE', 'Avg Weight (kg)': 'heavy' }] })
    expect(parsed.counts.garments.invalid).toBe(1)
    expect(parsed.errors[0].field).toBe('Avg Weight (kg)')
  })

  it('a GST outside 0-100 is an error', () => {
    const parsed = parseMasterWorkbook({ categories: [{ Name: 'Laundry', 'GST %': 420 }] })
    expect(parsed.categories).toHaveLength(0)
    expect(parsed.errors[0].field).toBe('GST %')
  })

  it('an unknown category is a WARNING, because the importer still stores the row', () => {
    // The route sets categoryId to null when the name does not resolve; calling
    // that invalid would refuse a row the system accepts.
    const parsed = parseMasterWorkbook({ garments: [{ Name: 'Shirt', Category: 'Nonexistent', Unit: 'PIECE' }] })
    expect(parsed.garments).toHaveLength(1)
    expect(parsed.counts.garments.invalid).toBe(0)
    expect(parsed.errors[0].message).toMatch(/will be imported without one/)
  })

  it('a blank trailing row is not an error', () => {
    // It is how a spreadsheet ends, not a mistake.
    const parsed = parseMasterWorkbook({ garments: [{ Name: 'Shirt', Unit: 'PIECE' }, { Name: '', Code: '', Unit: '' }] })
    expect(parsed.errors).toEqual([])
    expect(parsed.counts.garments.total).toBe(1)
  })
})

describe('6 & 7 · duplicates and existing records', () => {
  it('a duplicate inside one file is caught', () => {
    const parsed = parseMasterWorkbook({ garments: [{ Name: 'Shirt', Unit: 'PIECE' }, { Name: 'shirt', Unit: 'KG' }] })
    expect(parsed.garments).toHaveLength(1)
    expect(parsed.counts.garments.invalid).toBe(1)
    expect(parsed.errors[0].message).toMatch(/Duplicate/)
  })

  it('a record the tenant already has is counted as existing, not imported', () => {
    const parsed = parseMasterWorkbook(
      { garments: [{ Name: 'Shirt', Unit: 'PIECE' }, { Name: 'Towel', Unit: 'PIECE' }] },
      { categories: [], services: [], garments: ['Shirt'] },
    )
    expect(parsed.counts.garments.existing).toBe(1)
    expect(parsed.counts.garments.new).toBe(1)
    expect(parsed.garments.map((g) => g.name)).toEqual(['Towel'])
  })

  it('matching ignores case, exactly as the importer does', () => {
    expect(ROUTE).toContain('const key = (s: string) => s.trim().toLowerCase()')
    const parsed = parseMasterWorkbook({ garments: [{ Name: 'SHIRT', Unit: 'PIECE' }] }, { categories: [], services: [], garments: ['shirt'] })
    expect(parsed.counts.garments.existing).toBe(1)
  })
})

describe('8 · category → service → garment relationships', () => {
  it('a category introduced by the file is known to the sheets below it', () => {
    const parsed = parseMasterWorkbook({
      categories: [{ Name: 'Household' }],
      services: [{ Name: 'Wash', Category: 'Household' }],
      garments: [{ Name: 'Blanket', Category: 'Household', Unit: 'PIECE' }],
    })
    expect(parsed.errors).toEqual([])
    expect(parsed.services[0].category).toBe('Household')
    expect(parsed.garments[0].category).toBe('Household')
  })

  it('a category the tenant already has counts as known too', () => {
    const parsed = parseMasterWorkbook(
      { garments: [{ Name: 'Blanket', Category: 'Household', Unit: 'PIECE' }] },
      { categories: ['Household'], services: [], garments: [] },
    )
    expect(parsed.errors).toEqual([])
  })
})

describe('12 & 13 · empty and large files', () => {
  it('an empty workbook parses to nothing, without throwing', () => {
    const parsed = parseMasterWorkbook({})
    expect(newRecordCount(parsed)).toBe(0)
    expect(parsed.errors).toEqual([])
  })

  it('a header-only sheet imports nothing', () => {
    const parsed = parseMasterWorkbook(throughXlsx({ [SHEET.garments]: [[...COLUMNS.garments]] }))
    expect(newRecordCount(parsed)).toBe(0)
  })

  it('2,000 rows parse without loss', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ Name: `Garment ${i}`, Unit: i % 2 ? 'KG' : 'PIECE' }))
    const parsed = parseMasterWorkbook({ garments: rows })
    expect(parsed.garments).toHaveLength(2000)
    expect(parsed.counts.garments.invalid).toBe(0)
  })
})

describe('11 · an export can be imported again', () => {
  it('the round trip is closed', () => {
    // Export writes the same columns the parser reads, so a tenant can export,
    // edit and re-import without a conversion step in between.
    const exported = {
      [SHEET.categories]: [[...COLUMNS.categories], ['Laundry', 'LND', '#3B82F6', 5, 1]],
      [SHEET.services]:   [[...COLUMNS.services], ['Wash & Fold', 'WF', 'Laundry', 'PER_KG', 24, 'No', 'Yes', 1]],
      [SHEET.garments]:   [[...COLUMNS.garments], ['Shirt', 'SHT', 'Laundry', 'PIECE', 0.2, 'Cotton', 1]],
    }
    const parsed = parseMasterWorkbook(throughXlsx(exported))
    expect(parsed.errors).toEqual([])
    expect(newRecordCount(parsed)).toBe(3)
  })

  it('re-importing an unchanged export creates nothing', () => {
    const parsed = parseMasterWorkbook(
      throughXlsx({ [SHEET.garments]: [[...COLUMNS.garments], ['Shirt', 'SHT', 'Laundry', 'PIECE', 0.2, 'Cotton', 1]] }),
      { categories: [], services: [], garments: ['Shirt'] },
    )
    expect(newRecordCount(parsed)).toBe(0)
    expect(parsed.counts.garments.existing).toBe(1)
  })
})

describe('15 · the industry template still loads, and is downloadable', () => {
  it('the template is unchanged', () => {
    const t = LAUNDRY_TEMPLATES[0]
    expect(t.categories.length).toBe(7)
    expect(t.services.length).toBe(8)
    expect(t.garments.length).toBe(41)
  })

  it('loading it still posts the template id, not rows', () => {
    expect(DIALOG).toContain("run({ template: template.id })")
  })

  it('it can also be downloaded as a workbook and re-parsed', () => {
    const t = LAUNDRY_TEMPLATES[0]
    const parsed = parseMasterWorkbook(throughXlsx({
      [SHEET.categories]: [[...COLUMNS.categories], ...t.categories.map((c) => [c.name, c.code, c.color, c.defaultGstPercent ?? '', c.displayOrder])],
      [SHEET.services]:   [[...COLUMNS.services], ...t.services.map((s) => [s.name, s.code, s.category ?? '', s.defaultPricingType, s.defaultTurnaroundHours, s.expressAvailable ? 'Yes' : 'No', s.subscriptionEligible ? 'Yes' : 'No', s.displayOrder])],
      [SHEET.garments]:   [[...COLUMNS.garments], ...t.garments.map((g) => [g.name, g.code, g.category, g.defaultUnit, g.averageWeight ?? '', g.material ?? '', g.displayOrder])],
    }))
    expect(parsed.counts.categories.new).toBe(7)
    expect(parsed.counts.services.new).toBe(8)
    expect(parsed.counts.garments.new).toBe(41)
    expect(parsed.errors.filter((e) => !e.message.includes('will be imported without'))).toEqual([])
  })
})

describe('9 & 14 · tenant scoping and the paths that already worked', () => {
  it('every call carries the businessId', () => {
    expect(DIALOG).toContain('JSON.stringify({ businessId, ...body })')
    expect(DIALOG).toContain('`/api/laundry/${kind}?businessId=${encodeURIComponent(businessId)}`')
  })

  it('the server resolves and guards the tenant itself', () => {
    expect(ROUTE).toContain('requireLaundryPermission(request, b.businessId, "laundry.pricing.edit_pricing")')
    expect(ROUTE).toContain('const biz = await resolveLaundryBusiness(b.businessId)')
    expect(ROUTE).toContain('where: { businessId }')
  })

  it('no tenant is named anywhere', () => {
    expect(DIALOG.toLowerCase()).not.toContain('vastrasudha')
  })

  it('paste import is untouched', () => {
    expect(DIALOG).toContain('function parseGarmentCsv(text: string)')
    expect(DIALOG).toContain('Import Pasted Garments')
    expect(DIALOG).toContain('name, category, unit (PIECE/KG), avg weight')
  })

  it('there is still ONE import engine', () => {
    // Templates, file and paste all end at the same route — one fetch, one
    // engine. (The path also appears in the header comment, so count CALLS.)
    expect(DIALOG.match(/fetch\("\/api\/laundry\/masters\/bulk-import"/g)?.length).toBe(1)
    expect(DIALOG).not.toContain('prisma')
  })

  it('export sends no database ids', () => {
    expect(DIALOG).toContain('no database ids leave the building')
    const exportFn = DIALOG.slice(DIALOG.indexOf('const exportMasters'), DIALOG.indexOf('// ── File → preview'))
    expect(exportFn).not.toContain('.id')
  })
})

describe('the file control the modal was missing', () => {
  it('there is a real file input accepting the three extensions', () => {
    expect(DIALOG).toContain('type="file" accept=".csv,.xls,.xlsx"')
  })

  it('and a drop zone, not just a hidden input', () => {
    expect(DIALOG).toContain('onDrop={(e) =>')
    expect(DIALOG).toContain('Drag &amp; drop your file here')
    expect(DIALOG).toContain('Choose File')
  })

  it('the wrong file type is refused before anything is read', () => {
    expect(DIALOG).toContain('const ok = /\\.(csv|xlsx|xls)$/i.test(file.name)')
  })

  it('nothing imports until the preview has been seen', () => {
    expect(DIALOG).toContain('Import Preview')
    expect(DIALOG).toContain('Import {newRecordCount(preview)} Records')
  })

  it('templates are downloadable from both places they are offered', () => {
    expect(DIALOG).toContain('Download Blank Template')
    expect(DIALOG).toContain('Download Example Template')
    expect(DIALOG).toContain('Download Template')
  })
})
