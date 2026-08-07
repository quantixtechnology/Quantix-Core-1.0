"use client"

// Laundry Workspace Settings → Store Availability + Working Hours.
// Backed by the platform Store/StoreTiming records (shared with the storefront
// website, customer PWA and customer app). Supports:
//   • Store selector — per-branch custom schedule (businessHoursOverride)
//   • Business Standard Schedule — the default timing for all stores
//   • Super Admin / Business Owner override — Force Open / Force Closed / Automatic
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save, Store as StoreIcon, Clock, Info, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface TimingRow { day: number; open: string; close: string; isClosed: boolean }
interface StoreRef { id: string; storeName: string; storeCode: string | null; isActive: boolean }

const DAY_ROWS: { day: number; name: string }[] = [
  { day: 1, name: "Monday" },
  { day: 2, name: "Tuesday" },
  { day: 3, name: "Wednesday" },
  { day: 4, name: "Thursday" },
  { day: 5, name: "Friday" },
  { day: 6, name: "Saturday" },
  { day: 0, name: "Sunday" },
]

const defaultTimings = (): TimingRow[] =>
  DAY_ROWS.map(({ day }) => ({ day, open: "09:00", close: "21:00", isClosed: false }))

function isOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false
  return ["QUANTIX_SUPER_ADMIN", "PLATFORM_ADMIN", "CLIENT_OWNER", "LAUNDRY_OWNER"].includes(role)
}

