"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X, Globe } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanFeature {
  id: string
  featureName: string
  displayOrder: number
}

interface PricingPlan {
  id: string
  planKey: string
  planName: string
  billingType: string
  price: number | null
  priceDisplay: string | null
  implementationFee: number | null
  description: string | null
  discountMessage: string | null
  displayOrder: number
  isActive: boolean
  features: PlanFeature[]
}

interface CompanyInfo {
  id: string
  companyName: string | null
  address: string | null
  contactNumber: string | null
  whatsappNumber: string | null
  supportEmail: string | null
  salesEmail: string | null
  websiteUrl: string | null
  gstNumber: string | null
  shopActNumber: string | null
  msmeNumber: string | null
}

// ─── Billing type label ───────────────────────────────────────────────────────

function billingLabel(type: string) {
  if (type === "monthly") return "Monthly"
  if (type === "yearly") return "Yearly"
  if (type === "custom") return "Custom"
  return type
}

// ─── Inline editable field ───────────────────────────────────────────────────

function InlineEdit({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string
  onSave: (v: string) => Promise<void>
  placeholder?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  const cancel = () => { setDraft(value); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className={`h-7 text-sm ${className ?? ""}`}
          autoFocus
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel() }}
        />
        {saving
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          : <>
            <button onClick={commit} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={cancel} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </>
        }
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className={`text-left hover:underline decoration-dotted underline-offset-2 ${className ?? ""}`}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground italic">{placeholder ?? "—"}</span>}
    </button>
  )
}

// ─── Feature row ─────────────────────────────────────────────────────────────

