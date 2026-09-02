import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { activeBagForService, sortingBagViews, bagAtTime, type SortingBagRow } from '@/lib/laundry-sorting-bags'

// ============================================================================
// THE SORTING SCREEN MUST DESCRIBE THE WORKFLOW IT ACTUALLY HAS.
//
// Sorting does two different things that used to share one name:
//
//   ASSIGNING THE BAG   which physical bag these garments go into. Any time,
//                       as many bags as the order fills.
//   COMPLETING SORTING  every garment scanned → retire barcodes → advance the
//                       order out of the stage.
//
// The screen described only the second, and described it as the first: "scan
// every garment of an order first — the bag unlock appears here when the
// scanned count matches", under a card titled "Bind the Bag (1 order = 1 bag)".
// An operator reading that believes a bag cannot be scanned until the order is
// fully scanned, and that an order may only ever have one bag. Both are false,
// and both contradict the flow the rest of the screen implements.
//
// These are source assertions because the strings ARE the deliverable: the
// screen is a large client tree whose data comes from the network, and what is
// worth pinning is that no instruction describing the superseded workflow can
// come back. The bag rules themselves are asserted for real, below.
// ============================================================================

const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
/** The rendered strings only — comments explain history and may quote it. */
const UI = SORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

describe('K · no instruction from the superseded workflow survives', () => {
  it.each([
    ['scan every garment', /scan every garment/i],
    ['the scanned-count unlock', /scanned count matches|when the scanned count equals/i],
    ['"scan ONE bag to bind"', /scan ONE .{0,40}to bind/i],
    ['the bag unlock', /bag unlock/i],
    ['one bag per order', /1 order = 1 bag/i],
    ['"bind the whole order"', /bind the whole order/i],
  ])('%s is gone from the rendered UI', (_label, pattern) => {
    expect(UI).not.toMatch(pattern)
  })

  it('the approved instruction is what the operator reads instead', () => {
    expect(UI).toContain('Scan a garment to identify the order.')
    expect(UI).toContain('If no sorting bag is assigned, scan the bag this order will use.')
    expect(UI).toContain('continue scanning garments into the current sorting bag')
  })

  it('the completion card is named for what it does — finishing the stage', () => {
    expect(UI).toContain('Complete Sorting')
    // …and says so without implying it is what picks the bag.
    expect(UI).toContain('it is not what decides which bag a garment goes into')
  })
})

describe('the three banner states the operator must be able to tell apart', () => {
  it('1 · no bag yet — BAG REQUIRED, and never a "next" bag', () => {
    expect(UI).toContain('BAG REQUIRED')
    // Reworded to name the required ACTION, so an operator is not left
    // wondering whether a bag is already attached. Same banner state.
    expect(UI).toContain('ATTACH A SORTING BAG BEFORE COMPLETING SORTING')
  })

  it('2 · a bag is current — it is named, and garments are told to go in it', () => {
    expect(UI).toContain('Current sorting bag')
    expect(UI).toContain('ADD GARMENTS TO THIS BAG')
  })

  it('3 · the bag was closed — full, then ask for the next one', () => {
    expect(UI).toContain('Current bag full/closed')
    expect(UI).toContain('SCAN NEXT AVAILABLE BAG')
  })

  it('C · the FIRST bag is never described as a next/second/replacement bag', () => {
    // The add-bag panel is context-sensitive on the assignment rows, so the
    // "the current one becomes FULL" sentence cannot be shown when there is no
    // current one. Pinned as the branch, not the absence of a word.
    expect(UI).toContain('Assign first bag')
    expect(UI).toContain('bagPanelExisting ?')
    expect(UI).toContain('Scan the bag this order will use — it becomes this service\'s Sorting bag.')
  })
})

// ── The bag rules themselves, against the real module ───────────────────────
const bag = (n: string, at: string, over: Partial<SortingBagRow> = {}): SortingBagRow =>
  ({ bagNumber: n, purpose: 'SORTING', open: true, serviceId: 'svc1', serviceName: 'Wash', assignedAt: at, ...over })

describe('the current-bag rule Sorting actually runs on', () => {
  it('A · no bag assigned → null, which is the BAG REQUIRED prompt', () => {
    expect(activeBagForService([], 'svc1', 'Wash')).toBeNull()
  })

  it('A · one bag assigned → that bag is current', () => {
    expect(activeBagForService([bag('VBBAG001', '2026-08-30T10:00:00Z')], 'svc1', 'Wash')?.bagNumber).toBe('VBBAG001')
  })

  it('E/F · the newest bag is current, and an order may hold three', () => {
    const bags = [bag('VBBAG001', '2026-08-30T10:00:00Z'), bag('VBBAG002', '2026-08-30T11:00:00Z'), bag('VBBAG003', '2026-08-30T12:00:00Z')]
    expect(activeBagForService(bags, 'svc1', 'Wash')?.bagNumber).toBe('VBBAG003')
    const views = sortingBagViews(bags, 'svc1', 'Wash', [])
    expect(views.map((v) => [v.index, v.bagNumber, v.state])).toEqual([
      [1, 'VBBAG001', 'FULL'], [2, 'VBBAG002', 'FULL'], [3, 'VBBAG003', 'ACTIVE'],
    ])
  })

  it('no garment count closes a bag — only a later assignment does', () => {
    // 40 garments into one bag leaves it ACTIVE. Nothing auto-fills or switches.
    const one = [bag('VBBAG001', '2026-08-30T10:00:00Z')]
    const scans = Array.from({ length: 40 }, (_, i) => `2026-08-30T10:${String(i).padStart(2, '0')}:00Z`)
    const views = sortingBagViews(one, 'svc1', 'Wash', scans)
    expect(views).toHaveLength(1)
    expect(views[0].state).toBe('ACTIVE')
    expect(views[0].garments).toBe(40)
  })

  it('a garment keeps the bag it was scanned into when the next bag is added', () => {
    const bags = [bag('VBBAG001', '2026-08-30T10:00:00Z'), bag('VBBAG002', '2026-08-30T12:00:00Z')]
    expect(bagAtTime(bags, 'svc1', 'Wash', '2026-08-30T11:00:00Z')?.bagNumber).toBe('VBBAG001')
    expect(bagAtTime(bags, 'svc1', 'Wash', '2026-08-30T13:00:00Z')?.bagNumber).toBe('VBBAG002')
  })

  it('a transport bag is not the Sorting bag, so it cannot answer for one', () => {
    const pickup = [bag('VBBAG009', '2026-08-30T09:00:00Z', { purpose: 'PICKUP' })]
    expect(activeBagForService(pickup, 'svc1', 'Wash')).toBeNull()
  })
})
