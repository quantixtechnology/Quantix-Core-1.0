"use client"

import { useState, useMemo, useCallback } from "react"
import { PageHeader } from "../shared/page-header"
import { StatCard } from "../shared/stat-card"
import { StatusBadge } from "../shared/status-badge"
import { EmptyState } from "../shared/empty-state"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Monitor,
  Plus,
  Search,
  X,
  RefreshCw,
  Key,
  Clock,
  Users,
  Trash2,
  ExternalLink,
  Shield,
  RotateCcw,
  Copy,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoStatus = "AVAILABLE" | "IN_USE" | "MAINTENANCE"
type DemoBusinessType = "GROCERY" | "LAUNDRY" | "CAR_WASH" | "HOME_SERVICES"

interface DemoSession {
  id: string
  ip: string
  browser: string
  startedAt: string
}

interface UsageHistoryEntry {
  id: string
  leadName: string
  startedAt: string
  endedAt: string
  duration: string
}

interface DemoTenant {
  id: string
  name: string
  businessType: DemoBusinessType
  status: DemoStatus
  assignedTo: string | null
  accessUrl: string
  credentials: { email: string; password: string }
  expiry: string
  sessions: DemoSession[]
  usageHistory: UsageHistoryEntry[]
  createdAt: string
  lastResetAt: string | null
}

// ---------------------------------------------------------------------------
// Demo Type Configuration
// ---------------------------------------------------------------------------

