import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  CUSTODIAN_FOR_STATUS, custodianForStatus, custodyFor,
  BAG_STATUS, CUSTODIAN, bucketFor, tallyInventory, activeTotal,
} from '@/lib/laundry-bag-lifecycle'
import { activeBagForService, bagsForService, sortingBagViews, otherBagsOnOrder } from '@/lib/laundry-sorting-bags'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

// ============================================================================
// ONE PHYSICAL BAG, ONE CURRENT HOLDER.
//
// `status` (can it be used?) and `custodian` (who is holding it?) are two halves
// of ONE fact. Only the two delivery-side functions ever wrote both. Every other
// transition wrote `status` alone and left custody at whatever the last delivery
// set, or at the LAUNDRY default the bag was created with — so one bag could
// read as current in two places at once.
//
// Production had exactly that: BAG-000001 as PROCESSING (at the plant) with
// custodian DELIVERY_EXECUTIVE (in a van), and sixteen COLLECTED bags still
// claiming to be sitting in LAUNDRY stock.
// ============================================================================
describe('receiving a bag releases the previous holder', () => {
  it('every status the model defines implies exactly one holder', () => {
    for (const status of Object.values(BAG_STATUS)) {
      expect(CUSTODIAN_FOR_STATUS[status], `no holder defined for ${status}`).toBeTruthy()
      expect(Object.values(CUSTODIAN)).toContain(CUSTODIAN_FOR_STATUS[status])
    }
  })

  it('the plant receiving it takes it out of the store’s hands', () => {
    expect(custodianForStatus(BAG_STATUS.PROCESSING)).toBe(CUSTODIAN.PROCESSING_CENTER)
    expect(custodianForStatus(BAG_STATUS.RECEIVED_AT_STORE)).toBe(CUSTODIAN.STORE)
  })

  it('the store receiving it back takes it out of the plant’s hands', () => {
    expect(custodianForStatus(BAG_STATUS.READY_FOR_DELIVERY)).toBe(CUSTODIAN.STORE)
  })

  it('handing it over moves it to the customer; taking it back does not', () => {
    expect(custodianForStatus(BAG_STATUS.HANDED_TO_CUSTOMER)).toBe(CUSTODIAN.CUSTOMER)
    expect(custodianForStatus(BAG_STATUS.RETURNED_BY_CUSTOMER)).toBe(CUSTODIAN.DELIVERY_EXECUTIVE)
  })

  it('back in stock means held by the laundry and by nobody else', () => {
    const patch = custodyFor(BAG_STATUS.AVAILABLE)
    expect(patch.currentCustodianType).toBe(CUSTODIAN.LAUNDRY)
    expect(patch.currentCustodianId).toBeNull()
    expect(patch.currentCustodianName).toBeNull()
    // …and it is no longer recorded as sitting with a customer
    expect(patch.handedToCustomerAt).toBeNull()
    expect(patch.handedToCustomerOrderId).toBeNull()
  })

  it('a customer-held bag keeps its retention stamps', () => {
    const patch = custodyFor(BAG_STATUS.HANDED_TO_CUSTOMER)
    expect(patch.currentCustodianType).toBe(CUSTODIAN.CUSTOMER)
    expect('handedToCustomerAt' in patch).toBe(false)
  })

  it('an explicit holder still wins — LOST stays where it was last seen', () => {
    expect(custodyFor(BAG_STATUS.DAMAGED, { custodian: CUSTODIAN.CUSTOMER }).currentCustodianType).toBe(CUSTODIAN.CUSTOMER)
    expect(custodianForStatus(BAG_STATUS.LOST)).toBe(CUSTODIAN.CUSTOMER)
  })

  it('an unknown status does not silently become a holder', () => {
    expect(custodianForStatus('SOMETHING_NEW')).toBe(CUSTODIAN.LAUNDRY)
  })

  it('storeId is only written when the caller says so', () => {
    expect('currentStoreId' in custodyFor(BAG_STATUS.PROCESSING)).toBe(false)
    expect(custodyFor(BAG_STATUS.AVAILABLE, { storeId: null }).currentStoreId).toBeNull()
  })
})

