import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { bucketFor, BAG_STATUS, CUSTODIAN } from '@/lib/laundry-bag-lifecycle'
import { loadLabelConfig, DEFAULT_LABEL_CONFIG, STOCK_HEIGHT_MM, FIXED_LABEL_WIDTH_MM, DEFAULT_ORIENTATION } from '@/lib/laundry-label'

// ============================================================================
// Bag Management print controls.
//
// The requirement is not "add buttons" — it is that Bag Management and Barcode
// Generation stay ONE printing system with ONE saved configuration. Every test
// here is really guarding against the same regression: a second printer config,
// a second label builder, or a second definition of which bags are printable.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const BAGS = read('src/components/laundry/views/laundry-bag-management.tsx')
const BARCODE = read('src/components/laundry/views/laundry-audit-barcode.tsx')
const SETTINGS = read('src/components/laundry/laundry-label-settings.tsx')
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const BAGS_CODE = stripComments(BAGS)
const BARCODE_CODE = stripComments(BARCODE)

describe('all three print actions go through the one engine', () => {
  // The ONLY difference between them may be the list of bags passed in.
  it('individual, selected and all each call printBagLabels', () => {
    expect(BAGS_CODE).toContain('const printOne = (b: Bag) => printBagLabels([b], cfg)')
    expect(BAGS_CODE).toContain('const printSelected = () => printBagLabels(selectedBags, cfg)')
    expect(BAGS_CODE).toContain('await printBagLabels(rows, cfg)')
  })

  it('the row action still prints exactly one bag', () => {
    expect(BAGS_CODE).toMatch(/onClick=\{\(\) => printOne\(b\)\}[^]{0,80}Print QR/)
  })

  it('the screen never builds a label itself', () => {
    // No QR encoding, no label HTML, no print window: all of that is the engine's.
    expect(BAGS_CODE).not.toContain('buildBagLabelHTML')
    expect(BAGS_CODE).not.toContain('printHtmlDocument')
    expect(BAGS_CODE).not.toContain('window.print')
    expect(BAGS_CODE).not.toContain('@page')
    expect(BAGS_CODE).not.toContain('QRCode.toDataURL(b.qrValue')
  })

  it('no label dimension is stated anywhere in this screen', () => {
    for (const dim of ['38.1', 'landscape', 'portrait', 'mm;']) {
      expect(BAGS_CODE.toLowerCase()).not.toContain(dim.toLowerCase())
    }
  })
})

describe('one shared LabelConfig — never a bag-specific one', () => {
  it('bag management reads the shared saved config', () => {
    expect(BAGS_CODE).toContain('useState<LabelConfig>(loadLabelConfig())')
  })

  it('both screens mount the SAME settings component', () => {
    expect(BAGS_CODE).toContain('<LaundryLabelSettings')
    expect(BARCODE_CODE).toContain('<LaundryLabelSettings')
  })

  // The regression that would break §8: a second storage key or a second dialog.
  it('only the shared component persists the configuration', () => {
    expect(SETTINGS).toContain('saveLabelConfig(cfg)')
    expect(BAGS_CODE).not.toContain('saveLabelConfig')
    expect(BARCODE_CODE).not.toContain('saveLabelConfig')
    expect(BAGS_CODE).not.toContain('localStorage')
    expect(SETTINGS).not.toContain('localStorage')
  })

  it('neither screen keeps its own copy of the settings dialog', () => {
    for (const src of [BAGS_CODE, BARCODE_CODE]) {
      expect(src).not.toContain('Thermal Label Settings')
      expect(src).not.toContain('Stock Width (mm)')
      expect(src).not.toContain('Barcode Profile')
    }
  })

  it('the shared dialog exposes width, height, orientation and DPI', () => {
    for (const field of ['Stock Width (mm)', 'Stock Height (mm)', 'Orientation', 'Content Height (mm)', 'Printer DPI']) {
      expect(SETTINGS).toContain(field)
    }
  })

  // Production stock, unchanged by this task.
  it('the shared default is still 50 x 38.1 landscape at 203 DPI', () => {
    expect(loadLabelConfig()).toMatchObject({
      widthMm: FIXED_LABEL_WIDTH_MM, stockHeightMm: STOCK_HEIGHT_MM,
      orientation: DEFAULT_ORIENTATION, dpi: 203,
    })
    expect(DEFAULT_LABEL_CONFIG.widthMm).toBe(50)
    expect(DEFAULT_LABEL_CONFIG.stockHeightMm).toBe(38.1)
    expect(DEFAULT_ORIENTATION).toBe('landscape')
  })
})

