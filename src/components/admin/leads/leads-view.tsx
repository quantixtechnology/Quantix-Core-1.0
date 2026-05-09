"use client"

import { useState, useMemo } from "react"
import { PageHeader } from "../shared/page-header"
import { StatusBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { leads, salesTeam, businessTypeConfig, leadStageColors } from "@/components/dashboard/data"
import type { LeadStage, LeadSource, BusinessType } from "@/components/dashboard/data"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Plus,
  Search,
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  UserCircle,
  StickyNote,
  Share2,
  CheckCircle2,
  X,
  BarChart3,
  Maximize2,
  Trophy,
  Pencil,
  UserCheck,
  CheckSquare,
  UserPlus,
  TrendingUp,
  DollarSign,
  Clock,
  Target,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { LeadContactCounters } from "./lead-contact-counters"
import { LeadActivityTimeline } from "./lead-activity-timeline"
import { SalesCrmReports } from "./sales-crm-reports"
import { LeadDetailEnhanced } from "./lead-detail-enhanced"
import { SalesRepPerformance } from "./sales-rep-performance"

const allStages: LeadStage[] = ["LEAD", "DEMO_SHARED", "NEGOTIATION", "PAYMENT_PENDING", "PAYMENT_RECEIVED", "ONBOARDING", "DEPLOYMENT", "ACTIVE"]
const stageProgressMap: Record<LeadStage, number> = {
  LEAD: 0, DEMO_SHARED: 1, NEGOTIATION: 2, PAYMENT_PENDING: 3, PAYMENT_RECEIVED: 4, ONBOARDING: 5, DEPLOYMENT: 6, ACTIVE: 7, LOST: -1, CHURNED: -1
}

const stageLabels: Record<string, string> = {
  LEAD: "Lead",
  DEMO_SHARED: "Demo Shared",
  NEGOTIATION: "Negotiation",
  PAYMENT_PENDING: "Payment Pending",
  PAYMENT_RECEIVED: "Payment Received",
  ONBOARDING: "Onboarding",
  DEPLOYMENT: "Deployment",
  ACTIVE: "Active",
  LOST: "Lost",
  CHURNED: "Churned",
}

export function LeadsView() {
  const { searchQuery, setCrmLeadTab } = useAdminStore()
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selectedLead, setSelectedLead] = useState<typeof leads[0] | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [stageEditOpen, setStageEditOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)

  // CRM Extension state
  const [crmReportsOpen, setCrmReportsOpen] = useState(false)
  const [enhancedDetailOpen, setEnhancedDetailOpen] = useState(false)
  const [crmTab, setCrmTab] = useState<"reports" | "performance">("reports")

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssignRep, setBulkAssignRep] = useState<string>("")

  // Stage edit & reassign state
  const [newStage, setNewStage] = useState<string>("")
  const [reassignRep, setReassignRep] = useState<string>("")

  const filteredLeads = leads.filter((lead) => {
    const matchSearch = !searchQuery ||
      lead.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStage = stageFilter === "all" || lead.stage === stageFilter
    const matchSource = sourceFilter === "all" || lead.source === sourceFilter
    const matchType = typeFilter === "all" || lead.type === typeFilter
    return matchSearch && matchStage && matchSource && matchType
  })

  // Pipeline report data
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

    const avgDealTime = "8.5" // mock days
    const avgDealValue = activeLeads.length > 0 ? Math.round(activeValue / activeLeads.length) : 0

    return { totalLeads, totalValue, activeLeads: activeLeads.length, activeValue, convertedLeads, conversionRate, stageBreakdown, lostLeads: lostLeads.length, lostValue, lostPct, avgDealTime, avgDealValue }
  }, [leads])

  const getNextStage = (currentStage: LeadStage): LeadStage | null => {
    const idx = allStages.indexOf(currentStage)
    if (idx === -1 || idx === allStages.length - 1) return null
    return allStages[idx + 1]
  }

  const handleViewFullDetail = (lead: typeof leads[0]) => {
    setDetailOpen(false)
    setSelectedLead(lead)
    setCrmLeadTab("overview")
    setEnhancedDetailOpen(true)
  }

  const handleOpenStageEdit = (lead: typeof leads[0]) => {
    setSelectedLead(lead)
    setNewStage(lead.stage)
    setStageEditOpen(true)
  }

  const handleOpenReassign = (lead: typeof leads[0]) => {
    setSelectedLead(lead)
    setReassignRep("")
    setReassignOpen(true)
  }

  // Bulk operations
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)))
    }
  }

  const handleBulkAssign = () => {
    setBulkAssignOpen(false)
    setSelectedIds(new Set())
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads Management"
        description="Track and manage sales pipeline"
        icon={Users}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => { setCrmReportsOpen(true); setCrmTab("reports") }}>
              <BarChart3 className="h-4 w-4" />
              CRM Reports
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { setCrmReportsOpen(true); setCrmTab("performance") }}>
              <Trophy className="h-4 w-4" />
              Rep Performance
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Lead</DialogTitle>
                  <DialogDescription>Add a new business lead to the pipeline</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Business Name</Label>
                      <Input placeholder="e.g. FreshMart Grocers" />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Name</Label>
                      <Input placeholder="e.g. Amit Patel" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input placeholder="email@business.in" type="email" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Business Type</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(businessTypeConfig).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{val.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Lead Source</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="META_ADS">Meta Ads</SelectItem>
                          <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
                          <SelectItem value="WHATSAPP_INQUIRY">WhatsApp Inquiry</SelectItem>
                          <SelectItem value="DIRECT_REFERRAL">Direct Referral</SelectItem>
                          <SelectItem value="WEBSITE_INQUIRY">Website Inquiry</SelectItem>
                          <SelectItem value="COLD_OUTREACH">Cold Outreach</SelectItem>
                          <SelectItem value="PHONE_CALL">Phone Call</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Estimated Value (₹)</Label>
                      <Input placeholder="59988" type="number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned Sales Rep</Label>
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Select rep" /></SelectTrigger>
                        <SelectContent>
                          {salesTeam.map(rep => (
                            <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea placeholder="Add notes about this lead..." rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={() => setCreateOpen(false)}>Create Lead</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Pipeline Report — replaces simple count */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Pipeline Report</CardTitle>
            <Badge variant="outline" className="text-[10px] h-5 font-medium">
              {pipelineReport.activeLeads} active leads
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Target className="h-3 w-3" /> Total Leads
              </div>
              <p className="text-lg font-bold">{pipelineReport.totalLeads}</p>
              <p className="text-[10px] text-muted-foreground">₹{pipelineReport.totalValue.toLocaleString("en-IN")}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" /> Conversion Rate
              </div>
              <p className="text-lg font-bold">{pipelineReport.conversionRate}%</p>
              <p className="text-[10px] text-muted-foreground">{pipelineReport.convertedLeads} converted</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" /> Avg Deal Value
              </div>
              <p className="text-lg font-bold">₹{pipelineReport.avgDealValue.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-muted-foreground">₹{pipelineReport.activeValue.toLocaleString("en-IN")} pipeline</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3" /> Avg Deal Time
              </div>
              <p className="text-lg font-bold">{pipelineReport.avgDealTime} days</p>
              <p className="text-[10px] text-red-500">{pipelineReport.lostLeads} lost (₹{pipelineReport.lostValue.toLocaleString("en-IN")})</p>
            </div>
          </div>

          {/* Stage Breakdown */}
          <div className="space-y-2">
            {pipelineReport.stageBreakdown.map((item) => {
              const colorClass = leadStageColors[item.stage as LeadStage] || "bg-slate-100 text-slate-700"
              return (
                <div key={item.stage} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${colorClass.split(" ")[0]}`} />
                  <span className="text-xs text-muted-foreground w-32 truncate">{stageLabels[item.stage]}</span>
                  <div className="flex-1">
                    <Progress value={Number(item.pct)} className="h-2" />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">{item.count}</span>
                  <span className="text-[10px] text-muted-foreground w-24 text-right">₹{item.value.toLocaleString("en-IN")}</span>
                </div>
              )
            })}
            {pipelineReport.lostLeads > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0 bg-red-200" />
                <span className="text-xs text-red-500 w-32">Lost</span>
                <div className="flex-1">
                  <Progress value={Number(pipelineReport.lostPct)} className="h-2" />
                </div>
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
            <SelectItem value="META_ADS">Meta Ads</SelectItem>
            <SelectItem value="GOOGLE_ADS">Google Ads</SelectItem>
            <SelectItem value="WHATSAPP_INQUIRY">WhatsApp</SelectItem>
            <SelectItem value="DIRECT_REFERRAL">Referral</SelectItem>
            <SelectItem value="COLD_OUTREACH">Cold Outreach</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Business Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(businessTypeConfig).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(stageFilter !== "all" || sourceFilter !== "all" || typeFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setStageFilter("all"); setSourceFilter("all"); setTypeFilter("all") }}>
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            onClick={() => setBulkAssignOpen(true)}
          >
            <UserPlus className="h-3 w-3" />
            Assign Sales Rep
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear Selection
          </Button>
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
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
                    const typeConf = businessTypeConfig[lead.type as BusinessType]
                    const isSelected = selectedIds.has(lead.id)
                    return (
                      <TableRow
                        key={lead.id}
                        className={`cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-emerald-50/50" : ""}`}
                        onClick={() => { setSelectedLead(lead); setDetailOpen(true) }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(lead.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs">{lead.businessName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">{lead.contactName}</div>
                          <div className="text-[10px] text-muted-foreground">{lead.contactPhone}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] h-5">{typeConf?.label || lead.type}</Badge>
                        </TableCell>
                        <TableCell><StatusBadge status={lead.stage} /></TableCell>
                        <TableCell className="text-[10px]">{lead.source.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-xs font-medium">₹{lead.estimatedValue?.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-xs">{lead.salesRep}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={() => handleOpenStageEdit(lead)} title="Change Stage">
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={() => handleOpenReassign(lead)} title="Reassign Rep">
                              <UserCheck className="h-3 w-3" />
                            </Button>
                            {nextStage && (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={() => { setSelectedLead(lead); setAdvanceOpen(true) }}>
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={() => { setSelectedLead(lead); setDetailOpen(true) }}>
                              View
                            </Button>
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
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          {selectedLead && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-sm">{selectedLead.businessName}</SheetTitle>
                    <SheetDescription className="mt-1">
                      <StatusBadge status={selectedLead.stage} />
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[10px] h-7"
                      onClick={() => handleOpenStageEdit(selectedLead)}
                    >
                      <Pencil className="h-3 w-3" />
                      Change Stage
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[10px] h-7"
                      onClick={() => handleViewFullDetail(selectedLead)}
                    >
                      <Maximize2 className="h-3 w-3" />
                      Full Detail
                    </Button>
                  </div>
                </div>
              </SheetHeader>
              <ScrollArea className="mt-4 h-[calc(100vh-140px)]">
                <div className="space-y-5 pr-4">
                  {/* Contact Info */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground">Contact Information</h4>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{selectedLead.contactName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{selectedLead.contactEmail}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{selectedLead.contactPhone}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Counters */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground">Contact Summary</h4>
                    <LeadContactCounters leadId={selectedLead.id} />
                  </div>

                  <Separator />

                  {/* Business Details */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground">Business Details</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border p-2.5">
                        <p className="text-[10px] text-muted-foreground">Type</p>
                        <p className="text-xs font-medium">{businessTypeConfig[selectedLead.type as BusinessType]?.label || selectedLead.type}</p>
                      </div>
                      <div className="rounded-lg border p-2.5">
                        <p className="text-[10px] text-muted-foreground">Source</p>
                        <p className="text-xs font-medium">{selectedLead.source.replace(/_/g, " ")}</p>
                      </div>
                      <div className="rounded-lg border p-2.5">
                        <p className="text-[10px] text-muted-foreground">Est. Value</p>
                        <p className="text-xs font-medium">₹{selectedLead.estimatedValue?.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="rounded-lg border p-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">Sales Rep</p>
                          <Button variant="ghost" size="sm" className="h-4 text-[9px] px-1 text-emerald-600" onClick={() => handleOpenReassign(selectedLead)}>
                            Reassign
                          </Button>
                        </div>
                        <p className="text-xs font-medium">{selectedLead.salesRep}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Pipeline Progress with Edit */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-muted-foreground">Pipeline Progress</h4>
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 text-emerald-600" onClick={() => handleOpenStageEdit(selectedLead)}>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {allStages.map((stage, idx) => {
                        const currentIdx = stageProgressMap[selectedLead.stage as LeadStage] ?? -1
                        const isCompleted = idx <= currentIdx
                        const isCurrent = stage === selectedLead.stage
                        return (
                          <div key={stage} className="flex items-center gap-2.5">
                            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium shrink-0 ${isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                              {isCompleted ? "✓" : idx + 1}
                            </div>
                            <span className={`text-xs ${isCurrent ? "font-semibold" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                              {stageLabels[stage]}
                            </span>
                            {isCurrent && <Badge variant="secondary" className="text-[9px] h-4">Current</Badge>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                        <Share2 className="h-3 w-3" /> Share Demo
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                        <StickyNote className="h-3 w-3" /> Add Note
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                        <Calendar className="h-3 w-3" /> Schedule
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                        <CheckCircle2 className="h-3 w-3" /> Payment
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Activity Timeline */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-muted-foreground">Recent Activity</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[10px] gap-1"
                        onClick={() => handleViewFullDetail(selectedLead)}
                      >
                        View All <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                    <LeadActivityTimeline leadId={selectedLead.id} maxHeight="200px" />
                  </div>
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
                <LeadDetailEnhanced
                  leadId={selectedLead.id}
                  onBack={() => {
                    setEnhancedDetailOpen(false)
                    setDetailOpen(true)
                  }}
                />
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Change Stage Dialog */}
      <Dialog open={stageEditOpen} onOpenChange={setStageEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Lead Stage</DialogTitle>
            <DialogDescription>
              Update the stage for {selectedLead?.businessName}
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">Current:</div>
                <StatusBadge status={selectedLead.stage} />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">New:</div>
                <StatusBadge status={(newStage || selectedLead.stage) as LeadStage} />
              </div>
              <div className="space-y-2">
                <Label>Select New Stage</Label>
                <Select value={newStage} onValueChange={setNewStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStages.map(s => (
                      <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>
                    ))}
                    <SelectItem value="LOST">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea placeholder="Reason for stage change..." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageEditOpen(false)}>Cancel</Button>
            <Button onClick={() => setStageEditOpen(false)}>Update Stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Stage Dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Advance Lead Stage</DialogTitle>
            <DialogDescription>
              Move {selectedLead?.businessName} to the next stage
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedLead.stage} />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <StatusBadge status={getNextStage(selectedLead.stage as LeadStage) || "ACTIVE"} />
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea placeholder="Add notes about this stage transition..." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={() => setAdvanceOpen(false)}>Advance Stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Sales Rep Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Sales Rep</DialogTitle>
            <DialogDescription>
              Change the sales rep for {selectedLead?.businessName}
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">Current:</span>
                <span className="font-medium">{selectedLead.salesRep}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">New:</span>
                <span className="font-medium">{salesTeam.find(r => r.id === reassignRep)?.name || "—"}</span>
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={reassignRep} onValueChange={setReassignRep}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sales rep" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesTeam.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>
                        <div className="flex items-center gap-2">
                          <span>{rep.name}</span>
                          <span className="text-muted-foreground">— {rep.region}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea placeholder="Reason for reassignment..." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button onClick={() => setReassignOpen(false)} disabled={!reassignRep}>Reassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Sales Rep Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Assign Sales Rep</DialogTitle>
            <DialogDescription>
              Assign a sales rep to {selectedIds.size} selected leads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Selected Leads:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {leads.filter(l => selectedIds.has(l.id)).map(l => (
                  <div key={l.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{l.businessName}</span>
                    <span className="text-muted-foreground">{l.salesRep}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={bulkAssignRep} onValueChange={setBulkAssignRep}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sales rep" />
                </SelectTrigger>
                <SelectContent>
                  {salesTeam.map(rep => (
                    <SelectItem key={rep.id} value={rep.id}>
                      <div className="flex items-center gap-2">
                        <span>{rep.name}</span>
                        <span className="text-muted-foreground">— {rep.region}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={!bulkAssignRep}>
              Assign to {selectedIds.size} Leads
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRM Reports & Performance Dialog */}
      <Dialog open={crmReportsOpen} onOpenChange={setCrmReportsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Sales CRM Dashboard</DialogTitle>
            <DialogDescription>
              Sales team performance metrics and pipeline insights
            </DialogDescription>
          </DialogHeader>
          <Tabs value={crmTab} onValueChange={(v) => setCrmTab(v as "reports" | "performance")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reports" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> CRM Reports
              </TabsTrigger>
              <TabsTrigger value="performance" className="gap-1.5 text-xs">
                <Trophy className="h-3.5 w-3.5" /> Rep Performance
              </TabsTrigger>
            </TabsList>
            <TabsContent value="reports" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <div className="pr-4">
                  <SalesCrmReports onClose={() => setCrmReportsOpen(false)} />
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="performance" className="mt-4">
              <ScrollArea className="max-h-[60vh]">
                <div className="pr-4">
                  <SalesRepPerformance />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