// ── The structural guard ────────────────────────────────────────────────────
// This is the part that stops the bug coming back. Any writer that moves a
// bag's status must write its custody in the same statement; a new endpoint
// that forgets fails here rather than in production three weeks later.
describe('no writer can move a bag’s status without its holder', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const full = join(dir, f)
      if (statSync(full).isDirectory()) return f === 'node_modules' || f === '__tests__' ? [] : walk(full)
      return full.endsWith('.ts') ? [full] : []
    })

  const files = walk(join(process.cwd(), 'src')).map((f) => f.replace(process.cwd() + '/', ''))

  it('finds the bag writers at all (the guard is not vacuous)', () => {
    const writers = files.filter((f) => /laundryBag\.update(Many)?\(/.test(code(f)))
    expect(writers.length).toBeGreaterThanOrEqual(8)
  })

  /** The text of ONE call's arguments, by balanced parens — not a fixed window.
   *  A fixed window spills into the next statement and flags a notes-only
   *  update because some later call happens to mention `status:`. */
  const callArgs = (src: string, from: number): string => {
    let depth = 0
    for (let i = from; i < src.length; i++) {
      const c = src[i]
      if (c === '(') depth++
      else if (c === ')') { depth--; if (depth === 0) return src.slice(from, i + 1) }
    }
    return src.slice(from)
  }

  /** Just the `data: { … }` object — a `status:` in a WHERE clause is a filter,
   *  not a write, and flagging it would be noise. */
  const dataBlock = (args: string): string => {
    const at = args.indexOf('data:')
    if (at < 0) return ''
    const open = args.indexOf('{', at)
    if (open < 0) return ''
    let depth = 0
    for (let i = open; i < args.length; i++) {
      if (args[i] === '{') depth++
      else if (args[i] === '}') { depth--; if (depth === 0) return args.slice(open, i + 1) }
    }
    return args.slice(open)
  }

  it('the call extractor stops at the end of its own call', () => {
    const sample = 'x.update({ data: { notes: 1 } }) ; y.update({ data: { status: 2 } })'
    const args = callArgs(sample, sample.indexOf('('))
    expect(args).toContain('notes')
    expect(args).not.toContain('status')
  })

  it('a status in a WHERE clause is a filter, not a write', () => {
    const args = '({ where: { status: { notIn: ["AVAILABLE"] } }, data: { notes: 1 } })'
    expect(dataBlock(args)).toContain('notes')
    expect(dataBlock(args)).not.toContain('notIn')
  })

  it('every status write also writes the holder', () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = code(f)
      const re = /laundryBag\.update(?:Many)?\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        const body = dataBlock(callArgs(src, m.index + m[0].length - 1))
        if (!/\bstatus[,:]/.test(body)) continue                       // not a status move
        if (/currentCustodianType|custodyFor\(/.test(body)) continue    // writes both
        offenders.push(`${f} :: ${body.slice(0, 110).replace(/\s+/g, ' ')}`)
      }
    }
    expect(offenders, `these move a bag's status without its holder:\n${offenders.join('\n')}`).toEqual([])
  })
})

describe('the movement is recorded and cannot be double-claimed', () => {
  const advance = code('src/app/api/laundry/bags/advance/route.ts')

  it('the receive is guarded on the status it read', () => {
    expect(advance).toContain('where: { id: bag.id, status: bag.status }')
  })

  it('re-scanning an already-received bag succeeds instead of erroring', () => {
    expect(advance).toContain('alreadyThere: true')
    expect(advance).toContain('if (now?.status === toStatus)')
  })

  it('a genuine race is refused rather than creating a second current state', () => {
    expect(advance).toContain('code: "CONCURRENT_UPDATE"')
  })

  it('the movement is appended to the permanent history', () => {
    expect(advance).toContain('recordBagEvent')
    expect(advance).toContain('previousCustodianType: bag.currentCustodianType')
  })

  it('history is append-only — nothing here rewrites an event', () => {
    const lib = code('src/lib/laundry-bag-lifecycle.ts')
    expect(lib).toContain('laundryBagEvent.create')
    expect(lib).not.toContain('laundryBagEvent.update')
    expect(lib).not.toContain('laundryBagEvent.delete')
  })
})

