"use client"

// Customer App QR — the thing a business owner prints and puts on the counter.
//
// Uses the shared QR engine (src/lib/qr-export), the same one behind the Store
// Location QR. Only the payload differs: a URL here, coordinates there.
//
// The workflow this exists to serve is deliberately short:
//   Mobile Apps → Customer App → QR Code → Download PNG → print.
// Download PNG is therefore the primary action, not one option among four.

import { useCallback, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Share2, Link as LinkIcon, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  qrPreviewDataUrl, downloadQrPng, downloadQrSvg, shareQr, canShareQr, qrSlug,
} from "@/lib/qr-export"

export interface AppQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The URL the QR encodes — exactly what the card shows. */
  url: string
  /** Business identity, e.g. "Laundry & Drycleaners". */
  businessName: string
  /** Which app, e.g. "Customer App". */
  appName: string
}

export function AppQrDialog({ open, onOpenChange, url, businessName, appName }: AppQrDialogProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileBase = `${qrSlug(businessName)}-${qrSlug(appName)}-qr`
  // Hostname only: the scheme is noise on a poster.
  const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "")

  useEffect(() => {
    if (!open || !url) return
    let alive = true
    qrPreviewDataUrl(url, 640).then((d) => { if (alive) setPreview(d) }).catch(() => { if (alive) setPreview(null) })
    return () => { alive = false }
  }, [open, url])

  const run = useCallback(async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key)
    try { await fn(); toast.success(ok) }
    catch { toast.error("Could not generate the QR") }
    finally { setBusy(null) }
  }, [])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      toast.success("✓ Link copied")
    } catch { toast.error("Could not copy the link") }
  }, [url])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-[420px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-base">Customer App QR</DialogTitle>
          <DialogDescription className="text-xs">Scan to open {businessName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            {preview
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={preview} alt={`${businessName} ${appName} QR`} className="h-[240px] w-[240px]" />
              : <div className="h-[240px] w-[240px] grid place-items-center text-slate-300"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          </div>

          {/* Business above app, matching the branding hierarchy used elsewhere. */}
          <div className="text-center min-w-0 w-full">
            <p className="text-sm font-semibold text-slate-800 break-words">{businessName}</p>
            <p className="text-xs text-slate-500">{appName}</p>
            <p className="mt-1 text-[11px] font-mono text-slate-400 break-all">{display}</p>
          </div>

          <div className="w-full space-y-2">
            {/* Primary: the print workflow this dialog exists for. */}
            <Button
              className="w-full gap-1.5"
              disabled={busy === "png"}
              onClick={() => run("png", () => downloadQrPng(url, fileBase), "Downloaded 1000 × 1000 PNG")}>
              {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PNG
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline" size="sm" className="gap-1.5"
                disabled={busy === "svg"}
                onClick={() => run("svg", () => downloadQrSvg(url, fileBase), "Downloaded SVG")}>
                {busy === "svg" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} SVG
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <LinkIcon className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>

            {/* Hidden rather than shown-broken where the browser cannot share. */}
            {canShareQr() && (
              <Button
                variant="outline" size="sm" className="w-full gap-1.5"
                disabled={busy === "share"}
                onClick={async () => {
                  setBusy("share")
                  const ok = await shareQr(url, fileBase, `${businessName} — ${appName}`, `Book with ${businessName}`)
                  if (!ok) toast.error("Sharing is not available here")
                  setBusy(null)
                }}>
                {busy === "share" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Share
              </Button>
            )}
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            Print for the counter, the entrance, visiting cards or posters. Scanning opens your branded customer app.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
