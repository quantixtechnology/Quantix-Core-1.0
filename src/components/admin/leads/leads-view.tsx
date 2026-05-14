"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users, Plus, Search, ArrowRight, Phone, Mail, Calendar, UserCircle,
  StickyNote, Share2, CheckCircle2, X, BarChart3, Maximize2, Trophy,
  Pencil, UserCheck, CheckSquare, UserPlus, TrendingUp, DollarSign,
  Clock, Target, RefreshCw, AlertTriangle, MessageCircle,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { useAuthStore } from "@/stores/auth-store"
import { LeadContactCounters } from "./lead-contact-counters"
import { LeadActivityTimeline } from "./lead-activity-timeline"
import { SalesCrmReports } from "./sales-crm-reports"
import { LeadDetailEnhanced } from "./lead-detail-enhanced"
import { SalesRepPerformance } from "./sales-rep-performance"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"

// ---- API data types ----
interface LeadApiData {
  id: string; businessName: string; contactName: string; contactEmail: string
  contactPhone: string; businessType: string; source: string; stage: string
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

const allStages: LeadStage[] = ["LEAD", "DEMO_SHARED", "NEGOTIATION", "PAYMENT_PENDING", "PAYMENT_RECEIVED", "ONBOARDING", "DEPLOYMENT", "ACTIVE"]
const stageProgressMap: Record<LeadStage, number> = {
  LEAD: 0, DEMO_SHARED: 1, NEGOTIATION: 2, PAYMENT_PENDING: 3, PAYMENT_RECEIVED: 4, ONBOARDING: 5, DEPLOYMENT: 6, ACTIVE: 7, LOST: -1, CHURNED: -1
}

const stageLabels: Record<string, string> = {
  LEAD: "Lead", DEMO_SHARED: "Demo Shared", NEGOTIATION: "Negotiation",
  PAYMENT_PENDING: "Payment Pending", PAYMENT_RECEIVED: "Payment Received",
  ONBOARDING: "Onboarding", DEPLOYMENT: "Deployment", ACTIVE: "Active",
  LOST: "Lost", CHURNED: "Churned",
}

const sourceLabels: Record<string, string> = {
  META_ADS: "Meta Ads", GOOGLE_ADS: "Google Ads", DIRECT_REFERRAL: "Referral",
  WHATSAPP_INQUIRY: "WhatsApp", COLD_OUTREACH: "Cold Outreach",
  WEBSITE_INQUIRY: "Website", PHONE_CALL: "Phone Call", OTHER: "Other",
}

export function LeadsView() {
  const { searchQuery, setCrmLeadTab } = useAdminStore()
  const { permissions } = useAuthStore()
  const canEdit = permissions.includes("leads:edit" as never)
  const [leads, setLeads] = useState<LeadApiData[]>([])
  const [salesTeam, setSalesTeam] = useState<SalesTeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stageFilter, setStageFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
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

  // Create lead form state
  const [createForm, setCreateForm] = useState({
    businessName: "", contactName: "", contactEmail: "", contactPhone: "",
    businessType: "", source: "WEBSITE_INQUIRY", estimatedValue: "",
    salesRepId: "", notes: "", followUpDate: "",
  })
  const [creating, setCreating] = useState(false)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/leads?limit=100", { headers: getAuthHeaders() })
      if (!res.ok) throw new Error("Failed to fetch leads")
      const json = await res.json()
      if (json.success) setLeads(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSalesTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sales-team?active=true", { headers: getAuthHeaders() })
      if (res.ok) {
        const json = await res.json()
        if (json.success) setSalesTeam(json.data)
      }
    } catch {
      // Silently fail — sales team is not critical for initial load
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeads(); fetchSalesTeam()
  }, [])

  const filteredLeads = leads.filter((lead) => {
    const matchSearch = !searchQuery ||
      lead.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStage = stageFilter === "all" || lead.stage === stageFilter
    const matchSource = sourceFilter === "all" || lead.source === sourceFilter
    const matchType = typeFilter === "all" || lead.businessType === typeFilter
    return matchSearch && matchStage && matchSource && matchType
  })

  // Pipeline report data from real leads
  const pipelineReport = useMemo(() => {
    const totalLeads = leads.length
    const totalValue = leads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0)
    const activeLeads = leads.filter(l => l.stage !== "LOST" && l.stage !== "CHURNED")
    const activeValue = activeLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0)
    const convertedLeads = leads.filter(l => l.stage === "ACTIVE").length
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0"

