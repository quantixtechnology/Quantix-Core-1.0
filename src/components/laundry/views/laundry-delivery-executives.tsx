"use client"

// Delivery Executives (Admin) — the dedicated operational master for field
// pickup/delivery staff. Enterprise controls: create/edit, reset password (random
// or manual + force-change), copy/WhatsApp credentials, lock/unlock, force
// logout, archive/restore, plus login-attempt + reset-history audit. Backed by
// the existing auth User (no change to the platform auth system).
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Loader2, Plus, Pencil, Bike, Search, Copy, MoreHorizontal, KeyRound, MessageCircle, Lock, Unlock, LogOut, Archive, RotateCcw, ShieldAlert, History, Power, PowerOff, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { LaundryImageUpload } from "./pricing/laundry-image-upload"
import { AppShareCard } from "@/components/laundry/apps/app-share-card"
import { CopyButton } from "@/components/ui/copy-button"

interface Store { id: string; storeName: string }
interface Exec {
  id: string; employeeCode: string; name: string; mobile: string
  storeId: string | null; storeName: string | null; canReject: boolean; vehicleType: string | null
  vehicleNumber: string | null; photo: string | null
  isActive: boolean; availability: string; currentStatus: string | null
  isLocked: boolean; lockedUntil: string | null; failedAttempts: number
  lastLoginIp: string | null; lastLoginDevice: string | null; lastLoginAt: string | null; archivedAt: string | null
  todaysPickups: number; todaysDeliveries: number
}
const VEHICLES = ["BIKE", "SCOOTER", "CAR", "VAN", "CYCLE"]
const EMPTY = { name: "", mobile: "", employeeCode: "", storeId: "", vehicleType: "", vehicleNumber: "", photo: "", password: "", isActive: true, canReject: true }
const fmtLogin = (s: string | null) => s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"
const waMessage = (business: string, name: string, code: string, mobile: string, appUrl: string, password?: string) =>
  `Welcome to ${business}, ${name}.\n\nUsername (Mobile Number):\n${mobile}\n\nEmployee Code:\n${code}\n${password ? `\nTemporary Password:\n${password}\n` : ""}\nLogin URL\n${appUrl}\n\nPlease change this password when you first sign in.`

