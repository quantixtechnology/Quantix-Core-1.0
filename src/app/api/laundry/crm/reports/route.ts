// GET /api/laundry/crm/reports?businessId=&type=&from=&to=&assignedToId=
// Types: leads | lead-sources | lead-statuses | conversion | pipeline |
//        won | lost | lost-reasons | employees | stage-ageing
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const biz = await requireCrmBusiness(sp.get("businessId"))
    await ensureCrmDefaults(biz.id)
    const bId = biz.id
    const type = sp.get("type") || "leads"

    const dateRange = {
      ...(sp.get("from") ? { gte: new Date(sp.get("from")!) } : {}),
      ...(sp.get("to") ? { lte: new Date(`${sp.get("to")}T23:59:59.999`) } : {}),
    }
    const hasRange = Object.keys(dateRange).length > 0
    const assignedToId = sp.get("assignedToId")

    const leadWhere: Record<string, unknown> = { businessId: bId, archived: false }
    if (hasRange) leadWhere.createdAt = dateRange
    if (assignedToId) leadWhere.assignedToId = assignedToId
    const oppWhere: Record<string, unknown> = { businessId: bId }
    if (hasRange) oppWhere.createdAt = dateRange
    if (assignedToId) oppWhere.assignedToId = assignedToId

    switch (type) {
      case "leads": {
        const rows = await prisma.laundryCrmLead.findMany({
          where: leadWhere as never,
          include: { status: true, source: true, opportunity: { select: { oppCode: true, state: true, value: true } } },
          orderBy: { createdAt: "desc" }, take: 1000,
        })
        return NextResponse.json({ success: true, data: rows })
      }
      case "lead-sources": {
        const [groups, sources] = await Promise.all([
          prisma.laundryCrmLead.groupBy({ by: ["sourceId"], where: leadWhere as never, _count: { _all: true } }),
          prisma.laundryCrmLeadSource.findMany({ where: { businessId: bId } }),
        ])
        const converted = await prisma.laundryCrmLead.groupBy({ by: ["sourceId"], where: { ...leadWhere, converted: true } as never, _count: { _all: true } })
        const cMap = new Map(converted.map((g) => [g.sourceId, g._count._all]))
        const sMap = new Map(sources.map((s) => [s.id, s]))
        return NextResponse.json({
          success: true,
          data: groups.map((g) => ({
            name: g.sourceId ? sMap.get(g.sourceId)?.name || "—" : "No Source",
            color: g.sourceId ? sMap.get(g.sourceId)?.color || "#64748B" : "#94A3B8",
            leads: g._count._all, converted: cMap.get(g.sourceId) || 0,
          })),
        })
      }
      case "lead-statuses": {
        const [groups, statuses] = await Promise.all([
          prisma.laundryCrmLead.groupBy({ by: ["statusId"], where: leadWhere as never, _count: { _all: true } }),
          prisma.laundryCrmLeadStatus.findMany({ where: { businessId: bId } }),
        ])
        const sMap = new Map(statuses.map((s) => [s.id, s]))
        return NextResponse.json({
          success: true,
          data: groups.map((g) => ({
            name: g.statusId ? sMap.get(g.statusId)?.name || "—" : "No Status",
            color: g.statusId ? sMap.get(g.statusId)?.color || "#64748B" : "#94A3B8",
            kind: g.statusId ? sMap.get(g.statusId)?.kind || "OPEN" : "OPEN",
            leads: g._count._all,
          })),
        })
      }
      case "conversion": {
        const [total, converted, won] = await Promise.all([
          prisma.laundryCrmLead.count({ where: leadWhere as never }),
          prisma.laundryCrmLead.count({ where: { ...leadWhere, converted: true } as never }),
          prisma.laundryCrmOpportunity.count({ where: { ...oppWhere, state: "WON" } as never }),
        ])
        return NextResponse.json({
          success: true,
          data: {
            totalLeads: total, convertedLeads: converted, wonOpportunities: won,
            leadToOpportunity: total ? Math.round((converted / total) * 1000) / 10 : 0,
            leadToWon: total ? Math.round((won / total) * 1000) / 10 : 0,
          },
        })
      }
      case "pipeline": {
        const rows = await prisma.laundryCrmOpportunity.findMany({
          where: { ...oppWhere, state: "OPEN" } as never,
          include: { stage: true, lead: { select: { displayName: true, leadCode: true } } },
          orderBy: { expectedCloseDate: "asc" }, take: 1000,
        })
        return NextResponse.json({ success: true, data: rows })
      }
      case "won": case "lost": {
        const rows = await prisma.laundryCrmOpportunity.findMany({
          where: { ...oppWhere, state: type.toUpperCase() } as never,
          include: { stage: true, lostReason: true, lead: { select: { displayName: true, leadCode: true } } },
          orderBy: { updatedAt: "desc" }, take: 1000,
        })
        return NextResponse.json({ success: true, data: rows })
      }
      case "lost-reasons": {
        const [groups, reasons] = await Promise.all([
          prisma.laundryCrmOpportunity.groupBy({ by: ["lostReasonId"], where: { ...oppWhere, state: "LOST" } as never, _count: { _all: true }, _sum: { value: true } }),
          prisma.laundryCrmLostReason.findMany({ where: { businessId: bId } }),
        ])
        const rMap = new Map(reasons.map((r) => [r.id, r.name]))
        return NextResponse.json({
          success: true,
          data: groups.map((g) => ({
            name: g.lostReasonId ? rMap.get(g.lostReasonId) || "—" : "No Reason",
            count: g._count._all, lostValue: g._sum.value || 0,
          })),
        })
      }
      case "employees": {
        const [leads, converted, won] = await Promise.all([
          prisma.laundryCrmLead.groupBy({ by: ["assignedToName"], where: leadWhere as never, _count: { _all: true } }),
          prisma.laundryCrmLead.groupBy({ by: ["assignedToName"], where: { ...leadWhere, converted: true } as never, _count: { _all: true } }),
          prisma.laundryCrmOpportunity.groupBy({ by: ["assignedToName"], where: { ...oppWhere, state: "WON" } as never, _count: { _all: true }, _sum: { wonValue: true } }),
        ])
        const names = new Set([...leads, ...converted, ...won].map((g) => g.assignedToName).filter(Boolean))
        const find = (arr: { assignedToName: string | null; _count?: { _all: number }; _sum?: { wonValue: number | null } }[], n: string) => arr.find((g) => g.assignedToName === n)
        return NextResponse.json({
          success: true,
          data: [...names].map((n) => ({
            name: n,
            leads: find(leads, n!)?._count?._all || 0,
            converted: find(converted, n!)?._count?._all || 0,
            won: find(won, n!)?._count?._all || 0,
            wonValue: find(won, n!)?._sum?.wonValue || 0,
          })),
        })
      }
      case "stage-ageing": {
        // Average time spent per stage from recorded history.
        const history = await prisma.laundryCrmStageHistory.findMany({
          where: { businessId: bId, durationMs: { not: null }, ...(hasRange ? { createdAt: dateRange } : {}) },
          select: { fromStageId: true, fromStageName: true, durationMs: true },
        })
        const agg = new Map<string, { name: string; totalMs: number; n: number }>()
        for (const h of history) {
          if (!h.fromStageId) continue
          const cur = agg.get(h.fromStageId) || { name: h.fromStageName || "—", totalMs: 0, n: 0 }
          cur.totalMs += h.durationMs || 0; cur.n += 1
          agg.set(h.fromStageId, cur)
        }
        return NextResponse.json({
          success: true,
          data: [...agg.values()].map((a) => ({ name: a.name, avgDays: Math.round((a.totalMs / a.n / 86400000) * 10) / 10, transitions: a.n })),
        })
      }
      default:
        return NextResponse.json({ error: "Unknown report type" }, { status: 400 })
    }
  } catch (e) { return crmError(e) }
}
