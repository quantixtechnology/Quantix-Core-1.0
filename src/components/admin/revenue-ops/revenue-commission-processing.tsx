"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, Eye, IndianRupee, AlertCircle, Clock, BadgeCheck } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

type SlipStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "PAID"

interface Employee { id: string; name: string; employeeCode: string; designation: string }
interface CommissionLine { businessName?: string; amount: number; type?: string }
interface CommissionSlip {
  id: string
  employeeId: string
  periodType: string
  periodFrom: string
  periodTo: string
  signupLines: string
  renewalLines: string
  addonLines: string
  adjustments: number
  adjustmentNote?: string
  status: SlipStatus
  generatedBy?: string
  approvedBy?: string
  paidAt?: string
  approvedAt?: string
  notes?: string
  createdAt: string
  employee: Employee
}

const STATUS_STYLES: Record<SlipStatus, string> = {
  DRAFT:        "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED:     "bg-blue-100 text-blue-700",
  PAID:         "bg-emerald-100 text-emerald-700",
}

const STATUS_LABELS: Record<SlipStatus, string> = {
  DRAFT:        "Draft",
  UNDER_REVIEW: "Under Review",
  APPROVED:     "Approved",
  PAID:         "Paid",
}

function parseLines(json: string): CommissionLine[] {
  try { return JSON.parse(json) ?? [] } catch { return [] }
}

function sumLines(json: string): number {
  return parseLines(json).reduce((s, l) => s + (l.amount ?? 0), 0)
}

function SlipTotal(slip: CommissionSlip) {
  return sumLines(slip.signupLines) + sumLines(slip.renewalLines) + sumLines(slip.addonLines) + (slip.adjustments ?? 0)
}

