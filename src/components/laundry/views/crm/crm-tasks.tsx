"use client"

// CRM Tasks — Today / Overdue / Upcoming / All, complete inline.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, CheckSquare, CheckCircle2, Circle, Plus } from "lucide-react"
import { toast } from "sonner"
import { type CrmTask, useCrmActor, fmtDateTime } from "./crm-shared"
import { NewTaskDialog } from "./crm-activity-task-dialogs"

const PRIORITY_CLS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-500",
  MEDIUM: "bg-blue-50 text-blue-600",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-600",
}

export function CrmTasks({ businessId }: { businessId: string }) {
  const actor = useCrmActor()
  const [rows, setRows] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("today")
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId, pageSize: "100" })
      if (tab === "today" || tab === "overdue" || tab === "upcoming") params.set("due", tab)
      if (tab !== "all") params.set("status", "OPEN")
      const j = await fetch(`/api/laundry/crm/tasks?${params}`).then((r) => r.json())
      setRows(j.success ? j.data : [])
    } catch { setRows([]) } finally { setLoading(false) }
  }, [businessId, tab])
  useEffect(() => { load() }, [load])

  const toggle = async (t: CrmTask) => {
    const res = await fetch(`/api/laundry/crm/tasks/${t.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, status: t.status === "COMPLETED" ? "OPEN" : "COMPLETED", ...actor }),
    })
    const j = await res.json()
    if (!res.ok || !j.success) return toast.error(j.error || "Update failed")
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><CheckSquare className="h-5 w-5 text-blue-600" /> Tasks</h2>
          <p className="text-sm text-muted-foreground">Follow-ups and to-dos across your CRM.</p>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4" /> New Task</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-3">
          {loading ? (
            <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading tasks…</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <CheckSquare className="h-8 w-8 mx-auto text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">Nothing here</p>
              <p className="text-xs text-slate-400">No {tab === "all" ? "" : `${tab} `}tasks right now.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((t) => (
                <div key={t.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <button onClick={() => toggle(t)} className="mt-0.5 shrink-0">
                    {t.status === "COMPLETED" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-slate-300 hover:text-blue-500" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${t.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-700"}`}>{t.title}</p>
                      <Badge className={`text-[10px] border-0 ${PRIORITY_CLS[t.priority] || ""}`}>{t.priority}</Badge>
                      {t.dueAt && new Date(t.dueAt) < new Date() && t.status === "OPEN" && <Badge className="bg-red-100 text-red-600 text-[10px] border-0">Overdue</Badge>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t.taskCode}
                      {t.dueAt && <> · Due {fmtDateTime(t.dueAt)}</>}
                      {t.assignedToName && <> · {t.assignedToName}</>}
                      {t.lead && <> · Lead: {t.lead.displayName}</>}
                      {t.opportunity && <> · Opp: {t.opportunity.name}</>}
                    </p>
                    {t.description && <p className="text-xs text-slate-500 mt-1">{t.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {adding && (
        <NewTaskDialog businessId={businessId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}
    </div>
  )
}
