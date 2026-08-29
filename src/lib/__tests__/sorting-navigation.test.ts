import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { bagForService } from '@/components/laundry/views/laundry-sorting-workstation'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

const SORT = 'src/components/laundry/views/laundry-sorting-workstation.tsx'
const API = 'src/app/api/laundry/processing/sorting/route.ts'
const PANEL = 'src/components/laundry/garment-search-results.tsx'

// ── A model of the scan bookkeeping, so the aid is tested as behaviour ──────
interface Rec { itemId: string; orderId: string; scannedCount: number }
const LIMIT = 8
function pushRecent(prev: Rec[], r: Rec): Rec[] {
  return [r, ...prev.filter((x) => x.itemId !== r.itemId)].slice(0, LIMIT)
}

describe('a successful scan produces LAST SCANNED and history', () => {
  it('the newest scan leads, and a rescan does not duplicate it', () => {
    let list: Rec[] = []
    list = pushRecent(list, { itemId: 'a', orderId: 'o1', scannedCount: 1 })
    list = pushRecent(list, { itemId: 'b', orderId: 'o1', scannedCount: 2 })
    expect(list.map((r) => r.itemId)).toEqual(['b', 'a'])
    list = pushRecent(list, { itemId: 'a', orderId: 'o1', scannedCount: 3 })
    expect(list.map((r) => r.itemId)).toEqual(['a', 'b'])  // moved, not duplicated
    expect(list).toHaveLength(2)
  })

  it('history is capped and never grows without bound', () => {
    let list: Rec[] = []
    for (let i = 0; i < 40; i++) list = pushRecent(list, { itemId: `i${i}`, orderId: 'o', scannedCount: i })
    expect(list).toHaveLength(LIMIT)
    expect(list[0].itemId).toBe('i39')
  })

  it('the panel is built from the scan response, needing no extra request', () => {
    const src = code(SORT)
    expect(src).toContain('const record: ScanRecord = {')
    expect(src).toContain('setLastScanned(record)')
    expect(src).toContain('setRecent((prev) =>')
    // no second fetch to populate it
    const block = src.slice(src.indexOf('const record: ScanRecord'), src.indexOf('if (scannedCount >= d.expected)'))
    expect(block).not.toContain('fetch(')
  })

  it('the endpoint already returns the garment name, service and code', () => {
    const api = code(API)
    expect(api).toContain('garmentName: item.garmentName')
    expect(api).toContain('serviceId: item.serviceId, serviceName: item.serviceName')
    expect(api).toContain('barcode: item.garmentScanCode || item.barcode || item.itemNumber')
  })
})

