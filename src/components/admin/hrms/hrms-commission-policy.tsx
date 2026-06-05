"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, PlusCircle, MinusCircle, BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface PolicyTier {
  minRevenue: number
  maxRevenue: number | null
  signupPct: number
  renewalPct: number
  addonPct: number
}

interface CommissionPolicy {
  id: string
  name: string
  effectiveFrom: string
  effectiveTo?: string
  tiers: string
  isActive: boolean
  notes?: string
}

const EMPTY_TIER: PolicyTier = { minRevenue: 0, maxRevenue: null, signupPct: 0, renewalPct: 0, addonPct: 0 }

const EMPTY_FORM = { name: "", effectiveFrom: "", effectiveTo: "", isActive: true, notes: "" }

function parseTiers(json: string): PolicyTier[] {
  try { return JSON.parse(json) } catch { return [] }
}

export function HrmsCommissionPolicyView() {
  const [policies, setPolicies] = useState<CommissionPolicy[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<CommissionPolicy | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [tiers, setTiers] = useState<PolicyTier[]>([{ ...EMPTY_TIER }])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/hrms/commission-policy")
      const json = await res.json()
      if (json.success) setPolicies(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditItem(null); setForm({ ...EMPTY_FORM }); setTiers([{ ...EMPTY_TIER }]); setFormOpen(true)
  }

  const openEdit = (p: CommissionPolicy) => {
    setEditItem(p)
    setForm({ name: p.name, effectiveFrom: p.effectiveFrom.slice(0, 10), effectiveTo: p.effectiveTo?.slice(0, 10) ?? "", isActive: p.isActive, notes: p.notes ?? "" })
    setTiers(parseTiers(p.tiers).length ? parseTiers(p.tiers) : [{ ...EMPTY_TIER }])
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.effectiveFrom) { toast.error("Name and Effective From are required"); return }
    setSaving(true)
    try {
      const url    = editItem ? `/api/admin/hrms/commission-policy/${editItem.id}` : "/api/admin/hrms/commission-policy"
      const method = editItem ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tiers: JSON.stringify(tiers) }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success(editItem ? "Policy updated" : "Policy created")
      setFormOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/admin/hrms/commission-policy/${deleteId}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      toast.success("Policy deleted")
      setDeleteId(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  const updateTier = (i: number, key: keyof PolicyTier, val: string) => {
    setTiers((prev) => prev.map((t, idx) => idx !== i ? t : {
      ...t,
      [key]: key === "maxRevenue" ? (val === "" ? null : parseFloat(val)) : parseFloat(val) || 0,
    }))
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Commission Policy</h1>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">Quantix Internal</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define tier-based commission rates applied to Quantix employee commission slips.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Policy
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : policies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <BarChart3 className="h-8 w-8 opacity-30" />
              <p className="text-sm">No policies yet</p>
            </CardContent>
          </Card>
        ) : policies.map((p) => {
          const trs = parseTiers(p.tiers)
          return (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {p.name}
                      <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Effective: {format(new Date(p.effectiveFrom), "d MMM yyyy")}
                      {p.effectiveTo ? ` → ${format(new Date(p.effectiveTo), "d MMM yyyy")}` : " (Open ended)"}
                    </p>
                    {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {trs.length > 0 && (
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Min Revenue (₹)</TableHead>
                        <TableHead className="text-xs">Max Revenue (₹)</TableHead>
                        <TableHead className="text-xs text-center">Signup %</TableHead>
                        <TableHead className="text-xs text-center">Renewal %</TableHead>
                        <TableHead className="text-xs text-center">Addon %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trs.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-mono">₹{t.minRevenue.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-sm font-mono">{t.maxRevenue != null ? `₹${t.maxRevenue.toLocaleString("en-IN")}` : "∞"}</TableCell>
                          <TableCell className="text-center text-sm font-semibold text-emerald-700">{t.signupPct}%</TableCell>
                          <TableCell className="text-center text-sm font-semibold text-blue-700">{t.renewalPct}%</TableCell>
                          <TableCell className="text-center text-sm font-semibold text-purple-700">{t.addonPct}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Policy" : "New Commission Policy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Policy Name <span className="text-destructive">*</span></Label>
                <Input placeholder="FY 2025-26 Standard" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Effective From <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.effectiveFrom} onChange={(e) => setForm((s) => ({ ...s, effectiveFrom: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Effective To <span className="text-muted-foreground text-xs">(leave blank = open)</span></Label>
                <Input type="date" value={form.effectiveTo} onChange={(e) => setForm((s) => ({ ...s, effectiveTo: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea rows={2} placeholder="Optional notes…" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3 col-span-2">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} id="isActive" />
                <Label htmlFor="isActive">Active Policy</Label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Commission Tiers</Label>
                <Button type="button" size="sm" variant="outline" className="gap-1 h-7 text-xs"
                  onClick={() => setTiers((t) => [...t, { ...EMPTY_TIER, minRevenue: (t[t.length - 1]?.maxRevenue ?? 0) + 1 }])}>
                  <PlusCircle className="h-3.5 w-3.5" /> Add Tier
                </Button>
              </div>
              {tiers.map((tier, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end p-3 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <Label className="text-xs">Min Revenue (₹)</Label>
                    <Input className="h-8 text-sm" type="number" value={tier.minRevenue}
                      onChange={(e) => updateTier(i, "minRevenue", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Revenue (₹)</Label>
                    <Input className="h-8 text-sm" type="number" placeholder="∞"
                      value={tier.maxRevenue ?? ""}
                      onChange={(e) => updateTier(i, "maxRevenue", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Signup %</Label>
                    <Input className="h-8 text-sm" type="number" step="0.1" value={tier.signupPct}
                      onChange={(e) => updateTier(i, "signupPct", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Renewal %</Label>
                    <Input className="h-8 text-sm" type="number" step="0.1" value={tier.renewalPct}
                      onChange={(e) => updateTier(i, "renewalPct", e.target.value)} />
                  </div>
                  <div className="space-y-1 flex items-end gap-1">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Addon %</Label>
                      <Input className="h-8 text-sm" type="number" step="0.1" value={tier.addonPct}
                        onChange={(e) => updateTier(i, "addonPct", e.target.value)} />
                    </div>
                    {tiers.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => setTiers((t) => t.filter((_, idx) => idx !== i))}>
                        <MinusCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Existing commission slips referencing this policy are not affected.</AlertDialogDescription>
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
