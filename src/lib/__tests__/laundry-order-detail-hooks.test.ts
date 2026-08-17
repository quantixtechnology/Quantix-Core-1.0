import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Hooks must be called before a component can return early.
//
// Two production screens rendered the workspace error boundary — "We encountered
// an error loading your business data" — because useScanSink was called AFTER an
// early return. The message names business data but comes from a generic
// componentDidCatch wrapping the whole Laundry workspace, so any render-time
// throw arrives disguised as a failed fetch.
//
// The two failed in OPPOSITE directions, which is why they looked like different
// bugs:
//
//   View Order      `loading` starts true → render 1 returns early and skips the
//                   hook; the loaded order crosses the guard and calls one hook
//                   MORE → "Rendered more hooks than during the previous render".
//                   Broke only when the order loaded SUCCESSFULLY.
//
//   Packing & QR    `tab` starts "pending" → the hook runs; clicking History
//                   returns early and calls one hook FEWER → "Rendered fewer
//                   hooks than expected". Broke on a tab click.
//
// ESLint's react-hooks/rules-of-hooks catches both, but lint does not gate the
// build here, so the guarantee is pinned in a test.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Hook call sites, ignoring line comments so prose about hooks does not count. */
function hookCallOffsets(source: string): { name: string; index: number }[] {
  const stripped = source.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
  const out: { name: string; index: number }[] = []
  const re = /\buse[A-Z]\w*\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped))) out.push({ name: m[0].replace(/\s*\($/, ''), index: m.index })
  return out
}

interface Guarded {
  label: string
  body: string
  /** The first early return the hook must sit above. */
  guard: string
}

const GUARDED: Guarded[] = [
  (() => {
    const src = read('src/components/laundry/views/laundry-order-detail.tsx')
    return {
      label: 'View Order',
      body: src.slice(src.indexOf('export function LaundryOrderDetail')),
      guard: 'if (loading) return',
    }
  })(),
  (() => {
    const src = read('src/components/laundry/views/laundry-store-stages.tsx')
    // Bounded to LaundryPacking — the file holds several stage components.
    const start = src.indexOf('export function LaundryPacking')
    const end = src.indexOf('export function LaundryDispatch')
    return {
      label: 'Packing & QR',
      body: src.slice(start, end > start ? end : undefined),
      guard: 'if (tab === "history") {',
    }
  })(),
]

describe.each(GUARDED)('$label calls every hook before it can return early', ({ body, guard }) => {
  const guardAt = body.indexOf(guard)

  it('the early return the bug hid behind is still there', () => {
    expect(guardAt).toBeGreaterThan(-1)
  })

  it('no hook is called after the first early return', () => {
    const late = hookCallOffsets(body).filter((h) => h.index > guardAt)
    expect(late.map((h) => h.name)).toEqual([])
  })

  // The specific regression in both screens: the scan sink was bound too late.
  it('useScanSink is bound above the guard', () => {
    const hook = body.indexOf('useScanSink(')
    expect(hook).toBeGreaterThan(-1)
    expect(hook).toBeLessThan(guardAt)
  })

  it('state and effect hooks remain above the guard', () => {
    for (const h of ['useState(', 'useEffect(']) {
      const i = body.indexOf(h)
      expect(i).toBeGreaterThan(-1)
      expect(i).toBeLessThan(guardAt)
    }
  })
})

// The sinks must still be wired to their inputs — moving a hook must not quietly
// disconnect the scanner it exists to serve.
describe('the relocated sinks are still attached', () => {
  it('View Order binds itemScan to the garment input', () => {
    const src = read('src/components/laundry/views/laundry-order-detail.tsx')
    expect(src).toContain('const itemScan = useScanSink(')
    expect(src).toContain('{...itemScan}')
  })

  it('Packing & QR binds packScan to its scan input', () => {
    const src = read('src/components/laundry/views/laundry-store-stages.tsx')
    expect(src).toContain('const packScan = useScanSink(')
    expect(src).toContain('{...packScan}')
  })
})