const toLocalInput = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(ist.getUTCDate())}T${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}`
}

// Local datetime-local string → ISO (UTC). Empty input → null.
const fromLocalInput = (v: string): string | null => {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return new Date(d.getTime() - 5.5 * 60 * 60 * 1000).toISOString()
}

export function LaundryAvailabilitySettingsForm({ businessId }: { businessId: string }) {
  const { user } = useAuthStore()
  const canOverride = isOwnerRole(user?.role)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stores, setStores] = useState<StoreRef[]>([])
  const [storeId, setStoreId] = useState<string>("")
  const [status, setStatus] = useState<"open" | "closed">("open")
  const [reason, setReason] = useState("")
  const [closedUntil, setClosedUntil] = useState("")
  const [timings, setTimings] = useState<TimingRow[]>(defaultTimings())
  const [override, setOverride] = useState<"AUTOMATIC" | "FORCE_OPEN" | "FORCE_CLOSED">("AUTOMATIC")
  const [overrideExpiresAt, setOverrideExpiresAt] = useState("")
  const [hasStandard, setHasStandard] = useState(false)
  const [savedAt, setSavedAt] = useState<{ status: string; reason: string | null; until: string | null; hours: string | null } | null>(null)

  const load = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const q = storeId ? `?businessId=${encodeURIComponent(businessId)}&storeId=${encodeURIComponent(storeId)}` : `?businessId=${encodeURIComponent(businessId)}`
      const j = await fetch(`/api/laundry/availability${q}`).then((r) => r.json())
      if (j.success) {
        const d = j.data
        const storeList: StoreRef[] = Array.isArray(d.stores) ? d.stores : []
        setStores(storeList)
        setHasStandard(Array.isArray(d.standard?.timings) && d.standard.timings.length > 0)

        // Auto-select the first store (or keep the current one)
        if (!storeId && storeList.length > 0) {
          setStoreId(storeList[0].id)
        }

        const closed = !!d.closedReason || !!d.closedUntil
        setStatus(closed ? "closed" : "open")
        setReason(d.closedReason || "")
        setClosedUntil(d.closedUntil ? toLocalInput(d.closedUntil) : "")
        setOverride(d.statusOverride || "AUTOMATIC")
        setOverrideExpiresAt(d.overrideExpiresAt ? toLocalInput(d.overrideExpiresAt) : "")

        if (Array.isArray(d.timings) && d.timings.length > 0) {
          setTimings(DAY_ROWS.map(({ day }) => {
            const t = d.timings.find((x: { day: number }) => x.day === day)
            return { day, open: t?.openTime || "09:00", close: t?.closeTime || "21:00", isClosed: !!t?.isClosed }
          }))
        }
      }
    } catch { /* keep defaults */ } finally { setLoading(false) }
  }, [businessId, storeId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!businessId) return
    if (!storeId && stores.length > 0) { toast.error("Select a store first"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          storeId: storeId || undefined,
          availability: {
            status,
            reason: status === "closed" ? reason : null,
            closedUntil: status === "closed" && closedUntil ? closedUntil : null,
          },
          timings,
          branchTimings: timings,
          statusOverride: canOverride ? override : "AUTOMATIC",
          overrideExpiresAt: canOverride ? fromLocalInput(overrideExpiresAt) : null,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Save failed")
      const a = j.data.availability
      setSavedAt({
        status: a?.isOpen ? "open" : "closed",
        reason: a?.closedReason || null,
        until: a?.closedUntil || null,
        hours: a?.businessHours || null,
      })
      toast.success("Store availability saved")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const applyStandard = async () => {
    if (!storeId) { toast.error("Select a store first"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/laundry/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, storeId, applyStandardSchedule: true }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed to apply standard schedule")
      toast.success("Standard schedule applied to this store")
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600"><StoreIcon className="h-4 w-4" /></div>
          <div>
            <CardTitle className="text-sm">Store Availability &amp; Working Hours</CardTitle>
            <p className="text-xs text-muted-foreground">
              Controls the Laundry Storefront Website, Customer App and Pickup / Delivery scheduling. Admin access is never blocked.
            </p>
          </div>
          <Button onClick={save} disabled={saving || loading} className="ml-auto gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-6 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading…</div>
        ) : (
          <>
            {/* ── Store selector ──────────────────────────────────────────── */}
            {stores.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <Label className="text-xs text-slate-500">Store / Branch</Label>
                <select
                  value={storeId}
                  onChange={(e) => { setStoreId(e.target.value); setSavedAt(null) }}
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName}{s.storeCode ? ` (${s.storeCode})` : ""}{s.isActive ? "" : " — inactive"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Each branch can have its own custom schedule. The Business Standard Schedule below is the default applied to all stores.
                </p>
              </div>
            )}

            {/* ── Store Availability ─────────────────────────────────────── */}
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Store Availability</p>
                  <p className="text-xs text-slate-400">Open Store, or Temporarily Closed with an optional reason and re-open time.</p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {status === "open" ? "Open" : "Temporarily Closed"}
                </div>
              </div>

              <div className="flex gap-3">
                {(["open", "closed"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer ${status === s ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {s === "open" ? "Open Store" : "Temporarily Closed"}
                  </button>
                ))}
              </div>

              {status === "closed" && (
                <div className="space-y-3 rounded-lg bg-rose-50/50 border border-rose-100 p-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-rose-700">Reason (optional)</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Closed for maintenance, Festival Holiday, Weekly Off, Emergency Closure" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-rose-700">Closed Until (optional)</Label>
                    <Input type="datetime-local" value={closedUntil} onChange={(e) => setClosedUntil(e.target.value)} className="h-9" />
                    <p className="text-[11px] text-slate-400">When empty, the store stays closed until you switch it back to Open.</p>
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    While closed, the website stays up (services, prices, plans and promotions stay visible) — only booking is disabled.
                  </div>
                </div>
              )}
            </div>

            {/* ── Standard Schedule (Business default for all stores) ─────── */}
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">Standard Schedule</p>
                </div>
                <Button variant="outline" size="sm" onClick={applyStandard} disabled={saving || !storeId} className="gap-1">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Apply to this store
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                {hasStandard
                  ? "The business-wide default working hours applied to every store unless a branch overrides them."
                  : "No standard schedule set yet. Use the Weekly Schedule below and Save to establish the business default."}
              </p>
            </div>

            {/* ── Working Hours / Weekly Schedule (per selected store) ─────── */}
            <div className="rounded-lg border border-slate-200 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">Working Hours — {stores.find((s) => s.id === storeId)?.storeName || "Weekly Schedule"}</p>
              </div>
              <p className="text-xs text-slate-400">Pickup and delivery dates/slots outside these hours are not offered to customers. Saving here sets this branch's custom schedule.</p>
              <div className="space-y-1.5">
                {DAY_ROWS.map(({ day, name }) => {
                  const t = timings.find((x) => x.day === day)!
                  const update = (patch: Partial<TimingRow>) => setTimings((prev) => prev.map((x) => (x.day === day ? { ...x, ...patch } : x)))
                  return (
                    <div key={day} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                      <span className="w-24 text-sm font-medium text-slate-700">{name}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.isClosed ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{t.isClosed ? "Closed" : "Open"}</span>
                      <Input type="time" value={t.open} disabled={t.isClosed} onChange={(e) => update({ open: e.target.value })} className="ml-auto h-8 w-28" />
                      <span className="text-xs text-slate-400">to</span>
                      <Input type="time" value={t.close} disabled={t.isClosed} onChange={(e) => update({ close: e.target.value })} className="h-8 w-28" />
                      <Switch checked={!t.isClosed} onCheckedChange={(v) => update({ isClosed: !v })} aria-label={`Toggle ${name}`} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Super Admin / Owner override ───────────────────────────── */}
            <div className={`rounded-lg border p-4 space-y-2 ${canOverride ? "border-amber-200 bg-amber-50/40" : "border-slate-200 opacity-70"}`}>
              <div className="flex items-center gap-2">
                <ShieldAlert className={`h-4 w-4 ${canOverride ? "text-amber-500" : "text-slate-400"}`} />
                <p className="text-sm font-semibold text-slate-700">Operator Override (Testing)</p>
              </div>
              <p className="text-xs text-slate-500">
                {canOverride
                  ? "Force the store open or closed regardless of business hours. Intended for testing the storefront and Google Maps outside business hours."
                  : "Only the Quantix Super Admin or the Business Owner can override store open/closed status."}
              </p>
              {canOverride && (
                <div className="space-y-3 pt-1">
                  <div className="flex gap-3">
                    {(["AUTOMATIC", "FORCE_OPEN", "FORCE_CLOSED"] as const).map((o) => (
                      <button key={o} type="button" onClick={() => setOverride(o)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer ${override === o ? (o === "FORCE_OPEN" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : o === "FORCE_CLOSED" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-blue-500 bg-blue-50 text-blue-700") : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                        {o === "AUTOMATIC" ? "Automatic" : o === "FORCE_OPEN" ? "Force Open" : "Force Closed"}
                      </button>
                    ))}
                  </div>
                  {override !== "AUTOMATIC" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Auto-expire (optional)</Label>
                      <Input type="datetime-local" value={overrideExpiresAt} onChange={(e) => setOverrideExpiresAt(e.target.value)} className="h-8" />
                      <p className="text-[11px] text-slate-400">Leave empty to keep the override until changed back to Automatic.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Current state preview */}
            {savedAt && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                {savedAt.status === "open"
                  ? "Store is currently Open."
                  : <>Store is currently closed{savedAt.reason ? <> — {savedAt.reason}</> : ""}{savedAt.until ? <> · reopens {new Date(savedAt.until).toLocaleString("en-IN")}</> : ""}.</>}
                {savedAt.hours ? <> Today&apos;s hours: <b>{savedAt.hours}</b>.</> : null}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
