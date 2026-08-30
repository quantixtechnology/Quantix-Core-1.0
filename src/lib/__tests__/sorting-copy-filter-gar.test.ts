import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// THREE OPERATOR CONVENIENCES, AND ONE THING THEY MUST NOT CLAIM.
//
// Copy, filter and a scanned-garment list — all drawn from data the screen
// already holds. Nothing here requests, writes, or decides anything.
//
// The line that matters: which physical bag a garment went into is NOT durably
// stored. So the scanned garments are listed for the ORDER, and the bag is
// shown separately. Grouping GARs under "Bag 1" would look right and be a
// fabrication, so it is asserted absent.
// ============================================================================

const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
/** Rendered code only — comments explain the history and may quote it. */
const code = SORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

// ── the filter rule, run for real ───────────────────────────────────────────
type G = { id: string; garmentScanCode?: string | null; barcode?: string | null; garmentName: string }
type O = { orderId: string; orderNumber: string; customer: string | null; garments: G[] }
const garOf = (g: G) => (g.garmentScanCode || g.barcode || '').trim()

/** Mirrors the component's visibleOrders predicate. */
const filterOrders = (orders: O[], bags: Record<string, { bagNumber: string }[]>, raw: string) => {
  const q = raw.trim().toLowerCase()
  if (!q) return orders
  return orders.filter((o) =>
    (o.orderNumber || '').toLowerCase().includes(q) ||
    (o.customer || '').toLowerCase().includes(q) ||
    o.garments.some((g) => garOf(g).toLowerCase().includes(q)) ||
    (bags[o.orderId] || []).some((b) => (b.bagNumber || '').toLowerCase().includes(q)))
}

const A: O = { orderId: 'a', orderNumber: 'ORD-STR-000054', customer: 'Raju', garments: [
  { id: 'a1', garmentScanCode: 'GAR00000000774', garmentName: 'Shirt' },
  { id: 'a2', garmentScanCode: 'GAR00000000763', garmentName: 'T-Shirt' },
] }
const B: O = { orderId: 'b', orderNumber: 'ORD-STR-000099', customer: 'Meena', garments: [
  { id: 'b1', garmentScanCode: 'GAR00000000681', garmentName: 'Bath Towel' },
] }
const BAGS = { a: [{ bagNumber: 'VBBAG086' }], b: [{ bagNumber: 'VBBAG090' }] }

describe('FILTER · narrows what is drawn, nothing else', () => {
  it('empty filter shows every loaded order, unchanged', () => {
    expect(filterOrders([A, B], BAGS, '')).toEqual([A, B])
    expect(filterOrders([A, B], BAGS, '   ')).toEqual([A, B])
  })

  it('matches on order number', () => {
    expect(filterOrders([A, B], BAGS, '000054').map((o) => o.orderId)).toEqual(['a'])
  })

  it('matches on customer name', () => {
    expect(filterOrders([A, B], BAGS, 'meena').map((o) => o.orderId)).toEqual(['b'])
  })

  it('matches on a GAR code belonging to the order', () => {
    expect(filterOrders([A, B], BAGS, 'GAR00000000681').map((o) => o.orderId)).toEqual(['b'])
  })

  it('matches on a bag code assigned to the order', () => {
    expect(filterOrders([A, B], BAGS, 'vbbag086').map((o) => o.orderId)).toEqual(['a'])
  })

  it('is case-insensitive both ways', () => {
    expect(filterOrders([A, B], BAGS, 'RAJU').map((o) => o.orderId)).toEqual(['a'])
    expect(filterOrders([A, B], BAGS, 'ord-str-000099').map((o) => o.orderId)).toEqual(['b'])
  })

  it('clearing restores the full loaded list', () => {
    expect(filterOrders([A, B], BAGS, 'raju')).toHaveLength(1)
    expect(filterOrders([A, B], BAGS, '')).toHaveLength(2)
  })

  it('a filter that matches nothing hides everything rather than falling back', () => {
    expect(filterOrders([A, B], BAGS, 'zzz')).toEqual([])
  })
})

describe('FILTER · wired to BOTH sections, and requests nothing', () => {
  it('Complete Sorting derives from the same filtered collection', () => {
    expect(code).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
    expect(code).not.toContain('const readyOrders = orders.filter(')
  })

  it('the queue list and its badge both read visibleOrders', () => {
    expect(code).toContain(') : visibleOrders.map((o) => {')
    expect(code).toContain('>{visibleOrders.length}</Badge>')
  })

  it('the filter issues no request — it only reads loaded state', () => {
    const memo = code.slice(code.indexOf('const visibleOrders = useMemo('), code.indexOf('const readyOrders ='))
    expect(memo.length).toBeGreaterThan(200)
    for (const w of ['fetch(', '/api/', 'await', 'setOrders', 'setScanned']) expect(memo, w).not.toContain(w)
  })

  it('the global Garment Lookup is untouched and separate', () => {
    expect(code).toContain('useGarmentSearch(currentBusinessId)')
    expect(code).toContain('<GarmentSearchResults')
    expect(code).toContain('Filter these orders — number, customer, GAR or bag')
  })

  it('a scan clears the filter so the located order is always reachable', () => {
    const locate = code.slice(code.indexOf('const locate = useCallback('), code.indexOf('const scanErrTimer'))
    expect(locate.length).toBeGreaterThan(100)
    expect(locate).toContain('setOrderFilter("")')
    expect(locate).toContain('scrollIntoView')
  })
})