describe('inventory still adds up, so a bag is counted in exactly one place', () => {
  it('a bag lands in one bucket only', () => {
    const bags = [
      { status: BAG_STATUS.AVAILABLE, currentCustodianType: CUSTODIAN.LAUNDRY },
      { status: BAG_STATUS.COLLECTED, currentCustodianType: CUSTODIAN.STORE },
      { status: BAG_STATUS.PROCESSING, currentCustodianType: CUSTODIAN.PROCESSING_CENTER },
      { status: BAG_STATUS.OUT_FOR_DELIVERY, currentCustodianType: CUSTODIAN.DELIVERY_EXECUTIVE },
      { status: BAG_STATUS.HANDED_TO_CUSTOMER, currentCustodianType: CUSTODIAN.CUSTOMER },
    ]
    for (const b of bags) expect(bucketFor(b)).toBeTruthy()
    const inv = tallyInventory(bags)
    expect(inv.total).toBe(bags.length)
    expect(activeTotal(inv)).toBeLessThanOrEqual(inv.total)
  })

  it('a stale holder put the bag in the WRONG place — this is the damage', () => {
    // BAG-000001 in production: received at the plant, custody left on the van.
    const stale = tallyInventory([{ status: BAG_STATUS.PROCESSING, currentCustodianType: CUSTODIAN.DELIVERY_EXECUTIVE }])
    expect(stale.withExecutives).toBe(1)
    expect(stale.atProcessingCenter).toBe(0)
    // With the holder written alongside the status it lands where it actually is.
    const fixed = tallyInventory([{ status: BAG_STATUS.PROCESSING, currentCustodianType: custodianForStatus(BAG_STATUS.PROCESSING) }])
    expect(fixed.atProcessingCenter).toBe(1)
    expect(fixed.withExecutives).toBe(0)
  })

  it('a COLLECTED bag with the LAUNDRY default was only right by accident', () => {
    // bucketFor DEFAULTS a mid-cycle bag to "at store", so these 16 displayed
    // correctly while the stored custody said they were in stock. The display
    // was masking the state, which is why the fix is in the writers.
    const masked = tallyInventory([{ status: BAG_STATUS.COLLECTED, currentCustodianType: CUSTODIAN.LAUNDRY }])
    expect(masked.atStore).toBe(1)
    expect(masked.available).toBe(0)
    expect(custodianForStatus(BAG_STATUS.COLLECTED)).toBe(CUSTODIAN.STORE)
  })
})

describe('the Sorting garment trail is untouched by any of this', () => {
  it('SORTING_SCAN still exists and is still the garment record', () => {
    const api = code('src/app/api/laundry/processing/sorting/route.ts')
    expect(api).toContain('const SCAN_ACTION = "SORTING_SCAN"')
    expect(api).toContain('prisma.laundryItemEvent.create')
  })

  it('nothing in the custody work deletes or rewrites a garment scan', () => {
    for (const f of [
      'src/lib/laundry-bag-lifecycle.ts',
      'src/lib/laundry-bag-assign.ts',
      'src/app/api/laundry/bags/advance/route.ts',
    ]) {
      const src = code(f)
      expect(src).not.toContain('laundryItemEvent.delete')
      expect(src).not.toContain('laundryItemEvent.update')
      expect(src).not.toContain('SORTING_SCAN')
    }
  })
})

// ============================================================================
// WHERE A BAG IS PICKED UP IS THE CALLER'S FACT, NOT THE STATUS'S.
//
// One COLLECTED status covers two different real situations: a pickup bag taken
// at the STORE, and a finishing bag picked up at the PROCESSING CENTER during
// Sorting. Deriving the holder from the status alone marked both as STORE —
// right for the first, wrong for the second. Asserting a wrong location is worse
// than the stale one the custody fix replaced, so the caller states it.
// ============================================================================
describe('the location of an assignment comes from the caller', () => {
  const assign = code('src/lib/laundry-bag-assign.ts')

  it('assignBagToOrder takes the location and defaults to the store', () => {
    expect(assign).toContain('custodian?: Custodian')
    expect(assign).toContain('custodyFor("COLLECTED", { custodian: opts.custodian ?? CUSTODIAN.STORE })')
  })

  it('pickup and packing are unchanged — they are at the store', () => {
    expect(custodianForStatus(BAG_STATUS.COLLECTED)).toBe(CUSTODIAN.STORE)
  })

  it('Sorting binds its bag at the plant, and says so', () => {
    // the workstation tells the endpoint where it is standing…
    expect(read('src/components/laundry/views/laundry-sorting-workstation.tsx')).toContain('custodian: "PROCESSING_CENTER"')
    // …the endpoint validates it against the enum rather than trusting the body…
    const route = code('src/app/api/laundry/orders/[id]/bags/route.ts')
    expect(route).toContain('(Object.values(CUSTODIAN) as string[]).includes(at)')
    expect(route).toContain('custodian,')
    // …and the terminal binding does the same server-side, with no client input.
    expect(code('src/lib/laundry-finishing.ts')).toContain('custodian: CUSTODIAN.PROCESSING_CENTER')
  })

  it('an invented location is ignored, not stored', () => {
    const route = code('src/app/api/laundry/orders/[id]/bags/route.ts')
    expect(route).toContain('? (at as Custodian) : undefined')
  })

  it('the plant assignment reports the plant, not the store', () => {
    expect(custodyFor(BAG_STATUS.COLLECTED, { custodian: CUSTODIAN.PROCESSING_CENTER }).currentCustodianType)
      .toBe(CUSTODIAN.PROCESSING_CENTER)
    expect(tallyInventory([{ status: BAG_STATUS.COLLECTED, currentCustodianType: CUSTODIAN.PROCESSING_CENTER }]).atProcessingCenter).toBe(1)
  })
})

