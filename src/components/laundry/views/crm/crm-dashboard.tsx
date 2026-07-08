"use client"

// CRM Dashboard — sales & lead management only (laundry operations stay on the
// Laundry OS dashboard). Entity colors (statuses/sources/stages) come from the
// tenant's own CRM configuration, and every colored mark is direct-labeled so
// identity never rides on color alone.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, LayoutDashboard, Users, UserPlus, ArrowRightCircle, Target,
  Trophy, XCircle, IndianRupee, Percent, CheckSquare, AlarmClock, CalendarDays,
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { inr, fmtDate, fmtDateTime } from "./crm-shared"

interface Dist { id: string | null; name: string; color: string; count: number; value?: number; stageType?: string }

interface DashboardData {
  leads: { total: number; newThisMonth: number; open: number; converted: number; conversionRate: number; byStatus: Dist[]; bySource: Dist[] }
  opportunities: { open: number; won: number; lost: number; pipelineValue: number; wonRevenue: number; byStage: Dist[] }
  tasks: { today: number; overdue: number; pending: number; upcoming: { id: string; title: string; dueAt: string | null; lead?: { displayName: string } | null; opportunity?: { name: string } | null }[] }
  followUpsToday: number
  recentActivities: { id: string; type: string; subject: string; activityAt: string; lead?: { displayName: string } | null; opportunity?: { name: string } | null }[]
  expectedClosures: { id: string; name: string; value: number; expectedCloseDate: string | null; stage?: { name: string; color: string } | null; lead?: { displayName: string } | null }[]
  employees: { name: string | null; leads: number; won: number; wonValue: number }[]
}