describe('SCANNED GARMENTS · only what was actually scanned', () => {
  const scannedList = (o: O, scannedIds: string[]) => {
    const ids = new Set(scannedIds)
    return o.garments.filter((g) => ids.has(g.id))
  }

  it('lists only garments whose ids are in scanned[orderId]', () => {
    expect(scannedList(A, ['a1']).map((g) => g.garmentName)).toEqual(['Shirt'])
  })

  it('an unscanned garment never appears', () => {
    expect(scannedList(A, ['a1']).some((g) => g.id === 'a2')).toBe(false)
  })

  it('a duplicate scan id does not duplicate the row', () => {
    expect(scannedList(A, ['a1', 'a1', 'a1'])).toHaveLength(1)
  })

  it('the count agrees with the existing scanned count', () => {
    expect(scannedList(A, ['a1', 'a2'])).toHaveLength(2)
  })

  it('another order’s garment cannot appear on this card', () => {
    expect(scannedList(A, ['b1'])).toEqual([])
  })

  it('Copy all takes only the scanned GARs, newline separated', () => {
    const gars = scannedList(A, ['a1', 'a2']).map(garOf).filter(Boolean)
    expect(gars.join('\n')).toBe('GAR00000000774\nGAR00000000763')
  })

  it('the GAR prefers garmentScanCode and falls back to barcode', () => {
    expect(garOf({ id: 'x', garmentScanCode: 'GAR-NEW', barcode: 'OLD', garmentName: 'S' })).toBe('GAR-NEW')
    expect(garOf({ id: 'x', garmentScanCode: null, barcode: 'GAR-OLD', garmentName: 'S' })).toBe('GAR-OLD')
    expect(garOf({ id: 'x', garmentName: 'S' })).toBe('')
  })

  it('membership is the scan trail, in the component too', () => {
    expect(code).toContain('const ids = new Set(scannedFor(o.orderId))')
    expect(code).toContain('const done = o.garments.filter((g) => ids.has(g.id))')
  })
})

describe('BAG SAFETY · no GAR→bag membership is invented', () => {
  it('the scanned list is per ORDER and names no bag', () => {
    const block = code.slice(code.indexOf('const ids = new Set(scannedFor(o.orderId))'), code.indexOf('<OrderBags'))
    expect(block.length).toBeGreaterThan(300)
    for (const w of ['bagNumber', 'bagsByOrder', 'activeBagForService', 'SORTING BAG', 'Bag 1']) {
      expect(block, w).not.toContain(w)
    }
  })

  it('the bag is shown separately, in the existing banner', () => {
    expect(code).toContain('Current sorting bag')
    expect(code).toContain('<CopyButton value={active.bagNumber} label="Bag code"')
  })
})

describe('COPY · exact values, no side effects', () => {
  it('reuses the shared CopyButton rather than a new one', () => {
    expect(code).toContain('import { CopyButton } from "@/components/ui/copy-button"')
  })

  it('copies the exact displayed order number, GAR and bag code', () => {
    expect(code).toContain('<CopyButton value={o.orderNumber} label="Order number"')
    expect(code).toContain('<CopyButton value={gar} label="GAR code"')
    expect(code).toContain('<CopyButton value={active.bagNumber} label="Bag code"')
    expect(code).toContain('value={gars.join("\\n")} label="GAR codes"')
  })

  it('the shared button writes to the clipboard and nothing else', () => {
    const btn = readFileSync(join(process.cwd(), 'src/components/ui/copy-button.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const w of ['fetch(', '/api/', 'prisma']) expect(btn, w).not.toContain(w)
    expect(btn).toContain('navigator.clipboard')
  })
})

describe('REGRESSION · the bag and Sorting workflows are untouched', () => {
  it('first bag opens immediately, at any scanned count', () => {
    expect(code).toContain('if (hasBag) setConfirmSecondBag(target)')
    expect(code).toContain('else setAddBagFor(target)')
    expect(code).toContain('Assign First Bag')
  })

  it('the second-bag confirmation is intact', () => {
    expect(code).toContain('Is the first bag full?')
    expect(code).toContain('Yes, Add Second Bag')
    expect(code).toContain('onClick={() => setConfirmSecondBag(null)}')
    expect(code).toContain('onClick={() => { setAddBagFor(confirmSecondBag); setConfirmSecondBag(null) }}')
  })

  it('scanning, completion, History and Last 5 Scans are unchanged', () => {
    expect(code).toContain('action: "assign_bag"')
    expect(code).toContain('const RECENT_LIMIT = 5')
    expect(code).toContain('<SortingHistory businessId=')
  })

  it('the component adds no new endpoint', () => {
    // GET bags, POST bags, queue, rehydration, history, capacity — as before.
    expect(code).not.toContain('/api/laundry/sorting-filter')
    expect((code.match(/\/api\/laundry\/orders\/\$\{[^}]+\}\/bags/g) || []).length).toBe(2)
  })
})