    const stageBreakdown = allStages.map(stage => {
      const stageLeads = leads.filter(l => l.stage === stage)
      const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0)
      const pct = totalLeads > 0 ? ((stageLeads.length / totalLeads) * 100).toFixed(0) : "0"
      return { stage, count: stageLeads.length, value: stageValue, pct }
    })

    const lostLeads = leads.filter(l => l.stage === "LOST")
    const lostValue = lostLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0)
    const lostPct = totalLeads > 0 ? ((lostLeads.length / totalLeads) * 100).toFixed(0) : "0"
    const avgDealValue = activeLeads.length > 0 ? Math.round(activeValue / activeLeads.length) : 0

    return { totalLeads, totalValue, activeLeads: activeLeads.length, activeValue, convertedLeads, conversionRate, stageBreakdown, lostLeads: lostLeads.length, lostValue, lostPct, avgDealTime: "8.5", avgDealValue }
  }, [leads])

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
        fetchLeads()
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

      if (nextStage === newStage) {
        // Forward one step — use advance-stage
        res = await fetch(`/api/core/leads/${selectedLead.id}/advance-stage`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            stage: newStage,
            lostReason: newStage === "LOST" ? stageEditReason : undefined,
          }),
        })
      } else {
        // Direct stage change — use PATCH
        res = await fetch(`/api/core/leads/${selectedLead.id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            stage: newStage,
            lostReason: newStage === "LOST" ? stageEditReason : undefined,
          }),
        })
      }

      const json = await res.json()
      if (json.success || json.data) {
        toast.success(`Stage updated to ${stageLabels[newStage] || newStage}`)
        setStageEditOpen(false)
        setStageEditReason("")
        fetchLeads()
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
        fetchLeads()
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
      fetchLeads()
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
          businessType: "", source: "WEBSITE_INQUIRY", estimatedValue: "",
          salesRepId: "", notes: "", followUpDate: "",
        })
        fetchLeads()
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
    if (selectedIds.size === filteredLeads.length) { setSelectedIds(new Set()) }
    else { setSelectedIds(new Set(filteredLeads.map(l => l.id))) }
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
          <Button variant="outline" size="sm" onClick={fetchLeads} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
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

      {/* Pipeline Report */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Pipeline Report</CardTitle>
            <Badge variant="outline" className="text-[10px] h-5 font-medium">{pipelineReport.activeLeads} active leads</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Target className="h-3 w-3" /> Total Leads</div>
              <p className="text-lg font-bold">{pipelineReport.totalLeads}</p>
              <p className="text-[10px] text-muted-foreground">₹{pipelineReport.totalValue.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3 w-3" /> Conversion Rate</div>
              <p className="text-lg font-bold">{pipelineReport.conversionRate}%</p>
              <p className="text-[10px] text-muted-foreground">{pipelineReport.convertedLeads} converted</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><DollarSign className="h-3 w-3" /> Avg Deal Value</div>
              <p className="text-lg font-bold">₹{pipelineReport.avgDealValue.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-muted-foreground">₹{pipelineReport.activeValue.toLocaleString("en-IN")} pipeline</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Clock className="h-3 w-3" /> Avg Deal Time</div>
              <p className="text-lg font-bold">{pipelineReport.avgDealTime} days</p>
              <p className="text-[10px] text-red-500">{pipelineReport.lostLeads} lost (₹{pipelineReport.lostValue.toLocaleString("en-IN")})</p>
            </div>
          </div>
          <div className="space-y-2">
            {pipelineReport.stageBreakdown.map((item) => {
              const colorClass = leadStageColors[item.stage as LeadStage] || "bg-slate-100 text-slate-700"
              return (
                <div key={item.stage} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${colorClass.split(" ")[0]}`} />
                  <span className="text-xs text-muted-foreground w-32 truncate">{stageLabels[item.stage]}</span>
                  <div className="flex-1"><Progress value={Number(item.pct)} className="h-2" /></div>
                  <span className="text-xs font-medium w-8 text-right">{item.count}</span>
                  <span className="text-[10px] text-muted-foreground w-24 text-right">₹{item.value.toLocaleString("en-IN")}</span>
                </div>
              )
            })}
            {pipelineReport.lostLeads > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0 bg-red-200" />
                <span className="text-xs text-red-500 w-32">Lost</span>
                <div className="flex-1"><Progress value={Number(pipelineReport.lostPct)} className="h-2" /></div>
                <span className="text-xs font-medium w-8 text-right text-red-500">{pipelineReport.lostLeads}</span>
                <span className="text-[10px] text-red-400 w-24 text-right">₹{pipelineReport.lostValue.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-8 h-9" value={searchQuery} readOnly />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {allStages.map(s => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}
            <SelectItem value="LOST">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(sourceLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Business Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(businessTypeConfig).map(([key, val]) => (<SelectItem key={key} value={key}>{val.label}</SelectItem>))}
          </SelectContent>
        </Select>
        {(stageFilter !== "all" || sourceFilter !== "all" || typeFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setStageFilter("all"); setSourceFilter("all"); setTypeFilter("all") }}><X className="h-3 w-3 mr-1" /> Clear</Button>
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
      {filteredLeads.length === 0 ? (
        <EmptyState icon={Users} title="No leads found" description="Try adjusting your filters or add a new lead" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Sales Rep</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => {
                    const nextStage = getNextStage(lead.stage as LeadStage)
                    const typeConf = businessTypeConfig[lead.businessType as BusinessType]
                    const isSelected = selectedIds.has(lead.id)
                    return (
                      <TableRow key={lead.id} className={`cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-emerald-50/50" : ""}`} onClick={() => { setSelectedLead(lead); setDetailOpen(true) }}>
                        <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(lead.id)} /></TableCell>
                        <TableCell><div className="font-medium text-xs">{lead.businessName}</div></TableCell>
                        <TableCell>
                          <div className="text-xs">{lead.contactName}</div>
                          <div className="text-[10px] text-muted-foreground">{lead.contactPhone}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] h-5">{typeConf?.label || lead.businessType}</Badge></TableCell>
                        <TableCell><StatusBadge status={lead.stage} /></TableCell>
                        <TableCell className="text-[10px]">{sourceLabels[lead.source] || lead.source.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-xs font-medium">{lead.estimatedValue ? `₹${lead.estimatedValue.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-xs">{lead.salesRep?.name || "Unassigned"}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            {canEdit && <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={() => handleOpenStageEdit(lead)} title="Change Stage"><Pencil className="h-3 w-3" /></Button>}
                            {canEdit && <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={() => handleOpenReassign(lead)} title="Reassign Rep"><UserCheck className="h-3 w-3" /></Button>}
                            {canEdit && nextStage && (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={() => { setSelectedLead(lead); setAdvanceOpen(true) }}>
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={() => { setSelectedLead(lead); setDetailOpen(true) }}>View</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
                        { label: "Sales Rep", value: selectedLead.salesRep?.name || "Unassigned" },
                        { label: "Follow-up", value: selectedLead.followUpDate ? new Date(selectedLead.followUpDate).toLocaleDateString("en-IN") : "None" },
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
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          {selectedLead && (
            <ScrollArea className="h-[calc(100vh-40px)]">
              <div className="pr-4 py-4">
                <LeadDetailEnhanced lead={selectedLead} onBack={() => { setEnhancedDetailOpen(false); setDetailOpen(true) }} />
              </div>
            </ScrollArea>
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
              <div className="space-y-2"><Label>Business Type *</Label>
                <Select value={createForm.businessType} onValueChange={(v) => setCreateForm(p => ({ ...p, businessType: v }))}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{Object.entries(businessTypeConfig).map(([key, val]) => (<SelectItem key={key} value={key}>{val.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Source</Label>
                <Select value={createForm.source} onValueChange={(v) => setCreateForm(p => ({ ...p, source: v }))}><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>{Object.entries(sourceLabels).map(([key, label]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Est. Value (₹)</Label><Input placeholder="e.g. 59988" type="number" value={createForm.estimatedValue} onChange={(e) => setCreateForm(p => ({ ...p, estimatedValue: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Sales Rep</Label>
                <Select value={createForm.salesRepId} onValueChange={(v) => setCreateForm(p => ({ ...p, salesRepId: v }))}><SelectTrigger><SelectValue placeholder="Assign rep" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {salesTeam.filter((rep) => rep.isActive !== false).map((rep) => (<SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
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
                  <SelectContent>{allStages.map(s => (<SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>))}<SelectItem value="LOST">Lost</SelectItem></SelectContent>
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
                <StatusBadge status={getNextStage(selectedLead.stage as LeadStage) || "ACTIVE"} />
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
