import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { summariseWorkload } from '@/lib/laundry-workload'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const API = read('src/app/api/laundry/processing/route.ts')
const WS = read('src/components/laundry/views/laundry-workstation.tsx')

type Row = { id: string; processingStatus: string | null; receivedAt: number }

// Production at the time of the bug: 467 waiting, 2 in progress, at WASH.
const stageRows = (): Row[] => [
  ...Array.from({ length: 467 }, (_, i) => ({ id: `w${i}`, processingStatus: 'WAITING', receivedAt: i })),
  { id: 'p1', processingStatus: 'IN_PROGRESS', receivedAt: 900 },
  { id: 'p2', processingStatus: 'IN_PROGRESS', receivedAt: 901 },
]

// The two fetch strategies, as data.
const oneCappedQuery = (rows: Row[], take: number) =>
  [...rows].sort((a, b) => a.receivedAt - b.receivedAt).slice(0, take)

const perStatusQueries = (rows: Row[], take: number) => {
  const by = (pred: (r: Row) => boolean) => rows.filter(pred).sort((a, b) => a.receivedAt - b.receivedAt).slice(0, take)
  return [
    ...by((r) => r.processingStatus === 'IN_PROGRESS' || r.processingStatus === 'PAUSED'),
    ...by((r) => r.processingStatus === 'WAITING'),
    ...by((r) => !['WAITING', 'IN_PROGRESS', 'PAUSED'].includes(r.processingStatus ?? '')),
  ]
}

const buckets = (rows: Row[]) => ({
  waiting: rows.filter((r) => r.processingStatus === 'WAITING').length,
  active: rows.filter((r) => r.processingStatus === 'IN_PROGRESS' || r.processingStatus === 'PAUSED').length,
})

describe('the reported bug: In Progress starved out of a capped payload', () => {
  it('reproduces it — one capped query returns Waiting 100 / In Progress 0', () => {
    const got = buckets(oneCappedQuery(stageRows(), 100))
    expect(got).toEqual({ waiting: 100, active: 0 })  // exactly the screenshot
  })

  it('per-status queries return the in-progress garments', () => {
    const got = buckets(perStatusQueries(stageRows(), 200))
    expect(got.active).toBe(2)
    expect(got.waiting).toBeGreaterThan(0)
  })

  it('a backlog of any size cannot starve In Progress', () => {
    for (const backlog of [0, 99, 100, 467, 5000]) {
      const rows: Row[] = [
        ...Array.from({ length: backlog }, (_, i) => ({ id: `w${i}`, processingStatus: 'WAITING', receivedAt: i })),
        { id: 'p', processingStatus: 'IN_PROGRESS', receivedAt: 1e6 },
      ]
      expect(buckets(perStatusQueries(rows, 200)).active, `backlog ${backlog}`).toBe(1)
    }
  })

  it('scanner and list can never disagree: an IN_PROGRESS garment is always present', () => {
    // The scanner refuses with "already In Progress" on exactly this status; the
    // list filters on the same one, so once the row is in the payload they agree.
    const rows = perStatusQueries(stageRows(), 200)
    expect(rows.some((r) => r.id === 'p1' && r.processingStatus === 'IN_PROGRESS')).toBe(true)
    expect(WS).toContain('i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED"')
    expect(WS).toContain('if (item.processingStatus === "WAITING") action = "START"')
  })
})

