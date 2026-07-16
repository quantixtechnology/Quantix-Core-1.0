"use client"

// My Profile — the Customer Master editor. Reuses the single Customer model via
// GET/PUT /api/core/storefront/profile (no new table/API). Communication
// preferences + language persist in Customer.metadata. Phone is read-only here
// (changing it requires OTP; storefront OTP is email-based today).
import { useCallback, useEffect, useMemo, useState } from "react"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { ChevronLeft, Loader2, Save, ShieldCheck } from "lucide-react"
import { LaundryImageUpload } from "@/components/laundry/views/pricing/laundry-image-upload"
import type { WebNav } from "../storefront-website"

interface CommPrefs { sms: boolean; whatsapp: boolean; email: boolean; push: boolean }
interface Profile {
  name: string; email: string; phone: string; avatar: string; gstNumber: string
  dateOfBirth: string; gender: string; phoneVerified: boolean
  commPrefs: CommPrefs; preferredLanguage: string
}
const EMPTY: Profile = { name: "", email: "", phone: "", avatar: "", gstNumber: "", dateOfBirth: "", gender: "", phoneVerified: false, commPrefs: { sms: true, whatsapp: true, email: true, push: true }, preferredLanguage: "" }
const toDateInput = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "")

export function CustomerProfileEditor({ brandColor, nav }: { brandColor: string; nav: WebNav }) {
  const { isAuthenticated, token } = useAuthStore()
  const { currentBusinessId } = useAdminStore()
  const [p, setP] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => (x ? { ...x, [k]: v } : x))
  const setPref = (k: keyof CommPrefs, v: boolean) => setP((x) => (x ? { ...x, commPrefs: { ...x.commPrefs, [k]: v } } : x))

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (token) h["Authorization"] = `Bearer ${token}`
    if (currentBusinessId) h["x-business-id"] = currentBusinessId
    return h
  }, [token, currentBusinessId])

  const load = useCallback(() => {
    if (!isAuthenticated || !token) { setLoading(false); return }
    setLoading(true)
    fetch("/api/core/storefront/profile", { headers }).then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          const d = j.data
          setP({ name: d.name ?? "", email: d.email ?? "", phone: d.phone ?? "", avatar: d.avatar ?? "", gstNumber: d.gstNumber ?? "", dateOfBirth: toDateInput(d.dateOfBirth), gender: d.gender ?? "", phoneVerified: !!d.phoneVerified, commPrefs: { ...EMPTY.commPrefs, ...(d.commPrefs || {}) }, preferredLanguage: d.preferredLanguage ?? "" })
        } else setP({ ...EMPTY })
      }).catch(() => setP({ ...EMPTY })).finally(() => setLoading(false))
  }, [isAuthenticated, token, headers])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!p) return
    if (!p.name.trim()) { const { toast } = await import("sonner"); toast.error("Name is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/core/storefront/profile", { method: "PUT", headers, body: JSON.stringify({
        name: p.name, email: p.email || null, gstNumber: p.gstNumber || null, avatar: p.avatar || null,
        dateOfBirth: p.dateOfBirth || null, gender: p.gender || null, commPrefs: p.commPrefs, preferredLanguage: p.preferredLanguage || null,
      }) })
      const j = await res.json()
      const { toast } = await import("sonner")
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not save")
      toast.success("Profile updated")
    } catch (e) { const { toast } = await import("sonner"); toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  if (loading || !p) return <div className="px-4 py-16 text-center text-sm text-gray-400"><Loader2 className="inline w-4 h-4 animate-spin" /> Loading…</div>

  return (
    <div className="px-4 sm:px-6 py-4 pb-24 max-w-lg mx-auto">
      <button onClick={() => nav.go("profile")} className="inline-flex items-center gap-1 text-sm text-gray-500"><ChevronLeft className="w-4 h-4" /> My Account</button>
      <h1 className="mt-2 text-lg font-bold text-gray-900">My Profile</h1>

      {/* Photo */}
      <div className="mt-4 flex items-center gap-3">
        <LaundryImageUpload value={p.avatar || null} businessId={currentBusinessId || ""} folder="customer-avatars" onChange={(url) => set("avatar", url || "")} />
        <span className="text-xs text-gray-400">Profile photo</span>
      </div>

      <div className="mt-4 space-y-3">
        <L label="Full Name *"><input value={p.name} onChange={(e) => set("name", e.target.value)} className="inp" placeholder="Your name" /></L>
        <L label="Email"><input value={p.email} onChange={(e) => set("email", e.target.value)} className="inp" placeholder="you@email.com" /></L>
        <L label="Mobile Number">
          <div className="flex items-center gap-2">
            <input value={p.phone} readOnly className="inp flex-1 bg-gray-50 text-gray-500" />
            {p.phoneVerified && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><ShieldCheck className="w-3.5 h-3.5" /> Verified</span>}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">To change your number, verify via OTP (coming soon).</p>
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Gender">
            <select value={p.gender} onChange={(e) => set("gender", e.target.value)} className="inp bg-white">
              <option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
            </select>
          </L>
          <L label="Date of Birth"><input type="date" value={p.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className="inp" /></L>
        </div>
        <L label="GST Number (optional)"><input value={p.gstNumber} onChange={(e) => set("gstNumber", e.target.value)} className="inp" placeholder="29ABCDE1234F1Z5" /></L>

        {/* Communication preferences */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Communication Preferences</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {([["sms", "SMS"], ["whatsapp", "WhatsApp"], ["email", "Email"], ["push", "Push Notifications"]] as [keyof CommPrefs, string][]).map(([k, lbl]) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                <input type="checkbox" checked={p.commPrefs[k]} onChange={(e) => setPref(k, e.target.checked)} /> {lbl}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="mt-5 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: brandColor }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Profile
      </button>

      <style>{`.inp{width:100%;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{border-color:${brandColor}}`}</style>
    </div>
  )
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>{children}</div>
}
