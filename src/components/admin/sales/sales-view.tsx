"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  UserCheck,
  Plus,
  Search,
  X,
  Phone,
  Mail,
  Target,
  TrendingUp,
  Award,
  Users,
  ArrowUpRight,
  DollarSign,
  Loader2,
} from "lucide-react"
import { useAdminStore } from "@/stores/admin-store"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SalesRep {
  id: string
  name: string
  email: string
  phone: string
  region: string
  target: number
  achieved: number
  leads: number
  conversions: number
}

// ---------------------------------------------------------------------------
// Regions for select
// ---------------------------------------------------------------------------
const regions = [
  "North India",
  "South India",
  "East India",
  "West India",
  "Central India",
  "Pan India",
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value.toLocaleString("en-IN")}`
}

function formatCurrencyFull(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`
}

function getPerformanceLevel(achieved: number, target: number): "above" | "near" | "below" {
  if (target === 0) return "below"
  const pct = (achieved / target) * 100
  if (pct >= 100) return "above"
  if (pct >= 75) return "near"
  return "below"
}

function getPerformanceColor(level: "above" | "near" | "below") {
  switch (level) {
    case "above":
      return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", progress: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" }
    case "near":
      return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", progress: "bg-amber-500", badge: "bg-amber-100 text-amber-700" }
    case "below":
      return { text: "text-red-700", bg: "bg-red-50", border: "border-red-200", progress: "bg-red-500", badge: "bg-red-100 text-red-700" }
  }
}

