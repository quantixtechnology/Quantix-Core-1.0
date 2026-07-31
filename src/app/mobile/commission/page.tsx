"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { authFetch } from "@/lib/admin-fetch"
import { useAuthStore } from "@/stores/auth-store"
import { toast, Toaster } from "sonner"

// ─── Commission constants (mirrors commission-view.tsx exactly) ───────────────

type PlanType = "monthly" | "quarterly" | "halfYearly" | "yearly"
const PLANS: PlanType[] = ["monthly", "quarterly", "halfYearly", "yearly"]
const PLAN_LABELS: Record<PlanType, string> = {
  monthly: "Monthly", quarterly: "Quarterly", halfYearly: "Half Yearly", yearly: "Yearly",
}
const MATRIX: Record<PlanType, Record<25 | 35 | 45, number>> = {
  monthly:    { 25: 25, 35: 35, 45: 45 },
  quarterly:  { 25: 12, 35: 16, 45: 20 },
  halfYearly: { 25: 14, 35: 18, 45: 22 },
  yearly:     { 25: 16, 35: 20, 45: 25 },
}
const SLAB_TIERS = [
  { slab: 25 as 25|35|45, tier: "Tier 1", label: "1–5 signups",  min: 1,  max: 5 },
  { slab: 35 as 25|35|45, tier: "Tier 2", label: "6–10 signups", min: 6,  max: 10 },
  { slab: 45 as 25|35|45, tier: "Tier 3", label: "11+ signups",  min: 11, max: Infinity },
]
const RENEWAL_RATES: Record<PlanType, number> = {
  monthly: 10, quarterly: 10, halfYearly: 11, yearly: 12,
}
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

function getSlab(qty: number): 25|35|45 {
  if (qty <= 5) return 25
  if (qty <= 10) return 35
  return 45
}
function slabToTier(s: 25|35|45) { return s === 25 ? "Tier 1" : s === 35 ? "Tier 2" : "Tier 3" }
function slabColors(s: 25|35|45) {
  if (s === 25) return { bg: "bg-amber-500",  text: "text-amber-700",  light: "bg-amber-50",  border: "border-amber-300" }
  if (s === 35) return { bg: "bg-blue-500",   text: "text-blue-700",   light: "bg-blue-50",   border: "border-blue-300" }
  return              { bg: "bg-emerald-500", text: "text-emerald-700",light: "bg-emerald-50",border: "border-emerald-300" }
}
function calcRow(type: PlanType, qty: number, value: number, slab: 25|35|45) {
  const pct = MATRIX[type][slab]
  if (!qty || !value) return { type, qty, totalValue: value, slab, pct, avgValue: 0, perSaleCommission: 0, totalCommission: 0 }
  const avgValue = value / qty
  return { type, qty, totalValue: value, slab, pct, avgValue, perSaleCommission: (avgValue * pct) / 100, totalCommission: (value * pct) / 100 }
}
function calcRenewalRow(type: PlanType, qty: number, value: number) {
  const pct = RENEWAL_RATES[type]
  if (!qty || !value) return { type, qty, totalValue: value, pct, avgValue: 0, perSaleCommission: 0, totalCommission: 0 }
  const avgValue = value / qty
  return { type, qty, totalValue: value, pct, avgValue, perSaleCommission: (avgValue * pct) / 100, totalCommission: (value * pct) / 100 }
}
function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtPct(n: number) { return `${n % 1 === 0 ? n : n.toFixed(1)}%` }

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedCalc {
  id: string
  salesPersonName: string
  month: number
  year: number
  notes: string | null
  totalQty: number
  totalValue: number
  qualifiedSlab: number
  totalCommission: number
  calcType: string | null
  createdAt: string
}

