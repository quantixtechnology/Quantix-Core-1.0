"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { PageHeader } from "../shared/page-header"
import { StatusBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { businessTypeConfig, leadStageColors } from "@/components/dashboard/data"
import type { LeadStage, BusinessType } from "@/components/dashboard/data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users, Plus, Search, ArrowRight, Phone, Calendar,
  StickyNote, X, BarChart3, Maximize2, Trophy,
  Pencil, UserCheck, CheckSquare, UserPlus,
  RefreshCw, AlertTriangle, MessageCircle,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { LeadContactCounters } from "./lead-contact-counters"
import { LeadActivityTimeline } from "./lead-activity-timeline"
import { SalesCrmReports } from "./sales-crm-reports"
import { LeadDetailEnhanced } from "./lead-detail-enhanced"
import { SalesRepPerformance } from "./sales-rep-performance"
import { toast } from "sonner"
import { authFetch, getAuthHeaders } from "@/lib/admin-fetch"

// ---- API data types ----
interface LeadApiData {
  id: string; businessName: string; contactName: string; contactEmail: string
  contactPhone: string; city: string | null; businessType: string; source: string; stage: string
  estimatedValue: number | null; notes: string | null; followUpDate: string | null
  lastContactedAt: string | null; tags: string; createdAt: string; updatedAt: string
  salesRep: { id: string; name: string; email: string } | null
  // Conversion tracking
  demoTenantId: string | null; demoSharedAt: string | null
  negotiatedMonthlyPrice: number | null; negotiatedYearlyPrice: number | null
  paymentVerifiedAt: string | null; convertedBusinessId: string | null; convertedAt: string | null
  lostReason: string | null; selectedBillingCycle: string | null
}

interface SalesTeamMember {
  id: string; name: string; email: string; phone: string; region: string | null
  isActive?: boolean
}

interface MtdRepRow {
  repId: string; repName: string;
  totalLeads: number; notCalled: number; closed: number; followUp: number;
  interested: number; notInterested: number; wrongNumber: number; rnr: number;
  webCallPlanned: number; webCallDone: number; hotLead: number; totalAttempted: number;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const allStages: LeadStage[] = ["LEAD", "FOLLOW_UP", "INTERESTED", "HOT_LEAD", "DEMO_PLANNED", "DEMO_DONE", "NEGOTIATION", "PAYMENT_PENDING", "PAYMENT_RECEIVED", "CLOSED_WON"]
const terminalStages: LeadStage[] = ["NOT_INTERESTED", "WRONG_NUMBER", "RNR", "LOST", "DUPLICATE"]

const stageProgressMap: Record<LeadStage, number> = {
  LEAD: 0, FOLLOW_UP: 1, INTERESTED: 2, HOT_LEAD: 3, DEMO_PLANNED: 4, DEMO_DONE: 5,
  NEGOTIATION: 6, PAYMENT_PENDING: 7, PAYMENT_RECEIVED: 8, CLOSED_WON: 9,
  NOT_INTERESTED: -1, WRONG_NUMBER: -1, RNR: -1, LOST: -1, DUPLICATE: -1,
}

const stageLabels: Record<string, string> = {
  LEAD: "Lead", FOLLOW_UP: "Follow Up", INTERESTED: "Interested", HOT_LEAD: "Hot Lead",
  NOT_INTERESTED: "Not Interested", WRONG_NUMBER: "Wrong Number", RNR: "RNR",
  DEMO_PLANNED: "Demo Planned", DEMO_DONE: "Demo Done",
  NEGOTIATION: "Negotiation", PAYMENT_PENDING: "Payment Pending",
  PAYMENT_RECEIVED: "Payment Received", CLOSED_WON: "Closed Won",
  LOST: "Lost", DUPLICATE: "Duplicate",
}

const sourceLabels: Record<string, string> = {
  META_ADS: "Meta Ads", GOOGLE_ADS: "Google Ads", DIRECT_REFERRAL: "Referral",
  WHATSAPP_INQUIRY: "WhatsApp", COLD_OUTREACH: "Cold Outreach",
  WEBSITE_INQUIRY: "Website", PHONE_CALL: "Phone Call", OTHER: "Other",
}

const PAGE_SIZE = 50

function buildWaUrl(phone: string): string | null {
  const digits = phone.replace(/[\s\-().+]/g, "")
  if (!digits) return null
  const normalized = digits.startsWith("0") ? "91" + digits.slice(1) : digits.length === 10 ? "91" + digits : digits
  return `https://wa.me/${normalized}`
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.535 5.845L.057 23.487a.5.5 0 0 0 .609.61l5.739-1.485A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.92 0-3.72-.51-5.27-1.4l-.378-.22-3.922 1.016 1.04-3.815-.245-.393A9.954 9.954 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  )
}

export function LeadsView() {
  const { setCrmLeadTab } = useAdminStore()
  const { permissions } = useAuthStore()
  const canEdit = permissions.includes("leads:edit" as never)
  const [leads, setLeads] = useState<LeadApiData[]>([])
  const [salesTeam, setSalesTeam] = useState<SalesTeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Local search state with 350ms debounce
  const [localSearch, setLocalSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushSearch = (value: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    setDebouncedSearch(value)
    setPage(1)
  }
  useEffect(() => {
    searchDebounceRef.current = setTimeout(() => { setDebouncedSearch(localSearch); setPage(1) }, 350)
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current) }
  }, [localSearch])

  // Server-side pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [stageFilter, setStageFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [repFilter, setRepFilter] = useState<string>("all")
  const [selectedLead, setSelectedLead] = useState<LeadApiData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [stageEditOpen, setStageEditOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [crmReportsOpen, setCrmReportsOpen] = useState(false)
  const [enhancedDetailOpen, setEnhancedDetailOpen] = useState(false)
  const [crmTab, setCrmTab] = useState<"reports" | "performance">("reports")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssignRep, setBulkAssignRep] = useState<string>("")
  const [newStage, setNewStage] = useState<string>("")
  const [stageEditReason, setStageEditReason] = useState("")
  const [reassignRep, setReassignRep] = useState<string>("")
  const [advancing, setAdvancing] = useState(false)
  const [updating, setUpdating] = useState(false)

  // MTD report state
  const _now = new Date()
  const [mtdMonth, setMtdMonth] = useState(_now.getMonth() + 1)
  const [mtdYear, setMtdYear] = useState(_now.getFullYear())
  const [mtdData, setMtdData] = useState<{ reps: MtdRepRow[]; totals: Omit<MtdRepRow, 'repId' | 'repName'> } | null>(null)
  const [mtdLoading, setMtdLoading] = useState(false)

  // Create lead form state
  const [createForm, setCreateForm] = useState({
    businessName: "", contactName: "", contactEmail: "", contactPhone: "",
    city: "", businessType: "", source: "WEBSITE_INQUIRY", estimatedValue: "",
    salesRepId: "", notes: "", followUpDate: "",
  })
  const [creating, setCreating] = useState(false)

  const fetchLeads = useCallback(async (pageNum = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE) })
      if (stageFilter  !== "all") params.set("stage",        stageFilter)
      if (sourceFilter !== "all") params.set("source",       sourceFilter)
      if (typeFilter   !== "all") params.set("businessType", typeFilter)
      if (repFilter === "unassigned") params.set("salesRepId", "null")
      else if (repFilter !== "all") params.set("salesRepId", repFilter)
      if (debouncedSearch) params.set("search", debouncedSearch)

      const res = await authFetch(`/api/admin/leads?${params}`)
      if (!res.ok) throw new Error("Failed to fetch leads")
      const json = await res.json()
      if (json.success) {
        setLeads(json.data)
        setTotalPages(json.pagination?.totalPages ?? 1)
        setTotalCount(json.pagination?.total ?? json.data.length)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads")
    } finally {
      setLoading(false)
    }
  }, [stageFilter, sourceFilter, typeFilter, repFilter, debouncedSearch])

  const fetchSalesTeam = useCallback(async () => {
    try {
      const res = await authFetch("/api/admin/sales-team?active=true")
      if (res.ok) {
        const json = await res.json()
        if (json.success) setSalesTeam(json.data)
      }
    } catch {
      // Silently fail — sales team is not critical for initial load
    }
  }, [])

  // Re-fetch when filters change (reset to page 1)
  useEffect(() => {
    setPage(1)
    fetchLeads(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageFilter, sourceFilter, typeFilter, repFilter, debouncedSearch])

  // Re-fetch when page changes
  useEffect(() => {
    fetchLeads(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    fetchSalesTeam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchMtdReport = useCallback(async (month: number, year: number) => {
    setMtdLoading(true)
    try {
      const res = await authFetch(`/api/admin/leads/mtd-report?month=${month}&year=${year}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success) setMtdData(json.data)
      }
    } catch {
      // silently fail
    } finally {
      setMtdLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMtdReport(mtdMonth, mtdYear)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mtdMonth, mtdYear])

  const getNextStage = (currentStage: LeadStage): LeadStage | null => {
    const idx = allStages.indexOf(currentStage)
    if (idx === -1 || idx === allStages.length - 1) return null
    return allStages[idx + 1]
  }

  const handleAdvanceStage = async () => {
    if (!selectedLead) return
    const nextStage = getNextStage(selectedLead.stage as LeadStage)
    if (!nextStage) return
    setAdvancing(true)
    try {
      const res = await fetch(`/api/core/leads/${selectedLead.id}/advance-stage`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ stage: nextStage }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Lead advanced from ${selectedLead.stage} to ${nextStage}`)
        setAdvanceOpen(false)
        fetchLeads(page)
      } else {
        toast.error(json.error || "Failed to advance lead")
      }
    } catch {
      toast.error("Failed to advance lead stage")
    } finally {
      setAdvancing(false)
    }
  }

  const handleStageEdit = async () => {
    if (!selectedLead || !newStage || newStage === selectedLead.stage) {
      setStageEditOpen(false)
      return
    }
    setUpdating(true)
    try {
      // Use advance-stage API if moving forward one step, otherwise use PATCH
      const nextStage = getNextStage(selectedLead.stage as LeadStage)
      let res: Response

      const isTerminal = terminalStages.includes(newStage as LeadStage)
      const lostReason = stageEditReason || undefined

      if (nextStage === newStage || isTerminal) {
        // Forward one step or terminal — use advance-stage
        res = await fetch(`/api/core/leads/${selectedLead.id}/advance-stage`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ stage: newStage, lostReason }),
        })
      } else {
        // Direct stage change — use PATCH
        res = await fetch(`/api/core/leads/${selectedLead.id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ stage: newStage, lostReason }),
        })
      }

      const json = await res.json()
      if (json.success || json.data) {
        toast.success(`Stage updated to ${stageLabels[newStage] || newStage}`)
        setStageEditOpen(false)
        setStageEditReason("")
        fetchLeads(page)
      } else {
        toast.error(json.error || "Failed to update stage")
      }
    } catch {
      toast.error("Failed to update lead stage")
    } finally {
      setUpdating(false)
    }
  }

  const handleReassign = async () => {
    if (!selectedLead || !reassignRep) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/core/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ salesRepId: reassignRep }),
      })
      const json = await res.json()
      if (json.success || json.data) {
        toast.success("Sales rep reassigned")
        setReassignOpen(false)
        setReassignRep("")
        fetchLeads(page)
      } else {
        toast.error(json.error || "Failed to reassign sales rep")
      }
    } catch {
      toast.error("Failed to reassign sales rep")
    } finally {
      setUpdating(false)
    }
  }

  const handleBulkAssign = async () => {
    if (!bulkAssignRep || selectedIds.size === 0) return
    setUpdating(true)
    try {
      // Update each selected lead
      const results = await Promise.allSettled(
        Array.from(selectedIds).map(leadId =>
          fetch(`/api/core/leads/${leadId}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ salesRepId: bulkAssignRep }),
          })
        )
      )
      const succeeded = results.filter(r => r.status === "fulfilled").length
      toast.success(`Assigned ${succeeded} of ${selectedIds.size} leads`)
      setBulkAssignOpen(false)
      setBulkAssignRep("")
      setSelectedIds(new Set())
      fetchLeads(page)
    } catch {
      toast.error("Failed to bulk assign leads")
    } finally {
      setUpdating(false)
    }
  }

  const handleCreateLead = async () => {
    if (!createForm.businessName || !createForm.contactName || !createForm.contactEmail || !createForm.contactPhone || !createForm.businessType) {
      toast.error("Please fill in required fields: Business Name, Contact Name, Email, Phone, Business Type")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/core/leads", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          businessName: createForm.businessName,
          contactName: createForm.contactName,
          contactEmail: createForm.contactEmail,
          contactPhone: createForm.contactPhone,
          city: createForm.city || undefined,
          businessType: createForm.businessType,
          source: createForm.source || "WEBSITE_INQUIRY",
          salesRepId: createForm.salesRepId || undefined,
          estimatedValue: createForm.estimatedValue ? Number(createForm.estimatedValue) : undefined,
          notes: createForm.notes || undefined,
          followUpDate: createForm.followUpDate || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Lead created successfully")
        setCreateOpen(false)
        setCreateForm({
          businessName: "", contactName: "", contactEmail: "", contactPhone: "",
          city: "", businessType: "", source: "WEBSITE_INQUIRY", estimatedValue: "",
          salesRepId: "", notes: "", followUpDate: "",
        })
        fetchLeads(page)
      } else {
        toast.error(json.error || "Failed to create lead")
      }
    } catch {
      toast.error("Failed to create lead")
    } finally {
      setCreating(false)
    }
  }

  const handleViewFullDetail = (lead: LeadApiData) => {
    setDetailOpen(false)
    setSelectedLead(lead)
    setCrmLeadTab("overview")
    setEnhancedDetailOpen(true)
  }

  const handleOpenStageEdit = (lead: LeadApiData) => {
    setSelectedLead(lead)
    setNewStage(lead.stage)
    setStageEditReason("")
    setStageEditOpen(true)
  }

  const handleOpenReassign = (lead: LeadApiData) => {
    setSelectedLead(lead)
    setReassignRep("")
    setReassignOpen(true)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) { setSelectedIds(new Set()) }
    else { setSelectedIds(new Set(leads.map(l => l.id))) }
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Leads Management" description="Track and manage sales pipeline" icon={Users} />
        <Card><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Leads Management" description="Track and manage sales pipeline" icon={Users} />
        <Card><CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchLeads(page)} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads Management"
        description="Track and manage sales pipeline"
        icon={Users}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => { setCrmReportsOpen(true); setCrmTab("reports") }}><BarChart3 className="h-4 w-4" />CRM Reports</Button>
            <Button variant="outline" className="gap-2" onClick={() => { setCrmReportsOpen(true); setCrmTab("performance") }}><Trophy className="h-4 w-4" />Rep Performance</Button>
            {canEdit && <Button className="gap-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />Add Lead</Button>}
          </div>
        }
      />

      {/* MTD Report */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">MTD Report</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={String(mtdMonth)} onValueChange={(v) => setMtdMonth(Number(v))}>
                <SelectTrigger className="w-[80px] h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(mtdYear)} onValueChange={(v) => setMtdYear(Number(v))}>
                <SelectTrigger className="w-[76px] h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {mtdLoading ? (
            <div className="p-6"><Skeleton className="h-[160px] w-full" /></div>
          ) : !mtdData || mtdData.reps.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No data for this period</div>
          ) : (
            <table className="w-full text-xs border-collapse min-w-[960px]">
              <thead>
                <tr style={{ background: "#0f1729" }}>
                  <th className="px-3 py-2.5 text-left text-white font-semibold border-r border-white/10 min-w-[130px]">MTD</th>
                  <th className="px-3 py-2.5 text-center text-white font-semibold border-r border-white/10 whitespace-nowrap">Total Leads</th>
                  <th className="px-3 py-2.5 text-center text-slate-300 font-semibold border-r border-white/10 whitespace-nowrap">Not Called</th>
                  <th className="px-3 py-2.5 text-center font-semibold border-r border-white/10 whitespace-nowrap" style={{ color: "#4ade80" }}>Closed</th>
                  <th className="px-3 py-2.5 text-center text-blue-300 font-semibold border-r border-white/10 whitespace-nowrap">Follow Up</th>
                  <th className="px-3 py-2.5 text-center text-cyan-300 font-semibold border-r border-white/10 whitespace-nowrap">Interested</th>
                  <th className="px-3 py-2.5 text-center text-red-300 font-semibold border-r border-white/10 whitespace-nowrap">Not Interested</th>
                  <th className="px-3 py-2.5 text-center text-yellow-300 font-semibold border-r border-white/10 whitespace-nowrap">Wrong Number</th>
                  <th className="px-3 py-2.5 text-center text-purple-300 font-semibold border-r border-white/10">RNR</th>
                  <th className="px-3 py-2.5 text-center text-indigo-300 font-semibold border-r border-white/10 whitespace-nowrap">Web Call Planned</th>
                  <th className="px-3 py-2.5 text-center text-violet-300 font-semibold border-r border-white/10 whitespace-nowrap">Web Call Done</th>
                  <th className="px-3 py-2.5 text-center font-semibold border-r border-white/10 whitespace-nowrap" style={{ color: "#fb923c" }}>HOT LEAD</th>
                  <th className="px-3 py-2.5 text-center text-white font-semibold whitespace-nowrap">Total Attempted</th>
                </tr>
              </thead>
              <tbody>
                {mtdData.reps.map((rep, idx) => (
                  <tr key={rep.repId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td className="px-3 py-2 font-medium text-slate-800 border-r border-slate-100">{rep.repName}</td>
                    <td className="px-3 py-2 text-center font-semibold text-slate-900 border-r border-slate-100">{rep.totalLeads}</td>
                    <td className="px-3 py-2 text-center text-slate-500 border-r border-slate-100">{rep.notCalled}</td>
                    <td className="px-3 py-2 text-center font-semibold border-r border-slate-100" style={{ color: "#16a34a" }}>{rep.closed}</td>
                    <td className="px-3 py-2 text-center text-blue-600 border-r border-slate-100">{rep.followUp}</td>
                    <td className="px-3 py-2 text-center text-cyan-600 border-r border-slate-100">{rep.interested}</td>
                    <td className="px-3 py-2 text-center text-red-500 border-r border-slate-100">{rep.notInterested}</td>
                    <td className="px-3 py-2 text-center text-yellow-600 border-r border-slate-100">{rep.wrongNumber}</td>
                    <td className="px-3 py-2 text-center text-purple-600 border-r border-slate-100">{rep.rnr}</td>
                    <td className="px-3 py-2 text-center text-indigo-600 border-r border-slate-100">{rep.webCallPlanned}</td>
                    <td className="px-3 py-2 text-center text-violet-600 border-r border-slate-100">{rep.webCallDone}</td>
                    <td className="px-3 py-2 text-center font-semibold border-r border-slate-100" style={{ color: "#ea580c" }}>{rep.hotLead}</td>
                    <td className="px-3 py-2 text-center font-semibold text-slate-900">{rep.totalAttempted}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#0f1729" }}>
                  <td className="px-3 py-2.5 font-bold text-white border-r border-white/10">Total</td>
                  <td className="px-3 py-2.5 text-center font-bold text-white border-r border-white/10">{mtdData.totals.totalLeads}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-slate-300 border-r border-white/10">{mtdData.totals.notCalled}</td>
                  <td className="px-3 py-2.5 text-center font-bold border-r border-white/10" style={{ color: "#4ade80" }}>{mtdData.totals.closed}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-blue-300 border-r border-white/10">{mtdData.totals.followUp}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-cyan-300 border-r border-white/10">{mtdData.totals.interested}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-red-300 border-r border-white/10">{mtdData.totals.notInterested}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-yellow-300 border-r border-white/10">{mtdData.totals.wrongNumber}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-purple-300 border-r border-white/10">{mtdData.totals.rnr}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-indigo-300 border-r border-white/10">{mtdData.totals.webCallPlanned}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-violet-300 border-r border-white/10">{mtdData.totals.webCallDone}</td>
                  <td className="px-3 py-2.5 text-center font-bold border-r border-white/10" style={{ color: "#fb923c" }}>{mtdData.totals.hotLead}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-white">{mtdData.totals.totalAttempted}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or phone..."
            className={`pl-8 h-8 text-xs ${localSearch ? "pr-7" : ""}`}
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") flushSearch(localSearch) }}
          />
          {localSearch && (
            <button
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setLocalSearch(""); setDebouncedSearch("") }}
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="All Stages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {allStages.map(s => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}
            {terminalStages.map(s => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="All Sources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(sourceLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(businessTypeConfig).map(([key, val]) => (<SelectItem key={key} value={key}>{val.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={repFilter} onValueChange={setRepFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="All Reps" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sales Reps</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {salesTeam.filter(r => r.isActive !== false).map(r => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(stageFilter !== "all" || sourceFilter !== "all" || typeFilter !== "all" || repFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setStageFilter("all"); setSourceFilter("all"); setTypeFilter("all"); setRepFilter("all") }}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <CheckSquare className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100" onClick={() => setBulkAssignOpen(true)}>
            <UserPlus className="h-3 w-3" /> Assign Sales Rep
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>Clear Selection</Button>
        </div>
      )}

      {/* Leads Table */}
      {leads.length === 0 && !loading ? (
        <EmptyState
          icon={Users}
          title="No leads found"
          description={debouncedSearch ? `No leads matching "${debouncedSearch}"` : "Try adjusting your filters or add a new lead"}
        />
      ) : (() => {
        const paginationBar = (
          <div className="flex items-center justify-between gap-4 px-4 py-2 bg-muted/20 border-b last:border-b-0 last:border-t">
            <p className="text-[11px] text-muted-foreground">
              {totalCount > 0
                ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount.toLocaleString()} ${debouncedSearch ? "matching leads" : "leads"}`
                : "No leads"}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={page <= 1 || loading} onClick={() => setPage(1)}>«</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
              <span className="text-[11px] text-muted-foreground px-2 whitespace-nowrap">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next ›</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>»</Button>
            </div>
          </div>
        )
        return (
        <Card className="overflow-hidden">
          {paginationBar}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-9 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-9 pl-4">
                    <Checkbox checked={selectedIds.size === leads.length && leads.length > 0} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[180px]">Business</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[150px]">Contact</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">City</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Stage</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Source</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Value</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Sales Rep</TableHead>
                  <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Added</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const nextStage = getNextStage(lead.stage as LeadStage)
                  const typeConf = businessTypeConfig[lead.businessType as BusinessType]
                  const isSelected = selectedIds.has(lead.id)
                  const createdDate = new Date(lead.createdAt)
                  return (
                    <TableRow
                      key={lead.id}
                      className={`h-11 cursor-pointer transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/8" : "hover:bg-muted/40"}`}
                      onClick={() => { setSelectedLead(lead); setEnhancedDetailOpen(true) }}
                    >
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(lead.id)} />
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-xs font-medium truncate">{lead.businessName}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium leading-tight">{lead.contactName}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{lead.contactPhone}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lead.city || "—"}</TableCell>
                      <TableCell>
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5 whitespace-nowrap">
                          {typeConf?.label || lead.businessType.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell><StatusBadge status={lead.stage} /></TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {sourceLabels[lead.source] || lead.source.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-xs font-medium tabular-nums">
                        {lead.estimatedValue ? `₹${lead.estimatedValue.toLocaleString("en-IN")}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {lead.salesRep?.name
                          ? <span className="font-medium">{lead.salesRep.name}</span>
                          : <span className="text-muted-foreground/60 italic text-[10px]">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {createdDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        <span className="block text-[9px] opacity-60">{createdDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5 pr-2">
                          {canEdit && (
                            <button
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Change Stage"
                              onClick={() => handleOpenStageEdit(lead)}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Reassign Rep"
                              onClick={() => handleOpenReassign(lead)}
                            >
                              <UserCheck className="h-3 w-3" />
                            </button>
                          )}
                          {canEdit && nextStage && (
                            <button
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title={`Advance to ${stageLabels[nextStage]}`}
                              onClick={() => { setSelectedLead(lead); setAdvanceOpen(true) }}
                            >
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                          {(() => {
                            const waUrl = buildWaUrl(lead.contactPhone)
                            return waUrl ? (
                              <button
                                className="p-1 rounded hover:bg-[#dcfce7] text-[#25D366] hover:text-[#128C7E] transition-colors"
                                title="Message on WhatsApp"
                                onClick={() => window.open(waUrl, "_blank", "noopener,noreferrer")}
                              >
                                <WhatsAppIcon className="h-3 w-3" />
                              </button>
                            ) : (
                              <button
                                className="p-1 rounded text-muted-foreground/30 cursor-not-allowed"
                                title="No mobile number available"
                                disabled
                              >
                                <WhatsAppIcon className="h-3 w-3" />
                              </button>
                            )
                          })()}
                          <button
                            className="ml-1 text-[10px] font-medium text-primary hover:underline px-1"
                            onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); setEnhancedDetailOpen(true) }}
                          >
                            View
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {paginationBar}
        </Card>
        )
      })()}

      {/* Lead Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[440px] sm:max-w-[440px]">
          {selectedLead && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <SheetTitle className="text-sm">{selectedLead.businessName}</SheetTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={selectedLead.stage} />
                      <span>{selectedLead.salesRep?.name || "Unassigned"}</span>
                      <span>•</span>
                      <span>{sourceLabels[selectedLead.source] || selectedLead.source.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {canEdit && <Button variant="outline" size="sm" className="gap-1.5 text-[10px] h-7" onClick={() => handleOpenStageEdit(selectedLead)}><Pencil className="h-3 w-3" /> Stage</Button>}
                    <Button variant="outline" size="sm" className="gap-1.5 text-[10px] h-7" onClick={() => handleViewFullDetail(selectedLead)}><Maximize2 className="h-3 w-3" /> Full</Button>
                  </div>
                </div>
              </SheetHeader>
              <ScrollArea className="mt-4 h-[calc(100vh-150px)]">
                <div className="space-y-4 pr-4">
                  <div className="grid gap-3">
                    <div className="rounded-lg border bg-card/80 p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Contact</p>
                          <p className="font-semibold text-sm leading-none">{selectedLead.contactName}</p>
                          <p className="text-xs text-muted-foreground">{selectedLead.contactEmail}</p>
                          <p className="text-xs text-muted-foreground">{selectedLead.contactPhone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Est. value</p>
                          <p className="font-semibold text-sm leading-none">{selectedLead.estimatedValue ? `₹${selectedLead.estimatedValue.toLocaleString("en-IN")}` : "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{businessTypeConfig[selectedLead.businessType as BusinessType]?.label || selectedLead.businessType}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Contact Summary</p>
                          <p className="text-[11px] text-muted-foreground">Key engagement metrics</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {selectedLead.lastContactedAt ? new Date(selectedLead.lastContactedAt).toLocaleDateString("en-IN") : "No recent contact"}
                        </Badge>
                      </div>
                      <div className="mt-3"><LeadContactCounters leadId={selectedLead.id} lastContactedAt={selectedLead.lastContactedAt} /></div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground">Business Details</h4>
                        <p className="text-[10px] text-muted-foreground">Compact metadata grid</p>
                      </div>
                      {canEdit && <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => handleOpenReassign(selectedLead)}>Reassign</Button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {[
                        { label: "Type", value: businessTypeConfig[selectedLead.businessType as BusinessType]?.label || selectedLead.businessType },
                        { label: "Source", value: sourceLabels[selectedLead.source] || selectedLead.source.replace(/_/g, " ") },
                        { label: "City", value: selectedLead.city || "—" },
                        { label: "Sales Rep", value: selectedLead.salesRep?.name || "Unassigned" },
                        { label: "Follow-up", value: selectedLead.followUpDate ? new Date(selectedLead.followUpDate).toLocaleDateString("en-IN") : "None" },
                        { label: "Created", value: `${new Date(selectedLead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ${new Date(selectedLead.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` },
                      ].map((item) => (
                        <div key={item.label} className="rounded-md border bg-muted/5 px-3 py-2">
                          <p className="text-[9px] text-muted-foreground">{item.label}</p>
                          <p className="text-xs font-medium">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground">Pipeline Progress</h4>
                        <p className="text-[10px] text-muted-foreground">Horizontal stage tracker</p>
                      </div>
                      {canEdit && <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1.5" onClick={() => handleOpenStageEdit(selectedLead)}><Pencil className="h-3 w-3" /> Edit</Button>}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {allStages.map((stage, idx) => {
                        const currentIdx = stageProgressMap[selectedLead.stage as LeadStage] ?? -1
                        const isCompleted = idx <= currentIdx
                        const isCurrent = stage === selectedLead.stage
                        const stageClasses = isCurrent ? "border-emerald-300 shadow-sm" : isCompleted ? "border-slate-200" : "border-transparent"
                        const colorClasses = leadStageColors[stage as LeadStage] || "bg-slate-100 text-slate-700"
                        return (
                          <div
                            key={stage}
                            className={`min-w-[88px] rounded-full border px-3 py-1 text-[10px] font-semibold ${stageClasses} ${colorClasses} ${isCompleted ? "" : "opacity-70"}`}
                          >
                            <span>{stageLabels[stage]}</span>
                            {isCurrent && <span className="ml-1 text-[9px] font-medium">●</span>}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Current: {stageLabels[selectedLead.stage]}</span>
                      <span>Next: {stageLabels[getNextStage(selectedLead.stage as LeadStage) || selectedLead.stage]}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => handleViewFullDetail(selectedLead)}><Phone className="h-3 w-3" /> Call</Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => handleViewFullDetail(selectedLead)}><MessageCircle className="h-3 w-3" /> WhatsApp</Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => handleViewFullDetail(selectedLead)}><Calendar className="h-3 w-3" /> Follow-up</Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => handleViewFullDetail(selectedLead)}><StickyNote className="h-3 w-3" /> Notes</Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-muted-foreground">Recent Activity</h4>
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1" onClick={() => handleViewFullDetail(selectedLead)}>View All <ArrowRight className="h-3 w-3" /></Button>
                    </div>
                    <LeadActivityTimeline leadId={selectedLead.id} maxHeight="170px" />
                  </div>
                  {selectedLead.notes && (
                    <div className="rounded-lg border p-3">
                      <h4 className="text-xs font-semibold text-muted-foreground">Notes</h4>
                      <p className="text-xs text-muted-foreground">{selectedLead.notes}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Enhanced Lead Detail Sheet */}
      <Sheet open={enhancedDetailOpen} onOpenChange={setEnhancedDetailOpen}>
        <SheetContent className="w-[760px] sm:max-w-[760px] p-0 flex flex-col">
          {selectedLead && (
            <LeadDetailEnhanced
              lead={selectedLead}
              onBack={() => setEnhancedDetailOpen(false)}
              onLeadUpdated={(updated) => {
                setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))
                setSelectedLead(updated)
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Create Lead Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>Add a new lead to the sales pipeline</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Business Name *</Label><Input placeholder="e.g. FreshMart Grocers" value={createForm.businessName} onChange={(e) => setCreateForm(p => ({ ...p, businessName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Contact Name *</Label><Input placeholder="e.g. Amit Patel" value={createForm.contactName} onChange={(e) => setCreateForm(p => ({ ...p, contactName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Phone *</Label><Input placeholder="+91 98765 43210" value={createForm.contactPhone} onChange={(e) => setCreateForm(p => ({ ...p, contactPhone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email *</Label><Input placeholder="amit@business.in" type="email" value={createForm.contactEmail} onChange={(e) => setCreateForm(p => ({ ...p, contactEmail: e.target.value }))} /></div>
              <div className="space-y-2"><Label>City</Label><Input placeholder="e.g. Bangalore" value={createForm.city} onChange={(e) => setCreateForm(p => ({ ...p, city: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Business Type *</Label>
                <Select value={createForm.businessType} onValueChange={(v) => setCreateForm(p => ({ ...p, businessType: v }))}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{Object.entries(businessTypeConfig).map(([key, val]) => (<SelectItem key={key} value={key}>{val.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Source</Label>
                <Select value={createForm.source} onValueChange={(v) => setCreateForm(p => ({ ...p, source: v }))}><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>{Object.entries(sourceLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Est. Value (₹)</Label><Input placeholder="e.g. 59988" type="number" value={createForm.estimatedValue} onChange={(e) => setCreateForm(p => ({ ...p, estimatedValue: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Sales Rep</Label>
                <Select value={createForm.salesRepId} onValueChange={(v) => setCreateForm(p => ({ ...p, salesRepId: v }))}><SelectTrigger><SelectValue placeholder="Assign rep" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {salesTeam.filter((rep) => rep.isActive !== false).map((rep) => (<SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Follow-up Date</Label><Input type="date" value={createForm.followUpDate} onChange={(e) => setCreateForm(p => ({ ...p, followUpDate: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Initial notes about this lead..." rows={2} value={createForm.notes} onChange={(e) => setCreateForm(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLead} disabled={creating}>{creating ? "Creating..." : "Create Lead"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Stage Dialog */}
      <Dialog open={stageEditOpen} onOpenChange={setStageEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Change Lead Stage</DialogTitle><DialogDescription>Update the stage for {selectedLead?.businessName}</DialogDescription></DialogHeader>
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">Current:</div><StatusBadge status={selectedLead.stage} />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">New:</div><StatusBadge status={(newStage || selectedLead.stage) as LeadStage} />
              </div>
              <div className="space-y-2"><Label>Select New Stage</Label>
                <Select value={newStage} onValueChange={setNewStage}><SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent>
                    {allStages.map(s => (<SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>))}
                    {terminalStages.map(s => (<SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Reason (optional)</Label><Textarea placeholder="Reason for stage change..." rows={2} value={stageEditReason} onChange={(e) => setStageEditReason(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageEditOpen(false)}>Cancel</Button>
            <Button onClick={handleStageEdit} disabled={updating || !newStage || newStage === selectedLead?.stage}>{updating ? "Updating..." : "Update Stage"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Stage Dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Advance Lead Stage</DialogTitle><DialogDescription>Move {selectedLead?.businessName} to the next stage</DialogDescription></DialogHeader>
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedLead.stage} />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <StatusBadge status={getNextStage(selectedLead.stage as LeadStage) || "CLOSED_WON"} />
              </div>
              <div className="space-y-2"><Label>Notes (optional)</Label><Textarea placeholder="Add notes about this stage transition..." rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={handleAdvanceStage} disabled={advancing}>{advancing ? "Advancing..." : "Advance Stage"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Sales Rep Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reassign Sales Rep</DialogTitle><DialogDescription>Change the sales rep for {selectedLead?.businessName}</DialogDescription></DialogHeader>
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">Current:</span><span className="font-medium">{selectedLead.salesRep?.name || "Unassigned"}</span>
              </div>
              <div className="space-y-2"><Label>Assign To</Label>
                <Select value={reassignRep} onValueChange={setReassignRep}><SelectTrigger><SelectValue placeholder="Select sales rep" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {salesTeam.filter((rep) => rep.isActive !== false).map((rep) => (<SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button onClick={handleReassign} disabled={!reassignRep || updating}>{updating ? "Reassigning..." : "Reassign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Sales Rep Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Assign Sales Rep</DialogTitle><DialogDescription>Assign a sales rep to {selectedIds.size} selected leads</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Assign To</Label>
              <Select value={bulkAssignRep} onValueChange={setBulkAssignRep}><SelectTrigger><SelectValue placeholder="Select sales rep" /></SelectTrigger>
                <SelectContent>
                  {salesTeam.filter((rep) => rep.isActive !== false).map((rep) => (<SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={!bulkAssignRep || updating}>{updating ? "Assigning..." : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRM Reports Sheet */}
      <Sheet open={crmReportsOpen} onOpenChange={setCrmReportsOpen}>
        <SheetContent className="w-[700px] sm:max-w-[700px]">
          <ScrollArea className="h-[calc(100vh-40px)]">
            <div className="py-4 pr-4">
              {crmTab === "reports" ? <SalesCrmReports leads={leads} /> : <SalesRepPerformance />}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}