describe('counts come from the database, not from the page that was rendered', () => {
  it('the API groups by status over the whole stage, independent of the caps', () => {
    expect(API).toContain('const queueGrouped = await prisma.laundryOrderItem.groupBy({')
    expect(API).toContain('by: ["processingStatus"],')
    expect(API).toContain('queueCounts.active = (queueCounts.IN_PROGRESS || 0) + (queueCounts.PAUSED || 0)')
    expect(API).toContain('queueCounts,')
  })

  it('the single all-status capped query is gone', () => {
    const code = API.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(code).toContain('processingStatus: "WAITING"')
    expect(code).toContain('processingStatus: { in: ACTIVE_STATUSES }')
    // no query fetches the queue without narrowing by status
    expect(code).not.toMatch(/processingStage: stage, \.\.\.codeOr \},\s*include: \{ order[\s\S]{0,80}take: 100/)
  })

  it('both columns display the server counts', () => {
    expect(WS).toContain('const waitingCount = queueCounts?.WAITING ?? waiting.length')
    expect(WS).toContain('const activeCount = queueCounts?.active ?? active.length')
    expect(WS).toContain('Waiting <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">{waitingCount}</Badge>')
    expect(WS).toContain('In Progress <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{activeCount}</Badge>')
  })

  // The tiles and the badges now read the SAME server aggregate — the tiles from
  // `workload`, the badges from `queueCounts`, both computed over the whole
  // stage in SQL. Neither is derived from the rendered page.
  it('the workload tiles and the badges both show server figures', () => {
    expect(WS).toContain('setWorkload(j.workload || null)')
    expect(WS).toContain('summary={workloadView}')
    expect(WS).toContain('const waitingCount = queueCounts?.WAITING ?? waiting.length')
    expect(WS).toContain('const activeCount = queueCounts?.active ?? active.length')
  })

  it('a count is never a client-side increment', () => {
    expect(WS).not.toMatch(/setWaitingCount|setActiveCount|\+\+\s*waiting|waitingCount\s*\+\s*1/)
    expect(WS).toContain('setQueueCounts(j.queueCounts || null)')
  })
})

describe('the three columns stay consistent as a garment moves', () => {
  const g = (id: string, processingStatus: string | null) => ({ id, processingStatus, weightKg: 1 })

  it('waiting → started → in progress → completed', () => {
    // Waiting
    let s = summariseWorkload([g('a', 'WAITING'), g('b', 'WAITING')], [])
    expect([s.pending.garments, s.processing.garments, s.completed.garments]).toEqual([2, 0, 0])
    // Started
    s = summariseWorkload([g('a', 'IN_PROGRESS'), g('b', 'WAITING')], [])
    expect([s.pending.garments, s.processing.garments, s.completed.garments]).toEqual([1, 1, 0])
    // Completed — it leaves the stage queue and appears in the history
    s = summariseWorkload([g('b', 'WAITING')], [{ itemId: 'a', weightKg: 1 }])
    expect([s.pending.garments, s.processing.garments, s.completed.garments]).toEqual([1, 0, 1])
  })

  it('a PAUSED garment is still In Progress, and bulk-selectable ones are IN_PROGRESS', () => {
    const s = summariseWorkload([g('a', 'PAUSED'), g('b', 'IN_PROGRESS')], [])
    expect(s.processing.garments).toBe(2)
    // The bulk action deliberately targets only IN_PROGRESS, unchanged.
    expect(WS).toContain('const inProgress = active.filter((i) => i.processingStatus === "IN_PROGRESS")')
  })

  it('re-scanning an in-progress garment adds nothing — it is refused', () => {
    expect(WS).toContain('is already In Progress')
    expect(WS).toContain('A SCAN only ever STARTS a garment')
  })
})

describe('Washing and Dry Cleaning share the fix; nothing else was redesigned', () => {
  it('both stages are the same component and the same endpoint', () => {
    const router = read('src/components/laundry/laundry-page-router.tsx')
    expect(router).toContain('case "ws-wash": return <LaundryWorkstation stage="WASH" />')
    expect(router).toContain('case "ws-dryclean": return <LaundryWorkstation stage="DRYCLEAN" />')
  })

  it('Sorting keeps receiving items of every status', () => {
    // Sorting renders all items regardless of status, so the third bucket must
    // exist or that screen would empty.
    expect(API).toContain('processingStatus: { notIn: QUEUE_STATUSES }')
    expect(API).toContain('{ processingStatus: null }')
  })

  it('the lifecycle, scan action and bulk action are untouched', () => {
    expect(WS).toContain('body: JSON.stringify({ action, actorName, expectedStage: opts.stage })')
    expect(API).not.toContain('laundryOrderItem.update')
    expect(API).not.toContain('laundryOrder.update')
  })
})
