"use client"

// Delivery Executive PWA — the operational interface for field pickups. The
// Admin remains the control center; this only executes assigned jobs and reports
// live field status back to the SAME order/timeline. Reuses the Universal Bag
// Scanner + the shared bag-assignment engine. Mobile-first, single-page.
import { useCallback, useEffect, useState, type FormEvent } from "react"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { Loader2, MapPin, Navigation, LogOut, User, Package, Zap, CheckCircle2, ChevronLeft, Bike } from "lucide-react"
import { toast } from "sonner"

const TOKEN_KEY = "qx_exec_token"

interface Brand { name: string; logo: string | null; color: string }
const DEFAULT_BRAND: Brand = { name: "Pickup & Delivery", logo: null, color: "#2563EB" }

interface Exec { id: string; name: string; employeeCode: string; mobile: string; storeName: string | null; vehicleType: string | null; vehicleNumber: string | null; photo: string | null; availability: string }
interface Svc { serviceId: string | null; serviceName: string; bagNumber: string | null }
interface Job {
  id: string; orderNumber: string; status: string; fieldStatus: string | null; acceptance: string | null; priority: string
  customerName: string; customerPhone: string | null; timeSlot: string | null
  address: string | null; landmark: string | null; mapsLink: string | null; lat: number | null; lng: number | null
  services: Svc[]; bagCount: number; assignedBags: number; itemCount: number
}

const RANK: Record<string, number> = { ASSIGNED: 0, STARTED: 1, NAVIGATING: 2, REACHED: 3, PICKUP_STARTED: 4, PICKUP_COMPLETED: 5 }
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
      const res = await fetch("/api/laundry/executive/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile: mobile.trim(), password }) })
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
            <label className="text-xs font-medium text-slate-500">Mobile Number</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="numeric" placeholder="9876543210" className="mt-1 w-full h-11 rounded-xl border border-slate-200 px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-slate-300" />
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

  const load = useCallback(async (t = tab) => {
    setLoading(true)
    try {
      const j = await execFetch(`/api/laundry/executive/jobs?type=${t}`, token).then((r) => r.json())
      if (j.success) setJobs(j.data)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [tab, token])
  useEffect(() => { load(tab) }, [load, tab])

  if (showProfile) return <Profile exec={exec} brand={brand} onBack={() => setShowProfile(false)} onLogout={onLogout} />
  if (openJob) return <JobDetail token={token} exec={exec} brand={brand} job={openJob} onBack={() => { setOpenJob(null); load() }} onChanged={load} />

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
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className="flex-1 h-8 rounded-lg text-xs font-medium" style={tab === t.k ? { backgroundColor: "#fff", color: brand.color } : { color: "rgba(255,255,255,0.85)" }}>{t.l}</button>
          ))}
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
          </div>
          <p className="text-sm text-slate-700 mt-0.5">{job.customerName}</p>
        </div>
        {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <StatusPill field={job.fieldStatus} />}
      </div>
      <div className="mt-2 text-xs text-slate-500 space-y-1">
        {job.timeSlot && <p>🕑 {job.timeSlot}</p>}
        {job.address && <p className="flex items-start gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {job.address}{job.landmark ? ` (${job.landmark})` : ""}</p>}
        <p className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {job.assignedBags}/{job.bagCount} bags · {job.services.map((s) => s.serviceName).join(", ")}</p>
      </div>
    </button>
  )
}

function StatusPill({ field }: { field: string | null }) {
  const label = field ? field.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Assigned"
  return <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 shrink-0">{label}</span>
}

