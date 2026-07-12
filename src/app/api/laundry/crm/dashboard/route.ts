// GET /api/laundry/crm/dashboard — sales-only metrics (no laundry operations).
// All queries scoped to the resolved tenant.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCrmBusiness, ensureCrmDefaults } from "@/lib/laundry-crm"
import { crmError } from "@/lib/laundry-crm-settings"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const guard = await requireLaundryPermission(request, sp.get("businessId"), "crm.dashboard.view")
    if (!guard.ok) return guard.res
    const biz = await requireCrmBusiness(sp.get("businessId"))
    await ensureCrmDefaults(biz.id)
    const bId = biz.id

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
    const in14d = new Date(Date.now() + 14 * 86400000)

    const [
      totalLeads, newLeadsThisMonth, convertedLeads, statuses, leadsByStatus, leadsBySource, sources,
      openOpps, wonOpps, lostOpps, pipelineAgg, wonAgg, stages, oppsByStage,
      todaysTasks, overdueTasks, upcomingTasks, pendingTasks,
      recentActivities, expectedClosures, todaysFollowUps, employeeLeads, employeeWon,
    ] = await Promise.all([
      prisma.laundryCrmLead.count({ where: { businessId: bId, archived: false } }),
      prisma.laundryCrmLead.count({ where: { businessId: bId, archived: false, createdAt: { gte: startOfMonth } } }),
      prisma.laundryCrmLead.count({ where: { businessId: bId, archived: false, converted: true } }),
      prisma.laundryCrmLeadStatus.findMany({ where: { businessId: bId } }),
      prisma.laundryCrmLead.groupBy({ by: ["statusId"], where: { businessId: bId, archived: false }, _count: { _all: true } }),
      prisma.laundryCrmLead.groupBy({ by: ["sourceId"], where: { businessId: bId, archived: false }, _count: { _all: true } }),
      prisma.laundryCrmLeadSource.findMany({ where: { businessId: bId } }),
      prisma.laundryCrmOpportunity.count({ where: { businessId: bId, state: "OPEN" } }),
      prisma.laundryCrmOpportunity.count({ where: { businessId: bId, state: "WON" } }),
      prisma.laundryCrmOpportunity.count({ where: { businessId: bId, state: "LOST" } }),
      prisma.laundryCrmOpportunity.aggregate({ where: { businessId: bId, state: "OPEN" }, _sum: { value: true } }),
      prisma.laundryCrmOpportunity.aggregate({ where: { businessId: bId, state: "WON" }, _sum: { wonValue: true, value: true } }),
      prisma.laundryCrmSalesStage.findMany({ where: { businessId: bId } }),
      prisma.laundryCrmOpportunity.groupBy({ by: ["stageId"], where: { businessId: bId }, _count: { _all: true }, _sum: { value: true } }),
      prisma.laundryCrmTask.count({ where: { businessId: bId, status: "OPEN", dueAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.laundryCrmTask.count({ where: { businessId: bId, status: "OPEN", dueAt: { lt: startOfDay } } }),
      prisma.laundryCrmTask.findMany({
        where: { businessId: bId, status: "OPEN", dueAt: { gte: startOfDay } },
        include: { lead: { select: { displayName: true } }, opportunity: { select: { name: true } } },
        orderBy: { dueAt: "asc" }, take: 8,
      }),
      prisma.laundryCrmTask.count({ where: { businessId: bId, status: "OPEN" } }),
      prisma.laundryCrmActivity.findMany({
        where: { businessId: bId },
        include: { lead: { select: { displayName: true } }, opportunity: { select: { name: true } } },
        orderBy: { activityAt: "desc" }, take: 8,
      }),
      prisma.laundryCrmOpportunity.findMany({
        where: { businessId: bId, state: "OPEN", expectedCloseDate: { lte: in14d, gte: startOfDay } },
        include: { stage: true, lead: { select: { displayName: true } } },
        orderBy: { expectedCloseDate: "asc" }, take: 8,
      }),
      prisma.laundryCrmActivity.count({ where: { businessId: bId, type: { contains: "Follow" }, activityAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.laundryCrmLead.groupBy({ by: ["assignedToName"], where: { businessId: bId, archived: false, assignedToName: { not: null } }, _count: { _all: true } }),
      prisma.laundryCrmOpportunity.groupBy({ by: ["assignedToName"], where: { businessId: bId, state: "WON", assignedToName: { not: null } }, _sum: { wonValue: true }, _count: { _all: true } }),
    ])

    const statusMap = new Map(statuses.map((s) => [s.id, s]))
    const sourceMap = new Map(sources.map((s) => [s.id, s]))
    const stageMap = new Map(stages.map((s) => [s.id, s]))
    const openStatusKinds = new Set(["OPEN"])
    const openLeads = leadsByStatus.reduce((acc, g) => {
      const st = g.statusId ? statusMap.get(g.statusId) : null
      return acc + (st && openStatusKinds.has(st.kind) ? g._count._all : 0)
    }, 0)

    return NextResponse.json({
      success: true,
      data: {
        leads: {
          total: totalLeads, newThisMonth: newLeadsThisMonth, open: openLeads, converted: convertedLeads,
          conversionRate: totalLeads ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0,
          byStatus: leadsByStatus.map((g) => ({
            id: g.statusId, name: g.statusId ? statusMap.get(g.statusId)?.name || "—" : "No Status",
            color: g.statusId ? statusMap.get(g.statusId)?.color || "#64748B" : "#94A3B8", count: g._count._all,
          })),
          bySource: leadsBySource.map((g) => ({
            id: g.sourceId, name: g.sourceId ? sourceMap.get(g.sourceId)?.name || "—" : "No Source",
            color: g.sourceId ? sourceMap.get(g.sourceId)?.color || "#64748B" : "#94A3B8", count: g._count._all,
          })),
        },
        opportunities: {
          open: openOpps, won: wonOpps, lost: lostOpps,
          pipelineValue: pipelineAgg._sum.value || 0,
          wonRevenue: (wonAgg._sum.wonValue ?? wonAgg._sum.value) || 0,
          byStage: oppsByStage.map((g) => ({
            id: g.stageId, name: g.stageId ? stageMap.get(g.stageId)?.name || "—" : "No Stage",
            color: g.stageId ? stageMap.get(g.stageId)?.color || "#64748B" : "#94A3B8",
            stageType: g.stageId ? stageMap.get(g.stageId)?.stageType || "OPEN" : "OPEN",
            count: g._count._all, value: g._sum.value || 0,
          })),
        },
        tasks: { today: todaysTasks, overdue: overdueTasks, pending: pendingTasks, upcoming: upcomingTasks },
        followUpsToday: todaysFollowUps,
        recentActivities, expectedClosures,
        employees: employeeLeads.map((e) => {
          const won = employeeWon.find((w) => w.assignedToName === e.assignedToName)
          return { name: e.assignedToName, leads: e._count._all, won: won?._count._all || 0, wonValue: won?._sum.wonValue || 0 }
        }),
      },
    })
  } catch (e) { return crmError(e) }
}
