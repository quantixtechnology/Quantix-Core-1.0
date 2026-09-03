import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { activeBagForService, bagsForService, bagAtTime, sortingBagViews } from '@/lib/laundry-sorting-bags'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

const SORT = 'src/components/laundry/views/laundry-sorting-workstation.tsx'
const API = 'src/app/api/laundry/processing/sorting/route.ts'
const PANEL = 'src/components/laundry/garment-search-results.tsx'

// ── A model of the scan bookkeeping, so the aid is tested as behaviour ──────
interface Rec { itemId: string; orderId: string; scannedCount: number }
const LIMIT = 5
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
    // Same membership, now read from the card's single scanned set so the
    // chip, the count and the list can never disagree.
    expect(src).toContain('const isScanned = scannedIds.has(g.id)')
    expect(src).toContain('const scannedIds = new Set(scannedFor(o.orderId))')
  })

  it('every garment is always shown — there is no "+N more" to hide behind', () => {
    const src = code(SORT)
    expect(src).toContain('{o.garments.map((g) => {')
    expect(src).not.toContain('slice(0, 12)')
    expect(src).not.toContain('more</span>')
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
  // THE RULE CHANGED, DELIBERATELY.
  //
  // load() used to be forbidden from touching progress and history, because
  // they lived only in the browser and a poll would have wiped them. They are
  // now PERSISTED, and rehydrating them is the entire point — a refresh must
  // come back at 15 / 27, not 0 / 27. So the invariant is no longer "the poll
  // writes nothing"; it is "the poll MERGES and never replaces", which is what
  // these assert.
  it('the poll merges the server’s answer with anything scanned since', () => {
    const src = code(SORT)
    const start = src.indexOf('const load = useCallback')
    const load = src.slice(start, src.indexOf('}, [currentBusinessId])', start))
    expect(load).toContain('new Set([...(server[oid] || []), ...(scannedRef.current[oid] || [])])')
    // a late poll cannot un-scan a garment that is already on screen
    expect(load).not.toMatch(/setScanned\(\s*server\s*\)/)
    expect(load).not.toMatch(/scannedRef\.current\s*=\s*server/)
  })

  it('history keeps anything newer than the server’s newest row', () => {
    const src = code(SORT)
    const start = src.indexOf('const load = useCallback')
    const load = src.slice(start, src.indexOf('}, [currentBusinessId])', start))
    expect(load).toContain('const localOnly = prev.filter((r) => new Date(r.at).getTime() > newest)')
  })

  it('the poll still never touches the live scan panel or the search box', () => {
    const src = code(SORT)
    const start = src.indexOf('const load = useCallback')
    const load = src.slice(start, src.indexOf('}, [currentBusinessId])', start))
    for (const setter of ['setLastScanned', 'setBagNeededFor', 'setBagAssigned', 'setWrongBag', 'setBagCode', 'setSearch', 'setAddBagFor']) {
      expect(load, `load() must not call ${setter}`).not.toContain(setter)
    }
  })

  const src = code(SORT)
  // Bounded precisely: start of the loader to the end of its dependency array.
  const loadStart = src.indexOf('const load = useCallback')
  const load = src.slice(loadStart, src.indexOf('}, [currentBusinessId])', loadStart))



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
    // Hoisted to a local, but still the GARMENT's own service off the scan
    // response, with the on-screen order only as a fallback for the name.
    expect(src).toContain('const serviceId = d.serviceId ?? null')
    expect(src).toContain("const serviceName = d.serviceName ?? group?.garments.find((g) => g.id === d.itemId)?.serviceName ?? null")
    // the SAME value feeds the bag lookup and the panel — never two readings
    expect(src).toContain('activeBagForService(bags, serviceId, serviceName)')
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
    expect(src).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
    // …and with no filter that collection IS `orders`, so the unfiltered
    // behaviour is byte-for-byte what it was.
    expect(src).toContain('if (!q) return orders')
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
    expect(src).toContain('setBagNeededFor(bag ? null : record)')
  })

  it('a later garment of the same order finds the bag and asks nothing', () => {
    // A matched bag clears the prompt, and the record carries that bag.
    expect(src).toContain('bagNumber: bag?.bagNumber ?? null')
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
    expect(src).toContain('const [bagsByOrder, setBagsByOrder] = useState<Record<string, SortingBagRow[]>>({})')
    // resolution is always by the scanned garment's own order
    expect(src).toContain('bagsRef.current = { ...bagsRef.current, [d.orderId]: d.bags }')
  })
})