// ============================================================================
// WHAT THE SORTING QUEUE IS ACTUALLY MADE OF.
//
// Sorting is a PROCESSING CENTRE workstation late in the route — WASH/DRYCLEAN
// → QC → SORTING → IRON/FOLD → Transit — and its queue is per-GARMENT, keyed on
// LaundryOrderItem.processingStage. It does not read bag status or custody at
// all, which is why a bag movement cannot add or remove an order from it.
// ============================================================================
describe('the Sorting queue is driven by garment stage, not by bags', () => {
  const proc = code('src/app/api/laundry/processing/route.ts')

  it('the queue query is per-garment and stage-keyed', () => {
    expect(proc).toContain('const queueWhere = { order: { businessId: biz.id }, processingStage: stage }')
  })

  it('it does not consult bag status or custody', () => {
    const q = proc.slice(proc.indexOf('const queueWhere ='), proc.indexOf('const queueGrouped'))
    expect(q).not.toContain('laundryBag')
    expect(q).not.toContain('currentCustodianType')
    expect(q).not.toContain('bagId')
  })

  it('Sorting sits after cleaning and QC, before the finishing stations', () => {
    const stages = code('src/lib/laundry-processing.ts')
    expect(stages).toContain('export const WORKSTATIONS = ["WASH", "DRYCLEAN", "QC", "SORTING", "IRON", "FOLD", "DISPATCHED"]')
  })

  it('a garment leaves the queue only by its own stage advancing', () => {
    const api = code('src/app/api/laundry/processing/sorting/route.ts')
    // the terminal binding is what advances them, per garment, on its own route
    expect(api).toContain('processingStage: "SORTING"')
    expect(api).toContain('const nxt = flow ? nextStageOf(flow, "SORTING") : null')
  })

  it('a released bag never removes a garment from the queue', () => {
    const release = code('src/lib/laundry-bag-assign.ts')
    expect(release).not.toContain('processingStage')
    expect(release).not.toContain('laundryOrderItem')
  })
})

describe('bag movement and garment history stay independent', () => {
  it('releasing a bag leaves its SORTING_SCAN trail untouched', () => {
    for (const f of ['src/lib/laundry-bag-assign.ts', 'src/lib/laundry-bag-lifecycle.ts', 'src/app/api/laundry/bags/advance/route.ts']) {
      expect(code(f)).not.toContain('laundryItemEvent')
    }
  })

  it('a reusable bag re-entering the workflow opens a NEW usage row', () => {
    // the same physical bag, released and used again, is a second row — which is
    // how V8BAG037 legitimately carries ORD-000034 twice: one closed, one open
    expect(code('src/lib/laundry-bag-assign.ts')).toContain('tx.laundryBagAssignment.create')
    expect(read('src/lib/laundry-order-bags.ts')).toContain('the existing assignment rows are untouched')
  })

  it('only the open row counts as current', () => {
    expect(code('src/lib/laundry-order-bags.ts')).toContain('open: r.status === OPEN_ASSIGNMENT')
  })
})

