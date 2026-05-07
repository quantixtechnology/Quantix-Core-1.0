"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  Plus,
  Search,
  X,
  User,
  Calendar,
  Building2,
  ChevronRight,
} from "lucide-react"
import { businesses, salesTeam, businessTypeConfig } from "@/components/dashboard/data"
import type { BusinessType } from "@/components/dashboard/data"
import { useAdminStore } from "@/stores/admin-store"
import { StatusBadge } from "../shared/status-badge"
import { PageHeader } from "../shared/page-header"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepStatus = "completed" | "in_progress" | "pending" | "skipped"

interface OnboardingStep {
  id: string
  name: string
  order: number
  status: StepStatus
  completedAt: string | null
  assignedTo: string
  notes: string
}

interface OnboardingRecord {
  businessId: string
  businessName: string
  businessType: BusinessType
  ownerName: string
  city: string
  assignedStaff: string
  startedAt: string
  steps: OnboardingStep[]
  currentStepIndex: number
}

// ---------------------------------------------------------------------------
// Default 9 onboarding steps
// ---------------------------------------------------------------------------

const DEFAULT_STEP_TEMPLATES = [
  { id: "step_payment", name: "Payment Verified" },
  { id: "step_business", name: "Business Created" },
  { id: "step_branding", name: "Branding Received" },
  { id: "step_domain", name: "Domain Received" },
  { id: "step_store", name: "Store Configured" },
  { id: "step_modules", name: "Modules Enabled" },
  { id: "step_website", name: "Website Deployed" },
  { id: "step_app", name: "App Configured" },
  { id: "step_credentials", name: "Credentials Shared" },
]

// ---------------------------------------------------------------------------
// Mock onboarding data — varied progress for ONBOARDING businesses
// ---------------------------------------------------------------------------

const onboardingRecords: OnboardingRecord[] = [
  {
    businessId: "biz_5",
    businessName: "MedQuick Pharmacy",
    businessType: "PHARMACY",
    ownerName: "Dr. Suresh Patel",
    city: "Chennai",
    assignedStaff: "sales_1",
    startedAt: "2025-01-08",
    currentStepIndex: 5,
    steps: DEFAULT_STEP_TEMPLATES.map((tpl, idx) => {
      let status: StepStatus = "pending"
      let completedAt: string | null = null
      const completedDates = [
        "2025-01-08",
        "2025-01-09",
        "2025-01-10",
        "2025-01-11",
        "2025-01-13",
        null,
        null,
        null,
        null,
      ]
      if (idx < 5) {
        status = "completed"
        completedAt = completedDates[idx]
      } else if (idx === 5) {
        status = "in_progress"
      }
      return {
        id: tpl.id,
        name: tpl.name,
        order: idx + 1,
        status,
        completedAt,
        assignedTo: idx < 5 ? "sales_1" : "sales_2",
        notes:
          idx === 2
            ? "Logo and brand colors received via email"
            : idx === 3
              ? "Domain: medquick.in — DNS propagated"
              : "",
      }
    }),
  },
  {
    businessId: "biz_8",
    businessName: "GlowUp Beauty",
    businessType: "COSMETICS",
    ownerName: "Kavita Reddy",
    city: "Kolkata",
    assignedStaff: "sales_2",
    startedAt: "2025-01-14",
    currentStepIndex: 2,
    steps: DEFAULT_STEP_TEMPLATES.map((tpl, idx) => {
      let status: StepStatus = "pending"
      let completedAt: string | null = null
      if (idx < 2) {
        status = "completed"
        completedAt = idx === 0 ? "2025-01-14" : "2025-01-15"
      } else if (idx === 2) {
        status = "in_progress"
      }
      return {
        id: tpl.id,
        name: tpl.name,
        order: idx + 1,
        status,
        completedAt,
        assignedTo: "sales_2",
        notes: "",
      }
    }),
  },
  // Extra mock onboarding businesses for richer UI
  {
    businessId: "biz_ob_1",
    businessName: "TasteBud Restaurant",
    businessType: "FOOD_DELIVERY",
    ownerName: "Amit Patel",
    city: "Mumbai",
    assignedStaff: "sales_1",
    startedAt: "2025-01-03",
    currentStepIndex: 7,
    steps: DEFAULT_STEP_TEMPLATES.map((tpl, idx) => {
      let status: StepStatus = "pending"
      let completedAt: string | null = null
      const completedDates = [
        "2025-01-03",
        "2025-01-04",
        "2025-01-05",
        "2025-01-06",
        "2025-01-08",
        "2025-01-09",
        "2025-01-11",
        null,
        null,
      ]
      if (idx < 7) {
        status = "completed"
        completedAt = completedDates[idx]
      } else if (idx === 7) {
        status = "in_progress"
      }
      return {
        id: tpl.id,
        name: tpl.name,
        order: idx + 1,
        status,
        completedAt,
        assignedTo: idx < 4 ? "sales_1" : "sales_2",
        notes: idx === 6 ? "Deployed to Replit — health check passed" : "",
      }
    }),
  },
  {
    businessId: "biz_ob_2",
    businessName: "GreenLeaf Organic",
    businessType: "GROCERY",
    ownerName: "Meera Nair",
    city: "Bangalore",
    assignedStaff: "sales_2",
    startedAt: "2025-01-16",
    currentStepIndex: 0,
    steps: DEFAULT_STEP_TEMPLATES.map((tpl, idx) => {
      let status: StepStatus = "pending"
      if (idx === 0) status = "in_progress"
      return {
        id: tpl.id,
        name: tpl.name,
        order: idx + 1,
        status,
        completedAt: null,
        assignedTo: "sales_2",
        notes: "",
      }
    }),
  },
  {
    businessId: "biz_ob_3",
    businessName: "WashMaster Pro",
    businessType: "CAR_WASH",
    ownerName: "Suresh Kumar",
    city: "Hyderabad",
    assignedStaff: "sales_1",
    startedAt: "2025-01-10",
    currentStepIndex: 4,
    steps: DEFAULT_STEP_TEMPLATES.map((tpl, idx) => {
      let status: StepStatus = "pending"
      let completedAt: string | null = null
      const completedDates = [
        "2025-01-10",
        "2025-01-11",
        "2025-01-12",
        "2025-01-13",
        null,
        null,
        null,
        null,
        null,
      ]
      if (idx < 4) {
        status = "completed"
        completedAt = completedDates[idx]
      } else if (idx === 4) {
        status = "in_progress"
      } else if (idx === 7) {
        status = "skipped"
      }
      return {
        id: tpl.id,
        name: tpl.name,
        order: idx + 1,
        status,
        completedAt,
        assignedTo: idx < 4 ? "sales_1" : "sales_2",
        notes:
          idx === 3
            ? "Domain: washmaster.in — Cloudflare DNS configured"
            : idx === 7
              ? "Skipped — no mobile app required for this plan"
              : "",
      }
    }),
  },
]