// ─── PWA Install Hook ─────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => setInstalled(true))
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") setInstalled(true)
    setPrompt(null)
  }

  return { prompt, install, installed }
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { login, isLoading, error } = useAuthStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      onLogin()
    } catch { /* error shown via auth store */ }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/quantix-logo.png" alt="Quantix" className="h-14 mb-4" />
          <h1 className="text-2xl font-black text-gray-900">Commission Calculator</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">Sign in to your Quantix account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full h-14 rounded-xl border border-gray-200 px-4 text-base bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="you@quantixtechnology.in"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full h-14 rounded-xl border border-gray-200 px-4 text-base bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit" disabled={isLoading}
            className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-base transition-colors disabled:opacity-60"
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Plan Input Card ──────────────────────────────────────────────────────────

function PlanCard({ plan, qty, value, onChange }: {
  plan: PlanType
  qty: string
  value: string
  onChange: (field: "qty" | "value", val: string) => void
}) {
  const validate = (v: string, field: "qty" | "value") => {
    const pattern = field === "qty" ? /^\d*$/ : /^\d*\.?\d*$/
    if (v === "" || pattern.test(v)) onChange(field, v)
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="text-sm font-bold text-gray-700 mb-3">{PLAN_LABELS[plan]}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Qty</label>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={qty} onChange={e => validate(e.target.value, "qty")}
            placeholder="0"
            className="w-full h-12 rounded-xl border border-gray-200 px-3 text-lg font-bold text-center bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Sale Value (₹)</label>
          <input
            type="text" inputMode="decimal"
            value={value} onChange={e => validate(e.target.value, "value")}
            placeholder="0.00"
            className="w-full h-12 rounded-xl border border-gray-200 px-3 text-base font-bold text-right bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Save Sheet ───────────────────────────────────────────────────────────────

function SaveSheet({
  open, onClose, onSaved, user, totalQty, totalValue, slab, totalComm, calcType,
  rows,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  user: { id: string; name: string } | null
  totalQty: number; totalValue: number
  slab: 25|35|45; totalComm: number
  calcType: "signup" | "renewal"
  rows: { type: PlanType; qty: number; totalValue: number; pct: number; perSaleCommission: number; totalCommission: number }[]
}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const lineItems = JSON.stringify(rows.map(r => ({
        type: r.type, qty: r.qty, totalValue: r.totalValue,
        commPct: r.pct, perSaleCommission: r.perSaleCommission, totalCommission: r.totalCommission,
      })))
      const res = await authFetch("/api/admin/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesPersonId: user.id, salesPersonName: user.name,
          month, year, lineItems, totalQty, totalValue,
          qualifiedSlab: slab, totalCommission: totalComm,
          notes: notes.trim() || undefined,
          calcType,
          eligibilityStatus: calcType === "renewal" ? (totalQty >= 5 ? "RELEASE" : "HOLD") : undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? "Save failed")
      toast.success("Calculation saved!")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-[env(safe-area-inset-bottom,24px)] z-10">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
        <h2 className="text-lg font-black mb-4">Save Calculation</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                className="w-full h-12 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))}
                className="w-full h-12 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Q2 push, campaign week…"
              className="w-full h-12 rounded-xl border border-gray-200 px-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Total Qty</span><span className="font-bold">{totalQty}</span></div>
            {calcType === "signup" && <div className="flex justify-between text-sm"><span className="text-gray-500">Performance Tier</span><span className="font-bold">{slabToTier(slab)}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-gray-500">Business Value</span><span className="font-bold">{fmt(totalValue)}</span></div>
            <div className="flex justify-between text-sm border-t border-emerald-200 pt-2">
              <span className="text-gray-600 font-semibold">Commission</span>
              <span className="font-extrabold text-emerald-600">{fmt(totalComm)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave} disabled={saving || totalQty === 0}
          className="w-full h-14 mt-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-base transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Calculation"}
        </button>
      </div>
    </div>
  )
}

// ─── Signup Calculator ────────────────────────────────────────────────────────

function SignupCalculator({ user, onHistoryRefresh }: { user: { id: string; name: string } | null; onHistoryRefresh: () => void }) {
  type Inputs = Record<PlanType, { qty: string; value: string }>
  const [inputs, setInputs] = useState<Inputs>({
    monthly: { qty: "", value: "" }, quarterly: { qty: "", value: "" },
    halfYearly: { qty: "", value: "" }, yearly: { qty: "", value: "" },
  })
  const [showSave, setShowSave] = useState(false)

  const setField = (plan: PlanType, field: "qty" | "value", val: string) =>
    setInputs(prev => ({ ...prev, [plan]: { ...prev[plan], [field]: val } }))

  const parsed = PLANS.reduce((acc, p) => {
    acc[p] = { qty: parseInt(inputs[p].qty) || 0, value: parseFloat(inputs[p].value) || 0 }
    return acc
  }, {} as Record<PlanType, { qty: number; value: number }>)

  const totalQty   = PLANS.reduce((s, p) => s + parsed[p].qty, 0)
  const totalValue = PLANS.reduce((s, p) => s + parsed[p].value, 0)
  const slab       = getSlab(totalQty)
  const rows       = PLANS.map(p => calcRow(p, parsed[p].qty, parsed[p].value, slab))
  const totalComm  = rows.reduce((s, r) => s + r.totalCommission, 0)
  const col        = slabColors(slab)
  const hasData    = totalQty > 0

  const handleReset = () => setInputs({
    monthly: { qty: "", value: "" }, quarterly: { qty: "", value: "" },
    halfYearly: { qty: "", value: "" }, yearly: { qty: "", value: "" },
  })

  return (
    <>
      <div className="p-4 space-y-3 pb-32">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Enter Sales Data</p>
        {PLANS.map(plan => (
          <PlanCard key={plan} plan={plan}
            qty={inputs[plan].qty} value={inputs[plan].value}
            onChange={(f, v) => setField(plan, f, v)} />
        ))}

        {/* Tier badge */}
        {hasData && (
          <div className={`rounded-2xl border-2 ${col.border} ${col.light} p-4 flex items-center justify-between`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-60">Performance Tier</p>
              <p className={`text-3xl font-black mt-1 ${col.text}`}>{slabToTier(slab)}</p>
              <p className="text-xs opacity-70 mt-0.5">{slab === 25 ? "1–5" : slab === 35 ? "6–10" : "11+"} signups</p>
            </div>
            <div className={`h-16 w-16 rounded-full ${col.bg} flex items-center justify-center text-white text-2xl font-black`}>
              {fmtPct(MATRIX.monthly[slab])}
            </div>
          </div>
        )}

        {/* Commission matrix quick ref */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Commission Rates</p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[280px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-xs text-gray-400 font-bold">Plan</th>
                  {SLAB_TIERS.map(t => <th key={t.slab} className={`text-right pb-2 text-xs font-bold ${slabColors(t.slab).text}`}>{t.tier}</th>)}
                </tr>
              </thead>
              <tbody>
                {PLANS.map(p => (
                  <tr key={p} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-xs font-medium text-gray-600">{PLAN_LABELS[p]}</td>
                    {([25,35,45] as (25|35|45)[]).map(s => (
                      <td key={s} className={`py-2 text-right text-xs font-mono ${s === slab && hasData ? `font-bold ${slabColors(s).text}` : "text-gray-400"}`}>
                        {fmtPct(MATRIX[p][s])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 shadow-lg px-4 py-3 pb-[env(safe-area-inset-bottom,12px)] z-20">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Total Commission</p>
            <p className={`text-xl font-extrabold truncate ${hasData ? "text-emerald-600" : "text-gray-300"}`}>
              {hasData ? fmt(totalComm) : "₹0.00"}
            </p>
          </div>
          <button onClick={handleReset}
            className="h-12 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50">
            Reset
          </button>
          <button
            onClick={() => setShowSave(true)}
            disabled={!hasData}
            className="h-12 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-40">
            Save
          </button>
        </div>
      </div>

      <SaveSheet
        open={showSave} onClose={() => setShowSave(false)}
        onSaved={() => { onHistoryRefresh(); setShowSave(false) }}
        user={user} totalQty={totalQty} totalValue={totalValue}
        slab={slab} totalComm={totalComm} calcType="signup"
        rows={rows}
      />
    </>
  )
}

// ─── Renewal Calculator ───────────────────────────────────────────────────────

function RenewalCalculator({ user, onHistoryRefresh }: { user: { id: string; name: string } | null; onHistoryRefresh: () => void }) {
  type Inputs = Record<PlanType, { qty: string; value: string }>
  const [inputs, setInputs] = useState<Inputs>({
    monthly: { qty: "", value: "" }, quarterly: { qty: "", value: "" },
    halfYearly: { qty: "", value: "" }, yearly: { qty: "", value: "" },
  })
  const [newSignups, setNewSignups] = useState("")
  const [showSave, setShowSave] = useState(false)

  const setField = (plan: PlanType, field: "qty" | "value", val: string) =>
    setInputs(prev => ({ ...prev, [plan]: { ...prev[plan], [field]: val } }))

  const parsed = PLANS.reduce((acc, p) => {
    acc[p] = { qty: parseInt(inputs[p].qty) || 0, value: parseFloat(inputs[p].value) || 0 }
    return acc
  }, {} as Record<PlanType, { qty: number; value: number }>)

  const totalQty   = PLANS.reduce((s, p) => s + parsed[p].qty, 0)
  const totalValue = PLANS.reduce((s, p) => s + parsed[p].value, 0)
  const rows       = PLANS.map(p => calcRenewalRow(p, parsed[p].qty, parsed[p].value))
  const totalComm  = rows.reduce((s, r) => s + r.totalCommission, 0)
  const ns         = parseInt(newSignups) || 0
  const eligibility = ns >= 5 ? "RELEASE" : "HOLD"
  const hasData    = totalQty > 0

  const handleReset = () => {
    setInputs({ monthly: { qty: "", value: "" }, quarterly: { qty: "", value: "" }, halfYearly: { qty: "", value: "" }, yearly: { qty: "", value: "" } })
    setNewSignups("")
  }

  return (
    <>
      <div className="p-4 space-y-3 pb-32">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Renewal Sales Data</p>

        {PLANS.map(plan => (
          <PlanCard key={plan} plan={plan}
            qty={inputs[plan].qty} value={inputs[plan].value}
            onChange={(f, v) => setField(plan, f, v)} />
        ))}

        {/* New signups eligibility */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
            New Signups This Month
          </label>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={newSignups}
            onChange={e => { if (/^\d*$/.test(e.target.value)) setNewSignups(e.target.value) }}
            placeholder="0"
            className="w-full h-12 rounded-xl border border-gray-200 px-3 text-lg font-bold text-center bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white"
          />
          {newSignups && (
            <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold flex items-center justify-between ${eligibility === "RELEASE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
              <span>Renewal Eligibility</span>
              <span>{eligibility === "RELEASE" ? "✓ RELEASE" : "⚠ HOLD (need 5+)"}</span>
            </div>
          )}
        </div>

        {/* Fixed rates reference */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Renewal Rates (Fixed)</p>
          <div className="grid grid-cols-2 gap-2">
            {PLANS.map(p => (
              <div key={p} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 font-medium">{PLAN_LABELS[p]}</span>
                <span className="font-bold text-emerald-600">{fmtPct(RENEWAL_RATES[p])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 shadow-lg px-4 py-3 pb-[env(safe-area-inset-bottom,12px)] z-20">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Renewal Commission</p>
            <p className={`text-xl font-extrabold truncate ${hasData ? "text-emerald-600" : "text-gray-300"}`}>
              {hasData ? fmt(totalComm) : "₹0.00"}
            </p>
          </div>
          <button onClick={handleReset}
            className="h-12 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 active:bg-gray-50">
            Reset
          </button>
          <button
            onClick={() => setShowSave(true)}
            disabled={!hasData}
            className="h-12 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-40">
            Save
          </button>
        </div>
      </div>

      <SaveSheet
        open={showSave} onClose={() => setShowSave(false)}
        onSaved={() => { onHistoryRefresh(); setShowSave(false) }}
        user={user} totalQty={totalQty} totalValue={totalValue}
        slab={45} totalComm={totalComm} calcType="renewal"
        rows={rows.map(r => ({ ...r, pct: r.pct }))}
      />
    </>
  )
}

// ─── History View ─────────────────────────────────────────────────────────────

function HistoryView({ user, isAdmin, refreshKey }: { user: { id: string } | null; isAdmin: boolean; refreshKey: number }) {
  const [rows, setRows] = useState<SavedCalc[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "20" })
      if (!isAdmin) params.set("salesPersonId", user.id)
      const res = await authFetch(`/api/admin/commission?${params}`)
      const json = await res.json()
      if (json.success) setRows(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [user, isAdmin])

  useEffect(() => { load() }, [load, refreshKey])

  if (loading) return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  )

  if (rows.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3 p-8 text-center">
      <span className="text-5xl">📊</span>
      <p className="font-bold text-gray-600">No saved calculations</p>
      <p className="text-sm">Use the Calculator tab and tap Save</p>
    </div>
  )

  return (
    <div className="p-4 space-y-3 pb-8">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{rows.length} saved calculation{rows.length !== 1 ? "s" : ""}</p>
        <button onClick={load} className="text-xs text-emerald-600 font-semibold">Refresh</button>
      </div>
      {rows.map(row => {
        const col = slabColors(row.qualifiedSlab as 25|35|45)
        return (
          <div key={row.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-gray-900">{row.salesPersonName}</p>
                <p className="text-xs text-gray-500">{MONTH_NAMES[row.month - 1]} {row.year}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold text-emerald-600">{fmt(row.totalCommission)}</p>
                <p className="text-xs text-gray-400">{new Date(row.createdAt).toLocaleDateString("en-IN")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${col.border} ${col.light} ${col.text}`}>
                {slabToTier(row.qualifiedSlab as 25|35|45)}
              </span>
              <span className="text-xs text-gray-500">{row.totalQty} signups</span>
              <span className="text-xs text-gray-500">{fmt(row.totalValue)} value</span>
              {row.calcType === "renewal" && (
                <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">Renewal</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabId = "signup" | "renewal" | "history"

export default function MobileCommissionPage() {
  const { user, permissions, isAuthenticated, _isHydrated, _isBootstrapped, initialize } = useAuthStore()
  const { prompt: installPrompt, install } = useInstallPrompt()
  const [activeTab, setActiveTab] = useState<TabId>("signup")
  const [historyKey, setHistoryKey] = useState(0)

  // Restore + server-validate the session before rendering any protected UI.
  useEffect(() => { initialize() }, [initialize])

  const isAdmin = (permissions as string[]).includes("settings:edit")
  const safeUser = user ? { id: user.id, name: user.name ?? "Unknown" } : null

  // Not hydrated or session not yet validated — loader only, no protected UI.
  if (!_isHydrated || !_isBootstrapped) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  )

  // Not authenticated — show login
  if (!isAuthenticated || !user) return (
    <>
      <LoginScreen onLogin={() => {}} />
      <Toaster position="top-center" />
    </>
  )

  const TABS: { id: TabId; label: string }[] = [
    { id: "signup",  label: "Signup" },
    { id: "renewal", label: "Renewal" },
    { id: "history", label: "History" },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/quantix-logo.png" alt="" className="h-7 w-7 rounded-lg" />
            <div>
              <p className="text-sm font-black text-gray-900 leading-none">Commission</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Quantix Internal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {installPrompt && (
              <button
                onClick={install}
                className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg"
              >
                + Install
              </button>
            )}
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-700">{(user.name ?? "?")[0].toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 pb-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 h-9 rounded-xl text-sm font-bold transition-colors ${activeTab === t.id ? "bg-emerald-500 text-white" : "text-gray-500 hover:bg-gray-100"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 relative overflow-auto">
        {activeTab === "signup" && (
          <SignupCalculator user={safeUser} onHistoryRefresh={() => setHistoryKey(k => k + 1)} />
        )}
        {activeTab === "renewal" && (
          <RenewalCalculator user={safeUser} onHistoryRefresh={() => setHistoryKey(k => k + 1)} />
        )}
        {activeTab === "history" && (
          <HistoryView user={safeUser} isAdmin={isAdmin} refreshKey={historyKey} />
        )}
      </div>
    </div>
  )
}