export function LaundryDeliveryExecutives() {
  const { currentBusinessId, user } = useAuthStore()
  const businessName = user?.businessName || "Laundry"
  const [items, setItems] = useState<Exec[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Exec | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [resetExec, setResetExec] = useState<Exec | null>(null)
  const [detailExec, setDetailExec] = useState<Exec | null>(null)
  const set = (k: keyof typeof EMPTY, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))

  const [origin, setOrigin] = useState("")
  const [execUrl, setExecUrl] = useState<string | null>(null)
  useEffect(() => { setOrigin(window.location.origin) }, [])
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/app-urls?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => { if (j.success && j.data?.executiveUrl) setExecUrl(j.data.executiveUrl) }).catch(() => {})
  }, [currentBusinessId])
  // Dedicated per-tenant executive host; origin fallback only until provisioned.
  const appUrl = execUrl || (origin ? `${origin}/laundry/executive` : "")

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/delivery-executives?businessId=${currentBusinessId}`).then((r) => r.json())
      if (j.success) { setItems(j.data); setStores(j.stores || []) }
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setOpen(true) }
  const openEdit = (e: Exec) => { setEditing(e); setForm({ name: e.name, mobile: e.mobile, employeeCode: e.employeeCode, storeId: e.storeId || "", vehicleType: e.vehicleType || "", vehicleNumber: e.vehicleNumber || "", photo: e.photo || "", password: "", isActive: e.isActive, canReject: e.canReject }); setOpen(true) }

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return }
    if (!form.mobile.trim()) { toast.error("Mobile is required"); return }
    setSaving(true)
    try {
      const url = editing ? `/api/laundry/delivery-executives/${editing.id}` : "/api/laundry/delivery-executives"
      const payload = editing
        ? { businessId: currentBusinessId, name: form.name, mobile: form.mobile, canReject: form.canReject, storeId: form.storeId || null, vehicleType: form.vehicleType || null, vehicleNumber: form.vehicleNumber || null, photo: form.photo || null, isActive: form.isActive }
        : { businessId: currentBusinessId, name: form.name, mobile: form.mobile, canReject: form.canReject, storeId: form.storeId || null, vehicleType: form.vehicleType || null, vehicleNumber: form.vehicleNumber || null, photo: form.photo || null, password: form.password || undefined, isActive: form.isActive }
      const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Save failed")
      if (!editing && j.data?.tempPassword) toast.success(`Executive ${j.data.employeeCode} created · password: ${j.data.tempPassword}`, { duration: 12000 })
      else toast.success("Saved")
      setOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  const act = async (e: Exec, action: string, extra: Record<string, unknown> = {}) => {
    try {
      const res = await fetch(`/api/laundry/delivery-executives/${e.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, action, ...extra }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Action failed")
      return j
    } catch (err) { toast.error(err instanceof Error ? err.message : "Action failed"); return null }
  }
  const toggleActive = async (e: Exec) => { await fetch(`/api/laundry/delivery-executives/${e.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, isActive: !e.isActive }) }); load() }
  const lock = async (e: Exec) => { if (await act(e, e.isLocked ? "unlock" : "lock")) { toast.success(e.isLocked ? "Unlocked" : "Locked"); load() } }
  const forceLogout = async (e: Exec) => { const j = await act(e, "force-logout"); if (j) toast.success(`Logged out of ${j.revoked || 0} device(s)`) }
  const archive = async (e: Exec) => { if (!confirm(`Archive ${e.name}? They keep all history and can be restored later.`)) return; if (await act(e, "archive")) { toast.success("Archived"); load() } }
  const restore = async (e: Exec) => { if (await act(e, "restore")) { toast.success("Restored"); load() } }
  // Hard delete is refused server-side when the executive appears on any order,
  // so their pickup/delivery history can never be silently lost.
  const remove = async (e: Exec) => {
    if (!confirm(`Delete ${e.name} permanently?\n\nThis removes the executive and their login. It is only possible when they have no pickup or delivery history — otherwise deactivate or archive them instead.`)) return
    if (await act(e, "delete")) { toast.success(`${e.name} deleted`); load() }
  }

  // Everything an executive needs to sign in, in the order they need it. The
  // username is their MOBILE NUMBER — internal user ids are never surfaced.
  // Without a password in hand the admin is told to generate one rather than
  // handing over a half-complete credential.
  const credentialsText = (e: Exec, password?: string) => [
    `Delivery Executive: ${e.name}`,
    `Username (Mobile Number): ${e.mobile}`,
    `Employee Code: ${e.employeeCode}`,
    password ? `Temporary Password: ${password}` : "Temporary Password: use \u201CGenerate Temporary Password\u201D to create one",
    `Login URL: ${appUrl}`,
    "",
    "Note: you must change this password when you first sign in.",
  ].join("\n")

  const copyCreds = async (e: Exec, password?: string) => {
    try { await navigator.clipboard.writeText(credentialsText(e, password)); toast.success("Credentials copied") } catch { toast.error("Could not copy") }
  }
  const whatsapp = (e: Exec, password?: string) => {
    const digits = e.mobile.replace(/\D/g, "")
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(waMessage(businessName, e.name, e.employeeCode, e.mobile, appUrl, password))}`, "_blank")
  }

  const filtered = items.filter((e) => {
    if (showArchived ? !e.archivedAt : !!e.archivedAt) return false
    const q = search.trim().toLowerCase()
    return !q || e.name.toLowerCase().includes(q) || e.mobile.includes(q) || e.employeeCode.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Bike className="h-5 w-5 text-blue-600" /> Delivery Executives</h2>
          <p className="text-sm text-muted-foreground">Field pickup &amp; delivery staff. Only these accounts can log into the Pickup &amp; Delivery PWA.</p>
        </div>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={openNew}><Plus className="h-3.5 w-3.5" /> New Executive</Button>
      </div>

      {appUrl && (
        <AppShareCard title="Executive App" description="Share this link with your delivery executives to install their branded app." icon={<Bike className="h-5 w-5" />} url={appUrl} note="Executives sign in with their mobile number + password. The business is set automatically from this link." />
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search name, mobile, code…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived</label>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        : filtered.length === 0 ? <div className="text-center py-16 text-sm text-muted-foreground">{showArchived ? "No archived executives." : "No delivery executives yet. Create one to start assigning pickups."}</div>
        : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Mobile</TableHead><TableHead>Store</TableHead>
              <TableHead>Today</TableHead><TableHead>Last Login</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>{filtered.map((e) => (
              <TableRow key={e.id} className={e.isActive ? "" : "opacity-60"}>
                <TableCell className="font-mono text-xs text-muted-foreground">{e.employeeCode}</TableCell>
                <TableCell className="font-medium">{e.name}{e.vehicleType && <span className="ml-1.5 text-[10px] text-muted-foreground">{e.vehicleType}{e.vehicleNumber ? ` ${e.vehicleNumber}` : ""}</span>}</TableCell>
                <TableCell className="text-sm">{e.mobile}</TableCell>
                <TableCell>{e.storeName ? <Badge variant="outline">{e.storeName}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{e.todaysPickups}P · {e.todaysDeliveries}D</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtLogin(e.lastLoginAt)}{e.failedAttempts > 0 && <span className="ml-1 text-rose-500">· {e.failedAttempts} fail</span>}</TableCell>
                <TableCell>
                  {e.archivedAt ? <Badge variant="outline" className="border-slate-300 text-slate-400">Archived</Badge>
                  : e.isLocked ? <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50 gap-0.5"><Lock className="h-3 w-3" />Locked</Badge>
                  : <Switch checked={e.isActive} onCheckedChange={() => toggleActive(e)} />}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setResetExec(e)}><KeyRound className="h-3.5 w-3.5" /> Generate Temp Password</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetExec(e)}><KeyRound className="h-4 w-4" /> Generate Temporary Password</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyCreds(e)}><Copy className="h-4 w-4" /> Copy Credentials</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(e)}>
                          {e.isActive ? <><PowerOff className="h-4 w-4" /> Deactivate</> : <><Power className="h-4 w-4" /> Activate</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600" onClick={() => remove(e)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => whatsapp(e)}><MessageCircle className="h-4 w-4" /> WhatsApp</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDetailExec(e)}><History className="h-4 w-4" /> Login &amp; History</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => lock(e)}>{e.isLocked ? <><Unlock className="h-4 w-4" /> Unlock</> : <><Lock className="h-4 w-4" /> Lock</>}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => forceLogout(e)}><LogOut className="h-4 w-4" /> Force Logout</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {e.archivedAt
                          ? <DropdownMenuItem onClick={() => restore(e)}><RotateCcw className="h-4 w-4" /> Restore</DropdownMenuItem>
                          : <DropdownMenuItem onClick={() => archive(e)}><Archive className="h-4 w-4" /> Archive</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Executive" : "New Delivery Executive"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Rahul Kumar" /></div>
              <div><Label>Mobile *</Label><Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="9876543210" /></div>
              {/* System-issued from the Business Code — never typed, or an
                  admin could place staff in another tenant's namespace. */}
              <div>
                <Label>Employee ID</Label>
                <Input
                  value={editing ? form.employeeCode : ""}
                  readOnly disabled
                  placeholder="Generated on save"
                  className="bg-slate-50 font-mono text-sm"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {editing ? "Permanent — never changes or is reused." : "Generated automatically from your business initial and Business Code."}
                </p>
              </div>
              <div><Label>Assigned Store</Label>
                <select value={form.storeId} onChange={(e) => set("storeId", e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-2 text-sm bg-white"><option value="">—</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.storeName}</option>)}</select>
              </div>
              <div><Label>Vehicle Type</Label>
                <select value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-2 text-sm bg-white"><option value="">—</option>{VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}</select>
              </div>
              <div><Label>Vehicle Number</Label><Input value={form.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)} placeholder="KA01AB1234" /></div>
              <div className="col-span-2 space-y-1"><Label>Profile Photo (optional)</Label>
                {currentBusinessId && <LaundryImageUpload value={form.photo || null} businessId={currentBusinessId} folder="laundry-executives" onChange={(url) => set("photo", url || "")} />}
              </div>
              {!editing && <div className="col-span-2"><Label>Login Password</Label><Input value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Leave blank to auto-generate" /></div>}
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} /> Active</label>
            <div><Label className="text-xs">Can Reject?</Label><div className="flex gap-4 mt-1"><label className="flex items-center gap-1.5 text-sm"><input type="radio" name="canReject" checked={form.canReject} onChange={() => set("canReject", true)} className="accent-blue-600" /> Yes</label><label className="flex items-center gap-1.5 text-sm"><input type="radio" name="canReject" checked={!form.canReject} onChange={() => set("canReject", false)} className="accent-blue-600" /> No</label></div></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resetExec && <ResetPasswordDialog exec={resetExec} businessId={currentBusinessId!} businessName={businessName} appUrl={appUrl} onCopyCreds={copyCreds} onWhatsapp={whatsapp} onClose={() => { setResetExec(null); load() }} />}
      {detailExec && <DetailsDialog exec={detailExec} businessId={currentBusinessId!} onClose={() => setDetailExec(null)} />}
    </div>
  )
}

// ── Generate Temporary Password (random or manual; force-change ON by default) ──
function ResetPasswordDialog({ exec, businessId, businessName, appUrl, onCopyCreds, onWhatsapp, onClose }: { exec: Exec; businessId: string; businessName: string; appUrl: string; onCopyCreds: (e: Exec, p?: string) => void; onWhatsapp: (e: Exec, p?: string) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"random" | "manual">("random")
  const [pw, setPw] = useState("")
  const [confirm, setConfirm] = useState("")
  const [force, setForce] = useState(true)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const submit = async () => {
    if (mode === "manual") {
      if (pw.length < 6) { toast.error("Password must be at least 6 characters"); return }
      if (pw !== confirm) { toast.error("Passwords do not match"); return }
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/laundry/delivery-executives/${exec.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, action: "reset-password", password: mode === "manual" ? pw : undefined, forceChange: force, reason: reason || undefined }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Reset failed")
      setResult(j.tempPassword)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Reset failed") } finally { setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-amber-600" /> Generate Temporary Password · {exec.name}</DialogTitle></DialogHeader>
        {result ? (
          /* ONE-TIME REVEAL. The password is held only in this component's state
             and is never persisted or returned by any read endpoint — closing
             the dialog discards it for good, so the admin has to hand it over
             (or copy it) now. A forgotten password means generating a new one. */
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2.5">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span className="text-emerald-700/80">Username (Mobile)</span>
                <span className="font-mono font-semibold text-emerald-900">{exec.mobile}</span>
                <span className="text-emerald-700/80">Employee Code</span>
                <span className="font-mono font-semibold text-emerald-900">{exec.employeeCode}</span>
              </div>
              <div className="border-t border-emerald-200 pt-2.5 text-center">
                <p className="text-xs text-emerald-700">Temporary password</p>
                <p className="text-2xl font-mono font-bold text-emerald-800 tracking-wider mt-1">{result}</p>
                {force && <p className="text-[11px] text-emerald-600 mt-1">Executive must change it on first login.</p>}
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
              Shown once. Copy or send it now — after closing it cannot be retrieved, only replaced by generating a new one.
            </p>
            <div className="flex gap-2">
              <CopyButton value={result} label="Password" variant="outline" size="default" className="flex-1">Copy Password</CopyButton>
              <Button variant="outline" className="flex-1 gap-1" onClick={() => onCopyCreds(exec, result)}><Copy className="h-4 w-4" /> Copy Credentials</Button>
            </div>
            <Button className="w-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onWhatsapp(exec, result)}><MessageCircle className="h-4 w-4" /> Send WhatsApp</Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setMode("random")} className={`flex-1 h-10 rounded-lg text-sm border ${mode === "random" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>Generate random</button>
              <button onClick={() => setMode("manual")} className={`flex-1 h-10 rounded-lg text-sm border ${mode === "manual" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>Set manually</button>
            </div>
            {mode === "manual" && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">New Password</Label><Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min 6 chars" /></div>
                <div><Label className="text-xs">Confirm</Label><Input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
              </div>
            )}
            <div><Label className="text-xs">Reason (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot password" /></div>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"><span>Force change on next login</span><Switch checked={force} onCheckedChange={setForce} /></label>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={busy} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Generate Temporary Password</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Login attempts + password reset history ──
interface Detail { isLocked: boolean; lockedUntil: string | null; failedAttempts: number; lastLoginIp: string | null; lastLoginDevice: string | null; lastLoginAt: string | null; mustChangePassword: boolean; resets: { id: string; adminName: string | null; mode: string; forceChange: boolean; reason: string | null; createdAt: string }[] }
function DetailsDialog({ exec, businessId, onClose }: { exec: Exec; businessId: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  useEffect(() => { fetch(`/api/laundry/delivery-executives/${exec.id}?businessId=${businessId}`).then((r) => r.json()).then((j) => { if (j.success) setD(j.data) }).catch(() => {}) }, [exec.id, businessId])
  const Row = ({ label, value }: { label: string; value: string }) => (<div className="flex justify-between py-1.5 border-b border-slate-50 text-sm"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-700 text-right">{value}</span></div>)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-slate-500" /> {exec.name} · Login &amp; History</DialogTitle></DialogHeader>
        {!d ? <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-slate-400" /></div> : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Login attempts</p>
              <Row label="Last Login" value={fmtLogin(d.lastLoginAt)} />
              <Row label="Failed Attempts" value={String(d.failedAttempts)} />
              <Row label="Locked" value={d.isLocked ? "Yes (manual)" : d.lockedUntil ? `Until ${fmtLogin(d.lockedUntil)}` : "No"} />
              <Row label="Device" value={d.lastLoginDevice ? d.lastLoginDevice.slice(0, 40) + (d.lastLoginDevice.length > 40 ? "…" : "") : "—"} />
              <Row label="IP Address" value={d.lastLoginIp || "—"} />
              <Row label="Must change password" value={d.mustChangePassword ? "Yes" : "No"} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Password reset history</p>
              {d.resets.length === 0 ? <p className="text-sm text-slate-400 py-2">No resets yet.</p> : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {d.resets.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                      <div className="flex justify-between"><span className="font-medium text-slate-700">{new Date(r.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span><Badge variant="outline" className="text-[9px]">{r.mode}</Badge></div>
                      <p className="text-slate-500 mt-0.5">By {r.adminName || "Admin"}{r.forceChange ? " · force change" : ""}{r.reason ? ` · ${r.reason}` : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