// ---------------------------------------------------------------------------
// Helper: compute completion percentage
// ---------------------------------------------------------------------------

function getCompletionPercent(steps: OnboardingStep[]): number {
  const completed = steps.filter((s) => s.status === "completed").length
  return Math.round((completed / steps.length) * 100)
}

// ---------------------------------------------------------------------------
// Step indicator component — circles connected by lines
// ---------------------------------------------------------------------------

function StepIndicator({
  step,
  isLast,
  isCurrent,
}: {
  step: OnboardingStep
  isLast: boolean
  isCurrent: boolean
}) {
  const iconClass = "h-3.5 w-3.5"

  return (
    <div className="flex items-start gap-0">
      {/* Circle */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 shrink-0 transition-all ${
            step.status === "completed"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : step.status === "in_progress"
                ? "border-sky-500 bg-sky-50 text-sky-600"
                : step.status === "skipped"
                  ? "border-slate-300 bg-slate-100 text-slate-400"
                  : "border-slate-200 bg-white text-slate-300"
          } ${isCurrent && step.status === "in_progress" ? "ring-2 ring-sky-200 ring-offset-1 animate-pulse" : ""}`}
        >
          {step.status === "completed" ? (
            <CheckCircle2 className={iconClass} />
          ) : step.status === "in_progress" ? (
            <Clock className={iconClass} />
          ) : step.status === "skipped" ? (
            <span className="text-[10px] font-bold">—</span>
          ) : (
            <Circle className={`${iconClass} fill-current`} />
          )}
        </div>
        {/* Connector line */}
        {!isLast && (
          <div
            className={`w-0.5 min-h-[24px] flex-1 ${
              step.status === "completed" ? "bg-emerald-400" : "bg-slate-200"
            }`}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact step tracker for the card view
// ---------------------------------------------------------------------------

function CompactStepTracker({ steps }: { steps: OnboardingStep[] }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center gap-1">
          <div
            className={`h-2.5 rounded-full transition-all ${
              step.status === "completed"
                ? "bg-emerald-500 w-6"
                : step.status === "in_progress"
                  ? "bg-sky-400 w-6 animate-pulse"
                  : step.status === "skipped"
                    ? "bg-slate-300 w-4"
                    : "bg-slate-200 w-4"
            }`}
            title={`${step.name} — ${step.status.replace(/_/g, " ")}`}
          />
          {idx < steps.length - 1 && (
            <div
              className={`h-0.5 w-1.5 ${
                step.status === "completed" ? "bg-emerald-300" : "bg-slate-100"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Staff name lookup
// ---------------------------------------------------------------------------

function getStaffName(staffId: string): string {
  const member = salesTeam.find((s) => s.id === staffId)
  return member?.name ?? staffId
}

function getStaffInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OnboardingView() {
  const { searchQuery, isCreateDialogOpen, setIsCreateDialogOpen } = useAdminStore()

  const [records, setRecords] = useState<OnboardingRecord[]>(onboardingRecords)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedRecord, setSelectedRecord] = useState<OnboardingRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [markingStep, setMarkingStep] = useState<OnboardingStep | null>(null)
  const [markCompleteOpen, setMarkCompleteOpen] = useState(false)
  const [stepNote, setStepNote] = useState("")

  // ---------- Derived data ----------

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const q = searchQuery.toLowerCase()
      const matchSearch =
        !q ||
        rec.businessName.toLowerCase().includes(q) ||
        rec.ownerName.toLowerCase().includes(q) ||
        rec.city.toLowerCase().includes(q)

      let matchStatus = true
      if (filterStatus === "completed") {
        matchStatus = getCompletionPercent(rec.steps) === 100
      } else if (filterStatus === "in_progress") {
        const pct = getCompletionPercent(rec.steps)
        matchStatus = pct > 0 && pct < 100
      } else if (filterStatus === "not_started") {
        matchStatus = getCompletionPercent(rec.steps) === 0
      }
      return matchSearch && matchStatus
    })
  }, [records, searchQuery, filterStatus])

  const totalInOnboarding = records.length

  const avgCompletion =
    totalInOnboarding > 0
      ? Math.round(
          records.reduce((sum, r) => sum + getCompletionPercent(r.steps), 0) /
            totalInOnboarding
        )
      : 0

  const pendingTasks = records.reduce(
    (sum, r) => sum + r.steps.filter((s) => s.status === "pending" || s.status === "in_progress").length,
    0
  )

  const completedThisWeek = records.reduce(
    (sum, r) =>
      sum +
      r.steps.filter(
        (s) => s.status === "completed" && s.completedAt && s.completedAt >= "2025-01-13"
      ).length,
    0
  )

  // ---------- Handlers ----------

  function handleOpenDetail(rec: OnboardingRecord) {
    setSelectedRecord(rec)
    setDetailOpen(true)
  }

  function handleMarkStep(rec: OnboardingRecord, step: OnboardingStep) {
    setSelectedRecord(rec)
    setMarkingStep(step)
    setStepNote("")
    setMarkCompleteOpen(true)
  }

  function confirmMarkComplete() {
    if (!selectedRecord || !markingStep) return
    const today = new Date().toISOString().split("T")[0]
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.businessId !== selectedRecord.businessId) return rec
        const nextSteps = rec.steps.map((s) => {
          if (s.id !== markingStep.id) return s
          return { ...s, status: "completed" as StepStatus, completedAt: today, notes: stepNote || s.notes }
        })
        // Advance the in_progress pointer
        const currentIdx = rec.currentStepIndex
        const nextIdx = nextSteps.findIndex(
          (s, i) => i > currentIdx && s.status === "pending"
        )
        const updatedSteps = nextSteps.map((s, i) => {
          if (i === nextIdx && s.status === "pending") {
            return { ...s, status: "in_progress" as StepStatus }
          }
          return s
        })
        return { ...rec, steps: updatedSteps, currentStepIndex: nextIdx >= 0 ? nextIdx : currentIdx }
      })
    )
    setMarkCompleteOpen(false)
    setMarkingStep(null)
    // Refresh selectedRecord
    setSelectedRecord((prev) => {
      if (!prev) return null
      const updated = records.find((r) => r.businessId === prev.businessId)
      return updated ?? prev
    })
  }

  function handleSkipStep(rec: OnboardingRecord, step: OnboardingStep) {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.businessId !== rec.businessId) return r
        const nextSteps = r.steps.map((s) => {
          if (s.id !== step.id) return s
          return { ...s, status: "skipped" as StepStatus, notes: stepNote || "Skipped" }
        })
        const currentIdx = r.currentStepIndex
        const nextIdx = nextSteps.findIndex(
          (s, i) => i > currentIdx && s.status === "pending"
        )
        const updatedSteps = nextSteps.map((s, i) => {
          if (i === nextIdx && s.status === "pending") {
            return { ...s, status: "in_progress" as StepStatus }
          }
          return s
        })
        return { ...r, steps: updatedSteps, currentStepIndex: nextIdx >= 0 ? nextIdx : currentIdx }
      })
    )
  }

  function handleReassignStaff(rec: OnboardingRecord, stepId: string, newStaffId: string) {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.businessId !== rec.businessId) return r
        return {
          ...r,
          steps: r.steps.map((s) => (s.id === stepId ? { ...s, assignedTo: newStaffId } : s)),
        }
      })
    )
  }

  // Get the live record for the detail sheet
  const liveSelectedRecord = selectedRecord
    ? records.find((r) => r.businessId === selectedRecord.businessId) ?? selectedRecord
    : null

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* ---- Page Header ---- */}
      <PageHeader
        title="Onboarding Tracker"
        description="Track and manage business onboarding progress"
        icon={ClipboardList}
        action={
          <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Onboarding
          </Button>
        }
      />

      {/* ---- Summary Cards ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total In Onboarding</p>
                <p className="text-2xl font-bold tracking-tight">{totalInOnboarding}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                <ClipboardList className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Average Completion</p>
                <p className="text-2xl font-bold tracking-tight">{avgCompletion}%</p>
                <p className="text-xs text-muted-foreground">Across all businesses</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold tracking-tight">{pendingTasks}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50">
                <Clock className="h-6 w-6 text-sky-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Completed This Week</p>
                <p className="text-2xl font-bold tracking-tight">{completedThisWeek}</p>
                <p className="text-xs text-emerald-600 font-medium">Steps finished</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50">
                <ArrowRight className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Onboarding Steps Reference ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Standard Onboarding Steps</CardTitle>
          <CardDescription className="text-xs">
            9-step process for every new business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_STEP_TEMPLATES.map((tpl, idx) => (
              <div
                key={tpl.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 bg-muted/30"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {idx + 1}
                </span>
                <span className="text-xs font-medium">{tpl.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ---- Filter Bar ---- */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by business, owner, or city..."
            className="pl-8 h-9"
            value={searchQuery}
            readOnly
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[170px] h-9">
            <SelectValue placeholder="Completion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
          </SelectContent>
        </Select>
        {filterStatus !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setFilterStatus("all")}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* ---- Business Onboarding Cards ---- */}
      {filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No businesses in onboarding</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            When businesses enter the onboarding pipeline, they will appear here with a
            step-by-step tracker.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredRecords.map((rec) => {
            const pct = getCompletionPercent(rec.steps)
            const currentStep = rec.steps[rec.currentStepIndex]
            const typeConf = businessTypeConfig[rec.businessType as BusinessType]

            return (
              <Card
                key={rec.businessId}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleOpenDetail(rec)}
              >
                <CardContent className="p-6">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                          {rec.businessName
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{rec.businessName}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {typeConf?.label ?? rec.businessType}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {rec.city}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px] bg-sky-100 text-sky-700">
                          {getStaffInitials(getStaffName(rec.assignedStaff))}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>

                  {/* Owner */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <User className="h-3 w-3" />
                    <span>{rec.ownerName}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Progress</span>
                      <span className="text-xs font-bold">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>

                  {/* Compact step tracker */}
                  <CompactStepTracker steps={rec.steps} />

                  {/* Current step info */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Current step</p>
                      <p className="text-sm font-medium truncate">
                        {currentStep
                          ? `${currentStep.order}. ${currentStep.name}`
                          : "All steps completed!"}
                      </p>
                    </div>
                    {currentStep && currentStep.status === "in_progress" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 shrink-0 text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkStep(rec, currentStep)
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ---- Detail Sheet ---- */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-[520px] sm:max-w-[520px]">
          {liveSelectedRecord && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {liveSelectedRecord.businessName}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status="ONBOARDING" />
                  <span className="text-xs text-muted-foreground">
                    {businessTypeConfig[liveSelectedRecord.businessType as BusinessType]?.label ??
                      liveSelectedRecord.businessType}{" "}
                    • {liveSelectedRecord.city}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="mt-4 h-[calc(100vh-140px)]">
                <div className="space-y-6 pr-4 pb-8">
                  {/* Meta info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Owner</p>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        {liveSelectedRecord.ownerName}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Assigned Staff</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[8px] bg-sky-100 text-sky-700">
                            {getStaffInitials(getStaffName(liveSelectedRecord.assignedStaff))}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-medium">
                          {getStaffName(liveSelectedRecord.assignedStaff)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Started</p>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {liveSelectedRecord.startedAt}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Overall Progress</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress
                          value={getCompletionPercent(liveSelectedRecord.steps)}
                          className="h-2 flex-1"
                        />
                        <span className="text-sm font-bold">
                          {getCompletionPercent(liveSelectedRecord.steps)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Full step-by-step tracker */}
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                      Step-by-Step Progress
                    </h4>
                    {liveSelectedRecord.steps.map((step, idx) => {
                      const isCurrent =
                        idx === liveSelectedRecord.currentStepIndex &&
                        step.status === "in_progress"

                      return (
                        <div key={step.id} className="flex gap-3">
                          {/* Indicator column */}
                          <StepIndicator
                            step={step}
                            isLast={idx === liveSelectedRecord.steps.length - 1}
                            isCurrent={isCurrent}
                          />

                          {/* Content column */}
                          <div className="flex-1 pb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium ${
                                      step.status === "completed"
                                        ? "text-emerald-700"
                                        : isCurrent
                                          ? "text-sky-700"
                                          : step.status === "skipped"
                                            ? "text-slate-400 line-through"
                                            : "text-muted-foreground"
                                    }`}
                                  >
                                    {step.order}. {step.name}
                                  </span>
                                  {step.status === "completed" && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] bg-emerald-100 text-emerald-700 border-0 px-1.5 py-0"
                                    >
                                      Done
                                    </Badge>
                                  )}
                                  {isCurrent && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] bg-sky-100 text-sky-700 border-0 px-1.5 py-0"
                                    >
                                      Current
                                    </Badge>
                                  )}
                                  {step.status === "skipped" && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] bg-slate-100 text-slate-500 border-0 px-1.5 py-0"
                                    >
                                      Skipped
                                    </Badge>
                                  )}
                                </div>

                                {/* Completed timestamp */}
                                {step.completedAt && (
                                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Completed {step.completedAt}
                                  </p>
                                )}

                                {/* Assigned staff */}
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[7px] bg-muted text-muted-foreground">
                                      {getStaffInitials(getStaffName(step.assignedTo))}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground">
                                    {getStaffName(step.assignedTo)}
                                  </span>
                                </div>

                                {/* Notes */}
                                {step.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                                    {step.notes}
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              {(step.status === "in_progress" || step.status === "pending") && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] gap-1"
                                    onClick={() => handleMarkStep(liveSelectedRecord, step)}
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Complete
                                  </Button>
                                  {step.status !== "skipped" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-[11px] text-muted-foreground"
                                      onClick={() => handleSkipStep(liveSelectedRecord, step)}
                                    >
                                      Skip
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Reassign staff */}
                            {(step.status === "in_progress" || step.status === "pending") && (
                              <div className="mt-2 flex items-center gap-2">
                                <Label className="text-[10px] text-muted-foreground">Reassign:</Label>
                                <Select
                                  value={step.assignedTo}
                                  onValueChange={(val) =>
                                    handleReassignStaff(liveSelectedRecord, step.id, val)
                                  }
                                >
                                  <SelectTrigger className="h-6 w-[130px] text-[11px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {salesTeam.map((m) => (
                                      <SelectItem key={m.id} value={m.id} className="text-xs">
                                        {m.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ---- Create Onboarding Dialog ---- */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Onboarding</DialogTitle>
            <DialogDescription>
              Start the onboarding process for a new business
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input placeholder="e.g. FreshMart Grocers" />
              </div>
              <div className="space-y-2">
                <Label>Owner Name</Label>
                <Input placeholder="e.g. Amit Patel" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Business Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(businessTypeConfig).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input placeholder="e.g. Mumbai" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assigned Staff</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesTeam.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Any initial notes for the onboarding..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(false)}>Start Onboarding</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Mark Step Complete Dialog ---- */}
      <Dialog open={markCompleteOpen} onOpenChange={setMarkCompleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Step Complete</DialogTitle>
            <DialogDescription>
              {markingStep
                ? `Complete "${markingStep.name}" (Step ${markingStep.order})`
                : "Complete step"}
            </DialogDescription>
          </DialogHeader>
          {markingStep && liveSelectedRecord && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <StatusBadge status="IN_PROGRESS" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <StatusBadge status="COMPLETED_STEP" />
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-sm font-medium">{liveSelectedRecord.businessName}</p>
                <p className="text-xs text-muted-foreground">
                  Step {markingStep.order}: {markingStep.name}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Completion Notes (optional)</Label>
                <Textarea
                  placeholder="Add notes about this step completion..."
                  value={stepNote}
                  onChange={(e) => setStepNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkCompleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmMarkComplete}>Mark Complete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
