"use client"

// Delivery Executive PWA — the operational interface for field pickups. The
// Admin remains the control center; this only executes assigned jobs and reports
// live field status back to the SAME order/timeline. Reuses the Universal Bag
// Scanner + the shared bag-assignment engine. Mobile-first, single-page.
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { Loader2, MapPin, Navigation, LogOut, User, Package, Zap, CheckCircle2, ChevronLeft, Bike, Phone, Download, Share, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { DeliveryPromiseCard, DeliveryPromiseUrgency, DeliveryPromiseBadge } from "@/components/laundry/delivery-promise"
import type { DeliveryPromiseInput } from "@/lib/laundry-delivery-promise"

const TOKEN_KEY = "qx_exec_token"

interface Brand { name: string; logo: string | null; color: string }
const DEFAULT_BRAND: Brand = { name: "Pickup & Delivery", logo: null, color: "#2563EB" }

// Install-as-PWA CTA. Installing gives a standalone app context — camera/scanner
// permissions persist properly, unlike an incognito-ish browser tab. Reuses the
// platform usePwaInstall hook + service worker (no separate PWA framework).
function InstallCta({ color, variant = "light" }: { color: string; variant?: "light" | "onColor" }) {
  const { canInstall, isInstalled, isIos, install } = usePwaInstall({ ignoreDismiss: true })
  const [help, setHelp] = useState(false)
  if (isInstalled) return null

  const onClick = async () => {
    if (isIos) { setHelp(true); return }
    const ok = await install()
    if (!ok && !canInstall) setHelp(true)
  }
  const onColor = variant === "onColor"
  return (
    <>
      <button onClick={onClick} className="w-full h-11 rounded-xl font-medium flex items-center justify-center gap-2 border"
        style={onColor ? { background: "rgba(255,255,255,0.15)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" } : { color, borderColor: color }}>
        <Download className="h-4 w-4" /> Install App
      </button>
      {help && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setHelp(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold text-slate-800 flex items-center gap-2"><Download className="h-4 w-4" /> Install this app</p>
            {isIos ? (
              <p className="text-sm text-slate-600 flex items-start gap-2"><Share className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" /> In Safari, tap the <b>Share</b> icon, then <b>Add to Home Screen</b>. Open it from your home screen for camera scanning.</p>
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                {/* Chrome hides Install for an app it has ALREADY installed, so
                    the menu item people are told to look for is not there. Say
                    that first — it is the most common reason to land here. */}
                <p><b>Already installed?</b> Open it from your home screen — Chrome hides the install option once the app is on your device.</p>
                <p>Otherwise open your browser menu (⋮ top-right) and tap <b>Install app</b> / <b>Add to Home screen</b>. The camera scanner works properly in the installed app.</p>
              </div>
            )}
            <button onClick={() => setHelp(false)} className="w-full h-10 rounded-xl text-white font-medium" style={{ backgroundColor: color }}>Got it</button>
          </div>
        </div>
      )}
    </>
  )
}

interface Exec {
  id: string; name: string; employeeCode: string; mobile: string; storeName: string | null
  vehicleType: string | null; vehicleNumber: string | null; photo: string | null; availability: string
  // Assignment permission from DeliveryExecutive.canReject — the ONE source of
  // truth for whether Reject is offered. Absent (older session payload) is
  // treated as NOT allowed, matching the server, which also fails closed.
  canReject?: boolean
}
interface Svc { serviceId: string | null; serviceName: string; bags: string[] }
interface Job {
  id: string; orderNumber: string; status: string; fieldStatus: string | null; acceptance: string | null; priority: string
  customerName: string; customerPhone: string | null; timeSlot: string | null
  address: string | null; landmark: string | null; mapsLink: string | null; lat: number | null; lng: number | null
  services: Svc[]; serviceCount: number; bagCount: number; assignedBags: number; itemCount: number
  deliveryBagNumber: string | null
  pickupVerificationMethod: string; deliveryVerificationMethod: string
  balanceDue: number; paymentStatus: string | null
  // Frozen customer promise — what the executive prioritises the round by.
  promisedDeliveryDate?: string | null; promisedDeliveryTimeSlot?: string | null
  promisedBackupDeliveryDate?: string | null; promisedBackupDeliveryTimeSlot?: string | null
  deliveryDate?: string | null; deliveryRescheduledAt?: string | null
  deliveryRescheduleReason?: string | null; deliveredAt?: string | null
}

const RANK: Record<string, number> = { ASSIGNED: 0, STARTED: 1, NAVIGATING: 2, REACHED: 3, PICKUP_STARTED: 4, PICKUP_COMPLETED: 5, OUT_FOR_DELIVERY: 6, DELIVERED: 7 }
const rank = (s: string | null) => RANK[s || "ASSIGNED"] ?? 0

async function execFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) } })
  return res
}