describe('wrong bag is refused, and says which order holds it', () => {
  it('the engine names the occupying order', () => {
    const eng = code('src/lib/laundry-bag-assign.ts')
    expect(eng).toContain('belongs to ${bag.currentOrderNumber}')
    // and refuses rather than moving the bag — the sentence is unchanged, the
    // refusal now also carries the same facts as fields
    expect(eng).toContain('ok: false, status: 409, error: msg')
    expect(eng).toContain('conflict: { bagNumber: bag.bagNumber, bagStatus: bag.status, heldByOrderNumber: bag.currentOrderNumber ?? null }')
  })

  it('a bag already on THIS order is accepted, not duplicated', () => {
    const assign = code('src/lib/laundry-bag-assign.ts')
    expect(assign).toContain('if (bag.currentOrderId === orderId) {')
    expect(assign).toContain('return { ok: true, bag }')
    // …and no second assignment row is created for it
    const branch = assign.slice(assign.indexOf('if (bag.currentOrderId === orderId) {'), assign.indexOf('if (bag.status !== "AVAILABLE")'))
    expect(branch).not.toContain('laundryBagAssignment.create')
  })

  it('a failed assignment leaves the standing bag untouched', () => {
    const fn = code(SORT).slice(code(SORT).indexOf('const assignOrderBag'), code(SORT).indexOf('const scannedFor'))
    const fail = fn.slice(fn.indexOf('if (!res.ok || !j.success)'), fn.indexOf('playScanOk'))
    // The prompt stays up and no bag is claimed for the order.
    expect(fail).not.toContain('setBagNeededFor(null)')
    expect(fail).not.toContain('setBagAssigned(')
    expect(fail).not.toContain('setLastScanned')
    // The tally is not touched either — a failed BAG scan is not a garment scan.
    expect(fail).not.toContain('scannedRef')
    expect(fail).not.toContain('setScanned')
    // It may re-read the order's bags, but only from the SERVER's own answer.
    expect(fail).toContain('Array.isArray(j?.bags)')
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
  const WF = { bagNumber: 'V8BAG051', serviceId: 's-wf', serviceName: 'Wash & Fold', purpose: 'SORTING' }
  const WI = { bagNumber: 'V8BAG052', serviceId: 's-wi', serviceName: 'Wash & Iron', purpose: 'SORTING' }

  it('reproduces it: an order with a Wash & Fold bag still needs one for Wash & Iron', () => {
    expect(activeBagForService([WF], 's-wi', 'Wash & Iron')).toBeNull()
  })

  it('finds the bag for the matching service', () => {
    expect(activeBagForService([WF, WI], 's-wi', 'Wash & Iron')?.bagNumber).toBe('V8BAG052')
    expect(activeBagForService([WF, WI], 's-wf', 'Wash & Fold')?.bagNumber).toBe('V8BAG051')
  })

  it('falls back to the service NAME when there is no id', () => {
    expect(activeBagForService([{ bagNumber: 'B1', serviceId: null, serviceName: 'Wash & Iron', purpose: 'SORTING' }], null, 'wash & iron')?.bagNumber).toBe('B1')
  })

  it('an untagged legacy bag answers only when nothing is service-tagged', () => {
    const legacy = { bagNumber: 'OLD', serviceId: null, serviceName: null, purpose: 'SORTING' }
    expect(activeBagForService([legacy], 's-wi', 'Wash & Iron')?.bagNumber).toBe('OLD')
    // …and can never mask a genuinely missing bag for a second service
    expect(activeBagForService([WF], 's-wi', 'Wash & Iron')).toBeNull()
  })

  it('an order with no bags at all needs one', () => {
    expect(activeBagForService([], 's-wf', 'Wash & Fold')).toBeNull()
  })

  it('the scan path uses it, and prompts on the match — not on the count', () => {
    const src = code(SORT)
    expect(src).toContain('const bag = d.bagNumber ? { bagNumber: d.bagNumber } : activeBagForService(bags, serviceId, serviceName)')
    expect(src).toContain('setBagNeededFor(bag ? null : record)')
    expect(src).not.toContain('bags.length === 0 ? record : null')
    // …and the server resolves it with the SAME function, so both agree
    expect(code(API)).toContain('activeBagForService(bags, item.serviceId, item.serviceName)')
  })
})

describe('the bag state is visible where the operator is looking', () => {
  const src = read(SORT)

  it('BAG REQUIRED is answered in the order list, on the order it names', () => {
    // This used to require the opposite — the prompt directly under LAST
    // SCANNED, above the list. That placement was the bug: the scan that raises
    // it also centres the queue on the order's card, so the operator was
    // carried to the order while its bag input stayed at the top of the page.
    // The prompt is order-owned, so it is now rendered in that order's card.
    const orderList = src.indexOf('Orders at Sorting')
    const prompt = src.indexOf('{bagNeededFor?.orderId === o.orderId && (')
    expect(prompt).toBeGreaterThan(-1)
    expect(prompt).toBeGreaterThan(orderList)
  })

  it('it is an inline card, not a modal that traps the operator', () => {
    const card = src.slice(src.indexOf('{bagNeededFor?.orderId === o.orderId && ('), src.indexOf('{confirmSecondBag?.orderId === o.orderId && ('))
    expect(card).not.toContain('Dialog')
    expect(card).toContain('Later')          // dismissable
    expect(card).toContain('other orders are not blocked')
  })

  it('both panels show BAG REQUIRED when a scan had no bag', () => {
    expect(src).toContain('BAG REQUIRED')
    // LAST SCANNED now says what to DO with the garment, not just the number.
    expect(code(SORT)).toContain('{lastScanned.bagNumber}')
    expect(code(SORT)).toContain('Add to bag')
    expect(code(SORT)).toContain('BAG {r.bagNumber}')
  })

  it('a wrong bag names both the holder and the bag this order needs', () => {
    const src2 = code(SORT)
    expect(src2).toContain('heldBy: j?.conflict?.heldByOrderNumber ?? null')
    expect(src2).toContain('expected: activeBagForService(fresh, rec.serviceId, rec.serviceName)?.bagNumber ?? null')
    expect(code('src/lib/laundry-bag-assign.ts')).toContain('belongs to ${bag.currentOrderNumber}')
  })
})

// ============================================================================
// FIRST GARMENT → ASSIGN BAG → EVERY LATER GARMENT SHOWS THAT BAG.
//
// The requested flow, end to end. The early assignment establishes Order +
// Service → Bag at garment #1, while the operator still physically holds the
// association; the terminal binding at N/N is untouched and still owns the
// Sorting transition.
// ============================================================================
describe('the bag is established at garment #1 and shown on every later garment', () => {
  const src = code(SORT)
  const raw = read(SORT)

  it('the prompt appears on the FIRST garment, not at the end', () => {
    // Set from the scan path itself, on every scan whose service has no bag —
    // there is no "wait until scannedCount === expected" condition anywhere.
    const handler = src.slice(src.indexOf('const handleGarmentScan'), src.indexOf('const handleAssignBag'))
    expect(handler).toContain('setBagNeededFor(bag ? null : record)')
    expect(handler).not.toMatch(/scannedCount\s*>=\s*d\.expected[\s\S]{0,120}setBagNeededFor/)
  })

  it('the early assignment is NOT the terminal assign_bag operation', () => {
    const early = src.slice(src.indexOf('const assignOrderBag'), src.indexOf('const scannedFor'))
    expect(early).not.toContain('assign_bag')
    expect(early).not.toContain('processing/sorting')
    // it goes through the shared, persisted order-bags endpoint instead
    expect(early).toContain('await fetch(`/api/laundry/orders/${rec.orderId}/bags`')
  })

  it('a second garment of the same order is told which bag to add it to', () => {
    expect(src).toContain('Add to bag')
    expect(src).toContain('{lastScanned.bagNumber}')
    // and is not asked to scan a bag again
    expect(src).toContain('setBagNeededFor(bag ? null : record)')
  })

  it('✓ BAG ASSIGNED confirms the order, customer and service, not just the code', () => {
    expect(src).toContain('setBagAssigned({ bagNumber, orderNumber: rec.orderNumber, customer: rec.customer, serviceName: rec.serviceName })')
    expect(raw).toContain('Bag assigned')
    expect(raw).toContain('{bagAssigned.bagNumber}')
    expect(raw).toContain('{bagAssigned.orderNumber}')
    expect(raw).toContain('{bagAssigned.customer || "—"} · {bagAssigned.serviceName || "—"}')
  })

  it('the assignment is read back from the server, never assumed from the scan', () => {
    const early = src.slice(src.indexOf('const assignOrderBag'), src.indexOf('const scannedFor'))
    expect(early).toContain('const rows = await refreshBags(rec.orderId)')
    expect(early).toContain('activeBagForService(rows, rec.serviceId, rec.serviceName)?.bagNumber')
  })
})

describe('the bag is resolved from the scanned garment, never from the last scan', () => {
  const src = code(SORT)

  it('resolution is keyed on the SCANNED garment’s own order', () => {
    expect(src).toContain('bagsRef.current = { ...bagsRef.current, [d.orderId]: d.bags }')
    expect(src).toContain('const bags = d.bags ?? bagsRef.current[d.orderId] ?? []')
    // never the previous scan, never a position in the list
    expect(src).not.toMatch(/lastScanned\??\.\s*bagNumber\s*\?\?/)
    expect(src).not.toContain('bags[0]')
    expect(src).not.toContain('recent[0]')
    expect(src).not.toContain('orders[0]')
  })

  it('three orders interleaved each keep their own bag', () => {
    const WI = 's-wi', WF = 's-wf'
    const byOrder: Record<string, { bagNumber: string; serviceId: string; serviceName: string; purpose: string }[]> = {
      'o-045': [{ bagNumber: 'V8BAG051', serviceId: WI, serviceName: 'Wash & Iron', purpose: 'SORTING' }],
      'o-036': [{ bagNumber: 'V8BAG052', serviceId: WF, serviceName: 'Wash & Fold', purpose: 'SORTING' }],
      'o-037': [{ bagNumber: 'V8BAG053', serviceId: WI, serviceName: 'Wash & Iron', purpose: 'SORTING' }],
    }
    // interleaved exactly as the floor works
    const scans = [
      { orderId: 'o-045', serviceId: WI, want: 'V8BAG051' },
      { orderId: 'o-036', serviceId: WF, want: 'V8BAG052' },
      { orderId: 'o-037', serviceId: WI, want: 'V8BAG053' },
      { orderId: 'o-045', serviceId: WI, want: 'V8BAG051' },
    ]
    for (const s2 of scans) {
      expect(activeBagForService(byOrder[s2.orderId], s2.serviceId, null)?.bagNumber).toBe(s2.want)
    }
  })

  it('on a multi-service order each service resolves to its OWN bag', () => {
    const bags = [
      { bagNumber: 'V8BAG051', serviceId: 's-wf', serviceName: 'Wash & Fold', purpose: 'SORTING' },
      { bagNumber: 'V8BAG052', serviceId: 's-wi', serviceName: 'Wash & Iron', purpose: 'SORTING' },
    ]
    expect(activeBagForService(bags, 's-wf', 'Wash & Fold')?.bagNumber).toBe('V8BAG051')
    expect(activeBagForService(bags, 's-wi', 'Wash & Iron')?.bagNumber).toBe('V8BAG052')
  })

  it('another service’s bag never satisfies this garment’s requirement', () => {
    const onlyFold = [{ bagNumber: 'V8BAG051', serviceId: 's-wf', serviceName: 'Wash & Fold', purpose: 'SORTING' }]
    expect(activeBagForService(onlyFold, 's-wi', 'Wash & Iron')).toBeNull()
  })

  it('no second bag entity was introduced — the same assignment rows are read', () => {
    expect(src).toContain('/api/laundry/orders/${orderId}/bags?businessId=')
    expect(code('src/lib/laundry-order-bags.ts')).toContain('prisma.laundryBagAssignment.findMany')
    expect(code('src/lib/laundry-order-bags.ts')).toContain('assignBagToOrder')
  })
})

describe('LAST 5 SCANS carry the full context', () => {
  const raw = read(SORT)
  const card = raw.slice(raw.indexOf('{recent.map((r) => ('), raw.indexOf('</button>', raw.indexOf('{recent.map((r) => (')))

  it('five are kept', () => {
    expect(code(SORT)).toContain('const RECENT_LIMIT = 5')
  })

  it('each entry names the garment, GAR, customer, order, service, bag and progress', () => {
    expect(card).toContain('{r.garmentName}')
    expect(card).toContain('{r.gar || "—"}')
    expect(card).toContain('{r.customer || "—"}')
    expect(card).toContain('{r.orderNumber}')
    expect(card).toContain('{r.serviceName || "—"}')
    expect(card).toContain('BAG {r.bagNumber}')
    expect(card).toContain('{r.scannedCount} / {r.expected} scanned')
  })

  it('an entry whose service had no bag keeps saying so', () => {
    expect(card).toContain('BAG REQUIRED')
  })

  it('history is ordered by when the scan was MADE, so a late reply cannot jump the queue', () => {
    const src = code(SORT)
    expect(src).toContain('.sort((a2, b2) => new Date(b2.at).getTime() - new Date(a2.at).getTime())')
    // the SERVER's stamp for the persisted scan, so a rehydrated history and a
    // live one interleave identically
    expect(src).toContain('at: d.scannedAt || new Date(now).toISOString()')
  })
})

describe('a late response cannot overwrite a newer scan', () => {
  const src = code(SORT)
  const handler = src.slice(src.indexOf('const handleGarmentScan'), src.indexOf('const handleAssignBag'))

  it('every scan takes a generation, and only the newest owns the panel', () => {
    expect(handler).toContain('const mine = ++scanGen.current')
    expect(handler).toContain('const newest = mine === scanGen.current')
    expect(handler).toContain('if (newest) {\n      setLastScanned(record)')
  })

  it('the TALLY is never generation-guarded — a scanned garment always counts', () => {
    const tally = handler.slice(handler.indexOf('const list = ['), handler.indexOf('const group ='))
    expect(tally).toContain('scannedRef.current = { ...scannedRef.current')
    expect(tally).toContain('setScanned(scannedRef.current)')
    expect(tally).not.toContain('newest')
    expect(tally).not.toContain('scanGen')
  })

  it('a superseded scan still reaches the history', () => {
    // setRecent is written before the `newest` gate, so nothing is lost.
    expect(handler.indexOf('setRecent((prev)')).toBeLessThan(handler.indexOf('const newest ='))
  })
})

describe('the operator is never trapped or blocked', () => {
  const raw = read(SORT)
  const card = raw.slice(raw.indexOf('{bagNeededFor?.orderId === o.orderId && ('), raw.indexOf('{confirmSecondBag?.orderId === o.orderId && ('))

  it('the bag prompt offers a typed/wedge field as well as the camera', () => {
    expect(card).toContain('placeholder="Scan or type bag no…"')
    expect(card).toContain('aria-label="Bag number"')
    expect(card).toContain('BagScanButton')
  })

  it('the field is NOT auto-focused, so garment scanning keeps working', () => {
    expect(card).not.toContain('autoFocus')
    expect(card).not.toContain('.focus()')
  })

  it('Enter assigns, and an empty code does nothing', () => {
    expect(card).toContain('if (e.key !== "Enter") return')
    expect(card).toContain('if (c) assignOrderBag(c, bagNeededFor)')
    expect(card).toContain('disabled={!bagCode.trim() || busy}')
  })

  it('the prompt is dismissable and says other orders are free', () => {
    expect(card).toContain('Later')
    expect(card).toContain('other orders are not blocked')
    expect(card).not.toContain('Dialog')
  })

  it('no scan path is gated on a pending bag', () => {
    const src = code(SORT)
    const handler = src.slice(src.indexOf('const handleGarmentScan'), src.indexOf('const handleAssignBag'))
    expect(handler).not.toMatch(/if \s*\(\s*bagNeededFor/)
    expect(handler).not.toMatch(/if \s*\(\s*wrongBag/)
  })
})

describe('a wrong bag is refused in three facts, and changes nothing', () => {
  const raw = read(SORT)
  // Anchored on the GENUINE wrong-bag panel. A service-resolution refusal is a
  // different message now, so this slice must name the one it is asserting.
  const panel = raw.slice(raw.indexOf('{wrongBag?.orderNumber === o.orderNumber && wrongBag.kind === "BAG" && ('), raw.indexOf('{bagNeededFor?.orderId === o.orderId && ('))
  expect(panel.length).toBeGreaterThan(0)

  it('it names what was scanned, who holds it, and what this order needs', () => {
    expect(panel).toContain('{wrongBag.scanned}')
    expect(panel).toContain('is assigned to')
    expect(panel).toContain('{wrongBag.heldBy}')
    expect(panel).toContain('This garment belongs to')
    expect(panel).toContain('{wrongBag.orderNumber}')
    expect(panel).toContain('Expected bag:')
    expect(panel).toContain('{wrongBag.expected}')
  })

  it('“expected” is omitted rather than invented when the order has no bag', () => {
    expect(panel).toContain('{wrongBag.expected && (')
  })

  it('the holder comes from the SERVER’s refusal, not from parsing the sentence', () => {
    const src = code(SORT)
    expect(src).toContain('j?.conflict?.heldByOrderNumber')
    expect(src).not.toMatch(/\.match\(|\.split\(['"] belongs/)
    // and the route hands both halves back
    const route = code('src/app/api/laundry/orders/[id]/bags/route.ts')
    expect(route).toContain('conflict: res.conflict, bags')
  })

  it('the refusal states that nothing moved', () => {
    expect(panel).toContain('Nothing was changed')
  })
})

describe('the final Sorting completion flow is untouched', () => {
  const api = code(API)
  const src = code(SORT)

  it('the terminal action, its guards and its retirement are unchanged', () => {
    expect(api).toContain('action === "assign_bag"')
    expect(api).toContain('every garment must be scanned before the bag is assigned')
    expect(api).toContain('assignFinishingBag')
    expect(api).toContain('SORTING_COMPLETE')
  })

  it('the ready-for-bag rule and the terminal caller are unchanged', () => {
    expect(src).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
    expect(src).toContain('action: "assign_bag", code,')
    expect(src).toContain('scanned: scannedRef.current[order.orderId] || []')
  })

  it('the early assignment cannot replace it — the binder accepts the order’s own bag', () => {
    const assign = code('src/lib/laundry-bag-assign.ts')
    expect(assign).toContain('if (bag.currentOrderId === orderId) {')
    expect(assign).toContain('return { ok: true, bag }')
    // …and no second assignment row is created for it
    const branch = assign.slice(assign.indexOf('if (bag.currentOrderId === orderId) {'), assign.indexOf('if (bag.status !== "AVAILABLE")'))
    expect(branch).not.toContain('laundryBagAssignment.create')
  })

  it('no schema change was needed', () => {
    const bagAssign = code('src/lib/laundry-bag-assign.ts')
    expect(bagAssign).toContain('tx.laundryBagAssignment.create')
    expect(bagAssign).not.toContain('sortingBag')
  })
})

// ============================================================================
// A RELEASED BAG IS NOT AN ANSWER.
//
// Found in production after the service-matching fix shipped. A reusable bag is
// RELEASED back to AVAILABLE when Processing receives the order — which happens
// BEFORE Sorting — and orderBags() deliberately returns those closed rows too.
// ORD-…-000045 carried a RETURNED Wash & Fold row for V8BAG036, a bag already
// back in stock. Reading it as "this order's bag" would have told the operator
// to fill a bag that may already be on somebody else's order, and would have
// suppressed the prompt at exactly the stage that needs it.
// ============================================================================
describe('a bag that has left the order cannot answer for it', () => {
  const RETURNED = { bagNumber: 'V8BAG036', serviceId: 's-wf', serviceName: 'Wash & Fold', open: false, purpose: 'SORTING' }
  const LIVE = { bagNumber: 'V8BAG051', serviceId: 's-wf', serviceName: 'Wash & Fold', open: true, purpose: 'SORTING' }

  it('reproduces it: ORD-000045’s RETURNED Wash & Fold bag prompts instead of pointing', () => {
    expect(activeBagForService([RETURNED], 's-wf', 'Wash & Fold')).toBeNull()
  })

  it('a live bag for the same service still answers', () => {
    expect(activeBagForService([LIVE], 's-wf', 'Wash & Fold')?.bagNumber).toBe('V8BAG051')
  })

  it('the live bag wins over the order’s closed history', () => {
    expect(activeBagForService([RETURNED, LIVE], 's-wf', 'Wash & Fold')?.bagNumber).toBe('V8BAG051')
  })

  it('a closed untagged legacy row is not a fallback either', () => {
    expect(activeBagForService([{ bagNumber: 'OLD', serviceId: null, serviceName: null, open: false, purpose: 'SORTING' }], 's-wf', 'Wash & Fold')).toBeNull()
  })

  it('a missing flag still counts as open — callers that do not track it are unaffected', () => {
    expect(activeBagForService([{ bagNumber: 'B1', serviceId: 's-wf', serviceName: 'Wash & Fold', purpose: 'SORTING' }], 's-wf', 'Wash & Fold')?.bagNumber).toBe('B1')
  })

  it('the shared reader really does return closed rows, which is why this is needed', () => {
    const lib = code('src/lib/laundry-order-bags.ts')
    expect(lib).toContain('open: r.status === OPEN_ASSIGNMENT')
    // it is NOT filtered server-side — other stages need the history
    expect(lib).not.toContain('.filter((r) => r.status === OPEN_ASSIGNMENT)')
  })
})

// ============================================================================
// PROGRESS SURVIVES A REFRESH.
//
// Scanning 15 of 27 and reloading showed 0 / 27 and forced the operator to scan
// the order again, because the scanned set only ever lived in React state. It is
// now one LaundryItemEvent per garment — the per-garment event trail this route
// already writes — so the database is the source of truth. No schema change: the
// table, its indexes and its columns are all pre-existing.
// ============================================================================
describe('Sorting progress is persisted, not remembered', () => {
  const api = code(API)
  const src = code(SORT)

  it('a scan writes a durable record before it answers', () => {
    expect(api).toContain('const SCAN_ACTION = "SORTING_SCAN"')
    expect(api).toContain('prisma.laundryItemEvent.create')
    // the count returned to the operator is the DATABASE's count
    expect(api).toContain('const scannedCount = await prisma.laundryItemEvent.count')
  })

  it('it reuses the existing event table — no new entity, no new field', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toContain('model LaundryItemEvent')
    expect(schema).not.toContain('model LaundrySortingScan')
    expect(schema).not.toContain('sortingBagNumber')
    expect(schema).not.toContain('sortingScannedAt')
  })

  it('the garment’s own stage and status are NOT touched by a scan', () => {
    const scan = api.slice(api.indexOf('if (action === "scan")'), api.indexOf('if (action === "assign_bag")'))
    expect(scan).not.toContain('processingStatus:')
    expect(scan).not.toContain('processingStage:  ')
    expect(scan).not.toContain('updateMany')
    // …so no other workstation, queue or count changes behaviour
    expect(scan).not.toContain('laundryOrderItem.update')
  })

  it('“already scanned” is decided by the database, not the browser', () => {
    expect(api).toContain('const prior = await prisma.laundryItemEvent.findFirst')
    expect(api).toContain('code: "ALREADY_SCANNED"')
    expect(src).toContain("j.code === \"ALREADY_SCANNED\"")
  })

  it('the workstation rehydrates progress, bags and history on load', () => {
    expect(api).toContain('export async function GET')
    expect(src).toContain('await fetch(`/api/laundry/processing/sorting?businessId=')
    expect(src).toContain('scannedRef.current = merged')
    expect(src).toContain('setScanned(merged)')
  })

  it('only garments STILL at Sorting count as progress', () => {
    // a bound order has moved on; its events are history, not progress
    expect(api).toContain('const live = new Set(atSorting.map((i) => i.id))')
    expect(api).toContain('if (!live.has(e.itemId)) continue')
  })

  it('the rehydration endpoint writes nothing', () => {
    const get = api.slice(api.indexOf('export async function GET'), api.indexOf('export async function POST'))
    for (const w of ['.create(', '.update(', '.updateMany(', '.delete(', '.upsert(']) {
      expect(get, `GET must not call ${w}`).not.toContain(w)
    }
  })

  it('binding unions the client’s list with the trail, so a refresh cannot block it', () => {
    expect(api).toContain('const scannedSet = new Set([...scanned, ...persisted.map((e) => e.itemId)])')
  })

  it('history is reconstructed with the progress the operator actually saw', () => {
    expect(api).toContain('const progressAt = new Map<string, number>()')
    expect(api).toContain('progressAt.set(e.itemId, running[e.orderId])')
  })
})

describe('every garment of the order is visible', () => {
  const raw = read(SORT)

  it('the full list renders, with no cap and no "+N more"', () => {
    expect(raw).toContain('{o.garments.map((g) => {')
    expect(raw).not.toContain('slice(0, 12)')
    expect(raw).not.toMatch(/\+\{o\.expected - 12\}/)
  })

  it('a long order scrolls inside its own card rather than stretching the page', () => {
    expect(raw).toContain('max-h-56 overflow-y-auto')
  })

  it('scanned and unscanned stay visually distinct, and the highlight is kept', () => {
    const list = raw.slice(raw.indexOf('{o.garments.map((g) => {'), raw.indexOf('<OrderBags'))
    expect(list).toContain('bg-emerald-100 text-emerald-700')   // scanned
    expect(list).toContain('bg-white text-slate-500')            // waiting
    expect(list).toContain('ring-2 ring-indigo-300')             // just scanned
    expect(list).toContain('JUST SCANNED')
  })
})

// ============================================================================
// ONE ORDER + SERVICE MAY NEED SEVERAL BAGS.
//
// Modelled entirely on the assignment rows that already exist: the newest bag is
// ACTIVE, the earlier ones are FULL, and a garment belongs to whichever bag was
// active when it was scanned. Adding a bag is the operator's explicit act and is
// what makes the previous one full — nothing is ever marked full automatically.
// ============================================================================
describe('multiple bags per order and service', () => {
  const t = (iso: string) => new Date(iso)
  const B1 = { bagNumber: 'V8BAG051', serviceId: 's-wi', serviceName: 'Wash & Iron', open: true, assignedAt: t('2026-08-29T10:00:00Z'), purpose: 'SORTING' }
  const B2 = { bagNumber: 'V8BAG054', serviceId: 's-wi', serviceName: 'Wash & Iron', open: true, assignedAt: t('2026-08-29T11:00:00Z'), purpose: 'SORTING' }
  const OTHER = { bagNumber: 'V8BAG052', serviceId: 's-wf', serviceName: 'Wash & Fold', open: true, assignedAt: t('2026-08-29T10:30:00Z'), purpose: 'SORTING' }

  it('the newest bag takes the next garment', () => {
    expect(activeBagForService([B1, B2], 's-wi', 'Wash & Iron')?.bagNumber).toBe('V8BAG054')
  })

  it('order of arrival does not matter — the timestamps decide', () => {
    expect(activeBagForService([B2, B1], 's-wi', 'Wash & Iron')?.bagNumber).toBe('V8BAG054')
  })

  it('a garment keeps the bag that was active when IT was scanned', () => {
    expect(bagAtTime([B1, B2], 's-wi', 'Wash & Iron', t('2026-08-29T10:30:00Z'))?.bagNumber).toBe('V8BAG051')
    expect(bagAtTime([B1, B2], 's-wi', 'Wash & Iron', t('2026-08-29T11:30:00Z'))?.bagNumber).toBe('V8BAG054')
  })

  it('adding bag 2 does not retroactively move garments already in bag 1', () => {
    const scannedBefore = t('2026-08-29T10:15:00Z')
    // with only bag 1, and later with both, the answer is the same
    expect(bagAtTime([B1], 's-wi', 'Wash & Iron', scannedBefore)?.bagNumber).toBe('V8BAG051')
    expect(bagAtTime([B1, B2], 's-wi', 'Wash & Iron', scannedBefore)?.bagNumber).toBe('V8BAG051')
  })

  it('a garment scanned before any bag existed borrows nobody’s bag', () => {
    expect(bagAtTime([B1], 's-wi', 'Wash & Iron', t('2026-08-29T09:00:00Z'))).toBeNull()
  })

  it('another service’s bags are never part of the answer', () => {
    expect(bagsForService([B1, B2, OTHER], 's-wi', 'Wash & Iron').map((b) => b.bagNumber)).toEqual(['V8BAG051', 'V8BAG054'])
    expect(activeBagForService([B1, B2, OTHER], 's-wf', 'Wash & Fold')?.bagNumber).toBe('V8BAG052')
  })

  it('the panel reports each bag’s position, state and garment count', () => {
    const times = [
      t('2026-08-29T10:05:00Z'), t('2026-08-29T10:06:00Z'), t('2026-08-29T10:07:00Z'),  // bag 1
      t('2026-08-29T11:05:00Z'), t('2026-08-29T11:06:00Z'),                              // bag 2
    ]
    expect(sortingBagViews([B1, B2], 's-wi', 'Wash & Iron', times)).toEqual([
      { bagNumber: 'V8BAG051', index: 1, state: 'FULL', garments: 3 },
      { bagNumber: 'V8BAG054', index: 2, state: 'ACTIVE', garments: 2 },
    ])
  })

  it('a released bag is still excluded, even with several bags present', () => {
    const released = { ...B1, open: false }
    expect(bagsForService([released, B2], 's-wi', 'Wash & Iron').map((b) => b.bagNumber)).toEqual(['V8BAG054'])
  })

  it('bag history is never overwritten — adding goes through the existing writer', () => {
    const src = code(SORT)
    expect(src).toContain('await fetch(`/api/laundry/orders/${rec.orderId}/bags`')
    expect(read('src/lib/laundry-order-bags.ts')).toContain('Adding NEVER replaces')
    expect(code('src/lib/laundry-bag-assign.ts')).toContain('tx.laundryBagAssignment.create')
  })

  it('a new bag is never created automatically — the operator asks for it', () => {
    const raw = read(SORT)
    expect(raw).toContain('Add New Bag')
    // The panel opens only from an operator act. Both routes are pinned: the
    // FIRST bag straight from the button, and a SECOND bag only after the
    // operator confirms the previous one is full.
    expect(raw).toContain('else setAddBagFor(target)')
    expect(raw).toContain('setAddBagFor(confirmSecondBag)')
    // nothing in the scan path opens or completes an assignment by itself
    const src = code(SORT)
    const handler = src.slice(src.indexOf('const handleGarmentScan'), src.indexOf('const handleAssignBag'))
    expect(handler).not.toContain('assignOrderBag')
    expect(handler).not.toContain('setAddBagFor')
  })

  it('the added bag is filed against the SAME order and service', () => {
    const raw = read(SORT)
    expect(raw).toContain('assignOrderBag(c, { ...addBagFor, customer: null })')
    expect(code(SORT)).toContain('serviceId: rec.serviceId')
  })

  it('the add-bag prompt is an inline card the operator can cancel', () => {
    const raw = read(SORT)
    // The panel now renders INSIDE the order card that opened it, so it is
    // anchored on that guard and on the card's own closing.
    const at = raw.indexOf('{addBagFor?.orderId === o.orderId && (')
    expect(at).toBeGreaterThan(-1)
    const card = raw.slice(at, raw.indexOf('</CardContent>', at))
    expect(card.length).toBeGreaterThan(200)
    expect(card).not.toContain('Dialog')
    expect(card).toContain('Cancel')
    expect(card).toContain('scanning continues normally')
  })
})