const demoTypeConfig: Record<DemoBusinessType, {
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  cardBg: string
  iconBg: string
  iconColor: string
}> = {
  GROCERY: {
    label: "Grocery",
    icon: Monitor,
    color: "#10B981",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
    cardBg: "bg-emerald-50/50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  LAUNDRY: {
    label: "Laundry",
    icon: Monitor,
    color: "#7C3AED",
    bgColor: "bg-violet-50",
    textColor: "text-violet-700",
    borderColor: "border-violet-200",
    cardBg: "bg-violet-50/50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
  CAR_WASH: {
    label: "Car Wash",
    icon: Monitor,
    color: "#2563EB",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
    cardBg: "bg-blue-50/50",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  HOME_SERVICES: {
    label: "Home Services",
    icon: Monitor,
    color: "#9333EA",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    cardBg: "bg-purple-50/50",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const mockDemoTenants: DemoTenant[] = [
  {
    id: "demo_001",
    name: "FreshMart Grocery Demo",
    businessType: "GROCERY",
    status: "IN_USE",
    assignedTo: "Amit Patel (TasteBud)",
    accessUrl: "demo-grocery.quantixtechnology.in",
    credentials: { email: "demo@freshmart.in", password: "demo1234" },
    expiry: "2026-03-15",
    sessions: [
      { id: "sess_1", ip: "103.45.67.89", browser: "Chrome 121 / macOS", startedAt: "2026-02-07 10:30" },
    ],
    usageHistory: [
      { id: "uh_1", leadName: "Amit Patel (TasteBud)", startedAt: "2026-02-07 10:30", endedAt: "—", duration: "Active" },
      { id: "uh_2", leadName: "Meera Nair (GreenLeaf)", startedAt: "2026-02-05 14:00", endedAt: "2026-02-05 15:30", duration: "1h 30m" },
    ],
    createdAt: "2025-11-01",
    lastResetAt: "2026-01-15",
  },
  {
    id: "demo_002",
    name: "QuickClean Laundry Demo",
    businessType: "LAUNDRY",
    status: "AVAILABLE",
    assignedTo: null,
    accessUrl: "demo-laundry.quantixtechnology.in",
    credentials: { email: "demo@quickclean.in", password: "demo5678" },
    expiry: "2026-06-30",
    sessions: [],
    usageHistory: [
      { id: "uh_3", leadName: "Vikram Singh (CleanPro)", startedAt: "2026-01-20 09:00", endedAt: "2026-01-20 10:45", duration: "1h 45m" },
    ],
    createdAt: "2025-12-15",
    lastResetAt: "2026-01-20",
  },
  {
    id: "demo_003",
    name: "SparkleWash Car Demo",
    businessType: "CAR_WASH",
    status: "IN_USE",
    assignedTo: "Suresh Kumar (WashMaster)",
    accessUrl: "demo-carwash.quantixtechnology.in",
    credentials: { email: "demo@sparklewash.in", password: "wash9876" },
    expiry: "2026-04-01",
    sessions: [
      { id: "sess_2", ip: "45.67.89.12", browser: "Firefox 122 / Windows", startedAt: "2026-02-07 08:15" },
      { id: "sess_3", ip: "78.90.12.34", browser: "Safari 17 / iOS", startedAt: "2026-02-07 09:00" },
    ],
    usageHistory: [
      { id: "uh_4", leadName: "Suresh Kumar (WashMaster)", startedAt: "2026-02-07 08:15", endedAt: "—", duration: "Active" },
      { id: "uh_5", leadName: "Priya Demo", startedAt: "2026-02-03 16:00", endedAt: "2026-02-03 17:20", duration: "1h 20m" },
    ],
    createdAt: "2025-10-20",
    lastResetAt: "2026-02-03",
  },
  {
    id: "demo_004",
    name: "HomeFix Services Demo",
    businessType: "HOME_SERVICES",
    status: "AVAILABLE",
    assignedTo: null,
    accessUrl: "demo-homeservice.quantixtechnology.in",
    credentials: { email: "demo@homefix.in", password: "home5432" },
    expiry: "2026-08-15",
    sessions: [],
    usageHistory: [],
    createdAt: "2026-01-10",
    lastResetAt: null,
  },
  {
    id: "demo_005",
    name: "DailyBasket Grocery Demo",
    businessType: "GROCERY",
    status: "MAINTENANCE",
    assignedTo: null,
    accessUrl: "demo-grocery2.quantixtechnology.in",
    credentials: { email: "demo@dailybasket.in", password: "basket2468" },
    expiry: "2026-05-20",
    sessions: [],
    usageHistory: [
      { id: "uh_6", leadName: "Ravi Iyer (DailyBasket)", startedAt: "2026-01-25 11:00", endedAt: "2026-01-25 12:30", duration: "1h 30m" },
      { id: "uh_7", leadName: "Anita Desai (HomeCare)", startedAt: "2026-01-22 15:00", endedAt: "2026-01-22 16:45", duration: "1h 45m" },
    ],
    createdAt: "2025-09-15",
    lastResetAt: "2026-02-01",
  },
  {
    id: "demo_006",
    name: "PressPerfect Laundry Demo",
    businessType: "LAUNDRY",
    status: "IN_USE",
    assignedTo: "Kavita Reddy (BeautyBox)",
    accessUrl: "demo-laundry2.quantixtechnology.in",
    credentials: { email: "demo@pressperfect.in", password: "press1357" },
    expiry: "2026-03-31",
    sessions: [
      { id: "sess_4", ip: "192.168.1.55", browser: "Chrome 121 / Android", startedAt: "2026-02-07 07:45" },
    ],
    usageHistory: [
      { id: "uh_8", leadName: "Kavita Reddy (BeautyBox)", startedAt: "2026-02-07 07:45", endedAt: "—", duration: "Active" },
    ],
    createdAt: "2025-12-01",
    lastResetAt: null,
  },
  {
    id: "demo_007",
    name: "AquaShine Car Demo",
    businessType: "CAR_WASH",
    status: "AVAILABLE",
    assignedTo: null,
    accessUrl: "demo-carwash2.quantixtechnology.in",
    credentials: { email: "demo@aquashine.in", password: "aqua8642" },
    expiry: "2026-09-30",
    sessions: [],
    usageHistory: [
      { id: "uh_9", leadName: "Demo Session", startedAt: "2026-01-28 13:00", endedAt: "2026-01-28 14:10", duration: "1h 10m" },
    ],
    createdAt: "2026-01-05",
    lastResetAt: "2026-01-28",
  },
  {
    id: "demo_008",
    name: "FixIt Home Demo",
    businessType: "HOME_SERVICES",
    status: "IN_USE",
    assignedTo: "Anita Desai (HomeCare)",
    accessUrl: "demo-homeservice2.quantixtechnology.in",
    credentials: { email: "demo@fixit.in", password: "fixit7890" },
    expiry: "2026-04-15",
    sessions: [
      { id: "sess_5", ip: "56.78.90.12", browser: "Edge 121 / Windows", startedAt: "2026-02-07 11:00" },
    ],
    usageHistory: [
      { id: "uh_10", leadName: "Anita Desai (HomeCare)", startedAt: "2026-02-07 11:00", endedAt: "—", duration: "Active" },
      { id: "uh_11", leadName: "Neha Gupta (StyleHut)", startedAt: "2026-02-02 10:00", endedAt: "2026-02-02 11:30", duration: "1h 30m" },
    ],
    createdAt: "2025-11-20",
    lastResetAt: "2026-02-02",
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DemoTenantsView() {
  const { searchQuery } = useAdminStore()

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newDemoType, setNewDemoType] = useState<string>("")
  const [newDemoName, setNewDemoName] = useState<string>("")
  const [newDemoExpiry, setNewDemoExpiry] = useState<string>("7")

  // Detail sheet state
  const [selectedDemo, setSelectedDemo] = useState<DemoTenant | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Reset confirmation state
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  // Copy feedback state
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Computed stats
  // -------------------------------------------------------------------------

  const stats = useMemo(() => {
    const total = mockDemoTenants.length
    const available = mockDemoTenants.filter((d) => d.status === "AVAILABLE").length
    const inUse = mockDemoTenants.filter((d) => d.status === "IN_USE").length
    const activeSessions = mockDemoTenants.reduce((sum, d) => sum + d.sessions.length, 0)
    return { total, available, inUse, activeSessions }
  }, [])

  // -------------------------------------------------------------------------
  // Demo type counts
  // -------------------------------------------------------------------------

  const demoTypeCounts = useMemo(() => {
    const counts: Record<DemoBusinessType, number> = {
      GROCERY: 0,
      LAUNDRY: 0,
      CAR_WASH: 0,
      HOME_SERVICES: 0,
    }
    mockDemoTenants.forEach((d) => {
      counts[d.businessType]++
    })
    return counts
  }, [])

  // -------------------------------------------------------------------------
  // Filtered demos
  // -------------------------------------------------------------------------

  const filteredDemos = useMemo(() => {
    return mockDemoTenants.filter((demo) => {
      const matchSearch =
        !searchQuery ||
        demo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        demo.businessType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (demo.assignedTo && demo.assignedTo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        demo.accessUrl.toLowerCase().includes(searchQuery.toLowerCase())
      const matchType = typeFilter === "all" || demo.businessType === typeFilter
      const matchStatus = statusFilter === "all" || demo.status === statusFilter
      return matchSearch && matchType && matchStatus
    })
  }, [searchQuery, typeFilter, statusFilter])

  // -------------------------------------------------------------------------
  // Copy to clipboard
  // -------------------------------------------------------------------------

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Auto-generate credentials
  // -------------------------------------------------------------------------

  const generatedCredentials = useMemo(() => {
    if (!newDemoType) return { email: "", password: "" }
    const slugMap: Record<string, string> = {
      GROCERY: "grocery",
      LAUNDRY: "laundry",
      CAR_WASH: "carwash",
      HOME_SERVICES: "homeservice",
    }
    const slug = slugMap[newDemoType] || "demo"
    const suffix = Math.floor(1000 + Math.random() * 9000)
    return {
      email: `demo@${slug}${suffix}.in`,
      password: `demo${suffix}`,
    }
  }, [newDemoType])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleRowClick(demo: DemoTenant) {
    setSelectedDemo(demo)
    setDetailOpen(true)
  }

  function handleLaunchDemo(type: DemoBusinessType) {
    setNewDemoType(type)
    setNewDemoName("")
    setNewDemoExpiry("7")
    setCreateOpen(true)
  }

  function handleCreateDemo() {
    setCreateOpen(false)
  }

  function handleResetDemo() {
    setResetConfirmOpen(false)
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  function getStatusForBadge(status: DemoStatus): string {
    const map: Record<DemoStatus, string> = {
      AVAILABLE: "AVAILABLE",
      IN_USE: "IN_USE",
      MAINTENANCE: "MAINTENANCE_DEMO",
    }
    return map[status]
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Demo Tenants"
        description="Manage demo environments for sales presentations and lead demos"
        icon={Monitor}
        action={
          <Button className="gap-2" onClick={() => { setNewDemoType(""); setNewDemoName(""); setNewDemoExpiry("7"); setCreateOpen(true) }}>
            <Plus className="h-4 w-4" />
            Create Demo
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Demos"
          value={stats.total}
          change="Across 4 business types"
          changeType="neutral"
          icon={Monitor}
          iconColor="text-slate-600"
          iconBg="bg-slate-50"
        />
        <StatCard
          title="Available"
          value={stats.available}
          change="Ready for assignment"
          changeType="positive"
          icon={Key}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="In Use"
          value={stats.inUse}
          change="Currently assigned"
          changeType="neutral"
          icon={Users}
          iconColor="text-sky-600"
          iconBg="bg-sky-50"
        />
        <StatCard
          title="Active Sessions"
          value={stats.activeSessions}
          change="Live demo sessions"
          changeType="neutral"
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Demo Type Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(demoTypeConfig) as [DemoBusinessType, typeof demoTypeConfig[DemoBusinessType]][]).map(
          ([typeKey, config]) => {
            const IconComp = config.icon
            return (
              <Card key={typeKey} className={`border ${config.borderColor} ${config.cardBg} hover:shadow-md transition-shadow`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.iconBg}`}>
                        <IconComp className={`h-5 w-5 ${config.iconColor}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                        <p className="text-xs text-muted-foreground">{demoTypeCounts[typeKey]} demo environments</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`w-full gap-2 ${config.borderColor} ${config.textColor} hover:${config.bgColor}`}
                      onClick={() => handleLaunchDemo(typeKey)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Launch Demo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search demo environments..." className="pl-8 h-9" value={searchQuery} readOnly />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Business Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(demoTypeConfig).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="AVAILABLE">Available</SelectItem>
            <SelectItem value="IN_USE">In Use</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
          </SelectContent>
        </Select>
        {(typeFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setTypeFilter("all"); setStatusFilter("all") }}
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Demo Environments Table */}
      {filteredDemos.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No demo environments found"
          description="Try adjusting your filters or create a new demo environment"
          action={{
            label: "Create Demo",
            onClick: () => { setNewDemoType(""); setNewDemoName(""); setNewDemoExpiry("7"); setCreateOpen(true) },
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Business Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Access URL</TableHead>
                    <TableHead>Credentials</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDemos.map((demo) => {
                    const typeConf = demoTypeConfig[demo.businessType]
                    return (
                      <TableRow
                        key={demo.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(demo)}
                      >
                        <TableCell>
                          <div className="font-medium">{demo.name}</div>
                          <div className="text-xs text-muted-foreground">{demo.id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${typeConf.borderColor} ${typeConf.textColor}`}
                          >
                            {typeConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusForBadge(demo.status)} />
                        </TableCell>
                        <TableCell>
                          {demo.assignedTo ? (
                            <span className="text-sm">{demo.assignedTo}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">Available</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-muted-foreground">{demo.accessUrl}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {demo.credentials.email}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(demo.credentials.email, `${demo.id}-email`)
                              }}
                            >
                              <Copy className={`h-3 w-3 ${copiedField === `${demo.id}-email` ? "text-emerald-500" : "text-muted-foreground"}`} />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatDate(demo.expiry)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => copyToClipboard(`${demo.credentials.email} / ${demo.credentials.password}`, `${demo.id}-creds`)}
                              title="Copy Credentials"
                            >
                              <Copy className={`h-3 w-3 ${copiedField === `${demo.id}-creds` ? "text-emerald-500" : ""}`} />
                              <span className="hidden sm:inline">Copy</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => { setSelectedDemo(demo); setResetConfirmOpen(true) }}
                              title="Reset Data"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Deactivate"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleRowClick(demo)}
                              title="View Sessions"
                            >
                              <Users className="h-3 w-3" />
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

      {/* Create Demo Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Demo Environment</DialogTitle>
            <DialogDescription>
              Set up a new demo environment for sales presentations
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Business Type *</Label>
              <Select value={newDemoType} onValueChange={setNewDemoType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(demoTypeConfig).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Demo Name *</Label>
              <Input
                placeholder="e.g., FreshMart Grocery Demo"
                value={newDemoName}
                onChange={(e) => setNewDemoName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Auto-Generated Credentials</Label>
              {newDemoType ? (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <div className="flex items-center gap-1.5">
                      <code className="text-sm font-mono">{generatedCredentials.email}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(generatedCredentials.email, "new-email")}
                      >
                        <Copy className={`h-3 w-3 ${copiedField === "new-email" ? "text-emerald-500" : "text-muted-foreground"}`} />
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Password</span>
                    <div className="flex items-center gap-1.5">
                      <code className="text-sm font-mono">{generatedCredentials.password}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(generatedCredentials.password, "new-pass")}
                      >
                        <Copy className={`h-3 w-3 ${copiedField === "new-pass" ? "text-emerald-500" : "text-muted-foreground"}`} />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-xs text-muted-foreground">Select a business type to generate credentials</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Expiry Duration</Label>
              <Select value={newDemoExpiry} onValueChange={setNewDemoExpiry}>
                <SelectTrigger>
                  <SelectValue placeholder="Set expiry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDemo} disabled={!newDemoType || !newDemoName.trim()}>
              Create Demo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          {selectedDemo && (() => {
            const typeConf = demoTypeConfig[selectedDemo.businessType]
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    {selectedDemo.name}
                    <StatusBadge status={getStatusForBadge(selectedDemo.status)} />
                  </SheetTitle>
                  <SheetDescription>
                    {selectedDemo.id} &middot; {typeConf.label} &middot; Created {formatDate(selectedDemo.createdAt)}
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="mt-6 h-[calc(100vh-180px)]">
                  <div className="space-y-6 pr-4">
                    {/* Demo Info */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">Demo Information</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Name</p>
                          <p className="text-sm font-medium">{selectedDemo.name}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Type</p>
                          <Badge variant="outline" className={`text-xs mt-1 ${typeConf.borderColor} ${typeConf.textColor}`}>
                            {typeConf.label}
                          </Badge>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Status</p>
                          <div className="mt-1">
                            <StatusBadge status={getStatusForBadge(selectedDemo.status)} />
                          </div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Expiry</p>
                          <p className="text-sm font-medium">{formatDate(selectedDemo.expiry)}</p>
                        </div>
                      </div>
                      {/* Access URL */}
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-1">Access URL</p>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono flex-1">{selectedDemo.accessUrl}</code>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 shrink-0"
                            onClick={() => copyToClipboard(selectedDemo.accessUrl, "detail-url")}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Credentials */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Credentials
                      </h4>
                      <Card className="border-2">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <code className="text-sm font-mono font-semibold">{selectedDemo.credentials.email}</code>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => copyToClipboard(selectedDemo.credentials.email, "detail-email")}
                            >
                              <Copy className={`h-3.5 w-3.5 ${copiedField === "detail-email" ? "text-emerald-500" : ""}`} />
                              {copiedField === "detail-email" ? "Copied!" : "Copy"}
                            </Button>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Password</p>
                              <code className="text-sm font-mono font-semibold">{selectedDemo.credentials.password}</code>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => copyToClipboard(selectedDemo.credentials.password, "detail-pass")}
                            >
                              <Copy className={`h-3.5 w-3.5 ${copiedField === "detail-pass" ? "text-emerald-500" : ""}`} />
                              {copiedField === "detail-pass" ? "Copied!" : "Copy"}
                            </Button>
                          </div>
                          <Separator />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full gap-1.5"
                            onClick={() => copyToClipboard(
                              `Email: ${selectedDemo.credentials.email}\nPassword: ${selectedDemo.credentials.password}`,
                              "detail-both"
                            )}
                          >
                            <Copy className={`h-3.5 w-3.5 ${copiedField === "detail-both" ? "text-emerald-500" : ""}`} />
                            {copiedField === "detail-both" ? "Copied Both!" : "Copy Both Credentials"}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <Separator />

                    {/* Active Sessions */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Active Sessions
                        {selectedDemo.sessions.length > 0 && (
                          <Badge variant="secondary" className="bg-sky-100 text-sky-700 hover:bg-sky-100 text-[10px] border-0">
                            {selectedDemo.sessions.length}
                          </Badge>
                        )}
                      </h4>
                      {selectedDemo.sessions.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-center">
                          <p className="text-xs text-muted-foreground">No active sessions</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedDemo.sessions.map((session) => (
                            <div key={session.id} className="flex items-center justify-between rounded-lg border p-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium">{session.browser}</p>
                                <p className="text-xs text-muted-foreground">IP: {session.ip}</p>
                              </div>
                              <div className="text-right">
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] border-0">
                                  ACTIVE
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {session.startedAt}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Reset Demo Data */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Reset Demo Data
                      </h4>
                      <Card className="border-amber-200 bg-amber-50/30">
                        <CardContent className="p-4 space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Reset all demo data to its original state. This will clear all orders, customers, and
                            settings. {selectedDemo.lastResetAt && `Last reset: ${formatDate(selectedDemo.lastResetAt)}`}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                            onClick={() => setResetConfirmOpen(true)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset Demo Data
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <Separator />

                    {/* Usage History */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Usage History
                      </h4>
                      {selectedDemo.usageHistory.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-center">
                          <p className="text-xs text-muted-foreground">No usage history recorded</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {selectedDemo.usageHistory.map((entry) => (
                            <div key={entry.id} className="rounded-lg border p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{entry.leadName}</span>
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] border-0 ${
                                    entry.duration === "Active"
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {entry.duration}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{entry.startedAt}</span>
                                {entry.endedAt !== "—" && (
                                  <>
                                    <span>&rarr;</span>
                                    <span>{entry.endedAt}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Reset Demo Data
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reset all data for{" "}
              <span className="font-semibold">{selectedDemo?.name}</span>? This will clear all orders, customers, and
              settings, returning the demo to its original state.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <Shield className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800">
              <p className="font-medium">This action cannot be undone</p>
              <p className="mt-0.5">All demo data will be permanently deleted and reset to defaults. Any active sessions will be disconnected.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleResetDemo}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
