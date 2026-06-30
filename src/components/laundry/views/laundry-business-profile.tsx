"use client"

// ============================================================================
// Masters → Business Profile
// Permanent, always-editable business master (replaces the one-time setup
// wizard). Reuses the existing GET/PUT /api/laundry/businesses/[id] — no new
// API, no schema change, no workflow impact.
// ============================================================================

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface BusinessForm {
  businessName: string; legalName: string; ownerName: string
  mobile: string; email: string; gstNumber: string; logo: string
  address: string; status: string
}

const EMPTY: BusinessForm = {
  businessName: "", legalName: "", ownerName: "", mobile: "", email: "",
  gstNumber: "", logo: "", address: "", status: "ACTIVE",
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9" />
    </div>
  )
}

export function LaundryBusinessProfile() {
  const { currentBusinessId } = useAuthStore()
  const [form, setForm] = useState<BusinessForm>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof BusinessForm, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${currentBusinessId}`)
      const b = await res.json()
      if (b && !b.error) {
        setForm({
          businessName: b.businessName ?? "", legalName: b.legalName ?? "", ownerName: b.ownerName ?? "",
          mobile: b.mobile ?? "", email: b.email ?? "", gstNumber: b.gstNumber ?? "",
          logo: b.logo ?? "", address: b.address ?? "", status: b.status ?? "ACTIVE",
        })
      }
    } catch {
      toast.error("Failed to load business profile")
    } finally {
      setLoading(false)
    }
  }, [currentBusinessId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!currentBusinessId) return
    if (!form.businessName.trim()) { toast.error("Business name is required"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/laundry/businesses/${currentBusinessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (res.ok && !json.error) toast.success("Business profile saved")
      else throw new Error(json.error || "Save failed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!currentBusinessId) {
    return <div className="flex flex-col items-center justify-center py-24 text-muted-foreground"><p className="text-sm">No business selected</p></div>
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Business Profile</h2>
          <p className="text-sm text-muted-foreground">Edit your laundry business information. Always editable.</p>
        </div>
        <Button size="sm" className="gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={save} disabled={saving || loading}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Identity</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Business Name *" value={form.businessName} onChange={(v) => set("businessName", v)} />
              <Field label="Legal Name" value={form.legalName} onChange={(v) => set("legalName", v)} />
              <Field label="Owner Name" value={form.ownerName} onChange={(v) => set("ownerName", v)} />
              <Field label="Logo URL" value={form.logo} onChange={(v) => set("logo", v)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Phone" value={form.mobile} onChange={(v) => set("mobile", v)} />
              <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
              <div className="sm:col-span-2"><Field label="Business Address" value={form.address} onChange={(v) => set("address", v)} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tax &amp; Status</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="GST Number" value={form.gstNumber} onChange={(v) => set("gstNumber", v)} />
              <Field label="Business Status" value={form.status} onChange={(v) => set("status", v)} placeholder="ACTIVE / INACTIVE" />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
