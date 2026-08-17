import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// View Order — hook order.
//
// The page rendered the workspace error boundary ("We encountered an error
// loading your business data") on every order that loaded SUCCESSFULLY, while
// the Order API returned perfectly valid data.
//
// useScanSink was called AFTER the `if (loading)` / `if (!order)` early returns.
// `loading` starts true, so the first render returned early and never called it;
// when the order arrived the next render called one hook MORE than the render
// before it, and React threw "Rendered more hooks than during the previous
// render". A failed fetch was fine — it stopped at "Order not found", where the
// hook count stayed stable. Only success crashed, which is exactly why the
// network tab looked healthy.
//
// The rule this guards: in this component EVERY hook is called before the first
// early return. ESLint's react-hooks/rules-of-hooks catches it too, but lint
// does not gate the build here, so the guarantee is pinned in a test.
// ============================================================================

const SRC = readFileSync(
  join(process.cwd(), 'src/components/laundry/views/laundry-order-detail.tsx'),
  'utf8',
)

const BODY = SRC.slice(SRC.indexOf('export function LaundryOrderDetail'))
const FIRST_EARLY_RETURN = BODY.indexOf('if (loading) return')

/** Hook call sites, ignoring line comments so prose about hooks does not count. */
function hookCallOffsets(source: string): { name: string; index: number }[] {
  const stripped = source.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
  const out: { name: string; index: number }[] = []
  const re = /\buse[A-Z]\w*\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped))) out.push({ name: m[0].replace(/\s*\($/, ''), index: m.index })
  return out
}

describe('View Order calls every hook before it can return early', () => {
  it('the early return the bug hid behind is still there', () => {
    expect(FIRST_EARLY_RETURN).toBeGreaterThan(-1)
    expect(BODY).toContain('if (!order) return')
  })

  it('no hook is called after the first early return', () => {
    const late = hookCallOffsets(BODY).filter((h) => h.index > FIRST_EARLY_RETURN)
    expect(late.map((h) => h.name)).toEqual([])
  })

  // The specific regression: the scan sink must be bound with the other hooks.
  it('useScanSink is bound before the loading guard', () => {
    const hook = BODY.indexOf('useScanSink(')
    expect(hook).toBeGreaterThan(-1)
    expect(hook).toBeLessThan(FIRST_EARLY_RETURN)
  })

  it('still binds the scan sink to the garment input', () => {
    expect(BODY).toContain('const itemScan = useScanSink(')
    expect(BODY).toContain('{...itemScan}')
  })

  // Sanity: the hooks that were always safe are still ahead of the guard too.
  it('state and memo hooks remain above the guard', () => {
    for (const h of ['useState(', 'useCallback(', 'useEffect(', 'useMemo(']) {
      const i = BODY.indexOf(h)
      expect(i).toBeGreaterThan(-1)
      expect(i).toBeLessThan(FIRST_EARLY_RETURN)
    }
  })
})