describe('selection', () => {
  it('every row carries a checkbox and the header carries Select All', () => {
    expect(BAGS_CODE).toContain('aria-label={`Select ${b.bagNumber}`}')
    expect(BAGS_CODE).toContain('aria-label="Select all bags"')
  })

  it('ticking a row does not also open the history drawer', () => {
    // The row itself is clickable; without this the tick would navigate away.
    expect(BAGS_CODE).toMatch(/<TableCell onClick=\{\(e\) => e\.stopPropagation\(\)\}>\s*<Checkbox/)
  })

  it('Select All covers the bags currently listed', () => {
    expect(BAGS_CODE).toContain('new Set(bags.map((b) => b.id))')
  })

  it('the header shows a partial selection as indeterminate', () => {
    expect(BAGS_CODE).toContain('allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false')
  })

  it('Print Selected sends only the ticked bags', () => {
    expect(BAGS_CODE).toContain('const selectedBags = bags.filter((b) => selected.has(b.id))')
  })

  it('Print Selected appears only with a selection, and shows the count', () => {
    expect(BAGS_CODE).toMatch(/\{selected\.size > 0 && \(/)
    expect(BAGS_CODE).toContain('Print Selected ({selected.size})')
  })

  it('changing the filter clears the selection', () => {
    // Otherwise a tick survives into a list where its bag is no longer visible.
    const load = BAGS_CODE.slice(BAGS_CODE.indexOf('const load = useCallback'), BAGS_CODE.indexOf('const pickBucket'))
    expect(load).toContain('setSelected(new Set())')
  })

  it('the added column is accounted for in the empty and loading rows', () => {
    expect(BAGS_CODE).not.toContain('colSpan={8}')
    expect(BAGS_CODE).toContain('colSpan={9}')
  })
})

describe('Print All prints issuable stock only', () => {
  it('asks the server for the availability bucket rather than filtering here', () => {
    expect(BAGS_CODE).toContain('const PRINT_ALL_BUCKET = "available"')
    expect(BAGS_CODE).toContain('bucket: PRINT_ALL_BUCKET')
  })

  it('covers the whole inventory, not just the page on screen', () => {
    expect(BAGS_CODE).toContain('pageSize: String(PRINT_ALL_PAGE_SIZE)')
    expect(BAGS_CODE).toMatch(/for \(let pg = 1; pg <= PRINT_ALL_MAX_PAGES; pg\+\+\)/)
  })

  it('confirms the count before spending a roll of labels', () => {
    expect(BAGS_CODE).toContain('window.confirm(')
    expect(BAGS_CODE).toContain('bag label${rows.length === 1 ? "" : "s"}?')
  })

  // The bucket is the domain's, so these are the rules Print All inherits.
  // Proving them here pins WHY "available" is the right selector.
  const excluded: [string, string, string][] = [
    ['retired', BAG_STATUS.RETIRED, CUSTODIAN.STORE],
    ['lost', BAG_STATUS.LOST, CUSTODIAN.STORE],
    ['damaged', BAG_STATUS.DAMAGED, CUSTODIAN.STORE],
    ['customer-held', BAG_STATUS.HANDED_TO_CUSTOMER, CUSTODIAN.CUSTOMER],
    ['inspection-pending', BAG_STATUS.INSPECTION_REQUIRED, CUSTODIAN.STORE],
  ]
  for (const [name, status, custodian] of excluded) {
    it(`a ${name} bag is never in the available bucket`, () => {
      expect(bucketFor({ status, currentCustodianType: custodian })).not.toBe('available')
    })
  }

  it('an issuable bag is', () => {
    expect(bucketFor({ status: BAG_STATUS.AVAILABLE, currentCustodianType: CUSTODIAN.STORE })).toBe('available')
  })
})

describe('Barcode Generation still prints exactly as before', () => {
  it('its own print calls are untouched', () => {
    expect(BARCODE_CODE).toContain('const printOne = async (it: Item) => { await printLabels([toLabel(it)], cfg, true) }')
    expect(BARCODE_CODE).toContain('const previewOne = async (it: Item) => { await printLabels([toLabel(it)], cfg, false) }')
    expect(BARCODE_CODE).toContain('const printAll = async () => { if (data) await printLabels(data.items.map(toLabel), cfg, true) }')
  })

  it('it still keeps Preview available from the settings dialog', () => {
    expect(BARCODE_CODE).toContain('onPreview={(c) => { if (data) printLabels(data.items.map(toLabel), c, false) }}')
  })

  it('it still edits the live config, as it always did', () => {
    expect(BARCODE_CODE).toContain('cfg={cfg} onChange={setCfg}')
  })
})
