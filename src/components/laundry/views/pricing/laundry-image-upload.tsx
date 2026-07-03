"use client"

// Reusable tenant image uploader for Laundry Service / Subscription Plan
// marketing images. Reuses the EXISTING Quantix upload endpoint
// (/api/core/upload) + auth headers + validation — no new upload server, no
// base64. Stores the returned upload URL string on the record. Tenant isolation
// is enforced server-side (businessId is resolved from the authed session there).

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, ImageIcon, X } from "lucide-react"
import { getAuthHeaders } from "@/lib/admin-fetch"
import { resolveImageUrl } from "@/lib/image-url"
import { toast } from "sonner"

export function LaundryImageUpload({ value, businessId, folder, onChange }: { value: string | null; businessId: string; folder: string; onChange: (url: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const preview = value ? resolveImageUrl(value) : ""

  const MAX_MB = 20
  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  const pick = () => inputRef.current?.click()
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!businessId) { toast.error("No business context — please reload and try again."); return }
    // Client-side guards with clear, compact messages (kept in sync with the server).
    if (!ALLOWED.includes(file.type)) { toast.error("Unsupported image format. Use JPEG, PNG, WebP or GIF."); if (inputRef.current) inputRef.current.value = ""; return }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Image is too large. Maximum size is ${MAX_MB} MB.`); if (inputRef.current) inputRef.current.value = ""; return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("businessId", businessId)
      fd.append("folder", folder)
      // Strip JSON Content-Type so the browser sets multipart/form-data + boundary.
      const { "Content-Type": _ct, ...headers } = getAuthHeaders()
      const res = await fetch("/api/core/upload", { method: "POST", body: fd, headers })
      let json: { success?: boolean; url?: string; error?: string } = {}
      try { json = await res.json() } catch { /* non-JSON (e.g. 413 from proxy) */ }
      if (res.ok && json.success && json.url) { onChange(json.url); toast.success("Image uploaded") }
      else if (res.status === 401) toast.error("Your session expired. Please sign in again.")
      else if (res.status === 413) toast.error(`Image is too large. Maximum size is ${MAX_MB} MB.`)
      else toast.error(json.error || "Upload failed. Please try again.")
    } catch { toast.error("Upload failed. Please check your connection and try again.") } finally { setUploading(false); if (inputRef.current) inputRef.current.value = "" }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onFile} />
      {preview ? (
        <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange(null)} className="absolute top-1.5 right-1.5 rounded-full bg-black/60 text-white p-1"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button type="button" onClick={pick} className="w-full aspect-[16/9] rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
          <ImageIcon className="h-6 w-6" /><span className="text-xs font-medium">No image</span>
        </button>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 flex-1" onClick={pick} disabled={uploading}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {preview ? "Replace Image" : "Upload Image"}
        </Button>
        {preview && <Button type="button" size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => onChange(null)}>Remove</Button>}
      </div>
      <p className="text-[10px] text-slate-400">JPEG / PNG / WebP / GIF, up to 20&nbsp;MB. Optional — a service/plan without an image uses the default icon.</p>
    </div>
  )
}
