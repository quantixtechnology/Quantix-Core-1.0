"use client"

import { useState } from "react"
import { PageHeader } from "../shared/page-header"
import { StatusBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { leads, salesTeam, businessTypeConfig } from "@/components/dashboard/data"
import type { LeadStage, LeadSource, BusinessType } from "@/components/dashboard/data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Plus,
  Search,
  Filter,
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
  Bell,
  Maximize2,
  Trophy,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { LeadContactCounters } from "./lead-contact-counters"
import { LeadActivityTimeline } from "./lead-activity-timeline"
import { SalesCrmReports } from "./sales-crm-reports"
import { FollowUpReminders } from "./follow-up-reminders"
import { LeadDetailEnhanced } from "./lead-detail-enhanced"
import { SalesRepPerformance } from "./sales-rep-performance"
import { followUpReminders } from "./crm-data"

const allStages: LeadStage[] = ["LEAD", "DEMO_SHARED", "NEGOTIATION", "PAYMENT_PENDING", "PAYMENT_RECEIVED", "ONBOARDING", "DEPLOYMENT", "ACTIVE"]
const stageProgressMap: Record<LeadStage, number> = {
  LEAD: 0, DEMO_SHARED: 1, NEGOTIATION: 2, PAYMENT_PENDING: 3, PAYMENT_RECEIVED: 4, ONBOARDING: 5, DEPLOYMENT: 6, ACTIVE: 7, LOST: -1, CHURNED: -1
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

  // CRM Extension state
  const [crmReportsOpen, setCrmReportsOpen] = useState(false)
  const [enhancedDetailOpen, setEnhancedDetailOpen] = useState(false)
  const [crmTab, setCrmTab] = useState<"reports" | "performance">("reports")

  const overdueCount = followUpReminders.filter((r) => r.type === "OVERDUE").length

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

  const pipelineCounts = allStages.map(stage => ({
    stage,
    count: leads.filter(l => l.stage === stage).length,
  }))

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            Leads Management
            <Badge variant="outline" className="text-[10px] h-5 gap-1 font-medium border-amber-200 text-amber-700 bg-amber-50">
              <Bell className="h-2.5 w-2.5" />
              {overdueCount} overdue
            </Badge>
          </div>
        }
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

      {/* Pipeline Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Sales Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {pipelineCounts.map((item, idx) => (
              <div key={item.stage} className="flex items-center gap-1 min-w-0">
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-muted/50 min-w-[80px]">
                  <span className="text-lg font-bold">{item.count}</span>
                  <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight">{item.stage.replace(/_/g, " ")}</span>
                </div>
                {idx < pipelineCounts.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Reminders (CRM Extension) */}
      <FollowUpReminders />

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
            {allStages.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
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
                    return (
                      <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedLead(lead); setDetailOpen(true) }}>
                        <TableCell>
                          <div className="font-medium">{lead.businessName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{lead.contactName}</div>
                          <div className="text-xs text-muted-foreground">{lead.contactPhone}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{typeConf?.label || lead.type}</Badge>
                        </TableCell>
                        <TableCell><StatusBadge status={lead.stage} /></TableCell>
                        <TableCell className="text-xs">{lead.source.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-medium">₹{lead.estimatedValue?.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-sm">{lead.salesRep}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {nextStage && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelectedLead(lead); setAdvanceOpen(true) }}>
                                <ArrowRight className="h-3 w-3" />
                                Advance
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelectedLead(lead); setDetailOpen(true) }}>
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
                    <SheetTitle>{selectedLead.businessName}</SheetTitle>
                    <SheetDescription className="mt-1">
                      <StatusBadge status={selectedLead.stage} />
                    </SheetDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => handleViewFullDetail(selectedLead)}
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Full Detail
                  </Button>
                </div>
              </SheetHeader>
              <ScrollArea className="mt-6 h-[calc(100vh-160px)]">
                <div className="space-y-6 pr-4">
                  {/* Contact Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Contact Information</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.contactName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.contactEmail}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.contactPhone}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Counters (CRM Extension) */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Contact Summary</h4>
                    <LeadContactCounters leadId={selectedLead.id} />
                  </div>

                  <Separator />

                  {/* Business Details */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Business Details</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="text-sm font-medium">{businessTypeConfig[selectedLead.type as BusinessType]?.label || selectedLead.type}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Source</p>
                        <p className="text-sm font-medium">{selectedLead.source.replace(/_/g, " ")}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Est. Value</p>
                        <p className="text-sm font-medium">₹{selectedLead.estimatedValue?.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Sales Rep</p>
                        <p className="text-sm font-medium">{selectedLead.salesRep}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Pipeline Progress */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Pipeline Progress</h4>
                    <div className="space-y-2">
                      {allStages.map((stage, idx) => {
                        const currentIdx = stageProgressMap[selectedLead.stage as LeadStage] ?? -1
                        const isCompleted = idx <= currentIdx
                        const isCurrent = stage === selectedLead.stage
                        return (
                          <div key={stage} className="flex items-center gap-3">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium shrink-0 ${isCompleted ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                              {isCompleted ? "✓" : idx + 1}
                            </div>
                            <span className={`text-sm ${isCurrent ? "font-semibold" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                              {stage.replace(/_/g, " ")}
                            </span>
                            {isCurrent && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Share2 className="h-3.5 w-3.5" /> Share Demo
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <StickyNote className="h-3.5 w-3.5" /> Add Note
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Calendar className="h-3.5 w-3.5" /> Schedule
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Payment
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Activity Timeline (CRM Extension) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-muted-foreground">Recent Activity</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] gap-1"
                        onClick={() => handleViewFullDetail(selectedLead)}
                      >
                        View All <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                    <LeadActivityTimeline leadId={selectedLead.id} maxHeight="300px" />
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Enhanced Lead Detail Sheet (CRM Extension) */}
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

      {/* Advance Stage Dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent>
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
                <Textarea placeholder="Add notes about this stage transition..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={() => setAdvanceOpen(false)}>Advance Stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRM Reports & Performance Dialog (CRM Extension) */}
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