// ── Pickup workflow ──
function JobDetail({ token, exec, brand, job: initial, onBack, onChanged }: { token: string; exec: Exec; brand: Brand; job: Job; onBack: () => void; onChanged: () => void }) {
  const [job, setJob] = useState<Job>(initial)
  const [busy, setBusy] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const st = rank(job.fieldStatus)

  const refresh = useCallback(async () => {
    const j = await execFetch(`/api/laundry/executive/jobs?type=pickup`, token).then((r) => r.json()).catch(() => null)
    const fresh = j?.data?.find((x: Job) => x.id === job.id)
    if (fresh) setJob(fresh); else onChanged()
  }, [token, job.id, onChanged])

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

  const respond = async (action: "accept" | "reject") => {
    setBusy(true)
    try {
      const res = await execFetch(`/api/laundry/executive/jobs/${job.id}/respond`, token, { method: "POST", body: JSON.stringify({ action, type: "pickup", executiveName: exec.name }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      if (action === "reject") { toast.success("Assignment rejected"); onChanged(); onBack(); return }
      toast.success("Assignment accepted"); await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  const scanBag = async (code: string, svc: Svc) => {
    try {
      const res = await execFetch(`/api/laundry/executive/jobs/${job.id}/assign-bag`, token, { method: "POST", body: JSON.stringify({ code, serviceId: svc.serviceId, serviceName: svc.serviceName, executiveName: exec.name }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Bag not accepted")
      toast.success(`${svc.serviceName}: ${j.bagNumber}`)
      await refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bag not accepted") }
  }

  const navigate = () => {
    const url = job.mapsLink || (job.lat && job.lng ? `https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}` : job.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}` : null)
    if (!url) { toast.error("No location for this pickup"); return }
    if (st < RANK.NAVIGATING) setStatus("NAVIGATING")
    window.open(url, "_blank")
  }

  const allBagsDone = job.services.every((s) => s.bagNumber)

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10 flex items-center gap-2">
        <button onClick={onBack} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-slate-50"><ChevronLeft className="h-5 w-5 text-slate-500" /></button>
        <div><p className="font-mono text-sm font-semibold text-slate-800">{job.orderNumber}</p><p className="text-xs text-slate-400">{job.customerName}</p></div>
        <div className="ml-auto"><StatusPill field={job.fieldStatus} /></div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Customer + location */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <p className="text-sm text-slate-700 flex items-center gap-1.5"><User className="h-4 w-4 text-slate-400" /> {job.customerName}{job.customerPhone && <a href={`tel:${job.customerPhone}`} className="ml-auto text-blue-600 text-xs">{job.customerPhone}</a>}</p>
          {job.address && <p className="text-sm text-slate-500 flex items-start gap-1.5"><MapPin className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" /> {job.address}{job.landmark ? ` (${job.landmark})` : ""}</p>}
          <button onClick={navigate} className="w-full h-11 mt-1 rounded-xl bg-slate-900 text-white font-medium flex items-center justify-center gap-2"><Navigation className="h-4 w-4" /> Navigate</button>
        </div>

        {/* Assignment acceptance (before any field work) */}
        {job.acceptance !== "ACCEPTED" && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">New pickup assignment</p>
              <p className="text-xs text-slate-500">Accept to start this pickup, or reject to send it back to your supervisor.</p>
            </div>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => respond("reject")} className="flex-1 h-12 rounded-xl border border-rose-200 text-rose-600 font-semibold disabled:opacity-60">Reject</button>
              <button disabled={busy} onClick={() => respond("accept")} className="flex-1 h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: brand.color }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Accept</button>
            </div>
          </div>
        )}

        {/* Workflow actions (after acceptance) */}
        {job.acceptance === "ACCEPTED" && st < RANK.PICKUP_STARTED && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
            {st < RANK.STARTED && <ActionBtn color={brand.color} onClick={() => setStatus("STARTED")} busy={busy} label="Start Pickup" />}
            {st >= RANK.STARTED && st < RANK.REACHED && <ActionBtn color={brand.color} onClick={() => setStatus("REACHED")} busy={busy} label="Reached Customer" />}
            {st === RANK.REACHED && <ActionBtn color={brand.color} onClick={() => setVerifyOpen(true)} busy={busy} label="Verify Customer" />}
            <StepList current={st} />
          </div>
        )}

        {/* Bag assignment (after customer verified) */}
        {job.acceptance === "ACCEPTED" && st >= RANK.PICKUP_STARTED && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Assign Bags — one bag per service</p>
            {job.services.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border border-slate-100 rounded-xl px-3 py-2.5">
                <div><p className="text-sm font-medium text-slate-700">{s.serviceName}</p>{s.bagNumber && <p className="text-xs text-emerald-600 font-mono flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> {s.bagNumber}</p>}</div>
                {s.bagNumber ? <span className="text-emerald-500"><CheckCircle2 className="h-5 w-5" /></span> : <BagScanButton label="Scan" size="sm" onScan={(code) => scanBag(code, s)} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm pickup */}
      {st >= RANK.PICKUP_STARTED && st < RANK.PICKUP_COMPLETED && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-white/90 backdrop-blur border-t border-slate-100">
          <button disabled={busy || !allBagsDone} onClick={() => setStatus("PICKUP_COMPLETED")} className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Pickup {allBagsDone ? "" : `(${job.assignedBags}/${job.bagCount})`}
          </button>
        </div>
      )}

      {verifyOpen && <VerifyDialog customerName={job.customerName} onClose={() => setVerifyOpen(false)} onConfirm={(method, value) => { setVerifyOpen(false); setStatus("REACHED", { verify: true, verifyMethod: method, verifyValue: value }) }} />}
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

function VerifyDialog({ customerName, onClose, onConfirm }: { customerName: string; onClose: () => void; onConfirm: (method: string, value: string) => void }) {
  const [method, setMethod] = useState<"NAME" | "OTP">("NAME")
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
        <button onClick={onLogout} className="mt-5 w-full h-12 rounded-xl border border-rose-200 text-rose-600 font-medium flex items-center justify-center gap-2"><LogOut className="h-4 w-4" /> Log Out</button>
        <p className="text-center text-[11px] text-slate-300 mt-4">{brand.name} · Pickup &amp; Delivery</p>
      </div>
    </div>
  )
}