export function ExecutiveApp() {
  const [token, setToken] = useState<string | null>(null)
  const [exec, setExec] = useState<Exec | null>(null)
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    fetch("/api/laundry/executive/config").then((r) => r.json()).then((j) => {
      if (j.data) setBrand({ name: j.data.name || "Pickup & Delivery", logo: j.data.logo || null, color: j.data.primaryColor || "#2563EB" })
    }).catch(() => {})
    const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
    if (!t) { setBooting(false); return }
    execFetch("/api/laundry/executive/me", t).then((r) => r.json()).then((j) => {
      if (j.success) { setToken(t); setExec(j.data) } else { localStorage.removeItem(TOKEN_KEY) }
    }).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setBooting(false))
  }, [])

  const onLoggedIn = (t: string, e: Exec) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); setExec(e) }
  const logout = async () => {
    if (token) await execFetch("/api/laundry/executive/auth/logout", token, { method: "POST" }).catch(() => {})
    localStorage.removeItem(TOKEN_KEY); setToken(null); setExec(null)
  }

  if (booting) return <div className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin" style={{ color: brand.color }} /></div>
  if (!token || !exec) return <Login onLoggedIn={onLoggedIn} brand={brand} />
  return <Shell token={token} exec={exec} brand={brand} onLogout={logout} />
}

// ── Login ──
function Login({ onLoggedIn, brand }: { onLoggedIn: (t: string, e: Exec) => void; brand: Brand }) {
  const [mobile, setMobile] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch("/api/laundry/executive/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: mobile.trim(), password }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Login failed")
      onLoggedIn(j.data.token, j.data.executive)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Login failed") } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10" style={{ background: `linear-gradient(to bottom, ${brand.color}, ${brand.color}cc)` }}>
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center mb-8 text-white">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white grid place-items-center mb-3 overflow-hidden shadow-lg">
            {brand.logo ? <img src={brand.logo} alt={brand.name} className="h-16 w-16 object-contain" /> : <Bike className="h-8 w-8" style={{ color: brand.color }} />}
          </div>
          <h1 className="text-xl font-bold">{brand.name}</h1>
          <p className="text-white/80 text-sm mt-1">Pickup &amp; Delivery · Executive sign in</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl p-5 space-y-3 shadow-xl">
          <div>
            {/* Executives sign in with what they know — their mobile number or
                their employee code. Internal user IDs are never shown or used. */}
            <label className="text-xs font-medium text-slate-500">Mobile Number / Employee Code</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} autoCapitalize="characters" placeholder="9876543210 or EMP-001" className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••" className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <button disabled={busy} className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: brand.color }}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign In
          </button>
          <p className="text-[11px] text-slate-400 text-center pt-1">Accounts are created by your admin. No self-registration.</p>
        </form>
        <div className="mt-4"><InstallCta color={brand.color} variant="onColor" /></div>
        <p className="text-[11px] text-white/70 text-center mt-2">Install the app for reliable camera scanning.</p>
      </div>
    </div>
  )
}

// ── Shell (tabs + job list + detail + profile) ──
const TABS = [{ k: "pickup", l: "Pickups" }, { k: "delivery", l: "Deliveries" }, { k: "completed", l: "Completed" }, { k: "history", l: "History" }]