// ============================================================================
// A BAG'S ROLE IS NOT ITS LIFECYCLE, AND NOT ITS LOCATION.
//
// THE OPERATIONAL CONFUSION THIS FIXES. A pickup bag, a Sorting finishing bag
// and a delivery bag produced IDENTICAL assignment rows. The Sorting screen
// therefore showed whichever open row existed and called it "BAG 1 … ACTIVE",
// which reads as a claim about where the bag physically is.
//
// Production proof: ORD-…-000036 showed "BAG 1 V8BAG024 ACTIVE" with 18 garments
// at Sorting — while that order had ZERO SORTING_SCAN events, two garments still
// at WASH, and V8BAG024 had no movement history at all. The screen was asserting
// a sorting relationship that had never happened.
//
// Meanwhile ORD-…-000032/37/45, whose transport bags HAD been released, showed
// "NO BAG YET" — the correct prompt. Same situation, opposite answers, decided
// by whether an unrelated transport bag happened to still be open.
// ============================================================================
describe('the Sorting bag is the bag garments are sorted INTO', () => {
  const t = (iso: string) => new Date(iso)
  const sortingBag = { bagNumber: 'V8BAG051', serviceId: 's-wi', serviceName: 'Wash & Iron', open: true, assignedAt: t('2026-08-29T11:00:00Z'), purpose: 'SORTING' }
  const pickupBag  = { bagNumber: 'V8BAG024', serviceId: 's-wi', serviceName: 'Wash & Iron', open: true, assignedAt: t('2026-08-28T04:00:00Z'), purpose: 'PICKUP' }
  const legacyBag  = { bagNumber: 'V8BAG024', serviceId: 's-wi', serviceName: 'Wash & Iron', open: true, assignedAt: t('2026-08-28T04:00:00Z'), purpose: null }

  it('reproduces it: an open PICKUP bag is not the Sorting bag', () => {
    expect(activeBagForService([pickupBag], 's-wi', 'Wash & Iron')).toBeNull()
    expect(bagsForService([pickupBag], 's-wi', 'Wash & Iron')).toEqual([])
  })

  it('a row whose role was never recorded is not the Sorting bag either', () => {
    // ORD-…-000036's V8BAG024 exactly: open, right service, no evidence it is a
    // sorting bag. Guessing yes is what produced the false ACTIVE label.
    expect(activeBagForService([legacyBag], 's-wi', 'Wash & Iron')).toBeNull()
  })

  it('a genuine Sorting bag still answers', () => {
    expect(activeBagForService([sortingBag], 's-wi', 'Wash & Iron')?.bagNumber).toBe('V8BAG051')
  })

  it('a transport bag alongside a Sorting bag does not displace it', () => {
    // the pickup bag is NEWER in neither direction — role decides, not time
    expect(activeBagForService([pickupBag, sortingBag], 's-wi', 'Wash & Iron')?.bagNumber).toBe('V8BAG051')
    expect(bagsForService([pickupBag, sortingBag], 's-wi', 'Wash & Iron').map((b) => b.bagNumber)).toEqual(['V8BAG051'])
  })

  it('the other bags are SHOWN, not hidden — they are just not the Sorting bag', () => {
    expect(otherBagsOnOrder([pickupBag, sortingBag]).map((b) => b.bagNumber)).toEqual(['V8BAG024'])
    expect(otherBagsOnOrder([legacyBag]).map((b) => b.purpose)).toEqual([null])
    // a closed row is history, not a current other-bag
    expect(otherBagsOnOrder([{ ...pickupBag, open: false }])).toEqual([])
  })

  it('multi-bag: two Sorting bags of one service still work, newest in use', () => {
    const second = { ...sortingBag, bagNumber: 'V8BAG054', assignedAt: t('2026-08-29T12:00:00Z') }
    expect(sortingBagViews([sortingBag, second, pickupBag], 's-wi', 'Wash & Iron', [])).toEqual([
      { bagNumber: 'V8BAG051', index: 1, state: 'FULL', garments: 0 },
      { bagNumber: 'V8BAG054', index: 2, state: 'ACTIVE', garments: 0 },
    ])
  })

  it('multi-service: one service’s Sorting bag never answers for another', () => {
    const fold = { ...sortingBag, bagNumber: 'V8BAG052', serviceId: 's-wf', serviceName: 'Wash & Fold' }
    expect(activeBagForService([sortingBag, fold], 's-wf', 'Wash & Fold')?.bagNumber).toBe('V8BAG052')
    expect(activeBagForService([sortingBag, fold], 's-wi', 'Wash & Iron')?.bagNumber).toBe('V8BAG051')
  })

  it('the role is recorded at write time, by the caller that knows it', () => {
    const assign = code('src/lib/laundry-bag-assign.ts')
    expect(assign).toContain('purpose?: BagPurpose')
    expect(assign).toContain('purpose: opts.purpose ?? null')
    // Sorting says SORTING; pickup says PICKUP
    expect(read('src/components/laundry/views/laundry-sorting-workstation.tsx')).toContain('purpose: "SORTING"')
    expect(code('src/lib/laundry-finishing.ts')).toContain('purpose: BAG_PURPOSE.SORTING')
    expect(code('src/app/api/laundry/bags/assign/route.ts')).toContain('purpose: BAG_PURPOSE.PICKUP')
    expect(code('src/app/api/laundry/executive/jobs/[id]/assign-bag/route.ts')).toContain('purpose: BAG_PURPOSE.PICKUP')
  })

  it('an invented role is ignored rather than stored', () => {
    expect(code('src/app/api/laundry/orders/[id]/bags/route.ts')).toContain('isBagPurpose(purposeIn) ? purposeIn : undefined')
  })

  it('re-scanning at Sorting records a role that was never captured — no migration', () => {
    const assign = code('src/lib/laundry-bag-assign.ts')
    const branch = assign.slice(assign.indexOf('if (bag.currentOrderId === orderId) {'), assign.indexOf('if (bag.status !== "AVAILABLE")'))
    expect(branch).toContain('status: "ASSIGNED", purpose: null')   // only fills a blank…
    expect(branch).toContain('data: { purpose: opts.purpose }')
    expect(branch).not.toContain('laundryBagAssignment.create')     // …never a second row
  })

  it('bag ACCOUNTING still counts every bag, whatever its role', () => {
    // transport accounting is about physical bags, not sorting — it must not
    // inherit the Sorting screen's narrower question
    expect(code('src/lib/laundry-service-bags.ts')).not.toContain('purpose')
  })
})

