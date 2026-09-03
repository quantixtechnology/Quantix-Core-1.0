import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { scanModeAcceptance, finishingScanTarget, isBagCode, isProcessingPackageCode } from '@/lib/laundry-finishing'

// ============================================================================
// THE FINISHING SCAN GATE, FOR IRON AND FOLDING ALIKE.
//
// Iron and Folding are one workstation with a stage prop, one API route with a
// stage parameter, and one scan gate that takes no stage at all. That is the
// point: the rule cannot drift between them, and these tests pin the sharing
// as well as the rule.
//
// The rule itself: a REUSE_BAG workspace expects the bag, and a container built
// FROM a pickup bag carries that bag's code, so it holds. A container built
// WITHOUT one — a walk-in, counter order — never had a bag. Its PKG code is the
// only identifier it will ever have, and the gate used to refuse it: the
// operator saw PKG-202609-000001 waiting at Folding, scanned exactly what the
// screen showed, and was told to "scan the bag instead" when no bag existed.
// The container could only be opened by clicking Load Container, which bypasses
// the gate entirely.
//
// The exception is per container, read from its own reusedBagQr, so it cannot
// widen to bag-backed containers or to a PKG code that resolves to nothing.
// ============================================================================

const FINISHING = readFileSync(join(process.cwd(), 'src/lib/laundry-finishing.ts'), 'utf8')
const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/processing/finishing/route.ts'), 'utf8')
const ROUTER = readFileSync(join(process.cwd(), 'src/components/laundry/laundry-page-router.tsx'), 'utf8')
const WS = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-finishing-workstation.tsx'), 'utf8')

const BAG_BACKED = { reusedBagQr: true }
const WALK_IN = { reusedBagQr: false }
/** Both finishing stages. Every rule below must hold for each. */
const STAGES = ['IRON', 'FOLD'] as const

