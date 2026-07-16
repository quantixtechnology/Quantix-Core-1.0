"use client"

// My Profile — simple Customer Master editor. Reuses the single Customer model
// via GET/PUT /api/core/storefront/profile and the EXISTING upload endpoint
// (/api/core/upload) — no new table, API, upload engine, or duplicate page.
// Fields: photo, name, email, phone (read-only), gender, DOB, GST. Nothing else.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useCustomerAuthStore as useAuthStore } from "@/stores/customer-auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { toast } from "sonner"
import { ChevronLeft, Loader2, Save, ShieldCheck, Camera, Trash2, CheckCircle2 } from "lucide-react"
import { resolveImageUrl } from "@/lib/image-url"
import type { WebNav } from "../storefront-website"

interface Profile { name: string; email: string; phone: string; avatar: string; gstNumber: string; dateOfBirth: string; gender: string; phoneVerified: boolean }
const EMPTY: Profile = { name: "", email: "", phone: "", avatar: "", gstNumber: "", dateOfBirth: "", gender: "", phoneVerified: false }
const toDateInput = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "")
const MAX_MB = 20

export function CustomerProfileEditor({ brandColor, nav }: { brandColor: string; nav: WebNav }) {
  const { isAuthenticated, token } = useAuthStore()
  const { currentBusinessId } = useAdminStore()
  const [p, setP] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => (x ? { ...x, [k]: v } : x))

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h["Authorization"] = `Bearer ${token}`
    if (currentBusinessId) h["x-business-id"] = currentBusinessId
    return h
  }, [token, currentBusinessId])

  const load = useCallback(() => {
    if (!isAuthenticated || !token) { setLoading(false); return }
    setLoading(true)
    fetch("/api/core/storefront/profile", { headers: authHeaders }).then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          const d = j.data
          setP({ name: d.name ?? "", email: d.email ?? "", phone: d.phone ?? "", avatar: d.avatar ?? "", gstNumber: d.gstNumber ?? "", dateOfBirth: toDateInput(d.dateOfBirth), gender: d.gender ?? "", phoneVerified: !!d.phoneVerified })
        } else setP({ ...EMPTY })
      }).catch(() => setP({ ...EMPTY })).finally(() => setLoading(false))
  }, [isAuthenticated, token, authHeaders])
  useEffect(() => { load() }, [load])

  // Reuses the EXISTING upload endpoint (/api/core/upload) with the CUSTOMER
  // token — the previous bug sent the ADMIN token (via admin-fetch), which a
  // customer session doesn't have, so every upload failed.
  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ""
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Image is too large (max ${MAX_MB} MB).`); return }
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append("file", file); fd.append("businessId", currentBusinessId || ""); fd.append("folder", "customer-avatars")
      const res = await fetch("/api/core/upload", { method: "POST", body: fd, headers: authHeaders })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.success && j.url) { set("avatar", j.url); toast.success("Photo updated") }
      else if (res.status === 401) toast.error("Your session expired. Please sign in again.")
      else toast.error(j.error || "Upload failed. Please try again.")
    } catch { toast.error("Upload failed. Check your connection and try again.") } finally { setUploadingPhoto(false) }
  }

  const save = async () => {
    if (!p) return
    if (!p.name.trim()) { toast.error("Name is required"); return }
    setSaving(true); setSavedOk(false)
    try {
      const res = await fetch("/api/core/storefront/profile", { method: "PUT", headers: { ...authHeaders, "Content-Type": "application/json" }, body: JSON.stringify({
        name: p.name, email: p.email || null, gstNumber: p.gstNumber || null,
        avatar: p.avatar || null, dateOfBirth: p.dateOfBirth || null, gender: p.gender || null,
      }) })
      const j = await res.json()
      if (!res.ok || j.success === false) throw new Error(j.error || "Could not save")
      setSavedOk(true); toast.success("Profile updated successfully")
      setTimeout(() => setSavedOk(false), 2500)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed") } finally { setSaving(false) }
  }

  if (loading || !p) return <div className="px-4 py-16 text-center text-sm text-gray-400"><Loader2 className="inline w-4 h-4 animate-spin" /> Loading…</div>

  const initial = (p.name || "U").charAt(0).toUpperCase()
  const avatarSrc = p.avatar ? resolveImageUrl(p.avatar) : ""

  return (
    <div className="px-4 sm:px-6 py-4 pb-24 max-w-2xl mx-auto">
      <button onClick={() => nav.go("profile")} className="inline-flex items-center gap-1 text-sm text-gray-500"><ChevronLeft className="w-4 h-4" /> My Account</button>
      <h1 className="mt-2 text-lg font-bold text-gray-900">My Profile</h1>

      <div className="mt-4 grid gap-6 md:grid-cols-[auto_1fr]">
        {/* Photo — left on desktop, top on mobile */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative h-28 w-28 overflow-hidden rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white" style={{ backgroundColor: brandColor, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>{initial}</span>
            )}
            {uploadingPhoto && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onPhoto} />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Camera className="w-3.5 h-3.5" /> {p.avatar ? "Replace" : "Upload"}</button>
            {p.avatar && <button onClick={() => set("avatar", "")} disabled={uploadingPhoto} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Remove</button>}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <L label="Full Name *"><input value={p.name} onChange={(e) => set("name", e.target.value)} className="inp" placeholder="Your name" /></L>
          <L label="Email"><input value={p.email} onChange={(e) => set("email", e.target.value)} className="inp" placeholder="you@email.com" /></L>
          <L label="Mobile Number">
            <div className="flex items-center gap-2">
              <input value={p.phone || "—"} readOnly className="inp flex-1 bg-gray-50 text-gray-500" />
              {p.phoneVerified && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><ShieldCheck className="w-3.5 h-3.5" /> Verified</span>}
            </div>
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Gender (optional)">
              <select value={p.gender} onChange={(e) => set("gender", e.target.value)} className="inp bg-white">
                <option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
              </select>
            </L>
            <L label="Date of Birth (optional)"><input type="date" value={p.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className="inp" /></L>
          </div>
          <L label="GST Number (optional)"><input value={p.gstNumber} onChange={(e) => set("gstNumber", e.target.value)} className="inp" placeholder="29ABCDE1234F1Z5" /></L>

          <button onClick={save} disabled={saving} className="mt-1 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: savedOk ? "#10b981" : brandColor }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedOk ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : savedOk ? "Profile Updated" : "Save Profile"}
          </button>
        </div>
      </div>

      <style>{`.inp{width:100%;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{border-color:${brandColor}}`}</style>
    </div>
  )
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>{children}</div>
}
