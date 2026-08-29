import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

const HOOK = 'src/hooks/use-garment-search.ts'
const API = 'src/app/api/laundry/processing/find/route.ts'
const PANEL = 'src/components/laundry/garment-search-results.tsx'
const WS = 'src/components/laundry/views/laundry-workstation.tsx'
const QC = 'src/components/laundry/views/laundry-drying-qc-workstation.tsx'
const QUEUE_API = 'src/app/api/laundry/processing/route.ts'

// ── A simulation of the hook's stale-guard, so the rule is tested as behaviour
//    and not only as source text. ────────────────────────────────────────────
function makeSearcher() {
  let gen = 0
  let rendered: string | null = null
  return {
    start(value: string) {
      const mine = ++gen
      return {
        settle(payload: string) {
          if (mine !== gen) return false   // superseded — must not write
          rendered = payload
          return true
        },
      }
    },
    get rendered() { return rendered },
  }
}

describe('TEST C · only the newest request may update the UI', () => {
  it('a slow early response cannot overwrite the newest one', () => {
    const s = makeSearcher()
    const r1 = s.start('GAR')          // typed first
    const r2 = s.start('GAR000')
    const r3 = s.start('GAR000000000331')
    expect(r3.settle('exact')).toBe(true)
    // the two earlier requests land LATE, out of order
    expect(r1.settle('too-broad')).toBe(false)
    expect(r2.settle('still-broad')).toBe(false)
    expect(s.rendered).toBe('exact')
  })

  it('five keystrokes leave exactly one authoritative result', () => {
    const s = makeSearcher()
    const reqs = ['G', 'GA', 'GAR', 'GAR0', 'GAR000000000331'].map((v) => ({ v, r: s.start(v) }))
    // responses arrive in a scrambled order
    for (const { v, r } of [reqs[2], reqs[0], reqs[4], reqs[1], reqs[3]]) r.settle(v)
    expect(s.rendered).toBe('GAR000000000331')
  })

  it('the hook implements exactly that guard, with a real abort', () => {
    const h = code(HOOK)
    expect(h).toContain('const mine = ++gen.current')
    expect(h).toContain('if (mine !== gen.current) return')
    expect(h).toContain('new AbortController()')
    expect(h).toContain('inflight.current?.abort()')
    expect(h).toContain('{ signal: controller.signal }')
    // an aborted request is not an error the user should see
    expect(h).toContain('if ((e as Error)?.name === "AbortError") return')
  })
})

describe('search is independent of the queue and its 12s poll', () => {
  it.each([WS, QC])('%s no longer passes search to the queue loader', (f) => {
    const src = code(f)
    expect(src).not.toContain('p.set("search"')
    expect(src).not.toMatch(/&search=\$\{encodeURIComponent\(search\)\}/)
  })

  it.each([WS, QC])('%s queue loader does not depend on the search term', (f) => {
    const src = code(f)
    // the loader's dependency array must not contain `search`
    const deps = src.match(/\}, \[currentBusinessId[^\]]*\]\)/g) ?? []
    expect(deps.length).toBeGreaterThan(0)
    for (const d of deps) expect(d, d).not.toContain('search')
  })

  it.each([WS, QC])('%s keeps the 12s auto-refresh on the queue only', (f) => {
    expect(code(f)).toContain('useAutoRefresh(() => load(true), { intervalMs: 12000 })')
  })

  it('typing never drives the page-wide loading state', () => {
    const h = code(HOOK)
    expect(h).toContain('setLoading')          // its OWN loading
    const ws = code(WS)
    // the page spinner is bound to `loading`, which the search no longer sets
    expect(ws).toContain('{loading ? (')
    expect(ws).toContain('searchLoading')
  })
})