describe('1 · Iron and Folding are the same path, so the rule cannot differ', () => {
  it('both stages render one component, differing only by prop', () => {
    expect(ROUTER).toContain('case "ws-iron": return <LaundryFinishingWorkstation stage="IRON" />')
    expect(ROUTER).toContain('case "ws-fold": return <LaundryFinishingWorkstation stage="FOLD" />')
  })

  it('the gate and the scan target take no stage — they cannot diverge', () => {
    // If a stage argument ever appears here, the two stations can drift apart.
    expect(FINISHING).toContain('export function finishingScanTarget(mode: string | null | undefined)')
    expect(FINISHING).toMatch(/export function scanModeAcceptance\(\s*code: string,\s*mode: string \| null \| undefined,/)
    const gate = FINISHING.slice(FINISHING.indexOf('export function scanModeAcceptance'), FINISHING.indexOf('// Garments belonging to a Processing Package'))
    expect(gate).not.toMatch(/\bstage\b/)
  })

  it('one API route serves both, and validates the stage', () => {
    expect(API).toContain('const STAGE_SCREEN: Record<string, string> = { IRON: "ironing", FOLD: "folding" }')
    expect(API).toContain('if (!STAGE_SCREEN[stage]) return NextResponse.json({ error: "Missing or invalid finishing stage" }, { status: 400 })')
    // …and permission is resolved per stage, so neither station inherits the other's.
    expect(API).toContain('`processing.${STAGE_SCREEN[stage]}.view`')
  })
})

describe('2 · REUSE_BAG — the workspace scans the bag', () => {
  it.each(STAGES)('%s · a bag-backed container is opened by its bag code', () => {
    expect(scanModeAcceptance('PB-FINTEST-01', 'REUSE_BAG', BAG_BACKED)).toBeNull()
    expect(scanModeAcceptance('V8BAG001', 'REUSE_BAG', BAG_BACKED)).toBeNull()
    expect(scanModeAcceptance('BAG-000123', 'REUSE_BAG', BAG_BACKED)).toBeNull()
  })

  it.each(STAGES)('%s · a Processing Packet is still refused for a bag-backed container', () => {
    expect(scanModeAcceptance('PKG-202609-000001', 'REUSE_BAG', BAG_BACKED))
      .toBe('This workspace scans the laundry bag, not a Processing Packet — scan the bag instead.')
  })

  it.each(STAGES)('%s · a walk-in container IS opened by its PKG code', () => {
    // The fix. This container has no bag and never had one.
    expect(scanModeAcceptance('PKG-202609-000001', 'REUSE_BAG', WALK_IN)).toBeNull()
  })

  it.each(STAGES)('%s · a PKG code that resolves to nothing is still refused', () => {
    // No container, no exception — an unknown packet must not open the station.
    for (const ctx of [null, undefined]) {
      expect(scanModeAcceptance('PKG-NOT-REAL', 'REUSE_BAG', ctx))
        .toBe('This workspace scans the laundry bag, not a Processing Packet — scan the bag instead.')
    }
  })
})

describe('3 · the other two modes are untouched', () => {
  it.each(STAGES)('%s · GENERATE_NEW takes the packet and refuses the bag', () => {
    expect(scanModeAcceptance('PKG-202609-000001', 'GENERATE_NEW', WALK_IN)).toBeNull()
    expect(scanModeAcceptance('PKG-202609-000001', 'GENERATE_NEW', null)).toBeNull()
    const bagErr = 'This workspace scans the Processing Packet — scan the packet QR instead of the bag.'
    expect(scanModeAcceptance('PB-FINTEST-01', 'GENERATE_NEW', BAG_BACKED)).toBe(bagErr)
    expect(scanModeAcceptance('V8BAG001', 'GENERATE_NEW', null)).toBe(bagErr)
  })

  it.each(STAGES)('%s · BOTH takes either', () => {
    for (const code of ['PKG-202609-000001', 'PB-FINTEST-01', 'V8BAG001']) {
      expect(scanModeAcceptance(code, 'BOTH', BAG_BACKED)).toBeNull()
      expect(scanModeAcceptance(code, 'BOTH', WALK_IN)).toBeNull()
    }
  })

  it.each(STAGES)('%s · the container exception never loosens the BAG-side guard', () => {
    // A bag code in a packet workspace stays refused whatever the container is.
    for (const ctx of [BAG_BACKED, WALK_IN, null]) {
      expect(scanModeAcceptance('V8BAG001', 'GENERATE_NEW', ctx)).not.toBeNull()
    }
  })
})

describe('4 · the labels each mode shows, shared by both stations', () => {
  it('REUSE_BAG asks for the bag, GENERATE_NEW for the packet, BOTH for either', () => {
    expect(finishingScanTarget('REUSE_BAG')).toEqual({ label: 'Scan Laundry Bag', isBag: true, isPackage: false, hint: 'V8BAG001 / PB-…' })
    expect(finishingScanTarget('GENERATE_NEW').label).toBe('Scan Processing Packet')
    expect(finishingScanTarget('BOTH')).toMatchObject({ isBag: true, isPackage: true })
    expect(finishingScanTarget(null).label).toBe('Scan Processing Packet')   // safe default
  })

  it('code classification is by prefix, not by stage', () => {
    expect(isProcessingPackageCode('PKG-202609-000001')).toBe(true)
    expect(isBagCode('PB-202609-000001')).toBe(true)
    expect(isBagCode('BAG-000123')).toBe(true)
    expect(isBagCode('V8BAG001')).toBe(true)
    expect(isBagCode('PKG-202609-000001')).toBe(false)
  })
})

describe('5 · the stage stays authoritative', () => {
  it('the waiting list is filtered to garments at THIS stage', () => {
    expect(API).toContain('where: { order: { businessId: biz.id, status: { notIn: ["CANCELLED", "DELIVERED"] } }, processingStage: stage },')
  })

  it('a loaded container marks only the garments at THIS stage as workable', () => {
    expect(API).toContain('atThisStage: i.processingStage === stage')
  })

  it('the container chosen for a scanned bag is the one holding garments at THIS stage', () => {
    expect(API).toContain('async function pickContainerForStage(orderId: string, stage: string)')
    expect(API).toContain('processingStage: stage } })')
    // Measured: opening a FOLD container at IRON returns it with atStage 0 —
    // nothing to work on. That is pre-existing and the gate does not change it;
    // it behaves the same under GENERATE_NEW, where the packet was always taken.
  })

  it('the workstation carries its stage into every request it makes', () => {
    // The prop is typed `string` rather than a union, so the guarantee that
    // only IRON/FOLD reach it comes from the router (asserted above) and the
    // API's STAGE_SCREEN check — not from this component's own signature.
    expect(WS).toContain('{ stage, icon: Icon = Shirt }: { stage: string;')
    expect(WS).toContain('businessId=${currentBusinessId}&stage=${stage}')
    expect(WS).toContain("const p = new URLSearchParams({ businessId: currentBusinessId, stage })")
  })
})

describe('6 · the gate now sees the container, and nothing else moved', () => {
  it('the API resolves the container before applying the gate', () => {
    const lookup = API.indexOf('const byPackage = await prisma.laundryProcessingPackage.findFirst(')
    const gate = API.indexOf('const modeError = scanModeAcceptance(')
    expect(lookup).toBeGreaterThan(-1)
    expect(gate).toBeGreaterThan(lookup)          // lookup first, gate second
    expect(API).toContain('scanModeAcceptance(c, mode, byPackage ? { reusedBagQr: byPackage.reusedBagQr } : null)')
  })

  it('a refusal is still a 409 with the same operator wording', () => {
    expect(API).toContain('if (modeError) return NextResponse.json({ success: false, error: modeError }, { status: 409 })')
  })

  it('the container lookup itself is unchanged — same query, one step earlier', () => {
    expect(API).toContain('where: { businessId: biz.id, OR: [{ code: c }, { qrValue: c }] },')
  })
})