function Shell({ token, exec, brand, onLogout }: { token: string; exec: Exec; brand: Brand; onLogout: () => void }) {
  const [tab, setTab] = useState("pickup")
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [openJob, setOpenJob] = useState<Job | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  const [counts, setCounts] = useState<{ pickup: number; delivery: number }>({ pickup: 0, delivery: 0 })

  const load = useCallback(async (t = tab) => {
    setLoading(true)
    try {
      const j = await execFetch(`/api/laundry/executive/jobs?type=${t}`, token).then((r) => r.json())
      if (j.success) setJobs(j.data)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [tab, token])
  useEffect(() => { load(tab) }, [load, tab])

  // Pending pickup/delivery counts → tab badges. Polled so a newly ASSIGNED job
  // (e.g. a delivery just scheduled from the store) shows up as a notification
  // without the executive refreshing.
  const loadCounts = useCallback(async () => {
    try {
      const [pj, dj] = await Promise.all([
        execFetch(`/api/laundry/executive/jobs?type=pickup`, token).then((r) => r.json()).catch(() => ({})),
        execFetch(`/api/laundry/executive/jobs?type=delivery`, token).then((r) => r.json()).catch(() => ({})),
      ])
      setCounts({ pickup: pj.success ? pj.data.length : 0, delivery: dj.success ? dj.data.length : 0 })
    } catch { /* noop */ }
  }, [token])
  useEffect(() => {
    loadCounts()
    const fire = () => { if (typeof document === "undefined" || document.visibilityState !== "hidden") loadCounts() }
    const id = setInterval(fire, 20000)
    window.addEventListener("focus", fire)
    return () => { clearInterval(id); window.removeEventListener("focus", fire) }
  }, [loadCounts, jobs.length])

  if (showProfile) return <Profile exec={exec} brand={brand} onBack={() => setShowProfile(false)} onLogout={onLogout} />
  if (openJob) return <JobDetail token={token} exec={exec} brand={brand} kind={tab === "delivery" ? "delivery" : "pickup"} job={openJob} onBack={() => { setOpenJob(null); load() }} onChanged={load} />

  return (
    <div className="min-h-screen bg-slate-50 pb-6">
      <header className="text-white px-4 pt-4 pb-3 sticky top-0 z-10" style={{ backgroundColor: brand.color }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {brand.logo && <img src={brand.logo} alt="" className="h-8 w-8 rounded-lg bg-white object-contain shrink-0" />}
            <div className="min-w-0">
              <p className="text-[11px] text-white/70 truncate">{brand.name} · {exec.storeName || "Field Ops"}</p>
              <p className="font-semibold truncate">{exec.name}</p>
            </div>
          </div>
          <button onClick={() => setShowProfile(true)} className="h-10 w-10 rounded-full bg-white/15 grid place-items-center shrink-0">
            {exec.photo ? <img src={exec.photo} alt="" className="h-10 w-10 rounded-full object-cover" /> : <User className="h-5 w-5" />}
          </button>
        </div>
        <div className="mt-3 flex gap-1 bg-white/10 rounded-xl p-1">
          {TABS.map((t) => {
            const n = t.k === "pickup" ? counts.pickup : t.k === "delivery" ? counts.delivery : 0
            return (
              <button key={t.k} onClick={() => setTab(t.k)} className="relative flex-1 h-8 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1" style={tab === t.k ? { backgroundColor: "#fff", color: brand.color } : { color: "rgba(255,255,255,0.85)" }}>
                {t.l}
                {n > 0 && <span className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${tab === t.k ? "bg-red-500 text-white" : "bg-red-500 text-white"}`}>{n}</span>}
              </button>
            )
          })}
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {loading ? <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin text-blue-600 inline" /></div>
        : jobs.length === 0 ? <div className="py-16 text-center text-slate-400 text-sm">No {TABS.find((t) => t.k === tab)?.l.toLowerCase()} right now.</div>
        : jobs.map((job) => <JobCard key={job.id} job={job} onOpen={() => setOpenJob(job)} tab={tab} />)}
      </div>
    </div>
  )
}

function JobCard({ job, onOpen, tab }: { job: Job; onOpen: () => void; tab: string }) {
  const done = rank(job.fieldStatus) >= RANK.PICKUP_COMPLETED || tab === "completed" || tab === "history"
  return (
    <button onClick={onOpen} className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 active:scale-[0.99] transition">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-800">{job.orderNumber}</span>
            {job.priority === "EXPRESS" && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 flex items-center gap-0.5"><Zap className="h-3 w-3" />Express</span>}
            <DeliveryPromiseBadge order={job as DeliveryPromiseInput} />
          </div>
          <p className="text-sm text-slate-700 mt-0.5">{job.customerName}</p>
        </div>
        {done ? (
          // Chain of custody: the executive's job ends at handover — receipt is the
          // STORE's confirmation, shown here read-only so the executive knows.
          job.status === "IN_TRANSIT_TO_STORE" ? (
            <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-1 shrink-0">In Transit · Receiver Pending</span>
          ) : <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        ) : <StatusPill field={job.fieldStatus} />}
      </div>
      <div className="mt-2 text-xs text-slate-500 space-y-1">
        {job.timeSlot && <p>🕑 {job.timeSlot}</p>}
        {job.address && <p className="flex items-start gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {job.address}{job.landmark ? ` (${job.landmark})` : ""}</p>}
        <p className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {job.bagCount} bag{job.bagCount === 1 ? "" : "s"} · {job.services.map((s) => s.serviceName).join(", ")}</p>
      </div>
    </button>
  )
}

function StatusPill({ field }: { field: string | null }) {
  const label = field ? field.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Assigned"
  return <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 shrink-0">{label}</span>
}

// ── Pickup workflow ──
function JobDetail({ token, exec, brand, kind, job: initial, onBack, onChanged }: { token: string; exec: Exec; brand: Brand; kind: "pickup" | "delivery"; job: Job; onBack: () => void; onChanged: () => void }) {
  const isDelivery = kind === "delivery"
  const [job, setJob] = useState<Job>(initial)
  const [busy, setBusy] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)
  const st = rank(job.fieldStatus)

  const refresh = useCallback(async () => {
    const j = await execFetch(`/api/laundry/executive/jobs?type=${kind}`, token).then((r) => r.json()).catch(() => null)
    const fresh = j?.data?.find((x: Job) => x.id === job.id)
    if (fresh) setJob(fresh); else onChanged()
  }, [token, job.id, kind, onChanged])

  const setStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    setBusy(true)
    try {
      const res = await execFetch(`/api/laundry/executive/jobs/${job.id}/status`, token, { method: "POST", body: JSON.stringify({ status, executiveName: exec.name, ...extra }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      if (status === "PICKUP_COMPLETED") { toast.success("Pickup completed"); onChanged(); onBack(); return }
      await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  // ONE permission read for this screen. The server re-checks on every reject,
  // so hiding the control is convenience — not the enforcement.
  const canReject = exec.canReject === true

  const respond = async (action: "accept" | "reject") => {
    if (action === "reject" && !canReject) return
    setBusy(true)
    try {
      const res = await execFetch(`/api/laundry/executive/jobs/${job.id}/respond`, token, { method: "POST", body: JSON.stringify({ action, type: kind, executiveName: exec.name }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      if (action === "reject") { toast.success("Assignment rejected"); onChanged(); onBack(); return }
      toast.success("Assignment accepted"); await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  const deliver = async (action: "out_for_delivery" | "delivered", extra: Record<string, unknown> = {}) => {
    setBusy(true)
    try {
      const res = await execFetch(`/api/laundry/executive/jobs/${job.id}/deliver`, token, { method: "POST", body: JSON.stringify({ action, executiveName: exec.name, ...extra }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      if (action === "delivered") { toast.success("Delivered"); onChanged(); onBack(); return }
      await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  // ONE call for both pickup bag actions. Everything the domain needs to do —
  // take a returned bag back from the customer, record it, then attach it to
  // this order — happens server-side; the app just says which of the two things
  // the executive did.
  const bagAction = async (svc: Svc, body: Record<string, unknown>): Promise<{ ok: boolean }> => {
    setBusy(true)
    try {
      const res = await execFetch(`/api/laundry/executive/jobs/${job.id}/assign-bag`, token, {
        method: "POST",
        body: JSON.stringify({ serviceId: svc.serviceId, serviceName: svc.serviceName, executiveName: exec.name, ...body }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) return { ok: false }
      toast.success(`${svc.serviceName}: ${j.bagNumber}`)
      await refresh()
      return { ok: true }
    } catch { return { ok: false } } finally { setBusy(false) }
  }

  const scanBag = async (code: string, svc: Svc): Promise<boolean> => {
    const r = await bagAction(svc, { code })
    return r.ok
  }


  /** Take a bag back off this pickup — a mis-scan is fixable at the door. */
  const removeBag = async (svc: Svc, bagNumber: string): Promise<void> => {
    setBusy(true)
    try {
      const res = await execFetch(`/api/laundry/executive/jobs/${job.id}/assign-bag`, token, {
        method: "DELETE",
        body: JSON.stringify({ code: bagNumber, serviceName: svc.serviceName, executiveName: exec.name }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Could not remove that bag")
      toast.success(`${bagNumber} removed`)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that bag")
    } finally {
      setBusy(false)
    }
  }

  const [delBag, setDelBag] = useState("")
  const scanDeliveryBag = async (code: string) => {
    const c = String(code || "").trim(); if (!c) return
    setBusy(true)
    try {
      const res = await execFetch(`/api/laundry/executive/jobs/${job.id}/delivery-bag`, token, { method: "POST", body: JSON.stringify({ code: c, executiveName: exec.name }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Bag not accepted")
      toast.success(`Delivery bag ${j.bagNumber}`)
      setDelBag(""); await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bag not accepted") } finally { setBusy(false) }
  }

  const navigate = () => {
    // No bag gate. A delivery must never be stuck behind a scan — see the
    // delivery-bag card below.
    const url = job.mapsLink || (job.lat && job.lng ? `https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}` : job.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}` : null)
    if (!url) { toast.error("No location for this order"); return }
    if (isDelivery) { if (job.acceptance === "ACCEPTED" && st < RANK.OUT_FOR_DELIVERY) deliver("out_for_delivery") }
    else if (st < RANK.NAVIGATING) setStatus("NAVIGATING")
    window.open(url, "_blank")
  }

  const allBagsDone = job.services.every((s) => s.bags.length > 0)
  const delivered = job.status === "DELIVERED"
  // A pickup is done once PICKUP_COMPLETED; a cancelled order is never editable.
  const pickupDone = st >= RANK.PICKUP_COMPLETED || delivered

  // Delivery-door payment: cash collect, or a UPI QR the customer scans (polled).
  const [qr, setQr] = useState<{ imageUrl: string; qrCodeId: string; amount: number } | null>(null)
  const [collecting, setCollecting] = useState(false)
  const balanceDue = job.balanceDue || 0
  const collectCash = async () => {
    setCollecting(true)
    try {
      const j = await execFetch(`/api/laundry/executive/jobs/${job.id}/collect-payment`, token, { method: "POST", body: JSON.stringify({ method: "CASH", executiveName: exec.name }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Failed")
      toast.success("Payment collected"); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setCollecting(false) }
  }
  const showQr = async () => {
    setCollecting(true)
    try {
      const j = await execFetch(`/api/laundry/executive/jobs/${job.id}/payment-qr`, token, { method: "POST", body: JSON.stringify({}) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Could not create QR")
      setQr(j.data)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create QR") } finally { setCollecting(false) }
  }
  // While a QR is shown, poll for payment (also picks up a "pay on their app").
  useEffect(() => {
    if (!isDelivery || balanceDue <= 0) return
    const id = setInterval(async () => {
      const j = await execFetch(`/api/laundry/executive/jobs/${job.id}/payment-status${qr ? `?qrCodeId=${encodeURIComponent(qr.qrCodeId)}` : ""}`, token).then((r) => r.json()).catch(() => null)
      if (j?.success && j.data.paid) { toast.success("Payment received"); setQr(null); onChanged() }
    }, 5000)
    return () => clearInterval(id)
  }, [isDelivery, balanceDue, qr, job.id, token, onChanged, exec.name])

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10 flex items-center gap-2">
        <button onClick={onBack} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-slate-50"><ChevronLeft className="h-5 w-5 text-slate-500" /></button>
        <div><p className="font-mono text-sm font-semibold text-slate-800">{job.orderNumber}</p><p className="text-xs text-slate-400">{isDelivery ? "Delivery" : "Pickup"} · {job.customerName}</p></div>
        <div className="ml-auto"><StatusPill field={job.fieldStatus} /></div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* What the customer was promised — first, and loudest when breached,
            so the round is prioritised before anything else is read. */}
        <DeliveryPromiseUrgency order={job as DeliveryPromiseInput} />
        {isDelivery && <DeliveryPromiseCard order={job as DeliveryPromiseInput} compact />}

        {/* Customer + Call + Navigate */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5"><User className="h-4 w-4 text-slate-400" /> {job.customerName}</p>
            {job.priority === "EXPRESS" && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 flex items-center gap-0.5"><Zap className="h-3 w-3" />Express</span>}
          </div>
          {job.timeSlot && <p className="text-xs text-slate-400">🕑 {job.timeSlot}</p>}
          {job.address && <p className="text-sm text-slate-500 flex items-start gap-1.5"><MapPin className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" /> {job.address}{job.landmark ? ` (${job.landmark})` : ""}</p>}
          <div className="grid grid-cols-2 gap-2">
            {job.customerPhone
              ? <a href={`tel:${job.customerPhone}`} className="h-11 rounded-xl border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-2"><Phone className="h-4 w-4" /> Call</a>
              : <div className="h-11 rounded-xl border border-slate-100 text-slate-300 flex items-center justify-center gap-2 text-sm"><Phone className="h-4 w-4" /> No phone</div>}
            <button onClick={navigate} className="h-11 rounded-xl bg-slate-900 text-white font-medium flex items-center justify-center gap-2"><Navigation className="h-4 w-4" /> Navigate</button>
          </div>
        </div>

        {/* View Order */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Package className="h-4 w-4 text-slate-400" /> Order · {job.serviceCount} service{job.serviceCount === 1 ? "" : "s"}{job.itemCount ? ` · ${job.itemCount} items` : ""}</p>
          <div className="flex flex-wrap gap-1.5">
            {job.services.map((s, i) => <span key={i} className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600">{s.serviceName}{s.bags.length ? <span className="text-emerald-600"> · {s.bags.length} bag{s.bags.length === 1 ? "" : "s"}</span> : null}</span>)}
          </div>
        </div>

        {/* Assignment acceptance (before any field work) */}
        {!delivered && job.acceptance !== "ACCEPTED" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">New {isDelivery ? "delivery" : "pickup"} assignment</p>
              <p className="text-xs text-slate-500">{canReject ? "Accept to start, or reject to send it back to your supervisor." : "Accept to start this job."}</p>
            </div>
            <div className="flex gap-2">
              {canReject && (
                <button disabled={busy} onClick={() => respond("reject")} className="flex-1 h-12 rounded-xl border border-rose-200 text-rose-600 font-semibold disabled:opacity-60">Reject</button>
              )}
              <button disabled={busy} onClick={() => respond("accept")} className="flex-1 h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: brand.color }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Accept</button>
            </div>
          </div>
        )}

        {/* Delivery bag — OPTIONAL. Scanning it is what lets the backend record
            WHICH bag went to the customer, so it is still offered; it never
            blocks anything. The bag goes to the customer and stays there. */}
        {isDelivery && job.acceptance === "ACCEPTED" && !delivered && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Package className="h-4 w-4 text-slate-400" /> Delivery Bag <span className="text-[10px] font-medium text-slate-400">optional</span></p>
              <p className="text-xs text-slate-500">Give this bag to the customer. Scanning is optional — you can deliver without it.</p>
            </div>
            {job.deliveryBagNumber ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-sm font-medium text-slate-700">Bag <span className="font-mono text-emerald-700">{job.deliveryBagNumber}</span> — give it to the customer</p>
              </div>
            ) : (
              <div className="space-y-2">
                <BagScanButton label="Scan with Camera" onScan={scanDeliveryBag} closeOnScan className="w-full h-11 justify-center" />
                <div className="flex items-center gap-2">
                  <input value={delBag} onChange={(e) => setDelBag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scanDeliveryBag(delBag)} placeholder="or enter bag no." className="flex-1 h-10 rounded-xl border border-slate-200 px-3 text-sm font-mono" />
                  <button onClick={() => scanDeliveryBag(delBag)} disabled={busy || !delBag.trim()} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium disabled:opacity-50">Set</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delivery payment — collect the balance before handover */}
        {isDelivery && job.acceptance === "ACCEPTED" && !delivered && balanceDue > 0 && (
          <div className="bg-white rounded-2xl border border-rose-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Collect Payment</p>
              <span className="text-lg font-bold text-rose-600">₹{balanceDue.toFixed(2)}</span>
            </div>
            {qr ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.imageUrl} alt="Payment QR" className="w-48 h-48 object-contain" />
                <p className="text-sm text-slate-600">Customer scans with any UPI app to pay <b>₹{qr.amount.toFixed(2)}</b></p>
                <p className="text-[11px] text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Waiting for payment…</p>
                <button onClick={() => setQr(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel QR</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={collectCash} disabled={collecting} className="h-11 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2">{collecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "₹"} Collect Cash</button>
                  <button onClick={showQr} disabled={collecting} className="h-11 rounded-xl border border-slate-300 text-slate-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"><Package className="h-4 w-4" /> Payment QR</button>
                </div>
                <p className="text-[11px] text-slate-400 text-center">Or ask the customer to pay on their app — it updates here automatically.</p>
              </>
            )}
          </div>
        )}

        {/* Pickup workflow */}
        {!isDelivery && job.acceptance === "ACCEPTED" && st < RANK.PICKUP_STARTED && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
            {st < RANK.STARTED && <ActionBtn color={brand.color} onClick={() => setStatus("STARTED")} busy={busy} label="Start Pickup" />}
            {st >= RANK.STARTED && st < RANK.REACHED && <ActionBtn color={brand.color} onClick={() => setStatus("REACHED")} busy={busy} label="Reached Customer" />}
            {st === RANK.REACHED && <ActionBtn color={brand.color} onClick={() => setVerifyOpen(true)} busy={busy} label="Verify Customer" />}
            <StepList current={st} />
          </div>
        )}

        {/* Bag assignment — revealed only once the executive is actually at the
            customer and the pickup has been accepted (Start → Reached → Verify
            moves fieldStatus to PICKUP_STARTED), and stays editable until the
            pickup is confirmed. Bags are still assigned at the same point in the
            workflow; this is only about when the card appears — showing it from
            acceptance invited scanning before reaching the customer.
            Each service keeps its own bag list: Bag N + Scan, then + Add Bag for
            the next one. No fixed limit — a service may span many bags. */}
        {!isDelivery && job.acceptance === "ACCEPTED" && st >= RANK.PICKUP_STARTED && !pickupDone && job.status !== "CANCELLED" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Assign Bags · one or more bags per service</p>
            {job.services.map((s, i) => (
              <ServiceBags key={i} svc={s} onScan={scanBag} onRemove={removeBag} />
            ))}
          </div>
        )}

        {/* Pickup completed — read-only bag list, no actions. */}
        {!isDelivery && pickupDone && (
          <BagListReadOnly title={delivered ? "Bags Assigned" : "Pickup Completed"} services={job.services} total={job.bagCount} />
        )}

        {/* Delivery — per-service bags are always read-only (the only delivery
            bag handling is the separate "Delivery Bag" scan above, which the
            existing workflow requires). */}
        {isDelivery && (
          <BagListReadOnly title={delivered ? "Delivery Completed · Bags Assigned" : "Bags Assigned"} services={job.services} total={job.bagCount} />
        )}

        {/* Delivery workflow */}
        {isDelivery && job.acceptance === "ACCEPTED" && !delivered && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700">Delivery</p>
            <p className="text-xs text-slate-500">{st >= RANK.OUT_FOR_DELIVERY ? "Out for delivery — hand over to the customer and confirm below." : "Tap Navigate to head out, then confirm delivery with the customer."}</p>
          </div>
        )}
        {isDelivery && delivered && <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-700 text-sm flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Delivered</div>}
      </div>

      {/* Bottom action bar */}
      {!isDelivery && st >= RANK.PICKUP_STARTED && st < RANK.PICKUP_COMPLETED && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-white/90 backdrop-blur border-t border-slate-100">
          <button disabled={busy || !allBagsDone} onClick={() => setStatus("PICKUP_COMPLETED")} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Pickup {allBagsDone ? "" : `(${job.assignedBags}/${job.serviceCount} services)`}
          </button>
        </div>
      )}
      {isDelivery && job.acceptance === "ACCEPTED" && !delivered && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-white/90 backdrop-blur border-t border-slate-100">
          <button disabled={busy} onClick={() => setDeliverOpen(true)} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Delivery
          </button>
        </div>
      )}

      {verifyOpen && <VerifyDialog customerName={job.customerName} defaultMethod={job.pickupVerificationMethod === "NAME" ? "NAME" : "OTP"} onClose={() => setVerifyOpen(false)} onConfirm={(method, value) => { setVerifyOpen(false); setStatus("REACHED", { verify: true, verifyMethod: method, verifyValue: value }) }} />}
      {deliverOpen && <DeliverDialog customerName={job.customerName} color={brand.color} defaultMethod={job.deliveryVerificationMethod === "NAME" ? "NAME" : "OTP"} onClose={() => setDeliverOpen(false)} onConfirm={(recipientName, method, otp) => { setDeliverOpen(false); deliver("delivered", { recipientName, method, otp }) }} />}
    </div>
  )
}

// One service's bag list inside the editable assignment section. Each service
// is independent: assigned bags show as "Bag N ✓ number", then a "+ Add Bag"
// button reveals the next "Bag N · Scan" slot. No fixed limit.
function ServiceBags({ svc, onScan, onRemove }: {
  svc: Svc
  onScan: (code: string, svc: Svc) => Promise<boolean>
  onRemove: (svc: Svc, bagNumber: string) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  // A scan that did not work. Shown as one short line, never as an error the
  // executive has to resolve.
  const [failed, setFailed] = useState(false)
  const n = svc.bags.length
  return (
    <div className="border border-slate-100 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{svc.serviceName}</p>
        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{n} bag{n === 1 ? "" : "s"}</span>
      </div>
      {n > 0 && (
        <div className="space-y-1">
          {svc.bags.map((bn, j) => (
            <div key={bn} className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-slate-500">Bag {j + 1}</span>
              <span className="font-mono font-semibold text-emerald-700">{bn}</span>
              {/* A wrong bag is easiest to fix at the door. Removing is only
                  offered before the pickup is confirmed; afterwards the bag is
                  a fact about a completed collection, not a choice. */}
              <button
                onClick={() => onRemove(svc, bn)}
                aria-label={`Remove ${bn}`}
                className="ml-auto h-7 w-7 grid place-items-center rounded-lg text-slate-400 active:bg-rose-50 active:text-rose-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {n === 0 || adding ? (
        // Two buttons, one rule: whichever bag it is, its QR identifies it.
        // "Existing" is the customer's own bag coming back; "New" is one off the
        // executive's pre-tagged stock. The server tells them apart from the
        // bag's own status, so the executive never has to.
        <div className="space-y-2">
          {/* BOTH paths are a scan. The executive carries no printer, every
              physical bag is already tagged, and the QR is the only thing that
              knows which bag is actually in their hand. */}
          <BagScanButton
            label="Scan Existing Bag" closeOnScan className="w-full h-12 justify-center text-base font-semibold"
            onScan={async (code) => {
              const okScan = await onScan(code, svc)
              if (okScan) { setFailed(false); setAdding(false) } else setFailed(true)
            }}
          />
          <BagScanButton
            label="Tag New Bag" closeOnScan
            className="w-full h-12 justify-center text-base font-semibold border-2 border-slate-900 text-slate-900 bg-white"
            onScan={async (code) => {
              const okScan = await onScan(code, svc)
              if (okScan) { setFailed(false); setAdding(false) } else setFailed(true)
            }}
          />
          {failed && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-center">
              That bag could not be used — scan a different bag
            </p>
          )}
          {n > 0 && (
            <button onClick={() => { setAdding(false); setFailed(false) }}
              className="w-full h-10 rounded-xl text-sm font-medium text-slate-500">
              Cancel
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full h-9 rounded-xl border border-dashed border-blue-300 text-blue-600 text-sm font-medium flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Add / Scan Bag
        </button>
      )}
    </div>
  )
}

// Read-only bag list for completed pickups and all deliveries — no scan/add.
function BagListReadOnly({ title, services, total }: { title: string; services: Svc[]; total: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Package className="h-4 w-4 text-slate-400" /> {title}</p>
        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{total} bag{total === 1 ? "" : "s"}</span>
      </div>
      {services.map((s, i) => (
        <div key={i} className="border border-slate-100 rounded-xl px-3 py-2 space-y-0.5">
          <p className="text-sm font-medium text-slate-700">{s.serviceName}</p>
          {s.bags.length === 0
            ? <p className="text-xs text-slate-400">No bags</p>
            : s.bags.map((bn, j) => (
              <p key={bn} className="text-xs text-slate-600 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Bag {j + 1} · <span className="font-mono font-semibold text-emerald-700">{bn}</span></p>
            ))}
        </div>
      ))}
    </div>
  )
}

function ActionBtn({ onClick, busy, label, color }: { onClick: () => void; busy: boolean; label: string; color: string }) {
  return <button disabled={busy} onClick={onClick} className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: color }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {label}</button>
}

function StepList({ current }: { current: number }) {
  const steps = ["Start", "Navigate", "Reached", "Verify", "Pickup"]
  return (
    <div className="flex items-center justify-between pt-1">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-col items-center gap-1 flex-1">
          <div className={`h-2 w-2 rounded-full ${i <= current ? "bg-blue-600" : "bg-slate-200"}`} />
          <span className={`text-[9px] ${i <= current ? "text-blue-600" : "text-slate-300"}`}>{s}</span>
        </div>
      ))}
    </div>
  )
}

function VerifyDialog({ customerName, defaultMethod, onClose, onConfirm }: { customerName: string; defaultMethod: "NAME" | "OTP"; onClose: () => void; onConfirm: (method: string, value: string) => void }) {
  const [method, setMethod] = useState<"NAME" | "OTP">(defaultMethod)
  const [value, setValue] = useState("")
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold text-slate-800">Verify Customer</p>
        <div className="flex gap-2">
          <button onClick={() => setMethod("NAME")} className={`flex-1 h-9 rounded-lg text-sm border ${method === "NAME" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>Name</button>
          <button onClick={() => setMethod("OTP")} className={`flex-1 h-9 rounded-lg text-sm border ${method === "OTP" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>OTP</button>
        </div>
        {method === "NAME"
          ? <p className="text-sm text-slate-500">Confirm you are meeting <b className="text-slate-700">{customerName}</b>.</p>
          : <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" placeholder="Enter OTP" className="w-full h-11 rounded-xl border border-slate-200 px-3" />}
        <button onClick={() => onConfirm(method, method === "NAME" ? customerName : value)} className="w-full h-11 rounded-xl bg-blue-600 text-white font-semibold">Confirm &amp; Continue</button>
      </div>
    </div>
  )
}

function DeliverDialog({ customerName, color, defaultMethod, onClose, onConfirm }: { customerName: string; color: string; defaultMethod: "NAME" | "OTP"; onClose: () => void; onConfirm: (recipientName: string, method: string, otp: string) => void }) {
  const [method, setMethod] = useState<"NAME" | "OTP">(defaultMethod)
  const [recipient, setRecipient] = useState(customerName)
  const [otp, setOtp] = useState("")
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold text-slate-800">Confirm Delivery</p>
        <div className="flex gap-2">
          <button onClick={() => setMethod("NAME")} className={`flex-1 h-9 rounded-lg text-sm border ${method === "NAME" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>Name</button>
          <button onClick={() => setMethod("OTP")} className={`flex-1 h-9 rounded-lg text-sm border ${method === "OTP" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>OTP</button>
        </div>
        <div>
          <label className="text-xs text-slate-500">Received by</label>
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3" placeholder="Recipient name" />
        </div>
        {method === "OTP" && <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder="Enter delivery OTP" className="w-full h-11 rounded-xl border border-slate-200 px-3" />}
        <button onClick={() => onConfirm(recipient.trim() || customerName, method, otp)} className="w-full h-11 rounded-xl text-white font-semibold" style={{ backgroundColor: color }}>Confirm Delivered</button>
      </div>
    </div>
  )
}

// ── Profile ──
function Profile({ exec, brand, onBack, onLogout }: { exec: Exec; brand: Brand; onBack: () => void; onLogout: () => void }) {
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-50"><span className="text-sm text-slate-500">{label}</span><span className="text-sm font-medium text-slate-800">{value}</span></div>
  )
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="text-white px-4 py-3 flex items-center gap-2" style={{ backgroundColor: brand.color }}>
        <button onClick={onBack} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>
        <p className="font-semibold">Profile</p>
      </header>
      <div className="px-4 py-5">
        <div className="flex flex-col items-center mb-4">
          <div className="h-20 w-20 rounded-full grid place-items-center overflow-hidden" style={{ backgroundColor: `${brand.color}22` }}>{exec.photo ? <img src={exec.photo} alt="" className="h-20 w-20 object-cover" /> : <User className="h-9 w-9" style={{ color: brand.color }} />}</div>
          <p className="mt-2 font-semibold text-slate-800">{exec.name}</p>
          <p className="text-xs text-slate-400 font-mono">{exec.employeeCode}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 px-4">
          <Row label="Mobile" value={exec.mobile} />
          <Row label="Assigned Store" value={exec.storeName || "—"} />
          <Row label="Vehicle" value={[exec.vehicleType, exec.vehicleNumber].filter(Boolean).join(" · ") || "—"} />
          <Row label="Availability" value={exec.availability} />
        </div>
        <div className="mt-5"><InstallCta color={brand.color} /></div>
        <button onClick={onLogout} className="mt-3 w-full h-12 rounded-xl border border-rose-200 text-rose-600 font-medium flex items-center justify-center gap-2"><LogOut className="h-4 w-4" /> Log Out</button>
        <p className="text-center text-[11px] text-slate-300 mt-4">{brand.name} · Pickup &amp; Delivery</p>
      </div>
    </div>
  )
}