export function CrmDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/crm/dashboard?businessId=${encodeURIComponent(businessId)}`).then((r) => r.json())
      setData(j.success ? j.data : null)
    } catch { setData(null) } finally { setLoading(false) }
  }, [businessId])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading CRM dashboard…</div>
  if (!data) return <p className="py-16 text-center text-sm text-slate-400">Could not load CRM dashboard.</p>

  const { leads, opportunities: opps, tasks } = data
  const openStageDist = opps.byStage.filter((s) => s.stageType === "OPEN" && s.count > 0)
  const maxStage = Math.max(1, ...openStageDist.map((s) => s.count))
  const maxStatus = Math.max(1, ...leads.byStatus.map((s) => s.count))
  const sourceTotal = leads.bySource.reduce((a, s) => a + s.count, 0)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-blue-600" /> CRM Dashboard</h2>
        <p className="text-sm text-muted-foreground">Your sales funnel at a glance — leads, pipeline, revenue and follow-ups.</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi icon={Users} label="Total Leads" value={String(leads.total)} sub={`${leads.open} open`} />
        <Kpi icon={UserPlus} label="New This Month" value={String(leads.newThisMonth)} />
        <Kpi icon={ArrowRightCircle} label="Converted" value={String(leads.converted)} sub={`${leads.conversionRate}% conversion`} tone="green" />
        <Kpi icon={Target} label="Open Opportunities" value={String(opps.open)} sub={`${inr(opps.pipelineValue)} pipeline`} />
        <Kpi icon={IndianRupee} label="Won Revenue" value={inr(opps.wonRevenue)} sub={`${opps.won} won`} tone="green" />
        <Kpi icon={Trophy} label="Won" value={String(opps.won)} tone="green" />
        <Kpi icon={XCircle} label="Lost" value={String(opps.lost)} tone="red" />
        <Kpi icon={Percent} label="Conversion Rate" value={`${leads.conversionRate}%`} />
        <Kpi icon={CheckSquare} label="Tasks Today" value={String(tasks.today)} sub={`${tasks.pending} pending`} />
        <Kpi icon={AlarmClock} label="Overdue Tasks" value={String(tasks.overdue)} tone={tasks.overdue > 0 ? "red" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pipeline by stage — horizontal bars, entity colors, direct labels */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Opportunity Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {openStageDist.length === 0 && <Empty text="No open opportunities yet." />}
            {openStageDist.map((s) => (
              <div key={s.id || s.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
                  </span>
                  <span className="text-slate-500">{s.count} · {inr(s.value || 0)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.count / maxStage) * 100}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Lead status distribution */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Lead Status Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {leads.byStatus.length === 0 && <Empty text="No leads yet." />}
            {leads.byStatus.map((s) => (
              <div key={s.id || s.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
                  </span>
                  <span className="text-slate-500">{s.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.count / maxStatus) * 100}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Lead source distribution — donut + labeled list (identity in text) */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Lead Source Distribution</CardTitle></CardHeader>
          <CardContent>
            {sourceTotal === 0 ? <Empty text="No leads yet." /> : (
              <div className="flex items-center gap-3">
                <div className="h-[140px] w-[140px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={leads.bySource.filter((s) => s.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={62} stroke="#fff" strokeWidth={2}>
                        {leads.bySource.filter((s) => s.count > 0).map((s) => <Cell key={s.id || s.name} fill={s.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [`${v} leads`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {leads.bySource.filter((s) => s.count > 0).sort((a, b) => b.count - a.count).slice(0, 6).map((s) => (
                    <div key={s.id || s.name} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="truncate text-slate-600">{s.name}</span>
                      <span className="ml-auto text-slate-500 font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Expected closures */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-blue-600" /> Expected Closures (14 days)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.expectedClosures.length === 0 && <Empty text="No closures expected in the next 2 weeks." />}
            {data.expectedClosures.map((o) => (
              <div key={o.id} className="rounded-lg border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700 truncate">{o.name}</p>
                  <span className="text-sm font-bold text-blue-700 shrink-0">{inr(o.value)}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {o.lead?.displayName} · {fmtDate(o.expectedCloseDate)}
                  {o.stage && <Badge className="ml-1.5 text-[10px] border-0" style={{ backgroundColor: `${o.stage.color}18`, color: o.stage.color }}>{o.stage.name}</Badge>}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming tasks */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><CheckSquare className="h-4 w-4 text-blue-600" /> Upcoming Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {tasks.upcoming.length === 0 && <Empty text="No upcoming tasks." />}
            {tasks.upcoming.map((t) => (
              <div key={t.id} className="rounded-lg border p-2.5">
                <p className="text-sm font-medium text-slate-700 truncate">{t.title}</p>
                <p className="text-[11px] text-slate-400">
                  {t.dueAt ? fmtDateTime(t.dueAt) : "No due date"}
                  {t.lead && <> · {t.lead.displayName}</>}
                  {t.opportunity && <> · {t.opportunity.name}</>}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent activities + employee performance */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent CRM Activities</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.recentActivities.length === 0 && <Empty text="No activities logged yet." />}
              {data.recentActivities.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px] shrink-0">{a.type}</Badge>
                  <div className="min-w-0">
                    <p className="text-slate-600 truncate">{a.subject}</p>
                    <p className="text-[10px] text-slate-400">{fmtDateTime(a.activityAt)}{a.lead && ` · ${a.lead.displayName}`}{a.opportunity && ` · ${a.opportunity.name}`}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Employee Performance</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {data.employees.length === 0 && <Empty text="Assign leads to employees to see performance." />}
              {data.employees.sort((a, b) => b.wonValue - a.wonValue).slice(0, 5).map((e) => (
                <div key={e.name} className="flex items-center justify-between text-xs rounded-lg border px-2.5 py-2">
                  <span className="font-medium text-slate-700 truncate">{e.name}</span>
                  <span className="text-slate-500 shrink-0">{e.leads} leads · {e.won} won · {inr(e.wonValue)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; tone?: "green" | "red"
}) {
  const toneCls = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-500" : "text-blue-600"
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
          <Icon className={`h-3.5 w-3.5 ${toneCls}`} /> {label}
        </div>
        <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-slate-400 py-3 text-center">{text}</p>
}
