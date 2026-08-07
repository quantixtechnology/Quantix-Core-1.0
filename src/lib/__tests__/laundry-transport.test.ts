import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Transport Setup as the single source of truth — which identifier (packet QR
// or laundry bag QR) is generated, rendered, searched and scanned.
// ============================================================================

const mocks = vi.hoisted(() => ({
  bizFindUnique: vi.fn(),
  packetFindMany: vi.fn().mockResolvedValue([]),
  packetFindFirst: vi.fn().mockResolvedValue(null),
  bagFindMany: vi.fn().mockResolvedValue([]),
  bagFindFirst: vi.fn().mockResolvedValue(null),
  asgFindMany: vi.fn().mockResolvedValue([]),
  asgFindFirst: vi.fn().mockResolvedValue(null),
  orderFindFirst: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryBusiness: { findUnique: mocks.bizFindUnique },
    laundryPacket: { findMany: mocks.packetFindMany, findFirst: mocks.packetFindFirst },
    laundryBag: { findMany: mocks.bagFindMany, findFirst: mocks.bagFindFirst },
    laundryBagAssignment: { findMany: mocks.asgFindMany, findFirst: mocks.asgFindFirst },
    laundryOrder: { findFirst: mocks.orderFindFirst },
  },
}))

import {
  transportNoun, transportScanPlaceholder, usesBag, usesPacket, normalizeTransportMode,
} from '@/lib/laundry-transport'
import {
  getTransportModes, resolveOrderByTransportCode, transportRefForOrder, transportRefsForOrders,
} from '@/lib/laundry-transport-server'

const PACKET = { orderId: 'o1', packetNumber: 'PKT-ORD-1', qrValue: 'PKT-ORD-1' }
const BAG = { currentOrderId: 'o1', bagNumber: 'BAG-000123', qrValue: 'BAG-000123' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.packetFindMany.mockResolvedValue([])
  mocks.packetFindFirst.mockResolvedValue(null)
  mocks.bagFindMany.mockResolvedValue([])
  mocks.bagFindFirst.mockResolvedValue(null)
  mocks.asgFindMany.mockResolvedValue([])
  mocks.asgFindFirst.mockResolvedValue(null)
  mocks.orderFindFirst.mockResolvedValue({ id: 'o1', orderNumber: 'ORD-1', status: 'PACKED' })
})

describe('transport mode semantics', () => {
  it('BAG mode never uses a packet, PACKET mode never uses a bag', () => {
    expect(usesPacket('BAG')).toBe(false)
    expect(usesBag('BAG')).toBe(true)
    expect(usesPacket('PACKET')).toBe(true)
    expect(usesBag('PACKET')).toBe(false)
  })

  it('BOTH supports both identifiers', () => {
    expect(usesPacket('BOTH')).toBe(true)
    expect(usesBag('BOTH')).toBe(true)
  })

  it('labels and scan hints follow the mode', () => {
    expect(transportNoun('BAG')).toBe('Bag')
    expect(transportNoun('PACKET')).toBe('Packet')
    expect(transportScanPlaceholder('BAG')).toContain('BAG-')
    expect(transportScanPlaceholder('BAG')).not.toContain('PKT-')
    expect(transportScanPlaceholder('PACKET')).toContain('PKT-')
  })

  it('unknown / missing configuration falls back to PACKET', () => {
    expect(normalizeTransportMode(undefined)).toBe('PACKET')
    expect(normalizeTransportMode('NONSENSE')).toBe('PACKET')
    expect(normalizeTransportMode('BAG')).toBe('BAG')
  })

  it('reads both directions from the business row', async () => {
    mocks.bizFindUnique.mockResolvedValue({ storeToProcessingTransportMode: 'BAG', processingToStoreTransportMode: 'BOTH' })
    expect(await getTransportModes('lb1')).toEqual({ storeToProcessing: 'BAG', processingToStore: 'BOTH' })
  })
})

describe('transport reference resolution', () => {
  it('BAG mode shows the bag, never the packet, when both exist', async () => {
    mocks.packetFindMany.mockResolvedValue([PACKET])
    mocks.bagFindMany.mockResolvedValue([BAG])
    const ref = await transportRefForOrder('lb1', 'o1', 'BAG')
    expect(ref.kind).toBe('BAG')
    expect(ref.code).toBe('BAG-000123')
    expect(ref.packetNumber).toBeNull()
  })

  it('PACKET mode shows the packet and ignores the bag', async () => {
    mocks.packetFindMany.mockResolvedValue([PACKET])
    mocks.bagFindMany.mockResolvedValue([BAG])
    const ref = await transportRefForOrder('lb1', 'o1', 'PACKET')
    expect(ref.kind).toBe('PACKET')
    expect(ref.code).toBe('PKT-ORD-1')
    expect(ref.bagNumber).toBeNull()
    // No bag query is even issued in PACKET mode.
    expect(mocks.bagFindMany).not.toHaveBeenCalled()
  })

  it('BOTH mode carries both identifiers', async () => {
    mocks.packetFindMany.mockResolvedValue([PACKET])
    mocks.bagFindMany.mockResolvedValue([BAG])
    const ref = await transportRefForOrder('lb1', 'o1', 'BOTH')
    expect(ref.packetNumber).toBe('PKT-ORD-1')
    expect(ref.bagNumber).toBe('BAG-000123')
  })

  it('BAG mode keeps a pre-switch order working on its packet, flagged legacy', async () => {
    mocks.packetFindMany.mockResolvedValue([PACKET])
    mocks.bagFindMany.mockResolvedValue([])
    const ref = await transportRefForOrder('lb1', 'o1', 'BAG')
    expect(ref.kind).toBe('PACKET')
    expect(ref.legacy).toBe(true)
  })

  it('falls back to a released bag via assignment history', async () => {
    mocks.bagFindMany.mockResolvedValue([])
    mocks.asgFindMany.mockResolvedValue([{ orderId: 'o1', assignedAt: new Date('2026-08-01'), bag: { bagNumber: 'BAG-000999', qrValue: 'BAG-000999' } }])
    const ref = await transportRefForOrder('lb1', 'o1', 'BAG')
    expect(ref.code).toBe('BAG-000999')
  })
})