function FeatureRow({
  feature,
  isFirst,
  isLast,
  planId,
  onUpdate,
  onDelete,
  onMove,
}: {
  feature: PlanFeature
  isFirst: boolean
  isLast: boolean
  planId: string
  onUpdate: (updated: PlanFeature) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: "up" | "down") => void
}) {
  const saveFeatureName = async (featureName: string) => {
    const res = await fetch(`/api/admin/quantix-website/pricing/${planId}/features/${feature.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureName }),
    })
    if (!res.ok) { toast.error("Failed to save feature"); return }
    onUpdate({ ...feature, featureName })
  }

  const deleteFeature = async () => {
    const res = await fetch(`/api/admin/quantix-website/pricing/${planId}/features/${feature.id}`, {
      method: "DELETE",
    })
    if (!res.ok) { toast.error("Failed to delete feature"); return }
    onDelete(feature.id)
  }

  return (
    <div className="flex items-center gap-2 group py-0.5">
      <div className="flex flex-col gap-0">
        <button
          onClick={() => onMove(feature.id, "up")}
          disabled={isFirst}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => onMove(feature.id, "down")}
          disabled={isLast}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      <span className="text-muted-foreground text-xs w-4 shrink-0">{feature.displayOrder}.</span>
      <div className="flex-1 min-w-0">
        <InlineEdit
          value={feature.featureName}
          onSave={saveFeatureName}
          placeholder="Feature name"
          className="text-sm"
        />
      </div>
      <button
        onClick={deleteFeature}
        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onUpdate,
}: {
  plan: PricingPlan
  onUpdate: (updated: PricingPlan) => void
}) {
  const [features, setFeatures] = useState<PlanFeature[]>(plan.features)
  const [newFeature, setNewFeature] = useState("")
  const [addingFeature, setAddingFeature] = useState(false)
  const [savingPlan, setSavingPlan] = useState<string | null>(null)

  const patchPlan = async (data: Partial<PricingPlan>) => {
    const res = await fetch(`/api/admin/quantix-website/pricing/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error("Failed to save"); return }
    const json = await res.json()
    onUpdate({ ...plan, ...json.plan, features })
    toast.success("Saved")
  }

  const toggleActive = async (checked: boolean) => {
    setSavingPlan("active")
    await patchPlan({ isActive: checked })
    setSavingPlan(null)
  }

  const saveField = async (field: keyof PricingPlan, value: string | number | null) => {
    await patchPlan({ [field]: value })
  }

  const addFeature = async () => {
    if (!newFeature.trim()) return
    setAddingFeature(true)
    const res = await fetch(`/api/admin/quantix-website/pricing/${plan.id}/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureName: newFeature.trim() }),
    })
    if (!res.ok) { toast.error("Failed to add feature"); setAddingFeature(false); return }
    const json = await res.json()
    setFeatures(prev => [...prev, json.feature])
    setNewFeature("")
    setAddingFeature(false)
    toast.success("Feature added")
  }

  const updateFeature = (updated: PlanFeature) => {
    setFeatures(prev => prev.map(f => f.id === updated.id ? updated : f))
  }

  const deleteFeature = (id: string) => {
    setFeatures(prev => prev.filter(f => f.id !== id))
  }

  const moveFeature = async (id: string, direction: "up" | "down") => {
    const idx = features.findIndex(f => f.id === id)
    if (idx < 0) return
    const targetIdx = direction === "up" ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= features.length) return

    const reordered = [...features]
    const temp = reordered[idx]
    reordered[idx] = reordered[targetIdx]
    reordered[targetIdx] = temp

    const withOrder = reordered.map((f, i) => ({ ...f, displayOrder: i + 1 }))
    setFeatures(withOrder)

    await Promise.all(
      withOrder.map(f =>
        fetch(`/api/admin/quantix-website/pricing/${plan.id}/features/${f.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: f.displayOrder }),
        })
      )
    )
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <InlineEdit
              value={plan.planName}
              onSave={v => saveField("planName", v)}
              className="font-semibold text-base"
            />
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs capitalize">
                {billingLabel(plan.billingType)}
              </Badge>
              {plan.discountMessage && (
                <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                  {plan.discountMessage}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savingPlan === "active"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Switch checked={plan.isActive} onCheckedChange={toggleActive} />
            }
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Pricing */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Price Display</Label>
            <InlineEdit
              value={plan.priceDisplay ?? ""}
              onSave={v => saveField("priceDisplay", v)}
              placeholder="e.g. ₹2,499/month"
              className="text-sm font-medium"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Implementation Fee (₹)</Label>
            <InlineEdit
              value={plan.implementationFee != null ? String(plan.implementationFee) : ""}
              onSave={v => saveField("implementationFee", v ? Number(v) : null)}
              placeholder="None"
              className="text-sm"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <Label className="text-xs text-muted-foreground">Description</Label>
          <InlineEdit
            value={plan.description ?? ""}
            onSave={v => saveField("description", v)}
            placeholder="Add a description…"
            className="text-sm text-muted-foreground"
          />
        </div>

        {/* Discount message */}
        <div>
          <Label className="text-xs text-muted-foreground">Discount Message</Label>
          <InlineEdit
            value={plan.discountMessage ?? ""}
            onSave={v => saveField("discountMessage", v || null)}
            placeholder="e.g. Get 2 Months Free"
            className="text-sm"
          />
        </div>

        {/* Features */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            Features ({features.length})
          </Label>
          <div className="space-y-0.5 mb-2 max-h-64 overflow-y-auto pr-1">
            {features.map((f, i) => (
              <FeatureRow
                key={f.id}
                feature={f}
                isFirst={i === 0}
                isLast={i === features.length - 1}
                planId={plan.id}
                onUpdate={updateFeature}
                onDelete={deleteFeature}
                onMove={moveFeature}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              value={newFeature}
              onChange={e => setNewFeature(e.target.value)}
              placeholder="New feature…"
              className="h-7 text-sm flex-1"
              onKeyDown={e => { if (e.key === "Enter") addFeature() }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={addFeature}
              disabled={addingFeature || !newFeature.trim()}
            >
              {addingFeature ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Pricing Plans Tab ────────────────────────────────────────────────────────

function PricingPlansTab() {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/quantix-website/pricing")
      .then(r => r.json())
      .then(d => { setPlans(d.plans ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const updatePlan = (updated: PricingPlan) => {
    setPlans(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading plans…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click any field to edit inline. Changes save automatically.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map(plan => (
          <PlanCard key={plan.id} plan={plan} onUpdate={updatePlan} />
        ))}
      </div>
    </div>
  )
}

// ─── Company & Legal Tab ──────────────────────────────────────────────────────

function CompanyLegalTab() {
  const [info, setInfo] = useState<CompanyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<CompanyInfo>>({})

  useEffect(() => {
    fetch("/api/admin/quantix-website/company-info")
      .then(r => r.json())
      .then(d => {
        setInfo(d.info)
        setDraft(d.info ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch("/api/admin/quantix-website/company-info", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
    if (!res.ok) {
      toast.error("Failed to save company info")
      setSaving(false)
      return
    }
    const json = await res.json()
    setInfo(json.info)
    setDraft(json.info)
    setSaving(false)
    toast.success("Company information saved")
  }

  const set = (field: keyof CompanyInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft(prev => ({ ...prev, [field]: e.target.value || null }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Company Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Company Name</Label>
              <Input
                value={draft.companyName ?? ""}
                onChange={set("companyName")}
                placeholder="Quantix Technology"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Textarea
                value={draft.address ?? ""}
                onChange={set("address")}
                placeholder="Full registered address"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Number</Label>
              <Input
                value={draft.contactNumber ?? ""}
                onChange={set("contactNumber")}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp Number</Label>
              <Input
                value={draft.whatsappNumber ?? ""}
                onChange={set("whatsappNumber")}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Support Email</Label>
              <Input
                value={draft.supportEmail ?? ""}
                onChange={set("supportEmail")}
                placeholder="support@quantixtechnology.in"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sales Email</Label>
              <Input
                value={draft.salesEmail ?? ""}
                onChange={set("salesEmail")}
                placeholder="sales@quantixtechnology.in"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Website URL</Label>
              <Input
                value={draft.websiteUrl ?? ""}
                onChange={set("websiteUrl")}
                placeholder="https://quantixtechnology.in"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal & Compliance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Legal & Compliance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Shown on the website footer and legal pages. Leave blank to hide.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>GST Number</Label>
              <Input
                value={draft.gstNumber ?? ""}
                onChange={set("gstNumber")}
                placeholder="27XXXXX0000X1ZX"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Shop Act Number</Label>
              <Input
                value={draft.shopActNumber ?? ""}
                onChange={set("shopActNumber")}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>MSME Number</Label>
              <Input
                value={draft.msmeNumber ?? ""}
                onChange={set("msmeNumber")}
                placeholder="Optional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function QuantixWebsiteView() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Quantix Website</h1>
          <p className="text-sm text-muted-foreground">
            Manage content displayed on quantixtechnology.in
          </p>
        </div>
      </div>

      <Tabs defaultValue="pricing">
        <TabsList>
          <TabsTrigger value="pricing">Pricing Plans</TabsTrigger>
          <TabsTrigger value="company">Company & Legal</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="mt-4">
          <PricingPlansTab />
        </TabsContent>

        <TabsContent value="company" className="mt-4">
          <CompanyLegalTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
