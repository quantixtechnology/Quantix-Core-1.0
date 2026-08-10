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
import { getAuthHeaders } from "@/lib/admin-fetch"

interface Snapshot { enabledScreens: string[] }

export function LaundryLicensingCard({ businessId }: { businessId: string }) {
  const { toast } = useToast()
  const [isLaundry, setIsLaundry] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [baseline, setBaseline] = useState<string>("")
  const [authError, setAuthError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // getAuthHeaders() attaches the platform Bearer token. A raw fetch() here
      // is what made saving fail with "Not authenticated" while reading
      // appeared to work — read and write must use the same client.
      const res = await fetch(`/api/laundry/licensing?businessId=${encodeURIComponent(businessId)}`, { headers: getAuthHeaders() })
      // 404 means "not a laundry business" — self-hide, which is why callers
      // may render this unconditionally. An auth failure is NOT that: hiding it
      // turns a fixable problem into a card that mysteriously is not there, so
      // it surfaces instead.
      if (res.status === 401 || res.status === 403) {
        setIsLaundry(true)
        setAuthError((await res.json().catch(() => ({}))).error || "Not authorised to view this licence")
        return
      }
      if (!res.ok) { setIsLaundry(false); return }
      const j = await res.json()
      if (!j.success) { setIsLaundry(false); return }
      setIsLaundry(true)
      setAuthError(null)
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

  // Revert to the last saved licence without a reload.
  const reset = () => setSelected(new Set(JSON.parse(baseline || "[]") as string[]))

  const save = async () => {
    if (!hasAnySelection(selected)) { toast({ title: NO_MODULES_SELECTED, variant: "destructive" }); return }
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/licensing", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ businessId, screenKeys: [...selected] }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Could not save")
      // Re-seed from the SERVER's answer rather than assuming the request
      // stuck: the save response carries the persisted snapshot, so what the
      // page shows next is what a reload would show.
      const persisted: string[] = j.data?.enabledScreens ?? [...selected]
      setSelected(new Set(persisted))
      setBaseline(JSON.stringify([...persisted].sort()))
      toast({ title: "✓ Licence updated successfully", description: `${persisted.length} of ${total} screens enabled` })
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

        {authError ? (
          <p className="text-xs text-rose-700 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2">
            {authError}. Sign in again, or ask a platform administrator to grant Workspace Settings access.
          </p>
        ) : loading ? (
          <div className="py-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
        ) : (
          <>
            <FeatureSelector value={selected} onChange={setSelected} disabled={saving} />

            {/* Sticky action bar — the module grid is long, and a save button
                that scrolls away is a save that does not get pressed. It
                appears only when there is something to save, so it never sits
                over the content for no reason. */}
            {dirty && (
              <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 border-t border-slate-200 bg-white/95 backdrop-blur px-6 py-3 flex items-center gap-3">
                <span className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
                </span>
                <span className="text-[11px] text-muted-foreground">{selected.size} / {total} screens enabled</span>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={reset} disabled={saving}>Cancel</Button>
                  <Button size="sm" onClick={save} disabled={saving || !hasAnySelection(selected)} className="gap-1.5">
                    {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