describe('custody and Sorting work remain separate facts', () => {
  it('the Sorting screen states the bag ROLE, and never a custody state', () => {
    // The panel that carried a bag index and a use/full label is gone — staff
    // were reading a lifecycle where they wanted one fact. What replaced it
    // says only which Sorting bag is attached, so there is no longer any label
    // on this screen that could be mistaken for where a bag physically is.
    const raw = read('src/components/laundry/views/laundry-sorting-workstation.tsx')
    expect(raw).toContain('Sorting Bag{many ? "s" : ""} Attached')
    expect(raw).toContain('Bag Required')
    // The screen never DISPLAYS a custody state. It does still SEND one when a
    // bag is assigned (custodian: "PROCESSING_CENTER" on the assignment call) —
    // that is the assignment act itself, part of the backend contract, and is
    // deliberately not what this guards. What must never appear is a custody
    // state presented to the operator as though it were the bag's Sorting role.
    const src = code('src/components/laundry/views/laundry-sorting-workstation.tsx')
    for (const w of ['IN_STORE', 'WITH_CUSTOMER', 'OUT_FOR_DELIVERY', 'AVAILABLE']) {
      expect(src, w).not.toContain(w)
    }
    // The one custody mention is the assignment request field, nothing else.
    expect((src.match(/custodian/g) || []).length).toBe(1)
    expect(src).toContain('custodian: "PROCESSING_CENTER"')
  })

  it('it answers no custody question because it no longer shows other-purpose bags', () => {
    // Stronger than the old guarantee. The screen used to LIST the order's
    // transport and delivery bags (labelled, to stop them being read as the
    // Sorting bag) and point custody questions at Bag Management. It now shows
    // only SORTING-purpose bags at all, so there is nothing to mislabel and
    // nothing to redirect.
    // Asserted on the CODE: the surviving mentions are comments explaining
    // which bag roles the canonical reader excludes.
    const src = code('src/components/laundry/views/laundry-sorting-workstation.tsx')
    expect(src).not.toContain('Other bags on this order')
    expect(src).not.toContain('pickup bag')
    expect(src).not.toContain('delivery bag')
    // Bag role is still decided by the canonical reader, which filters on
    // purpose === SORTING.
    expect(src).toContain('sortingBagStatus(')
    expect(src).toContain('bagsForService(')
  })

  it('the sorting resolver reads no custody field at all', () => {
    const lib = code('src/lib/laundry-sorting-bags.ts')
    expect(lib).not.toContain('currentCustodianType')
    expect(lib).not.toContain('CUSTODIAN')
  })

  it('assigning a Sorting bag does not advance any garment', () => {
    const assign = code('src/lib/laundry-bag-assign.ts')
    expect(assign).not.toContain('processingStage')
    expect(assign).not.toContain('laundryOrderItem')
  })
})
