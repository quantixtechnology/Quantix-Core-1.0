import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  CUSTODIAN_FOR_STATUS, custodianForStatus, custodyFor,
  BAG_STATUS, CUSTODIAN, bucketFor, tallyInventory, activeTotal,
} from '@/lib/laundry-bag-lifecycle'

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
