"use client"

// Business Features — the tenant's licence, in the Business Management wizard.
//
// Replaces the two CRM / Marketing switches. Those wrote LaundryBusinessFeature
// rows directly; this writes through /api/laundry/licensing, which is the same
// engine the sidebar, Navigation Manager, Roles & Permissions and the API
// guards read. One configuration, no second switch to keep in step.
//
// Self-hides for a business with no Laundry workspace, so the wizard can render
// it unconditionally.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Boxes, Loader2, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { FeatureSelector } from "@/components/admin/laundry/feature-selector"
import { hasAnySelection, NO_MODULES_SELECTED, licensableGroups } from "@/lib/laundry-licensing"

interface Snapshot { enabledScreens: string[] }

export function LaundryLicensingCard({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [isLaundry, setIsLaundry] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [baseline, setBaseline] = useState<string>("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laundry/licensing?businessId=${encodeURIComponent(businessId)}`)
      if (!res.ok) { setIsLaundry(false); return }
      const j = await res.json()
      if (!j.success) { setIsLaundry(false); return }
      setIsLaundry(true)
      const screens: string[] = (j.data as Snapshot).enabledScreens || []
      setSelected(new Set(screens))
      setBaseline(JSON.stringify([...screens].sort()))
    } catch {
      setIsLaundry(false)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { load() }, [load])

  if (!loading && !isLaundry) return null

  const dirty = JSON.stringify([...selected].sort()) !== baseline
  const total = licensableGroups().reduce((n, g) => n + g.screens.length, 0)

  const save = async () => {
    if (!hasAnySelection(selected)) { toast({ title: NO_MODULES_SELECTED, variant: "destructive" }); return }
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/licensing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, screenKeys: [...selected] }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Could not save")
      setBaseline(JSON.stringify([...selected].sort()))
      toast({ title: "Licence saved", description: `${selected.size} of ${total} screens enabled` })
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not save", variant: "destructive" })
    } finally { setSaving(false) }
  }

  return (
    <Card className="p-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Boxes className="h-4 w-4 text-blue-600" /> Business Features
          <span className="text-[11px] font-normal text-muted-foreground">{selected.size} / {total} screens</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Drives the sidebar, Navigation Manager, Roles &amp; Permissions and the APIs. Disabling a module hides and refuses it —
          it never deletes data, so re-enabling brings the tenant&apos;s orders, leads and history back untouched.
        </p>

        {loading ? (
          <div className="py-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
        ) : (
          <>
            <FeatureSelector value={selected} onChange={setSelected} disabled={saving} />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={saving || !dirty || !hasAnySelection(selected)} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save licence
              </Button>
              {dirty && <span className="text-[11px] text-amber-600">Unsaved changes</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