describe('the input cannot lose focus, text or cursor', () => {
  it.each([WS, QC])('%s renders the input unconditionally and never re-keys it', (f) => {
    const src = read(f)
    const input = src.slice(src.indexOf('value={search}'), src.indexOf('value={search}') + 400)
    expect(input).not.toContain('key=')
    // not inside a conditional branch that could unmount it
    expect(src).not.toMatch(/\{searching && [\s\S]{0,80}value=\{search\}/)
  })

  it('the query state lives in the hook and is never overwritten by a response', () => {
    const h = code(HOOK)
    const settle = h.slice(h.indexOf('const res = await fetch'), h.indexOf('} catch'))
    expect(settle).not.toContain('setQuery')
  })
})

describe('TEST A/B/D · global lookup by GAR', () => {
  const api = code(API)

  it('searches GAR, ITM, barcode, name and order number', () => {
    for (const f of ['garmentScanCode', 'itemNumber', 'barcode', 'garmentName']) {
      expect(api).toContain(`{ ${f}: { contains: q } }`)
    }
    expect(api).toContain('{ order: { orderNumber: { contains: q } } }')
  })

  it('is GLOBAL — not scoped to one processing stage', () => {
    const where = api.slice(api.indexOf('where: {'), api.indexOf('select: {'))
    expect(where).not.toContain('processingStage')
  })

  it('is scoped to the tenant, always', () => {
    expect(api).toContain('order: { businessId: biz.id }')
    expect(api).toContain('requireLaundryMember')
  })

  it('reports where the garment currently is', () => {
    for (const f of ['processingStage', 'processingStatus', 'stageLabel', 'department']) {
      expect(api).toContain(f)
    }
  })

  it('trims the query, and an empty query returns nothing', () => {
    expect(api).toContain('(sp.get("q") || "").trim()')
    expect(api).toContain('if (!q) return NextResponse.json({ success: true, data: [], query: q })')
  })

  it('is READ ONLY — it writes nothing at all', () => {
    for (const w of ['update', 'create', 'delete', 'upsert']) {
      expect(api, `find must not ${w}`).not.toContain(w)
    }
  })
})

describe('TEST D · a hit in another department is visible but not actionable', () => {
  const panel = code(PANEL)

  it('decides "here" from the stages this workstation owns', () => {
    expect(panel).toContain('const here = !!r.processingStage && stages.includes(r.processingStage)')
  })

  it('shows the current department for a garment elsewhere', () => {
    expect(panel).toContain('Currently in ${r.department || r.stageLabel}')
  })

  it('offers Return to Queue ONLY here, in progress, and with permission', () => {
    expect(panel).toContain("const returnable = here && r.processingStatus === \"IN_PROGRESS\" && canReturn")
  })

  it('Dry & Quality Check owns two stages, so a DRY garment is still "here"', () => {
    expect(code(QC)).toContain('stages={["DRY", "QC"]}')
    expect(code(WS)).toContain('stages={[stage]}')
  })
})

describe('nothing else moved', () => {
  it('the queue counts still come from the unsearched queue', () => {
    const q = code(QUEUE_API)
    expect(q).toContain('const queueWhere = { order: { businessId: biz.id }, processingStage: stage }')
    const grouped = q.slice(q.indexOf('groupBy({'), q.indexOf('queueCounts = {'))
    expect(grouped).toContain('where: queueWhere')
  })

  it('Return to Queue still uses the workstation permission, not a phantom one', () => {
    expect(code('src/app/api/laundry/items/[id]/process/route.ts')).toContain('else if (action === "RETURN") permAction = "process"')
    expect(code(WS)).toContain('const hasReturnPerm = level(screenKey) >= Level.CREATE')
    expect(code(QC)).toContain('level("processing.quality_check") >= Level.CREATE')
  })

  it('the search touches no lifecycle action', () => {
    const h = code(HOOK)
    for (const a of ['START', 'COMPLETE', 'QC_PASS', 'QC_FAIL', 'PAUSE', 'RESUME']) {
      expect(h, `the search hook must not reference ${a}`).not.toContain(a)
    }
  })
})
