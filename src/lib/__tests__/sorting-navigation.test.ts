import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

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
    expect(api).toContain('garmentName: item.garmentName, serviceName: item.serviceName')
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
