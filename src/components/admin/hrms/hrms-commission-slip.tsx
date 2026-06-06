"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plus, Eye, Printer, Trash2, BadgeDollarSign } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { authFetch } from "@/lib/admin-fetch"

type SlipStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "PAID"

interface CommissionLine {
  businessId: string
  businessName?: string
  amount: number
  commissionPct: number
  commissionEarned: number
}

interface RenewalLine extends CommissionLine { renewalAmount: number }

interface CommissionSlip {
  id: string
  employeeId: string
  periodType: string
  periodFrom: string
  periodTo: string
  policyId?: string
  signupLines: string
  renewalLines: string
  addonLines: string
  adjustments?: number
  adjustmentNote?: string
  status: SlipStatus
  approvedBy?: string
  paidAt?: string
  notes?: string
  employee?: { id: string; name: string; employeeCode: string }
}

interface Employee { id: string; employeeCode: string; name: string }
interface Policy { id: string; name: string; isActive: boolean }

const STATUS_STYLES: Record<SlipStatus, string> = {
  DRAFT:        "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED:     "bg-emerald-100 text-emerald-700",
  PAID:         "bg-blue-100 text-blue-700",
}

function parseLine<T>(json: string): T[] { try { return JSON.parse(json) } catch { return [] } }
function sumLines(lines: CommissionLine[]) { return lines.reduce((a, l) => a + l.commissionEarned, 0) }
function fmtCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function HrmsCommissionSlipView() {
  const [slips, setSlips] = useState<CommissionSlip[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [viewSlip, setViewSlip] = useState<CommissionSlip | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [form, setForm] = useState({
    employeeId: "", policyId: "", periodType: "MONTHLY",
    periodFrom: "", periodTo: "", adjustments: "", adjustmentNote: "", notes: "",
  })
  const [saving, setSaving] = useState(false)

  const loadDeps = useCallback(async () => {
    const [empRes, polRes] = await Promise.all([
      authFetch("/api/admin/hrms/employees?limit=200"),
      authFetch("/api/admin/hrms/commission-policy"),
    ])
    const [empJson, polJson] = await Promise.all([empRes.json(), polRes.json()])
    if (empJson.success) setEmployees(empJson.data)
    if (polJson.success) setPolicies(polJson.data)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/admin/hrms/commission-slips?limit=100")
      const json = await res.json()
      if (json.success) setSlips(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); loadDeps() }, [load, loadDeps])

  const resetForm = () => setForm({ employeeId: "", policyId: "", periodType: "MONTHLY", periodFrom: "", periodTo: "", adjustments: "", adjustmentNote: "", notes: "" })

  const handlePreview = async () => {
    if (!form.employeeId || !form.periodFrom || !form.periodTo) {
      toast.error("Fill Employee, Period From and To")
      return
    }
    setPreviewing(true)
    setPreview(null)
    try {
      const res = await authFetch("/api/admin/hrms/commission-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, adjustments: parseFloat(form.adjustments) || 0, preview: true }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setPreview(json.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed")
    } finally { setPreviewing(false) }
  }

  const handleGenerate = async () => {
    if (!form.employeeId || !form.periodFrom || !form.periodTo) {
      toast.error("Fill Employee, Period From and To")
      return
    }
    setSaving(true)
    try {
      const res = await authFetch("/api/admin/hrms/commission-slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, adjustments: parseFloat(form.adjustments) || 0 }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Commission slip generated")
      setGenerateOpen(false)
      setPreview(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  const handleAction = async (id: string, action: "submit" | "approve" | "paid") => {
    try {
      const res = await authFetch(`/api/admin/hrms/commission-slips/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(action === "submit" ? "Submitted for review" : action === "approve" ? "Approved" : "Marked as paid")
      setViewSlip(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await authFetch(`/api/admin/hrms/commission-slips/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Slip deleted")
      setDeleteId(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  function LineTable({ title, lines, amountKey = "amount" }: { title: string; lines: CommissionLine[]; amountKey?: string }) {
    if (!lines.length) return null
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Business</TableHead>
              <TableHead className="text-xs text-right">Revenue</TableHead>
              <TableHead className="text-xs text-right">%</TableHead>
              <TableHead className="text-xs text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{(l as unknown as Record<string, string>).businessName || l.businessId}</TableCell>
                <TableCell className="text-xs text-right font-mono">{fmtCurrency((l as unknown as Record<string, number>)[amountKey] ?? l.amount)}</TableCell>
                <TableCell className="text-xs text-right">{l.commissionPct}%</TableCell>
                <TableCell className="text-xs text-right font-semibold font-mono">{fmtCurrency(l.commissionEarned)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  function SlipDetail({ slip }: { slip: CommissionSlip }) {
    const signup  = parseLine<CommissionLine>(slip.signupLines)
    const renewal = parseLine<CommissionLine>(slip.renewalLines)
    const addon   = parseLine<CommissionLine>(slip.addonLines)
    const total   = sumLines(signup) + sumLines(renewal) + sumLines(addon) + (slip.adjustments ?? 0)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[slip.status]}`}>{slip.status}</span>
          <span className="text-sm text-muted-foreground">
            {slip.employee?.name} ({slip.employee?.employeeCode}) · {slip.periodType} · {format(new Date(slip.periodFrom), "d MMM")} – {format(new Date(slip.periodTo), "d MMM yyyy")}
          </span>
        </div>
        <LineTable title="Signup" lines={signup} />
        <LineTable title="Renewal" lines={renewal} amountKey="renewalAmount" />
        <LineTable title="Addon" lines={addon} />
        {(slip.adjustments !== 0 && slip.adjustments != null) && (
          <div className="flex justify-between text-sm px-1">
            <span className="text-muted-foreground">Adjustment{slip.adjustmentNote ? ` (${slip.adjustmentNote})` : ""}</span>
            <span className="font-mono font-semibold">{fmtCurrency(slip.adjustments)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between text-base font-bold px-1">
          <span>Total Commission</span>
          <span className="font-mono text-emerald-700">{fmtCurrency(total)}</span>
        </div>
        {slip.notes && <p className="text-xs text-muted-foreground px-1">{slip.notes}</p>}
        {slip.status !== "PAID" && (
          <div className="flex gap-2 pt-2 flex-wrap">
            {slip.status === "DRAFT"        && <Button size="sm" onClick={() => handleAction(slip.id, "submit")}>Submit for Review</Button>}
            {slip.status === "UNDER_REVIEW" && <Button size="sm" onClick={() => handleAction(slip.id, "approve")}>Approve</Button>}
            {slip.status === "APPROVED"     && <Button size="sm" variant="outline" onClick={() => handleAction(slip.id, "paid")}>Mark as Paid</Button>}
            <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Commission Slips</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generated from Revenue Ownership + Business Module + Active Commission Policy. Amounts frozen at approval.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setPreview(null); setGenerateOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Generate Slip
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
            </div>
          ) : slips.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <BadgeDollarSign className="h-8 w-8 opacity-30" />
              <p className="text-sm">No commission slips yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slips.map((slip) => {
                    const total = sumLines(parseLine(slip.signupLines)) + sumLines(parseLine(slip.renewalLines)) + sumLines(parseLine(slip.addonLines)) + (slip.adjustments ?? 0)
                    return (
                      <TableRow key={slip.id}>
                        <TableCell>
                          <div className="text-sm font-semibold">{slip.employee?.name ?? slip.employeeId}</div>
                          <div className="text-xs text-muted-foreground">{slip.employee?.employeeCode}</div>
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(slip.periodFrom), "d MMM")} – {format(new Date(slip.periodTo), "d MMM yyyy")}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{slip.periodType}</Badge></TableCell>
                        <TableCell>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[slip.status]}`}>{slip.status}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">{fmtCurrency(total)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewSlip(slip)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {slip.status === "DRAFT" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(slip.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Commission Slip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Employee <span className="text-destructive">*</span></Label>
                <Select value={form.employeeId} onValueChange={(v) => setForm((s) => ({ ...s, employeeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Commission Policy <span className="text-muted-foreground text-xs">(auto-selects active if blank)</span></Label>
                <Select value={form.policyId} onValueChange={(v) => setForm((s) => ({ ...s, policyId: v === "auto" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="— Auto (active policy) —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">— Auto (active policy) —</SelectItem>
                    {policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} {p.isActive ? "✓" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Period Type</Label>
                <Select value={form.periodType} onValueChange={(v) => setForm((s) => ({ ...s, periodType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div />
              <div className="space-y-1.5">
                <Label>Period From <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.periodFrom} onChange={(e) => setForm((s) => ({ ...s, periodFrom: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Period To <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.periodTo} onChange={(e) => setForm((s) => ({ ...s, periodTo: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Adjustment (₹)</Label>
                <Input type="number" placeholder="0 or negative for deductions" value={form.adjustments} onChange={(e) => setForm((s) => ({ ...s, adjustments: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Adjustment Note</Label>
                <Input placeholder="Reason for adjustment" value={form.adjustmentNote} onChange={(e) => setForm((s) => ({ ...s, adjustmentNote: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
              </div>
            </div>

            {preview && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
                {["signupLines", "renewalLines", "addonLines"].map((key) => {
                  const lines = (preview[key] as CommissionLine[]) ?? []
                  if (!lines.length) return null
                  return (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground font-semibold capitalize mb-1">{key.replace("Lines", "")}</p>
                      {lines.map((l, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5">
                          <span>{(l as unknown as Record<string, string>).businessName || l.businessId}</span>
                          <span className="font-mono font-semibold">{fmtCurrency(l.commissionEarned)}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
                <Separator />
                <div className="flex justify-between font-bold text-sm">
                  <span>Gross Commission</span>
                  <span className="text-emerald-700 font-mono">{fmtCurrency((preview.grossCommission as number) ?? 0)}</span>
                </div>
                {(preview.adjustments as number) !== 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Adjustments</span>
                    <span className="font-mono">{fmtCurrency(preview.adjustments as number)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm">
                  <span>Final Payable</span>
                  <span className="text-primary font-mono">{fmtCurrency((preview.finalPayable as number) ?? 0)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={handlePreview} disabled={previewing}>{previewing ? "Calculating…" : "Preview"}</Button>
            <Button onClick={handleGenerate} disabled={saving}>{saving ? "Generating…" : "Generate Slip"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Slip Dialog */}
      <Dialog open={!!viewSlip} onOpenChange={(o) => !o && setViewSlip(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Commission Slip</DialogTitle></DialogHeader>
          {viewSlip && <SlipDetail slip={viewSlip} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Slip?</AlertDialogTitle>
            <AlertDialogDescription>Only DRAFT slips can be deleted. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