// Bags are a shared pool: the SAME order can go out in one bag and come back in
// another, so a history row must show the bag used on THAT leg — never be
// rewritten by a later re-bagging.
describe('history keeps the bag each leg actually used', () => {
  const OUT = { orderId: 'o1', assignedAt: new Date('2026-08-01T09:00:00Z'), bag: { bagNumber: 'BAG-000001', qrValue: 'BAG-000001' } }
  const BACK = { orderId: 'o1', assignedAt: new Date('2026-08-01T15:00:00Z'), bag: { bagNumber: 'BAG-000091', qrValue: 'BAG-000091' } }

  beforeEach(() => {
    mocks.asgFindMany.mockResolvedValue([BACK, OUT]) // newest-first, as queried
    mocks.bagFindMany.mockResolvedValue([{ currentOrderId: 'o1', bagNumber: 'BAG-000091', qrValue: 'BAG-000091' }])
  })

  it('the Store → PC row keeps the bag it went out in', async () => {
    const refs = await transportRefsForOrders('lb1', ['o1'], 'BAG', { at: new Map([['o1', new Date('2026-08-01T10:00:00Z')]]) })
    expect(refs.get('o1')?.code).toBe('BAG-000001')
  })

  it('the PC → Store row shows the bag it came back in', async () => {
    const refs = await transportRefsForOrders('lb1', ['o1'], 'BAG', { at: new Map([['o1', new Date('2026-08-01T16:00:00Z')]]) })
    expect(refs.get('o1')?.code).toBe('BAG-000091')
  })

  it('live screens and scanning still use the bag it is in NOW', async () => {
    expect((await transportRefForOrder('lb1', 'o1', 'BAG')).code).toBe('BAG-000091')
  })

  it('an event older than every assignment falls back to the live bag', async () => {
    const refs = await transportRefsForOrders('lb1', ['o1'], 'BAG', { at: new Map([['o1', new Date('2026-07-01T00:00:00Z')]]) })
    expect(refs.get('o1')?.code).toBe('BAG-000091')
  })
})

describe('scan resolution', () => {
  it('BAG mode resolves a bag QR to its order', async () => {
    mocks.bagFindFirst.mockResolvedValue({ id: 'b1', currentOrderId: 'o1' })
    const hit = await resolveOrderByTransportCode('lb1', 'BAG-000123', 'BAG')
    expect(hit?.orderId).toBe('o1')
    expect(hit?.matchedBy).toBe('BAG')
    // A packet lookup is never the first choice in BAG mode.
    expect(mocks.packetFindFirst).not.toHaveBeenCalledWith(expect.objectContaining({ select: { orderId: true } }))
  })

  it('PACKET mode does not resolve bag QRs', async () => {
    mocks.bagFindFirst.mockResolvedValue({ id: 'b1', currentOrderId: 'o1' })
    mocks.orderFindFirst.mockResolvedValue(null)
    const hit = await resolveOrderByTransportCode('lb1', 'BAG-000123', 'PACKET')
    expect(hit).toBeNull()
    expect(mocks.bagFindFirst).not.toHaveBeenCalled()
  })

  it('the order number always resolves, in any mode', async () => {
    mocks.orderFindFirst
      .mockResolvedValueOnce({ id: 'o1' })
      .mockResolvedValueOnce({ id: 'o1', orderNumber: 'ORD-1', status: 'PACKED' })
    const hit = await resolveOrderByTransportCode('lb1', 'ORD-1', 'BAG')
    expect(hit?.matchedBy).toBe('ORDER')
  })

  it('BAG mode still receives a packet already in transit (legacy safety net)', async () => {
    mocks.bagFindFirst.mockResolvedValue(null)
    mocks.orderFindFirst
      .mockResolvedValueOnce(null) // no order number match
      .mockResolvedValueOnce({ id: 'o1', orderNumber: 'ORD-1', status: 'IN_TRANSIT_TO_PROCESSING' })
    mocks.packetFindFirst.mockResolvedValue({ orderId: 'o1' })
    const hit = await resolveOrderByTransportCode('lb1', 'PKT-ORD-1', 'BAG')
    expect(hit?.matchedBy).toBe('PACKET')
  })

  it('an unknown code resolves to nothing', async () => {
    mocks.orderFindFirst.mockResolvedValue(null)
    expect(await resolveOrderByTransportCode('lb1', 'JUNK', 'BOTH')).toBeNull()
  })
})