export function RevenueCommissionProcessingView() {
  const [slips, setSlips] = useState<CommissionSlip[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [viewSlip, setViewSlip] = useState<CommissionSlip | null>(null)
  const [actionOpen, setActionOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "paid" | "review" | "adjust" | null>(null)
  const [approvedBy, setApprovedBy] = useState("")
  const [actionNotes, setActionNotes] = useState("")
  const [adjustAmount, setAdjustAmount] = useState<string>("")
  const [adjustNote, setAdjustNote] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/admin/revenue-ops/commission-processing?${params}`)
      const json = await res.json()
      if (json.success) setSlips(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const doAction = async () => {
    if (!viewSlip || !actionType) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { approvedBy: approvedBy || undefined, notes: actionNotes || undefined }

      if (actionType === "review")  body.status = "UNDER_REVIEW"
      if (actionType === "approve") body.status = "APPROVED"
      if (actionType === "paid")    body.status = "PAID"
      if (actionType === "adjust") {
        body.adjustments    = (viewSlip.adjustments ?? 0) + parseFloat(adjustAmount || "0")
        body.adjustmentNote = adjustNote || undefined
      }

      const res = await fetch(`/api/admin/revenue-ops/commission-processing/${viewSlip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const label = actionType === "review" ? "Submitted for review" : actionType === "approve" ? "Commission approved" : actionType === "paid" ? "Marked as paid" : "Adjustment added"
      toast.success(label)
      setActionOpen(false)
      setViewSlip(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  const openAction = (type: typeof actionType, slip: CommissionSlip) => {
    setViewSlip(slip)
    setActionType(type)
    setApprovedBy("")
    setActionNotes("")
    setAdjustAmount("")
    setAdjustNote("")
    setActionOpen(true)
  }

  const actionLabel: Record<NonNullable<typeof actionType>, string> = {
    review:  "Submit for Review",
    approve: "Approve Commission",
    paid:    "Mark as Paid",
    adjust:  "Add Adjustment",
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Commission Processing</h1>
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Review, approve, and track commission slips. Only Super Admin can approve or mark as paid.
        </p>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["DRAFT", "UNDER_REVIEW", "APPROVED", "PAID"] as SlipStatus[]).map((s) => {
          const count = slips.filter((sl) => sl.status === s).length
          const icons = { DRAFT: AlertCircle, UNDER_REVIEW: Clock, APPROVED: BadgeCheck, PAID: CheckCircle }
          const Icon  = icons[s]
          return (
            <Card key={s} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">{STATUS_LABELS[s]}</span>
                </div>
                <p className="text-2xl font-bold mt-1">{count}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>
          ) : slips.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <IndianRupee className="h-8 w-8 opacity-30" />
              <p className="text-sm">No commission slips</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Total (₹)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slips.map((sl) => {
                    const total = SlipTotal(sl)
                    return (
                      <TableRow key={sl.id}>
                        <TableCell>
                          <div className="font-semibold text-sm">{sl.employee?.name}</div>
                          <div className="text-xs text-muted-foreground">{sl.employee?.designation}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(sl.periodFrom), "d MMM")} – {format(new Date(sl.periodTo), "d MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-sm">
                          ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[sl.status]}`}>
                            {STATUS_LABELS[sl.status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(sl.createdAt), "d MMM yyyy")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewSlip(sl)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {sl.status === "DRAFT" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => openAction("review", sl)}>Review</Button>
                            )}
                            {sl.status === "UNDER_REVIEW" && (
                              <Button size="sm" className="h-7 text-xs px-2" onClick={() => openAction("approve", sl)}>Approve</Button>
                            )}
                            {sl.status === "APPROVED" && (
                              <Button size="sm" className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => openAction("paid", sl)}>Mark Paid</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail View Dialog */}
      <Dialog open={!!viewSlip && !actionOpen} onOpenChange={(o) => !o && setViewSlip(null)}>
        {viewSlip && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Commission Slip — {viewSlip.employee?.name}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[viewSlip.status]}`}>
                  {STATUS_LABELS[viewSlip.status]}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Employee Details */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Employee Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{viewSlip.employee?.name}</span></div>
                  <div><span className="text-muted-foreground">Code:</span> <span className="font-mono">{viewSlip.employee?.employeeCode}</span></div>
                  <div><span className="text-muted-foreground">Designation:</span> <span>{viewSlip.employee?.designation}</span></div>
                  <div><span className="text-muted-foreground">Period:</span> <span>{format(new Date(viewSlip.periodFrom), "d MMM")} – {format(new Date(viewSlip.periodTo), "d MMM yyyy")}</span></div>
                </CardContent>
              </Card>

              {/* Commission Summary */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Commission Summary</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    { label: "Signup Commission", lines: viewSlip.signupLines, color: "text-emerald-700" },
                    { label: "Renewal Commission", lines: viewSlip.renewalLines, color: "text-blue-700" },
                    { label: "Add-On Commission", lines: viewSlip.addonLines, color: "text-purple-700" },
                  ].map(({ label, lines, color }) => {
                    const parsed = parseLines(lines)
                    const sum = parsed.reduce((s, l) => s + (l.amount ?? 0), 0)
                    return (
                      <div key={label}>
                        <div className="flex justify-between font-medium">
                          <span>{label}</span>
                          <span className={color}>₹{sum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {parsed.map((l, i) => (
                          <div key={i} className="flex justify-between text-xs text-muted-foreground pl-3">
                            <span>{l.businessName ?? `Line ${i + 1}`}</span>
                            <span>₹{(l.amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adjustments</span>
                    <span className={viewSlip.adjustments >= 0 ? "text-emerald-700" : "text-red-700"}>
                      {viewSlip.adjustments >= 0 ? "+" : ""}₹{viewSlip.adjustments.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {viewSlip.adjustmentNote && <p className="text-xs text-muted-foreground">{viewSlip.adjustmentNote}</p>}
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total Payout</span>
                    <span>₹{SlipTotal(viewSlip).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Approval Information */}
              {(viewSlip.approvedBy || viewSlip.approvedAt || viewSlip.paidAt) && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Approval Information</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    {viewSlip.approvedBy && <div><span className="text-muted-foreground">Approved By:</span> <span className="font-medium">{viewSlip.approvedBy}</span></div>}
                    {viewSlip.approvedAt && <div><span className="text-muted-foreground">Approved At:</span> <span>{format(new Date(viewSlip.approvedAt), "d MMM yyyy, HH:mm")}</span></div>}
                    {viewSlip.paidAt && <div><span className="text-muted-foreground">Paid At:</span> <span>{format(new Date(viewSlip.paidAt), "d MMM yyyy, HH:mm")}</span></div>}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {viewSlip.status === "DRAFT" && (
                  <Button size="sm" variant="outline" onClick={() => openAction("review", viewSlip)}>Submit for Review</Button>
                )}
                {viewSlip.status === "UNDER_REVIEW" && (
                  <Button size="sm" onClick={() => openAction("approve", viewSlip)}>Approve Commission</Button>
                )}
                {viewSlip.status === "APPROVED" && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openAction("paid", viewSlip)}>Mark as Paid</Button>
                )}
                {viewSlip.status !== "PAID" && (
                  <Button size="sm" variant="outline" onClick={() => openAction("adjust", viewSlip)}>Add Adjustment</Button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={(o) => { if (!o) { setActionOpen(false) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionType ? actionLabel[actionType] : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(actionType === "approve" || actionType === "paid") && (
              <div className="space-y-1.5">
                <Label>Approved By <span className="text-destructive">*</span></Label>
                <Input placeholder="Your name or ID" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
              </div>
            )}
            {actionType === "adjust" && (
              <>
                <div className="space-y-1.5">
                  <Label>Adjustment Amount (₹) <span className="text-muted-foreground text-xs">use negative for deductions</span></Label>
                  <Input type="number" step="0.01" placeholder="e.g. 500 or -200" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Input placeholder="Reason for adjustment…" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} placeholder="Optional notes…" value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button onClick={doAction} disabled={saving}>{saving ? "Processing…" : actionType ? actionLabel[actionType] : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