function getPerformanceLabel(level: "above" | "near" | "below") {
  switch (level) {
    case "above": return "Above Target"
    case "near": return "Near Target"
    case "below": return "Below Target"
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Commission Tracking Card
// ---------------------------------------------------------------------------
function CommissionTrackingSection({ team }: { team: SalesRep[] }) {
  const totalCommissions = team.reduce((sum, rep) => sum + rep.achieved * 0.05, 0)
  const pendingPayouts = totalCommissions * 0.4
  const earnedThisMonth = totalCommissions * 0.6

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          <CardTitle className="text-sm font-semibold">Commission Tracking</CardTitle>
        </div>
        <CardDescription className="text-xs">Sales rep commission overview — 5% of achieved revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total Commissions</p>
            <p className="text-xl font-bold text-foreground">{formatCurrencyFull(Math.round(totalCommissions))}</p>
            <p className="text-[10px] text-muted-foreground">All time earned by team</p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Pending Payouts</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrencyFull(Math.round(pendingPayouts))}</p>
            <p className="text-[10px] text-muted-foreground">Awaiting processing</p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Earned This Month</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrencyFull(Math.round(earnedThisMonth))}</p>
            <p className="text-[10px] text-muted-foreground">Already disbursed</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {team.map((rep) => {
            const commission = rep.achieved * 0.05
            const level = getPerformanceLevel(rep.achieved, rep.target)
            const colors = getPerformanceColor(level)
            return (
              <div key={rep.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`text-xs font-semibold ${colors.badge}`}>
                      {getInitials(rep.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{rep.name}</p>
                    <p className="text-[10px] text-muted-foreground">{rep.region}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrencyFull(Math.round(commission))}</p>
                  <p className="text-[10px] text-muted-foreground">5% of {formatCurrency(rep.achieved)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Bar chart mock (pure CSS)
// ---------------------------------------------------------------------------
function MiniBarChart({ data }: { data: { month: string; revenue: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.revenue), 1)
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((d) => {
        const heightPct = (d.revenue / maxVal) * 100
        return (
          <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full relative group">
              <div
                className="w-full bg-emerald-500/80 rounded-t-sm hover:bg-emerald-600 transition-colors duration-200"
                style={{ height: `${heightPct}px` }}
              />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {formatCurrency(d.revenue)}
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground">{d.month}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function SalesView() {
  const { searchQuery } = useAdminStore()

  // API-driven state
  const [salesTeam, setSalesTeam] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)

  // Local state
  const [localSearch, setLocalSearch] = useState("")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [performanceFilter, setPerformanceFilter] = useState<string>("all")

  // Selected rep for detail sheet
  const [selectedRep, setSelectedRep] = useState<SalesRep | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formRegion, setFormRegion] = useState("")
  const [formTarget, setFormTarget] = useState("")

  // Effective search combines global and local
  const effectiveSearch = searchQuery || localSearch

  // ---------------------------------------------------------------------------
  // Fetch sales team from API
  // ---------------------------------------------------------------------------
  const fetchSalesTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sales-team", {
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        // Map API data to SalesRep — leads/conversions default to 0 for now
        const team: SalesRep[] = json.data.map((member: Record<string, unknown>) => ({
          id: member.id as string,
          name: member.name as string,
          email: member.email as string,
          phone: (member.phone as string) || "",
          region: (member.region as string) || "",
          target: Number(member.target) || 0,
          achieved: Number(member.achieved) || 0,
          leads: 0,
          conversions: 0,
        }))
        setSalesTeam(team)
      }
    } catch (err) {
      console.error("Failed to fetch sales team:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSalesTeam()
  }, [fetchSalesTeam])

  // ---------------------------------------------------------------------------
  // Filtered team
  // ---------------------------------------------------------------------------
  const filteredTeam = useMemo(() => {
    return salesTeam.filter((rep) => {
      const matchSearch =
        !effectiveSearch ||
        rep.name.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        rep.email.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        rep.region.toLowerCase().includes(effectiveSearch.toLowerCase())
      const matchRegion = regionFilter === "all" || rep.region === regionFilter
      const matchPerf =
        performanceFilter === "all" ||
        getPerformanceLevel(rep.achieved, rep.target) === performanceFilter
      return matchSearch && matchRegion && matchPerf
    })
  }, [salesTeam, effectiveSearch, regionFilter, performanceFilter])

  // ---------------------------------------------------------------------------
  // Summary stats
  // ---------------------------------------------------------------------------
  const totalReps = salesTeam.length
  const totalAchieved = salesTeam.reduce((s, r) => s + r.achieved, 0)
  const totalLeads = salesTeam.reduce((s, r) => s + r.leads, 0)
  const totalConversions = salesTeam.reduce((s, r) => s + r.conversions, 0)
  const conversionRate = totalLeads > 0 ? ((totalConversions / totalLeads) * 100).toFixed(1) : "0"

  // ---------------------------------------------------------------------------
  // Reset add form
  // ---------------------------------------------------------------------------
  const resetForm = () => {
    setFormName("")
    setFormEmail("")
    setFormPhone("")
    setFormRegion("")
    setFormTarget("")
  }

  // ---------------------------------------------------------------------------
  // Add Sales Rep handler
  // ---------------------------------------------------------------------------
  const handleAddSalesRep = async () => {
    if (!formName || !formEmail || !formPhone || !formRegion || !formTarget) {
      toast.error("Please fill in all fields")
      return
    }

    setAdding(true)
    try {
      const res = await fetch("/api/admin/sales-team", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          phone: formPhone,
          region: formRegion,
          target: Number(formTarget),
        }),
      })
      const json = await res.json()

      if (json.success) {
        toast.success(`${formName} has been added to the sales team`)
        setAddOpen(false)
        resetForm()
        fetchSalesTeam() // Refetch the list
      } else {
        toast.error(json.error || "Failed to add sales rep")
      }
    } catch (err) {
      console.error("Failed to add sales rep:", err)
      toast.error("Failed to add sales rep. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ================================================================== */}
      {/* Page Header                                                        */}
      {/* ================================================================== */}
      <PageHeader
        title="Sales Team"
        description="Manage sales representatives, track performance, and monitor commissions"
        icon={UserCheck}
        action={
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Sales Rep
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Sales Representative</DialogTitle>
                <DialogDescription>
                  Add a new member to the sales team
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    placeholder="e.g. Priya Sharma"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      placeholder="name@quantixtechnology.in"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Select value={formRegion} onValueChange={setFormRegion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Amount (₹)</Label>
                    <Input
                      placeholder="e.g. 500000"
                      type="number"
                      value={formTarget}
                      onChange={(e) => setFormTarget(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAddOpen(false); resetForm() }} disabled={adding}>
                  Cancel
                </Button>
                <Button onClick={handleAddSalesRep} disabled={adding}>
                  {adding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Sales Rep"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* ================================================================== */}
      {/* Summary Cards                                                      */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Reps"
          value={totalReps}
          change={`${totalReps} active representatives`}
          changeType="neutral"
          icon={Users}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <StatCard
          title="Total Revenue Achieved"
          value={formatCurrency(totalAchieved)}
          change="Combined team revenue"
          changeType="positive"
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Total Leads"
          value={totalLeads}
          change={`${totalConversions} converted`}
          changeType="neutral"
          icon={Target}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          change="Lead to customer"
          changeType={Number(conversionRate) >= 30 ? "positive" : "neutral"}
          icon={ArrowUpRight}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
      </div>

      {/* ================================================================== */}
      {/* Filters                                                            */}
      {/* ================================================================== */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sales reps..."
            className="pl-8 h-9"
            value={effectiveSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <button
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setLocalSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Performance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="above">Above Target</SelectItem>
            <SelectItem value="near">Near Target</SelectItem>
            <SelectItem value="below">Below Target</SelectItem>
          </SelectContent>
        </Select>
        {(regionFilter !== "all" || performanceFilter !== "all" || localSearch) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRegionFilter("all")
              setPerformanceFilter("all")
              setLocalSearch("")
            }}
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* ================================================================== */}
      {/* Sales Team Grid                                                    */}
      {/* ================================================================== */}
      {filteredTeam.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No sales reps found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or add a new sales rep
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTeam.map((rep) => {
            const level = getPerformanceLevel(rep.achieved, rep.target)
            const colors = getPerformanceColor(level)
            const pct = rep.target > 0 ? Math.round((rep.achieved / rep.target) * 100) : 0
            const commission = rep.achieved * 0.05

            return (
              <Card
                key={rep.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 group border-l-4"
                style={{ borderLeftColor: level === "above" ? "#10B981" : level === "near" ? "#F59E0B" : "#EF4444" }}
                onClick={() => {
                  setSelectedRep(rep)
                  setDetailOpen(true)
                }}
              >
                <CardContent className="p-5">
                  {/* Header: Avatar + Name + Badge */}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarFallback className={`text-sm font-bold ${colors.badge}`}>
                        {getInitials(rep.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold truncate">{rep.name}</h3>
                        <Badge className={`text-[10px] shrink-0 ${colors.badge}`} variant="secondary">
                          {getPerformanceLabel(level)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{rep.region}</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{rep.email}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {rep.phone}
                    </span>
                  </div>

                  <Separator className="my-4" />

                  {/* Target vs Achieved */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Target: {formatCurrencyFull(rep.target)}</span>
                      <span className={`font-semibold ${colors.text}`}>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${colors.progress}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Achieved</span>
                      <span className="font-medium">{formatCurrencyFull(rep.achieved)}</span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-base font-bold">{rep.leads}</p>
                      <p className="text-[9px] text-muted-foreground">Leads</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-base font-bold text-emerald-600">{rep.conversions}</p>
                      <p className="text-[9px] text-muted-foreground">Won</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-sm font-bold">{formatCurrency(Math.round(commission))}</p>
                      <p className="text-[9px] text-muted-foreground">Comm.</p>
                    </div>
                  </div>

                  {/* Commission detail */}
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>5% commission on achieved</span>
                    <span className="font-medium text-foreground">{formatCurrencyFull(Math.round(commission))}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ================================================================== */}
      {/* Commission Tracking Section                                        */}
      {/* ================================================================== */}
      <CommissionTrackingSection team={salesTeam} />

      {/* ================================================================== */}
      {/* Detail Sheet                                                       */}
      {/* ================================================================== */}
      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedRep(null)
        }}
      >
        <SheetContent className="w-[520px] sm:max-w-[520px] p-0">
          {selectedRep && (() => {
            const rep = selectedRep
            const level = getPerformanceLevel(rep.achieved, rep.target)
            const colors = getPerformanceColor(level)
            const pct = rep.target > 0 ? Math.round((rep.achieved / rep.target) * 100) : 0
            const commission = rep.achieved * 0.05

            return (
              <>
                <SheetHeader className="px-6 pt-6 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className={`text-base font-bold ${colors.badge}`}>
                        {getInitials(rep.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <SheetTitle className="text-lg">{rep.name}</SheetTitle>
                      <SheetDescription className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${colors.badge}`} variant="secondary">
                          {getPerformanceLabel(level)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{rep.region}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-120px)]">
                  <div className="space-y-6 p-6">
                    {/* Contact Information */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Contact Information
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="rounded-lg border p-3 flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Email</p>
                            <p className="text-sm font-medium">{rep.email}</p>
                          </div>
                        </div>
                        <div className="rounded-lg border p-3 flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Phone</p>
                            <p className="text-sm font-medium">{rep.phone}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Performance Overview */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Performance Overview
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <Target className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                            <p className="text-lg font-bold">{formatCurrency(rep.target)}</p>
                            <p className="text-[10px] text-muted-foreground">Target</p>
                          </CardContent>
                        </Card>
                        <Card className="shadow-none">
                          <CardContent className="p-3 text-center">
                            <TrendingUp className={`h-4 w-4 mx-auto mb-1 ${colors.text}`} />
                            <p className={`text-lg font-bold ${colors.text}`}>{formatCurrency(rep.achieved)}</p>
                            <p className="text-[10px] text-muted-foreground">Achieved ({pct}%)</p>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress to Target</span>
                          <span className={`font-semibold ${colors.text}`}>{pct}%</span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Key Metrics */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Key Metrics
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xl font-bold">{rep.leads}</p>
                          <p className="text-[10px] text-muted-foreground">Active Leads</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xl font-bold text-emerald-600">{rep.conversions}</p>
                          <p className="text-[10px] text-muted-foreground">Conversions</p>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <p className="text-xl font-bold">{formatCurrency(Math.round(commission))}</p>
                          <p className="text-[10px] text-muted-foreground">Commission</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Commission Details */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Commission Details
                      </h4>
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-semibold">5% Commission Structure</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Revenue Achieved</p>
                            <p className="font-medium">{formatCurrencyFull(rep.achieved)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Commission Rate</p>
                            <p className="font-medium">5%</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Total Commission</p>
                            <p className="font-semibold text-emerald-600">{formatCurrencyFull(Math.round(commission))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Pending Payout</p>
                            <p className="font-semibold text-amber-600">{formatCurrencyFull(Math.round(commission * 0.4))}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
