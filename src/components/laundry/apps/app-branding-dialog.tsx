"use client"

// App Branding — set the launcher icon for ONE installed application.
//
// A launcher icon is not the website logo. The website header wants a landscape
// lockup; Android wants a square that still reads at 48dp beside three
// siblings. Each app therefore carries its own icon, and this is where a
// business replaces the generated default with their own.
//
// Uploading nothing is a valid state: the app falls back to the business logo,
// and then to a generated default in that app's accent — which is what keeps
// four unbranded apps visually distinct on the launcher.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Image as ImageIcon, Loader2, Upload, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/admin-fetch"


/** Largest body the proxy in front of the app will accept, with headroom. */
const MAX_UPLOAD_BYTES = 900 * 1024

/**
 * Render the chosen file to a square PNG before uploading.
 *
 * Two problems, one answer. A launcher icon is 512px — sending a 6 MB camera
 * shot wastes the whole budget, and the proxy rejects a body over ~1 MB with an
 * HTML error page that JSON.parse then chokes on ("Unexpected token '<'").
 * Rasterising here keeps every upload small AND squares a non-square source
 * without distorting it: the art is centred at its true aspect ratio on a
 * transparent canvas — never stretched, never cropped.
 *
 * SVG is passed through untouched when it is small enough: it is already
 * resolution-independent, and rasterising would throw that away.
 */
async function toSquarePng(file: File, size = 512): Promise<File> {
  if (file.type === "image/svg+xml" && file.size <= MAX_UPLOAD_BYTES) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    // Cannot decode it here; let the server judge it rather than guessing.
    return file
  }
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return file

  const scale = Math.min(size / bitmap.width, size / bitmap.height)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  ctx.drawImage(bitmap, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h)
  bitmap.close()

  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"))
  if (!blob) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" })
}

/**
 * Read a response that is SUPPOSED to be JSON.
 *
 * A proxy rejecting an oversized body answers with an HTML page, and so does a
 * 404 or a crash. Parsing that blind produces "Unexpected token '<'", which
 * tells the user nothing. Report what actually happened instead.
 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (res.status === 413) throw new Error("That image is too large. Try one under 1 MB.")
    throw new Error(`Upload failed (HTTP ${res.status}). The server did not return a result.`)
  }
}

export type AppKey = "customer" | "delivery" | "admin" | "store"

export function AppBrandingDialog({
  appKey,
  appLabel,
  businessId,
  slug,
}: {
  appKey: AppKey
  appLabel: string
  businessId: string
  slug: string | null
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Cache-bust the preview after a change; the icon route caches for a day.
  const [v, setV] = useState(0)

  const preview = slug ? `/api/core/app-icon/${slug}/${appKey}/192.png?v=${v}` : null

  const save = async (file: File | null) => {
    setBusy(true)
    try {
      let url: string | null = null
      if (file) {
        const prepared = await toSquarePng(file)
        if (prepared.size > MAX_UPLOAD_BYTES) {
          throw new Error("That image is too large. Try one under 1 MB.")
        }
        const fd = new FormData()
        fd.append("file", prepared)
        fd.append("businessId", businessId)
        fd.append("folder", "branding")
        fd.append("category", "branding")
        const headers = getAuthHeaders()
        delete (headers as Record<string, string>)["Content-Type"]
        const up = await fetch("/api/core/upload", { method: "POST", body: fd, headers })
        const uj = await readJson(up)
        if (!up.ok || !uj.success) throw new Error((uj.error as string) || "Upload failed")
        url = uj.url as string
      }
      const res = await fetch(`/api/core/businesses/${businessId}/app-branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ app: appKey, logo: url }),
      })
      const json = await readJson(res)
      if (!res.ok || json.success === false) throw new Error((json.error as string) || "Could not save")
      setV((n) => n + 1)
      toast.success(file ? `${appLabel} icon updated` : `${appLabel} icon reset to default`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
          <ImageIcon className="h-3.5 w-3.5" /> App Branding
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="text-base">{appLabel} icon</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={`${appLabel} icon`} className="h-16 w-16 rounded-2xl border border-slate-200 bg-white object-contain" />
            ) : (
              <div className="h-16 w-16 rounded-2xl border border-dashed border-slate-200 grid place-items-center text-slate-300"><ImageIcon className="h-6 w-6" /></div>
            )}
            <p className="text-xs text-slate-500">
              Square works best — this is what appears on the phone&apos;s home screen. Without one, {appLabel} uses your business logo, then a generated icon in its own colour.
            </p>
          </div>

          <label className="block">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) save(f); e.target.value = "" }}
            />
            <span className="inline-flex w-full items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 text-sm font-medium cursor-pointer hover:bg-slate-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload icon
            </span>
          </label>

          <Button variant="ghost" size="sm" className="w-full gap-1.5 text-slate-500" disabled={busy} onClick={() => save(null)}>
            <RotateCcw className="h-3.5 w-3.5" /> Use the default
          </Button>

          <p className="text-[11px] text-slate-400">
            Changing this affects {appLabel} only. Your website logo and the other apps are untouched.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
