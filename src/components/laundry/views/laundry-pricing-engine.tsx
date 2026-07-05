"use client"

// Masters → Pricing Engine. Enterprise rule management on top of the existing
// (untouched) Billing Resolver. List + wizard + simulator + conflict detection
// + audit history. The resolver remains the single source of truth for pricing.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Loader2, Plus, Search, MoreHorizontal, Pencil, Copy, Archive, ArchiveRestore,
  Trash2, Eye, Power, IndianRupee, Calculator, ArrowUpDown, ChevronLeft, ChevronRight, History, Repeat, WashingMachine, Shirt,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { LaundryChargesRules } from "./pricing/laundry-charges-rules"
import { PricingSimulator } from "./pricing/pricing-simulator"
import { LaundrySubscriptionPlans } from "./pricing/laundry-subscription-plans"
import { LaundryServicesPricing } from "./pricing/laundry-services-pricing"
import { LaundryGarmentsMaster } from "./laundry-garments-master"
import {
  PRICING_TYPES, STATUSES, typeLabel, inr, scopeSummary,
  statusBadgeClass, type Rule, type Ref, type RuleAudit,
} from "./pricing/pricing-shared"

const PAGE_SIZE = 20
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—")

export function LaundryPricingEngine() {
  const { currentBusinessId, user } = useAuthStore()
  const actor = useMemo(() => ({ id: user?.id, name: user?.name }), [user])

  const [rules, setRules] = useState<Rule[]>([])
  const [total, setTotal] = useState(0)
  const [masters, setMasters] = useState<{ services: Ref[]; garments: Ref[]; cats: Ref[]; stores: Ref[] }>({ services: [], garments: [], cats: [], stores: [] })
  const [loading, setLoading] = useState(true)

  // Toolbar / query state
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("ALL")
  const [customerType, setCustomerType] = useState("ALL")
  const [pricingType, setPricingType] = useState("ALL")
  const [sortBy, setSortBy] = useState("priority")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [qInput, setQInput] = useState("")

  // Dialog state
  const [wizard, setWizard] = useState<{ mode: "create" | "edit" | "duplicate"; rule: Rule | null } | null>(null)
  const [viewRule, setViewRule] = useState<Rule | null>(null)
  const [history, setHistory] = useState<RuleAudit[] | null>(null)
  const [deleteRule, setDeleteRule] = useState<Rule | null>(null)

  const loadMasters = useCallback(async () => {
    if (!currentBusinessId) return
    const qs = `businessId=${encodeURIComponent(currentBusinessId)}`
    const [s, g, c, st] = await Promise.all([
      fetch(`/api/laundry/services?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/garments?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/categories?${qs}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/laundry/businesses/${currentBusinessId}/stores`).then((r) => r.json()).catch(() => []),
    ])
    setMasters({
      services: s.success ? s.data : [],
      garments: g.success ? g.data : [],
      cats: c.success ? c.data : [],
      stores: Array.isArray(st) ? st.map((x: { id: string; storeName: string }) => ({ id: x.id, storeName: x.storeName, name: x.storeName })) : [],
    })
  }, [currentBusinessId])

  const loadRules = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        businessId: currentBusinessId, q, status, customerType, pricingType,
        sortBy, sortDir, page: String(page), pageSize: String(PAGE_SIZE),
      })
      const res = await fetch(`/api/laundry/pricing?${params.toString()}`).then((r) => r.json())
      setRules(res.success ? res.data : [])
      setTotal(res.total || 0)
    } catch { setRules([]) } finally { setLoading(false) }
  }, [currentBusinessId, q, status, customerType, pricingType, sortBy, sortDir, page])

  useEffect(() => { loadMasters() }, [loadMasters])
  useEffect(() => { loadRules() }, [loadRules])

  // Debounced search
  useEffect(() => {
    if (qTimer.current) clearTimeout(qTimer.current)
    qTimer.current = setTimeout(() => { setPage(1); setQ(qInput) }, 300)
    return () => { if (qTimer.current) clearTimeout(qTimer.current) }
  }, [qInput])

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortBy(col); setSortDir("desc") }
  }

  const patchStatus = async (rule: Rule, newStatus: string) => {
    const res = await fetch(`/api/laundry/pricing/${rule.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, actorId: actor.id, actorName: actor.name }),
    })
    const json = await res.json()
    if (!res.ok || json.success === false) { toast.error(json.error || "Update failed"); return }
    toast.success(`Rule ${typeLabel(newStatus).toLowerCase()}`)
    loadRules()
  }

  const doDelete = async () => {
    if (!deleteRule) return
    const res = await fetch(`/api/laundry/pricing/${deleteRule.id}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok || json.success === false) { toast.error(json.error || "Delete failed"); setDeleteRule(null); return }
    toast.success("Rule deleted"); setDeleteRule(null); loadRules()
  }

  const openView = async (rule: Rule) => {
    setViewRule(rule); setHistory(null)
    try {
      const json = await fetch(`/api/laundry/pricing/${rule.id}?history=1`).then((r) => r.json())
      if (json.success) setHistory(json.history || [])
    } catch { setHistory([]) }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const SortHead = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead className="whitespace-nowrap">
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(col)}>
        {children}<ArrowUpDown className={`h-3 w-3 ${sortBy === col ? "text-blue-600" : "opacity-40"}`} />
      </button>
    </TableHead>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><IndianRupee className="h-5 w-5 text-blue-600" /> Services &amp; Pricing</h2>
          <p className="text-sm text-muted-foreground">Manage your laundry services, garments, prices and subscription plans.</p>
        </div>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services" className="gap-1.5"><WashingMachine className="h-3.5 w-3.5" /> Services</TabsTrigger>
          <TabsTrigger value="garments" className="gap-1.5"><Shirt className="h-3.5 w-3.5" /> Garments</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5"><Repeat className="h-3.5 w-3.5" /> Subscription Plans</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Charges &amp; Rules</TabsTrigger>
          <TabsTrigger value="simulator" className="gap-1.5"><Calculator className="h-3.5 w-3.5" /> Pricing Simulator</TabsTrigger>
        </TabsList>

        {/* ── Services tab (default) — simple price menu ── */}
        <TabsContent value="services">
          {currentBusinessId && <LaundryServicesPricing businessId={currentBusinessId} />}
        </TabsContent>

        {/* ── Garments master tab ── */}
        <TabsContent value="garments">
          {currentBusinessId && <LaundryGarmentsMaster />}
        </TabsContent>

        {/* ── Charges & Rules tab (surcharges only — NOT base prices) ── */}
        {/* ── Charges & Rules tab ── two config cards only (no wizard) ── */}
        <TabsContent value="rules">
          {currentBusinessId && <LaundryChargesRules businessId={currentBusinessId} />}
        </TabsContent>

        {/* ── Subscription Plans tab ── */}
        <TabsContent value="plans">
          {currentBusinessId && <LaundrySubscriptionPlans businessId={currentBusinessId} />}
        </TabsContent>

        {/* ── Simulator tab ── */}
        <TabsContent value="simulator">
          {currentBusinessId && <PricingSimulator businessId={currentBusinessId} masters={masters} />}
        </TabsContent>
      </Tabs>

    </div>
  )
}

function FilterSelect({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: { value: string; label: string }[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{all}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>
}