describe('the correct order and garment are located', () => {
  const src = code(SORT)

  it('locate highlights the order AND the exact garment', () => {
    expect(src).toContain('const locate = useCallback((orderId: string, itemId: string | null)')
    expect(src).toContain('setHighlight({ orderId, itemId })')
  })

  it('a scan locates its own order', () => {
    expect(src).toContain('locate(d.orderId, d.itemId)')
  })

  it('the card is scrolled into view without reordering the list', () => {
    expect(src).toContain('node.scrollIntoView({ behavior: "smooth", block: "center" })')
    // the queue is still built in arrival order — nothing sorts it
    expect(src).toContain('setOrders([...byOrder.values()])')
    expect(src).not.toMatch(/orders[\s\S]{0,40}\.sort\(/)
  })

  it('the highlighted garment is flagged, and its status is not touched', () => {
    expect(src).toContain('const isJust = highlight?.itemId === g.id')
    expect(read(SORT)).toContain('✓ JUST SCANNED')
    // the chip's scanned state still comes from scannedFor, not the highlight
    expect(src).toContain('const isScanned = scannedFor(o.orderId).includes(g.id)')
  })

  it('a highlighted order shows every chip, so the garment cannot hide behind "+N more"', () => {
    expect(src).toContain('(highlight?.orderId === o.orderId ? o.garments : o.garments.slice(0, 12))')
  })

  it('clicking a recent scan re-locates it', () => {
    expect(src).toContain('onClick={() => locate(r.orderId, r.itemId)}')
  })
})

describe('search locates, and tells the truth about another stage', () => {
  const src = code(SORT)

  it('Sorting uses the shared race-safe search, not a new one', () => {
    expect(src).toContain('useGarmentSearch(currentBusinessId)')
    expect(src).toContain('<GarmentSearchResults')
  })

  it('a hit at Sorting offers Locate; one elsewhere does not', () => {
    expect(src).toContain('stages={["SORTING"]}')
    expect(src).toContain('onLocate={(hit) => locate(hit.orderId, hit.id)}')
    const panel = code(PANEL)
    expect(panel).toContain('const here = !!r.processingStage && stages.includes(r.processingStage)')
    expect(panel).toContain('{here && onLocate && (')
  })

  it('a garment elsewhere reports its ACTUAL stage', () => {
    expect(code(PANEL)).toContain('Currently in ${r.department || r.stageLabel}')
  })

  it('Sorting offers no return-to-queue — that is not its action', () => {
    expect(src).toContain('canReturn={false}')
  })
})

describe('polling cannot destroy the operator’s context', () => {
  const src = code(SORT)
  // Bounded precisely: start of the loader to the end of its dependency array.
  const loadStart = src.indexOf('const load = useCallback')
  const load = src.slice(loadStart, src.indexOf('}, [currentBusinessId])', loadStart))

  it('load() writes none of the navigation state', () => {
    for (const setter of ['setLastScanned', 'setRecent', 'setHighlight', 'setSearch']) {
      expect(load, `load() must not call ${setter}`).not.toContain(setter)
    }
  })

  it('load() does not touch the scanned tally either', () => {
    expect(load).not.toContain('setScanned')
    expect(load).not.toContain('scannedRef.current =')
  })

  it('the 12s poll is unchanged', () => {
    expect(src).toContain('useAutoRefresh(() => load(true), { intervalMs: 12000 })')
  })

  it('search is generation-guarded and aborts superseded requests', () => {
    const hook = code('src/hooks/use-garment-search.ts')
    expect(hook).toContain('if (mine !== gen.current) return')
    expect(hook).toContain('new AbortController()')
  })
})

describe('multi-service correctness', () => {
  it('the record takes the GARMENT’s own service, never the order’s first', () => {
    const src = code(SORT)
    expect(src).toContain('serviceName: d.serviceName ?? group?.garments.find((g) => g.id === d.itemId)?.serviceName ?? null')
    expect(src).not.toContain('services[0]')
    expect(src).not.toContain('services?.[0]')
  })

  it('the chip carries its own service as a title', () => {
    expect(code(SORT)).toContain('title={g.serviceName || undefined}')
  })
})

describe('the Sorting workflow itself is untouched', () => {
  const src = code(SORT)

  it('scan and bag-assign still call the same endpoint with the same actions', () => {
    expect(src).toContain('action: "scan"')
    expect(src).toContain('action: "assign_bag"')
    expect(src).toContain('scanned: scannedRef.current[order.orderId] || []')
  })

  it('the scanned tally is still the ref, and the ready rule is unchanged', () => {
    expect(src).toContain('const readyOrders = orders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
    expect(src).toContain('scannedRef.current = { ...scannedRef.current, [d.orderId]: list }')
  })

  it('the progress bar and counts are unchanged', () => {
    expect(src).toContain('{done} / {o.expected} scanned')
    expect(src).toContain('width: `${Math.min(100, (done / o.expected) * 100)}%`')
  })

  it('1 order = 1 bag binding is untouched, server-side', () => {
    const api = code(API)
    expect(api).toContain('if (action === "assign_bag")')
    expect(api).toContain('if (item.processingStage !== "SORTING")')
  })

  it('the navigation aid writes nothing to the server', () => {
    // `locate` is declared BEFORE the loader, so bound the slice at the loader —
    // otherwise it swallows load()'s own fetch and the assertion is meaningless.
    const nav = src.slice(src.indexOf('const locate = useCallback'), src.indexOf('const load = useCallback'))
    expect(nav).not.toContain('fetch(')
  })
})

// ============================================================================
// BAG IDENTIFICATION FROM THE FIRST GARMENT
// ============================================================================
describe('the order’s bag is known from its first garment', () => {
  const src = code(SORT)

  it('the bag comes from the PERSISTED assignment, not client memory', () => {
    // The same endpoint Packing and the order Bags panel use.
    expect(src).toContain('`/api/laundry/orders/${orderId}/bags?businessId=')
    expect(src).toContain('await fetch(`/api/laundry/orders/${rec.orderId}/bags`')
    expect(src).toContain('method: "POST"')
    // no parallel store
    expect(src).not.toContain('localStorage')
    expect(src).not.toContain('sessionStorage')
  })

  it('only an order with NO bag is asked for one', () => {
    // Asked when there is no bag FOR THIS GARMENT'S SERVICE — see the
    // service-resolution suite below for why a count was the wrong test.
    expect(src).toContain('setBagNeededFor(mine ? null : record)')
  })

  it('a later garment of the same order finds the bag and asks nothing', () => {
    // A matched bag clears the prompt, and the record carries that bag.
    expect(src).toContain('bagNumber: mine?.bagNumber ?? null')
  })

  it('the scanner is NEVER gated on a pending bag — other orders keep scanning', () => {
    const handler = src.slice(src.indexOf('const handleGarmentScan'), src.indexOf('const assignOrderBag'))
    // nothing in the scan path reads bagNeededFor to decide whether to proceed
    expect(handler).not.toMatch(/if \s*\(\s*bagNeededFor/)
    expect(handler).not.toContain('return')  // no early bail added after the success path
  })

  it('the bag is filed against the GARMENT’s own service', () => {
    expect(src).toContain('serviceId: rec.serviceId')
    expect(code(API)).toContain('serviceId: item.serviceId')
    expect(src).not.toContain('services[0]')
  })

  it('several orders hold different bags at once — keyed by orderId', () => {
    expect(src).toContain('const [bagsByOrder, setBagsByOrder] = useState<Record<string, OrderBagRow[]>>({})')
    expect(src).toContain('setBagsByOrder((prev) => ({ ...prev, [orderId]: rows }))')
    // resolution is always by the scanned garment's own order
    expect(src).toContain('const known = bagsByOrder[d.orderId]')
  })
})

describe('wrong bag is refused, and says which order holds it', () => {
  it('the engine names the occupying order', () => {
    const eng = code('src/lib/laundry-bag-assign.ts')
    expect(eng).toContain('belongs to ${bag.currentOrderNumber}')
    // and refuses rather than moving the bag
    expect(eng).toContain('return { ok: false, status: 409, error: msg }')
  })

  it('a bag already on THIS order is accepted, not duplicated', () => {
    expect(code('src/lib/laundry-bag-assign.ts')).toContain('if (bag.currentOrderId === orderId) return { ok: true, bag }')
  })

  it('a failed assignment leaves the standing bag untouched', () => {
    const fn = code(SORT).slice(code(SORT).indexOf('const assignOrderBag'), code(SORT).indexOf('const scannedFor'))
    const fail = fn.slice(fn.indexOf('if (!res.ok || !j.success)'), fn.indexOf('playScanOk'))
    expect(fail).not.toContain('setBagsByOrder')
    expect(fail).not.toContain('setBagNeededFor(null)')
  })
})

describe('the terminal bag binding is untouched', () => {
  it('completion still requires every garment and still retires barcodes', () => {
    const api = code(API)
    expect(api).toContain('every garment must be scanned before the bag is assigned')
    expect(api).toContain('assignFinishingBag({ orderId: order.id')
  })

  it('pre-assigning cannot block completion — the binder accepts its own bag', () => {
    // assignFinishingBag only treats a bag as occupied when it is on a DIFFERENT
    // order, so a bag pre-assigned to this order at garment 1 still binds.
    expect(code('src/lib/laundry-finishing.ts')).toContain('if (bag.currentOrderId !== orderId)')
  })

  it('the pre-assignment does not call the terminal action', () => {
    const fn = code(SORT).slice(code(SORT).indexOf('const assignOrderBag'), code(SORT).indexOf('const scannedFor'))
    expect(fn).not.toContain('assign_bag')
    expect(fn).not.toContain('processing/sorting')
  })
})

describe('last scans survive, and show the bag', () => {
  it('at least five remain visible', () => {
    let list: Rec[] = []
    for (let i = 0; i < 12; i++) list = pushRecent(list, { itemId: `i${i}`, orderId: `o${i % 3}`, scannedCount: i })
    expect(list.length).toBeGreaterThanOrEqual(5)
  })

  it('the panel shows from the first scan and carries the bag number', () => {
    const src = code(SORT)
    expect(src).toContain('{recent.length > 0 && (')
    expect(src).toContain('BAG {r.bagNumber}')
    expect(src).toContain('BAG REQUIRED')
  })

  it('polling writes none of the bag or history state', () => {
    const src = code(SORT)
    const loadStart = src.indexOf('const load = useCallback')
    const load = src.slice(loadStart, src.indexOf('}, [currentBusinessId])', loadStart))
    for (const setter of ['setBagsByOrder', 'setBagNeededFor', 'setLastScanned', 'setRecent']) {
      expect(load, `load() must not call ${setter}`).not.toContain(setter)
    }
  })
})

// ============================================================================
// THE BUG THAT MADE THE PROMPT INVISIBLE.
//
// Most orders reaching Sorting ALREADY carry a bag from pickup or packing — 8 of
// 9 on the live floor did. An order-level "has any bag?" therefore found the
// pickup bag and never asked for the Sorting one. ORD-…-000045 carried a
// Wash & Fold bag while its garments were Wash & Iron.
// ============================================================================
describe('the bag is resolved for the GARMENT’s service, not the order', () => {
  const WF = { bagNumber: 'V8BAG051', serviceId: 's-wf', serviceName: 'Wash & Fold' }
  const WI = { bagNumber: 'V8BAG052', serviceId: 's-wi', serviceName: 'Wash & Iron' }

  it('reproduces it: an order with a Wash & Fold bag still needs one for Wash & Iron', () => {
    expect(bagForService([WF], 's-wi', 'Wash & Iron')).toBeNull()
  })

  it('finds the bag for the matching service', () => {
    expect(bagForService([WF, WI], 's-wi', 'Wash & Iron')?.bagNumber).toBe('V8BAG052')
    expect(bagForService([WF, WI], 's-wf', 'Wash & Fold')?.bagNumber).toBe('V8BAG051')
  })

  it('falls back to the service NAME when there is no id', () => {
    expect(bagForService([{ bagNumber: 'B1', serviceId: null, serviceName: 'Wash & Iron' }], null, 'wash & iron')?.bagNumber).toBe('B1')
  })

  it('an untagged legacy bag answers only when nothing is service-tagged', () => {
    const legacy = { bagNumber: 'OLD', serviceId: null, serviceName: null }
    expect(bagForService([legacy], 's-wi', 'Wash & Iron')?.bagNumber).toBe('OLD')
    // …and can never mask a genuinely missing bag for a second service
    expect(bagForService([WF], 's-wi', 'Wash & Iron')).toBeNull()
  })

  it('an order with no bags at all needs one', () => {
    expect(bagForService([], 's-wf', 'Wash & Fold')).toBeNull()
  })

  it('the scan path uses it, and prompts on the match — not on the count', () => {
    const src = code(SORT)
    expect(src).toContain('const mine = bagForService(bags, d.serviceId ?? null, d.serviceName ?? null)')
    expect(src).toContain('setBagNeededFor(mine ? null : record)')
    expect(src).not.toContain('bags.length === 0 ? record : null')
  })
})

describe('the bag state is visible where the operator is looking', () => {
  const src = read(SORT)

  it('BAG REQUIRED sits directly under LAST SCANNED, not in the order list', () => {
    const lastScanned = src.indexOf('Last scanned')
    const bagRequired = src.indexOf('Bag required')
    const orderList = src.indexOf('Orders at Sorting')
    expect(bagRequired).toBeGreaterThan(lastScanned)
    expect(bagRequired).toBeLessThan(orderList)
  })

  it('it is an inline card, not a modal that traps the operator', () => {
    const card = src.slice(src.indexOf('{bagNeededFor && ('), src.indexOf('{/* Find any garment'))
    expect(card).not.toContain('Dialog')
    expect(card).toContain('Later')          // dismissable
    expect(card).toContain('other orders are not blocked')
  })

  it('both panels show BAG REQUIRED when a scan had no bag', () => {
    expect(src).toContain('BAG REQUIRED')
    expect(code(SORT)).toContain('BAG {lastScanned.bagNumber}')
    expect(code(SORT)).toContain('BAG {r.bagNumber}')
  })

  it('a wrong bag names both the holder and the bag this order needs', () => {
    expect(code(SORT)).toContain('${rec.orderNumber} requires ${expected}.')
    expect(code('src/lib/laundry-bag-assign.ts')).toContain('belongs to ${bag.currentOrderNumber}')
  })
})
