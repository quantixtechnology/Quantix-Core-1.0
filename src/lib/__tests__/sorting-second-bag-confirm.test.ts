import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// MOVING AN ORDER TO A SECOND BAG IS A DECISION — SO IT IS ASKED.
//
// Assigning the FIRST bag is not. An order at 0/22, 10/22 or 22/22 with no bag
// is in the same situation: it has nowhere to put garments, and the operator
// must be able to say where. That was already true and is deliberately left
// alone — no scanned-count condition exists anywhere on that path.
//
// A SECOND bag is different: the first one is still open, and moving on means
// the operator has decided it is physically full. Nothing can observe that, so
// the system asks instead of assuming. The confirmation is an acknowledgement
// ONLY: nothing is counted, weighed, closed, released or marked FULL by it, and
// on Yes it does exactly what the button already did.
// ============================================================================

const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
/** Rendered code only — comments explain the history and may quote it. */
const code = SORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

describe('1/5 · the FIRST bag opens the scan panel directly', () => {
  it('no bag → straight to the existing panel, no confirmation', () => {
    expect(code).toContain('if (hasBag) setConfirmSecondBag(target)')
    expect(code).toContain('else setAddBagFor(target)')
  })

  it('and nothing on that path looks at the scanned count', () => {
    const handler = code.slice(code.indexOf('onAdd={(serviceId, serviceName, hasBag)'), code.indexOf('/>', code.indexOf('onAdd={(serviceId, serviceName, hasBag)')))
    for (const w of ['scannedFor', 'expected', 'complete', 'readyOrders']) expect(handler, w).not.toContain(w)
  })

  it('the button still names the first bag when there is none', () => {
    expect(code).toContain('views.length === 0 ? <><Plus className="h-3 w-3" /> Assign First Bag</>')
  })
})

describe('2 · a SECOND bag asks before the panel opens', () => {
  it('the button reports whether a bag already exists, from the same views', () => {
    expect(code).toContain('onClick={() => onAdd(svc.id, svc.name, views.length > 0)}')
  })

  it('the confirmation carries the operator wording', () => {
    expect(code).toContain('Is the first bag full?')
    expect(code).toContain('You are moving this order to a second bag. Continue?')
    expect(code).toContain('Yes, Add Second Bag')
    expect(code).toContain('Cancel')
  })

  it('the scan panel is NOT opened when the confirmation is raised', () => {
    // setConfirmSecondBag and setAddBagFor are the two branches of one if/else,
    // so raising the question cannot also open the panel.
    expect(code).toContain('if (hasBag) setConfirmSecondBag(target)\n                        else setAddBagFor(target)')
  })
})

describe('3 · Cancel changes nothing', () => {
  it('it only drops the pending target', () => {
    expect(code).toContain('onClick={() => setConfirmSecondBag(null)}')
  })

  it('Cancel touches no bag, count or completion state', () => {
    const cancel = code.slice(code.indexOf('onClick={() => setConfirmSecondBag(null)}'), code.indexOf('Cancel'))
    for (const w of ['setAddBagFor', 'assignOrderBag', 'fetch(', 'setScanned', 'setOrders']) expect(cancel, w).not.toContain(w)
  })
})

describe('4 · Yes opens the EXISTING panel, unchanged', () => {
  it('it hands the same target to the same state the button used to set', () => {
    expect(code).toContain('onClick={() => { setAddBagFor(confirmSecondBag); setConfirmSecondBag(null) }}')
  })

  it('it does not assign a bag itself — the operator still scans', () => {
    const yes = code.slice(code.indexOf('setAddBagFor(confirmSecondBag)'), code.indexOf('Yes, Add Second Bag'))
    for (const w of ['assignOrderBag', 'fetch(', '/bags']) expect(yes, w).not.toContain(w)
  })
})

describe('6 · the post-scan BAG REQUIRED prompt is untouched', () => {
  it('it still assigns directly — it is always a FIRST bag', () => {
    // That prompt appears for a bagless order after a garment scan; it never
    // routes through onAdd, so the confirmation can never intercept it.
    expect(code).toContain('if (c) assignOrderBag(c, bagNeededFor)')
    // Bounded to the panel itself — an unbounded slice ran to EOF and swept in
    // the order card, which legitimately does reference the confirmation.
    const start = code.indexOf('{bagNeededFor && (')
    const prompt = code.slice(start, code.indexOf('Find any garment', start))
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).not.toContain('setConfirmSecondBag')
    expect(prompt).not.toContain('confirmSecondBag')
  })
})

describe('7/8 · nothing outside this screen moved', () => {
  it('no bag capacity, weight, auto-close or auto-release was introduced', () => {
    const panel = code.slice(code.indexOf('{confirmSecondBag && ('), code.indexOf('{addBagFor && ('))
    for (const w of ['weight', 'capacity', 'FULL"', 'release', 'status', 'fetch(']) expect(panel, w).not.toContain(w)
  })

  it('the bag assignment API and its guards are still the only writer', () => {
    // The confirmation adds no request of its own; assignment still goes
    // through the one existing call.
    expect((code.match(/\/api\/laundry\/orders\/\$\{[^}]+\}\/bags/g) || []).length).toBe(2) // GET list + POST assign
  })

  it('the completion gate is untouched', () => {
    expect(code).toContain('const readyOrders = orders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
    expect(code).toContain('action: "assign_bag"')
  })
})
