'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Rocket, Clock, CheckCircle2, XCircle, Server, Database, Wifi, HardDrive,
  RefreshCw, Eye, Wrench, Hash, SkipForward, Loader2,
} from 'lucide-react'
import { getAuthHeaders } from '@/lib/admin-fetch'

const stats = [
  { label: 'Apps Building', value: '2', icon: Rocket, color: 'text-amber-600 bg-amber-50' },
  { label: 'Pending Publish', value: '3', icon: Clock, color: 'text-orange-600 bg-orange-50' },
  { label: 'Active Deployments', value: '8', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Failed Builds', value: '1', icon: XCircle, color: 'text-red-600 bg-red-50' },
]

const deploymentQueue = [
  { id: 'DP-001', app: 'FreshMart Admin', env: 'production', status: 'deploying', progress: 72, started: '2 min ago' },
  { id: 'DP-002', app: 'CleanHome Web', env: 'staging', status: 'queued', progress: 0, started: '—' },
  { id: 'DP-003', app: 'SpiceGarden Mobile', env: 'production', status: 'building', progress: 45, started: '5 min ago' },
  { id: 'DP-004', app: 'TechHub Portal', env: 'preview', status: 'completed', progress: 100, started: '12 min ago' },
]

const systemHealth = [
  { name: 'API Server', status: 'healthy', latency: '45ms', icon: Server },
  { name: 'Database', status: 'healthy', latency: '12ms', icon: Database },
  { name: 'WebSocket', status: 'degraded', latency: '89ms', icon: Wifi },
  { name: 'Storage', status: 'healthy', latency: '28ms', icon: HardDrive },
]

const statusColor: Record<string, string> = {
  deploying: 'bg-blue-100 text-blue-700',
  queued: 'bg-gray-100 text-gray-700',
  building: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

const healthColor: Record<string, string> = {
  healthy: 'text-emerald-600',
  degraded: 'text-amber-600',
  down: 'text-red-600',
}

// ---- Data Repair section ----

type RunStatus = 'idle' | 'running' | 'done' | 'error'

interface StoreCodeEntry {
  businessCode: string
  storeName: string
  storeId: string
  isMainStore: boolean
  storeSequence: number
  expectedStoreCode: string
  actualStoreCode: string | null
  status: 'OK' | 'INVALID'
}

interface VerifyState {
  status: RunStatus
  summary?: { total: number; ok: number; invalid: number; healthy: boolean }
  data?: StoreCodeEntry[]
  error?: string
}

interface RepairState {
  status: RunStatus
  storesUpdated?: number
  error?: string
}

function DataRepairSection() {
  const [verifyState, setVerifyState] = useState<VerifyState>({ status: 'idle' })
  const [repairState, setRepairState] = useState<RepairState>({ status: 'idle' })

  const runRepair = useCallback(async (silent = false) => {
    setRepairState({ status: 'running' })
    try {
      const res = await fetch(
        '/api/admin/migrate/backfill-store-codes?force=true',
        { method: 'POST', headers: getAuthHeaders() }
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Repair failed')
      setRepairState({ status: 'done', storesUpdated: json.data.storesUpdated })
    } catch (err) {
      if (!silent) setRepairState({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
      else setRepairState({ status: 'idle' })
    }
  }, [])

  const runVerify = useCallback(async (autoRepair = false) => {
    setVerifyState({ status: 'running' })
    try {
      const res = await fetch('/api/debug/store-codes', { headers: getAuthHeaders() })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Verification failed')
      setVerifyState({ status: 'done', summary: json.summary, data: json.data })
      // Auto-repair silently if any invalid codes detected
      if (autoRepair && json.summary?.invalid > 0) {
        await runRepair(true)
        // Re-verify to show final state
        const res2 = await fetch('/api/debug/store-codes', { headers: getAuthHeaders() })
        const json2 = await res2.json()
        if (json2.success) setVerifyState({ status: 'done', summary: json2.summary, data: json2.data })
      }
    } catch (err) {
      setVerifyState({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }, [runRepair])

  // Auto-verify on mount — auto-repairs silently if INVALID codes detected
  useEffect(() => { runVerify(true) }, [runVerify])

  const v = verifyState
  const r = repairState
  const hasProblems = v.summary && v.summary.invalid > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Data Repair</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Verify and repair store code assignments. Startup self-heal runs automatically — use these buttons to inspect or force-repair.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Store Codes */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Hash className="size-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Store Codes</span>
                <Badge variant="outline" className="font-mono text-[10px]">BUS-YYYYMM-NNNN-001</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Globally-unique store identifiers. Primary store always gets -001.
                Startup self-heal corrects any invalid codes automatically.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                disabled={v.status === 'running' || r.status === 'running'}
                onClick={() => runVerify(false)}
              >
                {v.status === 'running' ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
                Verify Store Codes
              </Button>
              <Button
                size="sm"
                variant={hasProblems ? 'default' : 'ghost'}
                className={`h-8 text-xs gap-1.5 ${hasProblems ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-muted-foreground'}`}
                disabled={v.status === 'running' || r.status === 'running'}
                onClick={async () => { await runRepair(false); await runVerify(false) }}
              >
                {r.status === 'running' ? <Loader2 className="size-3 animate-spin" /> : <SkipForward className="size-3" />}
                Repair Store Codes
              </Button>
            </div>
          </div>

          {/* Repair result banner */}
          {r.status === 'done' && (
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-700">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Repair complete — {r.storesUpdated} store(s) updated.
            </div>
          )}
          {r.status === 'error' && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
              <XCircle className="size-3.5 shrink-0" />
              {r.error}
            </div>
          )}

          {/* Verification results */}
          {v.status === 'done' && v.summary && v.data && (
            <div className="space-y-2">
              {/* Summary row */}
              <div className={`flex items-center gap-3 rounded-md p-2 text-xs border ${v.summary.healthy ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                {v.summary.healthy
                  ? <><CheckCircle2 className="size-3.5 shrink-0" /> All {v.summary.total} store(s) have valid codes.</>
                  : <><XCircle className="size-3.5 shrink-0" /> {v.summary.invalid} of {v.summary.total} store(s) have invalid codes. Click &quot;Repair Store Codes&quot; to fix.</>
                }
              </div>

              {/* Per-store table */}
              <div className="rounded border overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Business</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Store</th>
                      <th className="text-center px-2 py-1.5 font-medium text-muted-foreground">Seq</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Actual Code</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Expected Code</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {v.data.map((row, i) => (
                      <tr key={i} className={row.status === 'INVALID' ? 'bg-red-50/50' : ''}>
                        <td className="px-2 py-1.5 font-mono text-muted-foreground">{row.businessCode}</td>
                        <td className="px-2 py-1.5">
                          {row.storeName}
                          {row.isMainStore && <span className="ml-1 text-[10px] text-muted-foreground">(main)</span>}
                        </td>
                        <td className="px-2 py-1.5 text-center text-muted-foreground">{row.storeSequence}</td>
                        <td className={`px-2 py-1.5 font-mono ${row.status === 'INVALID' ? 'text-red-600' : 'text-emerald-700'}`}>
                          {row.actualStoreCode ?? <span className="italic text-red-500">NULL</span>}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-muted-foreground">{row.expectedStoreCode}</td>
                        <td className="px-2 py-1.5">
                          {row.status === 'OK'
                            ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3" />OK</span>
                            : <span className="text-red-600 flex items-center gap-1"><XCircle className="size-3" />INVALID</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {v.status === 'error' && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
              <XCircle className="size-3.5 shrink-0" />
              {v.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function OpsDashboardView() {
  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="size-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Live Deployment Queue</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7"><RefreshCw className="size-3 mr-1" />Refresh</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {deploymentQueue.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{d.app}</span>
                    <Badge variant="outline" className="text-[10px]">{d.env}</Badge>
                    <Badge className={`text-[10px] ${statusColor[d.status]}`}>{d.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${d.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{d.progress}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">{d.id}</p>
                  <p className="text-[10px] text-muted-foreground">{d.started}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="size-3" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {systemHealth.map(h => (
              <div key={h.name} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <h.icon className={`size-4 ${healthColor[h.status]}`} />
                  <span className="text-sm font-medium">{h.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-[10px] ${healthColor[h.status]}`}>{h.status}</Badge>
                  <span className="text-xs text-muted-foreground">{h.latency}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <DataRepairSection />
    </div>
  )
}
